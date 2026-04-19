/**
 * Workflow Persistence Service — Full CRUD + Version Management
 *
 * Manages the lifecycle of saved workflows:
 *   - Create / Read / Update / Delete (soft)
 *   - Publish (creates a versioned snapshot)
 *   - Version history and restore
 *   - OCC via `version` field (optimistic concurrency control)
 *
 * All operations are tenant-scoped.
 */
import {
  Injectable, Inject, Logger,
  BadRequestException, NotFoundException, ConflictException, ForbiddenException,
} from '@nestjs/common';
import { PrismaClient, TenantContext } from '@metis/database';
import { PRISMA_TOKEN } from '../database.module';

// ── DTOs ──

export interface CreateWorkflowDto {
  key: string;
  name: string;
  description?: string;
  tags?: string[];
  nodes: WorkflowNodeDto[];
  edges?: WorkflowEdgeDto[];
}

export interface UpdateWorkflowDto {
  name?: string;
  description?: string;
  tags?: string[];
  nodes?: WorkflowNodeDto[];
  edges?: WorkflowEdgeDto[];
  /** OCC: client must send the current version number */
  expectedVersion: number;
}

export interface WorkflowNodeDto {
  nodeKey: string;
  uiType: string;
  name: string;
  executionOrder: number;
  config: Record<string, any>;
  inputMapping?: Record<string, string>;
  dependsOn?: string[];
  positionX?: number;
  positionY?: number;
}

export interface WorkflowEdgeDto {
  fromNodeKey: string;
  toNodeKey: string;
  edgeType?: string;
  condition?: string;
  label?: string;
}

export interface WorkflowListQuery {
  status?: string;
  search?: string;
  tags?: string[];
  page?: number;
  limit?: number;
  sortBy?: 'updatedAt' | 'createdAt' | 'name';
  sortOrder?: 'asc' | 'desc';
}

