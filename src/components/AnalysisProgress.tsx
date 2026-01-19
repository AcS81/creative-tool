"use client";

import { useEffect, useMemo, useState } from "react";
import type { VideoSkeleton } from "../lib/analysis/types/skeleton";

type StageStatus = "pending" | "running" | "complete" | "failed";

type AnalysisStage = {
  id: "structure" | "core" | "advanced" | "derived";
  label: string;
  description: string;
  estimatedDuration: number; // seconds
  icon: string;
};

type Props = {
  active: boolean;
  currentStage?: string | null;
  skeleton?: VideoSkeleton | null;
  passMode?: "core" | "full";
  lastHeartbeatAt?: string | null;
  stalled?: boolean;
  onResume?: () => void;
  startedAt?: Date | null;
};

const STAGES: AnalysisStage[] = [
  {
    id: "structure",
    label: "Analyzing video structure...",
    description: "Identifying chapters, scenes, and key moments",
    estimatedDuration: 15,
    icon: "🏗️",
  },
  {
    id: "core",
    label: "Measuring core metrics...",
    description: "Voice, language, narrative, visual, sound",
    estimatedDuration: 45,
    icon: "📊",
  },
  {
    id: "advanced",
    label: "Analyzing key moments...",
    description: "Prosody, alignment, timing, and emphasis",
    estimatedDuration: 30,
    icon: "🔍",
  },
  {
    id: "derived",
    label: "Computing insights...",
    description: "Cross-modal alignment and derived scores",
    estimatedDuration: 5,
    icon: "💡",
  },
];

const formatDuration = (seconds: number): string => {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
};

const formatElapsed = (timestamp: string) => {
  const elapsedMs = Date.now() - new Date(timestamp).getTime();
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0) return "just now";
  const seconds = Math.floor(elapsedMs / 1000);
  return formatDuration(seconds);
};

