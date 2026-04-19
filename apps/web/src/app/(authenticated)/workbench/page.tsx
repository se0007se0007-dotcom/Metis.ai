'use client';

import { useState, useEffect } from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import { SummaryStatCard } from '@/components/shared/SummaryStatCard';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { api } from '@/lib/api-client';

interface ExecStats {
  total: number;
  running: number;
  succeeded: number;
  failed: number;
  avgLatencyMs: number;
}

interface RecentExec {
  id: string;
  workflowKey: string;
  capabilityKey: string;
  status: string;
  latencyMs: number | null;
  createdAt: string;
}

export default function WorkbenchPage() {
  const [stats, setStats] = useState<ExecStats | null>(null);
  const [recentExecs, setRecentExecs] = useState<RecentExec[]>([]);
  const [installations, setInstallations] = useState<number>(0);
  const [auditCount, setAuditCount] = useState<number>(0);
  const [activePolicies, setActivePolicies] = useState<number>(0);
  const [policyViolations, setPolicyViolations] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [statsRes, execRes, installRes, auditRes, policiesRes, violationsRes] = await Promise.allSettled([
          api.get('/executions/stats'),
          api.get('/executions?pageSize=10&page=1'),
          api.get('/installations'),
          api.get('/governance/audit-logs?pageSize=1&page=1'),
          api.get('/governance/policies'),
          api.get('/governance/audit-logs?action=POLICY_CHECK&pageSize=5'),
        ]);

        if (statsRes.status === 'fulfilled') setStats(statsRes.value as ExecStats);
        if (execRes.status === 'fulfilled') {
          const data = execRes.value as any;
          setRecentExecs(data?.items ?? []);
        }
        if (installRes.status === 'fulfilled') {
          const data = installRes.value as any;
          setInstallations(data?.items?.length ?? 0);
        }
        if (auditRes.status === 'fulfilled') {
          const data = auditRes.value as any;
          setAuditCount(data.total ?? 0);
        }
        if (policiesRes.status === 'fulfilled') {
          const data = policiesRes.value as any;
          setActivePolicies(data?.items?.length ?? 0);
        }
        if (violationsRes.status === 'fulfilled') {
          const data = violationsRes.value as any;
          setPolicyViolations(data.total ?? 0);
        }
      } catch {
        // graceful fallback
      } finally {
        setLoading(false);
      }
    }
    load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, []);

  const successRate = stats && stats.total > 0
    ? Math.round((stats.succeeded / stats.total) * 100)
    : 0;

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="운영 대시보드"
        description="Metis.AI AgentOps 플랫폼 운영 현황 — 실시간 데이터"
      />

      {/* Primary KPIs — with left accent bars matching prototype */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryStatCard
          label="총 실행"
          value={loading ? '—' : (stats?.total ?? 0)}
          change={stats?.running ? `${stats.running} 실행 중` : undefined}
          changeType="neutral"
          accentColor="accent"
        />
        <SummaryStatCard
          label="성공률"
          value={loading ? '—' : `${successRate}%`}
          change={stats?.failed ? `${stats.failed} 실패` : '0 실패'}
          changeType={stats?.failed && stats.failed > 0 ? 'negative' : 'positive'}
          accentColor="success"
        />
        <SummaryStatCard
          label="평균 지연시간"
          value={loading ? '—' : `${stats?.avgLatencyMs ?? 0}ms`}
          changeType="neutral"
          accentColor="warning"
        />
        <SummaryStatCard
          label="설치된 Pack"
          value={loading ? '—' : installations}
          change={`감사 이벤트 ${auditCount}건`}
          changeType="neutral"
          accentColor="accent"
        />
      </div>

      {/* Governance Summary — 정책/감사가 숨지 않고 메인 대시보드에 노출 */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <SummaryStatCard
          label="활성 정책"
          value={loading ? '—' : activePolicies}
          changeType="neutral"
          accentColor="purple"
        />
        <SummaryStatCard
          label="최근 정책 위반"
          value={loading ? '—' : policyViolations}
          changeType={policyViolations > 0 ? 'negative' : 'positive'}
          accentColor="danger"
        />
        <SummaryStatCard
          label="준수 상태"
          value={loading ? '—' : (policyViolations > 0 ? '주의' : '준수')}
          changeType={policyViolations > 0 ? 'negative' : 'positive'}
          accentColor={policyViolations > 0 ? 'danger' : 'success'}
        />
      </div>

      {/* Recent Executions */}
      <div className="bg-navy-light rounded-lg border border-white/[0.06]">
        <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">최근 실행 이력</h2>
          <a href="/orchestration/monitor" className="text-xs text-accent hover:underline">
            전체 보기 →
          </a>
        </div>

        {loading ? (
          <div className="p-6 space-y-3">
            {[1,2,3,4,5].map(i => (
              <div key={i} className="h-10 bg-white/[0.03] rounded animate-pulse" />
            ))}
          </div>
        ) : recentExecs.length === 0 ? (
          <div className="p-8 text-center text-muted text-xs">
            아직 실행 데이터가 없습니다. Orchestration → Monitor에서 실행을 시작하세요.
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-white/[0.06] text-muted">
                <th className="text-left px-5 py-3 font-medium">시간</th>
                <th className="text-left px-5 py-3 font-medium">워크플로우</th>
                <th className="text-left px-5 py-3 font-medium">Capability</th>
                <th className="text-left px-5 py-3 font-medium">상태</th>
                <th className="text-right px-5 py-3 font-medium">지연시간</th>
              </tr>
            </thead>
            <tbody>
              {recentExecs.slice(0, 10).map((exec) => (
                <tr
                  key={exec.id}
                  className="border-b border-white/[0.04] hover:bg-white/[0.02] cursor-pointer"
                  onClick={() => window.location.href = `/orchestration/monitor?selected=${exec.id}`}
                >
                  <td className="px-5 py-3 text-muted">
                    {new Date(exec.createdAt).toLocaleString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </td>
                  <td className="px-5 py-3 text-gray-300">{exec.workflowKey || '—'}</td>
                  <td className="px-5 py-3 text-gray-300 font-mono">{exec.capabilityKey || '—'}</td>
                  <td className="px-5 py-3"><StatusBadge status={exec.status} /></td>
                  <td className="px-5 py-3 text-right text-muted">
                    {exec.latencyMs != null ? `${exec.latencyMs}ms` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Quick Navigation — 주요 기능을 워크벤치에서 바로 연결 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { title: 'Execution Monitor', desc: '실시간 실행 모니터링', href: '/orchestration/monitor', color: 'text-accent' },
          { title: 'Metis.flo Builder', desc: '워크플로우 빌더', href: '/orchestration/builder', color: 'text-amber-400' },
          { title: 'Policy Engine', desc: '거버넌스 정책 관리', href: '/governance/policies', color: 'text-purple-400' },
          { title: 'KPI Dashboard', desc: '운영 KPI 현황', href: '/governance/kpi', color: 'text-orange-400' },
        ].map((card) => (
          <a
            key={card.href}
            href={card.href}
            className="bg-navy-light rounded-lg border border-white/[0.06] p-5 hover:border-accent/30 transition-colors group"
          >
            <h3 className={`text-sm font-semibold ${card.color} group-hover:opacity-80`}>{card.title}</h3>
            <p className="text-xs text-muted mt-1">{card.desc}</p>
          </a>
        ))}
      </div>

      {/* Release Engineering — Replay/Shadow/Canary를 "운영 화면"으로 노출 */}
      <div>
        <h2 className="text-sm font-semibold text-white mb-3">Release Engineering</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { title: 'Replay Testing', desc: '과거 실행 기반 회귀 테스트', href: '/release/replay', color: 'text-orange-400' },
            { title: 'Shadow Execution', desc: '프로덕션 영향 없는 병렬 실행', href: '/release/shadow', color: 'text-purple-400' },
            { title: 'Canary Deployment', desc: '점진적 트래픽 전환', href: '/release/canary', color: 'text-green-400' },
            { title: 'Version History', desc: 'Promote/Rollback 이력', href: '/release/promotions', color: 'text-cyan-400' },
          ].map((card) => (
            <a
              key={card.href}
              href={card.href}
              className="bg-navy-light rounded-lg border border-white/[0.06] p-4 hover:border-accent/30 transition-colors group"
            >
              <h3 className={`text-xs font-semibold ${card.color} group-hover:opacity-80`}>{card.title}</h3>
              <p className="text-[10px] text-muted mt-1">{card.desc}</p>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
