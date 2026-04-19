/**
 * AP Agent Service — Orchestrates Accounts Payable invoice processing.
 *
 * Resolves R2 (tenant isolation via withTenantIsolation) and
 *          R3 (correlationId propagated to every state transition + ExecutionTrace).
 */
import {
  Injectable, Inject, Logger, NotFoundException, BadRequestException, ConflictException,
} from '@nestjs/common';
import { PrismaClient, withTenantIsolation, TenantContext } from '@metis/database';
import { PRISMA_TOKEN } from '../database.module';
import { match3way, InvoiceData, POData, GRData } from './ap-matching';
import { OCRAdapter, OCRInput } from './adapters/ocr-adapter.interface';

export interface CreateInvoiceDto {
  invoiceNumber: string;
  vendorName: string;
  vendorId?: string;
  amount: number;
  currency?: string;
  invoiceDate: string;
  dueDate?: string;
  sourceUri?: string;
  poReference?: string;
  grReference?: string;
}

export interface ParseInvoiceOptions {
  sourceUri?: string;
}

export interface ApprovalRequest {
  reason?: string;
}

export interface ListInvoicesOptions {
  status?: string;
  vendorId?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  offset?: number;
}

@Injectable()
export class APAgentService {
  private readonly logger = new Logger(APAgentService.name);

  constructor(
    @Inject(PRISMA_TOKEN) private readonly prisma: PrismaClient,
    @Inject('OCR_ADAPTER') private readonly ocrAdapter: OCRAdapter,
  ) {}

