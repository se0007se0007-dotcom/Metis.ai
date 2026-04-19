'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Sparkles,
  Inbox,
  Activity,
  TrendingUp,
  CheckCircle2,
  Clock,
  DollarSign,
  AlertTriangle,
  Bot,
  Zap,
} from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { api } from '@/lib/api-client';
import { useEventStream } from '@/lib/use-event-stream';

type UserRole = 'OPERATOR' | 'DEVELOPER' | 'AUDITOR' | 'TENANT_ADMIN' | 'VIEWER' | 'CUSTOM';

interface QueueItem {
  type: string;
  count: number;
  label: string;
  route?: string;
}

interface FeedEvent {
  id: string;
  timestamp: string;
  agentName: string;
  summary: string;
}

interface KPIMetrics {
  totalExecutions: number;
  successRate: number;
  avgLatencyMs: number;
  monthlyUsdCost: number;
  anomalyCount: number;
  autoActionsCount: number;
}

function formatTimestamp(isoString: string): string {
  try {
    const date = new Date(isoString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return '방금 전';
    if (minutes < 60) return `${minutes}분 전`;
    if (hours < 24) return `${hours}시간 전`;
    if (days < 7) return `${days}일 전`;
    return date.toLocaleDateString('ko-KR');
  } catch {
    return '—';
  }
}

function getQueueByRole(role: UserRole): QueueItem[] {
  switch (role) {
    case 'OPERATOR':
      return [
        { type: 'mission', count: 3, label: '처리 대기 미션', route: '/governance/audit' },
        { type: 'approval', count: 2, label: 'AP 결재', route: '/governance/evidence' },
        { type: 'risk', count: 1, label: 'Risk 알림', route: '/governance/kpi' },
      ];
    case 'DEVELOPER':
      return [
        { type: 'deploy', count: 2, label: '배포 대기', route: '/release' },
        { type: 'builder', count: 4, label: 'Builder 검증', route: '/orchestration' },
        { type: 'canary', count: 1, label: 'Canary 진행 중', route: '/release' },
      ];
    case 'AUDITOR':
      return [
        { type: 'audit', count: 5, label: '검토 대기 감사 로그', route: '/governance/audit' },
        { type: 'evidence', count: 2, label: '증적 요청', route: '/governance/evidence' },
      ];
    case 'TENANT_ADMIN':
      return [
        { type: 'mission', count: 3, label: '처리 대기 미션', route: '/governance/audit' },
        { type: 'approval', count: 2, label: 'AP 결재', route: '/governance/evidence' },
        { type: 'risk', count: 1, label: 'Risk 알림', route: '/governance/kpi' },
        { type: 'deploy', count: 2, label: '배포 대기', route: '/release' },
        { type: 'builder', count: 4, label: 'Builder 검증', route: '/orchestration' },
        { type: 'canary', count: 1, label: 'Canary 진행 중', route: '/release' },
        { type: 'audit', count: 5, label: '감사 로그', route: '/governance/audit' },
      ];
    default:
      return [
        { type: 'mission', count: 0, label: '대기 항목 없음', route: '/' },
      ];
  }
}

function MockFeedEvents(): FeedEvent[] {
  return [
    {
      id: 'evt1',
      timestamp: new Date(Date.now() - 2 * 60000).toISOString(),
      agentName: 'ExecutionMonitor',
      summary: 'execution_001이 성공적으로 완료되었습니다.',
    },
    {
      id: 'evt2',
      timestamp: new Date(Date.now() - 5 * 60000).toISOString(),
      agentName: 'PolicyValidator',
      summary: 'compliance_check_456이 정책 승인되었습니다.',
    },
    {
      id: 'evt3',
      timestamp: new Date(Date.now() - 12 * 60000).toISOString(),
      agentName: 'AnomalyDetector',
      summary: '비정상 지연 감지: latency spike +45%',
    },
    {
      id: 'evt4',
      timestamp: new Date(Date.now() - 25 * 60000).toISOString(),
      agentName: 'CanaryManager',
      summary: 'canary_deploy_789가 자동으로 롤백되었습니다.',
    },
    {
      id: 'evt5',
      timestamp: new Date(Date.now() - 42 * 60000).toISOString(),
      agentName: 'CostOptimizer',
      summary: '월 비용이 예산의 78%에 도달했습니다.',
    },
  ];
}

function MockKPIMetrics(): KPIMetrics {
  return {
    totalExecutions: 1234,
    successRate: 96.8,
    avgLatencyMs: 342,
    monthlyUsdCost: 4521.23,
    anomalyCount: 3,
    autoActionsCount: 12,
  };
}

export default function HomePage() {
  const router = useRouter();
  const [role, setRole] = useState<UserRole>('OPERATOR');
  const [queueItems, setQueueItems] = useState<QueueItem[]>([]);
  const [feedEvents, setFeedEvents] = useState<FeedEvent[]>([]);
  // Live SSE stream — auto-reconnect, backpressure-aware.
  const sseStream = useEventStream({ maxEvents: 30 });
  const [kpi, setKpi] = useState<KPIMetrics | null>(null);
  const [aiInsight, setAiInsight] = useState(
    '오늘의 상태: 시스템 정상 운영 중입니다. 약간의 높은 지연이 감지되었으나 자동 조치로 회복되었습니다.'
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        // Get user role from localStorage
        if (typeof window !== 'undefined') {
          const storedRole = localStorage.getItem('metis_user_role') as UserRole || 'OPERATOR';
          setRole(storedRole);
          const roleQueue = getQueueByRole(storedRole);
          setQueueItems(roleQueue);
        }

        // Fetch KPI data from API with fallback to mock data
        try {
          const kpiResponse = await api.get<Record<string, unknown>>('/executions/kpi');
          const govResponse = await api.get<Record<string, unknown>>('/connectors/governance/overview');

          const combinedKPI: KPIMetrics = {
            totalExecutions: (kpiResponse as any)?.totalExecutions ?? MockKPIMetrics().totalExecutions,
            successRate: (kpiResponse as any)?.successRate ?? MockKPIMetrics().successRate,
            avgLatencyMs: (kpiResponse as any)?.avgLatencyMs ?? MockKPIMetrics().avgLatencyMs,
            monthlyUsdCost: (govResponse as any)?.monthlyUsdCost ?? MockKPIMetrics().monthlyUsdCost,
            anomalyCount: (govResponse as any)?.anomalyCount ?? MockKPIMetrics().anomalyCount,
            autoActionsCount: (govResponse as any)?.autoActionsCount ?? MockKPIMetrics().autoActionsCount,
          };
          setKpi(combinedKPI);
        } catch {
          // Graceful fallback to mock data
          setKpi(MockKPIMetrics());
        }

        // Fetch feed events
        setFeedEvents(MockFeedEvents());

        // Fetch AI insight (mock for now)
        setAiInsight('오늘의 상태: 시스템 정상 운영 중입니다. 약간의 높은 지연이 감지되었으나 자동 조치로 회복되었습니다.');
      } catch (error) {
        console.error('Failed to load home page data:', error);
      } finally {
        setLoading(false);
      }
    }

    load();

    // Auto-refresh every 30 seconds
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleQueueItemClick = (route?: string) => {
    if (route) {
      router.push(route);
    }
  };

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="명령 센터"
        description="Metis.AI - 통합 모니터링 및 제어 대시보드"
      />

      {/* ROW 1: AI Insight Card */}
      <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg p-6 hover:shadow-md transition-shadow">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0">
            <Sparkles className="w-6 h-6 text-purple-600" />
          </div>
          <div className="flex-1">
            <h2 className="text-sm font-semibold text-gray-900 mb-2">
              오늘의 추천 액션
            </h2>
            <p className="text-xs text-gray-700 leading-relaxed mb-3">
              {aiInsight}
            </p>
            <div className="flex gap-2 flex-wrap">
              <button className="px-3 py-1.5 bg-purple-600 text-white text-xs font-medium rounded hover:bg-purple-700 transition-colors">
                상세 보기
              </button>
              <button className="px-3 py-1.5 bg-white border border-purple-300 text-purple-600 text-xs font-medium rounded hover:bg-purple-50 transition-colors">
                무시
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ROW 2: 2-column split (60/40) */}
      <div className="grid grid-cols-3 gap-6">
        {/* Left: My Queue (60%) */}
        <div className="col-span-2">
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
              <Inbox className="w-5 h-5 text-blue-600" />
              <h3 className="text-sm font-semibold text-gray-900">작업 큐</h3>
            </div>
            <div className="divide-y divide-gray-100">
              {loading ? (
                <div className="px-4 py-3 text-xs text-gray-500">로드 중...</div>
              ) : queueItems.length === 0 ? (
                <div className="px-4 py-3 text-xs text-gray-500">항목이 없습니다.</div>
              ) : (
                queueItems.map((item, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleQueueItemClick(item.route)}
                    className="w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors flex items-center justify-between group"
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <div className="w-2 h-2 rounded-full bg-blue-500 group-hover:bg-blue-600" />
                      <div>
                        <p className="text-xs font-medium text-gray-900">
                          {item.label}
                        </p>
                      </div>
                    </div>
                    <span className="ml-2 inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold">
                      {item.count}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right: Live Event Feed (40%) — SSE */}
        <div className="col-span-1">
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-green-600" />
                <h3 className="text-sm font-semibold text-gray-900">실시간 피드</h3>
              </div>
              <span className={`flex items-center gap-1 text-[10px] font-semibold ${
                sseStream.connected ? 'text-green-600' : 'text-gray-400'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${
                  sseStream.connected ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
                }`} />
                {sseStream.connected ? 'LIVE' : 'OFFLINE'}
              </span>
            </div>
            <div className="max-h-80 overflow-y-auto divide-y divide-gray-100">
              {sseStream.events.length === 0 && feedEvents.length === 0 && !loading ? (
                <div className="px-3 py-2 text-xs text-gray-500">이벤트 없음</div>
              ) : (
                (sseStream.events.length > 0
                  ? sseStream.events.slice(0, 20).map((e) => ({
                      id: e.id,
                      agentName: e.actor,
                      summary: e.summary,
                      timestamp: e.timestamp,
                      severity: e.severity,
                      type: e.type,
                    }))
                  : feedEvents.slice(0, 20).map((e) => ({
                      id: e.id,
                      agentName: e.agentName,
                      summary: e.summary,
                      timestamp: e.timestamp,
                      severity: 'info' as const,
                      type: 'system',
                    }))
                ).map((event) => {
                  const sevColor = {
                    error: 'bg-red-500',
                    warning: 'bg-amber-500',
                    success: 'bg-green-500',
                    info: 'bg-blue-500',
                  }[event.severity || 'info'];
                  return (
                    <div key={event.id} className="px-3 py-2 hover:bg-gray-50 transition-colors">
                      <div className="flex items-start gap-2">
                        <div className={`flex-shrink-0 w-1.5 h-1.5 rounded-full mt-1.5 ${sevColor}`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-xs font-medium text-gray-900 truncate">
                              {event.agentName}
                            </p>
                            <span className="text-[9px] px-1 py-0.5 bg-gray-100 text-gray-600 rounded font-semibold uppercase">
                              {event.type}
                            </span>
                          </div>
                          <p className="text-xs text-gray-600 line-clamp-2 mt-0.5">
                            {event.summary}
                          </p>
                          <p className="text-xs text-gray-400 mt-1">
                            {formatTimestamp(event.timestamp)}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ROW 3: KPI Grid (6 cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Total Executions */}
        <div className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-600 font-medium mb-1">총 실행</p>
              <p className="text-xl font-bold text-gray-900">
                {loading ? '—' : kpi?.totalExecutions?.toLocaleString() ?? '—'}
              </p>
            </div>
            <ZapCircleIcon className="w-8 h-8 text-blue-200" />
          </div>
        </div>

        {/* Success Rate */}
        <div className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-600 font-medium mb-1">성공률</p>
              <p className="text-xl font-bold text-gray-900">
                {loading ? '—' : `${kpi?.successRate?.toFixed(1) ?? '—'}%`}
              </p>
            </div>
            <CheckCircle2 className="w-8 h-8 text-green-200" />
          </div>
        </div>

        {/* Average Latency */}
        <div className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-600 font-medium mb-1">평균 지연</p>
              <p className="text-xl font-bold text-gray-900">
                {loading ? '—' : `${kpi?.avgLatencyMs ?? '—'}ms`}
              </p>
            </div>
            <Clock className="w-8 h-8 text-amber-200" />
          </div>
        </div>

        {/* Monthly Cost */}
        <div className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-600 font-medium mb-1">월 비용</p>
              <p className="text-xl font-bold text-gray-900">
                {loading ? '—' : `$${kpi?.monthlyUsdCost?.toFixed(2) ?? '—'}`}
              </p>
            </div>
            <DollarSign className="w-8 h-8 text-teal-200" />
          </div>
        </div>

        {/* Anomalies */}
        <div className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-600 font-medium mb-1">이상 감지</p>
              <p className="text-xl font-bold text-gray-900">
                {loading ? '—' : kpi?.anomalyCount ?? '—'}
              </p>
            </div>
            <AlertTriangle className="w-8 h-8 text-red-200" />
          </div>
        </div>

        {/* Auto-actions in last 24h */}
        <div className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-600 font-medium mb-1">자율 조치</p>
              <p className="text-xl font-bold text-gray-900">
                {loading ? '—' : kpi?.autoActionsCount ?? '—'}
              </p>
            </div>
            <Bot className="w-8 h-8 text-indigo-200" />
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper component for icon background
function ZapCircleIcon({ className }: { className: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z" />
    </svg>
  );
}
