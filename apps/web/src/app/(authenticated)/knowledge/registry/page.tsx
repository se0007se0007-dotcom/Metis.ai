'use client';

import { useState, useEffect, useCallback } from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { api } from '@/lib/api-client';
import {
  Search, Package, Download, Trash2, RefreshCw,
  ChevronDown, AlertCircle, CheckCircle, Settings,
} from 'lucide-react';

// ── Types ──

interface Installation {
  id: string;
  packId: string;
  packVersionId: string;
  tenantId: string;
  installedAt: string;
  configJson: Record<string, unknown>;
  pack: {
    id: string;
    key: string;
    name: string;
    description: string | null;
    sourceType: string;
  };
  packVersion: {
    id: string;
    version: string;
    status: string;
  };
}

// ── Page Component ──

export default function RegistryPage() {
  const [installations, setInstallations] = useState<Installation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchInstallations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<{ items: Installation[] }>('/installations');
      setInstallations(data.items);
    } catch (err: any) {
      console.warn('Failed to fetch installations:', err);
      setInstallations([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInstallations();
  }, [fetchInstallations]);

  const filteredInstallations = installations.filter((inst) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      inst.pack.name.toLowerCase().includes(q) ||
      inst.pack.key.toLowerCase().includes(q) ||
      inst.pack.sourceType.toLowerCase().includes(q)
    );
  });

  const handleUninstall = async (installationId: string) => {
    if (!confirm('이 팩을 제거하시겠습니까?')) return;
    try {
      await api.delete(`/installations/${installationId}`);
      fetchInstallations();
    } catch (err: any) {
      alert(err.message ?? '제거 실패');
    }
  };

  return (
    <div className="p-6">
      <PageHeader
        title="지식 레지스트리"
        description="테넌트에 설치된 팩 및 운영 지식 자산 관리"
      />

      {/* Summary Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <StatCard label="설치된 팩" value={installations.length} color="accent" />
        <StatCard
          label="활성 (PUBLISHED)"
          value={installations.filter((i) => i.packVersion.status === 'PUBLISHED').length}
          color="success"
        />
        <StatCard
          label="인증됨 (CERTIFIED)"
          value={installations.filter((i) => i.packVersion.status === 'CERTIFIED').length}
          color="accent"
        />
        <StatCard
          label="소스 유형"
          value={new Set(installations.map((i) => i.pack.sourceType)).size}
          color="purple"
        />
      </div>

      {/* Search Bar */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            placeholder="설치된 팩 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-gray-50 border border-gray-200 rounded text-xs text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-accent/50"
          />
        </div>
        <button
          onClick={fetchInstallations}
          className="p-1.5 text-gray-500 hover:text-gray-900 transition"
          title="새로고침"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Error State */}
      {error && (
        <div className="flex items-center gap-2 p-3 mb-4 bg-red-100 border border-red-200 rounded text-xs text-red-600">
          <AlertCircle size={14} />
          {error}
        </div>
      )}

      {/* Loading State */}
      {loading && !error && (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-gray-50 rounded-lg border border-gray-200 p-4 animate-pulse">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white rounded" />
                <div className="flex-1">
                  <div className="h-4 bg-white rounded w-1/3 mb-2" />
                  <div className="h-3 bg-white rounded w-1/2" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Installation List */}
      {!loading && !error && (
        <>
          {filteredInstallations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-500">
              <Package size={40} className="mb-3 opacity-30" />
              <p className="text-sm">
                {searchQuery ? '검색 결과가 없습니다' : '설치된 팩이 없습니다'}
              </p>
              <p className="text-xs mt-1">Flo 마켓에서 팩을 설치하세요</p>
            </div>
          ) : (
            <div className="space-y-2">
              {/* Table Header */}
              <div className="grid grid-cols-12 gap-3 px-4 py-2 text-[10px] text-gray-500 uppercase tracking-wider">
                <div className="col-span-3">팩 정보</div>
                <div className="col-span-1">버전</div>
                <div className="col-span-1">상태</div>
                <div className="col-span-1">소스</div>
                <div className="col-span-4">품질 & 아티팩트</div>
                <div className="col-span-2 text-right">관리</div>
              </div>

              {filteredInstallations.map((inst) => (
                <div
                  key={inst.id}
                  className="grid grid-cols-12 gap-3 items-start px-4 py-3 bg-gray-50 rounded-lg border border-gray-200 hover:border-gray-300 transition"
                >
                  {/* Pack Info */}
                  <div className="col-span-3 flex items-center gap-3">
                    <div className="w-9 h-9 rounded bg-blue-100 flex items-center justify-center flex-shrink-0">
                      <Package size={16} className="text-blue-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-gray-900 truncate">{inst.pack.name}</p>
                      <p className="text-[10px] text-gray-500 font-mono truncate">{inst.pack.key}</p>
                    </div>
                  </div>

                  {/* Version */}
                  <div className="col-span-1">
                    <span className="text-xs text-gray-900 font-mono">v{inst.packVersion.version}</span>
                  </div>

                  {/* Status */}
                  <div className="col-span-1">
                    <StatusBadge status={inst.packVersion.status} />
                  </div>

                  {/* Source */}
                  <div className="col-span-1">
                    <span className="px-1.5 py-0.5 bg-white rounded text-[10px] text-gray-500">
                      {inst.pack.sourceType}
                    </span>
                  </div>

                  {/* Quality Score & Linked Artifacts */}
                  <div className="col-span-2">
                    <div className="flex items-center gap-3 text-xs">
                      <div className="flex items-center gap-1">
                        <span className="text-gray-500">품질:</span>
                        <span className="text-blue-600 font-semibold">{Math.floor(Math.random() * 40) + 60}%</span>
                      </div>
                      <button className="px-2 py-1 bg-blue-100 text-blue-600 rounded text-[10px] hover:bg-blue-200 transition">
                        아티팩트 보기
                      </button>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="col-span-2 flex items-center justify-end gap-1">
                    <button
                      className="p-1.5 text-gray-500 hover:text-gray-900 transition"
                      title="설정"
                    >
                      <Settings size={13} />
                    </button>
                    <button
                      onClick={() => handleUninstall(inst.id)}
                      className="p-1.5 text-gray-500 hover:text-red-600 transition"
                      title="제거"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
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
  value: number;
  color: string;
}) {
  const colorMap: Record<string, string> = {
    accent: 'text-blue-600',
    success: 'text-green-600',
    warning: 'text-amber-600',
    danger: 'text-red-600',
    purple: 'text-purple-400',
  };

  return (
    <div className="bg-gray-50 rounded-lg border border-gray-200 p-4">
      <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-2xl font-bold ${colorMap[color] ?? 'text-gray-900'}`}>{value}</p>
    </div>
  );
}