  /**
   * List invoices with filtering and tenant isolation.
   */
  async listInvoices(ctx: TenantContext, opts: ListInvoicesOptions = {}) {
    const db = withTenantIsolation(this.prisma, ctx);

    const where: any = {};
    if (opts.status) {
      where.status = opts.status;
    }
    if (opts.vendorId) {
      where.vendorId = opts.vendorId;
    }
    if (opts.dateFrom || opts.dateTo) {
      where.invoiceDate = {};
      if (opts.dateFrom) {
        where.invoiceDate.gte = new Date(opts.dateFrom);
      }
      if (opts.dateTo) {
        where.invoiceDate.lte = new Date(opts.dateTo);
      }
    }

    const [items, total] = await Promise.all([
      db.aPInvoice.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: opts.limit ?? 50,
        skip: opts.offset ?? 0,
      }),
      db.aPInvoice.count({ where }),
    ]);

    return {
      items,
      total,
      limit: opts.limit ?? 50,
      offset: opts.offset ?? 0,
    };
  }

  /**
   * Get single invoice with tenant isolation.
   */
  async getInvoice(ctx: TenantContext, id: string) {
    const db = withTenantIsolation(this.prisma, ctx);

    const invoice = await db.aPInvoice.findFirst({ where: { id } });
    if (!invoice) {
      throw new NotFoundException(`Invoice ${id} not found`);
    }
    return invoice;
  }

  /**
   * Create new invoice with status=RECEIVED and correlationId.
   */
  async createInvoice(ctx: TenantContext, dto: CreateInvoiceDto) {
    const db = withTenantIsolation(this.prisma, ctx);

    // Check for duplicate
    const existing = await db.aPInvoice.findFirst({
      where: { invoiceNumber: dto.invoiceNumber },
    });
    if (existing) {
      throw new ConflictException(`Invoice ${dto.invoiceNumber} already exists`);
    }

    const correlationId = `inv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const invoice = await db.aPInvoice.create({
      data: {
        tenantId: ctx.tenantId,
        invoiceNumber: dto.invoiceNumber,
        vendorName: dto.vendorName,
        vendorId: dto.vendorId,
        amount: dto.amount,
        currency: dto.currency ?? 'KRW',
        invoiceDate: new Date(dto.invoiceDate),
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
        sourceUri: dto.sourceUri,
        poReference: dto.poReference,
        grReference: dto.grReference,
        status: 'RECEIVED',
        correlationId,
      },
    });

    // R3: Initial trace
    await this.prisma.executionTrace.create({
      data: {
        executionSessionId: 'ap-agent-session', // Placeholder; real implementation may differ
        correlationId,
        traceJson: {
          event: 'INVOICE_CREATED',
          invoiceId: invoice.id,
          invoiceNumber: dto.invoiceNumber,
          vendorName: dto.vendorName,
          amount: dto.amount,
          createdBy: ctx.userId,
          timestamp: new Date().toISOString(),
        } as any,
      },
    }).catch(err => {
      this.logger.error('Failed to create ExecutionTrace', err);
    });

    this.logger.log(`Invoice ${invoice.invoiceNumber} created with id ${invoice.id}`);
    return invoice;
  }

  /**
   * Parse invoice using OCR adapter: extract fields, fill parsedJson + ocrConfidence, transition to MATCHING.
   */
  async parseInvoice(ctx: TenantContext, id: string, opts: ParseInvoiceOptions = {}) {
    const db = withTenantIsolation(this.prisma, ctx);

    const invoice = await db.aPInvoice.findFirst({ where: { id } });
    if (!invoice) {
      throw new NotFoundException(`Invoice ${id} not found`);
    }

    if (invoice.status !== 'RECEIVED') {
      throw new BadRequestException(`Invoice must be in RECEIVED status, got ${invoice.status}`);
    }

    // Use OCR adapter to extract invoice fields
    let parsedJson: any;
    let ocrConfidence: number;

    try {
      const sourceUri = opts.sourceUri || invoice.sourceUri || `file://invoice-${id}`;

      const ocrInput: OCRInput = {
        sourceUri,
        hints: {
          language: 'ko', // Default to Korean for Metis use case
          documentType: 'invoice',
          expectedVendor: invoice.vendorName || undefined,
        },
      };

      const ocrOutput = await this.ocrAdapter.extract(ocrInput);

      // Build structured parsed JSON from OCR output
      parsedJson = {
        invoiceNumber: ocrOutput.invoiceNumber || invoice.invoiceNumber,
        vendorName: ocrOutput.vendorName || invoice.vendorName,
        vendorId: ocrOutput.vendorId || invoice.vendorId,
        amount: ocrOutput.amount || invoice.amount,
        currency: ocrOutput.currency || invoice.currency,
        invoiceDate: ocrOutput.invoiceDate || invoice.invoiceDate?.toISOString().split('T')[0],
        dueDate: ocrOutput.dueDate || invoice.dueDate?.toISOString().split('T')[0],
        lineItems: ocrOutput.lineItems || [
          {
            description: 'Item - OCR Extracted',
            quantity: 1,
            unitPrice: ocrOutput.amount || invoice.amount,
            amount: ocrOutput.amount || invoice.amount,
          },
        ],
        tax: ocrOutput.tax || Math.round(Number(ocrOutput.amount || invoice.amount) * 0.1 * 100) / 100,
        totalAmount: Number(ocrOutput.amount || invoice.amount) + Number(ocrOutput.tax || 0),
        ocrRawText: ocrOutput.rawText || `[OCR from ${sourceUri}]`,
        ocrModelName: this.ocrAdapter.name,
      };

      ocrConfidence = ocrOutput.confidence;
    } catch (adapterError) {
      this.logger.error(
        `OCR adapter failed for invoice ${id}, using fallback:`,
        adapterError,
      );

      // Fallback: create basic parsed JSON from invoice data
      parsedJson = {
        invoiceNumber: invoice.invoiceNumber,
        vendorName: invoice.vendorName,
        vendorId: invoice.vendorId,
        amount: invoice.amount,
        currency: invoice.currency,
        invoiceDate: invoice.invoiceDate?.toISOString().split('T')[0],
        dueDate: invoice.dueDate?.toISOString().split('T')[0],
        lineItems: [
          {
            description: 'Item - OCR Fallback',
            quantity: 1,
            unitPrice: invoice.amount,
            amount: invoice.amount,
          },
        ],
        tax: Math.round(Number(invoice.amount) * 0.1 * 100) / 100,
        totalAmount: Number(invoice.amount) * 1.1,
        ocrRawText: `[OCR adapter failed: ${adapterError instanceof Error ? adapterError.message : 'unknown error'}]`,
      };

      ocrConfidence = 0.3; // Low confidence for fallback
    }

    const updated = await db.aPInvoice.update({
      where: { id },
      data: {
        status: 'MATCHING',
        parsedJson: parsedJson as any,
        ocrConfidence,
      },
    });

    // R3: Trace parsing event
    await this.prisma.executionTrace.create({
      data: {
        executionSessionId: 'ap-agent-session',
        correlationId: invoice.correlationId,
        traceJson: {
          event: 'INVOICE_PARSED',
          invoiceId: invoice.id,
          ocrAdapter: this.ocrAdapter.name,
          ocrConfidence,
          parsedLines: parsedJson.lineItems?.length || 1,
          timestamp: new Date().toISOString(),
        } as any,
      },
    }).catch(err => {
      this.logger.error('Failed to create ExecutionTrace', err);
    });

    this.logger.log(`Invoice ${id} parsed via ${this.ocrAdapter.name}, confidence=${ocrConfidence}`);
    return updated;
  }

  /**
   * Run 3-way matching: Invoice vs PO vs GR.
   * Sets matchingResult, aiSuggestionJson, transitions to EXCEPTION or PENDING_APPROVAL.
   */
  async runMatching(ctx: TenantContext, id: string) {
    const db = withTenantIsolation(this.prisma, ctx);

    const invoice = await db.aPInvoice.findFirst({ where: { id } });
    if (!invoice) {
      throw new NotFoundException(`Invoice ${id} not found`);
    }

    if (invoice.status !== 'MATCHING') {
      throw new BadRequestException(`Invoice must be in MATCHING status, got ${invoice.status}`);
    }

    // Build invoice data
    const invoiceData: InvoiceData = {
      amount: Number(invoice.amount),
      vendorName: invoice.vendorName,
      vendorId: invoice.vendorId || undefined,
      invoiceNumber: invoice.invoiceNumber,
      invoiceDate: invoice.invoiceDate,
      lineItems: (invoice.parsedJson as any)?.lineItems || [],
    };

    // TODO: In real implementation, fetch PO and GR data from external systems
    // For now, use null (NOT_APPLICABLE case)
    const poData: POData | null = null;
    const grData: GRData | null = null;

    // Run matching
    const matchResult = match3way(invoiceData, poData, grData);

    // Determine next status
    let nextStatus: string;
    if (matchResult.discrepancies.some(d => d.severity === 'error')) {
      nextStatus = 'EXCEPTION';
    } else {
      nextStatus = 'PENDING_APPROVAL';
    }

    // Update invoice with matching result
    const updated = await db.aPInvoice.update({
      where: { id },
      data: {
        status: nextStatus as any,
        matchingResult: matchResult.result,
        matchingDetailsJson: {
          discrepancies: matchResult.discrepancies,
          confidence: matchResult.confidence,
        } as any,
        aiSuggestionJson: {
          recommendation: matchResult.recommendation,
          summary: matchResult.summary,
          confidence: matchResult.confidence,
        } as any,
      },
    });

    // R3: Trace matching event
    await this.prisma.executionTrace.create({
      data: {
        executionSessionId: 'ap-agent-session',
        correlationId: invoice.correlationId,
        traceJson: {
          event: 'MATCHING_COMPLETED',
          invoiceId: invoice.id,
          matchResult: matchResult.result,
          recommendation: matchResult.recommendation,
          discrepancyCount: matchResult.discrepancies.length,
          nextStatus,
          timestamp: new Date().toISOString(),
        } as any,
      },
    }).catch(err => {
      this.logger.error('Failed to create ExecutionTrace', err);
    });

    this.logger.log(`Invoice ${id} matching completed: ${matchResult.result} → ${nextStatus}`);
    return updated;
  }

  /**
   * Approve invoice: transition to APPROVED, record approvedByUserId.
   */
  async approve(ctx: TenantContext, id: string, userId: string) {
    const db = withTenantIsolation(this.prisma, ctx);

    const invoice = await db.aPInvoice.findFirst({ where: { id } });
    if (!invoice) {
      throw new NotFoundException(`Invoice ${id} not found`);
    }

    if (invoice.status !== 'PENDING_APPROVAL' && invoice.status !== 'EXCEPTION') {
      throw new BadRequestException(
        `Invoice can only be approved from PENDING_APPROVAL or EXCEPTION, got ${invoice.status}`,
      );
    }

    const updated = await db.aPInvoice.update({
      where: { id },
      data: {
        status: 'APPROVED',
        approvedByUserId: userId,
        approvedAt: new Date(),
      },
    });

    // R3: Trace approval
    await this.prisma.executionTrace.create({
      data: {
        executionSessionId: 'ap-agent-session',
        correlationId: invoice.correlationId,
        traceJson: {
          event: 'INVOICE_APPROVED',
          invoiceId: invoice.id,
          approvedBy: userId,
          approvedAt: new Date().toISOString(),
        } as any,
      },
    }).catch(err => {
      this.logger.error('Failed to create ExecutionTrace', err);
    });

    this.logger.log(`Invoice ${id} approved by ${userId}`);
    return updated;
  }

  /**
   * Reject invoice: transition to REJECTED, record reason.
   */
  async reject(ctx: TenantContext, id: string, reason: string) {
    const db = withTenantIsolation(this.prisma, ctx);

    const invoice = await db.aPInvoice.findFirst({ where: { id } });
    if (!invoice) {
      throw new NotFoundException(`Invoice ${id} not found`);
    }

    if (invoice.status !== 'PENDING_APPROVAL' && invoice.status !== 'EXCEPTION') {
      throw new BadRequestException(
        `Invoice can only be rejected from PENDING_APPROVAL or EXCEPTION, got ${invoice.status}`,
      );
    }

    const updated = await db.aPInvoice.update({
      where: { id },
      data: {
        status: 'REJECTED',
        rejectedReason: reason,
      },
    });

    // R3: Trace rejection
    await this.prisma.executionTrace.create({
      data: {
        executionSessionId: 'ap-agent-session',
        correlationId: invoice.correlationId,
        traceJson: {
          event: 'INVOICE_REJECTED',
          invoiceId: invoice.id,
          reason,
          rejectedAt: new Date().toISOString(),
        } as any,
      },
    }).catch(err => {
      this.logger.error('Failed to create ExecutionTrace', err);
    });

    this.logger.log(`Invoice ${id} rejected: ${reason}`);
    return updated;
  }

  /**
   * Get summary stats: counts by status, today's processed count.
   */
  async summary(ctx: TenantContext) {
    const db = withTenantIsolation(this.prisma, ctx);

    // Count by status
    const statuses = ['RECEIVED', 'PARSING', 'MATCHING', 'EXCEPTION', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'PAID'];
    const countByStatus: Record<string, number> = {};

    for (const status of statuses) {
      countByStatus[status] = await db.aPInvoice.count({
        where: { status: status as any },
      });
    }

    // Today's processed count (APPROVED + REJECTED)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayProcessed = await db.aPInvoice.count({
      where: {
        createdAt: { gte: today, lt: tomorrow },
        status: { in: ['APPROVED', 'REJECTED'] },
      },
    });

    return {
      byStatus: countByStatus,
      total: Object.values(countByStatus).reduce((sum, count) => sum + count, 0),
      todayProcessed,
      timestamp: new Date().toISOString(),
    };
  }
}