export const AnalysisProgress = ({
  active,
  currentStage,
  skeleton,
  passMode,
  lastHeartbeatAt,
  stalled,
  onResume,
  startedAt,
}: Props) => {
  const [elapsedTime, setElapsedTime] = useState(0);

  // Filter stages based on passMode
  const activeStages = useMemo(() => {
    if (passMode === "core") {
      return STAGES.filter((s) => s.id !== "advanced");
    }
    return STAGES;
  }, [passMode]);

  // Determine stage statuses
  const stageStatuses = useMemo((): Record<string, StageStatus> => {
    if (!active || !currentStage) {
      return Object.fromEntries(activeStages.map((s) => [s.id, "pending"]));
    }

    const statuses: Record<string, StageStatus> = {};
    let foundCurrent = false;

    for (const stage of activeStages) {
      if (stage.id === currentStage) {
        statuses[stage.id] = stalled ? "failed" : "running";
        foundCurrent = true;
      } else if (!foundCurrent) {
        statuses[stage.id] = "complete";
      } else {
        statuses[stage.id] = "pending";
      }
    }

    return statuses;
  }, [active, currentStage, activeStages, stalled]);

  // Calculate elapsed and estimated remaining time
  useEffect(() => {
    if (!active || !startedAt) {
      setElapsedTime(0);
      return;
    }

    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startedAt.getTime()) / 1000);
      setElapsedTime(elapsed);
    }, 1000);

    return () => clearInterval(interval);
  }, [active, startedAt]);

  const estimatedRemaining = useMemo(() => {
    if (!currentStage) return 0;
    
    const currentIndex = activeStages.findIndex((s) => s.id === currentStage);
    if (currentIndex === -1) return 0;

    // Sum remaining stages (excluding current)
    return activeStages
      .slice(currentIndex + 1)
      .reduce((sum, stage) => sum + stage.estimatedDuration, 0);
  }, [currentStage, activeStages]);

  const progress = useMemo(() => {
    const completedCount = Object.values(stageStatuses).filter((s) => s === "complete").length;
    return (completedCount / activeStages.length) * 100;
  }, [stageStatuses, activeStages.length]);

  const heartbeatLabel = lastHeartbeatAt ? formatElapsed(lastHeartbeatAt) : null;

  const getStageIcon = (status: StageStatus) => {
    switch (status) {
      case "complete":
        return "✓";
      case "running":
        return "⋯";
      case "failed":
        return "✗";
      default:
        return "○";
    }
  };

  const getStatusColor = (status: StageStatus) => {
    switch (status) {
      case "complete":
        return "text-emerald-600 bg-emerald-50 border-emerald-200";
      case "running":
        return "text-accent bg-accent/10 border-accent/30";
      case "failed":
        return "text-red-600 bg-red-50 border-red-200";
      default:
        return "text-muted bg-surface-strong border-border/50";
    }
  };

  if (!active) return null;

  return (
    <div className="cs-card w-full space-y-6 p-8" role="status" aria-live="polite">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold text-foreground">Analysis in progress</h3>
          <p className="mt-1 text-sm text-muted">
            {elapsedTime > 0 && `${formatDuration(elapsedTime)} elapsed`}
            {estimatedRemaining > 0 && ` • ~${formatDuration(estimatedRemaining)} remaining`}
          </p>
        </div>
        {stalled && onResume ? (
          <button type="button" className="cs-button text-sm" onClick={onResume}>
            Resume analysis
          </button>
        ) : null}
      </div>

      {/* Progress bar */}
      <div className="space-y-2">
        <div className="relative h-3 w-full overflow-hidden rounded-full bg-surface-strong">
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-accent to-accent-amber transition-all duration-700 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-xs text-muted">
          <span>{Math.round(progress)}% complete</span>
          {heartbeatLabel && !stalled ? <span>Last update {heartbeatLabel}</span> : null}
          {stalled ? <span className="font-semibold text-amber-600">Connection stalled</span> : null}
        </div>
      </div>

      {/* Stages */}
      <div className="grid gap-4 md:grid-cols-2">
        {activeStages.map((stage) => {
          const status = stageStatuses[stage.id] || "pending";
          const isActive = status === "running";
          const isComplete = status === "complete";
          const isFailed = status === "failed";

          return (
            <div
              key={stage.id}
              className={`group relative overflow-hidden rounded-xl border-2 p-5 shadow-sm transition-all duration-300 ${
                isActive
                  ? "border-accent bg-gradient-to-br from-white to-accent/5 shadow-md"
                  : isComplete
                    ? "border-emerald-200 bg-emerald-50/50"
                    : isFailed
                      ? "border-red-200 bg-red-50/50"
                      : "border-border/50 bg-surface-strong/30"
              }`}
            >
              {/* Animated background for running stage */}
              {isActive && (
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-accent/5 to-transparent animate-shimmer" />
              )}

              <div className="relative flex items-start gap-4">
                {/* Icon */}
                <div
                  className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-2xl font-bold transition-all ${
                    isActive
                      ? "bg-accent/10 text-accent ring-2 ring-accent/20"
                      : isComplete
                        ? "bg-emerald-100 text-emerald-600"
                        : isFailed
                          ? "bg-red-100 text-red-600"
                          : "bg-surface text-muted"
                  }`}
                >
                  {isActive || isComplete || isFailed ? getStageIcon(status) : stage.icon}
                </div>

                {/* Content */}
                <div className="flex-1 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <h4
                      className={`text-base font-semibold transition-colors ${
                        isActive ? "text-foreground" : isComplete ? "text-emerald-700" : "text-muted"
                      }`}
                    >
                      {stage.label}
                    </h4>
                    <span
                      className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${getStatusColor(status)}`}
                    >
                      {status.charAt(0).toUpperCase() + status.slice(1)}
                    </span>
                  </div>
                  <p className="text-sm text-muted">{stage.description}</p>
                  
                  {/* Estimated duration for pending stages */}
                  {status === "pending" && (
                    <p className="text-xs text-muted/70">~{formatDuration(stage.estimatedDuration)}</p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Skeleton summary (shown when structure completes) */}
      {skeleton && (
        <div className="rounded-xl border-2 border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-6 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-2xl">
              🎬
            </div>
            <div className="flex-1 space-y-3">
              <div>
                <h4 className="text-base font-semibold text-emerald-900">Structure identified</h4>
                <p className="mt-1 text-sm text-emerald-700">{skeleton.topicSummary}</p>
              </div>
              
              <div className="flex flex-wrap gap-3">
                <div className="rounded-lg border border-emerald-200 bg-white px-3 py-1.5">
                  <span className="text-xs font-semibold text-emerald-600">Type:</span>{" "}
                  <span className="text-xs text-emerald-900">{skeleton.videoType}</span>
                </div>
                <div className="rounded-lg border border-emerald-200 bg-white px-3 py-1.5">
                  <span className="text-xs font-semibold text-emerald-600">Duration:</span>{" "}
                  <span className="text-xs text-emerald-900">{formatDuration(skeleton.durationSeconds)}</span>
                </div>
                <div className="rounded-lg border border-emerald-200 bg-white px-3 py-1.5">
                  <span className="text-xs font-semibold text-emerald-600">Chapters:</span>{" "}
                  <span className="text-xs text-emerald-900">{skeleton.chapters.length}</span>
                </div>
                <div className="rounded-lg border border-emerald-200 bg-white px-3 py-1.5">
                  <span className="text-xs font-semibold text-emerald-600">Key moments:</span>{" "}
                  <span className="text-xs text-emerald-900">{skeleton.keyMoments.length}</span>
                </div>
              </div>

              {skeleton.chapters.length > 0 && (
                <details className="group/details">
                  <summary className="cursor-pointer text-xs font-semibold text-emerald-700 hover:text-emerald-800">
                    View chapters ({skeleton.chapters.length})
                  </summary>
                  <ul className="mt-2 space-y-1 rounded-lg border border-emerald-100 bg-white p-3">
                    {skeleton.chapters.map((chapter, idx) => (
                      <li key={chapter.id} className="flex gap-2 text-xs">
                        <span className="font-semibold text-emerald-600">{idx + 1}.</span>
                        <span className="text-emerald-900">{chapter.title}</span>
                        <span className="text-emerald-500">({chapter.chapterType})</span>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Footer tip */}
      <div className="rounded-lg border border-border bg-surface-strong/50 p-4 text-xs text-muted">
        <p>
          <strong className="text-foreground">Tip:</strong> Keep this tab open. Results will appear automatically when
          complete. {passMode === "full" ? "Full mode may take 5-15 minutes for longer videos." : "Core mode typically completes in 2-5 minutes."}
        </p>
      </div>
    </div>
  );
};
