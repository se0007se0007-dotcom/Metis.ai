'use client';

import { PageHeader } from '@/components/shared/PageHeader';
import { AlertCircle, TrendingUp, Zap, CheckCircle } from 'lucide-react';

interface RecommendationItem {
  id: string;
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  type: 'workflow' | 'optimization' | 'automation';
  savePercentage?: number;
}

const RECOMMENDATIONS: RecommendationItem[] = [
  {
    id: 'rec-1',
    title: 'Parallel Deployment Pipeline',
    description: '배포 파이프라인을 병렬화하여 배포 시간을 40% 단축할 수 있습니다.',
    impact: 'high',
    type: 'workflow',
    savePercentage: 40,
  },
  {
    id: 'rec-2',
    title: 'Intelligent Alert Batching',
    description: '유사한 알림을 자동으로 그룹화하여 알림 폭증을 줄입니다.',
    impact: 'high',
    type: 'optimization',
    savePercentage: 60,
  },
  {
    id: 'rec-3',
    title: 'Automated Rollback Triggers',
    description: 'SLO 위반 시 자동 롤백을 설정하여 MTTR을 개선합니다.',
    impact: 'high',
    type: 'automation',
  },
  {
    id: 'rec-4',
    title: 'Cost Optimization Rules',
    description: '미사용 리소스를 자동 정리하여 월간 클라우드 비용 15% 절감.',
    impact: 'medium',
    type: 'optimization',
    savePercentage: 15,
  },
  {
    id: 'rec-5',
    title: 'Security Compliance Automation',
    description: '정기적인 컴플라이언스 점검을 자동화합니다.',
    impact: 'medium',
    type: 'automation',
  },
  {
    id: 'rec-6',
    title: 'Log Pattern Analysis',
    description: '머신러닝으로 비정상 로그 패턴을 조기에 감지합니다.',
    impact: 'medium',
    type: 'automation',
  },
];

function ImpactBadge({ impact }: { impact: 'high' | 'medium' | 'low' }) {
  const styles = {
    high: 'bg-red-100 text-red-700',
    medium: 'bg-yellow-100 text-yellow-700',
    low: 'bg-blue-100 text-blue-700',
  };
  const labels = { high: 'High Impact', medium: 'Medium', low: 'Low' };
  return (
    <span className={`text-[10px] font-semibold px-2 py-1 rounded ${styles[impact]}`}>
      {labels[impact]}
    </span>
  );
}

function TypeBadge({ type }: { type: 'workflow' | 'optimization' | 'automation' }) {
  const styles = {
    workflow: 'bg-purple-100 text-purple-700',
    optimization: 'bg-green-100 text-green-700',
    automation: 'bg-blue-100 text-blue-700',
  };
  const labels = { workflow: 'Workflow', optimization: 'Optimization', automation: 'Automation' };
  return (
    <span className={`text-[10px] font-semibold px-2 py-1 rounded ${styles[type]}`}>
      {labels[type]}
    </span>
  );
}

export default function AthenePage() {
  const highImpactCount = RECOMMENDATIONS.filter(r => r.impact === 'high').length;
  const totalSavings = RECOMMENDATIONS.reduce((sum, r) => sum + (r.savePercentage ?? 0), 0);

  return (
    <div className="p-6 space-y-6 bg-gray-50 min-h-screen">
      <PageHeader
        title="Athene AI"
        description="지능형 워크플로우 추천 엔진 — 최적화 기회 자동 감지"
      />

      {/* Key Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-gray-600 uppercase tracking-wider font-semibold">권장사항</p>
            <AlertCircle size={16} className="text-gray-400" />
          </div>
          <p className="text-3xl font-bold text-gray-900">{RECOMMENDATIONS.length}</p>
          <p className="text-xs text-gray-500 mt-1">대기 중</p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-gray-600 uppercase tracking-wider font-semibold">High Impact</p>
            <TrendingUp size={16} className="text-red-500" />
          </div>
          <p className="text-3xl font-bold text-red-600">{highImpactCount}</p>
          <p className="text-xs text-gray-500 mt-1">즉시 실행 권장</p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-gray-600 uppercase tracking-wider font-semibold">예상 절감</p>
            <Zap size={16} className="text-amber-500" />
          </div>
          <p className="text-3xl font-bold text-amber-600">{totalSavings}%</p>
          <p className="text-xs text-gray-500 mt-1">총 비용 절감</p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-gray-600 uppercase tracking-wider font-semibold">실행됨</p>
            <CheckCircle size={16} className="text-green-500" />
          </div>
          <p className="text-3xl font-bold text-green-600">0</p>
          <p className="text-xs text-gray-500 mt-1">적용된 권장사항</p>
        </div>
      </div>

      {/* Recommendations List */}
      <div className="space-y-4">
        <h2 className="text-sm font-semibold text-gray-900">추천 워크플로우 & 최적화</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {RECOMMENDATIONS.map((rec) => (
            <div
              key={rec.id}
              className="bg-white rounded-lg border border-gray-200 p-5 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">{rec.title}</h3>
                  <p className="text-xs text-gray-600 mt-1">{rec.description}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
                <ImpactBadge impact={rec.impact} />
                <TypeBadge type={rec.type} />
                {rec.savePercentage && (
                  <span className="text-xs font-semibold text-green-600 ml-auto">
                    {rec.savePercentage}% 절감
                  </span>
                )}
              </div>

              <button className="mt-3 w-full py-2 px-3 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold rounded transition-colors">
                상세 보기 및 적용
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* ML Insights */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">AI 인사이트</h2>
        <div className="space-y-3 text-sm text-gray-700">
          <p>
            • 최근 30일 분석 결과, 배포 파이프라인 병렬화가 가장 큰 성능 향상을 가져올 수 있습니다.
          </p>
          <p>
            • 알림 폭증 패턴이 감지되었습니다. 스마트 배칭으로 50-60% 감소 예상됩니다.
          </p>
          <p>
            • 미사용 리소스가 월간 클라우드 비용의 약 15%를 차지하고 있습니다. 자동 정리 권장됩니다.
          </p>
          <p>
            • 현재 배포 성공률은 95%이며, 자동 롤백 정책 도입으로 MTTR을 60% 개선할 수 있습니다.
          </p>
        </div>
      </div>
    </div>
  );
}
