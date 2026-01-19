"use client";

import { useState } from "react";

type MetricData = {
  score?: number;
  value?: string | number;
  observed?: boolean;
  timeline?: Array<{ timeSeconds: number; value: number }>;
  spans?: Array<any>;
  items?: Array<any>;
};

type Props = {
  metric?: MetricData | null;
  label?: string;
  showScore?: boolean;
  showValue?: boolean;
  showBadge?: boolean;
  unobservedReason?: string;
  className?: string;
};

export const MetricValue = ({
  metric,
  label,
  showScore = true,
  showValue = true,
  showBadge = true,
  unobservedReason,
  className = "",
}: Props) => {
  const isObserved = metric?.observed !== false;
  const hasPartialData = metric && !isObserved && (metric.value || metric.score !== undefined);

  if (!metric || (!isObserved && !hasPartialData)) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        {label && <span className="text-sm font-medium text-muted">{label}:</span>}
        <UnobservedChip reason={unobservedReason} />
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {label && <span className="text-sm font-medium text-muted">{label}:</span>}
      <div className="flex items-center gap-2">
        {showScore && metric.score !== undefined && (
          <span className="text-base font-bold text-foreground">{Math.round(metric.score)}</span>
        )}
        {showValue && metric.value && (
          <span className="text-sm text-foreground">{String(metric.value)}</span>
        )}
        {showBadge && (
          <>
            {isObserved && <ObservedBadge />}
            {hasPartialData && <PartialBadge reason="Some data available but incomplete" />}
          </>
        )}
      </div>
    </div>
  );
};

// ObservedBadge - green checkmark
export const ObservedBadge = () => {
  return (
    <div
      className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 ring-1 ring-emerald-300"
      title="Metric observed"
    >
      <svg
        className="h-3 w-3 text-emerald-600"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path d="M5 13l4 4L19 7" />
      </svg>
    </div>
  );
};

// UnobservedChip - gray "Not measured" with tooltip
export const UnobservedChip = ({ reason }: { reason?: string }) => {
  const [showTooltip, setShowTooltip] = useState(false);

  const defaultReason = "This metric could not be measured for this video";

  return (
    <div className="relative inline-flex">
      <div
        className="cursor-help rounded-full bg-surface-strong px-2.5 py-1 text-xs font-semibold text-muted ring-1 ring-border transition-colors hover:bg-slate-100"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        Not measured
      </div>
      {showTooltip && (
        <div className="absolute bottom-full left-1/2 z-50 mb-2 w-48 -translate-x-1/2 rounded-lg border border-border bg-white p-3 text-xs text-muted shadow-xl">
          <p className="font-semibold text-foreground">Why not measured?</p>
          <p className="mt-1">{reason || defaultReason}</p>
          <div className="absolute left-1/2 top-full -translate-x-1/2">
            <div className="border-4 border-transparent border-t-white" />
          </div>
        </div>
      )}
    </div>
  );
};

// PartialBadge - yellow indicator for partial data
export const PartialBadge = ({ reason }: { reason?: string }) => {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div className="relative inline-flex">
      <div
        className="flex h-5 w-5 cursor-help items-center justify-center rounded-full bg-amber-100 ring-1 ring-amber-300 transition-colors hover:bg-amber-200"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        title="Partial data"
      >
        <svg
          className="h-3 w-3 text-amber-600"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      </div>
      {showTooltip && reason && (
        <div className="absolute bottom-full left-1/2 z-50 mb-2 w-48 -translate-x-1/2 rounded-lg border border-border bg-white p-3 text-xs text-muted shadow-xl">
          <p className="font-semibold text-amber-700">Partial data</p>
          <p className="mt-1">{reason}</p>
          <div className="absolute left-1/2 top-full -translate-x-1/2">
            <div className="border-4 border-transparent border-t-white" />
          </div>
        </div>
      )}
    </div>
  );
};

// Helper component for showing coverage percentage
export const CoverageIndicator = ({ 
  observedCount, 
  totalCount, 
  label = "metrics measured" 
}: { 
  observedCount: number; 
  totalCount: number; 
  label?: string;
}) => {
  const percentage = totalCount > 0 ? (observedCount / totalCount) * 100 : 0;
  const isGood = percentage >= 75;
  const isFair = percentage >= 50 && percentage < 75;
  const isPoor = percentage < 50;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-muted">
          {observedCount} of {totalCount} {label}
        </span>
        <span className={`font-bold ${isGood ? "text-emerald-600" : isFair ? "text-amber-600" : "text-red-600"}`}>
          {Math.round(percentage)}%
        </span>
      </div>
      <div className="relative h-2 w-full overflow-hidden rounded-full bg-surface-strong">
        <div
          className={`absolute inset-y-0 left-0 rounded-full transition-all duration-700 ${
            isGood ? "bg-emerald-500" : isFair ? "bg-amber-500" : "bg-red-500"
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      {isPoor && totalCount > 0 && (
        <p className="text-xs text-muted">
          Low coverage may be due to video length, content type, or analysis constraints.
        </p>
      )}
    </div>
  );
};
