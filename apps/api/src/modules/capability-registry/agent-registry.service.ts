/**
 * Agent Registry Service — first-class agent entity management.
 */
import { Injectable, Inject, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaClient, withTenantIsolation, TenantContext } from '@metis/database';
import { PRISMA_TOKEN } from '../database.module';

export interface RegisterAgentDto {
  key: string;
  name: string;
  description?: string;
  category: string;
  version?: string;
  kernelType?: 'MCP' | 'REST' | 'LOCAL' | 'EXTERNAL';
  inputSchema: any;
  outputSchema: any;
  capabilities: string[];
  kernelConfig?: any;
  defaultTimeoutSec?: number;
  costPerInvocationUsd?: number;
}

@Injectable()
export class AgentRegistryService {
  constructor(@Inject(PRISMA_TOKEN) private readonly prisma: PrismaClient) {}

  async list(ctx: TenantContext, opts: { category?: string; status?: string } = {}) {
    const db = withTenantIsolation(this.prisma, ctx);
    return db.agentDefinition.findMany({
      where: {
        ...(opts.category ? { category: opts.category } : {}),
        ...(opts.status ? { status: opts.status as any } : {}),
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async getByKey(ctx: TenantContext, key: string) {
    const db = withTenantIsolation(this.prisma, ctx);
    const agent = await db.agentDefinition.findFirst({ where: { key } });
    if (!agent) throw new NotFoundException(`Agent "${key}" not found`);
    return agent;
  }

  async register(ctx: TenantContext, dto: RegisterAgentDto) {
    const db = withTenantIsolation(this.prisma, ctx);
    const existing = await db.agentDefinition.findFirst({ where: { key: dto.key } });
    if (existing) {
      return this.prisma.agentDefinition.update({
        where: { id: existing.id },
        data: {
          name: dto.name,
          description: dto.description,
          category: dto.category,
          version: dto.version ?? existing.version,
          kernelType: (dto.kernelType ?? existing.kernelType) as any,
          inputSchemaJson: dto.inputSchema,
          outputSchemaJson: dto.outputSchema,
          capabilitiesJson: dto.capabilities as any,
          kernelConfigJson: dto.kernelConfig ?? existing.kernelConfigJson,
          defaultTimeoutSec: dto.defaultTimeoutSec ?? existing.defaultTimeoutSec,
          costPerInvocationUsd: dto.costPerInvocationUsd ?? existing.costPerInvocationUsd,
          status: 'AVAILABLE',
        },
      });
    }
    return this.prisma.agentDefinition.create({
      data: {
        tenantId: ctx.tenantId,
        key: dto.key,
        name: dto.name,
        description: dto.description,
        category: dto.category,
        version: dto.version ?? '1.0.0',
        kernelType: (dto.kernelType ?? 'LOCAL') as any,
        inputSchemaJson: dto.inputSchema,
        outputSchemaJson: dto.outputSchema,
        capabilitiesJson: dto.capabilities as any,
        kernelConfigJson: dto.kernelConfig,
        defaultTimeoutSec: dto.defaultTimeoutSec ?? 60,
        costPerInvocationUsd: dto.costPerInvocationUsd,
      },
    });
  }

  async recordInvocation(ctx: TenantContext, agentKey: string, success: boolean) {
    const db = withTenantIsolation(this.prisma, ctx);
    const agent = await db.agentDefinition.findFirst({ where: { key: agentKey } });
    if (!agent) return;
    const total = agent.totalInvocations + 1;
    const currentRate = agent.lastSuccessRate ?? 1.0;
    // Exponential moving average with alpha=0.1
    const newRate = currentRate * 0.9 + (success ? 1.0 : 0.0) * 0.1;
    await this.prisma.agentDefinition.update({
      where: { id: agent.id },
      data: {
        totalInvocations: total,
        lastInvokedAt: new Date(),
        lastSuccessRate: newRate,
        status: newRate < 0.5 ? ('DEGRADED' as any) : ('AVAILABLE' as any),
      },
    });
  }

  async setStatus(ctx: TenantContext, key: string, status: 'AVAILABLE' | 'DEGRADED' | 'UNAVAILABLE' | 'DRAINING') {
    const agent = await this.getByKey(ctx, key);
    return this.prisma.agentDefinition.update({
      where: { id: agent.id },
      data: { status: status as any },
    });
  }
}
