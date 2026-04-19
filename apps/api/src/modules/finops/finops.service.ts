/**
 * FinOps Service — Phase 4: Token Optimization
 *
 * Responsibilities:
 *   - CRUD operations for FinOps configurations
 *   - Agent config management
 *   - Skill registration and tracking
 *   - Namespace management for cache organization
 *   - Token usage logging and statistics
 *   - Tenant isolation enforcement
 */
import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaClient } from '@metis/database';
import { PRISMA_TOKEN } from '../database.module';
import {
  UpdateFinOpsConfigDto,
  CreateAgentConfigDto,
  UpdateAgentConfigDto,
  RegisterSkillDto,
  CreateNamespaceDto,
  FinOpsStatsDto,
  FinOpsDistributionDto,
  TokenLogDto,
} from './finops.dto';

@Injectable()
export class FinOpsService {
  private readonly logger = new Logger(FinOpsService.name);

  constructor(
    @Inject(PRISMA_TOKEN) private readonly prisma: PrismaClient,
  ) {}

  // ════════════════════════════════════════════════════════════
  // FinOps Config — Get/Upsert/Update
  // ════════════════════════════════════════════════════════════

  async getOrCreateConfig(tenantId: string) {
    let config = await (this.prisma as any).finOpsConfig.findUnique({
      where: { tenantId },
    });

    if (!config) {
      config = await (this.prisma as any).finOpsConfig.create({
        data: {
          tenantId,
          cacheEnabled: true,
          routerEnabled: true,
          packerEnabled: true,
        },
      });
      this.logger.log(`Created default FinOpsConfig for tenant ${tenantId}`);
    }

    return config;
  }

  async getConfig(tenantId: string) {
    return this.getOrCreateConfig(tenantId);
  }

  async updateConfig(tenantId: string, data: UpdateFinOpsConfigDto) {
    const config = await (this.prisma as any).finOpsConfig.findUnique({
      where: { tenantId },
    });

    if (!config) {
      throw new NotFoundException('FinOps config not found');
    }

    return (this.prisma as any).finOpsConfig.update({
      where: { tenantId },
      data,
    });
  }

  // ════════════════════════════════════════════════════════════
  // Agent Configs
  // ════════════════════════════════════════════════════════════

