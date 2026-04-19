'use client';

import { PageHeader } from '@/components/shared/PageHeader';

interface DevelopmentAgent {
  id: string;
  name: string;
  description: string;
  status: 'ACTIVE' | 'STANDBY' | 'INACTIVE';
  lastRunTime: string;
  successRate: number;
}

const DEVELOPMENT_AGENTS: DevelopmentAgent[] = [
  {
    id: 'dev-1',
    name: 'Code Review Agent',
    description: '코드 품질 검사 및 자동 리뷰',
    status: 'ACTIVE',
    lastRunTime: '5분 전',
    successRate: 95,
  },
  {
    id: 'dev-2',
    name: 'CI/CD Pipeline Agent',
    description: '지속적 통합 및 배포 자동화',
    status: 'ACTIVE',
    lastRunTime: '3분 전',
    successRate: 98,
  },
  {
    id: 'dev-3',
    name: 'Dependency Update Agent',
    description: '라이브러리 의존성 자동 업데이트 및 호환성 검사',
    status: 'ACTIVE',
    lastRunTime: '1시간 전',
    successRate: 94,
  },
  {
    id: 'dev-4',
    name: 'Documentation Agent',
    description: 'API 및 코드 문서 자동 생성',
    status: 'STANDBY',
    lastRunTime: '2시간 전',
    successRate: 96,
  },
  {
    id: 'dev-5',
    name: 'Test Generator Agent',
    description: '단위 테스트 및 통합 테스트 자동 생성',
    status: 'ACTIVE',
    lastRunTime: '30분 전',
    successRate: 92,
  },
  {
    id: 'dev-6',
    name: 'Security Code Scanner',
    description: '보안 취약점 및 악성 코드 패턴 탐지',
    status: 'ACTIVE',
    lastRunTime: '10분 전',
    successRate: 97,
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

export default function DevelopmentPage() {
  const activeCount = DEVELOPMENT_AGENTS.filter(a => a.status === 'ACTIVE').length;
  const avgSuccessRate = Math.round(
    DEVELOPMENT_AGENTS.reduce((sum, a) => sum + a.successRate, 0) / DEVELOPMENT_AGENTS.length
  );

  return (
    <div className="p-6 space-y-6 bg-gray-50 min-h-screen">
      <PageHeader
        title="Development Agents"
        description="코드 리뷰, CI/CD, 테스트 자동화 등 개발 프로세스 에이전트"
      />

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs text-gray-600 uppercase tracking-wider font-semibold">전체</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">{DEVELOPMENT_AGENTS.length}</p>
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
        {DEVELOPMENT_AGENTS.map((agent) => (
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
            <p className="font-medium text-green-900">개발 생산성 향상</p>
            <p className="text-xs text-green-800 mt-1">5개 에이전트 활성 중으로 개발 프로세스가 효율적으로 자동화되고 있습니다.</p>
          </div>
          <div className="p-3 bg-purple-50 border border-purple-200 rounded">
            <p className="font-medium text-purple-900">코드 품질 안정성</p>
            <p className="text-xs text-purple-800 mt-1">평균 성공률 {avgSuccessRate}%로 모든 자동화 검사가 안정적입니다.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
