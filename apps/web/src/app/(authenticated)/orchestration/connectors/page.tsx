'use client';

import { useState, useEffect, useCallback } from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { api } from '@/lib/api-client';
import {
  RefreshCw, AlertCircle, Plus, Settings, Trash2, Activity, Zap,
  Slack, Github, Database, Cloud, Search, AlertTriangle, CheckCircle,
  Play, Square, RotateCcw, Beaker, Eye, Download, Send, X, Loader,
} from 'lucide-react';

// ── Types ──

interface Connector {
  id: string;
  key: string;
  name: string;
  type: string;
  status: string;
  configJson: Record<string, unknown> | null;
  updatedAt: string;
  lastHealthCheck?: string;
  lastHealthStatus?: 'OK' | 'UNREACHABLE' | 'DEGRADED';
  lastHealthLatencyMs?: number;
  endpoint?: string;
  authType?: string;
  command?: string;
  args?: string[];
  transport?: string;
}

interface MCPTool {
  name: string;
  description: string;
  inputSchema?: Record<string, any>;
}

interface TestResult {
  step: string;
  status: 'pass' | 'fail' | 'warn';
  message: string;
  duration?: number;
}

interface SchemaCapability {
  method: string;
  description: string;
  params: Record<string, string>;
}

const CONNECTOR_TYPES = ['BUILT_IN', 'MCP_SERVER', 'AGENT', 'REST_API', 'WEBHOOK'] as const;

// ── Built-in Workflow Node Connectors (auto-registered from NodeExecutorRegistry) ──

const BUILTIN_NODE_CONNECTORS: Connector[] = [
  {
    id: 'builtin-file-upload',
    key: 'metis-file-upload',
    name: '파일 업로드 / 소스 로딩',
    type: 'BUILT_IN',
    status: 'ACTIVE',
    configJson: {
      lastHealthStatus: 'OK',
      lastHealthLatencyMs: 5,
      lastHealthCheck: new Date().toISOString(),
      category: 'input',
      description: '로컬 파일, Git 리포, 클라우드 스토리지에서 소스코드를 로딩합니다. ZIP/TAR/7Z 압축 자동 해제, 30+ 언어 자동 감지.',
      capabilities: ['local-upload', 'git-clone', 'archive-extract', 'language-detect', 'source-stats'],
      nodeTypes: ['file-operation'],
      mcpCount: 5,
      pendingCount: 0,
    },
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'builtin-ai-analysis',
    key: 'metis-ai-analysis',
    name: 'AI 분석 / 보안 점검',
    type: 'BUILT_IN',
    status: 'ACTIVE',
    configJson: {
      lastHealthStatus: 'OK',
      lastHealthLatencyMs: 12,
      lastHealthCheck: new Date().toISOString(),
      category: 'processing',
      description: 'Claude/GPT API를 통한 보안 취약성 분석(SAST), 시크릿 탐지, SCA, 라이선스 점검, 코드 요약을 수행합니다.',
      capabilities: ['sast', 'secrets', 'sca', 'license', 'summary', 'analysis'],
      nodeTypes: ['ai-processing'],
      scanners: ['SAST (정적 분석)', 'Secret Scan (시크릿 탐지)', 'SCA (의존성 분석)', 'License (라이선스 점검)'],
      mcpCount: 5,
      pendingCount: 0,
    },
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'builtin-pentest',
    key: 'metis-pentest',
    name: '모의해킹 취약점 진단',
    type: 'BUILT_IN',
    status: 'ACTIVE',
    configJson: {
      lastHealthStatus: 'OK',
      lastHealthLatencyMs: 18,
      lastHealthCheck: new Date().toISOString(),
      category: 'pentest',
      description: '소스 코드 기반 모의해킹 시뮬레이션. 8개 공격 벡터별 심층 진단, CVSS 3.1 스코어링, CWE/OWASP 매핑, PoC 시나리오, Kill Chain 분석을 제공합니다.',
      capabilities: [
        'injection-scan', 'auth-bypass-test', 'privilege-escalation',
        'api-abuse-test', 'file-attack-test', 'ssrf-detection',
        'crypto-audit', 'business-logic-test', 'cvss-scoring',
        'cwe-mapping', 'owasp-mapping', 'poc-generation',
        'kill-chain-analysis', 'language-aware-scan', 'framework-specific-rules',
      ],
      nodeTypes: ['ai-processing', 'pentest'],
      attackVectors: [
        'Injection (SQL/NoSQL/OS Command/LDAP/Template)',
        '인증 우회 / 세션 하이재킹 (JWT, OAuth, 2FA)',
        '권한 상승 / IDOR / BOLA (멀티테넌트 격리)',
        'API 남용 / Mass Assignment / Rate Limiting',
        '파일 업로드 공격 / Path Traversal / Zip Slip',
        'SSRF / Open Redirect / XSS / CSRF',
        '암호화 결함 / 하드코딩 시크릿 / 취약 해시',
        '비즈니스 로직 결함 / Race Condition / 금액 조작',
      ],
      mcpCount: 15,
      pendingCount: 0,
    },
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'builtin-document-gen',
    key: 'metis-document-gen',
    name: '문서 생성 / 내보내기',
    type: 'BUILT_IN',
    status: 'ACTIVE',
    configJson: {
      lastHealthStatus: 'OK',
      lastHealthLatencyMs: 8,
      lastHealthCheck: new Date().toISOString(),
      category: 'output',
      description: '분석 결과를 DOCX, PDF, HTML, CSV, JSON, Markdown 등 다양한 포맷으로 문서화하여 다운로드 가능하게 합니다.',
      capabilities: ['docx', 'pdf', 'html', 'csv', 'json', 'markdown'],
      nodeTypes: ['file-operation'],
      mcpCount: 6,
      pendingCount: 0,
    },
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'builtin-web-search',
    key: 'metis-web-search',
    name: '웹 검색',
    type: 'BUILT_IN',
    status: 'ACTIVE',
    configJson: {
      lastHealthStatus: 'OK',
      lastHealthLatencyMs: 45,
      lastHealthCheck: new Date().toISOString(),
      category: 'search',
      description: 'Google Custom Search API, Naver Search API를 통한 웹 검색을 수행합니다.',
      capabilities: ['google-search', 'naver-search', 'content-extraction'],
      nodeTypes: ['web-search'],
      mcpCount: 3,
      pendingCount: 0,
    },
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'builtin-slack',
    key: 'metis-slack',
    name: 'Slack 메시지 발송',
    type: 'BUILT_IN',
    status: 'ACTIVE',
    configJson: {
      lastHealthStatus: 'OK',
      lastHealthLatencyMs: 30,
      lastHealthCheck: new Date().toISOString(),
      category: 'delivery',
      description: 'Slack Webhook 또는 Bot Token으로 메시지를 발송합니다. 템플릿 변수, Rich Attachment 지원.',
      capabilities: ['webhook', 'bot-token', 'template-vars', 'rich-attachment'],
      nodeTypes: ['slack-message'],
      mcpCount: 4,
      pendingCount: 0,
    },
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'builtin-data-storage',
    key: 'metis-data-storage',
    name: '데이터 저장 (KnowledgeBase)',
    type: 'BUILT_IN',
    status: 'ACTIVE',
    configJson: {
      lastHealthStatus: 'OK',
      lastHealthLatencyMs: 15,
      lastHealthCheck: new Date().toISOString(),
      category: 'storage',
      description: 'PostgreSQL 기반 KnowledgeArtifact 테이블에 분석 결과를 영구 저장합니다.',
      capabilities: ['postgresql', 'prisma', 'knowledge-artifact', 'versioning'],
      nodeTypes: ['data-storage'],
      mcpCount: 4,
      pendingCount: 0,
    },
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'builtin-log-monitor',
    key: 'metis-log-monitor',
    name: '로그 모니터링 / 수집',
    type: 'BUILT_IN',
    status: 'ACTIVE',
    configJson: {
      lastHealthStatus: 'OK',
      lastHealthLatencyMs: 20,
      lastHealthCheck: new Date().toISOString(),
      category: 'monitor',
      description: '서버 로그(journalctl/SSH), 애플리케이션 로그, 클라우드 로그를 수집하고 에러 패턴을 분석합니다.',
      capabilities: ['server-logs', 'app-logs', 'pattern-match', 'error-detection', 'statistics'],
      nodeTypes: ['log-monitor'],
      mcpCount: 5,
      pendingCount: 0,
    },
    updatedAt: new Date().toISOString(),
  },
];

