'use client';

import { useState, useEffect, useCallback } from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { api } from '@/lib/api-client';
import {
  RefreshCw, DollarSign, TrendingUp, TrendingDown, Sparkles, Settings2, Gauge, AlertCircle,
} from 'lucide-react';

// ── Types ──

interface FinOpsOverview {
  currentMonthCost: number;
  previousMonthCost: number;
  cacheHitRate: number;
  savingsAmount: number;
}

interface AgentCost {
  agentId: string;
  agentName: string;
  cost: number;
  tokens: number;
  trend: number; // percentage
}

interface Recommendation {
  id: string;
  agentName: string;
  action: string;
  savingsAmount: number;
  currentTier: string;
  recommendedTier: string;
}

interface TokenLog {
  id: string;
  timestamp: string;
  agentId: string;
  agentName: string;
  tokenCount: number;
  cost: number;
}

// ── Page Component ──

export default function FinOpsPage() {
  const [tab, setTab] = useState<'current' | 'predict' | 'recommend' | 'logs'>('current');
  const [overview, setOverview] = useState<FinOpsOverview | null>(null);
  const [agents, setAgents] = useState<AgentCost[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [logs, setLogs] = useState<TokenLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // What-If Simulator State
  const [cacheTTL, setCacheTTL] = useState(3600); // seconds
  const [modelTier, setModelTier] = useState(2); // 1-3
  const [skillBudget, setSkillBudget] = useState(1000000); // tokens

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [overviewData, agentsData, logsData, recsData] = await Promise.all([
        api.get<FinOpsOverview>('/finops/overview'),
        api.get<{ items: AgentCost[] }>('/finops/agents'),
        api.get<{ items: TokenLog[] }>('/finops/logs'),
        api.get<{ items: Recommendation[] }>('/finops/recommendations'),
      ]);

      setOverview(overviewData || getMockOverview());
      setAgents(agentsData?.items || getMockAgents());
      setLogs(logsData?.items || getMockLogs());
      setRecommendations(recsData?.items || getMockRecommendations());
    } catch (err: any) {
      setError(err.message ?? 'Failed to load FinOps data');
      setOverview(getMockOverview());
      setAgents(getMockAgents());
      setLogs(getMockLogs());
      setRecommendations(getMockRecommendations());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => {
      setRefreshKey((k) => k + 1);
      fetchData();
    }, 30000); // Auto-refresh every 30s
    return () => clearInterval(interval);
  }, [fetchData]);

  // Calculate predicted cost based on what-if simulator
  const predictedCost = overview
    ? overview.currentMonthCost * (0.8 + (modelTier - 1) * 0.1) * (cacheTTL / 3600) * 0.9
    : 0;

  const costDiff = overview
    ? overview.currentMonthCost - predictedCost
    : 0;

  return (
    <div className="p-6">
      <PageHeader
        title="FinOps 인사이트"
        description="비용 분석 및 최적화 추천"
        actions={
          <button
            onClick={() => {
              fetchData();
              setRefreshKey((k) => k + 1);
            }}
            className="p-1.5 text-muted hover:text-white transition"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        }
      />

      {error && (
        <div className="flex items-center gap-2 p-3 mb-4 bg-danger/10 border border-danger/20 rounded text-xs text-danger">
          <AlertCircle size={14} />
          {error}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-white/[0.06]">
        {(['current', 'predict', 'recommend', 'logs'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-xs font-semibold border-b-2 transition ${
              tab === t
                ? 'text-accent border-accent'
                : 'text-muted border-transparent hover:text-white'
            }`}
          >
            {t === 'current' && '[현황]'}
            {t === 'predict' && '[예측]'}
            {t === 'recommend' && '[추천]'}
            {t === 'logs' && '[로그]'}
          </button>
        ))}
      </div>

      {/* Tab: 현황 (Current) */}
      {tab === 'current' && (
        <div className="space-y-6">
          {/* Summary Stats */}
          <div className="grid grid-cols-4 gap-4">
            <StatCard
              icon={DollarSign}
              label="이번달 비용"
              value={`$${(overview?.currentMonthCost || 0).toFixed(2)}`}
              color="accent"
            />
            <StatCard
              icon={overview?.currentMonthCost ?? 0 > overview?.previousMonthCost ?? 0 ? TrendingUp : TrendingDown}
              label="전월 대비"
              value={`${overview ? (((overview.currentMonthCost - overview.previousMonthCost) / overview.previousMonthCost) * 100).toFixed(1) : 0}%`}
              color={
                overview && overview.currentMonthCost > overview.previousMonthCost
                  ? 'danger'
                  : 'success'
              }
            />
            <StatCard
              icon={Gauge}
              label="캐시 Hit률"
              value={`${(overview?.cacheHitRate || 0).toFixed(1)}%`}
              color="warning"
            />
            <StatCard
              icon={TrendingDown}
              label="절감액"
              value={`$${(overview?.savingsAmount || 0).toFixed(2)}`}
              color="success"
            />
          </div>

          {/* Agent Costs Table */}
          <div className="bg-navy-light rounded-lg border border-white/[0.06]">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
              <span className="text-xs font-semibold text-white">Agent별 비용 (Top 10)</span>
              <span className="text-[10px] text-muted">{agents.length}개</span>
            </div>

            {loading ? (
              <div className="p-4 space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-10 bg-white/[0.03] rounded animate-pulse" />
                ))}
              </div>
            ) : agents.length === 0 ? (
              <div className="p-8 text-center text-muted">
                <Gauge size={32} className="mx-auto mb-3 opacity-30" />
                <p className="text-xs">비용 데이터가 없습니다</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-[10px] text-muted uppercase tracking-wider border-b border-white/[0.04]">
                      <th className="text-left px-4 py-2">Agent</th>
                      <th className="text-right px-4 py-2">비용</th>
                      <th className="text-right px-4 py-2">토큰</th>
                      <th className="text-right px-4 py-2">추세</th>
                    </tr>
                  </thead>
                  <tbody>
                    {agents.slice(0, 10).map((agent) => (
                      <tr
                        key={agent.agentId}
                        className="border-b border-white/[0.03] hover:bg-white/[0.02] transition"
                      >
                        <td className="px-4 py-2.5 text-xs text-white font-medium">
                          {agent.agentName}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-right text-accent font-semibold">
                          ${agent.cost.toFixed(2)}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-right text-muted font-mono">
                          {agent.tokens.toLocaleString()}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-right">
                          <span
                            className={
                              agent.trend > 0
                                ? 'text-danger flex items-center justify-end gap-1'
                                : 'text-success flex items-center justify-end gap-1'
                            }
                          >
                            {agent.trend > 0 ? (
                              <TrendingUp size={12} />
                            ) : (
                              <TrendingDown size={12} />
                            )}
                            {Math.abs(agent.trend).toFixed(1)}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab: 예측 (Predict) */}
      {tab === 'predict' && (
        <div className="space-y-6">
          {/* What-If Simulator */}
          <div className="bg-navy-light rounded-lg border border-white/[0.06] p-4">
            <div className="flex items-center gap-2 mb-4">
              <Settings2 size={14} className="text-accent" />
              <span className="text-xs font-semibold text-white">What-If 시뮬레이터</span>
            </div>

            <div className="grid grid-cols-3 gap-6">
              {/* Cache TTL Slider */}
              <div>
                <label className="text-[11px] text-muted font-semibold mb-2 block">
                  캐시 TTL (초)
                </label>
                <input
                  type="range"
                  min={300}
                  max={7200}
                  step={300}
                  value={cacheTTL}
                  onChange={(e) => setCacheTTL(Number(e.target.value))}
                  className="w-full accent-accent"
                />
                <p className="text-[11px] text-accent font-semibold mt-2">
                  {cacheTTL}s
                </p>
              </div>

              {/* Model Tier Slider */}
              <div>
                <label className="text-[11px] text-muted font-semibold mb-2 block">
                  모델 Tier (1-3)
                </label>
                <input
                  type="range"
                  min={1}
                  max={3}
                  step={1}
                  value={modelTier}
                  onChange={(e) => setModelTier(Number(e.target.value))}
                  className="w-full accent-accent"
                />
                <p className="text-[11px] text-accent font-semibold mt-2">
                  Tier {modelTier}
                </p>
              </div>

              {/* Skill Budget Slider */}
              <div>
                <label className="text-[11px] text-muted font-semibold mb-2 block">
                  Skill 토큰 예산
                </label>
                <input
                  type="range"
                  min={100000}
                  max={5000000}
                  step={100000}
                  value={skillBudget}
                  onChange={(e) => setSkillBudget(Number(e.target.value))}
                  className="w-full accent-accent"
                />
                <p className="text-[11px] text-accent font-semibold mt-2">
                  {(skillBudget / 1000000).toFixed(1)}M
                </p>
              </div>
            </div>
          </div>

          {/* Prediction Results */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-navy-light rounded-lg border border-white/[0.06] p-4">
              <p className="text-[10px] text-muted uppercase tracking-wider mb-2">
                월말 예측 비용
              </p>
              <p className="text-3xl font-bold text-accent">
                ${predictedCost.toFixed(2)}
              </p>
              <p className="text-[11px] text-muted mt-2">
                (현재 사용량 기반 선형 외삽)
              </p>
            </div>

            <div className="bg-navy-light rounded-lg border border-white/[0.06] p-4">
              <p className="text-[10px] text-muted uppercase tracking-wider mb-2">
                절감 기대액
              </p>
              <p
                className={`text-3xl font-bold ${
                  costDiff > 0 ? 'text-success' : 'text-danger'
                }`}
              >
                ${Math.abs(costDiff).toFixed(2)}
              </p>
              <p className="text-[11px] text-muted mt-2">
                {costDiff > 0 ? '절감 예상' : '추가 비용 예상'}
              </p>
            </div>
          </div>

          {/* Prediction Chart */}
          <div className="bg-navy-light rounded-lg border border-white/[0.06] p-4">
            <p className="text-xs font-semibold text-white mb-4">예측 그래프</p>
            <div className="flex items-end justify-around gap-2 h-40">
              <div className="flex flex-col items-center flex-1">
                <div
                  className="w-full bg-accent/60 rounded-t"
                  style={{ height: `${Math.min((overview?.currentMonthCost || 0) / 100, 100)}%` }}
                />
                <p className="text-[10px] text-muted mt-2">이번 달 (실제)</p>
              </div>
              <div className="flex flex-col items-center flex-1">
                <div
                  className="w-full bg-success/60 rounded-t"
                  style={{ height: `${Math.min(predictedCost / 100, 100)}%` }}
                />
                <p className="text-[10px] text-muted mt-2">예상 비용</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab: 추천 (Recommend) */}
      {tab === 'recommend' && (
        <div className="space-y-3">
          {loading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div
                  key={i}
                  className="h-20 bg-white/[0.03] rounded animate-pulse"
                />
              ))}
            </div>
          ) : recommendations.length === 0 ? (
            <div className="bg-navy-light rounded-lg border border-white/[0.06] p-8 text-center">
              <Sparkles size={32} className="mx-auto mb-3 text-muted/30" />
              <p className="text-xs text-muted">현재 추천할 최적화가 없습니다</p>
            </div>
          ) : (
            recommendations.map((rec) => (
              <div
                key={rec.id}
                className="bg-navy-light rounded-lg border border-white/[0.06] p-4 hover:border-accent/20 transition"
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="text-xs font-semibold text-white">
                      {rec.agentName}
                    </p>
                    <p className="text-[11px] text-muted mt-1">
                      {rec.action}
                    </p>
                    <p className="text-[11px] text-muted mt-1">
                      {rec.currentTier} → {rec.recommendedTier}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-success">
                      ${rec.savingsAmount.toFixed(2)}
                    </p>
                    <p className="text-[10px] text-muted">월 절감액</p>
                  </div>
                </div>

                <div className="flex gap-2 mt-4">
                  <button className="flex-1 px-3 py-1.5 text-xs font-semibold bg-accent/20 text-accent rounded hover:bg-accent/30 transition">
                    [적용]
                  </button>
                  <button className="flex-1 px-3 py-1.5 text-xs font-semibold border border-white/[0.06] text-muted rounded hover:border-white/[0.12] transition">
                    [무시]
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Tab: 로그 (Logs) */}
      {tab === 'logs' && (
        <div className="bg-navy-light rounded-lg border border-white/[0.06]">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
            <span className="text-xs font-semibold text-white">최근 토큰 호출 로그</span>
            <span className="text-[10px] text-muted">{logs.length}건</span>
          </div>

          {loading ? (
            <div className="p-4 space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-10 bg-white/[0.03] rounded animate-pulse" />
              ))}
            </div>
          ) : logs.length === 0 ? (
            <div className="p-8 text-center text-muted">
              <AlertCircle size={32} className="mx-auto mb-3 opacity-30" />
              <p className="text-xs">로그가 없습니다</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-[10px] text-muted uppercase tracking-wider border-b border-white/[0.04]">
                    <th className="text-left px-4 py-2">시간</th>
                    <th className="text-left px-4 py-2">Agent</th>
                    <th className="text-right px-4 py-2">토큰</th>
                    <th className="text-right px-4 py-2">비용</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.slice(0, 50).map((log) => (
                    <tr
                      key={log.id}
                      className="border-b border-white/[0.03] hover:bg-white/[0.02] transition"
                    >
                      <td className="px-4 py-2.5 text-xs text-muted font-mono">
                        {new Date(log.timestamp).toLocaleString('ko-KR')}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-white font-medium">
                        {log.agentName}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-right text-muted font-mono">
                        {log.tokenCount.toLocaleString()}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-right text-accent font-semibold">
                        ${log.cost.toFixed(4)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Stat Card ──

function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: any;
  label: string;
  value: string;
  color: string;
}) {
  const colorMap: Record<string, string> = {
    accent: 'text-accent',
    success: 'text-success',
    warning: 'text-warning',
    danger: 'text-danger',
    white: 'text-white',
  };

  return (
    <div className="bg-navy-light rounded-lg border border-white/[0.06] p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon size={14} className={colorMap[color] ?? 'text-white'} />
        <p className="text-[10px] text-muted uppercase tracking-wider">{label}</p>
      </div>
      <p className={`text-2xl font-bold ${colorMap[color] ?? 'text-white'}`}>{value}</p>
    </div>
  );
}

// ── Mock Data ──

function getMockOverview(): FinOpsOverview {
  return {
    currentMonthCost: 2450.5,
    previousMonthCost: 2100.0,
    cacheHitRate: 68.5,
    savingsAmount: 320.25,
  };
}

function getMockAgents(): AgentCost[] {
  return [
    {
      agentId: 'agent-1',
      agentName: 'RAG-Chatbot',
      cost: 450.0,
      tokens: 1250000,
      trend: 12.5,
    },
    {
      agentId: 'agent-2',
      agentName: 'Code-Analyzer',
      cost: 380.5,
      tokens: 950000,
      trend: -5.3,
    },
    {
      agentId: 'agent-3',
      agentName: 'Data-Processor',
      cost: 320.0,
      tokens: 820000,
      trend: 8.1,
    },
    {
      agentId: 'agent-4',
      agentName: 'Recommendation-Engine',
      cost: 280.0,
      tokens: 720000,
      trend: -2.4,
    },
    {
      agentId: 'agent-5',
      agentName: 'Risk-Analyzer',
      cost: 210.5,
      tokens: 540000,
      trend: 3.7,
    },
    {
      agentId: 'agent-6',
      agentName: 'Quality-Check',
      cost: 185.0,
      tokens: 480000,
      trend: -1.2,
    },
    {
      agentId: 'agent-7',
      agentName: 'Log-Parser',
      cost: 155.0,
      tokens: 410000,
      trend: 6.5,
    },
    {
      agentId: 'agent-8',
      agentName: 'Summarizer',
      cost: 128.0,
      tokens: 340000,
      trend: 0.9,
    },
    {
      agentId: 'agent-9',
      agentName: 'Translator',
      cost: 95.5,
      tokens: 250000,
      trend: -3.1,
    },
    {
      agentId: 'agent-10',
      agentName: 'Image-Classifier',
      cost: 62.0,
      tokens: 160000,
      trend: 2.3,
    },
  ];
}

function getMockRecommendations(): Recommendation[] {
  return [
    {
      id: 'rec-1',
      agentName: 'RAG-Chatbot',
      action: 'Agent를 Tier 2 → Tier 1로 변경',
      savingsAmount: 450,
      currentTier: 'Tier 2',
      recommendedTier: 'Tier 1',
    },
    {
      id: 'rec-2',
      agentName: 'Code-Analyzer',
      action: 'Cache TTL을 2시간 → 4시간으로 증가',
      savingsAmount: 120,
      currentTier: '2h TTL',
      recommendedTier: '4h TTL',
    },
    {
      id: 'rec-3',
      agentName: 'Data-Processor',
      action: 'Batch 처리로 전환',
      savingsAmount: 95,
      currentTier: 'Real-time',
      recommendedTier: 'Batch',
    },
  ];
}

function getMockLogs(): TokenLog[] {
  const logs: TokenLog[] = [];
  const agentNames = [
    'RAG-Chatbot',
    'Code-Analyzer',
    'Data-Processor',
    'Recommendation-Engine',
  ];

  for (let i = 0; i < 50; i++) {
    const randomAgent = agentNames[Math.floor(Math.random() * agentNames.length)];
    logs.push({
      id: `log-${i}`,
      timestamp: new Date(
        Date.now() - Math.random() * 24 * 60 * 60 * 1000
      ).toISOString(),
      agentId: `agent-${i}`,
      agentName: randomAgent,
      tokenCount: Math.floor(Math.random() * 50000) + 10000,
      cost: Math.random() * 5 + 0.5,
    });
  }

  return logs.sort(
    (a, b) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}
