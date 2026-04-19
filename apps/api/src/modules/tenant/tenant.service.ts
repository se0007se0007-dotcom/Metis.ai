import { Injectable, Inject } from '@nestjs/common';
import { PrismaClient } from '@metis/database';
import { PRISMA_TOKEN } from '../database.module';

@Injectable()
export class TenantService {
  constructor(@Inject(PRISMA_TOKEN) private readonly prisma: PrismaClient) {}

  async findById(id: string) {
    return this.prisma.tenant.findUniqueOrThrow({ where: { id } });
  }

  async findBySlug(slug: string) {
    return this.prisma.tenant.findUniqueOrThrow({ where: { slug } });
  }

  async getMemberships(tenantId: string) {
    return this.prisma.membership.findMany({
      where: { tenantId },
      include: { user: true },
    });
  }
}
