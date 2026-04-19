'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Shield,
  AlertTriangle,
  AlertOctagon,
  ShieldAlert,
  Eye,
  History,
  TrendingUp,
  ChevronDown,
  CheckCircle2,
  AlertCircle,
  Code,
} from 'lucide-react';
import clsx from 'clsx';
import { api } from '@/lib/api-client';

/**
 * Risk Workspace (FDS - Fraud Detection System)
 *
 * Risk Analyst workspace with:
 * - Real-time alert feed with severity color-coding
 * - 2-column split layout (alerts left, detail right)
 * - Alert detail with risk score, evidence, and similar cases
 * - Learning feedback loop: checkbox to refine rule weights
 * - Action buttons: Block, Escalate, Ignore+Learn
 */

// Types
interface RiskAlert {
  id: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  summary: string;
  subject: string;
  score: number;
  timestamp: string;
}

interface AlertDetail extends RiskAlert {
  ruleId: string;
  ruleName: string;
  evidence?: Record<string, any>;
  similarCases?: {
    id: string;
    score: number;
    outcome: 'false_positive' | 'true_positive' | 'pending';
    timestamp: string;
  }[];
}

interface Summary {
  critical: number;
  high: number;
  pending: number;
  processedToday: number;
}

type TabType = 'realtime' | 'waiting' | 'processing' | 'completed';

