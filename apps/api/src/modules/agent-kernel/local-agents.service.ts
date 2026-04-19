/**
 * Local Agents Service — registers in-process agent handlers that the
 * AgentDispatcherService can invoke.
 *
 * These agents are the first-class executable units Builder can arrange into
 * workflows. They wrap existing services (FDS, AP, FinOps, AutoOps) so the
 * workflow executor never needs to know internal module structure.
 *
 * NOTE on circular deps: this service uses forwardRef'd injection for cross-module
 * services to keep NestJS happy. AP/FDS services are lightweight to inject.
 */
import { Injectable, OnModuleInit, Logger, Inject, Optional, forwardRef } from '@nestjs/common';
import { TenantContext, PrismaClient } from '@metis/database';
import { PRISMA_TOKEN } from '../database.module';
import { AgentDispatcherService } from './dispatcher.service';

@Injectable()
export class LocalAgentsService implements OnModuleInit {
  private readonly logger = new Logger(LocalAgentsService.name);

  constructor(
    private readonly dispatcher: AgentDispatcherService,
    @Inject(PRISMA_TOKEN) private readonly prisma: PrismaClient,
  ) {}

  onModuleInit() {
    this.register();
  }

  private register() {
    // ═════════════ QA Agent ═════════════
    this.dispatcher.registerLocalHandler('qa-agent', async (input, ctx) => {
      // Run static validation heuristics: check presence of required fields
      const subject = input.subject || input;
      const checks = [
        { name: 'has-identifier', pass: !!subject.id || !!subject.key },
        { name: 'has-type', pass: !!subject.type || !!subject.kind },
        { name: 'has-payload', pass: Object.keys(subject).length > 2 },
      ];
      const passed = checks.filter((c) => c.pass).length;
      const verdict = passed === checks.length ? 'PASS' : passed >= 2 ? 'WARN' : 'FAIL';
      return {
        verdict,
        passed,
        total: checks.length,
        checks,
        recommendation: verdict === 'PASS' ? 'continue' : 'review',
      };
    });

    // ═════════════ Canary Agent ═════════════
    this.dispatcher.registerLocalHandler('canary-agent', async (input, ctx) => {
      // Advance a canary rollout in steps — here we simulate with input percentage
      const currentPct = Number(input.currentPct ?? 0);
      const targetPct = Number(input.targetPct ?? 100);
      const stepPct = Math.min(targetPct, currentPct === 0 ? 5 : Math.min(100, currentPct * 2));
      return {
        previousPct: currentPct,
        newPct: stepPct,
        reachedTarget: stepPct >= targetPct,
        nextCheckInSec: 300,
      };
    });

    // ═════════════ FinOps Agent ═════════════
    this.dispatcher.registerLocalHandler('finops-agent', async (input, ctx) => {
      const db = this.prisma;
      const since = new Date(Date.now() - 24 * 3600 * 1000);
      const logs: any[] = await db.finOpsTokenLog.findMany({
        where: { tenantId: ctx.tenantId, createdAt: { gte: since } },
        take: 1000,
      }).catch(() => [] as any[]);
      const totalCost = logs.reduce((s: number, l: any) => s + Number(l.optimizedCostUsd ?? 0), 0);
      const savings = logs.reduce((s: number, l: any) => s + Number(l.savedUsd ?? 0), 0);
      const alert = totalCost > (Number(input.dailyBudgetUsd) || 500);
      return {
        periodHours: 24,
        totalCostUsd: Math.round(totalCost * 100) / 100,
        savingsUsd: Math.round(savings * 100) / 100,
        alertTriggered: alert,
        recommendation: alert ? 'scale-down-tier' : 'normal',
      };
    });

    // ═════════════ Ops Agent ═════════════
    this.dispatcher.registerLocalHandler('ops-agent', async (input, ctx) => {
      // Summarize current connector health
      const connectors: any[] = await this.prisma.connector.findMany({
        where: { tenantId: ctx.tenantId },
        take: 500,
      }).catch(() => [] as any[]);
      const active = connectors.filter((c: any) => c.status === 'ACTIVE').length;
      const error = connectors.filter((c: any) => c.status === 'ERROR').length;
      return {
        totalConnectors: connectors.length,
        active,
        error,
        healthPct: connectors.length > 0 ? Math.round((active / connectors.length) * 100) : 100,
        actionRequired: error > 0,
      };
    });

    // ═════════════ AP Agent (wrapper) ═════════════
    this.dispatcher.registerLocalHandler('ap-agent', async (input, ctx) => {
      // Acts as a thin router over AP flows by inspecting input.action
      const action = input.action || 'validate';
      if (action === 'validate') {
        const req = ['invoiceNumber', 'vendorName', 'amount'];
        const missing = req.filter((f) => !input[f]);
        return {
          action: 'validate',
          valid: missing.length === 0,
          missing,
        };
      }
      return { action, note: 'Acknowledged by ap-agent (full AP ops via HTTP endpoints)' };
    });

    // ═════════════ Risk Agent (wrapper over FDS) ═════════════
    this.dispatcher.registerLocalHandler('risk-agent', async (input, ctx) => {
      // Mock score calculation; production would call FDS rule engine + ML
      const amount = Number(input.amount ?? 0);
      const velocity = Number(input.transactionCountPerHour ?? 0);
      const score = Math.min(1, (amount > 10_000_000 ? 0.5 : 0.1) + (velocity > 10 ? 0.4 : 0));
      return {
        subject: input.subjectId || 'unknown',
        score,
        severity: score > 0.7 ? 'HIGH' : score > 0.4 ? 'MEDIUM' : 'LOW',
        shouldBlock: score > 0.8,
      };
    });

    this.logger.log('[local-agents] Registered 6 built-in agents: qa, canary, finops, ops, ap, risk');
  }
}
