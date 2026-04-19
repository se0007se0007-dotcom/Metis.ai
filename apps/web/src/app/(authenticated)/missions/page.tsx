'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Target,
  Users,
  Clock,
  PlayCircle,
  PauseCircle,
  CheckCircle2,
  Plus,
  AlertCircle,
  Loader,
} from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { api } from '@/lib/api-client';

type MissionStatus =
  | 'PLANNING'
  | 'RUNNING'
  | 'WAITING_HUMAN'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'CANCELLED'
  | 'ROLLED_BACK';

interface Mission {
  id: string;
  key: string;
  title: string;
  description?: string;
  kind: string;
  status: MissionStatus;
  participants: { agentId: string; role: string }[];
  currentStepIndex: number;
  startedAt?: string;
  updatedAt: string;
  createdAt: string;
  autoActionsCount: number;
  humanInterventionsCount: number;
}

interface StatsCard {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: string;
}

function getMissionStatusBadge(
  status: MissionStatus,
): { bg: string; text: string; label: string } {
  switch (status) {
    case 'RUNNING':
      return {
        bg: 'bg-blue-100',
        text: 'text-blue-800',
        label: '활성',
      };
    case 'PLANNING':
      return {
        bg: 'bg-slate-100',
        text: 'text-slate-800',
        label: '대기 중',
      };
    case 'WAITING_HUMAN':
      return {
        bg: 'bg-amber-100',
        text: 'text-amber-800',
        label: '개입 필요',
      };
    case 'SUCCEEDED':
      return {
        bg: 'bg-green-100',
        text: 'text-green-800',
        label: '완료',
      };
    case 'FAILED':
      return {
        bg: 'bg-red-100',
        text: 'text-red-800',
        label: '실패',
      };
    case 'CANCELLED':
      return {
        bg: 'bg-gray-100',
        text: 'text-gray-800',
        label: '취소',
      };
    case 'ROLLED_BACK':
      return {
        bg: 'bg-purple-100',
        text: 'text-purple-800',
        label: '롤백',
      };
    default:
      return {
        bg: 'bg-slate-100',
        text: 'text-slate-800',
        label: '—',
      };
  }
}

