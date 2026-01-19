"use client";

import { useEffect, useState } from "react";
import type { VideoSkeleton } from "../lib/analysis/types/skeleton";
import type { CoreMetrics } from "../lib/analysis/types/coreMetrics";
import type { VideoFingerprintJson } from "../lib/types";
import { RadarChartOverview } from "./RadarChartOverview";
import { DomainScoreBars } from "./DomainScoreBars";
import { VideoStructure } from "./VideoStructure";

type Props = {
  skeleton?: VideoSkeleton | null;
  coreMetrics?: CoreMetrics | null;
  fingerprint?: VideoFingerprintJson | null;
  currentStage?: string | null;
};

type Section = "skeleton" | "core" | "advanced" | "complete";

const formatDuration = (seconds: number): string => {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
};

export const StreamingResults = ({ skeleton, coreMetrics, fingerprint, currentStage }: Props) => {
  const [visibleSections, setVisibleSections] = useState<Set<Section>>(new Set());
  const [animationTrigger, setAnimationTrigger] = useState(0);

  // Determine which sections should be visible based on available data
  useEffect(() => {
    const newSections = new Set<Section>();

    if (skeleton) {
      newSections.add("skeleton");
    }

    if (coreMetrics || (currentStage && ["core", "advanced", "derived", "finalize"].includes(currentStage))) {
      newSections.add("skeleton");
      if (coreMetrics) {
        newSections.add("core");
      }
    }

    if (fingerprint?.prosodyArc || fingerprint?.languageTexture) {
      newSections.add("skeleton");
      newSections.add("core");
      newSections.add("advanced");
    }

    if (fingerprint && currentStage === "complete") {
      newSections.add("skeleton");
      newSections.add("core");
      newSections.add("advanced");
      newSections.add("complete");
    }

    // Only trigger animation if we're adding new sections
    if (newSections.size > visibleSections.size) {
      setVisibleSections(newSections);
      setAnimationTrigger((prev) => prev + 1);
    }
  }, [skeleton, coreMetrics, fingerprint, currentStage, visibleSections.size]);

  const hasSkeleton = visibleSections.has("skeleton");
  const hasCore = visibleSections.has("core");
  const hasAdvanced = visibleSections.has("advanced");
  const hasComplete = visibleSections.has("complete");

  // Calculate domain scores from coreMetrics
  const domainScores = coreMetrics
    ? {
        voice: calculateDomainScore(Object.values(coreMetrics.voice)),
        language: calculateDomainScore(Object.values(coreMetrics.language)),
        narrative: calculateDomainScore(Object.values(coreMetrics.narrative)),
        visual: calculateDomainScore(Object.values(coreMetrics.visual)),
        sound: calculateDomainScore(Object.values(coreMetrics.sound)),
      }
    : null;

  return (
    <div className="space-y-6">
      {/* Skeleton Summary Section */}
      {hasSkeleton && skeleton && (
        <FadeInSection key="skeleton" delay={0}>
          <div className="cs-card p-6">
            <VideoStructure skeleton={skeleton} showContentMix={true} />
          </div>
        </FadeInSection>
      )}

      {/* Core Metrics Section */}
      {hasCore && (domainScores || fingerprint) && (
        <FadeInSection key="core" delay={300}>
          <div className="cs-card overflow-hidden p-0">
            <div className="bg-gradient-to-br from-blue-50 via-white to-blue-50/30 p-6">
              <div className="flex items-start gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 text-3xl shadow-lg">
                  📊
                </div>
                <div className="flex-1 space-y-4">
                  <div>
                    <h3 className="text-xl font-bold text-blue-900">Core Metrics</h3>
                    <p className="mt-1 text-sm text-blue-700">Foundation scores across all domains</p>
                  </div>

                  {fingerprint?.metaAxes && (
                    <div className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-blue-200">
                      <RadarChartOverview fingerprint={fingerprint} />
                    </div>
                  )}

                  {domainScores && (
                    <div className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-blue-200">
                      <h4 className="mb-3 text-sm font-semibold text-blue-900">Domain Scores</h4>
                      <DomainScoreBars scores={domainScores} />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </FadeInSection>
      )}

      {/* Advanced Insights Section */}
      {hasAdvanced && fingerprint && (
        <FadeInSection key="advanced" delay={600}>
          <div className="cs-card overflow-hidden p-0">
            <div className="bg-gradient-to-br from-amber-50 via-white to-amber-50/30 p-6">
              <div className="flex items-start gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 text-3xl shadow-lg">
                  🔍
                </div>
                <div className="flex-1 space-y-3">
                  <div>
                    <h3 className="text-xl font-bold text-amber-900">Advanced Analysis</h3>
                    <p className="mt-1 text-sm text-amber-700">Detailed metrics and timelines available</p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {fingerprint.prosodyArc?.paceVariabilityPct?.observed &&
                      fingerprint.prosodyArc.paceVariabilityPct.value && (
                        <MetricCard
                          label="Pace Variability"
                          value={fingerprint.prosodyArc.paceVariabilityPct.value}
                          color="amber"
                        />
                      )}
                    {fingerprint.narrativeArc?.timeToHookSeconds?.observed &&
                      fingerprint.narrativeArc.timeToHookSeconds.value && (
                        <MetricCard
                          label="Time to Hook"
                          value={fingerprint.narrativeArc.timeToHookSeconds.value}
                          color="amber"
                        />
                      )}
                    {fingerprint.visualEditAlignment?.visualEntropy?.observed &&
                      fingerprint.visualEditAlignment.visualEntropy.value && (
                        <MetricCard
                          label="Visual Entropy"
                          value={fingerprint.visualEditAlignment.visualEntropy.value}
                          color="amber"
                        />
                      )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </FadeInSection>
      )}

      {/* Complete Section - Coaching & Insights */}
      {hasComplete && fingerprint && (
        <FadeInSection key="complete" delay={900}>
          <div className="cs-card overflow-hidden p-0">
            <div className="bg-gradient-to-br from-accent/10 via-white to-accent-amber/10 p-6">
              <div className="flex items-start gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-accent to-accent-amber text-3xl shadow-lg">
                  💡
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-foreground">Analysis Complete</h3>
                  <p className="mt-1 text-sm text-muted">
                    Full insights, coaching, and derived scores are ready in the detailed view below.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </FadeInSection>
      )}
    </div>
  );
};

// Helper component for fade-in animation
const FadeInSection = ({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  return (
    <div
      className={`transition-all duration-700 ease-out ${
        isVisible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
      }`}
      style={{ minHeight: "100px" }} // Prevent layout shift
    >
      {children}
    </div>
  );
};

// Helper component for metric cards
const MetricCard = ({ label, value, color }: { label: string; value: string; color: string }) => {
  const colorClasses = {
    amber: "bg-amber-50 ring-amber-200 text-amber-900",
    blue: "bg-blue-50 ring-blue-200 text-blue-900",
    emerald: "bg-emerald-50 ring-emerald-200 text-emerald-900",
  };

  return (
    <div className={`rounded-lg p-3 shadow-sm ring-1 ${colorClasses[color as keyof typeof colorClasses]}`}>
      <p className="text-xs font-semibold opacity-70">{label}</p>
      <p className="mt-1 text-base font-bold">{value}</p>
    </div>
  );
};

// Helper function to calculate average domain score
const calculateDomainScore = (metrics: { score: number; observed: boolean }[]): number => {
  const observed = metrics.filter((m) => m.observed);
  if (observed.length === 0) return 50; // Default fallback
  return Math.round(observed.reduce((sum, m) => sum + m.score, 0) / observed.length);
};
