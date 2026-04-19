'use client';

import { ReactNode } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Info,
  AlertTriangle,
  Zap,
} from 'lucide-react';
import clsx from 'clsx';

export type FeedEventKind = 'info' | 'warning' | 'error' | 'success' | 'action';

export interface FeedEvent {
  id: string;
  timestamp: string;
  actor: string;
  kind: FeedEventKind;
  summary: string;
  details?: Record<string, any>;
}

interface EventFeedProps {
  events: FeedEvent[];
  onEventClick?: (ev: FeedEvent) => void;
  emptyMessage?: string;
  maxHeight?: string;
}

/**
 * Calculate relative time from timestamp (ISO string or Date)
 */
export function relativeTime(timestamp: string | Date): string {
  const date =
    typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return '방금 전';
  if (diffMin < 60) return `${diffMin}분 전`;
  if (diffHour < 24) return `${diffHour}시간 전`;
  if (diffDay < 30) return `${diffDay}일 전`;

  return date.toLocaleDateString('ko-KR');
}

const kindConfig: Record<
  FeedEventKind,
  { icon: ReactNode; bgColor: string; borderColor: string; textColor: string }
> = {
  info: {
    icon: <Info size={16} />,
    bgColor: 'bg-blue-50',
    borderColor: 'border-l-blue-400',
    textColor: 'text-blue-600',
  },
  warning: {
    icon: <AlertTriangle size={16} />,
    bgColor: 'bg-yellow-50',
    borderColor: 'border-l-yellow-400',
    textColor: 'text-yellow-600',
  },
  error: {
    icon: <AlertCircle size={16} />,
    bgColor: 'bg-red-50',
    borderColor: 'border-l-red-400',
    textColor: 'text-red-600',
  },
  success: {
    icon: <CheckCircle2 size={16} />,
    bgColor: 'bg-green-50',
    borderColor: 'border-l-green-400',
    textColor: 'text-green-600',
  },
  action: {
    icon: <Zap size={16} />,
    bgColor: 'bg-purple-50',
    borderColor: 'border-l-purple-400',
    textColor: 'text-purple-600',
  },
};

export function EventFeed({
  events,
  onEventClick,
  emptyMessage = '이벤트가 없습니다',
  maxHeight = 'max-h-96',
}: EventFeedProps) {
  return (
    <div
      className={clsx(
        'flex flex-col gap-0 overflow-y-auto border border-border rounded-lg bg-card',
        maxHeight,
      )}
    >
      {events.length === 0 ? (
        <div className="flex items-center justify-center py-8 px-4">
          <p className="text-sm text-muted-dark">{emptyMessage}</p>
        </div>
      ) : (
        <div className="divide-y divide-border">
          {events.map((event) => {
            const config = kindConfig[event.kind];
            return (
              <div
                key={event.id}
                onClick={() => onEventClick?.(event)}
                className={clsx(
                  'border-l-4 px-4 py-3 transition-colors',
                  config.borderColor,
                  config.bgColor,
                  onEventClick && 'cursor-pointer hover:opacity-80',
                )}
              >
                <div className="flex items-start gap-3">
                  {/* Icon */}
                  <div className={clsx('flex-shrink-0 mt-0.5', config.textColor)}>
                    {config.icon}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <p className="text-xs font-semibold text-muted-dark">
                          {event.actor}
                        </p>
                        <p className="text-sm text-dark font-medium mt-0.5">
                          {event.summary}
                        </p>
                      </div>
                      <div className="text-xs text-muted-dark flex-shrink-0 whitespace-nowrap">
                        {relativeTime(event.timestamp)}
                      </div>
                    </div>

                    {/* Details (if provided) */}
                    {event.details && Object.keys(event.details).length > 0 && (
                      <div className="mt-2 text-xs text-muted-dark space-y-1">
                        {Object.entries(event.details).map(([key, value]) => (
                          <div key={key} className="flex gap-2">
                            <span className="font-mono text-muted-dark">
                              {key}:
                            </span>
                            <span className="font-mono text-dark truncate">
                              {typeof value === 'string'
                                ? value
                                : JSON.stringify(value)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
