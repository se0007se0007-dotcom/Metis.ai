/**
 * Token Optimizer Service — Phase 4: 3-Gate Token Optimization Pipeline
 *
 * The 3-Gate Pipeline:
 * - Gate 1: Semantic Cache — Check if similar request was cached
 * - Gate 2: Model Router — Route to optimal model tier based on complexity
 * - Gate 3: Skill Packer — Compress/optimize prompt tokens
 *
 * Responsibilities:
 *   - Main optimization workflow
 *   - Semantic cache lookup and management
 *   - Prompt complexity analysis
 *   - Model tier selection
 *   - Cost estimation
 *   - Token usage logging
 */
import {
  Injectable,
  Inject,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { PrismaClient } from '@metis/database';
import { PRISMA_TOKEN } from '../database.module';
import { FinOpsService } from './finops.service';

interface OptimizationResult {
  cacheHit: boolean;
  cachedResponse: string | null;
  routedTier: number;
  routedModel: string;
  originalModel: string;
  estimatedCostReduction: number;
  optimizationApplied: string[];
}

interface RouteResult {
  tier: number;
  model: string;
}

@Injectable()
export class TokenOptimizerService {
  private readonly logger = new Logger(TokenOptimizerService.name);

  constructor(
    @Inject(PRISMA_TOKEN) private readonly prisma: PrismaClient,
    private readonly finOpsService: FinOpsService,
  ) {}

  /**
   * Main optimization method — called for every LLM request from workflow agents
   * Runs through the 3-Gate pipeline to determine optimal routing and caching
   */
  async optimize(params: {
    tenantId: string;
    agentName: string;
    executionSessionId?: string;
    nodeId?: string;
    prompt: string;
    requestedModel?: string;
  }) {
    const config = await this.finOpsService.getOrCreateConfig(params.tenantId);
    const agentConfig = await this.finOpsService
      .getAgentConfig(params.tenantId, params.agentName)
      .catch(() => null);

    if (!agentConfig) {
      // Create default agent config if it doesn't exist
      await this.finOpsService.upsertAgentConfig(
        params.tenantId,
        params.agentName,
        {
          agentName: params.agentName,
        },
      );
    }

    const startTime = Date.now();
    const result: OptimizationResult = {
      cacheHit: false,
      cachedResponse: null,
      routedTier: config.routerFallbackTier,
      routedModel: '',
      originalModel: params.requestedModel || '',
      estimatedCostReduction: 0,
      optimizationApplied: [],
    };

    // ════════════════════════════════════════════════════════════
    // Gate 1: Semantic Cache
    // ════════════════════════════════════════════════════════════
    if (config.cacheEnabled && (agentConfig?.cacheEnabled ?? true)) {
      const cacheResult = await this.checkSemanticCache(params, config);
      if (cacheResult.hit) {
        result.cacheHit = true;
        result.cachedResponse = cacheResult.response;
        result.optimizationApplied.push('SEMANTIC_CACHE');

        const responseTimeMs = Date.now() - startTime;
        // Log and return early — cache hit means no LLM call needed
        await this.logUsage(params, result, responseTimeMs, true);
        return { ...result, responseTimeMs };
      }
    }

    // ════════════════════════════════════════════════════════════
    // Gate 2: Model Router
    // ════════════════════════════════════════════════════════════
    if (config.routerEnabled && (agentConfig?.routerEnabled ?? true)) {
      const routeResult = await this.routeToOptimalModel(
        params,
        config,
        agentConfig,
      );
      result.routedTier = routeResult.tier;
      result.routedModel = routeResult.model;
      result.optimizationApplied.push('MODEL_ROUTER');
    }

    // ════════════════════════════════════════════════════════════
    // Gate 3: Skill Packer — Prompt compression & token optimization
    // ════════════════════════════════════════════════════════════
    if (config.packerEnabled && (agentConfig?.packerEnabled ?? true)) {
      const packResult = this.applySkillPacker(params.prompt, config, result.routedTier);
      if (packResult.applied) {
        result.optimizationApplied.push('SKILL_PACKER');
        this.logger.debug(
          `Skill Packer: compressed ${packResult.originalTokens} → ${packResult.optimizedTokens} tokens (${packResult.savedPct.toFixed(1)}% reduction)`,
        );
      }
    }

    // Calculate cost reduction
    result.estimatedCostReduction = this.calculateSavings(result);

    const responseTimeMs = Date.now() - startTime;
    // Log the optimization with savedUsd for frontend
    await this.logUsage(params, result, responseTimeMs, false);

    // Calculate savedUsd for frontend consumption
    const estimatedTokens = Math.ceil(params.prompt.length / 4);
    const tierPricing: Record<number, number> = { 1: 0.001 / 1000, 2: 0.005 / 1000, 3: 0.02 / 1000 };
    const originalCost = (tierPricing[2] || 0) * estimatedTokens;
    const optimizedCost = (tierPricing[result.routedTier] || 0) * estimatedTokens;
    const savedUsd = Math.max(0, originalCost - optimizedCost);

    return {
      ...result,
      responseTimeMs,
      savedUsd,
      estimatedTokens,
    };
  }

  /**
   * Gate 1: Semantic Cache Implementation
   * Checks if a similar prompt was cached and can be reused
   */
  private async checkSemanticCache(
    params: {
      tenantId: string;
      agentName: string;
      prompt: string;
    },
    config: any,
  ): Promise<{ hit: boolean; response: string | null }> {
    // Check exclude patterns
    for (const pattern of config.cacheExcludePatterns || []) {
      if (params.prompt.includes(pattern)) {
        return { hit: false, response: null };
      }
    }

    const cacheKey = this.computeCacheKey(params.prompt);

    try {
      // Look up in FinOpsTokenLog for similar prompts with cache hit within TTL
      const cacheTtlMs = (config.cacheTtlSeconds || 86400) * 1000;
      const cacheThreshold = new Date(Date.now() - cacheTtlMs);

      const recentSimilar = await (this.prisma as any).finOpsTokenLog.findFirst({
        where: {
          tenantId: params.tenantId,
          agentName: params.agentName,
          promptText: params.prompt, // Exact match for now (in production: use embeddings)
          cachedResponseUsed: false, // Find the original cached response
          createdAt: { gte: cacheThreshold },
        },
        orderBy: { createdAt: 'desc' },
      });

      if (recentSimilar) {
        this.logger.debug(
          `Cache hit for tenant ${params.tenantId}, agent ${params.agentName}`,
        );
        return {
          hit: true,
          response: `[Cached] ${recentSimilar.routedModel} response (${recentSimilar.completionTokens || 0} tokens)`,
        };
      }
    } catch (error) {
      this.logger.error(`Semantic cache lookup error: ${(error as Error).message}`);
    }

    return { hit: false, response: null };
  }

  /**
   * Gate 2: Model Router Implementation
   * Routes to the optimal model tier based on prompt complexity
   */
  private async routeToOptimalModel(
    params: {
      tenantId: string;
      agentName: string;
      prompt: string;
    },
    config: any,
    agentConfig: any,
  ): Promise<RouteResult> {
    // Analyze prompt complexity
    const complexity = this.analyzePromptComplexity(params.prompt);

    // Determine optimal tier based on complexity
    let tier: number;
    if (complexity <= 0.3) {
      tier = 1; // Simple queries → cheapest model
    } else if (complexity <= 0.7) {
      tier = 2; // Medium queries → standard model
    } else {
      tier = 3; // Complex queries → most capable model
    }

    // Enforce agent tier restrictions if configured
    if (agentConfig?.allowedTiers && agentConfig.allowedTiers.length > 0) {
      const allowedTiers = agentConfig.allowedTiers;
      if (!allowedTiers.includes(tier)) {
        // Find the closest allowed tier
        const higherTiers = allowedTiers.filter((t: number) => t >= tier);
        const lowerTiers = allowedTiers.filter((t: number) => t < tier);

        tier = higherTiers.length > 0 ? higherTiers[0] : lowerTiers[lowerTiers.length - 1];
      }
    }

    // Fallback to configured default if tier is not valid
    if (tier < 1 || tier > 3) {
      tier = config.routerFallbackTier || 2;
    }

    // Select model from tier
    let models: string[] = [];
    switch (tier) {
      case 1:
        models = config.routerTier1Models || [
          'claude-haiku-4.5',
          'gemini-3-flash',
          'gpt-4o-mini',
        ];
        break;
      case 2:
        models = config.routerTier2Models || [
          'claude-sonnet-4.6',
          'gpt-4o',
          'gemini-3.1-pro',
        ];
        break;
      case 3:
        models = config.routerTier3Models || [
          'claude-opus-4.6',
          'o3',
          'gpt-5',
        ];
        break;
      default:
        models = config.routerTier2Models || [
          'claude-sonnet-4.6',
          'gpt-4o',
          'gemini-3.1-pro',
        ];
    }

    const model = models[0] || 'claude-sonnet-4.6';

    this.logger.debug(
      `Routed prompt to tier ${tier}, model ${model} (complexity: ${complexity.toFixed(2)})`,
    );

    return { tier, model };
  }

  /**
   * Prompt complexity analyzer
   * Estimates complexity based on length, keywords, code presence, etc.
   */
  private analyzePromptComplexity(prompt: string): number {
    let score = 0;
    const len = prompt.length;

    // Length factor
    if (len > 2000) {
      score += 0.3;
    } else if (len > 500) {
      score += 0.15;
    }

    // Complexity keywords
    const complexKeywords = [
      '분석',
      'analyze',
      'architecture',
      '설계',
      'complex',
      '복잡',
      'multi-step',
      'reasoning',
      '추론',
      'compare',
      '비교',
      'design',
      'optimize',
    ];
    const simpleKeywords = [
      '번역',
      'translate',
      'summarize',
      '요약',
      'list',
      '목록',
      'FAQ',
      'greeting',
      '인사',
      'hello',
      'format',
      'parse',
    ];

    const lowerPrompt = prompt.toLowerCase();
    for (const kw of complexKeywords) {
      if (lowerPrompt.includes(kw)) {
        score += 0.15;
      }
    }
    for (const kw of simpleKeywords) {
      if (lowerPrompt.includes(kw)) {
        score -= 0.1;
      }
    }

    // Code detection
    if (
      prompt.includes('```') ||
      prompt.includes('function') ||
      prompt.includes('class ')
    ) {
      score += 0.2;
    }

    // JSON/structured data
    if (prompt.includes('{') && prompt.includes('}')) {
      score += 0.1;
    }

    // Return normalized score [0, 1]
    return Math.max(0, Math.min(1, score));
  }

  /**
   * Cost calculation based on model tier
   * Reference pricing (approximate, Jan 2026):
   * - Tier 1: $0.001/1K tokens
   * - Tier 2: $0.005/1K tokens
   * - Tier 3: $0.020/1K tokens
   */
  private calculateSavings(result: OptimizationResult): number {
    // Rough estimate: if cache hit, 100% savings. If routed to lower tier, partial savings.
    if (result.cacheHit) {
      return 100; // Full savings
    }

    // If routed to tier 1 instead of tier 2, approximately 80% savings
    // If routed to tier 2 instead of tier 3, approximately 75% savings
    if (result.routedTier === 1) {
      return 80;
    } else if (result.routedTier === 2) {
      return 75;
    }

    return 0;
  }

  /**
   * Gate 3: Skill Packer — Prompt compression and token optimization
   *
   * Techniques applied:
   * 1. Whitespace normalization (collapse multiple spaces/newlines)
   * 2. Redundant instruction removal (duplicate phrases)
   * 3. System prompt compression (common boilerplate reduction)
   * 4. Few-shot example trimming (limit examples by tier)
   * 5. Output format hints (enforce structured output to reduce tokens)
   */
  private applySkillPacker(
    prompt: string,
    config: any,
    tier: number,
  ): { applied: boolean; originalTokens: number; optimizedTokens: number; savedPct: number; compressedPrompt: string } {
    const originalTokens = Math.ceil(prompt.length / 4);
    let compressed = prompt;

    // Technique 1: Whitespace normalization
    compressed = compressed.replace(/\n{3,}/g, '\n\n');
    compressed = compressed.replace(/  +/g, ' ');
    compressed = compressed.trim();

    // Technique 2: Remove redundant instruction phrases
    const redundantPatterns = [
      /Please make sure to /gi,
      /I would like you to /gi,
      /Could you please /gi,
      /I want you to /gi,
      /Make sure that /gi,
      /것을 확인해 주세요\.?\s*/g,
      /부탁드립니다\.?\s*/g,
    ];
    for (const pattern of redundantPatterns) {
      compressed = compressed.replace(pattern, '');
    }

    // Technique 3: System prompt compression — shorten common boilerplate
    const boilerplateMap: [RegExp, string][] = [
      [/You are a helpful assistant that /gi, 'As assistant: '],
      [/You are an AI language model /gi, 'AI: '],
      [/도움이 되는 AI 어시스턴트로서 /g, 'AI로서 '],
      [/다음 내용을 분석하고 결과를 알려주세요/g, '분석 요청:'],
    ];
    for (const [pattern, replacement] of boilerplateMap) {
      compressed = compressed.replace(pattern, replacement);
    }

    // Technique 4: Few-shot example trimming (tier-based limits)
    const maxExamples = tier === 1 ? 1 : tier === 2 ? 3 : 5;
    const examplePattern = /(?:Example|예시|예제)\s*\d+[:\s]/gi;
    let exampleCount = 0;
    compressed = compressed.replace(examplePattern, (match) => {
      exampleCount++;
      if (exampleCount > maxExamples) {
        return ''; // Remove excess examples
      }
      return match;
    });

    // Technique 5: Token budget enforcement
    const maxTokensPerSkill = config.packerMaxTokensPerSkill || 2000;
    const maxChars = maxTokensPerSkill * 4; // Approximate
    if (compressed.length > maxChars) {
      compressed = compressed.substring(0, maxChars) + '\n[...truncated by FinOps Skill Packer]';
    }

    const optimizedTokens = Math.ceil(compressed.length / 4);
    const savedPct = originalTokens > 0 ? ((originalTokens - optimizedTokens) / originalTokens) * 100 : 0;

    return {
      applied: savedPct > 0,
      originalTokens,
      optimizedTokens,
      savedPct,
      compressedPrompt: compressed,
    };
  }

  /**
   * Compute a cache key from the prompt
   * In production, this would use semantic embeddings for similarity
   */
  private computeCacheKey(prompt: string): string {
    // Simple hash for now
    let hash = 0;
    for (let i = 0; i < prompt.length; i++) {
      const char = prompt.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return `cache_${Math.abs(hash).toString(16)}`;
  }

  /**
   * Log token usage to database
   */
  private async logUsage(
    params: {
      tenantId: string;
      agentName: string;
      executionSessionId?: string;
      nodeId?: string;
      prompt: string;
    },
    result: OptimizationResult,
    responseTimeMs: number,
    cacheHit: boolean,
  ) {
    try {
      // Estimate token counts (rough approximation)
      const estimatedPromptTokens = Math.ceil(params.prompt.length / 4);
      const estimatedCompletionTokens = Math.ceil(
        (result.cachedResponse?.length || 0) / 4,
      );

      // Rough cost estimation (in USD)
      const tierPricing: Record<number, number> = {
        1: 0.001 / 1000, // $0.001 per 1K tokens
        2: 0.005 / 1000, // $0.005 per 1K tokens
        3: 0.02 / 1000, // $0.02 per 1K tokens
      };

      const totalTokens = estimatedPromptTokens + estimatedCompletionTokens;
      const originalCostUsd = (tierPricing[2] || 0) * totalTokens; // Default to tier 2 cost
      const optimizedCostUsd = (tierPricing[result.routedTier] || 0) * totalTokens;
      const savedUsd = Math.max(0, originalCostUsd - optimizedCostUsd);

      await this.finOpsService.logTokenUsage(params.tenantId, {
        agentName: params.agentName,
        executionSessionId: params.executionSessionId,
        nodeId: params.nodeId,
        promptText: params.prompt.substring(0, 500), // Store first 500 chars
        promptTokens: estimatedPromptTokens,
        completionTokens: estimatedCompletionTokens,
        totalTokens,
        cacheHit,
        cachedResponseUsed: cacheHit,
        routedTier: result.routedTier,
        routedModel: result.routedModel,
        originalCostUsd,
        optimizedCostUsd,
        savedUsd,
        responseTimeMs,
      });
    } catch (error) {
      this.logger.error(`Error logging token usage: ${(error as Error).message}`);
      // Don't throw — logging failure shouldn't break the flow
    }
  }
}
