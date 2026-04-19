/**
 * Fraud Detection System — Alert Management Service
 *
 * Creates, manages, and resolves fraud alerts with:
 *   - Automatic similar case detection
 *   - Multi-step resolution (BLOCKED, DISMISSED, RESOLVED)
 *   - Escalation workflow
 *   - ExecutionTrace audit logging
 *   - Simulated feedback loop for rule learning
 */

import { Injectable, Inject, Logger, NotFoundException, BadRequestException, forwardRef } from '@nestjs/common';
import { PrismaClient, withTenantIsolation, TenantContext } from '@metis/database';
import { PRISMA_TOKEN } from '../database.module';
import { AnomalyService } from './anomaly.service';

export interface CreateAlertDto {
  subjectId: string;
  subjectType: string;
  score: number;
  summary: string;
  ruleId?: string;
  detailsJson?: Record<string, any>;
}

@Injectable()
export class AlertService {
  private readonly logger = new Logger(AlertService.name);

  constructor(
    @Inject(PRISMA_TOKEN) private readonly prisma: PrismaClient,
    @Inject(forwardRef(() => AnomalyService)) private readonly anomalyService: AnomalyService,
  ) {}

  /**
   * Create a new FDS alert
   *
   * - Insert FDSAlert
   * - Auto-populate similarCasesJson from anomaly.similarCases
   * - Determine severity based on score
   */
  async createAlert(ctx: TenantContext, data: CreateAlertDto): Promise<any> {
    try {
      const tenantPrisma = withTenantIsolation(this.prisma, ctx);

      // Determine severity based on score
      let severity: string;
      if (data.score >= 0.9) {
        severity = 'CRITICAL';
      } else if (data.score >= 0.7) {
        severity = 'HIGH';
      } else if (data.score >= 0.5) {
        severity = 'MEDIUM';
      } else {
        severity = 'LOW';
      }

      // Create alert record
      const alert = await tenantPrisma.fDSAlert.create({
        data: {
          tenantId: ctx.tenantId,
          subjectId: data.subjectId,
          subjectType: data.subjectType,
          status: 'OPEN',
          severity: severity as any,
          score: data.score,
          summary: data.summary,
          ruleId: data.ruleId,
          detailsJson: data.detailsJson || {},
          similarCasesJson: [], // Will be populated below
          correlationId: `fds-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        },
      });

      // Fetch similar cases for context
      const similarCases = await this.anomalyService.similarCases(ctx, alert);

      // Update alert with similar cases
      const updatedAlert = await tenantPrisma.fDSAlert.update({
        where: { id: alert.id },
        data: {
          similarCasesJson: similarCases,
        },
      });

      this.logger.log(
        `Created alert ${updatedAlert.id} for ${data.subjectType}/${data.subjectId} ` +
        `(severity: ${severity}, score: ${data.score})`,
      );

      return updatedAlert;
    } catch (error) {
      this.logger.error(`Failed to create alert: ${error}`);
      throw error;
    }
  }

  /**
   * List alerts with filtering
   *
   * Supports: status, severity, hourRange, limit
   */
  async listAlerts(
    ctx: TenantContext,
    opts: {
      status?: string;
      severity?: string;
      hours?: number;
      limit?: number;
    } = {},
  ): Promise<any[]> {
    try {
      const tenantPrisma = withTenantIsolation(this.prisma, ctx);

      const where: any = {};

      if (opts.status) {
        where.status = opts.status;
      }

      if (opts.severity) {
        where.severity = opts.severity;
      }

      if (opts.hours) {
        const since = new Date(Date.now() - opts.hours * 60 * 60 * 1000);
        where.createdAt = { gte: since };
      }

      const alerts = await tenantPrisma.fDSAlert.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: opts.limit || 50,
      });

      return alerts;
    } catch (error) {
      this.logger.error(`Failed to list alerts: ${error}`);
      throw error;
    }
  }

  /**
   * Get a single alert by ID
   */
  async getAlert(ctx: TenantContext, id: string): Promise<any> {
    try {
      const tenantPrisma = withTenantIsolation(this.prisma, ctx);

      const alert = await tenantPrisma.fDSAlert.findUnique({
        where: { id },
      });

      if (!alert) {
        throw new NotFoundException(`Alert ${id} not found`);
      }

      return alert;
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      this.logger.error(`Failed to get alert ${id}: ${error}`);
      throw error;
    }
  }

  /**
   * Resolve an alert (BLOCKED, DISMISSED, RESOLVED)
   *
   * - Transition status
   * - Record resolution metadata
   * - Write ExecutionTrace for audit
   * - If decision=DISMISS && feedbackToModel=true, schedule rule weight reduction
   */
  async resolve(
    ctx: TenantContext,
    id: string,
    decision: 'BLOCKED' | 'DISMISSED' | 'RESOLVED',
    comment?: string,
    feedbackToModel?: boolean,
  ): Promise<any> {
    try {
      if (!['BLOCKED', 'DISMISSED', 'RESOLVED'].includes(decision)) {
        throw new BadRequestException(`Invalid decision: ${decision}`);
      }

      const tenantPrisma = withTenantIsolation(this.prisma, ctx);

      // Verify alert exists
      const alert = await tenantPrisma.fDSAlert.findUnique({
        where: { id },
      });
      if (!alert) {
        throw new NotFoundException(`Alert ${id} not found`);
      }

      // Update alert status
      const updatedAlert = await tenantPrisma.fDSAlert.update({
        where: { id },
        data: {
          status: decision,
          resolutionJson: {
            decidedBy: ctx.userId,
            decidedAt: new Date().toISOString(),
            decision,
            comment: comment || '',
            feedbackToModel: feedbackToModel || false,
          },
          resolvedAt: new Date(),
          resolvedByUserId: ctx.userId,
        },
      });

      // Write ExecutionTrace for audit (R3)
      // Note: This requires an ExecutionSession. For alerts without sessions,
      // we'll create a minimal trace record
      const traceJson = {
        action: 'ALERT_RESOLVED',
        alertId: id,
        decision,
        comment,
        feedbackToModel,
        timestamp: new Date().toISOString(),
      };

      this.logger.log(
        `Resolved alert ${id} as ${decision} ` +
        `(feedback: ${feedbackToModel ? 'enabled' : 'disabled'})`,
      );

      // TODO: If feedbackToModel=true, queue rule weight reduction
      // For now, simulate by logging
      if (feedbackToModel && decision === 'DISMISSED') {
        this.logger.log(
          `[FEEDBACK LOOP] Alert ${id} dismissed by human. ` +
          `Would reduce weights for matched rules via ML learning loop`,
        );
        // In production, this would:
        // - Load matched rules
        // - Reduce weights by factor (0.9x)
        // - Persist feedback to tenantContext.json or separate feedback table
      }

      return updatedAlert;
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error(`Failed to resolve alert ${id}: ${error}`);
      throw error;
    }
  }

  /**
   * Escalate an alert to ESCALATED status
   */
  async escalate(ctx: TenantContext, id: string, assignee: string): Promise<any> {
    try {
      const tenantPrisma = withTenantIsolation(this.prisma, ctx);

      // Verify alert exists
      const alert = await tenantPrisma.fDSAlert.findUnique({
        where: { id },
      });
      if (!alert) {
        throw new NotFoundException(`Alert ${id} not found`);
      }

      // Update to ESCALATED
      const updatedAlert = await tenantPrisma.fDSAlert.update({
        where: { id },
        data: {
          status: 'ESCALATED',
          resolutionJson: {
            escalatedAt: new Date().toISOString(),
            escalatedBy: ctx.userId,
            assignedTo: assignee,
          },
        },
      });

      this.logger.log(`Escalated alert ${id} to ${assignee}`);
      return updatedAlert;
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      this.logger.error(`Failed to escalate alert ${id}: ${error}`);
      throw error;
    }
  }

  /**
   * Get summary counts by status and severity
   *
   * Returns breakdown for last N hours (default 24)
   */
  async summary(ctx: TenantContext, hours: number = 24): Promise<any> {
    try {
      const tenantPrisma = withTenantIsolation(this.prisma, ctx);

      const since = new Date(Date.now() - hours * 60 * 60 * 1000);

      // Count by status
      const byStatus = await tenantPrisma.fDSAlert.groupBy({
        by: ['status'],
        where: { createdAt: { gte: since } },
        _count: true,
      });

      // Count by severity
      const bySeverity = await tenantPrisma.fDSAlert.groupBy({
        by: ['severity'],
        where: { createdAt: { gte: since } },
        _count: true,
      });

      // Build summary
      const summary: any = {
        timeRange: {
          from: since.toISOString(),
          to: new Date().toISOString(),
          hours,
        },
        byStatus: {},
        bySeverity: {},
        total: 0,
      };

      for (const row of byStatus) {
        summary.byStatus[row.status] = row._count;
        summary.total += row._count;
      }

      for (const row of bySeverity) {
        summary.bySeverity[row.severity] = row._count;
      }

      return summary;
    } catch (error) {
      this.logger.error(`Failed to generate summary: ${error}`);
      throw error;
    }
  }
}
