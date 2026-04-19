'use client';

import { useState, useEffect } from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import { api } from '@/lib/api-client';

// Tab component
interface TabItem {
  id: string;
  label: string;
  icon?: string;
}

interface PolicyItem {
  id: string;
  label: string;
  status: 'applied' | 'reviewing' | 'not-applied';
}

interface AuditLogEntry {
  id: string;
  time: string;
  user: string;
  action: string;
  actionType: 'execution' | 'deployment' | 'config' | 'alert';
  target: string;
  result: string;
  resultStatus: 'success' | 'timeout';
  ip?: string;
}

interface ReviewBoardEntry {
  id: string;
  reviewId: string;
  agentName: string;
  agentType: string;
  reviewer: string;
  requestDate: string;
  status: 'reviewing' | 'approved';
}

interface CacheNamespace {
  id: string;
  namespace: string;
  entries: number;
  hitRate: number;
  ttlPolicy: string;
  status: 'active';
}

interface SkillItem {
  id: string;
  skillId: string;
  name: string;
  tier: string;
  callCount: number;
  status: 'active';
}

interface AgentOptimization {
  id: string;
  agentName: string;
  status: 'operating' | 'reviewing';
  gate1: boolean;
  gate2: boolean;
  gate3: boolean;
  allowedTiers: string;
  namespace: string;
  dailyLimit: string;
  todayUsed: string;
  savings: string;
  reviewId?: string;
}

const TABS: TabItem[] = [
  { id: 'governance', label: '거버넌스 정책' },
  { id: 'finops', label: '💰 FinOps Token 최적화' },
  { id: 'audit', label: '감사 로그' },
  { id: 'review', label: 'Review Board' },
];

const SECURITY_POLICIES: PolicyItem[] = [
  { id: 'sec-1', label: 'Agent 실행 권한 분리', status: 'applied' },
  { id: 'sec-2', label: '민감정보 마스킹', status: 'applied' },
  { id: 'sec-3', label: '실행 이력 암호화', status: 'reviewing' },
];

const QUALITY_POLICIES: PolicyItem[] = [
  { id: 'qual-1', label: 'Agent 출력 검증 필수', status: 'applied' },
  { id: 'qual-2', label: 'Evidence Pack 자동 생성', status: 'applied' },
  { id: 'qual-3', label: '코드 리뷰 필수', status: 'applied' },
];

const OPERATIONAL_POLICIES: PolicyItem[] = [
  { id: 'op-1', label: 'Agent 버전 관리', status: 'applied' },
  { id: 'op-2', label: '롤백 자동화', status: 'applied' },
  { id: 'op-3', label: 'SLA 위반 자동 알림', status: 'not-applied' },
];

const AUDIT_LOGS: AuditLogEntry[] = [
  { id: 'log-1', time: '09:15:32', user: '홍길동', action: '실행', actionType: 'execution', target: 'DB 백업 Agent', result: '성공', resultStatus: 'success', ip: '10.0.1.52' },
  { id: 'log-2', time: '09:10:15', user: '김개발', action: '배포', actionType: 'deployment', target: '코드 리뷰 Agent v2.1', result: '성공', resultStatus: 'success', ip: '10.0.2.31' },
  { id: 'log-3', time: '08:55:42', user: '이운영', action: '설정변경', actionType: 'config', target: '성능 모니터링 Agent', result: '성공', resultStatus: 'success', ip: '10.0.1.88' },
  { id: 'log-4', time: '08:42:18', user: '시스템', action: '알림', actionType: 'alert', target: 'PagerDuty API', result: 'Timeout', resultStatus: 'timeout' },
  { id: 'log-5', time: '08:30:00', user: 'Scheduler', action: '실행', actionType: 'execution', target: '일일 리포트 Agent', result: '성공', resultStatus: 'success' },
];

const REVIEW_BOARD: ReviewBoardEntry[] = [
  { id: 'rv-1', reviewId: 'RV-042', agentName: '신규 배포 자동화 Agent', agentType: '신규 등록', reviewer: '김개발', requestDate: '2026-03-18', status: 'reviewing' },
  { id: 'rv-2', reviewId: 'RV-041', agentName: '성능 모니터링 Agent v3.0', agentType: '버전 업', reviewer: '이운영', requestDate: '2026-03-17', status: 'approved' },
  { id: 'rv-3', reviewId: 'RV-040', agentName: '보안 스캔 Agent', agentType: '권한 변경', reviewer: '박보안', requestDate: '2026-03-15', status: 'approved' },
];

const CACHE_NAMESPACES: CacheNamespace[] = [
  { id: 'ns-1', namespace: 'customer-service', entries: 1247, hitRate: 42.3, ttlPolicy: '24h', status: 'active' },
  { id: 'ns-2', namespace: 'dev-portal', entries: 834, hitRate: 31.5, ttlPolicy: '7d', status: 'active' },
  { id: 'ns-3', namespace: 'data-analytics', entries: 621, hitRate: 28.1, ttlPolicy: '1h', status: 'active' },
  { id: 'ns-4', namespace: 'internal-ops', entries: 412, hitRate: 45.7, ttlPolicy: '24h', status: 'active' },
];

