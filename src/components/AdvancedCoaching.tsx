import type { VideoFingerprintJson } from "../lib/types";

const scoreValue = (value?: string | number | null) => {
  if (value === undefined || value === null) return undefined;
  const asString = typeof value === "string" ? value.trim() : `${value}`;
  if (!asString || asString.toLowerCase() === "unobserved") return undefined;
  const numeric = Number(asString);
  return Number.isFinite(numeric) ? numeric : undefined;
};

const buildInsight = (label: string, body: string, observed?: boolean) => {
  if (observed === false) return `${label}: Not observed`;
  return `${label}: ${body}`;
};

export const AdvancedCoaching = ({ fingerprint }: { fingerprint?: VideoFingerprintJson | null }) => {
  if (!fingerprint) return null;
  const secondOrder = fingerprint.secondOrder;
  const visual = fingerprint.visualEditAlignment;
  const language = fingerprint.languageTexture;
  const prosody = fingerprint.prosodyArc;
  const balance = fingerprint.modalityBalance;

  const alignmentScore = scoreValue(secondOrder.alignmentScore.value);
  const balanceScore = scoreValue(secondOrder.balanceScore.value);
  const driftScore = scoreValue(secondOrder.driftScore.value);
  const decayScore = scoreValue(secondOrder.decayScore.value);
  const timingScore = scoreValue(secondOrder.timingScore.value);

  const insights: string[] = [];

  if (alignmentScore !== undefined) {
    insights.push(
      buildInsight(
        "Alignment",
        alignmentScore > 70
          ? "Audio emphasis, edits, and beats are working together—keep pairing cuts/zooms with stressed phrases."
          : "Tighten alignment: pair stressed phrases with purposeful cuts/zooms and support beats with edits.",
        secondOrder.alignmentScore.observed,
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
        secondOrder.timingScore.observed,
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
        secondOrder.balanceScore.observed,
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
        secondOrder.driftScore.observed,
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
        secondOrder.decayScore.observed,
      ),
    );
  }

  if (visual?.visualEntropy.timeline?.length === 0 || visual?.cutRateRefinement.timeline?.length === 0) {
    insights.push("Visual/edit: Entropy or cut timeline missing—surface diagnostics to explain missing visuals.");
  }

  if (language?.audienceAddressFrequency.observed === false) {
    insights.push("Audience address: Not observed; add direct/you-we phrasing for engagement.");
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
    <div className="rounded-md border border-border bg-surface p-4 shadow-sm" id="advanced-coaching">
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
