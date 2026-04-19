/**
 * Workflow CRUD Controller — Phase 6 Step 2 (Server Persistence)
 *
 * REST endpoints for workflow lifecycle management:
 *   GET    /workflows                         — List workflows (with search/filter/pagination)
 *   POST   /workflows                         — Create new workflow
 *   GET    /workflows/:id                     — Get workflow detail (with nodes/edges)
 *   PUT    /workflows/:id                     — Update workflow (OCC protected)
 *   DELETE /workflows/:id                     — Soft delete workflow
 *   POST   /workflows/:id/publish             — Publish (create version snapshot)
 *   POST   /workflows/:id/archive             — Archive workflow
 *   POST   /workflows/:id/duplicate           — Duplicate workflow
 *   GET    /workflows/:id/versions            — List version history
 *   POST   /workflows/:id/versions/:vid/restore — Restore to a specific version
 *
 * Note: The execute-draft and resolve-nodes endpoints remain in WorkflowController
 */
import {
  Controller, Get, Post, Put, Delete,
  Body, Param, Query, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { CurrentUser, RequestUser, Audit, Roles } from '../../common/decorators';
import {
  WorkflowPersistenceService,
  CreateWorkflowDto,
  UpdateWorkflowDto,
  WorkflowNodeDto,
  WorkflowEdgeDto,
} from './workflow-persistence.service';

// ── Request DTOs ──

class CreateWorkflowBody {
  key!: string;
  name!: string;
  description?: string;
  tags?: string[];
  nodes!: WorkflowNodeDto[];
  edges?: WorkflowEdgeDto[];
}

class UpdateWorkflowBody {
  name?: string;
  description?: string;
  tags?: string[];
  nodes?: WorkflowNodeDto[];
  edges?: WorkflowEdgeDto[];
  expectedVersion!: number;
}

class PublishBody {
  label?: string;
}

class DuplicateBody {
  newKey!: string;
  newName!: string;
}

@ApiTags('Workflows')
@ApiBearerAuth()
@Controller('workflows')
export class WorkflowCrudController {
  constructor(private readonly persistence: WorkflowPersistenceService) {}

  /**
   * GET /workflows
   * List saved workflows for the current tenant.
   */
  @Get()
  @Roles('OPERATOR', 'DEVELOPER', 'VIEWER')
  @ApiOperation({ summary: 'List saved workflows' })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'sortBy', required: false, enum: ['updatedAt', 'createdAt', 'name'] })
  @ApiQuery({ name: 'sortOrder', required: false, enum: ['asc', 'desc'] })
  async listWorkflows(
    @CurrentUser() user: RequestUser,
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('tags') tags?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string,
  ) {
    return this.persistence.findAll(
      { tenantId: user.tenantId, userId: user.userId, role: user.role },
      {
        status,
        search,
        tags: tags ? tags.split(',').map(t => t.trim()) : undefined,
        page: page ? parseInt(page, 10) : undefined,
        limit: limit ? parseInt(limit, 10) : undefined,
        sortBy: sortBy as any,
        sortOrder: sortOrder as any,
      },
    );
  }

  /**
   * POST /workflows
   * Create a new workflow.
   */
  @Post()
  @Roles('OPERATOR', 'DEVELOPER')
  @Audit('CREATE', 'Workflow')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new saved workflow' })
  @ApiResponse({ status: 201, description: 'Created workflow with nodes and edges' })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  @ApiResponse({ status: 409, description: 'Duplicate key' })
  async createWorkflow(
    @CurrentUser() user: RequestUser,
    @Body() body: CreateWorkflowBody,
  ) {
    return this.persistence.create(
      { tenantId: user.tenantId, userId: user.userId, role: user.role },
      body,
    );
  }

  /**
   * GET /workflows/:id
   * Get full workflow detail including nodes and edges.
   */
  @Get(':id')
  @Roles('OPERATOR', 'DEVELOPER', 'VIEWER')
  @ApiOperation({ summary: 'Get workflow detail with nodes and edges' })
  @ApiResponse({ status: 200, description: 'Workflow detail' })
  @ApiResponse({ status: 404, description: 'Workflow not found' })
  async getWorkflow(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
  ) {
    return this.persistence.findOne(
      { tenantId: user.tenantId, userId: user.userId, role: user.role },
      id,
    );
  }

  /**
   * PUT /workflows/:id
   * Update workflow. Requires expectedVersion for OCC.
   */
  @Put(':id')
  @Roles('OPERATOR', 'DEVELOPER')
  @Audit('UPDATE', 'Workflow')
  @ApiOperation({ summary: 'Update workflow (OCC protected)' })
  @ApiResponse({ status: 200, description: 'Updated workflow' })
  @ApiResponse({ status: 404, description: 'Workflow not found' })
  @ApiResponse({ status: 409, description: 'Version conflict (OCC)' })
  async updateWorkflow(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() body: UpdateWorkflowBody,
  ) {
    return this.persistence.update(
      { tenantId: user.tenantId, userId: user.userId, role: user.role },
      id,
      body,
    );
  }

  /**
   * DELETE /workflows/:id
   * Soft-delete a workflow.
   */
  @Delete(':id')
  @Roles('OPERATOR', 'DEVELOPER')
  @Audit('DELETE', 'Workflow')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete a workflow' })
  @ApiResponse({ status: 204, description: 'Deleted' })
  @ApiResponse({ status: 404, description: 'Workflow not found' })
  async deleteWorkflow(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
  ) {
    await this.persistence.remove(
      { tenantId: user.tenantId, userId: user.userId, role: user.role },
      id,
    );
  }

  /**
   * POST /workflows/:id/publish
   * Publish the current state as a new version snapshot.
   */
  @Post(':id/publish')
  @Roles('OPERATOR', 'DEVELOPER')
  @Audit('PUBLISH', 'Workflow')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Publish workflow (create version snapshot)' })
  @ApiResponse({ status: 200, description: 'Published version info' })
  async publishWorkflow(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() body: PublishBody,
  ) {
    return this.persistence.publish(
      { tenantId: user.tenantId, userId: user.userId, role: user.role },
      id,
      body.label,
    );
  }

  /**
   * POST /workflows/:id/archive
   * Archive a workflow (removes from active list, keeps data).
   */
  @Post(':id/archive')
  @Roles('OPERATOR', 'DEVELOPER')
  @Audit('ARCHIVE', 'Workflow')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Archive a workflow' })
  async archiveWorkflow(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
  ) {
    await this.persistence.archive(
      { tenantId: user.tenantId, userId: user.userId, role: user.role },
      id,
    );
  }

  /**
   * POST /workflows/:id/duplicate
   * Duplicate a workflow with a new key and name.
   */
  @Post(':id/duplicate')
  @Roles('OPERATOR', 'DEVELOPER')
  @Audit('CREATE', 'Workflow')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Duplicate a workflow' })
  async duplicateWorkflow(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() body: DuplicateBody,
  ) {
    return this.persistence.duplicate(
      { tenantId: user.tenantId, userId: user.userId, role: user.role },
      id,
      body.newKey,
      body.newName,
    );
  }

  /**
   * GET /workflows/:id/versions
   * List version history for a workflow.
   */
  @Get(':id/versions')
  @Roles('OPERATOR', 'DEVELOPER', 'VIEWER')
  @ApiOperation({ summary: 'List workflow version history' })
  async listVersions(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
  ) {
    return this.persistence.listVersions(
      { tenantId: user.tenantId, userId: user.userId, role: user.role },
      id,
    );
  }

  /**
   * POST /workflows/:id/versions/:vid/restore
   * Restore workflow to a specific version.
   */
  @Post(':id/versions/:vid/restore')
  @Roles('OPERATOR', 'DEVELOPER')
  @Audit('RESTORE', 'Workflow')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Restore workflow to a specific version' })
  async restoreVersion(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Param('vid') vid: string,
  ) {
    return this.persistence.restoreVersion(
      { tenantId: user.tenantId, userId: user.userId, role: user.role },
      id,
      vid,
    );
  }
}
