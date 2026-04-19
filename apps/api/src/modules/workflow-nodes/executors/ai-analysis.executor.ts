/**
 * AI Analysis Executor
 *
 * Handles all AI-processing nodes:
 *   - Security inspection (SAST, DAST, SCA, Secret Scan, Pentest)
 *   - Code analysis / review
 *   - Summary generation
 *   - General AI processing
 *
 * Uses real LLM API calls (Anthropic Claude / OpenAI GPT) to perform analysis.
 * Integrates with FinOps 3-Gate pipeline for cost optimization.
 *
 * Registers as connector: metis-ai-analysis
 */
import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  INodeExecutor,
  NodeExecutionInput,
  NodeExecutionOutput,
  ConnectorMetadata,
  NodeExecutorRegistry,
} from '../node-executor-registry';

// Security scan prompt templates
const SCAN_PROMPTS: Record<string, string> = {
  sast: `당신은 숙련된 보안 엔지니어입니다. 다음 소스 코드를 정적 분석(SAST) 관점에서 검사하세요.

점검 항목:
- SQL Injection, XSS, CSRF 취약점
- 버퍼 오버플로우 / 메모리 안전성
- 인증/인가 우회 가능성
- 입력값 검증 미비
- 안전하지 않은 역직렬화
- 경로 탐색 취약점
- 기타 OWASP Top 10 항목

각 발견된 취약점에 대해:
1. 위험도 (CRITICAL / HIGH / MEDIUM / LOW / INFO)
2. 취약점 유형 (CWE 번호 포함)
3. 해당 파일명과 라인 번호 (가능한 경우)
4. 상세 설명
5. 권고 수정사항 (코드 예시 포함)

결과를 구조화된 형태로 정리하세요.`,

  secrets: `당신은 보안 전문가입니다. 다음 소스 코드에서 하드코딩된 비밀 정보를 찾으세요.

점검 대상:
- API 키 (AWS, GCP, Azure, 각종 서비스)
- 데이터베이스 비밀번호 / 연결 문자열
- JWT 시크릿 / 토큰
- SSH 키 / 인증서
- OAuth 클라이언트 시크릿
- 환경변수에 있어야 할 설정값
- .env 파일 내용이 코드에 포함된 경우

각 발견된 시크릿에 대해:
1. 위험도
2. 파일명과 라인 번호
3. 시크릿 유형
4. 수정 방법 (환경변수 전환 등)`,

  pentest: `당신은 침투 테스트 전문가입니다. 다음 소스 코드를 분석하여 모의해킹 관점에서 공격 가능한 취약점을 식별하세요.

분석 관점:
- 인증 우회 경로
- 권한 상승 가능성
- API 엔드포인트 악용 시나리오
- 세션 하이재킹 가능성
- 파일 업로드 취약점 악용
- SSRF / IDOR 공격 벡터
- Rate limiting 미비

각 공격 벡터에 대해:
1. 공격 시나리오 설명
2. 영향 범위 및 위험도
3. 실제 익스플로잇 가능성 평가
4. 방어 방안`,

  sca: `당신은 소프트웨어 구성 분석(SCA) 전문가입니다. 다음 코드의 의존성을 분석하세요.

점검 항목:
- package.json, requirements.txt, pom.xml 등의 의존성 파일 분석
- 알려진 CVE가 있는 패키지 식별
- 오래된 / 유지보수 중단된 의존성
- 라이선스 호환성 문제

결과를 구조화된 형태로 정리하세요.`,

  license: `소스 코드와 의존성 파일을 분석하여 오픈소스 라이선스 규정 준수 여부를 점검하세요.

점검 항목:
- 사용된 오픈소스 라이선스 목록
- GPL 등 카피레프트 라이선스 감염 여부
- 라이선스 충돌 가능성
- 라이선스 고지 누락 여부
- 상업적 사용 제한 라이선스`,
};

const SUMMARY_PROMPTS: Record<string, string> = {
  executive: `이전 단계의 분석 결과를 경영진 보고용으로 요약하세요.

포함 사항:
- 핵심 결론 (1-2문장)
- 주요 발견 사항 (상위 5개)
- 위험 수준 종합 평가
- 즉시 조치 필요 항목
- 권고 사항

비기술적인 용어로 간결하게 작성하세요.`,

  technical: `이전 단계의 분석 결과를 기술팀 대상으로 상세하게 정리하세요.

포함 사항:
- 발견된 모든 이슈 상세 목록
- 각 이슈의 기술적 설명, 코드 참조
- 심각도별 분류
- 구체적인 수정 방안 (코드 스니펫 포함)
- 우선순위 기반 수정 로드맵`,

  bullet: `이전 단계의 분석 결과를 핵심 요점 위주로 정리하세요.

형식:
- 불릿포인트로 간결하게
- 각 항목은 1-2줄 이내
- 심각도 표시 포함
- 중요한 것부터 순서대로`,

  narrative: `이전 단계의 분석 결과를 서술형 리포트로 작성하세요.

구조:
1. 개요 및 배경
2. 분석 방법론
3. 주요 발견 사항
4. 상세 분석 결과
5. 결론 및 권고사항

전체 맥락이 자연스럽게 전달되도록 서술형으로 작성하세요.`,
};

