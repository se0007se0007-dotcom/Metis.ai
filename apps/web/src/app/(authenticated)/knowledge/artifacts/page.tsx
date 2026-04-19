'use client';

import { useState, useEffect, useCallback } from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { api } from '@/lib/api-client';
import {
  RefreshCw, AlertCircle, BookOpen, Star,
} from 'lucide-react';

// ── Types ──

interface KnowledgeArtifact {
  id: string;
  name: string;
  category: string;
  status: string;
  qualityScore: number;
  source: string;
  updatedAt: string;
  content?: string;
  linkedExecutions?: number;
}

// ── Page Component ──

export default function ArtifactsPage() {
  const [artifacts, setArtifacts] = useState<KnowledgeArtifact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedArtifact, setSelectedArtifact] = useState<KnowledgeArtifact | null>(null);

  const fetchArtifacts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<{ items: KnowledgeArtifact[] }>('/knowledge/artifacts');
      setArtifacts(data.items);
    } catch (err: any) {
      console.warn('Failed to fetch artifacts:', err);
      setArtifacts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchArtifacts();
  }, [fetchArtifacts]);

  // Mock artifacts if API not available
  useEffect(() => {
    if (!loading && artifacts.length === 0 && !error) {
      setArtifacts([
        {
          id: 'art-1',
          name: '고객 데이터 검증 규칙',
          category: '데이터 검증',
          status: 'PUBLISHED',
          qualityScore: 92,
          source: 'execution:exec-2024-01-15',
          updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
          linkedExecutions: 45,
        },
        {
          id: 'art-2',
          name: '에러 복구 패턴',
          category: '에러 처리',
          status: 'PUBLISHED',
          qualityScore: 85,
          source: 'execution:exec-2024-01-14',
          updatedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
          linkedExecutions: 28,
        },
        {
          id: 'art-3',
          name: 'API 응답 매핑',
          category: '통합',
          status: 'DRAFT',
          qualityScore: 72,
          source: 'execution:exec-2024-01-13',
          updatedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
          linkedExecutions: 12,
        },
      ]);
    }
  }, [loading, artifacts.length, error]);

  const stats = {
    total: artifacts.length,
    active: artifacts.filter((a) => a.status === 'PUBLISHED').length,
    categories: new Set(artifacts.map((a) => a.category)).size,
    avgQuality: artifacts.length > 0
      ? Math.round(artifacts.reduce((sum, a) => sum + a.qualityScore, 0) / artifacts.length)
      : 0,
  };

  return (
    <div className="p-6">
      <PageHeader
        title="지식 아티팩트 (Knowledge Artifacts)"
        description="학습된 지식 자산 및 재사용 가능한 패턴"
        actions={
          <button
            onClick={fetchArtifacts}
            className="p-1.5 text-gray-500 hover:text-gray-900 transition"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        }
      />

      {/* Summary Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <StatCard label="총 아티팩트" value={stats.total} color="white" />
        <StatCard label="활성" value={stats.active} color="success" />
        <StatCard label="카테고리" value={stats.categories} color="accent" />
        <StatCard label="평균 품질" value={`${stats.avgQuality}%`} color="warning" />
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
        {/* Left: Artifacts Table */}
        <div className="flex-1">
          <div className="bg-gray-50 rounded-lg border border-gray-200">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <BookOpen size={14} className="text-blue-600" />
                <span className="text-xs font-semibold text-gray-900">아티팩트 목록</span>
              </div>
              <span className="text-[10px] text-gray-500">{artifacts.length}개</span>
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
            ) : artifacts.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <BookOpen size={32} className="mx-auto mb-3 opacity-30" />
                <p className="text-xs">아티팩트가 없습니다</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-[10px] text-gray-500 uppercase tracking-wider border-b border-gray-200">
                      <th className="text-left px-4 py-2">이름</th>
                      <th className="text-left px-4 py-2">카테고리</th>
                      <th className="text-left px-4 py-2">상태</th>
                      <th className="text-left px-4 py-2">품질 점수</th>
                      <th className="text-left px-4 py-2">소스</th>
                      <th className="text-left px-4 py-2">수정일</th>
                    </tr>
                  </thead>
                  <tbody>
                    {artifacts.map((artifact) => (
                      <tr
                        key={artifact.id}
                        onClick={() => setSelectedArtifact(artifact)}
                        className={`border-b border-gray-200 hover:bg-white cursor-pointer transition ${
                          selectedArtifact?.id === artifact.id ? 'bg-blue-50' : ''
                        }`}
                      >
                        <td className="px-4 py-2.5 text-xs text-gray-900 font-medium">
                          {artifact.name}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-gray-500">
                          {artifact.category}
                        </td>
                        <td className="px-4 py-2.5">
                          <StatusBadge status={artifact.status} />
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-1">
                            <Star size={12} className="text-amber-600" />
                            <span className="text-xs font-semibold text-gray-900">
                              {artifact.qualityScore}%
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-[10px] text-gray-500 font-mono truncate">
                          {artifact.source}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-gray-500">
                          {new Date(artifact.updatedAt).toLocaleDateString('ko-KR')}
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
          {selectedArtifact ? (
            <>
              <div className="bg-gray-50 rounded-lg border border-gray-200">
                <div className="px-4 py-3 border-b border-gray-200">
                  <span className="text-xs font-semibold text-blue-600 flex items-center gap-1">
                    <BookOpen size={12} />
                    아티팩트 정보
                  </span>
                </div>
                <div className="p-4 space-y-3 text-xs">
                  <div>
                    <p className="text-gray-500 mb-1">이름</p>
                    <p className="text-gray-900 font-semibold">{selectedArtifact.name}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 mb-1">카테고리</p>
                    <p className="text-gray-900">{selectedArtifact.category}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 mb-1">상태</p>
                    <StatusBadge status={selectedArtifact.status} />
                  </div>
                  <div>
                    <p className="text-gray-500 mb-1">품질 점수</p>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-white/[0.06] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-amber-500 rounded-full"
                          style={{ width: `${selectedArtifact.qualityScore}%` }}
                        />
                      </div>
                      <span className="font-semibold text-amber-600">
                        {selectedArtifact.qualityScore}%
                      </span>
                    </div>
                  </div>
                  <div>
                    <p className="text-gray-500 mb-1">소스</p>
                    <p className="font-mono text-gray-900 bg-white p-2 rounded break-all">
                      {selectedArtifact.source}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg border border-gray-200">
                <div className="px-4 py-3 border-b border-gray-200">
                  <span className="text-xs font-semibold text-gray-900">연결된 실행</span>
                </div>
                <div className="p-4">
                  <p className="text-2xl font-bold text-blue-600">
                    {selectedArtifact.linkedExecutions || 0}
                  </p>
                  <p className="text-[10px] text-gray-500 mt-1">
                    이 아티팩트를 사용한 실행
                  </p>
                </div>
              </div>

              {selectedArtifact.content && (
                <div className="bg-gray-50 rounded-lg border border-gray-200">
                  <div className="px-4 py-3 border-b border-gray-200">
                    <span className="text-xs font-semibold text-gray-900">내용 미리보기</span>
                  </div>
                  <div className="p-3">
                    <div className="bg-gray-100 rounded-lg p-3 text-[10px] text-gray-500 max-h-32 overflow-y-auto">
                      {selectedArtifact.content}
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="bg-gray-50 rounded-lg border border-gray-200 p-6 flex flex-col items-center text-center">
              <BookOpen size={32} className="text-gray-500/30 mb-3" />
              <p className="text-xs text-gray-500">왼쪽 목록에서 아티팩트를 선택하세요</p>
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
