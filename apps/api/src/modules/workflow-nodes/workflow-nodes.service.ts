/**
 * Workflow Nodes Service
 *
 * Coordinates between the frontend, the pipeline engine,
 * file upload handling, and the connector registry.
 */
import { Injectable, Inject, Logger } from '@nestjs/common';
import { PrismaClient } from '@metis/database';
import { PRISMA_TOKEN } from '../database.module';
import { NodeExecutorRegistry } from './node-executor-registry';
import { PipelineEngine, PipelineExecutionRequest, PipelineResult } from './pipeline-engine';
import { EmailService } from '../email/email.service';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class WorkflowNodesService {
  private readonly logger = new Logger(WorkflowNodesService.name);
  private readonly uploadDir: string;

  constructor(
    @Inject(PRISMA_TOKEN) private readonly prisma: PrismaClient,
    private readonly executorRegistry: NodeExecutorRegistry,
    private readonly pipeline: PipelineEngine,
    private readonly emailService: EmailService,
  ) {
    this.uploadDir = process.env.UPLOAD_DIR || '/tmp/metis-uploads';
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  /**
   * Save uploaded file and return metadata
   */
  async handleFileUpload(
    file: { originalname: string; buffer: Buffer; mimetype: string; size: number },
    executionSessionId: string,
  ): Promise<{ path: string; name: string; size: number; isArchive: boolean }> {
    const sessionDir = path.join(this.uploadDir, executionSessionId);
    if (!fs.existsSync(sessionDir)) {
      fs.mkdirSync(sessionDir, { recursive: true });
    }

    const filePath = path.join(sessionDir, file.originalname);
    fs.writeFileSync(filePath, file.buffer);

    const isArchive = ['.zip', '.tar', '.tar.gz', '.tgz', '.7z', '.rar', '.gz']
      .some(ext => file.originalname.toLowerCase().endsWith(ext));

    return {
      path: filePath,
      name: file.originalname,
      size: file.size,
      isArchive,
    };
  }

  /**
   * Execute a complete workflow pipeline
   */
  async executePipeline(request: PipelineExecutionRequest): Promise<PipelineResult> {
    this.logger.log(`Starting pipeline: ${request.title} (${request.nodes.length} nodes)`);
    return this.pipeline.execute(request);
  }

  /**
   * Get list of all registered node connectors
   */
  getRegisteredConnectors() {
    return this.executorRegistry.listConnectors();
  }

  /**
   * Get download path for a generated file
   */
  getFilePath(sessionDir: string, fileName: string): string | null {
    const outputDir = process.env.OUTPUT_DIR || '/tmp/metis-outputs';
    const filePath = path.join(outputDir, sessionDir, fileName);
    if (fs.existsSync(filePath)) return filePath;
    // Also check upload dir
    const uploadPath = path.join(this.uploadDir, sessionDir, fileName);
    if (fs.existsSync(uploadPath)) return uploadPath;
    return null;
  }

  /**
   * Send email with workflow results (used by email-send nodes)
   */
  async sendResultEmail(params: {
    to: string;
    subject: string;
    body: string;
    smtpConfig?: any;
  }) {
    return this.emailService.sendEmail({
      to: params.to,
      subject: params.subject,
      body: params.body,
      html: true,
      smtpConfig: params.smtpConfig,
    });
  }
}
