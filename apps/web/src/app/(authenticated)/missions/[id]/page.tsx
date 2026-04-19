'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  PauseCircle,
  PlayCircle,
  CheckCircle2,
  XCircle,
  Loader,
  ArrowLeft,
} from 'lucide-react';
import { AgentTimeline, Message } from '@/components/shared/AgentTimeline';
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
  endedAt?: string;
  updatedAt: string;
  createdAt: string;
  autoActionsCount: number;
  humanInterventionsCount: number;
}

interface Handoff {
  id: string;
  fromAgent: string;
  toAgent: string;
  taskJson: Record<string, unknown>;
  status: string;
  createdAt: string;
}

interface LiveMetrics {
  latencyMs: number;
  costUsd: number;
  errorCount: number;
}

export default function MissionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const missionId = params.id as string;

  const [mission, setMission] = useState<Mission | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [handoffs, setHandoffs] = useState<Handoff[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [metrics, setMetrics] = useState<LiveMetrics>({
    latencyMs: 0,
    costUsd: 0,
    errorCount: 0,
  });
  const [interventionInput, setInterventionInput] = useState('');

  // Fetch mission detail
  const fetchMissionDetail = useCallback(async () => {
    try {
      const response = await api.get<{ mission: Mission }>(
        `/missions/${missionId}`,
      );
      setMission(response.mission);
    } catch (error) {
      console.error('Failed to fetch mission:', error);
    }
  }, [missionId]);

  // Fetch messages
  const fetchMessages = useCallback(async () => {
    try {
      const response = await api.get<{ messages: Message[] }>(
        `/missions/${missionId}/messages?limit=200`,
      );
      setMessages(response.messages || []);
    } catch (error) {
      console.error('Failed to fetch messages:', error);
    }
  }, [missionId]);

  // Fetch handoffs
  const fetchHandoffs = useCallback(async () => {
    try {
      const response = await api.get<{ handoffs: Handoff[] }>(
        `/missions/${missionId}/handoffs`,
      );
      setHandoffs(response.handoffs || []);
    } catch (error) {
      console.error('Failed to fetch handoffs:', error);
    }
  }, [missionId]);

  // Initial load
  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        await Promise.all([
          fetchMissionDetail(),
          fetchMessages(),
          fetchHandoffs(),
        ]);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [missionId, fetchMissionDetail, fetchMessages, fetchHandoffs]);

  // Auto-refresh every 5 seconds
  useEffect(() => {
    const interval = setInterval(async () => {
      setRefreshing(true);
      try {
        await Promise.all([fetchMessages(), fetchMissionDetail()]);
      } finally {
        setRefreshing(false);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [fetchMessages, fetchMissionDetail]);

  const handlePause = async () => {
    try {
      setActionLoading(true);
      await api.post(`/missions/${missionId}/pause`, {});
      await fetchMissionDetail();
    } catch (error) {
      console.error('Failed to pause mission:', error);
      alert('미션 일시정지 실패');
    } finally {
      setActionLoading(false);
    }
  };

  const handleResume = async () => {
    try {
      setActionLoading(true);
      await api.post(`/missions/${missionId}/resume`, {});
      await fetchMissionDetail();
    } catch (error) {
      console.error('Failed to resume mission:', error);
      alert('미션 재개 실패');
    } finally {
      setActionLoading(false);
    }
  };

  const handleComplete = async () => {
    try {
      setActionLoading(true);
      await api.post(`/missions/${missionId}/complete`, {});
      await fetchMissionDetail();
    } catch (error) {
      console.error('Failed to complete mission:', error);
      alert('미션 완료 실패');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async () => {
    if (confirm('이 미션을 정말 취소하시겠습니까?')) {
      try {
        setActionLoading(true);
        await api.post(`/missions/${missionId}/cancel`, {});
        await fetchMissionDetail();
      } catch (error) {
        console.error('Failed to cancel mission:', error);
        alert('미션 취소 실패');
      } finally {
        setActionLoading(false);
      }
    }
  };

  const handleIntervention = async (decision: string) => {
    try {
      setActionLoading(true);
      await api.post(`/missions/${missionId}/intervene`, {
        decision,
        input: interventionInput,
      });
      setInterventionInput('');
      await fetchMissionDetail();
      await fetchMessages();
    } catch (error) {
      console.error('Failed to intervene:', error);
      alert('개입 제출 실패');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <Loader className="h-8 w-8 animate-spin text-blue-500 mx-auto mb-3" />
          <p className="text-sm text-slate-600">미션 로드 중...</p>
        </div>
      </div>
    );
  }

  if (!mission) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-sm text-slate-600 mb-4">미션을 찾을 수 없습니다</p>
          <button
            onClick={() => router.back()}
            className="rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600"
          >
            뒤로 가기
          </button>
        </div>
      </div>
    );
  }

  const showActionBar =
    mission.status === 'RUNNING' ||
    mission.status === 'PLANNING' ||
    mission.status === 'WAITING_HUMAN';

  const showInterventionPrompt = mission.status === 'WAITING_HUMAN';

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4 mb-4">
            <button
              onClick={() => router.back()}
              className="rounded-lg p-2 hover:bg-slate-100 transition-colors"
            >
              <ArrowLeft className="h-5 w-5 text-slate-600" />
            </button>
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-slate-900">
                {mission.title}
              </h1>
              {mission.description && (
                <p className="mt-1 text-sm text-slate-600">
                  {mission.description}
                </p>
              )}
            </div>
          </div>

          {/* Status badge */}
          <div className="flex items-center gap-3">
            <span
              className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${
                mission.status === 'RUNNING'
                  ? 'bg-blue-100 text-blue-800'
                  : mission.status === 'WAITING_HUMAN'
                    ? 'bg-red-100 text-red-800'
                    : mission.status === 'SUCCEEDED'
                      ? 'bg-green-100 text-green-800'
                      : mission.status === 'FAILED'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-slate-100 text-slate-800'
              }`}
            >
              {mission.status === 'RUNNING'
                ? '활성'
                : mission.status === 'PLANNING'
                  ? '대기 중'
                  : mission.status === 'WAITING_HUMAN'
                    ? '개입 필요'
                    : mission.status === 'SUCCEEDED'
                      ? '완료'
                      : mission.status === 'FAILED'
                        ? '실패'
                        : mission.status}
            </span>
            <span className="text-xs text-slate-600">
              {mission.kind} • 시작:{' '}
              {mission.startedAt
                ? new Date(mission.startedAt).toLocaleString('ko-KR')
                : '미시작'}
            </span>
          </div>
        </div>
      </div>

      {/* Action bar */}
      {showActionBar && (
        <div className="border-b border-slate-200 bg-white">
          <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
            <div className="flex flex-wrap gap-2">
              {mission.status === 'RUNNING' && (
                <button
                  onClick={handlePause}
                  disabled={actionLoading}
                  className="flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <PauseCircle className="h-4 w-4" />
                  일시정지
                </button>
              )}
              {mission.status !== 'RUNNING' && (
                <button
                  onClick={handleResume}
                  disabled={actionLoading}
                  className="flex items-center gap-2 rounded-lg bg-green-500 px-4 py-2 text-sm font-medium text-white hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <PlayCircle className="h-4 w-4" />
                  재개
                </button>
              )}
              <button
                onClick={handleComplete}
                disabled={actionLoading}
                className="flex items-center gap-2 rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <CheckCircle2 className="h-4 w-4" />
                완료
              </button>
              <button
                onClick={handleCancel}
                disabled={actionLoading}
                className="flex items-center gap-2 rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <XCircle className="h-4 w-4" />
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          {/* Left: Timeline (60%) */}
          <div className="lg:col-span-2">
            <div className="rounded-lg border border-slate-200 bg-white p-6">
              <h2 className="mb-6 text-lg font-semibold text-slate-900">
                Agent 협업 타임라인
                {refreshing && (
                  <span className="ml-2 inline-block">
                    <Loader className="h-4 w-4 animate-spin text-blue-500" />
                  </span>
                )}
              </h2>

              <AgentTimeline
                messages={messages}
                onIntervene={handleIntervention}
                loading={loading}
              />

              {/* Intervention prompt */}
              {showInterventionPrompt && (
                <div className="mt-8 rounded-lg border border-red-200 bg-red-50 p-4">
                  <h3 className="font-semibold text-red-900 mb-3">
                    인간 개입 요청
                  </h3>
                  <div className="space-y-3">
                    <input
                      type="text"
                      value={interventionInput}
                      onChange={(e) => setInterventionInput(e.target.value)}
                      placeholder="결정을 입력하세요..."
                      className="w-full rounded-lg border border-red-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
                    />
                    <button
                      onClick={() => handleIntervention(interventionInput)}
                      disabled={actionLoading || !interventionInput.trim()}
                      className="w-full rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {actionLoading ? '제출 중...' : '결정 제출'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right: Side panel (40%) */}
          <div className="space-y-6">
            {/* Participants */}
            <div className="rounded-lg border border-slate-200 bg-white p-6">
              <h3 className="font-semibold text-slate-900 mb-4">
                참여 Agent
              </h3>
              <div className="space-y-3">
                {mission.participants.map((p, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-3 rounded-lg bg-slate-50 p-3"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500 text-sm font-bold text-white">
                      {p.agentId.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-slate-900">
                        {p.agentId}
                      </p>
                      <p className="text-xs text-slate-600">{p.role}</p>
                    </div>
                  </div>
                ))}
                {mission.participants.length === 0 && (
                  <p className="text-xs text-slate-600">참여자 없음</p>
                )}
              </div>
            </div>

            {/* Live metrics */}
            <div className="rounded-lg border border-slate-200 bg-white p-6">
              <h3 className="font-semibold text-slate-900 mb-4">
                실시간 지표
              </h3>
              <div className="space-y-3">
                <div className="rounded-lg bg-slate-50 p-3">
                  <p className="text-xs text-slate-600">지연</p>
                  <p className="text-lg font-bold text-slate-900">
                    {metrics.latencyMs}ms
                  </p>
                </div>
                <div className="rounded-lg bg-slate-50 p-3">
                  <p className="text-xs text-slate-600">비용</p>
                  <p className="text-lg font-bold text-slate-900">
                    ${metrics.costUsd.toFixed(2)}
                  </p>
                </div>
                <div className="rounded-lg bg-slate-50 p-3">
                  <p className="text-xs text-slate-600">에러</p>
                  <p className="text-lg font-bold text-slate-900">
                    {metrics.errorCount}
                  </p>
                </div>
              </div>
            </div>

            {/* Handoffs summary */}
            <div className="rounded-lg border border-slate-200 bg-white p-6">
              <h3 className="font-semibold text-slate-900 mb-4">
                핸드오프 ({handoffs.length})
              </h3>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {handoffs.length === 0 ? (
                  <p className="text-xs text-slate-600">핸드오프 없음</p>
                ) : (
                  handoffs.map((h) => (
                    <div
                      key={h.id}
                      className="text-xs rounded-lg bg-slate-50 p-2 border-l-2 border-blue-400"
                    >
                      <p className="font-medium text-slate-900">
                        {h.fromAgent} → {h.toAgent}
                      </p>
                      <p className="text-slate-600 mt-1">
                        {typeof h.taskJson?.description === 'string'
                          ? h.taskJson.description
                          : '작업 상세'}
                      </p>
                      <p className="text-slate-500 mt-1">
                        상태: {h.status}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Mission stats */}
            <div className="rounded-lg border border-slate-200 bg-white p-6">
              <h3 className="font-semibold text-slate-900 mb-4">
                미션 통계
              </h3>
              <div className="space-y-2 text-xs text-slate-600">
                <p>
                  자동 조치: <span className="font-semibold">{mission.autoActionsCount}</span>
                </p>
                <p>
                  인간 개입: <span className="font-semibold">{mission.humanInterventionsCount}</span>
                </p>
                <p>
                  진행률:{' '}
                  <span className="font-semibold">
                    {mission.currentStepIndex}/10
                  </span>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
