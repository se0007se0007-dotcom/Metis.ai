'use client';

import { useState, useEffect, useCallback } from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { api } from '@/lib/api-client';
import {
  RefreshCw, AlertCircle, Users, Search, Mail, LogIn, Clock,
} from 'lucide-react';

// ── Types ──

interface TenantMember {
  id: string;
  email: string;
  name: string;
  role: string;
  status: string;
  lastActiveAt: string | null;
  createdAt: string;
}

// ── Page Component ──

export default function UsersPage() {
  const [members, setMembers] = useState<TenantMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMember, setSelectedMember] = useState<TenantMember | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchMembers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<{ items: TenantMember[] }>('/tenants/current/members');
      setMembers(data.items || getMockMembers());
    } catch (err: any) {
      setError(err.message ?? 'Failed to load members');
      setMembers(getMockMembers());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  const filteredMembers = members.filter((member) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      member.name.toLowerCase().includes(q)
      || member.email.toLowerCase().includes(q)
      || member.role.toLowerCase().includes(q)
    );
  });

  const stats = {
    total: members.length,
    admin: members.filter((m) => m.role.includes('ADMIN')).length,
    developer: members.filter((m) => m.role === 'DEVELOPER').length,
    operator: members.filter((m) => m.role === 'OPERATOR').length,
  };

  const getRoleBadgeColor = (role: string): string => {
    if (role.includes('PLATFORM_ADMIN') || role.includes('TENANT_ADMIN')) return 'danger';
    if (role === 'DEVELOPER') return 'accent';
    if (role === 'OPERATOR') return 'success';
    return 'warning';
  };

  return (
    <div className="p-6">
      <PageHeader
        title="사용자 관리 (User Management)"
        description="테넌트 멤버 및 역할 관리"
        actions={
          <button
            onClick={fetchMembers}
            className="p-1.5 text-muted hover:text-white transition"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        }
      />

      {/* Summary Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <StatCard label="전체 사용자" value={stats.total} color="white" />
        <StatCard label="관리자" value={stats.admin} color="danger" />
        <StatCard label="개발자" value={stats.developer} color="accent" />
        <StatCard label="운영자" value={stats.operator} color="success" />
      </div>

      {/* Error State */}
      {error && (
        <div className="flex items-center gap-2 p-3 mb-4 bg-danger/10 border border-danger/20 rounded text-xs text-danger">
          <AlertCircle size={14} />
          {error}
        </div>
      )}

      {/* Search Bar */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="text"
            placeholder="사용자 검색 (이름, 이메일, 역할)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-navy-light border border-white/[0.06] rounded text-xs text-white placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-accent/50"
          />
        </div>
      </div>

      {/* Two-Column Layout */}
      <div className="flex gap-4">
        {/* Left: Users Table */}
        <div className="flex-1">
          <div className="bg-navy-light rounded-lg border border-white/[0.06]">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
              <div className="flex items-center gap-2">
                <Users size={14} className="text-accent" />
                <span className="text-xs font-semibold text-white">사용자 목록</span>
              </div>
              <span className="text-[10px] text-muted">{filteredMembers.length}명</span>
            </div>

            {loading ? (
              <div className="p-4 space-y-3">
                {[...Array(4)].map((_, i) => (
                  <div
                    key={i}
                    className="h-12 bg-white/[0.03] rounded animate-pulse"
                  />
                ))}
              </div>
            ) : members.length === 0 ? (
              <div className="p-8 text-center text-muted">
                <Users size={32} className="mx-auto mb-3 opacity-30" />
                <p className="text-xs">사용자가 없습니다</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-[10px] text-muted uppercase tracking-wider border-b border-white/[0.04]">
                      <th className="text-left px-4 py-2">이름</th>
                      <th className="text-left px-4 py-2">이메일</th>
                      <th className="text-left px-4 py-2">역할</th>
                      <th className="text-left px-4 py-2">상태</th>
                      <th className="text-left px-4 py-2">마지막 활동</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMembers.map((member) => (
                      <tr
                        key={member.id}
                        onClick={() => setSelectedMember(member)}
                        className={`border-b border-white/[0.03] hover:bg-white/[0.02] cursor-pointer transition ${
                          selectedMember?.id === member.id ? 'bg-accent/5' : ''
                        }`}
                      >
                        <td className="px-4 py-2.5 text-xs text-white font-medium">
                          {member.name}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-muted font-mono">
                          {member.email}
                        </td>
                        <td className="px-4 py-2.5 text-xs">
                          <RoleBadge role={member.role} color={getRoleBadgeColor(member.role)} />
                        </td>
                        <td className="px-4 py-2.5">
                          <StatusBadge status={member.status} />
                        </td>
                        <td className="px-4 py-2.5 text-xs text-muted">
                          {member.lastActiveAt
                            ? new Date(member.lastActiveAt).toLocaleDateString('ko-KR')
                            : 'Never'}
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
          {selectedMember ? (
            <>
              <div className="bg-navy-light rounded-lg border border-white/[0.06]">
                <div className="px-4 py-3 border-b border-white/[0.06]">
                  <span className="text-xs font-semibold text-accent flex items-center gap-1">
                    <Users size={12} />
                    사용자 정보
                  </span>
                </div>
                <div className="p-4 space-y-3 text-xs">
                  <div>
                    <p className="text-muted mb-1">이름</p>
                    <p className="text-white font-semibold">{selectedMember.name}</p>
                  </div>
                  <div>
                    <p className="text-muted mb-1">이메일</p>
                    <div className="flex items-center gap-2">
                      <Mail size={12} className="text-muted" />
                      <p className="text-white font-mono">{selectedMember.email}</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-muted mb-1">역할</p>
                    <RoleBadge role={selectedMember.role} color={getRoleBadgeColor(selectedMember.role)} />
                  </div>
                  <div>
                    <p className="text-muted mb-1">상태</p>
                    <StatusBadge status={selectedMember.status} />
                  </div>
                  <div>
                    <p className="text-muted mb-1">가입 날짜</p>
                    <p className="text-white">
                      {new Date(selectedMember.createdAt).toLocaleDateString('ko-KR')}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-navy-light rounded-lg border border-white/[0.06]">
                <div className="px-4 py-3 border-b border-white/[0.06]">
                  <span className="text-xs font-semibold text-white flex items-center gap-1">
                    <LogIn size={12} />
                    활동 정보
                  </span>
                </div>
                <div className="p-4 space-y-3 text-xs">
                  <div>
                    <p className="text-muted mb-1 flex items-center gap-1">
                      <Clock size={11} />
                      마지막 활동
                    </p>
                    <p className="text-white">
                      {selectedMember.lastActiveAt
                        ? new Date(selectedMember.lastActiveAt).toLocaleString('ko-KR')
                        : '활동 기록 없음'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-navy-light rounded-lg border border-white/[0.06]">
                <div className="px-4 py-3 border-b border-white/[0.06]">
                  <span className="text-xs font-semibold text-white">권한</span>
                </div>
                <div className="p-4 space-y-2 text-xs">
                  {getRolePermissions(selectedMember.role).map((perm, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2 text-muted"
                    >
                      <span className="text-success">✓</span>
                      {perm}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-2">
                <button className="flex-1 px-3 py-2 border border-white/[0.06] text-white rounded text-xs font-semibold hover:border-white/[0.12] transition">
                  역할 변경
                </button>
                <button className="flex-1 px-3 py-2 border border-danger/20 text-danger rounded text-xs font-semibold hover:border-danger/40 transition">
                  제거
                </button>
              </div>
            </>
          ) : (
            <div className="bg-navy-light rounded-lg border border-white/[0.06] p-6 flex flex-col items-center text-center">
              <Users size={32} className="text-muted/30 mb-3" />
              <p className="text-xs text-muted">왼쪽 목록에서 사용자를 선택하세요</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Role Badge ──

function RoleBadge({ role, color }: { role: string; color: string }) {
  const colorMap: Record<string, string> = {
    danger: 'bg-danger/20 text-danger',
    accent: 'bg-accent/20 text-accent',
    success: 'bg-success/20 text-success',
    warning: 'bg-warning/20 text-warning',
  };

  const roleDisplay = role
    .replace(/_/g, ' ')
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');

  return (
    <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold ${colorMap[color] ?? 'bg-muted/20 text-muted'}`}>
      {roleDisplay}
    </span>
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

function getRolePermissions(role: string): string[] {
  const permissions: Record<string, string[]> = {
    PLATFORM_ADMIN: [
      '테넌트 관리',
      '사용자 관리',
      '정책 구성',
      '감사 로그 조회',
      'KPI 대시보드 접근',
      '청구 관리',
    ],
    TENANT_ADMIN: [
      '사용자 관리',
      '팩 설치/제거',
      '정책 구성',
      '감사 로그 조회',
      'KPI 대시보드 접근',
    ],
    DEVELOPER: [
      '팩 마켓 접근',
      '워크플로우 생성',
      '실행 모니터링',
      '지식 조회',
    ],
    OPERATOR: [
      '실행 모니터링',
      '감사 로그 조회',
      '워크플로우 실행',
    ],
    VIEWER: ['읽기 전용 조회'],
  };

  return permissions[role] || permissions.VIEWER || ['조회 권한'];
}

function getMockMembers(): TenantMember[] {
  return [
    {
      id: 'user-1',
      name: '관리자',
      email: 'admin@company.com',
      role: 'TENANT_ADMIN',
      status: 'ACTIVE',
      lastActiveAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
      createdAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'user-2',
      name: '개발자 1',
      email: 'developer1@company.com',
      role: 'DEVELOPER',
      status: 'ACTIVE',
      lastActiveAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'user-3',
      name: '개발자 2',
      email: 'developer2@company.com',
      role: 'DEVELOPER',
      status: 'ACTIVE',
      lastActiveAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'user-4',
      name: '운영자',
      email: 'operator@company.com',
      role: 'OPERATOR',
      status: 'ACTIVE',
      lastActiveAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'user-5',
      name: '뷰어',
      email: 'viewer@company.com',
      role: 'VIEWER',
      status: 'INACTIVE',
      lastActiveAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString(),
    },
  ];
}
