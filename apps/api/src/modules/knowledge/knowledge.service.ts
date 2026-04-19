import { Injectable, Inject } from '@nestjs/common';
import { PrismaClient, withTenantIsolation, TenantContext } from '@metis/database';
import { PRISMA_TOKEN } from '../database.module';

@Injectable()
export class KnowledgeService {
  constructor(@Inject(PRISMA_TOKEN) private readonly prisma: PrismaClient) {}

  async list(ctx: TenantContext, filters?: { category?: string; status?: string }) {
    const db = withTenantIsolation(this.prisma, ctx);
    const where: any = {};
    if (filters?.category) where.category = filters.category;
    if (filters?.status) where.status = filters.status;
    return db.knowledgeArtifact.findMany({ where, orderBy: { updatedAt: 'desc' } });
  }
}
