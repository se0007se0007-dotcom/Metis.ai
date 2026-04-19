import { Injectable, Inject } from '@nestjs/common';
import { PrismaClient, withTenantIsolation, TenantContext } from '@metis/database';
import { PRISMA_TOKEN } from '../database.module';

@Injectable()
export class GovernanceService {
  constructor(@Inject(PRISMA_TOKEN) private readonly prisma: PrismaClient) {}

  async getAuditLogs(
    ctx: TenantContext,
    filters: { action?: string; correlationId?: string; page?: number; pageSize?: number },
  ) {
    const db = withTenantIsolation(this.prisma, ctx);
    const pageSize = filters.pageSize ?? 20;
    const page = filters.page ?? 1;

    const where: any = {};
    if (filters.action) where.action = filters.action;
    if (filters.correlationId) where.correlationId = filters.correlationId;

    const [items, total] = await Promise.all([
      db.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { actor: { select: { id: true, name: true, email: true } } },
      }),
      db.auditLog.count({ where }),
    ]);

    return { items, total, page, pageSize, hasMore: page * pageSize < total };
  }

  async getPolicies(ctx: TenantContext) {
    const db = withTenantIsolation(this.prisma, ctx);
    return db.policy.findMany({ orderBy: { createdAt: 'desc' } });
  }
}
