/**
 * Agent Dispatcher — routes a task to a named agent.
 *
 * Resolution order:
 *   1. Look up AgentDefinition by key → pick kernelType
 *   2. Dispatch according to kernel:
 *        LOCAL   → invoke in-process handler registry
 *        MCP     → use ConnectorService to call MCP tool
 *        REST    → HTTP POST to kernelConfig.endpoint
 *        EXTERNAL→ webhook + wait for callback (not implemented here)
 *   3. Record invocation stats + publish EVENT to A2A bus
 *
 * This service makes agents "first-class executable nodes".
 */
import { Injectable, Inject, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaClient, withTenantIsolation, TenantContext } from '@metis/database';
import { PRISMA_TOKEN } from '../database.module';
import { AgentRegistryService } from '../capability-registry/agent-registry.service';
import { A2ABusService } from './bus.service';
import * as http from 'http';
import * as https from 'https';

export interface AgentDispatchRequest {
  agentKey: string;
  missionId?: string;
  input: Record<string, any>;
  correlationId?: string;
  timeoutSec?: number;
}

export interface AgentDispatchResult {
  success: boolean;
  output: Record<string, any>;
  durationMs: number;
  agent: string;
  kernel: string;
  error?: string;
}

type LocalAgentHandler = (input: Record<string, any>, ctx: TenantContext) => Promise<Record<string, any>>;

@Injectable()
export class AgentDispatcherService {
  private readonly logger = new Logger(AgentDispatcherService.name);
  private readonly localHandlers = new Map<string, LocalAgentHandler>();

  constructor(
    @Inject(PRISMA_TOKEN) private readonly prisma: PrismaClient,
    private readonly agentRegistry: AgentRegistryService,
    private readonly bus: A2ABusService,
  ) {}

  /** Register an in-process agent handler (called from each agent module). */
  registerLocalHandler(agentKey: string, handler: LocalAgentHandler) {
    this.localHandlers.set(agentKey, handler);
    this.logger.log(`[dispatcher] Registered local handler for "${agentKey}"`);
  }

  async dispatch(ctx: TenantContext, req: AgentDispatchRequest): Promise<AgentDispatchResult> {
    const start = Date.now();
    const correlationId = req.correlationId || `dispatch-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    // Resolve agent definition
    const agent = await this.agentRegistry.getByKey(ctx, req.agentKey);
    if (agent.status === 'UNAVAILABLE' || agent.status === 'DRAINING') {
      return {
        success: false, output: {}, durationMs: Date.now() - start,
        agent: agent.key, kernel: agent.kernelType,
        error: `Agent "${agent.key}" is ${agent.status}`,
      };
    }

    // Emit request event to mission if bound
    if (req.missionId) {
      await this.bus.publish(ctx.tenantId, req.missionId, {
        kind: 'REQUEST',
        fromAgent: 'dispatcher',
        toAgent: agent.key,
        subject: 'Task dispatch',
        payload: { input: req.input },
        naturalSummary: `${agent.name} 에이전트에게 작업을 요청했습니다.`,
        correlationId,
      });
    }

    let output: Record<string, any> = {};
    let success = false;
    let error: string | undefined;

    try {
      switch (agent.kernelType) {
        case 'LOCAL':
          output = await this.dispatchLocal(agent.key, req.input, ctx);
          success = true;
          break;
        case 'REST':
          output = await this.dispatchREST(agent.kernelConfigJson as any, req.input, req.timeoutSec ?? agent.defaultTimeoutSec);
          success = true;
          break;
        case 'MCP':
          output = await this.dispatchMCP(ctx, agent.key, agent.kernelConfigJson as any, req.input);
          success = true;
          break;
        case 'EXTERNAL':
          output = await this.dispatchExternal(agent.kernelConfigJson as any, req.input);
          success = true;
          break;
      }
    } catch (e: any) {
      success = false;
      error = e.message;
      this.logger.error(`[dispatcher] ${agent.key} failed: ${e.message}`);
    }

    const durationMs = Date.now() - start;

    // Record stats
    await this.agentRegistry.recordInvocation(ctx, agent.key, success).catch(() => {});

    // Emit response event
    if (req.missionId) {
      await this.bus.publish(ctx.tenantId, req.missionId, {
        kind: success ? 'RESPONSE' : 'EVENT',
        fromAgent: agent.key,
        toAgent: 'dispatcher',
        subject: success ? 'Task completed' : 'Task failed',
        payload: success ? { output } : { error },
        naturalSummary: success
          ? `${agent.name}가 작업을 완료했습니다.`
          : `${agent.name} 실행 실패: ${error}`,
        correlationId,
      });
    }

    // Audit trace
    await this.prisma.executionTrace.create({
      data: {
        executionSessionId: 'system-dispatch',
        correlationId,
        traceJson: {
          event: 'AGENT_DISPATCH',
          agent: agent.key,
          kernel: agent.kernelType,
          success,
          durationMs,
          missionId: req.missionId,
          timestamp: new Date().toISOString(),
        } as any,
      },
    }).catch(() => {});

    return { success, output, durationMs, agent: agent.key, kernel: agent.kernelType, error };
  }

  // ── Kernel implementations ──────────────────────────────

  private async dispatchLocal(agentKey: string, input: Record<string, any>, ctx: TenantContext) {
    const handler = this.localHandlers.get(agentKey);
    if (!handler) {
      throw new Error(`No local handler registered for "${agentKey}"`);
    }
    return handler(input, ctx);
  }

  private async dispatchREST(config: Record<string, any>, input: Record<string, any>, timeoutSec: number): Promise<Record<string, any>> {
    const endpoint = config?.endpoint;
    if (!endpoint) throw new Error('No endpoint in agent kernelConfig');
    const url = new URL(endpoint);
    const mod = url.protocol === 'https:' ? https : http;
    const body = JSON.stringify(input);
    return new Promise((resolve, reject) => {
      const req = mod.request(url, {
        method: config.method || 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': String(Buffer.byteLength(body)),
          ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}),
          ...(config.headers || {}),
        },
        timeout: timeoutSec * 1000,
      }, (res) => {
        let data = '';
        res.on('data', (c: Buffer) => { data += c; });
        res.on('end', () => {
          try { resolve(JSON.parse(data)); }
          catch { resolve({ data, statusCode: res.statusCode }); }
        });
      });
      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('REST agent timeout')); });
      req.write(body);
      req.end();
    });
  }

  private async dispatchMCP(_ctx: TenantContext, agentKey: string, config: Record<string, any>, input: Record<string, any>): Promise<Record<string, any>> {
    // Delegate to ConnectorService if available. For now, return a not-implemented placeholder.
    // Full MCP bridge would require circular dependency resolution with ConnectorModule.
    return {
      note: 'MCP dispatch via agent placeholder — production would invoke ConnectorService.invoke()',
      agent: agentKey,
      config,
      input,
    };
  }

  private async dispatchExternal(config: Record<string, any>, input: Record<string, any>): Promise<Record<string, any>> {
    // Fire-and-forget webhook
    const url = new URL(config?.endpoint);
    const mod = url.protocol === 'https:' ? https : http;
    const body = JSON.stringify({ input, timestamp: new Date().toISOString() });
    return new Promise((resolve) => {
      const req = mod.request(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': String(Buffer.byteLength(body)) },
      }, (res) => {
        resolve({ dispatched: true, statusCode: res.statusCode });
      });
      req.on('error', () => resolve({ dispatched: false }));
      req.write(body);
      req.end();
    });
  }
}