const REGISTERED_SKILLS: SkillItem[] = [
  { id: 'skill-1', skillId: 'customer-faq', name: '고객 FAQ 처리', tier: 'Tier 1', callCount: 1247, status: 'active' },
  { id: 'skill-2', skillId: 'code-review', name: '코드 리뷰 분석', tier: 'Tier 2', callCount: 834, status: 'active' },
  { id: 'skill-3', skillId: 'data-analysis', name: '데이터 분석 리포트', tier: 'Tier 2', callCount: 621, status: 'active' },
  { id: 'skill-4', skillId: 'translation', name: '다국어 번역', tier: 'Tier 1', callCount: 412, status: 'active' },
  { id: 'skill-5', skillId: 'arch-design', name: '아키텍처 설계', tier: 'Tier 3', callCount: 89, status: 'active' },
];

const AGENT_OPTIMIZATIONS: AgentOptimization[] = [
  { id: 'ao-1', agentName: '장애분석 Agent', status: 'operating', gate1: true, gate2: true, gate3: true, allowedTiers: '2,3', namespace: 'ops-incident', dailyLimit: '$10', todayUsed: '$3.20', savings: '$8.40' },
  { id: 'ao-2', agentName: '코드 리뷰 Agent', status: 'operating', gate1: true, gate2: true, gate3: true, allowedTiers: '1,2,3', namespace: 'dev-portal', dailyLimit: '$15', todayUsed: '$2.10', savings: '$12.30' },
  { id: 'ao-3', agentName: 'DB 백업 Agent', status: 'operating', gate1: true, gate2: true, gate3: false, allowedTiers: '1,2', namespace: 'internal-ops', dailyLimit: '$5', todayUsed: '$0.80', savings: '$4.20' },
  { id: 'ao-4', agentName: '성능 모니터링 Agent', status: 'operating', gate1: true, gate2: true, gate3: true, allowedTiers: '1,2', namespace: 'internal-ops', dailyLimit: '$8', todayUsed: '$1.50', savings: '$6.80' },
  { id: 'ao-5', agentName: '일일 리포트 Agent', status: 'operating', gate1: true, gate2: true, gate3: true, allowedTiers: '1,2,3', namespace: 'data-analytics', dailyLimit: '$12', todayUsed: '$1.90', savings: '$9.10' },
  { id: 'ao-6', agentName: '신규 배포 자동화 Agent', status: 'reviewing', gate1: false, gate2: false, gate3: false, allowedTiers: '—', namespace: '—', dailyLimit: '—', todayUsed: '—', savings: '—', reviewId: 'RV-042' },
];

