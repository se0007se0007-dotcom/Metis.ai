/**
 * Workflow Service — orchestrates draft execution and node resolution.
 *
 * This is the core Step 1 service that bridges:
 *   Frontend builder nodes → NodeResolutionRegistry → WorkflowExecutionBridge → WorkflowRunnerService
 *
 * Future phases will add:
 *   - Workflow CRUD (save, update, delete)
 *   - Version management
 *   - OCC / draft locking
 */
import {
  Injectable, Inject, BadRequestException, Logger,
} from '@nestjs/common';
import { PrismaClient, TenantContext } from '@metis/database';
import { PRISMA_TOKEN } from '../database.module';
import { WorkflowExecutionBridge, ExecuteDraftInput, DraftNodeInput } from './workflow-execution-bridge.service';
import { WorkflowRunnerService, WorkflowRunResult } from '../execution/workflow-runner.service';
import type { ResolvedNode } from './node-resolution.registry';

// ── Response Types ──

export interface ExecuteDraftResponse {
  /** Execution results from the runner */
  execution: WorkflowRunResult;
  /** How each node was resolved */
  nodeResolutions: Array<{
    nodeKey: string;
    nodeName: string;
    uiType: string;
    executionType: string;
    capability: string;
    intentCategory: string;
    inputMapping: Record<string, string>;
  }>;
  /** Connector availability check */
  connectorStatus: {
    allAvailable: boolean;
    missing: string[];
  };
  /** Any warnings generated during resolution */
  warnings: string[];
}

export interface ResolveNodesResponse {
  nodes: Array<{
    nodeKey: string;
    uiType: string;
    executionType: string;
    capability: string;
    intentCategory: string;
    riskLevel: string;
    outputKeys: string[];
    inputMapping: Record<string, string>;
  }>;
  /** Which connector keys are needed */
  requiredConnectors: string[];
}

@Injectable()
export class WorkflowService {
  private readonly logger = new Logger(WorkflowService.name);

  constructor(
    @Inject(PRISMA_TOKEN) private readonly prisma: PrismaClient,
    private readonly bridge: WorkflowExecutionBridge,
    private readonly runner: WorkflowRunnerService,
  ) {}

  /**
   * Execute a draft workflow from builder canvas.
   *
   * Full pipeline:
   *   1. Validate input nodes
   *   2. Resolve nodes via NodeResolutionRegistry
   *   3. Infer data flow (inputMapping)
   *   4. Check connector availability
   *   5. Build RunWorkflowInput
   *   6. Execute via WorkflowRunnerService
   *   7. Return results with resolution metadata
   */
  async executeDraft(
    ctx: TenantContext,
    input: ExecuteDraftInput,
  ): Promise<ExecuteDraftResponse> {
    // 1. Validate
    if (!input.nodes || input.nodes.length === 0) {
      throw new BadRequestException('워크플로우에 노드가 없습니다.');
    }

    // Sanitize node names
    for (const node of input.nodes) {
      if (!node.nodeKey || !node.uiType) {
        throw new BadRequestException(`노드에 nodeKey 또는 uiType이 누락되었습니다.`);
      }
      if (!node.name) {
        node.name = `${node.uiType}-${node.executionOrder}`;
      }
    }

    this.logger.log(
      `[execute-draft] tenant=${ctx.tenantId} user=${ctx.userId} ` +
      `nodes=${input.nodes.length} title="${input.title || 'untitled'}"`,
    );

    // 2-5. Resolve and build via bridge
    const bridgeResult = await this.bridge.buildRunInput(ctx, input);

    // Log resolution summary
    const typeSummary = bridgeResult.resolvedNodes
      .map((r, i) => `${input.nodes[i].name}(${r.uiType}→${r.executionType}:${r.capability})`)
      .join(', ');
    this.logger.log(`[execute-draft] Resolved: ${typeSummary}`);

    // 6. Execute
    let execution: WorkflowRunResult;
    try {
      execution = await this.runner.run(ctx, bridgeResult.runInput);
    } catch (error) {
      const msg = (error as Error).message;
      this.logger.error(`[execute-draft] Runner failed: ${msg}`);
      throw new BadRequestException(`워크플로우 실행 실패: ${msg}`);
    }

    // 7. Build response with resolution metadata
    const nodeResolutions = input.nodes.map((node, idx) => {
      const resolved = bridgeResult.resolvedNodes[idx];
      return {
        nodeKey: node.nodeKey,
        nodeName: node.name,
        uiType: node.uiType,
        executionType: resolved.executionType,
        capability: resolved.capability,
        intentCategory: resolved.intentCategory,
        inputMapping: resolved.inputMapping,
      };
    });

    this.logger.log(
      `[execute-draft] Completed: status=${execution.status} ` +
      `duration=${execution.totalDurationMs}ms ` +
      `succeeded=${execution.nodeResults.filter(r => r.success).length}/${execution.nodeResults.length}`,
    );

    return {
      execution,
      nodeResolutions,
      connectorStatus: {
        allAvailable: bridgeResult.connectorValidation.valid,
        missing: bridgeResult.connectorValidation.missingConnectors.map(m => m.connectorKey),
      },
      warnings: bridgeResult.warnings,
    };
  }

  /**
   * Preview node resolution without executing.
   * Used by the frontend to display capability badges and data flow arrows.
   */
  async resolveNodes(
    ctx: TenantContext,
    nodes: DraftNodeInput[],
  ): Promise<ResolveNodesResponse> {
    if (!nodes || nodes.length === 0) {
      return { nodes: [], requiredConnectors: [] };
    }

    const resolved = this.bridge.resolveNodes(nodes);

    const requiredConnectors = new Set<string>();
    const response = nodes.map((node, idx) => {
      const r = resolved[idx];
      const entry = this.bridge['registry'].getEntry(node.uiType);
      if (entry?.requiredConnectorKey) {
        requiredConnectors.add(entry.requiredConnectorKey);
      }
      return {
        nodeKey: node.nodeKey,
        uiType: node.uiType,
        executionType: r.executionType,
        capability: r.capability,
        intentCategory: r.intentCategory,
        riskLevel: r.riskLevel,
        outputKeys: r.outputKeys,
        inputMapping: r.inputMapping,
      };
    });

    return {
      nodes: response,
      requiredConnectors: Array.from(requiredConnectors),
    };
  }
}
