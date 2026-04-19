/**
 * Pipeline Engine
 *
 * Orchestrates real sequential execution of workflow nodes.
 * Each node receives the accumulated output from all previous nodes.
 * Results are stored in ExecutionSession/ExecutionStep for audit.
 *
 * This is the bridge between the frontend workflow builder and
 * the actual node executors.
 */
import { Injectable, Inject, Logger } from '@nestjs/common';
import { PrismaClient } from '@metis/database';
import { PRISMA_TOKEN } from '../database.module';
import {
  NodeExecutorRegistry,
  NodeExecutionInput,
  NodeExecutionOutput,
  UploadedFileInfo,
} from './node-executor-registry';

export interface PipelineNode {
  id: string;
  type: string;
  name: string;
  order: number;
  settings: Record<string, any>;
}

export interface PipelineExecutionRequest {
  workflowId?: string;
  title: string;
  nodes: PipelineNode[];
  tenantId: string;
  userId: string;
  /** Pre-uploaded files to feed to input nodes */
  uploadedFiles?: UploadedFileInfo[];
}

export interface PipelineNodeResult {
  nodeId: string;
  nodeName: string;
  nodeType: string;
  success: boolean;
  output: NodeExecutionOutput;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  error?: string;
}

export interface PipelineResult {
  executionSessionId: string;
  status: 'SUCCEEDED' | 'FAILED' | 'PARTIAL';
  nodeResults: PipelineNodeResult[];
  finalOutput: string;
  generatedFiles: Array<{ name: string; path: string; format: string; downloadUrl?: string }>;
  totalDurationMs: number;
}

export type PipelineProgressCallback = (event: {
  type: 'node_start' | 'node_complete' | 'node_error' | 'pipeline_complete';
  nodeId?: string;
  nodeName?: string;
  progress: number;
  data?: any;
}) => void;

@Injectable()
export class PipelineEngine {
  private readonly logger = new Logger(PipelineEngine.name);

  constructor(
    @Inject(PRISMA_TOKEN) private readonly prisma: PrismaClient,
    private readonly registry: NodeExecutorRegistry,
  ) {}

