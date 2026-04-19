'use client';

import { useState, useEffect, useCallback } from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { api } from '@/lib/api-client';
import {
  RefreshCw, AlertCircle, FileText, Copy, ChevronDown,
} from 'lucide-react';

// ── Types ──

interface AuditLog {
  id: string;
  action: string;
  targetType: string;
  targetId: string;
  userId: string;
  correlationId: string;
  policyKey: string | null;
  status: string;
  createdAt: string;
}

interface EvidencePack {
  id: string;
  packName: string;
  type: string;
  period: string;
  status: string;
  itemCount: number;
  generated: string;
  logs: AuditLog[];
}

// ── Page Component ──

export default function EvidencePage() {
  const [packs, setPacks] = useState<EvidencePack[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPack, setSelectedPack] = useState<EvidencePack | null>(null);

  const fetchPacks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch audit logs and group by correlationId to simulate evidence packs
      const data = await api.get<{ items: AuditLog[] }>('/governance/audit-logs');
      const logs = data?.items ?? [];

      // Group logs by targetType to create evidence packs
      const groupedByType = new Map<string, AuditLog[]>();
      logs.forEach((log) => {
        if (!groupedByType.has(log.targetType)) {
          groupedByType.set(log.targetType, []);
        }
        const logsForType = groupedByType.get(log.targetType);
        if (logsForType) {
          logsForType.push(log);
        }
      });

      // Convert grouped logs into evidence packs
      const packsData: EvidencePack[] = Array.from(groupedByType.entries()).map(
        ([type, typeLogs], idx) => ({
          id: `pack-${idx}`,
          packName: `증적-${type}-${new Date().getFullYear()}`,
          type,
          period: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`,
          status: typeLogs.some((l) => l.status === 'PASS') ? 'PASS' : 'WARN',
          itemCount: typeLogs.length,
          generated: new Date(
            Math.max(...typeLogs.map((l) => new Date(l.createdAt).getTime())),
          ).toISOString(),
          logs: typeLogs,
        }),
      );

      setPacks(packsData);
    } catch (err: any) {
      console.warn('Failed to fetch evidence packs:', err);
      setPacks([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPacks();
  }, [fetchPacks]);

  const stats = {
    total: packs.length,
    thisMonth: packs.length,
    complianceRate: packs.length > 0
      ? Math.round((packs.filter((p) => p.status === 'PASS').length / packs.length) * 100)
      : 0,
    pendingReview: packs.filter((p) => p.status === 'WARN').length,
  };

  return (
    <div className="p-6">
      <PageHeader
        title="증적 패키지 (Evidence Pack)"
        description="거버넌스 증적 패키지 생성 및 조회"
        actions={
          <button
            onClick={fetchPacks}
            className="p-1.5 text-gray-500 hover:text-gray-900 transition"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        }
      />

      {/* Summary Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <StatCard label="전체 패키지" value={stats.total} color="white" />
        <StatCard label="이번 달" value={stats.thisMonth} color="accent" />
        <StatCard label="준수율" value={`${stats.complianceRate}%`} color="success" />
        <StatCard label="검토 대기" value={stats.pendingReview} color="warning" />
      </div>

      {/* Error State */}
      {error && (
        <div className="flex items-center gap-2 p-3 mb-4 bg-red-100 border border-red-200 rounded text-xs text-red-600">
          <AlertCircle size={14} />
          {error}
        </div>
      )}

      {/* Two-Column Layout */}
      <div className="flex gap-4">
        {/* Left: Packs Table */}
        <div className="flex-1">
          <div className="bg-gray-50 rounded-lg border border-gray-200">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <FileText size={14} className="text-blue-600" />
                <span className="text-xs font-semibold text-gray-900">증적 패키지 목록</span>
              </div>
              <span className="text-[10px] text-gray-500">{packs.length}개</span>
            </div>

            {loading ? (
              <div className="p-4 space-y-3">
                {[...Array(4)].map((_, i) => (
                  <div
                    key={i}
                    className="h-12 bg-white rounded animate-pulse"
                  />
                ))}
              </div>
            ) : packs.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <FileText size={32} className="mx-auto mb-3 opacity-30" />
                <p className="text-xs">증적 패키지가 없습니다</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-[10px] text-gray-500 uppercase tracking-wider border-b border-gray-200">
                      <th className="text-left px-4 py-2">패키지명</th>
                      <th className="text-left px-4 py-2">유형</th>
                      <th className="text-left px-4 py-2">기간</th>
                      <th className="text-left px-4 py-2">상태</th>
                      <th className="text-left px-4 py-2">항목 수</th>
                      <th className="text-left px-4 py-2">생성일</th>
                    </tr>
                  </thead>
                  <tbody>
                    {packs.map((pack) => (
                      <tr
                        key={pack.id}
                        onClick={() => setSelectedPack(pack)}
                        className={`border-b border-gray-200 hover:bg-white cursor-pointer transition ${
                          selectedPack?.id === pack.id ? 'bg-blue-50' : ''
                        }`}
                      >
                        <td className="px-4 py-2.5 text-xs text-gray-900 font-medium">
                          {pack.packName}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-gray-500">
                          {pack.type}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-gray-500">
                          {pack.period}
                        </td>
                        <td className="px-4 py-2.5">
                          <StatusBadge status={pack.status} />
                        </td>
                        <td className="px-4 py-2.5 text-xs text-blue-600 font-semibold">
                          {pack.itemCount}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-gray-500">
                          {new Date(pack.generated).toLocaleDateString('ko-KR')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Right: Detail Panel */}
        <div className="w-96 flex-shrink-0 space-y-4">
          {selectedPack ? (
            <>
              <div className="bg-gray-50 rounded-lg border border-gray-200">
                <div className="px-4 py-3 border-b border-gray-200">
                  <span className="text-xs font-semibold text-blue-600 flex items-center gap-1">
                    <FileText size={12} />
                    패키지 정보
                  </span>
                </div>
                <div className="p-4 space-y-3 text-xs">
                  <div>
                    <p className="text-gray-500 mb-1">패키지명</p>
                    <p className="text-gray-900 font-semibold">{selectedPack.packName}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 mb-1">유형</p>
                    <p className="text-gray-900">{selectedPack.type}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 mb-1">기간</p>
                    <p className="text-gray-900">{selectedPack.period}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 mb-1">상태</p>
                    <StatusBadge status={selectedPack.status} />
                  </div>
                  <div>
                    <p className="text-gray-500 mb-1">항목 수</p>
                    <p className="text-gray-900 font-semibold">{selectedPack.itemCount}</p>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg border border-gray-200">
                <div className="px-4 py-3 border-b border-gray-200">
                  <span className="text-xs font-semibold text-gray-900">증적 항목</span>
                </div>
                <div className="p-3 space-y-2 max-h-64 overflow-y-auto">
                  {(selectedPack?.logs ?? []).length === 0 ? (
                    <p className="text-[10px] text-gray-500">항목이 없습니다</p>
                  ) : (
                    (selectedPack?.logs ?? []).map((log, idx) => (
                      <div
                        key={log.id}
                        className="p-2 bg-white rounded border border-gray-200 text-[10px]"
                      >
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <p className="text-gray-900 font-mono truncate">{log.correlationId}</p>
                          <StatusBadge status={log.status} />
                        </div>
                        <p className="text-gray-500">액션: {log.action}</p>
                        <p className="text-gray-500">대상: {log.targetType}</p>
                        <p className="text-gray-500 text-[9px]">
                          {new Date(log.createdAt).toLocaleDateString('ko-KR')}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="bg-gray-50 rounded-lg border border-gray-200 p-6 flex flex-col items-center text-center">
              <FileText size={32} className="text-gray-500/30 mb-3" />
              <p className="text-xs text-gray-500">왼쪽 목록에서 패키지를 선택하세요</p>
            </div>
          )}
        </div>
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
    accent: 'text-blue-600',
    success: 'text-green-600',
    warning: 'text-amber-600',
    danger: 'text-red-600',
    white: 'text-gray-900',
  };

  return (
    <div className="bg-gray-50 rounded-lg border border-gray-200 p-4">
      <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-2xl font-bold ${colorMap[color] ?? 'text-gray-900'}`}>{value}</p>
    </div>
  );
}
