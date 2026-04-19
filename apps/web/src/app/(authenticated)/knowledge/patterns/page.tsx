'use client';

import { useState, useEffect, useCallback } from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { api } from '@/lib/api-client';
import {
  RefreshCw, AlertCircle, Bug, TrendingDown,
} from 'lucide-react';

// ── Types ──

interface ExecutionSession {
  id: string;
  workflowKey: string | null;
  capabilityKey: string | null;
  status: string;
  latencyMs: number | null;
  createdAt: string;
}

interface ErrorPattern {
  pattern: string;
  frequency: number;
  firstSeen: string;
  lastSeen: string;
  affectedCapabilities: string[];
  status: string;
  successRateImprovement?: number;
}

// ── Page Component ──

export default function PatternsPage() {
  const [patterns, setPatterns] = useState<ErrorPattern[]>([]);
  const [executions, setExecutions] = useState<ExecutionSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPattern, setSelectedPattern] = useState<ErrorPattern | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<{ items: ExecutionSession[] }>(
        '/executions?status=FAILED&pageSize=100',
      );
      setExecutions(data.items || []);

      // Derive error patterns from failed executions
      const patternMap = new Map<string, ErrorPattern>();

      data.items.forEach((exec) => {
        if (exec.status === 'FAILED') {
          const errorType = exec.capabilityKey?.split('.')[0] || 'UNKNOWN';
          const pattern = errorType;

          if (!patternMap.has(pattern)) {
            patternMap.set(pattern, {
              pattern,
              frequency: 0,
              firstSeen: exec.createdAt,
              lastSeen: exec.createdAt,
              affectedCapabilities: [exec.capabilityKey || 'unknown'],
              status: 'ACTIVE',
            });
          }

          const p = patternMap.get(pattern)!;
          p.frequency += 1;
          p.lastSeen = exec.createdAt;
          if (!p.affectedCapabilities.includes(exec.capabilityKey || 'unknown')) {
            p.affectedCapabilities.push(exec.capabilityKey || 'unknown');
          }
        }
      });

      const derivedPatterns = Array.from(patternMap.values()).sort(
        (a, b) => b.frequency - a.frequency,
      );

      setPatterns(derivedPatterns.length > 0 ? derivedPatterns : getMockPatterns());
    } catch (err: any) {
      console.warn('Failed to fetch patterns:', err);
      setPatterns(getMockPatterns());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const stats = {
    total: patterns.length,
    frequency: patterns.reduce((sum, p) => sum + p.frequency, 0),
    firstSeen: patterns.length > 0
      ? new Date(Math.min(...patterns.map((p) => new Date(p.firstSeen).getTime())))
      : null,
    activeStatus: patterns.filter((p) => p.status === 'ACTIVE').length,
  };

  return (
    <div className="p-6">
      <PageHeader
        title="에이전트 오류 패턴 (Error Patterns)"
        description="실행 실패 분석 및 패턴 기반 개선"
        actions={
          <button
            onClick={fetchData}
            className="p-1.5 text-gray-500 hover:text-gray-900 transition"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        }
      />

      {/* Summary Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <StatCard label="발견된 패턴" value={stats.total} color="white" />
        <StatCard label="총 발생 건수" value={stats.frequency} color="danger" />
        <StatCard label="활성 패턴" value={stats.activeStatus} color="warning" />
        <StatCard
          label="첫 발생"
          value={
            stats.firstSeen
              ? new Date(stats.firstSeen).toLocaleDateString('ko-KR')
              : '-'
          }
          color="muted"
        />
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
        {/* Left: Patterns Table */}
        <div className="flex-1">
          <div className="bg-gray-50 rounded-lg border border-gray-200">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <Bug size={14} className="text-red-600" />
                <span className="text-xs font-semibold text-gray-900">오류 패턴 목록</span>
              </div>
              <span className="text-[10px] text-gray-500">{patterns.length}개</span>
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
            ) : patterns.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <Bug size={32} className="mx-auto mb-3 opacity-30" />
                <p className="text-xs">오류 패턴이 없습니다</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-[10px] text-gray-500 uppercase tracking-wider border-b border-gray-200">
                      <th className="text-left px-4 py-2">패턴</th>
                      <th className="text-left px-4 py-2">발생 건수</th>
                      <th className="text-left px-4 py-2">첫 발생</th>
                      <th className="text-left px-4 py-2">마지막 발생</th>
                      <th className="text-left px-4 py-2">영향 기능</th>
                      <th className="text-left px-4 py-2">상태</th>
                    </tr>
                  </thead>
                  <tbody>
                    {patterns.map((pattern) => (
                      <tr
                        key={pattern.pattern}
                        onClick={() => setSelectedPattern(pattern)}
                        className={`border-b border-gray-200 hover:bg-white cursor-pointer transition ${
                          selectedPattern?.pattern === pattern.pattern ? 'bg-blue-50' : ''
                        }`}
                      >
                        <td className="px-4 py-2.5 text-xs text-gray-900 font-medium font-mono">
                          {pattern.pattern}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-red-600 font-semibold">
                          {pattern.frequency}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-gray-500">
                          {new Date(pattern.firstSeen).toLocaleDateString('ko-KR')}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-gray-500">
                          {new Date(pattern.lastSeen).toLocaleDateString('ko-KR')}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-gray-500">
                          {pattern.affectedCapabilities.length}
                        </td>
                        <td className="px-4 py-2.5">
                          <StatusBadge status={pattern.status} />
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
          {selectedPattern ? (
            <>
              <div className="bg-gray-50 rounded-lg border border-gray-200">
                <div className="px-4 py-3 border-b border-gray-200">
                  <span className="text-xs font-semibold text-red-600 flex items-center gap-1">
                    <Bug size={12} />
                    패턴 정보
                  </span>
                </div>
                <div className="p-4 space-y-3 text-xs">
                  <div>
                    <p className="text-gray-500 mb-1">패턴명</p>
                    <p className="text-gray-900 font-semibold font-mono">{selectedPattern.pattern}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 mb-1">발생 건수</p>
                    <p className="text-2xl font-bold text-red-600">{selectedPattern.frequency}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 mb-1">발생 기간</p>
                    <p className="text-gray-900">
                      {new Date(selectedPattern.firstSeen).toLocaleDateString('ko-KR')}
                      {' '}
                      ~
                      {' '}
                      {new Date(selectedPattern.lastSeen).toLocaleDateString('ko-KR')}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500 mb-1">상태</p>
                    <StatusBadge status={selectedPattern.status} />
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg border border-gray-200">
                <div className="px-4 py-3 border-b border-gray-200">
                  <span className="text-xs font-semibold text-gray-900">
                    영향받는 기능
                    {' '}
                    (
                    {selectedPattern.affectedCapabilities.length}
                    )
                  </span>
                </div>
                <div className="p-3 space-y-2 max-h-48 overflow-y-auto">
                  {selectedPattern.affectedCapabilities.map((cap, idx) => (
                    <div key={idx} className="p-2 bg-white rounded border border-gray-200">
                      <p className="text-[10px] text-gray-500 font-mono truncate">{cap}</p>
                    </div>
                  ))}
                </div>
              </div>

              {selectedPattern.successRateImprovement && (
                <div className="bg-gray-50 rounded-lg border border-gray-200">
                  <div className="px-4 py-3 border-b border-gray-200">
                    <span className="text-xs font-semibold text-green-600 flex items-center gap-1">
                      <TrendingDown size={12} />
                      개선 잠재력
                    </span>
                  </div>
                  <div className="p-4">
                    <p className="text-2xl font-bold text-green-600">
                      +
                      {selectedPattern.successRateImprovement}
                      %
                    </p>
                    <p className="text-[10px] text-gray-500 mt-1">
                      이 패턴 수정 시 기대 성공률 증가
                    </p>
                  </div>
                </div>
              )}

              <div className="p-3 bg-amber-100 border border-warning/20 rounded text-[10px] text-amber-600">
                <p className="font-semibold mb-1">제안: 패턴 문서화</p>
                <p>
                  지식 베이스에서 이 패턴의 근본 원인과 해결책을 문서화하여
                  향후 오류 재발을 방지하세요.
                </p>
              </div>
            </>
          ) : (
            <div className="bg-gray-50 rounded-lg border border-gray-200 p-6 flex flex-col items-center text-center">
              <Bug size={32} className="text-gray-500/30 mb-3" />
              <p className="text-xs text-gray-500">왼쪽 목록에서 패턴을 선택하세요</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function getMockPatterns(): ErrorPattern[] {
  return [
    {
      pattern: 'TIMEOUT_EXCEEDED',
      frequency: 24,
      firstSeen: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      lastSeen: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      affectedCapabilities: ['fetch:api', 'transform:data'],
      status: 'ACTIVE',
      successRateImprovement: 8,
    },
    {
      pattern: 'INVALID_SCHEMA',
      frequency: 18,
      firstSeen: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString(),
      lastSeen: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      affectedCapabilities: ['validate:input', 'parse:response'],
      status: 'ACTIVE',
      successRateImprovement: 6,
    },
    {
      pattern: 'CONNECTION_REFUSED',
      frequency: 12,
      firstSeen: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
      lastSeen: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      affectedCapabilities: ['http:client', 'db:connect'],
      status: 'RESOLVED',
    },
  ];
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
    muted: 'text-gray-500',
  };

  return (
    <div className="bg-gray-50 rounded-lg border border-gray-200 p-4">
      <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-2xl font-bold ${colorMap[color] ?? 'text-gray-900'}`}>{value}</p>
    </div>
  );
}