@Injectable()
export class AIAnalysisExecutor implements OnModuleInit, INodeExecutor {
  readonly executorKey = 'ai-analysis';
  readonly displayName = 'AI 분석 / 보안 점검';
  readonly handledNodeTypes = ['ai-processing'];
  readonly handledCategories = ['inspection', 'analysis', 'summarize'];

  private readonly logger = new Logger(AIAnalysisExecutor.name);
  private anthropicApiKey: string | undefined;
  private openaiApiKey: string | undefined;

  constructor(
    private readonly registry: NodeExecutorRegistry,
    private readonly config: ConfigService,
  ) {
    this.anthropicApiKey = this.config.get('ANTHROPIC_API_KEY');
    this.openaiApiKey = this.config.get('OPENAI_API_KEY');
  }

  onModuleInit() {
    this.registry.register(this);
  }

  async execute(input: NodeExecutionInput): Promise<NodeExecutionOutput> {
    const start = Date.now();
    const settings = input.settings;
    const category = settings.stepCategory || 'analysis';

    try {
      let result: string;

      if (category === 'inspection' || category === 'analysis') {
        result = await this.executeInspection(input);
      } else if (category === 'summarize') {
        result = await this.executeSummary(input);
      } else {
        result = await this.executeGeneral(input);
      }

      return {
        success: true,
        data: {
          category,
          model: settings.model || 'claude-sonnet-4.6',
          analysisType: settings.analysisType || category,
          resultLength: result.length,
        },
        outputText: result,
        durationMs: Date.now() - start,
      };
    } catch (err) {
      return {
        success: false,
        data: {},
        outputText: '',
        durationMs: Date.now() - start,
        error: (err as Error).message,
      };
    }
  }

  private async executeInspection(input: NodeExecutionInput): Promise<string> {
    const settings = input.settings;
    const scanners: string[] = settings.scanners || ['sast', 'secrets'];
    const minSeverity = settings.minSeverity || 'low';
    const customRules = settings.customRules || '';
    const sourceCode = input.previousOutput;

    if (!sourceCode || sourceCode.length < 50) {
      throw new Error('분석할 소스 코드가 없습니다. 이전 노드에서 소스를 로딩해주세요.');
    }

    const allResults: string[] = [];

    for (const scanner of scanners) {
      const scanPrompt = SCAN_PROMPTS[scanner];
      if (!scanPrompt) continue;

      const fullPrompt = `${scanPrompt}

${customRules ? `추가 점검 규칙:\n${customRules}\n\n` : ''}최소 리포트 등급: ${minSeverity.toUpperCase()}
(이 등급 미만의 발견은 생략하세요)

=== 분석 대상 소스 코드 ===
${sourceCode.slice(0, 150000)}`;

      this.logger.log(`Running ${scanner.toUpperCase()} scan with ${settings.model || 'claude-sonnet-4.6'}`);

      const result = await this.callLLM(
        fullPrompt,
        settings.model || 'claude-sonnet-4.6',
        settings.maxTokens || 4000,
        settings.temperature ?? 0.3,
      );

      allResults.push(`\n${'='.repeat(60)}\n${scanner.toUpperCase()} 점검 결과\n${'='.repeat(60)}\n\n${result}`);
    }

    return allResults.join('\n\n');
  }

  private async executeSummary(input: NodeExecutionInput): Promise<string> {
    const settings = input.settings;
    const style = settings.summaryStyle || 'technical';
    const focusAreas = settings.focusAreas || '';
    const maxLength = settings.maxLength || 'medium';
    const previousOutput = input.previousOutput;

    if (!previousOutput || previousOutput.length < 20) {
      throw new Error('정리할 데이터가 없습니다. 이전 노드의 결과를 확인해주세요.');
    }

    const stylePrompt = SUMMARY_PROMPTS[style] || SUMMARY_PROMPTS.technical;
    const lengthGuide: Record<string, string> = {
      short: '500자 이내로 간결하게',
      medium: '1000-1500자 수준으로',
      long: '2000-3000자 수준으로 상세하게',
      unlimited: '필요한 만큼 충분히 상세하게',
    };

    const fullPrompt = `${stylePrompt}

${focusAreas ? `특별 집중 영역: ${focusAreas}\n` : ''}분량: ${lengthGuide[maxLength] || lengthGuide.medium}
출력 언어: ${settings.outputLanguage === 'en' ? 'English' : '한국어'}

=== 이전 단계 분석 결과 ===
${previousOutput.slice(0, 150000)}`;

    return this.callLLM(
      fullPrompt,
      settings.model || 'claude-sonnet-4.6',
      settings.maxTokens || 4000,
      settings.temperature ?? 0.5,
    );
  }

