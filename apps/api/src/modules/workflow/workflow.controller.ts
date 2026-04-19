/**
 * Workflow Controller — Phase 6 (Step 1: Execution Bridge)
 *
 * Endpoints:
 *   POST /workflows/execute-draft   — Execute builder canvas nodes via real backend pipeline
 *   POST /workflows/resolve-nodes   — Preview node resolution (uiType → capability) without executing
 */
import {
  Controller, Post, Body, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { CurrentUser, RequestUser, Audit, Roles } from '../../common/decorators';
import { WorkflowService } from './workflow.service';
import type { DraftNodeInput, DraftEdgeInput } from './workflow-execution-bridge.service';

// ── Request DTOs ──

class ExecuteDraftDto {
  title?: string;
  nodes!: DraftNodeInput[];
  edges?: DraftEdgeInput[];
}

class ResolveNodesDto {
  nodes!: DraftNodeInput[];
}

@ApiTags('Workflows')
@ApiBearerAuth()
@Controller('workflows')
export class WorkflowController {
  constructor(private readonly workflowService: WorkflowService) {}

  /**
   * POST /workflows/execute-draft
   *
   * Execute a draft workflow from the builder canvas.
   * This does NOT require a saved workflow — it takes raw builder nodes,
   * resolves them via NodeResolutionRegistry, and runs through the
   * real execution pipeline (WorkflowRunner → NodeRouter → ConnectorService/AgentDispatcher).
   *
   * Returns full execution results for each node.
   */
  @Post('execute-draft')
  @Roles('OPERATOR', 'DEVELOPER')
  @Audit('EXECUTE', 'Workflow')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Execute builder draft nodes via real backend pipeline',
    description: 'Converts builder canvas nodes to execution format and runs through WorkflowRunner.',
  })
  @ApiResponse({ status: 200, description: 'Execution results' })
  @ApiResponse({ status: 400, description: 'Invalid node configuration' })
  async executeDraft(
    @CurrentUser() user: RequestUser,
    @Body() dto: ExecuteDraftDto,
  ) {
    return this.workflowService.executeDraft(
      { tenantId: user.tenantId, userId: user.userId, role: user.role },
      dto,
    );
  }

  /**
   * POST /workflows/resolve-nodes
   *
   * Preview how builder nodes will be resolved to execution types.
   * Useful for the UI to show capability badges and data flow arrows.
   */
  @Post('resolve-nodes')
  @Roles('OPERATOR', 'DEVELOPER', 'VIEWER')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Preview node resolution (uiType → executionType + capability)',
  })
  async resolveNodes(
    @CurrentUser() user: RequestUser,
    @Body() dto: ResolveNodesDto,
  ) {
    return this.workflowService.resolveNodes(
      { tenantId: user.tenantId, userId: user.userId, role: user.role },
      dto.nodes,
    );
  }
}
