'use client';

import { useState, useEffect, useCallback } from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import { api } from '@/lib/api-client';
import {
  RefreshCw, AlertTriangle, AlertOctagon, ShieldAlert, TrendingDown, BarChart3, AlertCircle,
} from 'lucide-react';

// ── Types ──

interface AnomalyAlert {
  id: string;
  type: 'FDS' | 'CIRCUIT_BREAKER' | 'RATE_LIMIT' | 'CANARY_GATE';
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  summary: string;
  timestamp: string;
  source: string;
  resolved: boolean;
}

interface AnomalyStats {
  totalAnomalies24h: number;
  resolvedCount: number;
  criticalCount: number;
  uniqueTypes: number;
}

// ── Page Component ──

export default function AnomaliesPage() {
  const [anomalies, setAnomalies] = useState<AnomalyAlert[]>([]);
  const [stats, setStats] = useState<AnomalyStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [timeRange, setTimeRange] = useState<'1h' | '24h' | '7d'>('24h');
  const [refreshKey, setRefreshKey] = useState(0);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const hours = timeRange === '1h' ? 1 : timeRange === '24h' ? 24 : 168;
      const [fdsData, circuitData, overviewData, canaryData] = await Promise.all([
        api.get<{ items: AnomalyAlert[] }>(`/fds/alerts?hours=${hours}`),
        api.get<{ items: AnomalyAlert[] }>('/connectors/governance/circuits'),
        api.get<AnomalyStats>('/connectors/governance/overview'),
        api.get<{ items: AnomalyAlert[] }>('/canary?status=FAILED'),
      ]);

      const allAnomalies = [
        ...(fdsData?.items || []),
        ...(circuitData?.items || []),
        ...(canaryData?.items || []),
      ].sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );

      setAnomalies(allAnomalies.slice(0, 100) || getMockAnomalies());
      setStats(overviewData || getMockStats());
    } catch (err: any) {
      setError(err.message ?? 'Failed to load anomalies');
      setAnomalies(getMockAnomalies());
      setStats(getMockStats());
    } finally {
      setLoading(false);
    }
  }, [timeRange]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => {
      setRefreshKey((k) => k + 1);
      fetchData();
    }, 30000); // Auto-refresh every 30s
    return () => clearInterval(interval);
  }, [fetchData]);

  // Filtered anomalies
  const filteredAnomalies = anomalies.filter((a) => {
    if (severityFilter !== 'ALL' && a.severity !== severityFilter) return false;
    if (typeFilter !== 'ALL' && a.type !== typeFilter) return false;
    return true;
  });

  // Heatmap data: time × type
  const generateHeatmapData = () => {
    const types = ['FDS', 'CIRCUIT_BREAKER', 'RATE_LIMIT', 'CANARY_GATE'];
    const hours = Array.from({ length: 24 }, (_, i) => i);

    return hours.map((hour) => {
      const hourStart = new Date();
      hourStart.setHours(hour, 0, 0, 0);
      const hourEnd = new Date(hourStart.getTime() + 60 * 60 * 1000);

      return {
        hour,
        data: types.map((type) => {
          const count = anomalies.filter(
            (a) =>
              a.type === type &&
              new Date(a.timestamp) >= hourStart &&
              new Date(a.timestamp) < hourEnd
          ).length;
          return { type, count };
        }),
      };
    });
  };

  const heatmapData = generateHeatmapData();

  const getSeverityColor = (severity: string): string => {
    switch (severity) {
      case 'CRITICAL':
        return 'bg-danger/20 text-danger';
      case 'HIGH':
        return 'bg-warning/20 text-warning';
      case 'MEDIUM':
        return 'bg-accent/20 text-accent';
      default:
        return 'bg-success/20 text-success';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'FDS':
        return <ShieldAlert size={14} />;
      case 'CIRCUIT_BREAKER':
        return <AlertOctagon size={14} />;
      case 'RATE_LIMIT':
        return <TrendingDown size={14} />;
      case 'CANARY_GATE':
        return <BarChart3 size={14} />;
      default:
        return <AlertTriangle size={14} />;
    }
  };

  const getSourceLink = (anomaly: AnomalyAlert): string => {
    switch (anomaly.type) {
      case 'FDS':
        return '/workspaces/risk';
      case 'CIRCUIT_BREAKER':
        return '/platform/circuits';
      case 'CANARY_GATE':
        return '/platform/release';
      default:
        return '/insights/anomalies';
    }
  };

  return (
    <div className="p-6">
      <PageHeader
        title="이상 감지 (Anomalies)"
        description="FDS, Circuit Breaker, Rate Limit, Canary Gate 통합 모니터링"
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

      {/* Top Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <StatCard
          label="24h 이상 감지"
          value={stats?.totalAnomalies24h || 0}
          color="accent"
        />
        <StatCard
          label="처리 완료"
          value={stats?.resolvedCount || 0}
          color="success"
        />
        <StatCard label="CRITICAL" value={stats?.criticalCount || 0} color="danger" />
        <StatCard
          label="유형 수"
          value={stats?.uniqueTypes || 0}
          color="warning"
        />
      </div>

      {/* Time Range & Filters */}
      <div className="flex gap-4 mb-6">
        <div className="flex gap-1">
          {(['1h', '24h', '7d'] as const).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-3 py-1.5 text-xs font-semibold rounded border transition ${
                timeRange === range
                  ? 'bg-accent/20 border-accent text-accent'
                  : 'border-white/[0.06] text-muted hover:text-white'
              }`}
            >
              {range === '1h' && '1시간'}
              {range === '24h' && '24시간'}
              {range === '7d' && '7일'}
            </button>
          ))}
        </div>

        <select
          value={severityFilter}
          onChange={(e) => setSeverityFilter(e.target.value)}
          className="px-3 py-1.5 text-xs bg-navy-light border border-white/[0.06] rounded text-white focus:outline-none focus:ring-1 focus:ring-accent/50"
        >
          <option value="ALL">모든 심각도</option>
          <option value="CRITICAL">CRITICAL</option>
          <option value="HIGH">HIGH</option>
          <option value="MEDIUM">MEDIUM</option>
          <option value="LOW">LOW</option>
        </select>

        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="px-3 py-1.5 text-xs bg-navy-light border border-white/[0.06] rounded text-white focus:outline-none focus:ring-1 focus:ring-accent/50"
        >
          <option value="ALL">모든 유형</option>
          <option value="FDS">FDS</option>
          <option value="CIRCUIT_BREAKER">Circuit Breaker</option>
          <option value="RATE_LIMIT">Rate Limit</option>
          <option value="CANARY_GATE">Canary Gate</option>
        </select>
      </div>

      {/* Heatmap */}
      <div className="bg-navy-light rounded-lg border border-white/[0.06] p-4 mb-6">
        <p className="text-xs font-semibold text-white mb-4">
          시간대별 히트맵 (가로축=시간, 세로축=유형)
        </p>
        <div className="overflow-x-auto">
          <div className="flex gap-1">
            {heatmapData.map((hourData) => (
              <div key={hourData.hour} className="flex flex-col gap-0.5">
                {hourData.data.map((typeData) => {
                  const intensity = Math.min(typeData.count / 5, 1);
                  return (
                    <div
                      key={typeData.type}
                      className="w-6 h-6 rounded border border-white/[0.06] transition"
                      style={{
                        backgroundColor: `rgba(74, 144, 226, ${0.2 + intensity * 0.6})`,
                      }}
                      title={`${typeData.type} at ${hourData.hour}:00 - ${typeData.count} alerts`}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Anomaly Feed */}
      <div className="bg-navy-light rounded-lg border border-white/[0.06]">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
          <span className="text-xs font-semibold text-white">통합 이상 피드</span>
          <span className="text-[10px] text-muted">{filteredAnomalies.length}건</span>
        </div>

        {loading ? (
          <div className="p-4 space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-white/[0.03] rounded animate-pulse" />
            ))}
          </div>
        ) : filteredAnomalies.length === 0 ? (
          <div className="p-8 text-center text-muted">
            <AlertCircle size={32} className="mx-auto mb-3 opacity-30" />
            <p className="text-xs">해당하는 이상이 없습니다</p>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.03]">
            {filteredAnomalies.slice(0, 100).map((anomaly) => (
              <div
                key={anomaly.id}
                className="px-4 py-3 hover:bg-white/[0.02] transition cursor-pointer"
                onClick={() => {
                  window.location.href = getSourceLink(anomaly);
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1">
                    <div className="text-accent mt-0.5">
                      {getTypeIcon(anomaly.type)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-xs font-semibold text-white">
                          {anomaly.type}
                        </p>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold ${getSeverityColor(
                            anomaly.severity
                          )}`}
                        >
                          {anomaly.severity}
                        </span>
                        {anomaly.resolved && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-success/20 text-success">
                            처리됨
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-muted">{anomaly.summary}</p>
                      <p className="text-[10px] text-muted/60 mt-1">
                        {new Date(anomaly.timestamp).toLocaleString('ko-KR')}
                      </p>
                    </div>
                  </div>

                  <button className="px-2.5 py-1 text-xs font-semibold border border-white/[0.06] text-white rounded hover:border-accent hover:text-accent transition">
                    상세보기
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Stat Card ──

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number | string;
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
      <p className="text-[10px] text-muted uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-2xl font-bold ${colorMap[color] ?? 'text-white'}`}>{value}</p>
    </div>
  );
}

