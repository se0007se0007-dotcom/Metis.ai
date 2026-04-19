/**
 * Mission Service — orchestrates multi-agent collaboration missions.
 *
 * Resolves R2 (tenant isolation via withTenantIsolation) and
 *          R3 (correlationId propagated to every bus publish + ExecutionTrace).
 */
import {
  Injectable, Inject, Logger, NotFoundException, BadRequestException,
} from '@nestjs/common';
import { PrismaClient, withTenantIsolation, TenantContext } from '@metis/database';
import { PRISMA_TOKEN } from '../database.module';
import { A2ABusService } from './bus.service';

export interface MissionParticipant {
  agent: string;                 // agent identifier (e.g. 'qa-agent', 'canary-agent')
  role: string;                  // 'planner' | 'executor' | 'verifier' | ...
  optional?: boolean;
}

export interface CreateMissionDto {
  key: string;
  title: string;
  description?: string;
  kind: string;
  participants: MissionParticipant[];
  plannedSteps?: Record<string, any>;
  context?: Record<string, any>;
}

@Injectable()
export class MissionService {
  private readonly logger = new Logger(MissionService.name);

  constructor(
    @Inject(PRISMA_TOKEN) private readonly prisma: PrismaClient,
    private readonly bus: A2ABusService,
  ) {}

  async list(ctx: TenantContext, status?: string) {
    const db = withTenantIsolation(this.prisma, ctx);
    return db.mission.findMany({
      where: status ? { status: status as any } : undefined,
      orderBy: { updatedAt: 'desc' },
      take: 100,
    });
  }

  async getById(ctx: TenantContext, id: string) {
    const db = withTenantIsolation(this.prisma, ctx);
    const mission = await db.mission.findFirst({ where: { id } });
    if (!mission) throw new NotFoundException(`Mission ${id} not found`);
    return mission;
  }

  async create(ctx: TenantContext, dto: CreateMissionDto) {
    const db = withTenantIsolation(this.prisma, ctx);
    const existing = await db.mission.findFirst({ where: { key: dto.key } });
    if (existing) throw new BadRequestException(`Mission key "${dto.key}" already exists`);

    const correlationId = `mission-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const mission = await db.mission.create({
      data: {
        tenantId: ctx.tenantId,
        key: dto.key,
        title: dto.title,
        description: dto.description,
        kind: dto.kind,
        participants: dto.participants as any,
        plannedStepsJson: (dto.plannedSteps ?? {}) as any,
        contextJson: (dto.context ?? {}) as any,
        correlationId,
        createdByUserId: ctx.userId,
      },
    });

    // R3: initial audit trace
    await this.prisma.executionTrace.create({
      data: {
        executionSessionId: 'system-mission',
        correlationId,
        traceJson: {
          event: 'MISSION_CREATED',
          missionId: mission.id,
          key: dto.key,
          kind: dto.kind,
          participants: dto.participants,
          createdBy: ctx.userId,
          timestamp: new Date().toISOString(),
        } as any,
      },
    }).catch(() => {});

    // System message into the mission
    await this.bus.publish(ctx.tenantId, mission.id, {
      kind: 'SYSTEM',
      fromAgent: 'system',
      subject: 'Mission created',
      payload: { participants: dto.participants, kind: dto.kind },
      naturalSummary: `미션 "${dto.title}"이 생성되었습니다. 참여 에이전트: ${dto.participants.map(p => p.agent).join(', ')}`,
      correlationId,
    });

    return mission;
  }

  async start(ctx: TenantContext, id: string) {
    const mission = await this.getById(ctx, id);
    if (mission.status !== 'PLANNING') {
      throw new BadRequestException(`Cannot start mission in state ${mission.status}`);
    }
    const updated = await this.prisma.mission.update({
      where: { id },
      data: { status: 'RUNNING', startedAt: new Date() },
    });
    await this.bus.publish(ctx.tenantId, id, {
      kind: 'SYSTEM',
      fromAgent: 'system',
      subject: 'Mission started',
      payload: { startedAt: updated.startedAt },
      naturalSummary: '미션이 실행 상태로 전환되었습니다.',
      correlationId: mission.correlationId,
    });
    return updated;
  }

  async pauseForHuman(ctx: TenantContext, id: string, reason: string) {
    const mission = await this.getById(ctx, id);
    const updated = await this.prisma.mission.update({
      where: { id },
      data: { status: 'WAITING_HUMAN', humanInterventionsCount: { increment: 1 } },
    });
    await this.bus.publish(ctx.tenantId, id, {
      kind: 'HUMAN_INTERVENTION',
      fromAgent: 'system',
      subject: 'Waiting human decision',
      payload: { reason },
      naturalSummary: `사용자 판단 필요: ${reason}`,
      correlationId: mission.correlationId,
    });
    return updated;
  }

  async resume(ctx: TenantContext, id: string, decision: string) {
    const mission = await this.getById(ctx, id);
    if (mission.status !== 'WAITING_HUMAN') {
      throw new BadRequestException(`Mission is not waiting (status: ${mission.status})`);
    }
    const updated = await this.prisma.mission.update({
      where: { id },
      data: { status: 'RUNNING' },
    });
    await this.bus.publish(ctx.tenantId, id, {
      kind: 'HUMAN_INTERVENTION',
      fromAgent: ctx.userId || 'human',
      subject: 'Decision received',
      payload: { decision },
      naturalSummary: `사용자 결정: ${decision}`,
      correlationId: mission.correlationId,
    });
    return updated;
  }

  async complete(ctx: TenantContext, id: string, status: 'SUCCEEDED' | 'FAILED' | 'CANCELLED' | 'ROLLED_BACK', summary?: string) {
    const mission = await this.getById(ctx, id);
    const updated = await this.prisma.mission.update({
      where: { id },
      data: { status, endedAt: new Date() },
    });
    await this.bus.publish(ctx.tenantId, id, {
      kind: 'SYSTEM',
      fromAgent: 'system',
      subject: `Mission ${status}`,
      payload: { summary },
      naturalSummary: summary || `미션이 ${status} 상태로 종료되었습니다.`,
      correlationId: mission.correlationId,
    });
    return updated;
  }

  async getMessages(ctx: TenantContext, id: string, limit = 200) {
    await this.getById(ctx, id); // Tenant check
    return this.bus.replay(ctx, id, limit);
  }
}