function formatDate(isoString?: string): string {
  if (!isoString) return '—';
  try {
    const date = new Date(isoString);
    return date.toLocaleString('ko-KR', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

function formatElapsed(startTime?: string, endTime?: string): string {
  if (!startTime) return '—';
  try {
    const start = new Date(startTime);
    const end = endTime ? new Date(endTime) : new Date();
    const diffMs = end.getTime() - start.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins}분`;
    if (diffHours < 24) return `${diffHours}시간`;
    return `${diffDays}일`;
  } catch {
    return '—';
  }
}

interface CreateMissionModal {
  isOpen: boolean;
  title: string;
  kind: string;
  description: string;
  participants: string;
}

export default function MissionsPage() {
  const router = useRouter();
  const [missions, setMissions] = useState<Mission[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<
    'running' | 'planning' | 'completed' | 'all'
  >('running');
  const [stats, setStats] = useState({
    running: 0,
    planning: 0,
    completed: 0,
    needsIntervention: 0,
  });
  const [modal, setModal] = useState<CreateMissionModal>({
    isOpen: false,
    title: '',
    kind: 'CUSTOM',
    description: '',
    participants: '',
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchMissions();
  }, []);

  const fetchMissions = async () => {
    try {
      setLoading(true);
      const response = await api.get<{ missions: Mission[] }>('/missions');
      const allMissions = response.missions || [];
      setMissions(allMissions);

      // Calculate stats
      setStats({
        running: allMissions.filter((m) => m.status === 'RUNNING').length,
        planning: allMissions.filter((m) => m.status === 'PLANNING').length,
        completed: allMissions.filter(
          (m) => m.status === 'SUCCEEDED' || m.status === 'FAILED',
        ).length,
        needsIntervention: allMissions.filter(
          (m) => m.status === 'WAITING_HUMAN',
        ).length,
      });
    } catch (error) {
      console.error('Failed to fetch missions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateMission = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modal.title.trim()) return;

    try {
      setSubmitting(true);
      await api.post('/missions', {
        title: modal.title,
        kind: modal.kind,
        description: modal.description || undefined,
        participants: modal.participants
          .split(',')
          .map((p) => p.trim())
          .filter(Boolean),
      });

      // Reset modal and refresh list
      setModal({
        isOpen: false,
        title: '',
        kind: 'CUSTOM',
        description: '',
        participants: '',
      });
      await fetchMissions();
    } catch (error) {
      console.error('Failed to create mission:', error);
      alert('미션 생성 실패');
    } finally {
      setSubmitting(false);
    }
  };

  const getFilteredMissions = () => {
    switch (activeTab) {
      case 'running':
        return missions.filter((m) => m.status === 'RUNNING');
      case 'planning':
        return missions.filter((m) => m.status === 'PLANNING');
      case 'completed':
        return missions.filter(
          (m) => m.status === 'SUCCEEDED' || m.status === 'FAILED',
        );
      case 'all':
      default:
        return missions;
    }
  };

  const filteredMissions = getFilteredMissions();

  const statsCards: StatsCard[] = [
    {
      label: '활성 미션',
      value: stats.running,
      icon: <PlayCircle className="h-5 w-5" />,
      color: 'bg-blue-50 border-blue-200 text-blue-700',
    },
    {
      label: '대기 중',
      value: stats.planning,
      icon: <Clock className="h-5 w-5" />,
      color: 'bg-slate-50 border-slate-200 text-slate-700',
    },
    {
      label: '오늘 완료',
      value: stats.completed,
      icon: <CheckCircle2 className="h-5 w-5" />,
      color: 'bg-green-50 border-green-200 text-green-700',
    },
    {
      label: '개입 필요',
      value: stats.needsIntervention,
      icon: <AlertCircle className="h-5 w-5" />,
      color: 'bg-red-50 border-red-200 text-red-700',
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <PageHeader title="미션" subtitle="Agent 협업 미션 관리" />

      {/* Top stats */}
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {statsCards.map((card) => (
            <div
              key={card.label}
              className={`rounded-lg border p-4 ${card.color}`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium opacity-75">
                    {card.label}
                  </p>
                  <p className="mt-1 text-2xl font-bold">{card.value}</p>
                </div>
                {card.icon}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main content */}
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header with tabs and button */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-2 border-b border-slate-200">
            <button
              onClick={() => setActiveTab('running')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'running'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              활성 미션
            </button>
            <button
              onClick={() => setActiveTab('planning')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'planning'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              대기 중
            </button>
            <button
              onClick={() => setActiveTab('completed')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'completed'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              완료
            </button>
            <button
              onClick={() => setActiveTab('all')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'all'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              이력
            </button>
          </div>

          <button
            onClick={() =>
              setModal({
                ...modal,
                isOpen: true,
              })
            }
            className="flex items-center gap-2 rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600 transition-colors"
          >
            <Plus className="h-4 w-4" />
            새 미션 생성
          </button>
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <Loader className="h-8 w-8 animate-spin text-blue-500 mx-auto mb-2" />
              <p className="text-sm text-slate-600">미션 로드 중...</p>
            </div>
          </div>
        ) : filteredMissions.length === 0 ? (
          <div className="rounded-lg border border-slate-200 bg-white p-8 text-center">
            <Target className="h-12 w-12 text-slate-300 mx-auto mb-3" />
            <p className="text-sm text-slate-600">
              {activeTab === 'running'
                ? '활성 미션이 없습니다'
                : activeTab === 'planning'
                  ? '대기 중인 미션이 없습니다'
                  : activeTab === 'completed'
                    ? '완료된 미션이 없습니다'
                    : '미션이 없습니다'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  <th className="px-6 py-3 text-left font-semibold text-slate-900">
                    제목
                  </th>
                  <th className="px-6 py-3 text-left font-semibold text-slate-900">
                    종류
                  </th>
                  <th className="px-6 py-3 text-left font-semibold text-slate-900">
                    상태
                  </th>
                  <th className="px-6 py-3 text-left font-semibold text-slate-900">
                    참여자
                  </th>
                  <th className="px-6 py-3 text-left font-semibold text-slate-900">
                    진행률
                  </th>
                  <th className="px-6 py-3 text-left font-semibold text-slate-900">
                    시작 시간
                  </th>
                  <th className="px-6 py-3 text-left font-semibold text-slate-900">
                    업데이트
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredMissions.map((mission) => {
                  const badge = getMissionStatusBadge(mission.status);
                  const progressPct = Math.min(
                    (mission.currentStepIndex / 10) * 100,
                    100,
                  );

                  return (
                    <tr
                      key={mission.id}
                      onClick={() => router.push(`/missions/${mission.id}`)}
                      className="cursor-pointer hover:bg-blue-50 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <p className="font-medium text-slate-900">
                          {mission.title}
                        </p>
                        {mission.description && (
                          <p className="text-xs text-slate-600 mt-1">
                            {mission.description.substring(0, 60)}
                            {mission.description.length > 60 ? '...' : ''}
                          </p>
                        )}
                      </td>
                      <td className="px-6 py-4 text-slate-700">
                        <span className="text-xs font-medium bg-slate-100 text-slate-800 rounded-full px-2.5 py-1">
                          {mission.kind}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${badge.bg} ${badge.text}`}
                        >
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex -space-x-2">
                          {mission.participants.slice(0, 3).map((p, idx) => (
                            <div
                              key={idx}
                              className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-blue-500 text-white text-xs font-bold ring-2 ring-white"
                              title={p.agentId}
                            >
                              {p.agentId.charAt(0).toUpperCase()}
                            </div>
                          ))}
                          {mission.participants.length > 3 && (
                            <div className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-slate-300 text-slate-700 text-xs font-bold ring-2 ring-white">
                              +{mission.participants.length - 3}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="w-32">
                          <div className="h-2 rounded-full bg-slate-200 overflow-hidden">
                            <div
                              className="h-full bg-blue-500 transition-all"
                              style={{ width: `${progressPct}%` }}
                            />
                          </div>
                          <p className="text-xs text-slate-600 mt-1">
                            {mission.currentStepIndex}/10
                          </p>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-600">
                        {formatDate(mission.startedAt)}
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-600">
                        {formatElapsed(mission.createdAt, mission.updatedAt)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Mission Modal */}
      {modal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg">
            <h2 className="text-lg font-bold text-slate-900 mb-4">
              새 미션 생성
            </h2>

            <form onSubmit={handleCreateMission} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  제목
                </label>
                <input
                  type="text"
                  value={modal.title}
                  onChange={(e) =>
                    setModal({ ...modal, title: e.target.value })
                  }
                  placeholder="미션 제목"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  종류
                </label>
                <select
                  value={modal.kind}
                  onChange={(e) =>
                    setModal({ ...modal, kind: e.target.value })
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="CUSTOM">CUSTOM</option>
                  <option value="DEPLOYMENT">DEPLOYMENT</option>
                  <option value="INCIDENT">INCIDENT</option>
                  <option value="AP_PROCESS">AP_PROCESS</option>
                  <option value="RISK_REVIEW">RISK_REVIEW</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  설명 (선택사항)
                </label>
                <textarea
                  value={modal.description}
                  onChange={(e) =>
                    setModal({ ...modal, description: e.target.value })
                  }
                  placeholder="미션 설명"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  참여자 (쉼표로 구분, 선택사항)
                </label>
                <input
                  type="text"
                  value={modal.participants}
                  onChange={(e) =>
                    setModal({ ...modal, participants: e.target.value })
                  }
                  placeholder="agent1, agent2, agent3"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex gap-2 pt-4">
                <button
                  type="button"
                  onClick={() =>
                    setModal({
                      isOpen: false,
                      title: '',
                      kind: 'CUSTOM',
                      description: '',
                      participants: '',
                    })
                  }
                  className="flex-1 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={submitting || !modal.title.trim()}
                  className="flex-1 rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? '생성 중...' : '생성'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