// ── Mock Data ──

function getMockStats(): AnomalyStats {
  return {
    totalAnomalies24h: 24,
    resolvedCount: 18,
    criticalCount: 3,
    uniqueTypes: 4,
  };
}

function getMockAnomalies(): AnomalyAlert[] {
  const types: Array<'FDS' | 'CIRCUIT_BREAKER' | 'RATE_LIMIT' | 'CANARY_GATE'> = [
    'FDS',
    'CIRCUIT_BREAKER',
    'RATE_LIMIT',
    'CANARY_GATE',
  ];
  const severities: Array<'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'> = [
    'CRITICAL',
    'HIGH',
    'MEDIUM',
    'LOW',
  ];
  const summaries: Record<string, string[]> = {
    FDS: [
      '비정상적인 거래 패턴 감지',
      'Fraud score 임계값 초과',
      '의심 사용자 활동',
    ],
    CIRCUIT_BREAKER: [
      'API 응답 시간 초과',
      '서비스 가용성 저하',
      '연속 실패율 증가',
    ],
    RATE_LIMIT: [
      '요청률 임계값 초과',
      'API 한도 도달',
      '토큰 사용량 급증',
    ],
    CANARY_GATE: [
      'Canary 배포 실패',
      '에러율 증가 감지',
      'SLO 위반',
    ],
  };

  const anomalies: AnomalyAlert[] = [];
  for (let i = 0; i < 60; i++) {
    const type = types[Math.floor(Math.random() * types.length)];
    const severity = severities[Math.floor(Math.random() * severities.length)];
    const summary = summaries[type][Math.floor(Math.random() * summaries[type].length)];

    anomalies.push({
      id: `anomaly-${i}`,
      type,
      severity,
      summary,
      timestamp: new Date(
        Date.now() - Math.random() * 24 * 60 * 60 * 1000
      ).toISOString(),
      source: `source-${i}`,
      resolved: Math.random() > 0.3,
    });
  }

  return anomalies.sort(
    (a, b) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}
