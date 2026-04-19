'use client';

import { PageHeader } from '@/components/shared/PageHeader';

interface UtilityAgent {
  id: string;
  name: string;
  description: string;
  status: 'ACTIVE' | 'STANDBY' | 'INACTIVE';
  lastRunTime: string;
  successRate: number;
}

const UTILITY_AGENTS: UtilityAgent[] = [
  {
    id: 'util-1',
    name: 'Log Analyzer Agent',
    description: '로그 수집, 분석 및 이상 패턴 감지',
    status: 'ACTIVE',
    lastRunTime: '1분 전',
    successRate: 99,
  },
  {
    id: 'util-2',
    name: 'Report Generator Agent',
    description: '정기 리포트 및 대시보드 자동 생성',
    status: 'ACTIVE',
    lastRunTime: '30분 전',
    successRate: 97,
  },
  {
    id: 'util-3',
    name: 'Data Migration Agent',
    description: '데이터 마이그레이션 및 동기화 관리',
    status: 'STANDBY',
    lastRunTime: '2시간 전',
    successRate: 95,
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

export default function UtilityPage() {
  const activeCount = UTILITY_AGENTS.filter(a => a.status === 'ACTIVE').length;
  const avgSuccessRate = Math.round(
    UTILITY_AGENTS.reduce((sum, a) => sum + a.successRate, 0) / UTILITY_AGENTS.length
  );

  return (
    <div className="p-6 space-y-6 bg-gray-50 min-h-screen">
      <PageHeader
        title="Utility Agents"
        description="로그 분석, 리포트 생성, 데이터 마이그레이션 등 유틸리티 에이전트"
      />

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs text-gray-600 uppercase tracking-wider font-semibold">전체</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">{UTILITY_AGENTS.length}</p>
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
        {UTILITY_AGENTS.map((agent) => (
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
            <p className="font-medium text-green-900">유틸리티 자동화 효율</p>
            <p className="text-xs text-green-800 mt-1">2개 에이전트 활성으로 로그 분석 및 리포트 생성이 자동화되고 있습니다.</p>
          </div>
          <div className="p-3 bg-purple-50 border border-purple-200 rounded">
            <p className="font-medium text-purple-900">높은 안정성</p>
            <p className="text-xs text-purple-800 mt-1">평균 성공률 {avgSuccessRate}%로 모든 유틸리티 에이전트가 안정적입니다.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
