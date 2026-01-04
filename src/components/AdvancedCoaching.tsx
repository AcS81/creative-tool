import type { AnalyzeVideoResult } from "../lib/analysis/types";
import type { ScoredMetric, VideoFingerprintJson } from "../lib/types";

const scoreValue = (value?: string | number | null) => {
  if (value === undefined || value === null) return undefined;
  const asString = typeof value === "string" ? value.trim() : `${value}`;
  if (!asString || asString.toLowerCase() === "unobserved") return undefined;
  const numeric = Number(asString);
  return Number.isFinite(numeric) ? numeric : undefined;
};

const isObservedMetric = (metric?: ScoredMetric) => {
  if (!metric) return false;
  if (metric.observed === false) return false;
  const value = typeof metric.value === "string" ? metric.value.trim().toLowerCase() : "";
  const hasValue = value !== "" && value !== "unobserved";
  const hasScore = typeof metric.score === "number" && metric.score > 0;
  return metric.observed === true || hasValue || hasScore;
};

const sectionObserved = (section?: Record<string, ScoredMetric>) =>
  !!section && Object.values(section).some((metric) => isObservedMetric(metric));

const buildInsight = (label: string, body: string) => `${label}: ${body}`;

export const AdvancedCoaching = ({
  fingerprint,
  diagnostics,
}: {
  fingerprint?: VideoFingerprintJson | null;
  diagnostics?: AnalyzeVideoResult["diagnostics"];
}) => {
  if (!fingerprint) return null;
  const secondOrder = fingerprint.secondOrder;
  const visual = fingerprint.visualEditAlignment;
  const language = fingerprint.languageTexture;
  const prosody = fingerprint.prosodyArc;
  const balance = fingerprint.modalityBalance;
  const narrative = fingerprint.narrativeArc;
  const load = fingerprint.cognitiveLoad;
  const advancedDefaulted = diagnostics?.advancedMetricsDefaulted === true;
  const advancedDefaultReason = diagnostics?.advancedMetricsDefaultReason;

  const alignmentObserved = isObservedMetric(secondOrder.alignmentScore);
  const balanceObserved = isObservedMetric(secondOrder.balanceScore);
  const driftObserved = isObservedMetric(secondOrder.driftScore);
  const decayObserved = isObservedMetric(secondOrder.decayScore);
  const timingObserved = isObservedMetric(secondOrder.timingScore);

  const alignmentScore = alignmentObserved ? scoreValue(secondOrder.alignmentScore.value) : undefined;
  const balanceScore = balanceObserved ? scoreValue(secondOrder.balanceScore.value) : undefined;
  const driftScore = driftObserved ? scoreValue(secondOrder.driftScore.value) : undefined;
  const decayScore = decayObserved ? scoreValue(secondOrder.decayScore.value) : undefined;
  const timingScore = timingObserved ? scoreValue(secondOrder.timingScore.value) : undefined;

  const insights: string[] = [];

  if (alignmentScore !== undefined) {
    insights.push(
      buildInsight(
        "Alignment",
        alignmentScore > 70
          ? "Audio emphasis, edits, and beats are working together—keep pairing cuts/zooms with stressed phrases."
          : "Tighten alignment: pair stressed phrases with purposeful cuts/zooms and support beats with edits.",
      ),
    );
  }

  if (timingScore !== undefined) {
    insights.push(
      buildInsight(
        "Timing",
        timingScore > 70
          ? "Hooks and silences are landing at effective times; keep using pauses near payoffs."
          : "Improve timing: move the first hook earlier, and place silences near punchlines or beat changes.",
      ),
    );
  }

  if (balanceScore !== undefined) {
    insights.push(
      buildInsight(
        "Balance",
        balanceScore > 70
          ? "Modalities are complementary; continue mixing visuals and voice rather than repeating."
          : "Reduce redundancy: add visuals that add new info and avoid one modality carrying all meaning.",
      ),
    );
  }

  if (driftScore !== undefined) {
    insights.push(
      buildInsight(
        "Drift",
        driftScore > 70
          ? "Pace/energy stay steady with cohesive segments."
          : "Curb drift: smooth big cohesion drops and avoid erratic pace swings.",
      ),
    );
  }

  if (decayScore !== undefined) {
    insights.push(
      buildInsight(
        "Decay",
        decayScore > 70
          ? "Energy holds through the back half; keep resets to avoid fatigue."
          : "Watch late fatigue: use resets and pauses to prevent pace/energy fade in the back half.",
      ),
    );
  }

  const missingSections = {
    prosody: !sectionObserved(prosody),
    language: !sectionObserved(language),
    narrative: !sectionObserved(narrative),
    visual: !sectionObserved(visual),
    balance: !sectionObserved(balance),
    load: !sectionObserved(load),
  };

  const allMissing = Object.values(missingSections).every(Boolean);
  const fallbackInsights: string[] = [];

  if (advancedDefaulted) {
    fallbackInsights.push(
      advancedDefaultReason
        ? `Advanced signals not observed; ${advancedDefaultReason}`
        : "Advanced signals not observed; run advanced analysis to unlock deeper coaching.",
    );
  } else {
    if (allMissing) {
      fallbackInsights.push("Advanced signals not observed; rerun analysis or try a different clip.");
    }

    if (missingSections.prosody) {
      fallbackInsights.push("Audio signal not observed; record with a closer mic and reduce background music.");
    }

    if (missingSections.visual) {
      fallbackInsights.push("Visual signal not observed; improve lighting and include clear motion or edits.");
    }

    if (missingSections.language) {
      fallbackInsights.push("Speech signal not observed; speak clearly and avoid heavy music over narration.");
    }

    if (missingSections.narrative) {
      fallbackInsights.push("Narrative beats not observed; add explicit hooks and transitions in the script.");
    }

    if (!missingSections.language && language?.audienceAddressFrequency?.observed === false) {
      fallbackInsights.push("Audience address: Not observed; add direct you/we phrasing for engagement.");
    }
  }

  if (fallbackInsights.length > 0) {
    const maxFallbacks = insights.length === 0 ? 4 : 2;
    const uniqueFallbacks = Array.from(new Set(fallbackInsights));
    insights.push(...uniqueFallbacks.slice(0, maxFallbacks));
  }

  if (insights.length === 0) {
    return (
      <div className="rounded-md border border-border bg-surface p-3 shadow-sm">
        <p className="text-sm font-semibold text-muted">Advanced coaching</p>
        <p className="text-sm text-muted">Not enough data observed yet.</p>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-border bg-surface p-4 shadow-sm" id="advanced-coaching" role="region" aria-label="Advanced coaching">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-muted">Advanced coaching</p>
      </div>
      <ul className="mt-2 space-y-2 text-sm text-foreground/90">
        {insights.map((text, idx) => (
          <li key={idx} className="list-disc pl-4">
            {text}
          </li>
        ))}
      </ul>
    </div>
  );
};
