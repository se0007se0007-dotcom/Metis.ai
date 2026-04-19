'use client';

import { useState } from 'react';
import { Sparkles, X } from 'lucide-react';
import clsx from 'clsx';

export type ActionButtonKind = 'primary' | 'secondary' | 'danger';

export interface ActionButton {
  label: string;
  onClick: () => void;
  kind?: ActionButtonKind;
}

interface AIInsightCardProps {
  headline: string;
  body: string;
  actions: ActionButton[];
  dismissible?: boolean;
  onDismiss?: () => void;
  loading?: boolean;
}

const buttonKindConfig: Record<ActionButtonKind, string> = {
  primary:
    'bg-accent hover:bg-accent-dark text-white font-medium px-4 py-2 rounded transition-colors',
  secondary:
    'bg-light-bg hover:bg-table-alt text-dark border border-border font-medium px-4 py-2 rounded transition-colors',
  danger:
    'bg-red-100 hover:bg-red-200 text-red-700 font-medium px-4 py-2 rounded transition-colors',
};

/**
 * Shimmer loading skeleton
 */
function ShimmerLoader() {
  return (
    <div className="space-y-3">
      <div className="h-5 bg-gradient-to-r from-accent/20 to-accent/10 rounded animate-pulse w-3/4" />
      <div className="space-y-2">
        <div className="h-3 bg-gradient-to-r from-accent/20 to-accent/10 rounded animate-pulse w-full" />
        <div className="h-3 bg-gradient-to-r from-accent/20 to-accent/10 rounded animate-pulse w-5/6" />
      </div>
    </div>
  );
}

export function AIInsightCard({
  headline,
  body,
  actions,
  dismissible = false,
  onDismiss,
  loading = false,
}: AIInsightCardProps) {
  const [dismissed, setDismissed] = useState(false);

  const handleDismiss = () => {
    setDismissed(true);
    onDismiss?.();
  };

  if (dismissed) return null;

  return (
    <div className="w-full bg-gradient-to-r from-purple-600 via-purple-500 to-blue-500 rounded-lg shadow-md p-6 text-white">
      <div className="flex items-start gap-4">
        {/* Icon */}
        <div className="flex-shrink-0 mt-1">
          <Sparkles size={24} className="text-white/90" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {loading ? (
            <div className="text-white/70">
              <ShimmerLoader />
            </div>
          ) : (
            <>
              <h3 className="text-base font-bold text-white mb-2">
                {headline}
              </h3>
              <p className="text-sm text-white/90 mb-4 leading-relaxed">
                {body}
              </p>

              {/* Action Buttons */}
              {actions.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {actions.map((action, idx) => {
                    const kind = action.kind ?? 'secondary';
                    return (
                      <button
                        key={idx}
                        onClick={action.onClick}
                        className={clsx(
                          'text-xs sm:text-sm transition-all',
                          kind === 'primary'
                            ? 'bg-white hover:bg-white/90 text-purple-600 font-semibold px-3 py-2 rounded'
                            : kind === 'danger'
                              ? 'bg-red-500 hover:bg-red-600 text-white font-semibold px-3 py-2 rounded'
                              : 'bg-white/20 hover:bg-white/30 text-white font-semibold px-3 py-2 rounded border border-white/30',
                        )}
                      >
                        {action.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>

        {/* Close Button */}
        {dismissible && (
          <button
            onClick={handleDismiss}
            className="flex-shrink-0 text-white/70 hover:text-white transition-colors p-1"
            aria-label="닫기"
          >
            <X size={20} />
          </button>
        )}
      </div>
    </div>
  );
}