export interface WorkflowListResult {
  items: WorkflowSummary[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface WorkflowSummary {
  id: string;
  key: string;
  name: string;
  description: string | null;
  status: string;
  version: number;
  tags: string[];
  nodeCount: number;
  createdById: string;
  createdByName?: string;
  updatedAt: Date;
  createdAt: Date;
}

export interface WorkflowDetail {
  id: string;
  key: string;
  name: string;
  description: string | null;
  status: string;
  version: number;
  activeVersionId: string | null;
  tags: string[];
  createdById: string;
  updatedById: string | null;
  createdAt: Date;
  updatedAt: Date;
  nodes: WorkflowNodeDto[];
  edges: WorkflowEdgeDto[];
}

export interface WorkflowVersionSummary {
  id: string;
  versionNumber: number;
  label: string | null;
  createdById: string;
  createdByName?: string;
  createdAt: Date;
  nodeCount: number;
}

// ── Service ──

@Injectable()
export class WorkflowPersistenceService {
  private readonly logger = new Logger(WorkflowPersistenceService.name);

  constructor(
    @Inject(PRISMA_TOKEN) private readonly prisma: PrismaClient,
  ) {}

  // ── Create ──

  async create(ctx: TenantContext, dto: CreateWorkflowDto): Promise<WorkflowDetail> {
    // Validate key format
    if (!/^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/.test(dto.key)) {
      throw new BadRequestException(
        '워크플로우 키는 소문자, 숫자, 하이픈만 허용됩니다 (3-64자).',
      );
    }

    // Check duplicate key
    const existing = await this.prisma.workflow.findUnique({
      where: { tenantId_key: { tenantId: ctx.tenantId, key: dto.key } },
    });
    if (existing && !existing.deletedAt) {
      throw new ConflictException(`워크플로우 키 "${dto.key}"가 이미 존재합니다.`);
    }

    if (!dto.nodes || dto.nodes.length === 0) {
      throw new BadRequestException('워크플로우에 최소 1개의 노드가 필요합니다.');
    }

    const workflow = await this.prisma.workflow.create({
      data: {
        tenantId: ctx.tenantId,
        key: dto.key,
        name: dto.name,
        description: dto.description,
        tags: dto.tags || [],
        status: 'DRAFT',
        version: 1,
        createdById: ctx.userId,
        updatedById: ctx.userId,
        nodes: {
          create: dto.nodes.map(n => ({
            nodeKey: n.nodeKey,
            uiType: n.uiType,
            name: n.name,
            executionOrder: n.executionOrder,
            configJson: n.config as any,
            inputMappingJson: n.inputMapping ? (n.inputMapping as any) : undefined,
            dependsOn: n.dependsOn || [],
            positionX: n.positionX,
            positionY: n.positionY,
          })),
        },
        edges: dto.edges ? {
          create: dto.edges.map(e => ({
            fromNodeKey: e.fromNodeKey,
            toNodeKey: e.toNodeKey,
            edgeType: e.edgeType || 'SEQUENCE',
            condition: e.condition,
            label: e.label,
          })),
        } : undefined,
      },
      include: { nodes: true, edges: true },
    });

    this.logger.log(
      `[create] tenant=${ctx.tenantId} key=${dto.key} nodes=${dto.nodes.length}`,
    );

    return this.toDetail(workflow);
  }

  // ── List ──

  async findAll(ctx: TenantContext, query: WorkflowListQuery): Promise<WorkflowListResult> {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const skip = (page - 1) * limit;

    const where: any = {
      tenantId: ctx.tenantId,
      deletedAt: null,
    };

    if (query.status) {
      where.status = query.status;
    }

    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { key: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    if (query.tags && query.tags.length > 0) {
      where.tags = { hasSome: query.tags };
    }

    const sortBy = query.sortBy || 'updatedAt';
    const sortOrder = query.sortOrder || 'desc';

    const [items, total] = await Promise.all([
      this.prisma.workflow.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          _count: { select: { nodes: true } },
          createdBy: { select: { name: true } },
        },
      }),
      this.prisma.workflow.count({ where }),
    ]);

    return {
      items: items.map(w => ({
        id: w.id,
        key: w.key,
        name: w.name,
        description: w.description,
        status: w.status,
        version: w.version,
        tags: w.tags,
        nodeCount: (w as any)._count.nodes,
        createdById: w.createdById,
        createdByName: (w as any).createdBy?.name,
        updatedAt: w.updatedAt,
        createdAt: w.createdAt,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // ── Get One ──

  async findOne(ctx: TenantContext, id: string): Promise<WorkflowDetail> {
    const workflow = await this.prisma.workflow.findFirst({
      where: { id, tenantId: ctx.tenantId, deletedAt: null },
      include: {
        nodes: { orderBy: { executionOrder: 'asc' } },
        edges: true,
      },
    });

    if (!workflow) {
      throw new NotFoundException('워크플로우를 찾을 수 없습니다.');
    }

    return this.toDetail(workflow);
  }

  // ── Update (with OCC) ──

  async update(ctx: TenantContext, id: string, dto: UpdateWorkflowDto): Promise<WorkflowDetail> {
    const existing = await this.prisma.workflow.findFirst({
      where: { id, tenantId: ctx.tenantId, deletedAt: null },
    });

    if (!existing) {
      throw new NotFoundException('워크플로우를 찾을 수 없습니다.');
    }

    // OCC check
    if (existing.version !== dto.expectedVersion) {
      throw new ConflictException(
        `다른 사용자가 이미 수정했습니다. 현재 버전: ${existing.version}, 요청 버전: ${dto.expectedVersion}. 새로고침 후 다시 시도해주세요.`,
      );
    }

    // Build update data
    const updateData: any = {
      version: { increment: 1 },
      updatedById: ctx.userId,
    };

    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.tags !== undefined) updateData.tags = dto.tags;

    // Use a transaction for atomic node/edge replacement
    const result = await this.prisma.$transaction(async (tx) => {
      // Replace nodes if provided
      if (dto.nodes) {
        await tx.workflowNodeDef.deleteMany({ where: { workflowId: id } });
        await tx.workflowNodeDef.createMany({
          data: dto.nodes.map(n => ({
            workflowId: id,
            nodeKey: n.nodeKey,
            uiType: n.uiType,
            name: n.name,
            executionOrder: n.executionOrder,
            configJson: n.config as any,
            inputMappingJson: n.inputMapping ? (n.inputMapping as any) : undefined,
            dependsOn: n.dependsOn || [],
            positionX: n.positionX,
            positionY: n.positionY,
          })),
        });
      }

      // Replace edges if provided
      if (dto.edges) {
        await tx.workflowEdgeDef.deleteMany({ where: { workflowId: id } });
        if (dto.edges.length > 0) {
          await tx.workflowEdgeDef.createMany({
            data: dto.edges.map(e => ({
              workflowId: id,
              fromNodeKey: e.fromNodeKey,
              toNodeKey: e.toNodeKey,
              edgeType: e.edgeType || 'SEQUENCE',
              condition: e.condition,
              label: e.label,
            })),
          });
        }
      }

      // Update workflow metadata
      const updated = await tx.workflow.update({
        where: { id },
        data: updateData,
        include: {
          nodes: { orderBy: { executionOrder: 'asc' } },
          edges: true,
        },
      });

      return updated;
    });

    this.logger.log(
      `[update] tenant=${ctx.tenantId} id=${id} version=${result.version}`,
    );

    return this.toDetail(result);
  }

  // ── Delete (soft) ──

  async remove(ctx: TenantContext, id: string): Promise<void> {
    const existing = await this.prisma.workflow.findFirst({
      where: { id, tenantId: ctx.tenantId, deletedAt: null },
    });

    if (!existing) {
      throw new NotFoundException('워크플로우를 찾을 수 없습니다.');
    }

    await this.prisma.workflow.update({
      where: { id },
      data: {
        status: 'DELETED',
        deletedAt: new Date(),
        updatedById: ctx.userId,
      },
    });

    this.logger.log(`[delete] tenant=${ctx.tenantId} id=${id} key=${existing.key}`);
  }

  // ── Publish (create version snapshot) ──

  async publish(
    ctx: TenantContext,
    id: string,
    label?: string,
  ): Promise<{ workflow: WorkflowDetail; version: WorkflowVersionSummary }> {
    const workflow = await this.prisma.workflow.findFirst({
      where: { id, tenantId: ctx.tenantId, deletedAt: null },
      include: {
        nodes: { orderBy: { executionOrder: 'asc' } },
        edges: true,
        versions: { orderBy: { versionNumber: 'desc' }, take: 1 },
      },
    });

    if (!workflow) {
      throw new NotFoundException('워크플로우를 찾을 수 없습니다.');
    }

    if (workflow.nodes.length === 0) {
      throw new BadRequestException('노드가 없는 워크플로우는 퍼블리시할 수 없습니다.');
    }

    const nextVersionNumber = workflow.versions.length > 0
      ? workflow.versions[0].versionNumber + 1
      : 1;

    // Create snapshot
    const nodesSnapshot = workflow.nodes.map(n => ({
      nodeKey: n.nodeKey,
      uiType: n.uiType,
      name: n.name,
      executionOrder: n.executionOrder,
      config: n.configJson,
      inputMapping: n.inputMappingJson,
      dependsOn: n.dependsOn,
      positionX: n.positionX,
      positionY: n.positionY,
    }));

    const edgesSnapshot = workflow.edges.map(e => ({
      fromNodeKey: e.fromNodeKey,
      toNodeKey: e.toNodeKey,
      edgeType: e.edgeType,
      condition: e.condition,
      label: e.label,
    }));

    const result = await this.prisma.$transaction(async (tx) => {
      const version = await tx.workflowVersion.create({
        data: {
          workflowId: id,
          versionNumber: nextVersionNumber,
          label: label || `v${nextVersionNumber}`,
          nodesSnapshot: nodesSnapshot as any,
          edgesSnapshot: edgesSnapshot as any,
          settingsSnapshot: {
            name: workflow.name,
            description: workflow.description,
            tags: workflow.tags,
          } as any,
          createdById: ctx.userId,
        },
      });

      const updated = await tx.workflow.update({
        where: { id },
        data: {
          status: 'PUBLISHED',
          activeVersionId: version.id,
          version: { increment: 1 },
          updatedById: ctx.userId,
        },
        include: {
          nodes: { orderBy: { executionOrder: 'asc' } },
          edges: true,
        },
      });

      return { updated, version };
    });

    this.logger.log(
      `[publish] tenant=${ctx.tenantId} id=${id} version=${nextVersionNumber}`,
    );

    return {
      workflow: this.toDetail(result.updated),
      version: {
        id: result.version.id,
        versionNumber: result.version.versionNumber,
        label: result.version.label,
        createdById: result.version.createdById,
        createdAt: result.version.createdAt,
        nodeCount: nodesSnapshot.length,
      },
    };
  }

  // ── Version History ──

  async listVersions(
    ctx: TenantContext,
    workflowId: string,
  ): Promise<WorkflowVersionSummary[]> {
    const workflow = await this.prisma.workflow.findFirst({
      where: { id: workflowId, tenantId: ctx.tenantId, deletedAt: null },
    });

    if (!workflow) {
      throw new NotFoundException('워크플로우를 찾을 수 없습니다.');
    }

    const versions = await this.prisma.workflowVersion.findMany({
      where: { workflowId },
      orderBy: { versionNumber: 'desc' },
      include: { createdBy: { select: { name: true } } },
    });

    return versions.map(v => ({
      id: v.id,
      versionNumber: v.versionNumber,
      label: v.label,
      createdById: v.createdById,
      createdByName: (v as any).createdBy?.name,
      createdAt: v.createdAt,
      nodeCount: Array.isArray(v.nodesSnapshot) ? (v.nodesSnapshot as any[]).length : 0,
    }));
  }

  // ── Restore Version ──

  async restoreVersion(
    ctx: TenantContext,
    workflowId: string,
    versionId: string,
  ): Promise<WorkflowDetail> {
    const workflow = await this.prisma.workflow.findFirst({
      where: { id: workflowId, tenantId: ctx.tenantId, deletedAt: null },
    });

    if (!workflow) {
      throw new NotFoundException('워크플로우를 찾을 수 없습니다.');
    }

    const version = await this.prisma.workflowVersion.findFirst({
      where: { id: versionId, workflowId },
    });

    if (!version) {
      throw new NotFoundException('해당 버전을 찾을 수 없습니다.');
    }

    const nodesData = version.nodesSnapshot as any[];
    const edgesData = version.edgesSnapshot as any[];

    const result = await this.prisma.$transaction(async (tx) => {
      // Clear current nodes and edges
      await tx.workflowNodeDef.deleteMany({ where: { workflowId } });
      await tx.workflowEdgeDef.deleteMany({ where: { workflowId } });

      // Restore from snapshot
      if (nodesData.length > 0) {
        await tx.workflowNodeDef.createMany({
          data: nodesData.map((n: any) => ({
            workflowId,
            nodeKey: n.nodeKey,
            uiType: n.uiType,
            name: n.name,
            executionOrder: n.executionOrder,
            configJson: n.config || {},
            inputMappingJson: n.inputMapping,
            dependsOn: n.dependsOn || [],
            positionX: n.positionX,
            positionY: n.positionY,
          })),
        });
      }

      if (edgesData && edgesData.length > 0) {
        await tx.workflowEdgeDef.createMany({
          data: edgesData.map((e: any) => ({
            workflowId,
            fromNodeKey: e.fromNodeKey,
            toNodeKey: e.toNodeKey,
            edgeType: e.edgeType || 'SEQUENCE',
            condition: e.condition,
            label: e.label,
          })),
        });
      }

      // Restore settings if available
      const settings = version.settingsSnapshot as any;
      const updated = await tx.workflow.update({
        where: { id: workflowId },
        data: {
          name: settings?.name || workflow.name,
          description: settings?.description ?? workflow.description,
          tags: settings?.tags || workflow.tags,
          version: { increment: 1 },
          updatedById: ctx.userId,
        },
        include: {
          nodes: { orderBy: { executionOrder: 'asc' } },
          edges: true,
        },
      });

      return updated;
    });

    this.logger.log(
      `[restore] tenant=${ctx.tenantId} workflow=${workflowId} version=${version.versionNumber}`,
    );

    return this.toDetail(result);
  }

  // ── Archive ──

  async archive(ctx: TenantContext, id: string): Promise<void> {
    const existing = await this.prisma.workflow.findFirst({
      where: { id, tenantId: ctx.tenantId, deletedAt: null },
    });

    if (!existing) {
      throw new NotFoundException('워크플로우를 찾을 수 없습니다.');
    }

    await this.prisma.workflow.update({
      where: { id },
      data: {
        status: 'ARCHIVED',
        updatedById: ctx.userId,
        version: { increment: 1 },
      },
    });

    this.logger.log(`[archive] tenant=${ctx.tenantId} id=${id}`);
  }

  // ── Duplicate ──

  async duplicate(
    ctx: TenantContext,
    id: string,
    newKey: string,
    newName: string,
  ): Promise<WorkflowDetail> {
    const original = await this.findOne(ctx, id);

    return this.create(ctx, {
      key: newKey,
      name: newName,
      description: original.description || undefined,
      tags: original.tags,
      nodes: original.nodes,
      edges: original.edges,
    });
  }

  // ── Private helpers ──

  private toDetail(workflow: any): WorkflowDetail {
    return {
      id: workflow.id,
      key: workflow.key,
      name: workflow.name,
      description: workflow.description,
      status: workflow.status,
      version: workflow.version,
      activeVersionId: workflow.activeVersionId,
      tags: workflow.tags,
      createdById: workflow.createdById,
      updatedById: workflow.updatedById,
      createdAt: workflow.createdAt,
      updatedAt: workflow.updatedAt,
      nodes: (workflow.nodes || []).map((n: any) => ({
        nodeKey: n.nodeKey,
        uiType: n.uiType,
        name: n.name,
        executionOrder: n.executionOrder,
        config: n.configJson || {},
        inputMapping: n.inputMappingJson || undefined,
        dependsOn: n.dependsOn || [],
        positionX: n.positionX,
        positionY: n.positionY,
      })),
      edges: (workflow.edges || []).map((e: any) => ({
        fromNodeKey: e.fromNodeKey,
        toNodeKey: e.toNodeKey,
        edgeType: e.edgeType,
        condition: e.condition,
        label: e.label,
      })),
    };
  }
}
