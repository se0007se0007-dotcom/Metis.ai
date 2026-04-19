'use client';

import { ArrowUp, ArrowDown, Minus } from 'lucide-react';
import clsx from 'clsx';

interface MetricComparisonCardProps {
  label: string;
  unit?: string;
  baselineValue: number;
  candidateValue: number;
  baselineLabel?: string;
  candidateLabel?: string;
  isImproved?: 'better' | 'worse' | 'neutral'; // if not provided, infer from higher/lower
  invertComparison?: boolean; // if true, lower is better
  showChart?: boolean;
}

export function MetricComparisonCard({
  label,
  unit = '',
  baselineValue,
  candidateValue,
  baselineLabel = 'Baseline',
  candidateLabel = 'Candidate',
  isImproved,
  invertComparison = false,
  showChart = true,
}: MetricComparisonCardProps) {
  // Calculate delta
  const delta = candidateValue - baselineValue;
  const deltaPercent =
    baselineValue !== 0 ? ((delta / Math.abs(baselineValue)) * 100).toFixed(1) : '0';

  // Infer improvement if not provided
  let improvementType: 'better' | 'worse' | 'neutral' = 'neutral';
  if (isImproved !== undefined) {
    improvementType = isImproved;
  } else if (delta !== 0) {
    if (invertComparison) {
      improvementType = delta < 0 ? 'better' : 'worse';
    } else {
      improvementType = delta > 0 ? 'better' : 'worse';
    }
  }

  const deltaColor =
    improvementType === 'better'
      ? 'text-success'
      : improvementType === 'worse'
        ? 'text-danger'
        : 'text-muted-dark';

  // Normalize values for mini bar chart (0-100 scale)
  const maxValue = Math.max(Math.abs(baselineValue), Math.abs(candidateValue)) || 1;
  const baselineWidth = (Math.abs(baselineValue) / maxValue) * 100;
  const candidateWidth = (Math.abs(candidateValue) / maxValue) * 100;

  return (
    <div className="bg-card border border-border rounded-lg p-4 shadow-sm">
      {/* Label */}
      <h4 className="text-xs font-semibold text-muted-dark uppercase tracking-wide mb-4">
        {label}
      </h4>

      {/* Values Side by Side */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        {/* Baseline */}
        <div>
          <p className="text-xs text-muted-dark mb-1">{baselineLabel}</p>
          <p className="text-lg font-bold text-dark">
            {baselineValue.toFixed(2)}
            {unit && <span className="text-xs text-muted-dark ml-1">{unit}</span>}
          </p>
        </div>

        {/* Candidate */}
        <div>
          <p className="text-xs text-muted-dark mb-1">{candidateLabel}</p>
          <p className="text-lg font-bold text-dark">
            {candidateValue.toFixed(2)}
            {unit && <span className="text-xs text-muted-dark ml-1">{unit}</span>}
          </p>
        </div>
      </div>

      {/* Delta Indicator */}
      <div className="flex items-center gap-2 mb-4 p-2 bg-table-alt rounded">
        {improvementType === 'better' && (
          <ArrowUp size={14} className="text-success flex-shrink-0" />
        )}
        {improvementType === 'worse' && (
          <ArrowDown size={14} className="text-danger flex-shrink-0" />
        )}
        {improvementType === 'neutral' && (
          <Minus size={14} className="text-muted-dark flex-shrink-0" />
        )}
        <span className={clsx('text-sm font-semibold', deltaColor)}>
          {delta > 0 ? '+' : ''}{delta.toFixed(2)} ({deltaPercent}%)
        </span>
      </div>

      {/* Mini Bar Chart */}
      {showChart && (
        <div className="space-y-2">
          <div>
            <p className="text-xs text-muted-dark mb-1">{baselineLabel}</p>
            <div className="h-2 bg-table-alt rounded overflow-hidden">
              <div
                className="h-full bg-muted-dark/30 transition-all"
                style={{ width: `${baselineWidth}%` }}
              />
            </div>
          </div>
          <div>
            <p className="text-xs text-muted-dark mb-1">{candidateLabel}</p>
            <div className="h-2 bg-table-alt rounded overflow-hidden">
              <div
                className={clsx(
                  'h-full transition-all',
                  improvementType === 'better'
                    ? 'bg-success/70'
                    : improvementType === 'worse'
                      ? 'bg-danger/70'
                      : 'bg-accent/70',
                )}
                style={{ width: `${candidateWidth}%` }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