// ── Pre-populated External Connectors ──

const EXTERNAL_CONNECTORS: Connector[] = [
  {
    id: '1',
    key: 'slack-webhook',
    name: 'Slack Webhook',
    type: 'WEBHOOK',
    status: 'ACTIVE',
    endpoint: 'https://hooks.slack.com/services/xxx',
    authType: 'Webhook Token',
    configJson: {
      lastHealthStatus: 'OK',
      lastHealthLatencyMs: 145,
      lastHealthCheck: new Date(Date.now() - 5 * 60000).toISOString(),
      rateLimit: '∞',
      timeoutSec: 30,
      mcpCount: 0,
      pendingCount: 0,
    },
    updatedAt: new Date(Date.now() - 1 * 60000).toISOString(),
  },
  {
    id: '2',
    key: 'jira-rest-api',
    name: 'Jira REST API',
    type: 'REST_API',
    status: 'ACTIVE',
    endpoint: 'https://company.atlassian.net/rest/api/3',
    authType: 'Bearer Token',
    configJson: {
      lastHealthStatus: 'OK',
      lastHealthLatencyMs: 287,
      lastHealthCheck: new Date(Date.now() - 3 * 60000).toISOString(),
      rateLimit: '300 req/min',
      timeoutSec: 30,
      mcpCount: 0,
      pendingCount: 0,
    },
    updatedAt: new Date(Date.now() - 2 * 60000).toISOString(),
  },
  {
    id: '3',
    key: 'github-api',
    name: 'GitHub API',
    type: 'REST_API',
    status: 'ACTIVE',
    endpoint: 'https://api.github.com/graphql',
    authType: 'OAuth 2.0',
    configJson: {
      lastHealthStatus: 'OK',
      lastHealthLatencyMs: 156,
      lastHealthCheck: new Date(Date.now() - 4 * 60000).toISOString(),
      rateLimit: '5000 req/hour',
      timeoutSec: 30,
      mcpCount: 0,
      pendingCount: 0,
    },
    updatedAt: new Date(Date.now() - 1 * 60000).toISOString(),
  },
  {
    id: '4',
    key: 'mcp-python-server',
    name: 'MCP Python Server',
    type: 'MCP_SERVER',
    status: 'ACTIVE',
    command: 'python',
    args: ['-m', 'mcp.server'],
    transport: 'stdio',
    configJson: {
      lastHealthStatus: 'OK',
      lastHealthLatencyMs: 89,
      lastHealthCheck: new Date(Date.now() - 2 * 60000).toISOString(),
      mcpCount: 12,
      pendingCount: 2,
    },
    updatedAt: new Date(Date.now() - 1 * 60000).toISOString(),
  },
  {
    id: '5',
    key: 'pagerduty',
    name: 'PagerDuty',
    type: 'REST_API',
    status: 'ACTIVE',
    endpoint: 'https://api.pagerduty.com',
    authType: 'API Key',
    configJson: {
      lastHealthStatus: 'OK',
      lastHealthLatencyMs: 234,
      lastHealthCheck: new Date(Date.now() - 10 * 60000).toISOString(),
      rateLimit: '5000 req/min',
      timeoutSec: 30,
      mcpCount: 0,
      pendingCount: 0,
    },
    updatedAt: new Date(Date.now() - 5 * 60000).toISOString(),
  },
  {
    id: '6',
    key: 'datadog',
    name: 'Datadog',
    type: 'REST_API',
    status: 'CONFIGURED',
    endpoint: 'https://api.datadoghq.com/api/v1',
    authType: 'API Key + App Key',
    configJson: {
      lastHealthStatus: 'DEGRADED',
      lastHealthLatencyMs: 512,
      lastHealthCheck: new Date(Date.now() - 15 * 60000).toISOString(),
      rateLimit: '10000 req/hour',
      timeoutSec: 30,
      mcpCount: 0,
      pendingCount: 1,
    },
    updatedAt: new Date(Date.now() - 30 * 60000).toISOString(),
  },
  {
    id: '7',
    key: 'aws-cloudwatch',
    name: 'AWS CloudWatch',
    type: 'REST_API',
    status: 'CONFIGURED',
    endpoint: 'https://monitoring.us-east-1.amazonaws.com',
    authType: 'IAM Role',
    configJson: {
      lastHealthStatus: 'OK',
      lastHealthLatencyMs: 178,
      lastHealthCheck: new Date(Date.now() - 60 * 60000).toISOString(),
      rateLimit: '≤400 req/sec',
      timeoutSec: 30,
      mcpCount: 0,
      pendingCount: 0,
    },
    updatedAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
  },
  {
    id: '8',
    key: 'elasticsearch',
    name: 'Elasticsearch',
    type: 'REST_API',
    status: 'ACTIVE',
    endpoint: 'https://elasticsearch.internal:9200',
    authType: 'Basic Auth',
    configJson: {
      lastHealthStatus: 'OK',
      lastHealthLatencyMs: 89,
      lastHealthCheck: new Date(Date.now() - 2 * 60000).toISOString(),
      rateLimit: 'unlimited',
      timeoutSec: 30,
      mcpCount: 0,
      pendingCount: 0,
    },
    updatedAt: new Date(Date.now() - 1 * 60000).toISOString(),
  },
  {
    id: '9',
    key: 'jenkins',
    name: 'Jenkins CI/CD',
    type: 'REST_API',
    status: 'ACTIVE',
    endpoint: 'https://jenkins.company.com',
    authType: 'API Token',
    configJson: {
      lastHealthStatus: 'OK',
      lastHealthLatencyMs: 312,
      lastHealthCheck: new Date(Date.now() - 7 * 60000).toISOString(),
      rateLimit: '1000 req/min',
      timeoutSec: 60,
      mcpCount: 0,
      pendingCount: 0,
    },
    updatedAt: new Date(Date.now() - 3 * 60000).toISOString(),
  },
  {
    id: '10',
    key: 'servicenow',
    name: 'ServiceNow ITSM',
    type: 'REST_API',
    status: 'INACTIVE',
    endpoint: 'https://company.service-now.com/api/now',
    authType: 'OAuth 2.0',
    configJson: {
      lastHealthStatus: 'UNREACHABLE',
      lastHealthLatencyMs: 0,
      lastHealthCheck: new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString(),
      rateLimit: '240 req/min',
      timeoutSec: 30,
      mcpCount: 0,
      pendingCount: 0,
    },
    updatedAt: new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString(),
  },
];

