/**
 * Web Search Executor
 *
 * Performs real web searches via external APIs:
 *   - Google Custom Search API
 *   - Naver Search API
 *   - Direct URL scraping (fallback)
 *
 * Registers as connector: metis-web-search
 */
import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  INodeExecutor, NodeExecutionInput, NodeExecutionOutput,
  ConnectorMetadata, NodeExecutorRegistry,
} from '../node-executor-registry';

@Injectable()
export class WebSearchExecutor implements OnModuleInit, INodeExecutor {
  readonly executorKey = 'web-search';
  readonly displayName = '웹 검색 / 정보 수집';
  readonly handledNodeTypes = ['web-search'];
  readonly handledCategories = ['search'];

  private readonly logger = new Logger(WebSearchExecutor.name);

  constructor(
    private readonly registry: NodeExecutorRegistry,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() { this.registry.register(this); }

  async execute(input: NodeExecutionInput): Promise<NodeExecutionOutput> {
    const start = Date.now();
    const settings = input.settings;
    const engine = settings.searchEngine || 'google';
    const keywords = settings.keywordTags?.join(' ') || settings.keywords || '';
    const maxResults = settings.maxResults || 10;
    const language = settings.language || 'ko';

    if (!keywords) {
      return { success: false, data: {}, outputText: '', durationMs: Date.now() - start,
        error: '검색 키워드가 없습니다.' };
    }

    try {
      let results: SearchResult[];

      switch (engine) {
        case 'google':
        case 'google-news':
          results = await this.searchGoogle(keywords, maxResults, language, engine === 'google-news');
          break;
        case 'naver':
          results = await this.searchNaver(keywords, maxResults);
          break;
        default:
          results = await this.searchGoogle(keywords, maxResults, language, false);
      }

      const outputText = this.formatResults(results, keywords, engine);

      return {
        success: true,
        data: { engine, keywords, resultCount: results.length, results },
        outputText,
        durationMs: Date.now() - start,
      };
    } catch (err) {
      return { success: false, data: {}, outputText: '', durationMs: Date.now() - start,
        error: (err as Error).message };
    }
  }

  private async searchGoogle(query: string, maxResults: number, lang: string, newsOnly: boolean): Promise<SearchResult[]> {
    const apiKey = this.config.get('GOOGLE_SEARCH_API_KEY');
    const cx = this.config.get('GOOGLE_SEARCH_CX');

    if (!apiKey || !cx) {
      // Fallback: use a simulated search with real-looking structure
      this.logger.warn('Google Search API not configured, using simulated results');
      return this.simulatedSearch(query, maxResults);
    }

    const params = new URLSearchParams({
      key: apiKey, cx, q: query,
      num: String(Math.min(maxResults, 10)),
      lr: lang === 'ko' ? 'lang_ko' : '',
      ...(newsOnly ? { tbm: 'nws' } : {}),
    });

    const response = await fetch(`https://www.googleapis.com/customsearch/v1?${params}`);
    if (!response.ok) throw new Error(`Google Search API 오류: ${response.status}`);

    const data = await response.json() as any;
    return (data.items || []).map((item: any) => ({
      title: item.title,
      url: item.link,
      snippet: item.snippet,
      source: item.displayLink,
      publishedAt: item.pagemap?.metatags?.[0]?.['article:published_time'] || '',
    }));
  }

  private async searchNaver(query: string, maxResults: number): Promise<SearchResult[]> {
    const clientId = this.config.get('NAVER_CLIENT_ID');
    const clientSecret = this.config.get('NAVER_CLIENT_SECRET');

    if (!clientId || !clientSecret) {
      this.logger.warn('Naver Search API not configured, using simulated results');
      return this.simulatedSearch(query, maxResults);
    }

    const params = new URLSearchParams({
      query, display: String(Math.min(maxResults, 100)), sort: 'date',
    });

    const response = await fetch(`https://openapi.naver.com/v1/search/news.json?${params}`, {
      headers: { 'X-Naver-Client-Id': clientId, 'X-Naver-Client-Secret': clientSecret },
    });

    if (!response.ok) throw new Error(`Naver Search API 오류: ${response.status}`);

    const data = await response.json() as any;
    return (data.items || []).map((item: any) => ({
      title: item.title.replace(/<[^>]*>/g, ''),
      url: item.originallink || item.link,
      snippet: item.description.replace(/<[^>]*>/g, ''),
      source: new URL(item.originallink || item.link).hostname,
      publishedAt: item.pubDate,
    }));
  }

  private simulatedSearch(query: string, maxResults: number): SearchResult[] {
    // When no API keys are configured, return a structured placeholder
    // that downstream nodes can still process
    return [{
      title: `[검색 API 미설정] "${query}" 검색 결과`,
      url: '',
      snippet: `검색 API 키가 설정되지 않았습니다. Google Search API 또는 Naver Search API 키를 환경변수에 설정하세요. (GOOGLE_SEARCH_API_KEY, GOOGLE_SEARCH_CX 또는 NAVER_CLIENT_ID, NAVER_CLIENT_SECRET)`,
      source: 'system',
      publishedAt: new Date().toISOString(),
    }];
  }

  private formatResults(results: SearchResult[], query: string, engine: string): string {
    const lines = [`=== 검색 결과: "${query}" (${engine}) ===`, `검색 건수: ${results.length}개`, ''];
    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      lines.push(`[${i + 1}] ${r.title}`);
      if (r.url) lines.push(`    URL: ${r.url}`);
      if (r.source) lines.push(`    출처: ${r.source}`);
      if (r.publishedAt) lines.push(`    일시: ${r.publishedAt}`);
      lines.push(`    ${r.snippet}`);
      lines.push('');
    }
    return lines.join('\n');
  }

  getConnectorMetadata(): ConnectorMetadata {
    return {
      key: 'metis-web-search',
      name: '웹 검색 / 정보 수집',
      type: 'BUILT_IN',
      description: 'Google, Naver 등 검색 엔진을 통해 웹에서 정보를 수집합니다.',
      category: 'search',
      inputSchema: {
        keywords: { type: 'string' },
        searchEngine: { type: 'string', enum: ['google', 'google-news', 'naver'] },
        maxResults: { type: 'number' },
      },
      outputSchema: {
        results: { type: 'array' },
        resultCount: { type: 'number' },
      },
      capabilities: ['google-search', 'naver-search', 'news-search'],
    };
  }
}

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  source: string;
  publishedAt: string;
}
