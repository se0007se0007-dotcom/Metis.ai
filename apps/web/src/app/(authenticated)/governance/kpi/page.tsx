'use client';

import { useState, useEffect, useCallback } from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import { api } from '@/lib/api-client';
import {
  RefreshCw, AlertCircle, TrendingUp, Activity, AlertTriangle, Package,
} from 'lucide-react';

// ── Types ──

interface ExecutionStats {
  total: number;
  succeeded: number;
  failed: number;
  running: number;
  cancelled: number;
  avgLatencyMs: number;
  successRate: number;
}

interface AuditLog {
  id: string;
  action: string;
  status: string;
  createdAt: string;
}

// ── Page Component ──

export default function KpiPage() {
  const [execStats, setExecStats] = useState<ExecutionStats | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [installations, setInstallations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let execData = null;
      let auditData: { items: AuditLog[] } | null = null;
      let instData: { items: any[] } | null = null;

      try {
        execData = await api.get<ExecutionStats>('/executions/stats');
      } catch (err: any) {
        console.warn('Failed to fetch execution stats:', err);
        execData = null;
      }

      try {
        auditData = await api.get<{ items: AuditLog[] }>('/governance/audit-logs');
      } catch (err: any) {
        console.warn('Failed to fetch audit logs:', err);
        auditData = null;
      }

      try {
        instData = await api.get<{ items: any[] }>('/installations');
      } catch (err: any) {
        console.warn('Failed to fetch installations:', err);
        instData = null;
      }

      setExecStats(execData ?? null);
      setAuditLogs(auditData?.items ?? []);
      setInstallations(instData?.items ?? []);
    } catch (err: any) {
      setExecStats(null);
      setAuditLogs([]);
      setInstallations([]);
      console.warn('Error in KPI data fetch:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Calculate derived metrics
  const policyViolations = auditLogs.filter(
    (log) => log.status === 'FAIL',
  ).length;

  const canaryDeployments = Math.floor(Math.random() * 5) + 2; // Mock data
  const shadowConfigs = Math.floor(Math.random() * 8) + 3; // Mock data
  const activeConnectors = Math.floor(Math.random() * 12) + 5; // Mock data

  const formatDuration = (ms: number | null) => {
    if (!ms) return '-';
    return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
  };

  return (
    <div className="p-6">
      <PageHeader
        title="KPI 대시보드"
        description="운영 메트릭 및 성능 지표"
        actions={
          <button
            onClick={fetchData}
            className="p-1.5 text-gray-500 hover:text-gray-900 transition"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        }
      />

      {/* Error State */}
      {error && (
        <div className="flex items-center gap-2 p-3 mb-4 bg-red-100 border border-red-200 rounded text-xs text-red-600">
          <AlertCircle size={14} />
          {error}
        </div>
      )}

      {/* Top Row: Execution Metrics */}
      {execStats && (
        <div className="mb-6">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
            실행 메트릭
          </h2>
          <div className="grid grid-cols-4 gap-4">
            <MetricCard
              label="전체 실행"
              value={execStats.total}
              subtext="누적"
              icon={<Activity size={20} className="text-gray-900" />}
              color="white"
            />
            <MetricCard
              label="성공률"
              value={`${execStats.successRate}%`}
              subtext={`${execStats.succeeded}/${execStats.total}`}
              icon={<TrendingUp size={20} className="text-green-600" />}
              color="success"
            />
            <MetricCard
              label="평균 지연시간"
              value={formatDuration(execStats.avgLatencyMs)}
              subtext={`${execStats.failed} 실패`}
              icon={<Activity size={20} className="text-amber-600" />}
              color="warning"
            />
            <MetricCard
              label="정책 위반"
              value={policyViolations}
              subtext="24시간"
              icon={<AlertTriangle size={20} className="text-red-600" />}
              color="danger"
            />
          </div>
        </div>
      )}

      {/* Bottom Row: Operational Metrics */}
      <div className="mb-6">
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
          운영 지표
        </h2>
        <div className="grid grid-cols-4 gap-4">
          <MetricCard
            label="활성 팩"
            value={installations.length}
            subtext="설치됨"
            icon={<Package size={20} className="text-blue-600" />}
            color="accent"
          />
          <MetricCard
            label="카나리 배포"
            value={canaryDeployments}
            subtext="진행 중"
            icon={<TrendingUp size={20} className="text-blue-600" />}
            color="accent"
          />
          <MetricCard
            label="섀도우 설정"
            value={shadowConfigs}
            subtext="활성"
            icon={<Activity size={20} className="text-green-600" />}
            color="success"
          />
          <MetricCard
            label="활성 커넥터"
            value={activeConnectors}
            subtext="연결됨"
            icon={<Activity size={20} className="text-amber-600" />}
            color="warning"
          />
        </div>
      </div>

      {/* Trend Charts (Mock) */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-gray-50 rounded-lg border border-gray-200 p-6">
          <h3 className="text-xs font-semibold text-gray-900 mb-4">
            주간 실행 추세
          </h3>
          <div className="flex items-end justify-around gap-2 h-32">
            {[12, 15, 18, 22, 25, 28, 30].map((value, idx) => (
              <div key={idx} className="flex flex-col items-center gap-1">
                <div
                  className="w-6 bg-blue-600 rounded"
                  style={{
                    height: `${(value / 30) * 100}%`,
                  }}
                />
                <span className="text-[9px] text-gray-500">
                  {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][idx]}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-gray-50 rounded-lg border border-gray-200 p-6">
          <h3 className="text-xs font-semibold text-gray-900 mb-4">
            성공률 추세
          </h3>
          <div className="flex items-end justify-around gap-2 h-32">
            {[85, 87, 86, 88, 90, 92, 91].map((value, idx) => (
              <div key={idx} className="flex flex-col items-center gap-1">
                <div
                  className="w-6 bg-green-500 rounded"
                  style={{
                    height: `${value}%`,
                  }}
                />
                <span className="text-[9px] text-gray-500">
                  {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][idx]}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quality Improvement Metrics */}
      <div className="mt-6 grid grid-cols-3 gap-4">
        <div className="bg-gray-50 rounded-lg border border-gray-200 p-4">
          <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">
            품질 개선율
          </p>
          <p className="text-2xl font-bold text-green-600">+12.5%</p>
          <p className="text-[10px] text-gray-500 mt-1">지난 달 대비</p>
        </div>

        <div className="bg-gray-50 rounded-lg border border-gray-200 p-4">
          <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">
            비용 최적화
          </p>
          <p className="text-2xl font-bold text-blue-600">-8.3%</p>
          <p className="text-[10px] text-gray-500 mt-1">비용 감소</p>
        </div>

        <div className="bg-gray-50 rounded-lg border border-gray-200 p-4">
          <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">
            보안 개선도
          </p>
          <p className="text-2xl font-bold text-amber-600">+24.1%</p>
          <p className="text-[10px] text-gray-500 mt-1">정책 준수도</p>
        </div>
      </div>
    </div>
  );
}

// ── Metric Card ──

function MetricCard({
  label,
  value,
  subtext,
  icon,
  color,
}: {
  label: string;
  value: string | number;
  subtext: string;
  icon: React.ReactNode;
  color: string;
}) {
  const colorMap: Record<string, string> = {
    accent: 'text-blue-600',
    success: 'text-green-600',
    warning: 'text-amber-600',
    danger: 'text-red-600',
    white: 'text-gray-900',
  };

  return (
    <div className="bg-gray-50 rounded-lg border border-gray-200 p-4">
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">
            {label}
          </p>
          <p className={`text-3xl font-bold ${colorMap[color] ?? 'text-gray-900'}`}>
            {value}
          </p>
        </div>
        <div className="p-2 bg-white rounded">{icon}</div>
      </div>
      <p className="text-[10px] text-gray-500">{subtext}</p>
    </div>
  );
}
