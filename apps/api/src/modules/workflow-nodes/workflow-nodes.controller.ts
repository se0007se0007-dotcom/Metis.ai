/**
 * Workflow Nodes Controller
 *
 * REST API endpoints for:
 *   - File upload (multipart)
 *   - Pipeline execution (POST with nodes)
 *   - Connector registry listing
 *   - File download
 *   - Execution status / SSE streaming
 */
import {
  Controller, Post, Get, Param, Body, Res, Req,
  UploadedFile, UseInterceptors, HttpCode, HttpStatus,
  BadRequestException, NotFoundException, Logger, Sse,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response, Request } from 'express';
import { Observable, Subject, interval, takeUntil, map, finalize } from 'rxjs';
import { WorkflowNodesService } from './workflow-nodes.service';
import { PipelineEngine, PipelineNode } from './pipeline-engine';
import { NodeExecutorRegistry } from './node-executor-registry';

interface ExecutePipelineBody {
  title: string;
  nodes: PipelineNode[];
  tenantId?: string;
  userId?: string;
  uploadedFiles?: Array<{
    name: string;
    path: string;
    size: number;
    mimeType: string;
    isArchive: boolean;
  }>;
}

@Controller('api/workflow-nodes')
export class WorkflowNodesController {
  private readonly logger = new Logger(WorkflowNodesController.name);

  // Active SSE connections for streaming execution progress
  private executionStreams: Map<string, Subject<any>> = new Map();

  constructor(
    private readonly service: WorkflowNodesService,
    private readonly pipeline: PipelineEngine,
    private readonly registry: NodeExecutorRegistry,
  ) {}

  // ═══════════════════════════════════════════
  //  File Upload
  // ═══════════════════════════════════════════

  @Post('upload/:sessionId')
  @UseInterceptors(FileInterceptor('file', {
    limits: { fileSize: 100 * 1024 * 1024 }, // 100MB max
  }))
  async uploadFile(
    @Param('sessionId') sessionId: string,
    @UploadedFile() file: any,
  ) {
    if (!file) throw new BadRequestException('파일이 없습니다.');

    const result = await this.service.handleFileUpload(
      {
        originalname: file.originalname,
        buffer: file.buffer,
        mimetype: file.mimetype,
        size: file.size,
      },
      sessionId,
    );

    return {
      success: true,
      file: result,
    };
  }

  // ═══════════════════════════════════════════
  //  Pipeline Execution
  // ═══════════════════════════════════════════

  @Post('execute')
  @HttpCode(HttpStatus.OK)
  async executePipeline(@Body() body: ExecutePipelineBody, @Req() req: Request) {
    if (!body.nodes?.length) {
      throw new BadRequestException('실행할 노드가 없습니다.');
    }

    const tenantId = body.tenantId || (req as any).user?.tenantId || 'default';
    const userId = body.userId || (req as any).user?.id || 'anonymous';

    const executionId = `exec-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    // Create SSE stream for real-time progress
    const subject = new Subject<any>();
    this.executionStreams.set(executionId, subject);

    // Execute asynchronously
    this.pipeline.execute(
      {
        title: body.title,
        nodes: body.nodes,
        tenantId,
        userId,
        uploadedFiles: body.uploadedFiles?.map(f => ({
          ...f,
          mimeType: f.mimeType || 'application/octet-stream',
        })),
      },
      (event) => {
        // Push events to SSE stream
        subject.next(event);
        if (event.type === 'pipeline_complete') {
          subject.complete();
          this.executionStreams.delete(executionId);
        }
      },
    ).catch(err => {
      subject.next({ type: 'pipeline_error', error: err.message });
      subject.complete();
      this.executionStreams.delete(executionId);
    });

    return {
      executionId,
      streamUrl: `/v1/api/workflow-nodes/stream/${executionId}`,
      status: 'STARTED',
    };
  }

  /**
   * Synchronous execution — waits for completion and returns all results.
   * Use for simple/short workflows. For long ones, use execute + stream.
   */
  @Post('execute-sync')
  @HttpCode(HttpStatus.OK)
  async executePipelineSync(@Body() body: ExecutePipelineBody, @Req() req: Request) {
    if (!body.nodes?.length) {
      throw new BadRequestException('실행할 노드가 없습니다.');
    }

    const tenantId = body.tenantId || (req as any).user?.tenantId || 'default';
    const userId = body.userId || (req as any).user?.id || 'anonymous';

    const result = await this.pipeline.execute({
      title: body.title,
      nodes: body.nodes,
      tenantId,
      userId,
      uploadedFiles: body.uploadedFiles?.map(f => ({
        ...f,
        mimeType: f.mimeType || 'application/octet-stream',
      })),
    });

    return result;
  }

  // ═══════════════════════════════════════════
  //  SSE Stream for real-time execution progress
  // ═══════════════════════════════════════════

  @Get('stream/:executionId')
  @Sse()
  streamExecution(@Param('executionId') executionId: string): Observable<MessageEvent> {
    const subject = this.executionStreams.get(executionId);
    if (!subject) {
      // Return a completed observable with "not found" event
      return new Observable(subscriber => {
        subscriber.next({ data: JSON.stringify({ type: 'error', message: 'Execution not found' }) } as any);
        subscriber.complete();
      });
    }

    return subject.pipe(
      map(event => ({ data: JSON.stringify(event) } as MessageEvent)),
      finalize(() => {
        this.executionStreams.delete(executionId);
      }),
    );
  }

  // ═══════════════════════════════════════════
  //  Connector Registry
  // ═══════════════════════════════════════════

  @Get('connectors')
  listConnectors() {
    return {
      connectors: this.service.getRegisteredConnectors(),
      totalCount: this.service.getRegisteredConnectors().length,
    };
  }

  @Get('connectors/:key')
  getConnector(@Param('key') key: string) {
    const executor = this.registry.getExecutor(key);
    if (!executor) throw new NotFoundException(`Connector "${key}" not found`);
    return executor.getConnectorMetadata();
  }

  // ═══════════════════════════════════════════
  //  File Download
  // ═══════════════════════════════════════════

  @Get('download/:sessionDir/:fileName')
  downloadFile(
    @Param('sessionDir') sessionDir: string,
    @Param('fileName') fileName: string,
    @Res() res: Response,
  ) {
    const filePath = this.service.getFilePath(sessionDir, fileName);
    if (!filePath) {
      throw new NotFoundException('파일을 찾을 수 없습니다.');
    }

    // Set content disposition for download
    const ext = fileName.split('.').pop()?.toLowerCase();
    const mimeTypes: Record<string, string> = {
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      pdf: 'application/pdf',
      html: 'text/html',
      csv: 'text/csv',
      json: 'application/json',
      md: 'text/markdown',
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };

    res.setHeader('Content-Type', mimeTypes[ext || ''] || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
    res.sendFile(filePath);
  }
}
