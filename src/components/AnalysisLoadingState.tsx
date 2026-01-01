"use client";

import { useEffect, useMemo, useState } from "react";

type Step = {
  label: string;
  detail: string;
  optional?: boolean;
};

type Props = {
  active: boolean;
  passMode?: "core" | "full";
};

const buildSteps = (passMode?: "core" | "full"): Step[] => {
  const steps: Step[] = [
    {
      label: "Validating URL and metadata",
      detail: "Checking the video link and fetching title/duration.",
    },
    {
      label: "Ingesting video",
      detail: "Pulling audio + frames for analysis.",
    },
    {
      label: "Analyzing core signals",
      detail: "Voice, language, narrative, visual, editing, and sound.",
    },
  ];

  if (passMode !== "core") {
    steps.push({
      label: "Analyzing advanced signals",
      detail: "Prosody, alignment, modality balance, and cognitive load.",
      optional: passMode === undefined,
    });
  }

  steps.push({
    label: "Synthesizing coaching",
    detail: "Building insights and archetypes.",
  });

  return steps;
};

export const AnalysisLoadingState = ({ active, passMode }: Props) => {
  const steps = useMemo(() => buildSteps(passMode), [passMode]);
  const [stage, setStage] = useState(0);

  useEffect(() => {
    if (!active) {
      setStage(0);
      return;
    }

    let current = 0;
    setStage(0);
    const interval = setInterval(() => {
      current = Math.min(current + 1, steps.length - 1);
      setStage(current);
    }, 3200);

    return () => clearInterval(interval);
  }, [active, steps.length]);

  return (
    <div className="cs-card space-y-4 p-6" role="status" aria-live="polite">
      <p className="text-sm font-semibold text-muted">Running analysis...</p>
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