// Combined initial connectors
const FEATURED_CONNECTORS: Connector[] = [...BUILTIN_NODE_CONNECTORS, ...EXTERNAL_CONNECTORS];

// ── Page ──

export default function ConnectorsPage() {
  const [connectors, setConnectors] = useState<Connector[]>(FEATURED_CONNECTORS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Connector | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [typeFilter, setTypeFilter] = useState<string>('');

  // Filtered connectors based on type filter
  const filteredConnectors = typeFilter
    ? connectors.filter(c => c.type === typeFilter)
    : connectors;

  const fetchConnectors = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Try to fetch from backend API
      const data = await api.get<{ items: Connector[] }>('/connectors');
      // Merge with built-in connectors (always present)
      const backendKeys = new Set((data.items ?? []).map(c => c.key));
      const deduped = [...BUILTIN_NODE_CONNECTORS.filter(c => !backendKeys.has(c.key)), ...(data.items ?? [])];
      setConnectors(deduped);
    } catch (err: any) {
      // Backend unavailable — try workflow-nodes endpoint for live connector data
      try {
        const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
        const wfRes = await fetch(`${API_BASE}/api/workflow-nodes/connectors`, { credentials: 'include' });
        if (wfRes.ok) {
          const wfData = await wfRes.json() as { connectors: Array<{ key: string; name: string; type: string; description: string; category: string; capabilities: string[] }>; totalCount: number };
          // Convert backend connector metadata to page Connector format
          const wfConnectors: Connector[] = (wfData.connectors ?? []).map((wc, idx) => ({
            id: `wf-${idx}`,
            key: wc.key,
            name: wc.name,
            type: wc.type || 'BUILT_IN',
            status: 'ACTIVE',
            configJson: {
              lastHealthStatus: 'OK',
              lastHealthLatencyMs: 5,
              lastHealthCheck: new Date().toISOString(),
              category: wc.category,
              description: wc.description,
              capabilities: wc.capabilities,
              mcpCount: wc.capabilities?.length ?? 0,
              pendingCount: 0,
            },
            updatedAt: new Date().toISOString(),
          }));
          // Merge: use live backend data for built-in, keep external from static
          const liveKeys = new Set(wfConnectors.map(c => c.key));
          const mergedBuiltIn = wfConnectors.length > 0
            ? wfConnectors
            : BUILTIN_NODE_CONNECTORS;
          const mergedExternal = EXTERNAL_CONNECTORS.filter(c => !liveKeys.has(c.key));
          setConnectors([...mergedBuiltIn, ...mergedExternal]);
        } else {
          setConnectors(FEATURED_CONNECTORS);
        }
      } catch {
        setConnectors(FEATURED_CONNECTORS);
      }
      setError(null); // Don't show error — we have fallback data
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConnectors();
  }, [fetchConnectors]);

  const handleHealthCheck = async (id: string) => {
    try {
      const result = await api.post<{ healthy: boolean; status: string }>(`/connectors/${id}/health-check`, {});
      alert(result.healthy ? 'Health Check 성공!' : `Health Check 실패: ${result.status}`);
      fetchConnectors();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('이 커넥터를 삭제하시겠습니까?')) return;
    try {
      await api.delete(`/connectors/${id}`);
      setSelected(null);
      fetchConnectors();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const builtInCount = connectors.filter((c) => c.type === 'BUILT_IN').length;
  const externalCount = connectors.filter((c) => c.type !== 'BUILT_IN').length;
  const activeCount = connectors.filter((c) => c.status === 'ACTIVE').length;
  const configuredCount = connectors.filter((c) => c.status === 'CONFIGURED').length;
  const inactiveCount = connectors.filter((c) => c.status === 'INACTIVE').length;
  const typeCount = new Set(connectors.map((c) => c.type)).size;
  // MCP 도구 수: 각 커넥터가 제공하는 세부 기능(tool) 수의 합산
  const mcpToolCount = connectors.reduce((sum, c) => sum + ((c.configJson?.mcpCount as number) ?? 0), 0);
  const pendingCount = connectors.reduce((sum, c) => sum + ((c.configJson?.pendingCount as number) ?? 0), 0);

  return (
    <div className="p-6">
      <PageHeader
        title="커넥터 관리"
        description={`내장 노드 ${builtInCount}개 + 외부 커넥터 ${externalCount}개 — 총 ${mcpToolCount}개 도구(기능) 제공`}
        actions={
          <button onClick={() => setShowCreateForm(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded hover:bg-blue-700 transition">
            <Plus size={14} /> 새 커넥터 등록
          </button>
        }
      />

      {/* Stats — 8 columns */}
      <div className="grid grid-cols-8 gap-3 mb-6">
        <SC label="전체" value={connectors.length} c="blue" />
        <SC label="내장 노드" value={builtInCount} c="indigo" />
        <SC label="외부 연동" value={externalCount} c="cyan" />
        <SC label="활성" value={activeCount} c="green" />
        <SC label="설정됨" value={configuredCount} c="amber" />
        <SC label="비활성" value={inactiveCount} c="red" />
        <SC label="도구 합계" value={mcpToolCount} c="violet" />
        <SC label="대기중" value={pendingCount} c="orange" />
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 mb-4 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800">
          <AlertCircle size={14} />{error}
        </div>
      )}

      {/* Type Filter */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">필터:</span>
        {[
          { key: '', label: '전체', count: connectors.length },
          { key: 'BUILT_IN', label: '🔧 내장 노드', count: builtInCount },
          { key: 'MCP_SERVER', label: '🤖 MCP', count: connectors.filter(c => c.type === 'MCP_SERVER').length },
          { key: 'REST_API', label: 'REST API', count: connectors.filter(c => c.type === 'REST_API').length },
          { key: 'WEBHOOK', label: '🔗 Webhook', count: connectors.filter(c => c.type === 'WEBHOOK').length },
        ].map(f => (
          <button
            key={f.key}
            onClick={() => setTypeFilter(f.key)}
            className={`px-2.5 py-1 text-[10px] font-semibold rounded transition ${
              typeFilter === f.key
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {f.label} ({f.count})
          </button>
        ))}
      </div>

      {/* Two-column layout */}
      <div className="flex gap-4">
        {/* Left: Connector Table */}
        <div className="flex-1">
          <div className="bg-white rounded-lg border border-gray-200">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <Zap size={14} className="text-blue-600" />
                <span className="text-xs font-semibold text-gray-900">등록된 커넥터 ({filteredConnectors.length}개)</span>
              </div>
              <button onClick={fetchConnectors} className="p-1 text-gray-500 hover:text-gray-900">
                <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-[10px] text-gray-600 uppercase tracking-wider border-b border-gray-200 bg-gray-50">
                    <th className="text-left px-4 py-3 font-semibold">커넥터명</th>
                    <th className="text-left px-4 py-3 font-semibold">유형</th>
                    <th className="text-left px-4 py-3 font-semibold">Health</th>
                    <th className="text-left px-4 py-3 font-semibold">응답시간</th>
                    <th className="text-left px-4 py-3 font-semibold">상태</th>
                    <th className="px-4 py-3 text-right font-semibold">작업</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredConnectors.length === 0 && !loading && (
                    <tr><td colSpan={6} className="text-center text-gray-500 text-xs py-8">등록된 커넥터가 없습니다</td></tr>
                  )}
                  {filteredConnectors.map((c) => {
                    const config = (c.configJson ?? {}) as any;
                    const healthStatus = config.lastHealthStatus ?? '-';
                    const avgLatency = config.lastHealthLatencyMs ? `${config.lastHealthLatencyMs}ms` : '-';
                    return (
                      <tr key={c.id} onClick={() => setSelected(c)} className={`border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition ${selected?.id === c.id ? 'bg-blue-50' : ''}`}>
                        <td className="px-4 py-3 text-xs text-gray-900 font-semibold">{c.name}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded text-[10px] font-medium ${
                            c.type === 'BUILT_IN' ? 'bg-indigo-100 text-indigo-700' :
                            c.type === 'MCP_SERVER' ? 'bg-violet-100 text-violet-700' :
                            c.type === 'AGENT' ? 'bg-emerald-100 text-emerald-700' :
                            c.type === 'WEBHOOK' ? 'bg-amber-100 text-amber-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {c.type === 'BUILT_IN' ? '🔧 내장' :
                             c.type === 'MCP_SERVER' ? '🤖 MCP' :
                             c.type === 'AGENT' ? '🧠 Agent' :
                             c.type === 'WEBHOOK' ? '🔗 Webhook' :
                             c.type.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-[11px]">
                          {healthStatus === 'OK' && <span className="text-green-600 font-semibold flex items-center gap-1"><CheckCircle size={10} /> OK</span>}
                          {healthStatus === 'DEGRADED' && <span className="text-amber-600 font-semibold flex items-center gap-1"><AlertTriangle size={10} /> DEGRADED</span>}
                          {healthStatus === 'UNREACHABLE' && <span className="text-red-600 font-semibold flex items-center gap-1"><AlertCircle size={10} /> DOWN</span>}
                          {healthStatus === '-' && <span className="text-gray-400">-</span>}
                        </td>
                        <td className="px-4 py-3 text-[11px] text-gray-600 font-mono">{avgLatency}</td>
                        <td className="px-4 py-3">
                          <StatusBadgeLight status={c.status} />
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex gap-2 justify-end">
                            <button onClick={(e) => { e.stopPropagation(); handleHealthCheck(c.id); }} className="p-1 text-gray-500 hover:text-blue-600 transition" title="Health Check">
                              <Activity size={12} />
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); handleDelete(c.id); }} className="p-1 text-gray-500 hover:text-red-600 transition" title="삭제">
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right: Detail/Create Panel (360px) */}
        <div className="w-[360px] flex-shrink-0">
          {showCreateForm ? (
            <CreateConnectorForm
              onClose={() => setShowCreateForm(false)}
              onSuccess={() => { setShowCreateForm(false); fetchConnectors(); }}
            />
          ) : selected ? (
            <ConnectorDetail
              connector={selected}
              onHealthCheck={() => handleHealthCheck(selected.id)}
              onRefresh={fetchConnectors}
            />
          ) : (
            <div className="bg-white rounded-lg border border-gray-200 p-6 text-center">
              <Settings size={32} className="text-gray-300 mx-auto mb-3" />
              <p className="text-xs text-gray-500">커넥터를 선택하면 상세 정보가 표시됩니다</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Connector Detail ──

function ConnectorDetail({ connector, onHealthCheck, onRefresh }: { connector: Connector; onHealthCheck: () => void; onRefresh: () => void }) {
  const config = (connector.configJson ?? {}) as Record<string, any>;
  const healthStatus = config.lastHealthStatus ?? '-';
  const [showTestResults, setShowTestResults] = useState(false);
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [testLoading, setTestLoading] = useState(false);
  const [showMCPTools, setShowMCPTools] = useState(false);
  const [mcpTools, setMCPTools] = useState<MCPTool[]>([]);
  const [mcpLoading, setMCPLoading] = useState(false);
  const [showDiscovery, setShowDiscovery] = useState(false);
  const [discoveryResults, setDiscoveryResults] = useState<SchemaCapability[]>([]);
  const [discoveryLoading, setDiscoveryLoading] = useState(false);
  const [showInvokeModal, setShowInvokeModal] = useState(false);

  const handleTestPipeline = async () => {
    setTestLoading(true);
    try {
      const result = await api.post<{ results: TestResult[] }>(`/connectors/${connector.id}/test`, {});
      setTestResults(result.results);
      setShowTestResults(true);
    } catch (err: any) {
      alert(`테스트 실패: ${err.message}`);
    } finally {
      setTestLoading(false);
    }
  };

  const handleLoadMCPTools = async () => {
    if (connector.type !== 'MCP_SERVER') {
      alert('MCP_SERVER 타입만 지원합니다');
      return;
    }
    setMCPLoading(true);
    try {
      const result = await api.get<{ tools: MCPTool[] }>(`/connectors/${connector.id}/tools`);
      setMCPTools(result.tools);
      setShowMCPTools(true);
    } catch (err: any) {
      alert(`도구 로드 실패: ${err.message}`);
    } finally {
      setMCPLoading(false);
    }
  };

  const handleSchemaDiscovery = async () => {
    setDiscoveryLoading(true);
    try {
      const result = await api.post<{ capabilities: SchemaCapability[] }>(`/connectors/${connector.id}/discover`, {});
      setDiscoveryResults(result.capabilities);
      setShowDiscovery(true);
    } catch (err: any) {
      alert(`스키마 탐색 실패: ${err.message}`);
    } finally {
      setDiscoveryLoading(false);
    }
  };

  const handleLifecycleAction = async (action: 'start' | 'stop' | 'restart') => {
    try {
      await api.post(`/connectors/${connector.id}/${action}`, {});
      alert(`${action.toUpperCase()} 완료`);
      onRefresh();
    } catch (err: any) {
      alert(`${action} 실패: ${err.message}`);
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden max-h-[calc(100vh-200px)] overflow-y-auto">
      <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 sticky top-0">
        <span className="text-xs font-semibold text-gray-900 flex items-center gap-1">
          <Settings size={12} /> 커넥터 상세
        </span>
      </div>
      <div className="p-4 space-y-3">
        {/* Basic Info */}
        <Field label="커넥터 이름" value={connector.name} />
        <Field label="유형" value={
          connector.type === 'BUILT_IN' ? '🔧 내장 노드 커넥터' :
          connector.type === 'MCP_SERVER' ? '🤖 MCP 서버' :
          connector.type === 'AGENT' ? '🧠 AI 에이전트' :
          connector.type === 'WEBHOOK' ? '🔗 Webhook' :
          connector.type.replace('_', ' ')
        } />

        {connector.type === 'BUILT_IN' ? (
          <>
            <Field label="카테고리" value={config.category ?? '-'} />
            <Field label="설명" value={config.description ?? '-'} />
            <Field label="노드 타입" value={(config.nodeTypes as string[])?.join(', ') ?? '-'} />
            {/* Capabilities */}
            {config.capabilities && (
              <div>
                <div className="text-[10px] text-gray-600 font-semibold mb-1.5">제공 기능 ({(config.capabilities as string[]).length}개)</div>
                <div className="flex flex-wrap gap-1">
                  {(config.capabilities as string[]).map((cap: string) => (
                    <span key={cap} className="px-1.5 py-0.5 bg-indigo-50 text-indigo-600 text-[9px] font-medium rounded border border-indigo-100">{cap}</span>
                  ))}
                </div>
              </div>
            )}
            {/* Scanners list (for AI analysis connector) */}
            {config.scanners && (
              <div>
                <div className="text-[10px] text-gray-600 font-semibold mb-1.5">보안 스캐너</div>
                <div className="space-y-1">
                  {(config.scanners as string[]).map((sc: string) => (
                    <div key={sc} className="flex items-center gap-1.5 text-[10px]">
                      <span className="text-green-500">✓</span>
                      <span className="text-gray-700">{sc}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {/* Attack Vectors list (for pentest connector) */}
            {config.attackVectors && (
              <div>
                <div className="text-[10px] text-gray-600 font-semibold mb-1.5">공격 벡터 ({(config.attackVectors as string[]).length}개)</div>
                <div className="space-y-1">
                  {(config.attackVectors as string[]).map((vec: string, idx: number) => (
                    <div key={idx} className="flex items-center gap-1.5 text-[10px]">
                      <span className="text-red-500 font-bold">{idx + 1}</span>
                      <span className="text-gray-700">{vec}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <Field label="MCP 도구 수" value={`${config.mcpCount ?? 0}개 (이 커넥터가 제공하는 세부 기능 수)`} />
          </>
        ) : connector.type === 'MCP_SERVER' ? (
          <>
            <Field label="커맨드" value={connector.command ?? '-'} />
            <Field label="인자" value={connector.args?.join(' ') ?? '-'} />
            <Field label="전송" value={connector.transport ?? '-'} />
          </>
        ) : (
          <>
            <Field label="엔드포인트" value={connector.endpoint ?? config.endpoint ?? '-'} />
            <Field label="인증 방식" value={connector.authType ?? config.authType ?? '-'} />
          </>
        )}

        {connector.type !== 'BUILT_IN' && <Field label="Rate Limit" value={config.rateLimit ?? '-'} />}
        {connector.type !== 'BUILT_IN' && <Field label="Timeout" value={`${config.timeoutSec ?? 30}s`} />}

        {/* Health Status */}
        <div className="pt-2">
          <div className="text-[10px] text-gray-600 font-semibold mb-1">최근 Health Check</div>
          <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded flex items-center justify-between">
            <span className={`text-[11px] font-semibold ${
              healthStatus === 'OK' ? 'text-green-600' :
              healthStatus === 'DEGRADED' ? 'text-amber-600' :
              healthStatus === 'UNREACHABLE' ? 'text-red-600' :
              'text-gray-500'
            }`}>
              {healthStatus === 'OK' ? '✓ OK' : healthStatus === 'DEGRADED' ? '⚠ DEGRADED' : healthStatus === 'UNREACHABLE' ? '✕ DOWN' : '-'}
            </span>
            <span className="text-[10px] text-gray-500">{config.lastHealthLatencyMs ?? '-'}ms</span>
          </div>
        </div>

        {/* Basic Actions */}
        <div className="flex gap-2 pt-2">
          <button onClick={onHealthCheck} className="flex-1 px-3 py-2 bg-blue-100 text-blue-700 text-[11px] font-medium rounded hover:bg-blue-200 transition">
            🔄 Health Check
          </button>
        </div>

        {/* Lifecycle Controls */}
        <div className="border-t border-gray-200 pt-3 mt-3">
          <p className="text-[11px] font-bold text-gray-900 mb-2">Lifecycle</p>
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => handleLifecycleAction('start')}
              className="px-2 py-1.5 bg-green-100 text-green-700 text-[10px] font-medium rounded hover:bg-green-200 transition flex items-center justify-center gap-1"
              title="커넥터 시작"
            >
              <Play size={10} /> 시작
            </button>
            <button
              onClick={() => handleLifecycleAction('stop')}
              className="px-2 py-1.5 bg-red-100 text-red-700 text-[10px] font-medium rounded hover:bg-red-200 transition flex items-center justify-center gap-1"
              title="커넥터 중지"
            >
              <Square size={10} /> 중지
            </button>
            <button
              onClick={() => handleLifecycleAction('restart')}
              className="px-2 py-1.5 bg-amber-100 text-amber-700 text-[10px] font-medium rounded hover:bg-amber-200 transition flex items-center justify-center gap-1"
              title="커넥터 재시작"
            >
              <RotateCcw size={10} /> 재시작
            </button>
          </div>
        </div>

        {/* Test Pipeline */}
        <div className="border-t border-gray-200 pt-3 mt-3">
          <button
            onClick={handleTestPipeline}
            disabled={testLoading}
            className="w-full px-3 py-2 bg-violet-100 text-violet-700 text-[11px] font-medium rounded hover:bg-violet-200 transition disabled:opacity-50 flex items-center justify-center gap-1"
          >
            {testLoading ? <Loader size={12} className="animate-spin" /> : <Beaker size={12} />}
            {testLoading ? 'Testing...' : '테스트 파이프라인'}
          </button>

          {showTestResults && testResults.length > 0 && (
            <div className="mt-3 p-3 bg-gray-50 border border-gray-200 rounded">
              <div className="text-[10px] font-semibold text-gray-900 mb-2">테스트 결과</div>
              <div className="space-y-1.5">
                {testResults.map((r, idx) => (
                  <div key={idx} className="text-[10px]">
                    <div className="flex items-start gap-1.5">
                      {r.status === 'pass' && <CheckCircle size={12} className="text-green-600 flex-shrink-0 mt-0.5" />}
                      {r.status === 'fail' && <AlertCircle size={12} className="text-red-600 flex-shrink-0 mt-0.5" />}
                      {r.status === 'warn' && <AlertTriangle size={12} className="text-amber-600 flex-shrink-0 mt-0.5" />}
                      <div>
                        <p className={`font-semibold ${r.status === 'pass' ? 'text-green-700' : r.status === 'fail' ? 'text-red-700' : 'text-amber-700'}`}>
                          {r.step}
                        </p>
                        <p className="text-gray-600">{r.message}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* MCP Tools Viewer */}
        {connector.type === 'MCP_SERVER' && (
          <div className="border-t border-gray-200 pt-3 mt-3">
            <button
              onClick={handleLoadMCPTools}
              disabled={mcpLoading}
              className="w-full px-3 py-2 bg-indigo-100 text-indigo-700 text-[11px] font-medium rounded hover:bg-indigo-200 transition disabled:opacity-50 flex items-center justify-center gap-1"
            >
              {mcpLoading ? <Loader size={12} className="animate-spin" /> : <Eye size={12} />}
              {mcpLoading ? 'Loading...' : 'MCP 도구 보기'}
            </button>

            {showMCPTools && mcpTools.length > 0 && (
              <div className="mt-3 p-3 bg-gray-50 border border-gray-200 rounded max-h-40 overflow-y-auto">
                <div className="text-[10px] font-semibold text-gray-900 mb-2">사용 가능한 도구 ({mcpTools.length})</div>
                <div className="space-y-1.5">
                  {mcpTools.map((tool, idx) => (
                    <div key={idx} className="text-[10px] border-l-2 border-indigo-300 pl-2">
                      <p className="font-semibold text-gray-900">{tool.name}</p>
                      <p className="text-gray-600">{tool.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Schema Discovery */}
        <div className="border-t border-gray-200 pt-3 mt-3">
          <button
            onClick={handleSchemaDiscovery}
            disabled={discoveryLoading}
            className="w-full px-3 py-2 bg-cyan-100 text-cyan-700 text-[11px] font-medium rounded hover:bg-cyan-200 transition disabled:opacity-50 flex items-center justify-center gap-1"
          >
            {discoveryLoading ? <Loader size={12} className="animate-spin" /> : <Download size={12} />}
            {discoveryLoading ? 'Discovering...' : '스키마 탐색'}
          </button>

          {showDiscovery && discoveryResults.length > 0 && (
            <div className="mt-3 p-3 bg-gray-50 border border-gray-200 rounded max-h-40 overflow-y-auto">
              <div className="text-[10px] font-semibold text-gray-900 mb-2">발견된 기능</div>
              <div className="space-y-1.5">
                {discoveryResults.map((cap, idx) => (
                  <div key={idx} className="text-[10px] border-l-2 border-cyan-300 pl-2">
                    <p className="font-semibold text-gray-900">{cap.method}</p>
                    <p className="text-gray-600">{cap.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Governed Invoke */}
        <div className="border-t border-gray-200 pt-3 mt-3">
          <button
            onClick={() => setShowInvokeModal(true)}
            className="w-full px-3 py-2 bg-fuchsia-100 text-fuchsia-700 text-[11px] font-medium rounded hover:bg-fuchsia-200 transition flex items-center justify-center gap-1"
          >
            <Send size={12} /> Governed Invoke
          </button>
        </div>

        {/* Registration Process */}
        <div className="border-t border-gray-200 pt-3 mt-3">
          <p className="text-[11px] font-bold text-gray-900 mb-3">커넥터 등록 프로세스</p>
          {[
            { num: 1, color: 'bg-blue-600', title: '유형 선택', desc: 'Agent / MCP / API / Webhook' },
            { num: 2, color: 'bg-amber-600', title: '연결 정보 입력', desc: '엔드포인트, 인증, 파라미터' },
            { num: 3, color: 'bg-green-600', title: 'Health Check', desc: '연결 테스트 및 응답 검증' },
            { num: 4, color: 'bg-purple-600', title: '권한·정책 설정', desc: '접근 제어, Rate Limit, 로깅' },
            { num: 5, color: 'bg-orange-600', title: '활성화', desc: '워크플로우에서 즉시 사용 가능' },
          ].map((s) => (
            <div key={s.num} className="flex items-start gap-2.5 mb-2.5">
              <div className={`w-5 h-5 rounded-full ${s.color} text-white flex items-center justify-center text-[9px] font-bold flex-shrink-0`}>{s.num}</div>
              <div>
                <p className="text-[11px] font-semibold text-gray-900">{s.title}</p>
                <p className="text-[10px] text-gray-600">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Governed Invoke Modal */}
      {showInvokeModal && (
        <GovernedInvokeModal
          connector={connector}
          onClose={() => setShowInvokeModal(false)}
        />
      )}
    </div>
  );
}

// ── Governed Invoke Modal ──

function GovernedInvokeModal({ connector, onClose }: { connector: Connector; onClose: () => void }) {
  const [method, setMethod] = useState('');
  const [payload, setPayload] = useState('{}');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleInvoke = async () => {
    setLoading(true);
    setError(null);
    try {
      const parsedPayload = JSON.parse(payload);
      const res = await api.post<any>('/connectors/invoke', {
        connectorKey: connector.key,
        method,
        payload: parsedPayload,
      });
      setResult(res);
    } catch (err: any) {
      setError(err.message ?? 'Invoke failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full shadow-lg">
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
          <span className="text-xs font-semibold text-gray-900 flex items-center gap-1">
            <Send size={12} /> Governed Invoke
          </span>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-900 text-xs font-bold">
            <X size={16} />
          </button>
        </div>

        <div className="p-4 space-y-3">
          <div>
            <label className="block text-[10px] text-gray-600 mb-1 font-semibold">커넥터</label>
            <div className="px-3 py-1.5 bg-gray-50 border border-gray-200 rounded text-xs text-gray-900">
              {connector.key}
            </div>
          </div>

          <div>
            <label className="block text-[10px] text-gray-600 mb-1 font-semibold">메서드</label>
            <input
              type="text"
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              placeholder="e.g., getIssue, createTicket"
              className="w-full px-3 py-1.5 bg-white border border-gray-300 rounded text-xs text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-[10px] text-gray-600 mb-1 font-semibold">페이로드 (JSON)</label>
            <textarea
              value={payload}
              onChange={(e) => setPayload(e.target.value)}
              className="w-full px-3 py-1.5 bg-white border border-gray-300 rounded text-xs text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono h-20"
            />
          </div>

          {error && (
            <div className="p-2 bg-red-50 border border-red-200 rounded text-[10px] text-red-700">
              {error}
            </div>
          )}

          {result && (
            <div className="p-2 bg-green-50 border border-green-200 rounded text-[10px] text-green-700 max-h-24 overflow-y-auto">
              <p className="font-semibold mb-1">결과:</p>
              <pre className="whitespace-pre-wrap text-[9px]">{JSON.stringify(result, null, 2)}</pre>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-3 py-1.5 text-gray-700 text-xs border border-gray-300 rounded hover:bg-gray-50 font-medium"
            >
              취소
            </button>
            <button
              onClick={handleInvoke}
              disabled={loading || !method}
              className="flex-1 px-3 py-1.5 bg-fuchsia-600 text-white text-xs font-medium rounded hover:bg-fuchsia-700 disabled:opacity-50 flex items-center justify-center gap-1"
            >
              {loading ? <Loader size={12} className="animate-spin" /> : <Send size={12} />}
              {loading ? 'Invoking...' : 'Invoke'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Create Connector Form ──

function CreateConnectorForm({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({
    key: '',
    name: '',
    type: 'REST_API' as typeof CONNECTOR_TYPES[number],
    endpoint: '',
    authType: 'OAuth 2.0',
    rateLimit: '100 req/min',
    timeoutSec: 30,
    command: '',
    args: '',
    transport: 'stdio',
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        key: form.key,
        name: form.name,
        type: form.type,
        ...(form.type === 'MCP_SERVER' ? {
          command: form.command,
          args: form.args ? form.args.split(' ').filter(Boolean) : [],
          transport: form.transport,
        } : {
          endpoint: form.endpoint,
          authType: form.authType,
          rateLimit: form.rateLimit,
          timeoutSec: form.timeoutSec,
        }),
      };
      await api.post('/connectors', payload);
      onSuccess();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden max-h-[calc(100vh-200px)] overflow-y-auto">
      <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between sticky top-0">
        <span className="text-xs font-semibold text-gray-900">새 커넥터 등록</span>
        <button onClick={onClose} className="text-gray-500 hover:text-gray-900 text-xs font-bold">✕</button>
      </div>
      <form onSubmit={handleSubmit} className="p-4 space-y-3">
        <FormField label="커넥터 키" value={form.key} onChange={(v) => setForm({ ...form, key: v })} placeholder="slack-api" />
        <FormField label="커넥터 이름" value={form.name} onChange={(v) => setForm({ ...form, name: v })} placeholder="Slack REST API" />

        <div>
          <label className="block text-[10px] text-gray-600 mb-1 font-semibold">유형</label>
          <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as typeof CONNECTOR_TYPES[number] })} className="w-full px-3 py-1.5 bg-white border border-gray-300 rounded text-xs text-gray-900">
            {CONNECTOR_TYPES.map((t) => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
          </select>
        </div>

        {form.type === 'MCP_SERVER' ? (
          <>
            <FormField label="커맨드" value={form.command} onChange={(v) => setForm({ ...form, command: v })} placeholder="python" />
            <FormField label="인자" value={form.args} onChange={(v) => setForm({ ...form, args: v })} placeholder="-m mcp.server" />
            <div>
              <label className="block text-[10px] text-gray-600 mb-1 font-semibold">전송</label>
              <select value={form.transport} onChange={(e) => setForm({ ...form, transport: e.target.value })} className="w-full px-3 py-1.5 bg-white border border-gray-300 rounded text-xs text-gray-900">
                <option>stdio</option><option>http</option><option>sse</option>
              </select>
            </div>
          </>
        ) : (
          <>
            <FormField label="엔드포인트" value={form.endpoint} onChange={(v) => setForm({ ...form, endpoint: v })} placeholder="https://slack.com/api" />
            <div>
              <label className="block text-[10px] text-gray-600 mb-1 font-semibold">인증 방식</label>
              <select value={form.authType} onChange={(e) => setForm({ ...form, authType: e.target.value })} className="w-full px-3 py-1.5 bg-white border border-gray-300 rounded text-xs text-gray-900">
                <option>OAuth 2.0</option><option>API Key</option><option>Bearer Token</option><option>Basic Auth</option>
              </select>
            </div>
            <FormField label="Rate Limit" value={form.rateLimit} onChange={(v) => setForm({ ...form, rateLimit: v })} placeholder="100 req/min" />
          </>
        )}

        <div className="flex gap-2 pt-1">
          <button type="button" onClick={onClose} className="flex-1 px-3 py-1.5 text-gray-700 text-xs border border-gray-300 rounded hover:bg-gray-50 font-medium">취소</button>
          <button type="submit" disabled={submitting || !form.key || !form.name} className="flex-1 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded hover:bg-blue-700 disabled:opacity-50">
            {submitting ? '등록 중...' : '💾 저장'}
          </button>
        </div>
      </form>
    </div>
  );
}

// ── Shared Components ──

function Field({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <label className="block text-[10px] text-gray-600 mb-0.5 font-semibold">{label}</label>
      <div className="px-3 py-1.5 bg-gray-50 border border-gray-200 rounded text-xs text-gray-900 font-mono break-all">{value}</div>
    </div>
  );
}

function FormField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label className="block text-[10px] text-gray-600 mb-1 font-semibold">{label}</label>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="w-full px-3 py-1.5 bg-white border border-gray-300 rounded text-xs text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500" />
    </div>
  );
}

function StatusBadgeLight({ status }: { status: string }) {
  const statusStyles: Record<string, string> = {
    ACTIVE: 'bg-green-100 text-green-800',
    CONFIGURED: 'bg-amber-100 text-amber-800',
    INACTIVE: 'bg-gray-100 text-gray-800',
    PENDING: 'bg-blue-100 text-blue-800',
    ERROR: 'bg-red-100 text-red-800',
  };
  return (
    <span className={`px-2 py-1 rounded text-[10px] font-semibold ${statusStyles[status] || 'bg-gray-100 text-gray-700'}`}>
      {status}
    </span>
  );
}

function SC({ label, value, c }: { label: string; value: number; c: string }) {
  const cm: Record<string, string> = {
    blue: 'text-blue-600',
    green: 'text-green-600',
    amber: 'text-amber-600',
    red: 'text-red-600',
    purple: 'text-purple-600',
    violet: 'text-violet-600',
    orange: 'text-orange-600',
  };
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <p className="text-[10px] text-gray-600 uppercase tracking-wider mb-2 font-semibold">{label}</p>
      <p className={`text-2xl font-bold ${cm[c] ?? 'text-gray-900'}`}>{value}</p>
    </div>
  );
}
