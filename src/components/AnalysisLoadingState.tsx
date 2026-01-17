"use client";

import { useEffect, useMemo, useState } from "react";

type Step = {
  key: string;
  label: string;
  detail: string;
  optional?: boolean;
};

type Props = {
  active: boolean;
  passMode?: "core" | "full";
  currentStage?: string | null;
  lastHeartbeatAt?: string | null;
  stalled?: boolean;
  onResume?: () => void;
};

const buildSteps = (passMode?: "core" | "full"): Step[] => {
  const steps: Step[] = [
    {
      key: "queued",
      label: "Validating URL and metadata",
      detail: "Checking the video link and fetching title/duration.",
    },
    {
      key: "ingestion",
      label: "Ingesting video",
      detail: "Pulling audio + frames for analysis.",
    },
    {
      key: "core",
      label: "Analyzing core signals",
      detail: "Voice, language, narrative, visual, editing, and sound.",
    },
  ];

  if (passMode !== "core") {
    steps.push({
      key: "advanced",
      label: "Analyzing advanced signals",
      detail: "Prosody, alignment, modality balance, and cognitive load.",
      optional: passMode === undefined,
    });
  }

  steps.push({
    key: "finalize",
    label: "Synthesizing coaching",
    detail: "Building insights and archetypes.",
  });

  return steps;
};

const formatElapsed = (timestamp: string) => {
  const elapsedMs = Date.now() - new Date(timestamp).getTime();
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0) return "just now";
  if (elapsedMs < 60000) return "just now";
  if (elapsedMs < 3600000) return `${Math.round(elapsedMs / 60000)}m ago`;
  const hours = Math.round(elapsedMs / 3600000);
  return `${hours}h ago`;
};

export const AnalysisLoadingState = ({
  active,
  passMode,
  currentStage,
  lastHeartbeatAt,
  stalled,
  onResume,
}: Props) => {
  const steps = useMemo(() => buildSteps(passMode), [passMode]);
  const [stage, setStage] = useState(0);

  const resolvedStageIndex = useMemo(() => {
    if (!currentStage) return null;
    const directIndex = steps.findIndex((step) => step.key === currentStage);
    if (directIndex >= 0) return directIndex;
    if (currentStage === "performance") {
      const finalizeIndex = steps.findIndex((step) => step.key === "finalize");
      return finalizeIndex >= 0 ? finalizeIndex : null;
    }
    return null;
  }, [currentStage, steps]);

  useEffect(() => {
    if (!active) {
      setStage(0);
      return;
    }

    if (resolvedStageIndex !== null) {
      setStage(resolvedStageIndex);
      return;
    }

    let current = 0;
    setStage(0);
    const interval = setInterval(() => {
      current = Math.min(current + 1, steps.length - 1);
      setStage(current);
    }, 3200);

    return () => clearInterval(interval);
  }, [active, steps.length, resolvedStageIndex]);

  const currentLabel =
    currentStage === "performance"
      ? "Attaching performance data"
      : steps[stage]?.label ?? "Running analysis";
  const heartbeatLabel = lastHeartbeatAt ? formatElapsed(lastHeartbeatAt) : null;

  return (
    <div className="cs-card space-y-4 p-6" role="status" aria-live="polite">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-muted">Running analysis...</p>
        {stalled && onResume ? (
          <button type="button" className="cs-button-secondary text-xs" onClick={onResume}>
            Resume analysis
          </button>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-3 text-xs text-muted">
        <span>Stage: {currentLabel}</span>
        {heartbeatLabel ? <span>Last heartbeat {heartbeatLabel}</span> : null}
        {stalled ? <span className="text-amber-600">Heartbeat stalled</span> : null}
      </div>
      <div className="space-y-3">
        {steps.map((step, idx) => {
          const isActive = idx === stage;
          const isComplete = idx < stage;
          return (
            <div
              key={step.label}
              className={`flex items-start gap-3 rounded-md border border-border/70 p-3 ${
                isActive ? "bg-white/80" : "bg-surface-strong/70"
              }`}
            >
              <span
                className={`mt-1 h-2.5 w-2.5 rounded-full ${
                  isComplete ? "bg-emerald-500" : isActive ? "bg-accent" : "bg-border"
                }`}
              />
              <div className="flex-1">
                <p className={`text-sm font-semibold ${isActive ? "text-foreground" : "text-muted"}`}>
                  {step.label}
                </p>
                <p className="text-xs text-muted">{step.detail}</p>
              </div>
              {step.optional ? (
                <span className="cs-badge bg-white/80 text-[10px] text-accent-contrast">Optional</span>
              ) : null}
            </div>
          );
        })}
      </div>
      <p className="text-xs text-muted">
        Core results usually arrive faster. Full runs may take longer when advanced signals are enabled.
      </p>
    </div>
  );
};