  /**
   * Execute a complete workflow pipeline sequentially.
   */
  async execute(
    request: PipelineExecutionRequest,
    onProgress?: PipelineProgressCallback,
  ): Promise<PipelineResult> {
    const startTime = Date.now();
    const sortedNodes = [...request.nodes].sort((a, b) => a.order - b.order);

    // Create execution session
    const session = await this.prisma.executionSession.create({
      data: {
        tenantId: request.tenantId,
        workflowKey: request.workflowId || `adhoc-${Date.now()}`,
        triggeredById: request.userId,
        status: 'RUNNING',
        correlationId: `pipe-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        inputJson: { title: request.title, nodeCount: sortedNodes.length } as any,
      },
    });

    const nodeResults: PipelineNodeResult[] = [];
    const pipelineData: Record<string, NodeExecutionOutput> = {};
    let accumulatedText = '';
    let allGeneratedFiles: PipelineResult['generatedFiles'] = [];
    let hasFailed = false;

    for (let i = 0; i < sortedNodes.length; i++) {
      const node = sortedNodes[i];
      const category = node.settings?.stepCategory || '';

      // Emit progress
      onProgress?.({
        type: 'node_start',
        nodeId: node.id,
        nodeName: node.name,
        progress: (i / sortedNodes.length) * 100,
      });

      // Find executor
      const executor = this.registry.resolve(node.type, category);
      if (!executor) {
        this.logger.warn(`No executor found for ${node.type}:${category}, skipping node ${node.name}`);
        const skipResult: PipelineNodeResult = {
          nodeId: node.id,
          nodeName: node.name,
          nodeType: node.type,
          success: true,
          output: {
            success: true,
            data: { skipped: true, reason: 'No executor registered' },
            outputText: accumulatedText,
            durationMs: 0,
          },
          startedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
          durationMs: 0,
        };
        nodeResults.push(skipResult);
        pipelineData[node.id] = skipResult.output;
        continue;
      }

      // Build execution input
      const execInput: NodeExecutionInput = {
        nodeId: node.id,
        nodeType: node.type,
        nodeName: node.name,
        settings: node.settings,
        pipelineData,
        previousOutput: accumulatedText,
        uploadedFiles: request.uploadedFiles,
        tenantId: request.tenantId,
        userId: request.userId,
        executionSessionId: session.id,
      };

      const nodeStart = Date.now();
      let output: NodeExecutionOutput;

      try {
        output = await executor.execute(execInput);
      } catch (err) {
        const errorMsg = (err as Error).message || 'Unknown execution error';
        this.logger.error(`Node ${node.name} failed: ${errorMsg}`);
        output = {
          success: false,
          data: {},
          outputText: '',
          durationMs: Date.now() - nodeStart,
          error: errorMsg,
        };
      }

      const nodeEnd = Date.now();
      const durationMs = nodeEnd - nodeStart;

      // Store result
      const nodeResult: PipelineNodeResult = {
        nodeId: node.id,
        nodeName: node.name,
        nodeType: node.type,
        success: output.success,
        output,
        startedAt: new Date(nodeStart).toISOString(),
        completedAt: new Date(nodeEnd).toISOString(),
        durationMs,
        error: output.error,
      };
      nodeResults.push(nodeResult);
      pipelineData[node.id] = output;

      // Accumulate text for downstream nodes
      if (output.outputText) {
        accumulatedText = output.outputText;
      }

      // Collect generated files
      if (output.generatedFiles?.length) {
        allGeneratedFiles.push(...output.generatedFiles.map(f => ({
          name: f.name,
          path: f.path,
          format: f.format,
          downloadUrl: f.downloadUrl,
        })));
      }

      // Record execution step
      await this.prisma.executionStep.create({
        data: {
          executionSessionId: session.id,
          stepKey: node.id,
          stepType: node.type,
          capabilityKey: executor?.executorKey || null,
          status: output.success ? 'SUCCEEDED' : 'FAILED',
          startedAt: new Date(Date.now() - durationMs),
          endedAt: new Date(),
          inputJson: { settings: node.settings, previousNodeCount: Object.keys(pipelineData).length } as any,
          outputJson: { text: output.outputText?.slice(0, 2000), data: output.data } as any,
          errorMessage: output.error || null,
          latencyMs: durationMs,
        },
      });

      // Emit progress
      onProgress?.({
        type: output.success ? 'node_complete' : 'node_error',
        nodeId: node.id,
        nodeName: node.name,
        progress: ((i + 1) / sortedNodes.length) * 100,
        data: { durationMs, success: output.success },
      });

      // Handle failure with retry logic
      if (!output.success) {
        const failAction = node.settings?.failureAction || 'continue';
        if (failAction === 'stop') {
          hasFailed = true;
          break;
        }
        if (failAction === 'retry') {
          const retryCount = node.settings?.retryCount || 2;
          let retried = false;
          for (let r = 0; r < retryCount; r++) {
            this.logger.log(`Retrying node ${node.name} (attempt ${r + 2})`);
            try {
              output = await executor.execute(execInput);
              if (output.success) {
                // Update the stored result
                nodeResults[nodeResults.length - 1] = {
                  ...nodeResult,
                  success: true,
                  output,
                  durationMs: Date.now() - nodeStart,
                };
                pipelineData[node.id] = output;
                if (output.outputText) accumulatedText = output.outputText;
                retried = true;
                break;
              }
            } catch { /* continue retrying */ }
          }
          if (!retried) {
            hasFailed = true;
            if (failAction === 'stop') break;
          }
        }
      }
    }

    // Update session status
    const totalDuration = Date.now() - startTime;
    const finalStatus = hasFailed ? 'FAILED' : (nodeResults.every(r => r.success) ? 'SUCCEEDED' : 'FAILED');

    await this.prisma.executionSession.update({
      where: { id: session.id },
      data: {
        status: finalStatus,
        completedAt: new Date(),
        outputJson: {
          nodeCount: nodeResults.length,
          successCount: nodeResults.filter(r => r.success).length,
          totalDurationMs: totalDuration,
          generatedFiles: allGeneratedFiles.length,
        } as any,
      },
    });

    onProgress?.({
      type: 'pipeline_complete',
      progress: 100,
      data: { status: finalStatus, totalDurationMs: totalDuration },
    });

    return {
      executionSessionId: session.id,
      status: finalStatus as any,
      nodeResults,
      finalOutput: accumulatedText,
      generatedFiles: allGeneratedFiles,
      totalDurationMs: totalDuration,
    };
  }
}