  async listAgentConfigs(tenantId: string) {
    return (this.prisma as any).finOpsAgentConfig.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getAgentConfig(tenantId: string, agentName: string) {
    const config = await (this.prisma as any).finOpsAgentConfig.findUnique({
      where: { tenantId_agentName: { tenantId, agentName } },
    });

    if (!config) {
      throw new NotFoundException(
        `Agent config not found for agent "${agentName}"`,
      );
    }

    return config;
  }

  async upsertAgentConfig(
    tenantId: string,
    agentName: string,
    data: CreateAgentConfigDto | UpdateAgentConfigDto,
  ) {
    return (this.prisma as any).finOpsAgentConfig.upsert({
      where: { tenantId_agentName: { tenantId, agentName } },
      create: {
        tenantId,
        agentName,
        ...data,
      },
      update: data,
    });
  }

  // ════════════════════════════════════════════════════════════
  // Skills
  // ════════════════════════════════════════════════════════════

  async listSkills(tenantId: string) {
    return (this.prisma as any).finOpsSkill.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async registerSkill(tenantId: string, data: RegisterSkillDto) {
    return (this.prisma as any).finOpsSkill.upsert({
      where: { tenantId_skillId: { tenantId, skillId: data.skillId } },
      create: {
        tenantId,
        ...data,
      },
      update: {
        name: data.name,
        defaultTier: data.defaultTier ?? undefined,
        status: data.status ?? undefined,
      },
    });
  }

  async updateSkillInvocationCount(
    tenantId: string,
    skillId: string,
    increment = 1,
  ) {
    return (this.prisma as any).finOpsSkill.update({
      where: { tenantId_skillId: { tenantId, skillId } },
      data: {
        invocationCount: {
          increment,
        },
      },
    }).catch(() => {
      // Skill not found, skip update
      return null;
    });
  }

  // ════════════════════════════════════════════════════════════
  // Namespaces
  // ════════════════════════════════════════════════════════════

  async listNamespaces(tenantId: string) {
    return (this.prisma as any).finOpsNamespace.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async addNamespace(tenantId: string, data: CreateNamespaceDto) {
    return (this.prisma as any).finOpsNamespace.create({
      data: {
        tenantId,
        ...data,
      },
    });
  }

  async getNamespace(tenantId: string, namespace: string) {
    const ns = await (this.prisma as any).finOpsNamespace.findUnique({
      where: { tenantId_namespace: { tenantId, namespace } },
    });

    if (!ns) {
      throw new NotFoundException(`Namespace "${namespace}" not found`);
    }

    return ns;
  }

  async updateNamespaceMetrics(
    tenantId: string,
    namespace: string,
    cacheEntries: number,
    hitRate: number,
  ) {
    return (this.prisma as any).finOpsNamespace.update({
      where: { tenantId_namespace: { tenantId, namespace } },
      data: {
        cacheEntries,
        hitRate,
      },
    }).catch(() => {
      // Namespace not found, skip update
      return null;
    });
  }

  // ════════════════════════════════════════════════════════════
  // Token Logging
  // ════════════════════════════════════════════════════════════

  async logTokenUsage(tenantId: string, logData: {
    agentName: string;
    executionSessionId?: string;
    nodeId?: string;
    promptText?: string;
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
    cacheHit?: boolean;
    cachedResponseUsed?: boolean;
    routedTier?: number;
    routedModel?: string;
    originalCostUsd?: number;
    optimizedCostUsd?: number;
    savedUsd?: number;
    responseTimeMs?: number;
  }) {
    return (this.prisma as any).finOpsTokenLog.create({
      data: {
        tenantId,
        ...logData,
      },
    });
  }

  async getTokenLogs(tenantId: string, options: {
    agentName?: string;
    limit?: number;
    offset?: number;
  } = {}) {
    const { agentName, limit = 50, offset = 0 } = options;

    const where: any = { tenantId };
    if (agentName) {
      where.agentName = agentName;
    }

    const logs = await (this.prisma as any).finOpsTokenLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: limit,
    });

    const total = await (this.prisma as any).finOpsTokenLog.count({ where });

    return {
      logs: logs as TokenLogDto[],
      total,
      limit,
      offset,
    };
  }

  // ════════════════════════════════════════════════════════════
  // Statistics
  // ════════════════════════════════════════════════════════════

  async getStats(tenantId: string): Promise<FinOpsStatsDto> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get all logs for today
    const logs = await (this.prisma as any).finOpsTokenLog.findMany({
      where: {
        tenantId,
        createdAt: { gte: today },
      },
    });

    const totalRequests = logs.length;
    const cacheHits = logs.filter((l: any) => l.cacheHit).length;
    const cacheHitRate = totalRequests > 0 ? (cacheHits / totalRequests) * 100 : 0;

    const estimatedDailyCostUsd = logs.reduce(
      (sum: number, l: any) => sum + (l.optimizedCostUsd || 0),
      0,
    );
    const estimatedSavingsUsd = logs.reduce(
      (sum: number, l: any) => sum + (l.savedUsd || 0),
      0,
    );

    const avgResponseTimeMs =
      totalRequests > 0
        ? logs.reduce((sum: number, l: any) => sum + (l.responseTimeMs || 0), 0) / totalRequests
        : 0;

    // Get requests by tier
    const requestsByTier = {
      tier1: logs.filter((l: any) => l.routedTier === 1).length,
      tier2: logs.filter((l: any) => l.routedTier === 2).length,
      tier3: logs.filter((l: any) => l.routedTier === 3).length,
    };

    // Get top agents
    const agentStats = new Map<string, any>();
    for (const log of logs) {
      if (!agentStats.has(log.agentName)) {
        agentStats.set(log.agentName, {
          agentName: log.agentName,
          requestCount: 0,
          cacheHits: 0,
          savedUsd: 0,
        });
      }
      const stats = agentStats.get(log.agentName);
      stats.requestCount += 1;
      if (log.cacheHit) stats.cacheHits += 1;
      stats.savedUsd += log.savedUsd || 0;
    }

    const topAgents = Array.from(agentStats.values())
      .map((stats) => ({
        ...stats,
        cacheHitRate: stats.requestCount > 0
          ? (stats.cacheHits / stats.requestCount) * 100
          : 0,
      }))
      .sort((a, b) => b.requestCount - a.requestCount)
      .slice(0, 10);

    // Hourly trend (last 6 hours)
    const hourlyTrend: any[] = [];
    for (let i = 5; i >= 0; i--) {
      const hour = new Date(today);
      hour.setHours(today.getHours() - i);
      const nextHour = new Date(hour);
      nextHour.setHours(hour.getHours() + 1);

      const hourLogs = logs.filter(
        (l: any) => l.createdAt >= hour && l.createdAt < nextHour,
      );

      hourlyTrend.push({
        hour: hour.toISOString().substring(0, 13),
        requests: hourLogs.length,
        cacheHits: hourLogs.filter((l: any) => l.cacheHit).length,
        avgCostUsd:
          hourLogs.length > 0
            ? hourLogs.reduce((sum: number, l: any) => sum + (l.optimizedCostUsd || 0), 0) /
              hourLogs.length
            : 0,
      });
    }

    return {
      totalRequests,
      cacheHitRate: Math.round(cacheHitRate * 100) / 100,
      estimatedDailyCostUsd: Math.round(estimatedDailyCostUsd * 100) / 100,
      estimatedSavingsUsd: Math.round(estimatedSavingsUsd * 100) / 100,
      avgResponseTimeMs: Math.round(avgResponseTimeMs),
      requestsByTier,
      topAgents,
      hourlyTrend,
    };
  }

  async getDistribution(tenantId: string): Promise<FinOpsDistributionDto> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const logs = await (this.prisma as any).finOpsTokenLog.findMany({
      where: {
        tenantId,
        createdAt: { gte: today },
      },
    });

    const tier1Count = logs.filter((l: any) => l.routedTier === 1).length;
    const tier2Count = logs.filter((l: any) => l.routedTier === 2).length;
    const tier3Count = logs.filter((l: any) => l.routedTier === 3).length;
    const cacheHitCount = logs.filter((l: any) => l.cacheHit).length;
    const cacheMissCount = logs.length - cacheHitCount;
    const totalRequests = logs.length;

    return {
      tier1Count,
      tier2Count,
      tier3Count,
      cacheHitCount,
      cacheMissCount,
      totalRequests,
      cacheHitPercentage:
        totalRequests > 0
          ? Math.round((cacheHitCount / totalRequests) * 100 * 100) / 100
          : 0,
    };
  }
}