  private async executeGeneral(input: NodeExecutionInput): Promise<string> {
    const settings = input.settings;
    let prompt = settings.promptTemplate || '';

    // Replace template variables
    prompt = prompt
      .replace(/\{\{이전 노드 결과\}\}/g, input.previousOutput || '(이전 노드 결과 없음)')
      .replace(/\{\{검색 결과\}\}/g, input.previousOutput || '')
      .replace(/\{\{파일 내용\}\}/g, input.previousOutput || '');

    if (!prompt || prompt.length < 5) {
      prompt = `다음 데이터를 분석하고 결과를 정리하세요:\n\n${input.previousOutput || '(데이터 없음)'}`;
    }

    return this.callLLM(
      prompt,
      settings.model || 'claude-sonnet-4.6',
      settings.maxTokens || 2000,
      settings.temperature ?? 0.7,
    );
  }

  /**
   * Call LLM API (Anthropic Claude or OpenAI GPT)
   */
  private async callLLM(
    prompt: string,
    model: string,
    maxTokens: number,
    temperature: number,
  ): Promise<string> {
    // Determine which API to use
    if (model.startsWith('claude') || model.startsWith('anthropic')) {
      return this.callAnthropic(prompt, model, maxTokens, temperature);
    } else if (model.startsWith('gpt') || model.startsWith('o3') || model.startsWith('o1')) {
      return this.callOpenAI(prompt, model, maxTokens, temperature);
    }
    // Default to Anthropic
    return this.callAnthropic(prompt, 'claude-sonnet-4-6', maxTokens, temperature);
  }

  private async callAnthropic(
    prompt: string,
    model: string,
    maxTokens: number,
    temperature: number,
  ): Promise<string> {
    if (!this.anthropicApiKey) {
      throw new Error('ANTHROPIC_API_KEY가 설정되지 않았습니다. 환경변수를 확인하세요.');
    }

    // Normalize model name
    const modelId = model
      .replace('claude-opus-4.6', 'claude-opus-4-6')
      .replace('claude-sonnet-4.6', 'claude-sonnet-4-6')
      .replace('claude-haiku-4.5', 'claude-haiku-4-5-20251001');

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.anthropicApiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: modelId,
        max_tokens: maxTokens,
        temperature,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      throw new Error(`Anthropic API 오류 (${response.status}): ${errBody.slice(0, 500)}`);
    }

    const data = await response.json() as any;
    return data.content?.[0]?.text || '';
  }

  private async callOpenAI(
    prompt: string,
    model: string,
    maxTokens: number,
    temperature: number,
  ): Promise<string> {
    if (!this.openaiApiKey) {
      throw new Error('OPENAI_API_KEY가 설정되지 않았습니다. 환경변수를 확인하세요.');
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.openaiApiKey}`,
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        temperature,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      throw new Error(`OpenAI API 오류 (${response.status}): ${errBody.slice(0, 500)}`);
    }

    const data = await response.json() as any;
    return data.choices?.[0]?.message?.content || '';
  }

  getConnectorMetadata(): ConnectorMetadata {
    return {
      key: 'metis-ai-analysis',
      name: 'AI 분석 / 보안 점검',
      type: 'BUILT_IN',
      description: 'AI를 활용한 코드 분석, 보안 취약점 점검, 요약 정리를 수행합니다. SAST, Secret Scan, 모의해킹 시뮬레이션을 지원합니다.',
      category: 'analysis',
      inputSchema: {
        scanners: { type: 'array', description: '사용할 스캐너 목록 (sast, secrets, pentest, sca, license)' },
        model: { type: 'string', description: 'AI 모델' },
        minSeverity: { type: 'string', description: '최소 리포트 등급' },
        sourceCode: { type: 'string', description: '분석 대상 소스 코드 (이전 노드에서 전달)' },
      },
      outputSchema: {
        analysisResult: { type: 'string', description: '분석 결과 텍스트' },
        vulnerabilities: { type: 'array', description: '발견된 취약점 목록' },
      },
      capabilities: ['sast', 'dast', 'sca', 'secret-scan', 'pentest', 'license-check', 'code-review', 'summarize'],
    };
  }
}