export default function RiskWorkspacePage() {
  // State
  const [activeTab, setActiveTab] = useState<TabType>('realtime');
  const [alerts, setAlerts] = useState<RiskAlert[]>([]);
  const [selectedAlertId, setSelectedAlertId] = useState<string | null>(null);
  const [selectedAlertDetail, setSelectedAlertDetail] = useState<AlertDetail | null>(
    null
  );
  const [summary, setSummary] = useState<Summary>({
    critical: 0,
    high: 0,
    pending: 0,
    processedToday: 0,
  });
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [feedbackChecked, setFeedbackChecked] = useState(true);
  const [evidenceExpanded, setEvidenceExpanded] = useState(false);

  // Tab configuration
  const tabs: Array<{ id: TabType; label: string; icon: any }> = [
    { id: 'realtime', label: '실시간 피드', icon: TrendingUp },
    { id: 'waiting', label: '대기', icon: AlertTriangle },
    { id: 'processing', label: '조치 중', icon: AlertCircle },
    { id: 'completed', label: '처리 완료', icon: CheckCircle2 },
  ];

  // Load alerts based on tab
  const loadAlerts = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get<{
        items: RiskAlert[];
        summary: Summary;
      }>(`/fds/alerts?status=${activeTab}`);
      setAlerts(response.items ?? []);
      setSummary(response.summary ?? {
        critical: 0,
        high: 0,
        pending: 0,
        processedToday: 0,
      });
      if (response.items?.[0]) {
        setSelectedAlertId(response.items[0].id);
        await loadAlertDetail(response.items[0].id);
      }
    } catch (err) {
      console.error('Failed to load alerts:', err);
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  // Load alert detail
  const loadAlertDetail = useCallback(async (alertId: string) => {
    try {
      const response = await api.get<AlertDetail>(`/fds/alerts/${alertId}`);
      setSelectedAlertDetail(response);
    } catch (err) {
      console.error('Failed to load alert detail:', err);
    }
  }, []);

  // Handle alert selection
  const handleSelectAlert = useCallback(
    (alert: RiskAlert) => {
      setSelectedAlertId(alert.id);
      loadAlertDetail(alert.id);
    },
    [loadAlertDetail]
  );

  // Load initial data
  useEffect(() => {
    loadAlerts();
  }, [loadAlerts]);

  // Auto-refresh alerts (real-time feed)
  useEffect(() => {
    if (activeTab === 'realtime') {
      const interval = setInterval(loadAlerts, 5000);
      return () => clearInterval(interval);
    }
  }, [activeTab, loadAlerts]);

  // Action handlers
  const handleBlock = useCallback(async () => {
    if (!selectedAlertId) return;
    setActionLoading(true);
    try {
      await api.post(`/fds/alerts/${selectedAlertId}/block`);
      await loadAlerts();
    } catch (err) {
      console.error('Block failed:', err);
    } finally {
      setActionLoading(false);
    }
  }, [selectedAlertId, loadAlerts]);

  const handleEscalate = useCallback(async () => {
    if (!selectedAlertId) return;
    setActionLoading(true);
    try {
      await api.post(`/fds/alerts/${selectedAlertId}/escalate`);
      await loadAlerts();
    } catch (err) {
      console.error('Escalate failed:', err);
    } finally {
      setActionLoading(false);
    }
  }, [selectedAlertId, loadAlerts]);

  const handleIgnoreAndLearn = useCallback(async () => {
    if (!selectedAlertId) return;
    setActionLoading(true);
    try {
      const payload = {
        applyFeedback: feedbackChecked,
      };
      await api.post(`/fds/alerts/${selectedAlertId}/ignore`, payload);
      await loadAlerts();
    } catch (err) {
      console.error('Ignore+Learn failed:', err);
    } finally {
      setActionLoading(false);
    }
  }, [selectedAlertId, feedbackChecked, loadAlerts]);

  // Get severity color
  const getSeverityColor = (severity: string): string => {
    switch (severity) {
      case 'LOW':
        return 'border-l-4 border-blue-500 bg-blue-50';
      case 'MEDIUM':
        return 'border-l-4 border-amber-500 bg-amber-50';
      case 'HIGH':
        return 'border-l-4 border-orange-500 bg-orange-50';
      case 'CRITICAL':
        return 'border-l-4 border-red-500 bg-red-50';
      default:
        return 'border-l-4 border-gray-500 bg-gray-50';
    }
  };

  // Get severity icon
  const getSeverityIcon = (severity: string): any => {
    switch (severity) {
      case 'LOW':
        return AlertTriangle;
      case 'MEDIUM':
        return AlertTriangle;
      case 'HIGH':
        return AlertOctagon;
      case 'CRITICAL':
        return ShieldAlert;
      default:
        return AlertTriangle;
    }
  };

  // Get severity text color
  const getSeverityTextColor = (severity: string): string => {
    switch (severity) {
      case 'LOW':
        return 'text-blue-700';
      case 'MEDIUM':
        return 'text-amber-700';
      case 'HIGH':
        return 'text-orange-700';
      case 'CRITICAL':
        return 'text-red-700';
      default:
        return 'text-gray-700';
    }
  };

  // Count similar case outcomes
  const getSimilarCaseSummary = (): string | null => {
    if (!selectedAlertDetail?.similarCases || selectedAlertDetail.similarCases.length === 0) {
      return null;
    }

    const falsePositives = selectedAlertDetail.similarCases.filter(
      (c) => c.outcome === 'false_positive'
    ).length;
    const total = selectedAlertDetail.similarCases.length;

    if (falsePositives > 0) {
      return `유사 사례 ${total}건 중 ${falsePositives}건은 False Positive로 판정`;
    }
    return null;
  };

  return (
    <div className="flex flex-col h-screen bg-light-bg">
      {/* Header */}
      <div className="bg-white border-b border-border px-6 py-4">
        <h1 className="text-2xl font-bold text-dark flex items-center gap-2">
          <Shield size={24} className="text-accent" />
          FDS 리스크 분석 대시보드
        </h1>
      </div>

      {/* Stats Bar */}
      <div className="bg-white border-b border-border px-6 py-3 grid grid-cols-4 gap-6">
        <div>
          <p className="text-xs text-muted-dark uppercase tracking-wide">CRITICAL</p>
          <p className="text-2xl font-bold text-red-600">{summary.critical}</p>
        </div>
        <div>
          <p className="text-xs text-muted-dark uppercase tracking-wide">HIGH</p>
          <p className="text-2xl font-bold text-orange-600">{summary.high}</p>
        </div>
        <div>
          <p className="text-xs text-muted-dark uppercase tracking-wide">대기 중</p>
          <p className="text-2xl font-bold text-amber-600">{summary.pending}</p>
        </div>
        <div>
          <p className="text-xs text-muted-dark uppercase tracking-wide">
            오늘 처리
          </p>
          <p className="text-2xl font-bold text-green-600">
            {summary.processedToday}
          </p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white border-b border-border px-6 flex gap-4 overflow-x-auto">
        {tabs.map((tab) => {
          const TabIcon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                setSelectedAlertId(null);
              }}
              className={clsx(
                'px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap',
                isActive
                  ? 'border-accent text-accent'
                  : 'border-transparent text-muted-dark hover:text-dark',
              )}
            >
              <TabIcon size={16} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Main Content (2-column split) */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Alert Feed (40%) */}
        <div className="w-2/5 border-r border-border bg-light-bg overflow-y-auto">
          {loading ? (
            <div className="p-4 space-y-3">
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className="h-24 bg-white rounded animate-pulse border-l-4 border-gray-300"
                />
              ))}
            </div>
          ) : alerts.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-sm text-muted-dark">알림이 없습니다.</p>
            </div>
          ) : (
            <div className="p-4 space-y-3">
              {alerts.map((alert) => {
                const SeverityIcon = getSeverityIcon(alert.severity);
                const isSelected = alert.id === selectedAlertId;

                return (
                  <button
                    key={alert.id}
                    onClick={() => handleSelectAlert(alert)}
                    className={clsx(
                      'w-full text-left p-4 rounded-lg transition-all',
                      getSeverityColor(alert.severity),
                      isSelected &&
                        'ring-2 ring-accent shadow-lg scale-105 z-10'
                    )}
                  >
                    {/* Card Header */}
                    <div className="flex items-start justify-between gap-3">
                      <SeverityIcon
                        size={18}
                        className={getSeverityTextColor(alert.severity)}
                      />
                      <span
                        className={clsx(
                          'font-semibold text-sm',
                          getSeverityTextColor(alert.severity)
                        )}
                      >
                        {alert.severity}
                      </span>
                    </div>

                    {/* Summary */}
                    <p className="text-sm font-medium text-dark mt-2">
                      {alert.summary}
                    </p>

                    {/* Subject */}
                    <p className="text-xs text-muted-dark mt-1 line-clamp-2">
                      {alert.subject}
                    </p>

                    {/* Score and Timestamp */}
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-current border-opacity-20">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-white bg-opacity-50 rounded h-1.5 w-16">
                          <div
                            className={clsx(
                              'h-full rounded transition-all',
                              alert.score > 80
                                ? 'bg-red-500'
                                : alert.score > 50
                                ? 'bg-orange-500'
                                : 'bg-amber-500'
                            )}
                            style={{ width: `${alert.score}%` }}
                          />
                        </div>
                        <span className="text-xs font-mono font-semibold">
                          {alert.score}
                        </span>
                      </div>
                      <span className="text-xs text-muted-dark">
                        {new Date(alert.timestamp).toLocaleTimeString('ko-KR', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: Alert Detail (60%) */}
        <div className="w-3/5 bg-light-bg overflow-hidden flex flex-col">
          {selectedAlertDetail ? (
            <div className="flex flex-col h-full overflow-hidden">
              {/* Detail Header */}
              <div className="bg-white border-b border-border px-6 py-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-semibold text-dark flex items-center gap-2">
                      <ShieldAlert size={20} className="text-accent" />
                      {selectedAlertDetail.summary}
                    </h2>
                    <p className="text-xs text-muted-dark mt-2">
                      {selectedAlertDetail.ruleName} • {selectedAlertDetail.ruleId}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-dark">
                      {selectedAlertDetail.score}
                    </p>
                    <p className="text-xs text-muted-dark">위험도</p>
                  </div>
                </div>
              </div>

              {/* Risk Score Progress Bar */}
              <div className="bg-white border-b border-border px-6 py-4">
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-dark uppercase">
                    위험도 점수
                  </p>
                  <div className="flex gap-3 items-center">
                    <div className="flex-1 bg-gray-200 rounded-full h-3 overflow-hidden">
                      <div
                        className={clsx(
                          'h-full transition-all rounded-full',
                          selectedAlertDetail.score > 80
                            ? 'bg-red-500'
                            : selectedAlertDetail.score > 50
                            ? 'bg-orange-500'
                            : 'bg-amber-500'
                        )}
                        style={{ width: `${selectedAlertDetail.score}%` }}
                      />
                    </div>
                    <span className="text-xs font-mono font-semibold w-10">
                      {selectedAlertDetail.score}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Scrollable Content */}
              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
                {/* Evidence JSON */}
                <div className="bg-white border border-border rounded-lg">
                  <button
                    onClick={() => setEvidenceExpanded(!evidenceExpanded)}
                    className="w-full px-4 py-3 flex items-center justify-between bg-table-header border-b border-border hover:bg-table-alt transition-colors"
                  >
                    <span className="font-semibold text-sm text-dark flex items-center gap-2">
                      <Code size={16} />
                      증거 데이터 (JSON)
                    </span>
                    <ChevronDown
                      size={16}
                      className={clsx(
                        'transition-transform',
                        evidenceExpanded && 'rotate-180'
                      )}
                    />
                  </button>
                  {evidenceExpanded && (
                    <pre className="p-4 text-xs text-dark font-mono bg-table-alt max-h-40 overflow-y-auto whitespace-pre-wrap break-words">
                      {JSON.stringify(selectedAlertDetail.evidence ?? {}, null, 2)}
                    </pre>
                  )}
                </div>

                {/* Similar Cases */}
                <div className="bg-white border border-border rounded-lg">
                  <div className="px-4 py-3 border-b border-border bg-table-header">
                    <span className="font-semibold text-sm text-dark flex items-center gap-2">
                      <History size={16} />
                      유사 사례
                    </span>
                  </div>
                  {selectedAlertDetail.similarCases &&
                  selectedAlertDetail.similarCases.length > 0 ? (
                    <div className="divide-y divide-border">
                      {getSimilarCaseSummary() && (
                        <div className="px-4 py-3 bg-blue-50 border-b border-blue-200">
                          <p className="text-xs text-blue-700 font-semibold flex items-center gap-2">
                            <Eye size={14} />
                            {getSimilarCaseSummary()}
                          </p>
                        </div>
                      )}
                      {selectedAlertDetail.similarCases.map((caseItem, idx) => (
                        <div key={idx} className="px-4 py-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-xs font-mono text-dark">
                                {caseItem.id}
                              </p>
                              <p className="text-xs text-muted-dark mt-1">
                                {new Date(caseItem.timestamp).toLocaleDateString(
                                  'ko-KR'
                                )}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-xs font-semibold text-dark">
                                {caseItem.score}
                              </p>
                              <span
                                className={clsx(
                                  'text-xs font-semibold',
                                  caseItem.outcome === 'false_positive'
                                    ? 'text-green-600'
                                    : caseItem.outcome === 'true_positive'
                                    ? 'text-red-600'
                                    : 'text-amber-600'
                                )}
                              >
                                {caseItem.outcome === 'false_positive'
                                  ? 'False Positive'
                                  : caseItem.outcome === 'true_positive'
                                  ? 'True Positive'
                                  : 'Pending'}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="px-4 py-6 text-center">
                      <p className="text-xs text-muted-dark">유사 사례가 없습니다.</p>
                    </div>
                  )}
                </div>

                {/* Feedback Checkbox */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={feedbackChecked}
                      onChange={(e) => setFeedbackChecked(e.target.checked)}
                      className="mt-1 cursor-pointer"
                    />
                    <span className="text-xs text-blue-700">
                      <span className="font-semibold">피드백을 룰 가중치 조정에 반영</span>
                      <p className="mt-1 text-blue-600">
                        이 결과를 통해 향후 유사한 패턴 감지 정확도를 개선합니다.
                      </p>
                    </span>
                  </label>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="bg-white border-t border-border px-6 py-4 flex gap-3">
                <button
                  onClick={handleBlock}
                  disabled={actionLoading}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded font-medium text-sm hover:bg-red-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                >
                  <ShieldAlert size={16} />
                  차단
                </button>
                <button
                  onClick={handleEscalate}
                  disabled={actionLoading}
                  className="flex-1 px-4 py-2 bg-orange-600 text-white rounded font-medium text-sm hover:bg-orange-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                >
                  <TrendingUp size={16} />
                  에스컬레이션
                </button>
                <button
                  onClick={handleIgnoreAndLearn}
                  disabled={actionLoading}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded font-medium text-sm hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                >
                  <CheckCircle2 size={16} />
                  무시+학습
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-sm text-muted-dark">알림을 선택하세요</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
