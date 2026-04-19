'use client';

import { PageHeader } from '@/components/shared/PageHeader';

interface OperationsAgent {
  id: string;
  name: string;
  description: string;
  status: 'ACTIVE' | 'STANDBY' | 'INACTIVE';
  lastRunTime: string;
  successRate: number;
}

const OPERATIONS_AGENTS: OperationsAgent[] = [
  {
    id: 'op-1',
    name: 'Ansible Automation Agent',
    description: '인프라 자동화 및 구성 관리',
    status: 'ACTIVE',
    lastRunTime: '2분 전',
    successRate: 98,
  },
  {
    id: 'op-2',
    name: 'Terraform Agent',
    description: 'IaC 기반 클라우드 인프라 프로비저닝',
    status: 'ACTIVE',
    lastRunTime: '15분 전',
    successRate: 99,
  },
  {
    id: 'op-3',
    name: 'K8s Operator Agent',
    description: 'Kubernetes 클러스터 관리 및 자동 스케일링',
    status: 'ACTIVE',
    lastRunTime: '5분 전',
    successRate: 97,
  },
  {
    id: 'op-4',
    name: 'Monitoring Alert Agent',
    description: '실시간 모니터링 및 알림 관리',
    status: 'ACTIVE',
    lastRunTime: '1분 전',
    successRate: 99,
  },
  {
    id: 'op-5',
    name: 'Backup Manager Agent',
    description: '자동 백업 및 재해 복구',
    status: 'STANDBY',
    lastRunTime: '1시간 전',
    successRate: 100,
  },
  {
    id: 'op-6',
    name: 'Network Configuration Agent',
    description: '네트워크 및 보안 정책 관리',
    status: 'ACTIVE',
    lastRunTime: '30분 전',
    successRate: 96,
  },
];

function StatusBadge({ status }: { status: 'ACTIVE' | 'STANDBY' | 'INACTIVE' }) {
  const styles = {
    ACTIVE: 'bg-green-100 text-green-700',
    STANDBY: 'bg-yellow-100 text-yellow-700',
    INACTIVE: 'bg-gray-200 text-gray-700',
  };
  const labels = { ACTIVE: 'Active', STANDBY: 'Standby', INACTIVE: 'Inactive' };
  return (
    <span className={`text-[10px] font-semibold px-2 py-1 rounded inline-flex items-center gap-1 ${styles[status]}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${
        status === 'ACTIVE' ? 'bg-green-500' : status === 'STANDBY' ? 'bg-yellow-500' : 'bg-gray-400'
      }`} />
      {labels[status]}
    </span>
  );
}

export default function OperationsPage() {
  const activeCount = OPERATIONS_AGENTS.filter(a => a.status === 'ACTIVE').length;
  const avgSuccessRate = Math.round(
    OPERATIONS_AGENTS.reduce((sum, a) => sum + a.successRate, 0) / OPERATIONS_AGENTS.length
  );

  return (
    <div className="p-6 space-y-6 bg-gray-50 min-h-screen">
      <PageHeader
        title="Operations Agents"
        description="인프라, 모니터링, 백업 등 운영 자동화 에이전트"
      />

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs text-gray-600 uppercase tracking-wider font-semibold">전체</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">{OPERATIONS_AGENTS.length}</p>
          <p className="text-xs text-gray-500 mt-1">에이전트</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs text-gray-600 uppercase tracking-wider font-semibold">활성</p>
          <p className="text-3xl font-bold text-green-600 mt-2">{activeCount}</p>
          <p className="text-xs text-gray-500 mt-1">실행 중</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs text-gray-600 uppercase tracking-wider font-semibold">평균 성공률</p>
          <p className="text-3xl font-bold text-blue-600 mt-2">{avgSuccessRate}%</p>
          <p className="text-xs text-gray-500 mt-1">신뢰도</p>
        </div>
      </div>

      {/* Agents Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {OPERATIONS_AGENTS.map((agent) => (
          <div
            key={agent.id}
            className="bg-white rounded-lg border border-gray-200 p-5 hover:shadow-md transition-shadow"
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-gray-900">{agent.name}</h3>
                <p className="text-xs text-gray-600 mt-1">{agent.description}</p>
              </div>
              <StatusBadge status={agent.status} />
            </div>

            {/* Stats */}
            <div className="mt-4 pt-4 border-t border-gray-100 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-600">마지막 실행</span>
                <span className="text-xs font-medium text-gray-900">{agent.lastRunTime}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-600">성공률</span>
                <div className="flex items-center gap-2">
                  <div className="w-20 bg-gray-200 rounded-full h-1.5">
                    <div
                      className="bg-green-500 h-1.5 rounded-full"
                      style={{ width: `${agent.successRate}%` }}
                    />
                  </div>
                  <span className="text-xs font-semibold text-gray-900">{agent.successRate}%</span>
                </div>
              </div>
            </div>

            {/* Action */}
            <button className="w-full mt-4 py-2 px-3 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold rounded transition-colors">
              관리 및 설정
            </button>
          </div>
        ))}
      </div>

      {/* Performance Insights */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">성능 인사이트</h2>
        <div className="space-y-3 text-sm text-gray-700">
          <div className="p-3 bg-green-50 border border-green-200 rounded">
            <p className="font-medium text-green-900">모든 에이전트 정상 운영 중</p>
            <p className="text-xs text-green-800 mt-1">운영 에이전트 6개 모두 안정적으로 작동하고 있습니다.</p>
          </div>
          <div className="p-3 bg-blue-50 border border-blue-200 rounded">
            <p className="font-medium text-blue-900">높은 신뢰도</p>
            <p className="text-xs text-blue-800 mt-1">평균 성공률 {avgSuccessRate}%로 모든 에이전트의 신뢰도가 높습니다.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
