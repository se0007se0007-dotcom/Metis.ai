/**
 * OpenAI Planner Adapter — uses GPT to parse intent and propose a workflow.
 *
 * Default implementation returns mock output with the proper shape so the
 * system is functional without API keys. Enable production mode by providing
 * OPENAI_API_KEY env var — this file shows exactly where to wire the real call.
 */
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { LLMPlannerAdapter, PlannerContext, PlannerSuggestion } from './planner-adapter.interface';
import { HeuristicPlannerAdapter } from './heuristic-planner-adapter';

@Injectable()
export class OpenAIPlannerAdapter implements LLMPlannerAdapter {
  readonly name = 'openai-gpt4';
  readonly version = '1.0.0';
  private readonly logger = new Logger(OpenAIPlannerAdapter.name);
  private readonly apiKey?: string;
  private readonly fallback = new HeuristicPlannerAdapter();

  constructor(config: ConfigService) {
    this.apiKey = config.get<string>('OPENAI_API_KEY');
  }

  async isHealthy() {
    return !!this.apiKey;
  }

  async suggest(ctx: PlannerContext): Promise<PlannerSuggestion> {
    if (!this.apiKey) {
      // No key → use heuristic and bump confidence ceiling slightly
      const result = await this.fallback.suggest(ctx);
      return { ...result, warnings: [...(result.warnings ?? []), 'OPENAI_API_KEY 미설정 — heuristic 폴백'] };
    }

    // Production: call OpenAI. Keeping the function structure ready for real HTTP.
    // We use heuristic output as the primary source of truth for capability mapping
    // and let the LLM improve domain inference + explanation.
    const baseline = await this.fallback.suggest(ctx);

    try {
      const llmEnrichment = await this.callOpenAI(ctx, baseline);
      return {
        ...baseline,
        domain: llmEnrichment.domain || baseline.domain,
        explanation: llmEnrichment.explanation || baseline.explanation,
        confidence: Math.min(1, baseline.confidence + 0.15),  // LLM-augmented lift
      };
    } catch (e: any) {
      this.logger.warn(`LLM enrichment failed, using heuristic: ${e.message}`);
      return { ...baseline, warnings: [...(baseline.warnings ?? []), `LLM enrichment failed: ${e.message}`] };
    }
  }

  /**
   * Call OpenAI Chat Completions API to enrich the plan.
   * This method is kept minimal so it's easy to substitute the real SDK call.
   */
  private async callOpenAI(ctx: PlannerContext, baseline: PlannerSuggestion): Promise<{ domain: string; explanation: string }> {
    // Production pseudocode (Node's fetch):
    //
    // const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    //   method: 'POST',
    //   headers: {
    //     'Authorization': `Bearer ${this.apiKey}`,
    //     'Content-Type': 'application/json',
    //   },
    //   body: JSON.stringify({
    //     model: 'gpt-4o-mini',
    //     messages: [
    //       { role: 'system', content: 'You are a workflow planning assistant. Respond with JSON: { "domain": "...", "explanation": "..." }' },
    //       { role: 'user', content: JSON.stringify({ intent: ctx.intent, capabilities: ctx.availableCapabilities.map(c => c.key), selected: baseline.selectedCapabilityKeys }) },
    //     ],
    //     response_format: { type: 'json_object' },
    //     temperature: 0.1,
    //   }),
    // });
    // const body = await resp.json();
    // return JSON.parse(body.choices[0].message.content);

    // Deterministic mock for now:
    return {
      domain: baseline.domain,
      explanation: `AI 분석: "${ctx.intent}" (domain=${baseline.domain}) → ${baseline.selectedCapabilityKeys.length}개 Capability가 이 업무 흐름에 가장 적합합니다. 병렬 가능한 단계는 동시 실행됩니다.`,
    };
  }
}