function PolicyCard({ title, icon, items, onChange }: { title: string; icon: string; items: PolicyItem[]; onChange: (id: string, status: PolicyItem['status']) => void }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <h3 className="text-sm font-semibold text-gray-900 mb-4">{icon} {title}</h3>
      <div className="space-y-3">
        {items.map(item => (
          <div key={item.id} className="flex items-center justify-between p-3 bg-gray-50 rounded">
            <span className="text-sm text-gray-700">{item.label}</span>
            <button
              onClick={() => {
                const statuses: PolicyItem['status'][] = ['applied', 'reviewing', 'not-applied'];
                const currentIndex = statuses.indexOf(item.status);
                const nextStatus = statuses[(currentIndex + 1) % statuses.length];
                onChange(item.id, nextStatus);
              }}
              className={`px-3 py-1 text-xs font-semibold rounded-full ${
                item.status === 'applied' ? 'bg-green-100 text-green-700' :
                item.status === 'reviewing' ? 'bg-yellow-100 text-yellow-700' :
                'bg-red-100 text-red-700'
              }`}
            >
              {item.status === 'applied' ? '✓ 적용' : item.status === 'reviewing' ? '⏳ 검토 중' : '✗ 미적용'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function ActionButton({ icon, label, onClick, variant = 'primary' }: { icon: string; label: string; onClick?: () => void; variant?: 'primary' | 'secondary' }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-2 rounded text-sm font-medium transition-colors ${
        variant === 'primary'
          ? 'bg-blue-600 text-white hover:bg-blue-700'
          : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
      }`}
    >
      {icon} {label}
    </button>
  );
}

function GateSection({ title, isOpen, onToggle, children }: { title: string; isOpen: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
      >
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        <span className="text-xl">{isOpen ? '▼' : '▶'}</span>
      </button>
      {isOpen && <div className="border-t border-gray-200 p-6 space-y-4">{children}</div>}
    </div>
  );
}

export default function AgentControlPage() {
  const [activeTab, setActiveTab] = useState('governance');

  // Governance state
  const [securityPolicies, setSecurityPolicies] = useState<PolicyItem[]>(SECURITY_POLICIES);
  const [qualityPolicies, setQualityPolicies] = useState<PolicyItem[]>(QUALITY_POLICIES);
  const [operationalPolicies, setOperationalPolicies] = useState<PolicyItem[]>(OPERATIONAL_POLICIES);

  // FinOps state
  const [gate1Open, setGate1Open] = useState(true);
  const [gate2Open, setGate2Open] = useState(true);
  const [gate3Open, setGate3Open] = useState(true);
  const [namespacesOpen, setNamespacesOpen] = useState(false);
  const [agentOptimOpen, setAgentOptimOpen] = useState(true);
  const [alertsOpen, setAlertsOpen] = useState(false);

  // FinOps form state
  const [semanticCacheEnabled, setSemanticCacheEnabled] = useState(true);
  const [cacheThreshold, setCacheThreshold] = useState(0.93);
  const [cacheBackend, setCacheBackend] = useState('Redis Cluster');
  const [cacheTTL, setCacheTTL] = useState('86400');
  const [embeddingModel, setEmbeddingModel] = useState('text-embedding-3-small');
  const [maxMemory, setMaxMemory] = useState('1024');
  const [warmupEntries, setWarmupEntries] = useState('100');
  const [excludePatterns, setExcludePatterns] = useState('실시간\n현재 시각\n오늘 날씨\n개인정보');

  const [modelRouterEnabled, setModelRouterEnabled] = useState(true);
  const [stage1Enabled, setStage1Enabled] = useState(true);
  const [stage2Enabled, setStage2Enabled] = useState(true);
  const [classifierModel, setClassifierModel] = useState('claude-haiku-4.5');
  const [fallbackTier, setFallbackTier] = useState('Tier 2 Standard');

  const [skillPackerEnabled, setSkillPackerEnabled] = useState(true);
  const [maxTokensPerSkill, setMaxTokensPerSkill] = useState('2000');
  const [outputFormat, setOutputFormat] = useState('JSON');

  const [minCacheHitRate, setMinCacheHitRate] = useState('20');
  const [dailyCostLimit, setDailyCostLimit] = useState('50');
  const [tier3Limit, setTier3Limit] = useState('30');
  const [responseDelayLimit, setResponseDelayLimit] = useState('5000');
  const [alertSlack, setAlertSlack] = useState(true);
  const [alertEmail, setAlertEmail] = useState(true);
  const [alertPagerduty, setAlertPagerduty] = useState(false);

  // API loading states
  const [loading, setLoading] = useState(false);
  const [agents, setAgents] = useState<AgentOptimization[]>(AGENT_OPTIMIZATIONS);
  const [stats, setStats] = useState<any>(null);

  // Load FinOps data on mount
  useEffect(() => {
    const loadFinOpsData = async () => {
      setLoading(true);
      try {
        // Fetch config
        try {
          const configRes = await api.get<any>('/finops/config');
          if (configRes) {
            // Apply config data to state variables
            setSemanticCacheEnabled(configRes.semanticCacheEnabled ?? configRes.cacheEnabled ?? true);
            setCacheThreshold(configRes.cacheThreshold ?? configRes.cacheSimilarityThreshold ?? 0.93);
            setCacheBackend(configRes.cacheBackend ?? 'Redis Cluster');
            setCacheTTL(String(configRes.cacheTTL ?? configRes.cacheTtlSeconds ?? '86400'));
            setEmbeddingModel(configRes.embeddingModel ?? configRes.cacheEmbeddingModel ?? 'text-embedding-3-small');
            setMaxMemory(String(configRes.maxMemory ?? configRes.cacheMaxMemoryMb ?? '1024'));
            setWarmupEntries(String(configRes.warmupEntries ?? configRes.cacheWarmupEntries ?? '100'));
            setExcludePatterns(configRes.excludePatterns ?? ((configRes.cacheExcludePatterns || []).join('\n') || '실시간\n현재 시각\n오늘 날씨\n개인정보'));
            setModelRouterEnabled(configRes.modelRouterEnabled ?? configRes.routerEnabled ?? true);
            setStage1Enabled(configRes.stage1Enabled ?? configRes.routerStage1Enabled ?? true);
            setStage2Enabled(configRes.stage2Enabled ?? configRes.routerStage2Enabled ?? true);
            setClassifierModel(configRes.classifierModel ?? configRes.routerClassifierModel ?? 'claude-haiku-4.5');
            setFallbackTier(configRes.fallbackTier ?? 'Tier 2 Standard');
            setSkillPackerEnabled(configRes.skillPackerEnabled ?? configRes.packerEnabled ?? true);
            setMaxTokensPerSkill(String(configRes.maxTokensPerSkill ?? configRes.packerMaxTokensPerSkill ?? '2000'));
            setOutputFormat(configRes.outputFormat ?? configRes.packerOutputFormat ?? 'JSON');
            setMinCacheHitRate(String(configRes.minCacheHitRate ?? configRes.alertCacheHitMinPct ?? '20'));
            setDailyCostLimit(String(configRes.dailyCostLimit ?? configRes.alertDailyCostMax ?? '50'));
            setTier3Limit(String(configRes.tier3Limit ?? configRes.alertTier3MaxPct ?? '30'));
            setResponseDelayLimit(String(configRes.responseDelayLimit ?? configRes.alertResponseDelayMs ?? '5000'));
            setAlertSlack(configRes.alertSlack ?? configRes.alertSlackEnabled ?? true);
            setAlertEmail(configRes.alertEmail ?? configRes.alertEmailEnabled ?? true);
            setAlertPagerduty(configRes.alertPagerduty ?? configRes.alertPagerDutyEnabled ?? false);
          }
        } catch (e) {
          console.warn('Failed to fetch finops config:', e);
        }

        // Fetch stats
        try {
          const statsRes = await api.get<any>('/finops/stats');
          setStats(statsRes);
        } catch (e) {
          console.warn('Failed to fetch finops stats:', e);
        }

        // Fetch agents
        try {
          const agentsRes = await api.get<any[]>('/finops/agents');
          if (agentsRes && Array.isArray(agentsRes)) {
            setAgents(agentsRes);
          }
        } catch (e) {
          console.warn('Failed to fetch finops agents:', e);
        }
      } finally {
        setLoading(false);
      }
    };

    loadFinOpsData();
  }, []);

  const updatePolicy = (policies: PolicyItem[], setFn: (p: PolicyItem[]) => void, id: string, status: PolicyItem['status']) => {
    setFn(policies.map(p => p.id === id ? { ...p, status } : p));
  };

  return (
    <div className="p-6 space-y-6 bg-gray-50 min-h-screen">
      <PageHeader
        title="Agent 관리/통제"
        description="모든 AI 에이전트의 거버넌스, FinOps, 감사, 심의를 통합 관리합니다"
      />

      {/* Tab Navigation */}
      <div className="bg-white rounded-lg border border-gray-200 sticky top-0 z-10">
        <div className="flex border-b border-gray-200">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 px-4 py-4 text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* TAB 1: GOVERNANCE POLICIES */}
      {activeTab === 'governance' && (
        <div className="space-y-6">
          <PolicyCard
            icon="🔒"
            title="보안 정책"
            items={securityPolicies}
            onChange={(id, status) => updatePolicy(securityPolicies, setSecurityPolicies, id, status)}
          />
          <PolicyCard
            icon="📏"
            title="품질 정책"
            items={qualityPolicies}
            onChange={(id, status) => updatePolicy(qualityPolicies, setQualityPolicies, id, status)}
          />
          <PolicyCard
            icon="⚖️"
            title="운영 정책"
            items={operationalPolicies}
            onChange={(id, status) => updatePolicy(operationalPolicies, setOperationalPolicies, id, status)}
          />
        </div>
      )}

      {/* TAB 2: FINOPS TOKEN OPTIMIZATION */}
      {activeTab === 'finops' && (
        <div className="space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <p className="text-xs text-gray-600 font-semibold">오늘 비용</p>
              <p className="text-2xl font-bold text-green-600 mt-2">$9.50</p>
              <p className="text-xs text-gray-500 mt-1">▼ 91% vs 비최적화</p>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <p className="text-xs text-gray-600 font-semibold">캐시 히트율</p>
              <p className="text-2xl font-bold text-blue-600 mt-2">37.2%</p>
              <p className="text-xs text-gray-500 mt-1">목표 30% 달성</p>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <p className="text-xs text-gray-600 font-semibold">평균 응답</p>
              <p className="text-2xl font-bold text-purple-600 mt-2">340ms</p>
              <p className="text-xs text-gray-500 mt-1">캐시: 48ms</p>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <p className="text-xs text-gray-600 font-semibold">오늘 요청</p>
              <p className="text-2xl font-bold text-orange-600 mt-2">3,847</p>
              <p className="text-xs text-gray-500 mt-1">캐시: 1,431건</p>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <p className="text-xs text-gray-600 font-semibold">누적 절감</p>
              <p className="text-2xl font-bold text-emerald-600 mt-2">$2,715</p>
              <p className="text-xs text-gray-500 mt-1">이번 달</p>
            </div>
          </div>

          {/* Gates Row 1: Gate 1 + Gate 2 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Gate 1: Semantic Cache */}
            <GateSection
              title="Gate 1: Semantic Cache 설정"
              isOpen={gate1Open}
              onToggle={() => setGate1Open(!gate1Open)}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <div className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                  <span className="text-xs font-medium text-gray-700">Activation</span>
                <button
                  onClick={() => setSemanticCacheEnabled(!semanticCacheEnabled)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    semanticCacheEnabled ? 'bg-green-600' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      semanticCacheEnabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
              </div>

              <div className="space-y-2 pt-2">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">유사도 Threshold</label>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="80"
                    max="99"
                    step="1"
                    value={Math.round(cacheThreshold * 100)}
                    onChange={(e) => setCacheThreshold(parseInt(e.target.value) / 100)}
                    className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                  />
                  <span className="text-xs font-semibold text-gray-900 w-12">{cacheThreshold.toFixed(2)}</span>
                </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">캐시 Backend</label>
                  <select
                    value={cacheBackend}
                    onChange={(e) => setCacheBackend(e.target.value)}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                  >
                    <option>Redis Cluster</option>
                    <option>In-Memory</option>
                    <option>Qdrant</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">기본 TTL(초)</label>
                  <input
                    type="number"
                    value={cacheTTL}
                    onChange={(e) => setCacheTTL(e.target.value)}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">임베딩 모델</label>
                  <select
                    value={embeddingModel}
                    onChange={(e) => setEmbeddingModel(e.target.value)}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                  >
                    <option>text-embedding-3-small</option>
                    <option>text-embedding-3-large</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">최대 메모리(MB)</label>
                  <input
                    type="number"
                    value={maxMemory}
                    onChange={(e) => setMaxMemory(e.target.value)}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Warm-up 엔트리</label>
                  <input
                    type="number"
                    value={warmupEntries}
                    onChange={(e) => setWarmupEntries(e.target.value)}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">제외 패턴</label>
                  <textarea
                    value={excludePatterns}
                    onChange={(e) => setExcludePatterns(e.target.value)}
                    rows={3}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-xs font-mono"
                  />
                </div>
              </div>

              <div className="flex gap-1 pt-2">
                <ActionButton
                  icon="💾"
                  label="저장"
                  onClick={async () => {
                    try {
                      await api.put('/finops/config', {
                        semanticCacheEnabled,
                        cacheThreshold,
                        cacheBackend,
                        cacheTTL,
                        embeddingModel,
                        maxMemory,
                        warmupEntries,
                        excludePatterns,
                      });
                      alert('Gate 1 설정이 저장되었습니다.');
                    } catch (e) {
                      console.warn('Failed to save Gate 1 config:', e);
                      alert('설정 저장 실패. 기본값으로 진행합니다.');
                    }
                  }}
                />
                <ActionButton icon="🧹" label="캐시 정리" variant="secondary" />
                <ActionButton icon="🔥" label="Warm-up" variant="secondary" />
              </div>
            </GateSection>

            {/* Gate 2: Model Router */}
            <GateSection
              title="Gate 2: Model Router 설정"
              isOpen={gate2Open}
              onToggle={() => setGate2Open(!gate2Open)}
            >
              <div className="flex items-center gap-2 p-2 bg-gray-50 rounded mb-2">
                <span className="text-xs font-medium text-gray-700">Activation</span>
              <button
                onClick={() => setModelRouterEnabled(!modelRouterEnabled)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  modelRouterEnabled ? 'bg-green-600' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    modelRouterEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                  <span className="text-xs font-medium text-gray-700">Stage 1 (규칙)</span>
                  <button
                    onClick={() => setStage1Enabled(!stage1Enabled)}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                      stage1Enabled ? 'bg-green-600' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                        stage1Enabled ? 'translate-x-5' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                <div className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                  <span className="text-xs font-medium text-gray-700">Stage 2 (LLM)</span>
                  <button
                    onClick={() => setStage2Enabled(!stage2Enabled)}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                      stage2Enabled ? 'bg-green-600' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                        stage2Enabled ? 'translate-x-5' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">분류기 모델</label>
                  <select
                    value={classifierModel}
                    onChange={(e) => setClassifierModel(e.target.value)}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                  >
                    <option>claude-haiku-4.5</option>
                    <option>gemini-3-flash</option>
                    <option>gpt-4o-mini</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Fallback Tier</label>
                  <select
                    value={fallbackTier}
                    onChange={(e) => setFallbackTier(e.target.value)}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                  >
                    <option>Tier 1 Light</option>
                    <option>Tier 2 Standard</option>
                    <option>Tier 3 Heavy</option>
                  </select>
                </div>
              </div>

              <div className="pt-2 space-y-1">
                <div className="text-xs font-semibold text-gray-900">Model Tier</div>
                <div className="text-xs space-y-1">
                  <div className="flex justify-between px-2 py-1 bg-gray-50 rounded">
                    <span>Tier 1: claude-haiku</span>
                    <span>$0.25~$1</span>
                  </div>
                  <div className="flex justify-between px-2 py-1 bg-gray-50 rounded">
                    <span>Tier 2: sonnet</span>
                    <span>$3~$15</span>
                  </div>
                  <div className="flex justify-between px-2 py-1 bg-gray-50 rounded">
                    <span>Tier 3: opus</span>
                    <span>$15~$75</span>
                  </div>
                </div>
              </div>

              <div className="flex gap-1 pt-2">
                <ActionButton
                  icon="💾"
                  label="저장"
                  onClick={async () => {
                    try {
                      await api.put('/finops/config', {
                        modelRouterEnabled,
                        stage1Enabled,
                        stage2Enabled,
                        classifierModel,
                        fallbackTier,
                      });
                      alert('Gate 2 설정이 저장되었습니다.');
                    } catch (e) {
                      console.warn('Failed to save Gate 2 config:', e);
                      alert('설정 저장 실패. 기본값으로 진행합니다.');
                    }
                  }}
                />
                <ActionButton icon="🔄" label="초기화" variant="secondary" />
              </div>
            </GateSection>
          </div>

          {/* Gates Row 2: Gate 3 + Alert Settings */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Gate 3: Skill Packer */}
            <GateSection
              title="Gate 3: Skill Packer 설정"
              isOpen={gate3Open}
              onToggle={() => setGate3Open(!gate3Open)}
            >
              <div className="flex items-center gap-2 p-2 bg-gray-50 rounded mb-2">
                <span className="text-xs font-medium text-gray-700">Activation</span>
                <button
                  onClick={() => setSkillPackerEnabled(!skillPackerEnabled)}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                    skillPackerEnabled ? 'bg-green-600' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                      skillPackerEnabled ? 'translate-x-5' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              <div className="space-y-2">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">최대 토큰/스킬</label>
                  <input
                    type="number"
                    value={maxTokensPerSkill}
                    onChange={(e) => setMaxTokensPerSkill(e.target.value)}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">출력 형식</label>
                  <select
                    value={outputFormat}
                    onChange={(e) => setOutputFormat(e.target.value)}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                  >
                    <option>JSON</option>
                    <option>Text</option>
                    <option>Markdown</option>
                  </select>
                </div>
              </div>

              <div className="pt-2 space-y-1">
                <div className="text-xs font-semibold text-gray-900 mb-1">등록된 스킬</div>
                <div className="text-xs space-y-1">
                  {REGISTERED_SKILLS.map(skill => (
                    <div key={skill.id} className="flex justify-between px-2 py-1 bg-gray-50 rounded">
                      <span>{skill.name}</span>
                      <span className="text-gray-500">{skill.callCount}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-2">
                <ActionButton icon="+" label="스킬 등록" />
              </div>
            </GateSection>

            {/* Alert Settings */}
            <GateSection
              title="모니터링 알림 설정"
              isOpen={alertsOpen}
              onToggle={() => setAlertsOpen(!alertsOpen)}
            >
              <div className="space-y-2">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">캐시 히트율 최소 (%)</label>
                  <input
                    type="number"
                    value={minCacheHitRate}
                    onChange={(e) => setMinCacheHitRate(e.target.value)}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">일간 비용 상한 ($)</label>
                  <input
                    type="number"
                    value={dailyCostLimit}
                    onChange={(e) => setDailyCostLimit(e.target.value)}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Tier 3 상한 (%)</label>
                  <input
                    type="number"
                    value={tier3Limit}
                    onChange={(e) => setTier3Limit(e.target.value)}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">응답 지연 (ms)</label>
                  <input
                    type="number"
                    value={responseDelayLimit}
                    onChange={(e) => setResponseDelayLimit(e.target.value)}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                  />
                </div>

                <div className="pt-1">
                  <label className="block text-xs font-medium text-gray-700 mb-1">Alert 채널</label>
                  <div className="space-y-1">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={alertSlack}
                        onChange={(e) => setAlertSlack(e.target.checked)}
                        className="w-3 h-3 rounded border-gray-300"
                      />
                      <span className="text-xs text-gray-700">Slack</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={alertEmail}
                        onChange={(e) => setAlertEmail(e.target.checked)}
                        className="w-3 h-3 rounded border-gray-300"
                      />
                      <span className="text-xs text-gray-700">Email</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={alertPagerduty}
                        onChange={(e) => setAlertPagerduty(e.target.checked)}
                        className="w-3 h-3 rounded border-gray-300"
                      />
                      <span className="text-xs text-gray-700">PagerDuty</span>
                    </label>
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <ActionButton
                  icon="💾"
                  label="저장"
                  onClick={async () => {
                    try {
                      await api.put('/finops/config', {
                        minCacheHitRate,
                        dailyCostLimit,
                        tier3Limit,
                        responseDelayLimit,
                        alertSlack,
                        alertEmail,
                        alertPagerduty,
                      });
                      alert('알림 설정이 저장되었습니다.');
                    } catch (e) {
                      console.warn('Failed to save alert settings:', e);
                      alert('설정 저장 실패. 기본값으로 진행합니다.');
                    }
                  }}
                />
              </div>
            </GateSection>
          </div>

          {/* Distribution Chart */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h3 className="text-xs font-semibold text-gray-900 mb-3">오늘 Gate/Tier 분포</h3>
            <div className="space-y-2">
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-xs font-medium text-gray-700">Cache Hit: 37.2%</span>
                  <span className="text-xs text-gray-500">1,431건</span>
                </div>
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div className="h-full bg-green-500" style={{ width: '37.2%' }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-xs font-medium text-gray-700">Tier 1: 28.5%</span>
                  <span className="text-xs text-gray-500">1,096건</span>
                </div>
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500" style={{ width: '28.5%' }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-xs font-medium text-gray-700">Tier 2: 25.8%</span>
                  <span className="text-xs text-gray-500">992건</span>
                </div>
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div className="h-full bg-cyan-500" style={{ width: '25.8%' }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-xs font-medium text-gray-700">Tier 3: 8.5%</span>
                  <span className="text-xs text-gray-500">328건</span>
                </div>
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div className="h-full bg-purple-500" style={{ width: '8.5%' }} />
                </div>
              </div>
            </div>
            <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded text-xs text-green-700">
              ✅ Tier 3: 8.5% (상한 30% 이내)
            </div>
          </div>

          {/* Namespace Management */}
          <GateSection
            title="서비스별 캐시 분리 (Namespace Management)"
            isOpen={namespacesOpen}
            onToggle={() => setNamespacesOpen(!namespacesOpen)}
          >
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-100 border border-gray-200">
                    <th className="px-3 py-2 text-left font-semibold">Namespace</th>
                    <th className="px-3 py-2 text-left font-semibold">캐시 엔트리</th>
                    <th className="px-3 py-2 text-left font-semibold">히트율</th>
                    <th className="px-3 py-2 text-left font-semibold">TTL 정책</th>
                    <th className="px-3 py-2 text-left font-semibold">상태</th>
                    <th className="px-3 py-2 text-left font-semibold">관리</th>
                  </tr>
                </thead>
                <tbody>
                  {CACHE_NAMESPACES.map(ns => (
                    <tr key={ns.id} className="border border-gray-200 hover:bg-gray-50">
                      <td className="px-3 py-2 font-mono">{ns.namespace}</td>
                      <td className="px-3 py-2">{ns.entries.toLocaleString()}</td>
                      <td className="px-3 py-2">{ns.hitRate.toFixed(1)}%</td>
                      <td className="px-3 py-2">{ns.ttlPolicy}</td>
                      <td className="px-3 py-2"><span className="text-green-600 font-semibold">✓ {ns.status}</span></td>
                      <td className="px-3 py-2"><button className="text-blue-600 hover:underline">설정</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="pt-4">
              <ActionButton icon="+" label="네임스페이스 추가" />
            </div>
          </GateSection>

          {/* Agent Optimization Settings — Editable with API */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded text-xs text-blue-700">
              ℹ️ 각 Agent가 실행될 때 FinOps Token Optimizer가 공통 미들웨어로 동작합니다. Agent별 Gate ON/OFF 및 허용 Tier를 설정하면 해당 Agent의 모든 AI 호출에 자동 적용됩니다.
            </div>

            <h3 className="text-sm font-semibold text-gray-900 mb-4">Agent별 FinOps 최적화 설정 (실시간 적용)</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-100 border border-gray-200">
                    <th className="px-3 py-2 text-left font-semibold">Agent</th>
                    <th className="px-3 py-2 text-left font-semibold">상태</th>
                    <th className="px-3 py-2 text-center font-semibold">Cache</th>
                    <th className="px-3 py-2 text-center font-semibold">Router</th>
                    <th className="px-3 py-2 text-center font-semibold">Packer</th>
                    <th className="px-3 py-2 text-left font-semibold">허용 Tier</th>
                    <th className="px-3 py-2 text-left font-semibold">Namespace</th>
                    <th className="px-3 py-2 text-left font-semibold">일간 한도($)</th>
                    <th className="px-3 py-2 text-left font-semibold">오늘 사용</th>
                    <th className="px-3 py-2 text-left font-semibold">절감액</th>
                  </tr>
                </thead>
                <tbody>
                  {agents.map((ao, idx) => (
                    <tr key={ao.id} className="border border-gray-200 hover:bg-gray-50">
                      <td className="px-3 py-2 font-medium">{ao.agentName}</td>
                      <td className="px-3 py-2">
                        {ao.status === 'operating' ? (
                          <span className="text-green-600 font-semibold">✓ 운영</span>
                        ) : (
                          <span className="text-yellow-600 font-semibold">⏳ 심의</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <input type="checkbox" checked={ao.gate1} onChange={e => {
                          const updated = [...agents];
                          updated[idx] = { ...updated[idx], gate1: e.target.checked };
                          setAgents(updated);
                        }} className="w-3.5 h-3.5 accent-green-600" />
                      </td>
                      <td className="px-3 py-2 text-center">
                        <input type="checkbox" checked={ao.gate2} onChange={e => {
                          const updated = [...agents];
                          updated[idx] = { ...updated[idx], gate2: e.target.checked };
                          setAgents(updated);
                        }} className="w-3.5 h-3.5 accent-purple-600" />
                      </td>
                      <td className="px-3 py-2 text-center">
                        <input type="checkbox" checked={ao.gate3} onChange={e => {
                          const updated = [...agents];
                          updated[idx] = { ...updated[idx], gate3: e.target.checked };
                          setAgents(updated);
                        }} className="w-3.5 h-3.5 accent-orange-600" />
                      </td>
                      <td className="px-3 py-2">
                        <select value={ao.allowedTiers} onChange={e => {
                          const updated = [...agents];
                          updated[idx] = { ...updated[idx], allowedTiers: e.target.value };
                          setAgents(updated);
                        }} className="w-full px-1 py-0.5 border border-gray-300 rounded text-[10px]">
                          <option value="1,2,3">1,2,3 (전체)</option>
                          <option value="1,2">1,2 (Tier3 차단)</option>
                          <option value="2,3">2,3 (Tier1 제외)</option>
                          <option value="1">1 (경량만)</option>
                          <option value="2">2 (표준만)</option>
                          <option value="3">3 (고성능만)</option>
                        </select>
                      </td>
                      <td className="px-3 py-2">
                        <input type="text" value={ao.namespace} onChange={e => {
                          const updated = [...agents];
                          updated[idx] = { ...updated[idx], namespace: e.target.value };
                          setAgents(updated);
                        }} className="w-full px-1 py-0.5 border border-gray-300 rounded text-[10px] font-mono" />
                      </td>
                      <td className="px-3 py-2">
                        <input type="text" value={ao.dailyLimit} onChange={e => {
                          const updated = [...agents];
                          updated[idx] = { ...updated[idx], dailyLimit: e.target.value };
                          setAgents(updated);
                        }} className="w-16 px-1 py-0.5 border border-gray-300 rounded text-[10px]" />
                      </td>
                      <td className="px-3 py-2">{ao.todayUsed}</td>
                      <td className="px-3 py-2 text-green-600 font-semibold">{ao.savings}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Add new agent */}
            <div className="flex gap-2 pt-4 items-center">
              <button
                onClick={() => {
                  const name = prompt('새 Agent 이름을 입력하세요:');
                  if (!name || !name.trim()) return;
                  setAgents(prev => [...prev, {
                    id: `ao-new-${Date.now()}`,
                    agentName: name.trim(),
                    status: 'operating' as const,
                    gate1: true, gate2: true, gate3: true,
                    allowedTiers: '1,2,3',
                    namespace: 'default',
                    dailyLimit: '$10',
                    todayUsed: '$0',
                    savings: '$0',
                  }]);
                }}
                className="px-3 py-2 bg-blue-600 text-white text-xs font-medium rounded hover:bg-blue-700 transition"
              >
                + Agent 추가
              </button>
              <button
                onClick={async () => {
                  try {
                    for (const agent of agents) {
                      const tierArr = agent.allowedTiers.split(',').map((t: string) => parseInt(t.trim(), 10)).filter((n: number) => !isNaN(n));
                      const dailyUsd = parseFloat(agent.dailyLimit.replace('$', '')) || 10;
                      await api.put(`/finops/agents/${agent.agentName}`, {
                        agentName: agent.agentName,
                        cacheEnabled: agent.gate1,
                        routerEnabled: agent.gate2,
                        packerEnabled: agent.gate3,
                        allowedTiers: tierArr,
                        namespace: agent.namespace,
                        dailyLimitUsd: dailyUsd,
                        status: agent.status === 'operating' ? 'ACTIVE' : 'REVIEWING',
                      });
                    }
                    alert('✅ 모든 Agent FinOps 설정이 서버에 저장되었습니다.');
                  } catch (e) {
                    console.warn('Failed to save agent settings:', e);
                    alert('설정 저장 실패. API 서버 연결을 확인하세요.');
                  }
                }}
                className="px-3 py-2 bg-green-600 text-white text-xs font-medium rounded hover:bg-green-700 transition"
              >
                💾 전체 저장 (서버 반영)
              </button>
              <button
                onClick={async () => {
                  try {
                    const result = await api.get<any[]>('/finops/agents');
                    if (Array.isArray(result) && result.length > 0) {
                      setAgents(result.map((a: any) => ({
                        id: a.id || `ao-${a.agentName}`,
                        agentName: a.agentName,
                        status: (a.status === 'ACTIVE' ? 'operating' : 'reviewing') as 'operating' | 'reviewing',
                        gate1: a.cacheEnabled ?? true,
                        gate2: a.routerEnabled ?? true,
                        gate3: a.packerEnabled ?? true,
                        allowedTiers: (a.allowedTiers || [1,2,3]).join(','),
                        namespace: a.namespace || 'default',
                        dailyLimit: `$${a.dailyLimitUsd || 10}`,
                        todayUsed: '$0',
                        savings: '$0',
                      })));
                      alert('서버에서 Agent 목록을 불러왔습니다.');
                    }
                  } catch (e) {
                    console.warn('Failed to load agents from server:', e);
                  }
                }}
                className="px-3 py-2 bg-gray-200 text-gray-700 text-xs font-medium rounded hover:bg-gray-300 transition"
              >
                🔄 서버에서 불러오기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: AUDIT LOG */}
      {activeTab === 'audit' && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-100 border-b border-gray-200">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">시간</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">사용자</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">액션</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">대상</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">결과</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {AUDIT_LOGS.map(log => (
                  <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-xs text-gray-600">{log.time}</td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{log.user}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 text-xs font-semibold rounded ${
                        log.actionType === 'execution' ? 'bg-green-100 text-green-700' :
                        log.actionType === 'deployment' ? 'bg-purple-100 text-purple-700' :
                        log.actionType === 'config' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">{log.target}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 text-xs font-semibold rounded ${
                        log.resultStatus === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {log.result}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">{log.ip || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: REVIEW BOARD */}
      {activeTab === 'review' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <ActionButton icon="+" label="심의 요청" />
          </div>

          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-100 border-b border-gray-200">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">심의 ID</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Agent</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">유형</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">요청자</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">요청일</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">상태</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">관리</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {REVIEW_BOARD.map(review => (
                    <tr key={review.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-sm font-mono text-gray-900">{review.reviewId}</td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{review.agentName}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 text-xs font-semibold rounded ${
                          review.agentType === '신규 등록' ? 'bg-cyan-100 text-cyan-700' :
                          review.agentType === '버전 업' ? 'bg-green-100 text-green-700' :
                          'bg-purple-100 text-purple-700'
                        }`}>
                          {review.agentType}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">{review.reviewer}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{review.requestDate}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 text-xs font-semibold rounded ${
                          review.status === 'reviewing' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'
                        }`}>
                          {review.status === 'reviewing' ? '⏳ 심의 중' : '✓ 승인'}
                        </span>
                      </td>
                      <td className="px-4 py-3"><button className="text-blue-600 hover:underline text-sm">상세</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
