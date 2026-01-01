import type { AnalyzeVideoResult } from "../lib/analysis/types";

type CoverageStat = {
  observed: number;
  total: number;
  missing: string[];
  observedPct: number;
  available?: boolean;
};

type Props = {
  diagnostics?: AnalyzeVideoResult["diagnostics"];
  onTryAgain?: () => void;
  onRunAdvanced?: () => void;
  disabled?: boolean;
};

const CORE_LABELS: Record<string, string> = {
  voice: "Voice",
  language: "Language",
  narrative: "Narrative",
  visual_edit_sound: "Visual/Edit/Sound",
};

const ADVANCED_LABELS: Record<string, string> = {
  prosodyArc: "Prosody arc",
  languageTexture: "Language texture",
  narrativeArc: "Narrative arc",
  visualEditAlignment: "Visual edit alignment",
  modalityBalance: "Modality balance",
  cognitiveLoad: "Cognitive load",
  secondOrder: "Second-order",
};

const formatObserved = (stat?: CoverageStat) => {
  if (!stat) return "";
  return stat.total > 0 ? `${stat.observed}/${stat.total}` : `${stat.observed}`;
};

const formatAdvancedReason = (raw?: string) => {
  if (!raw) return "Advanced pass not run.";
  const lower = raw.toLowerCase();
  if (lower.includes("disabled")) return "Advanced pass disabled.";
  if (lower.includes("unavailable")) return "Advanced pass unavailable from the model.";
  return raw;
};

export const ObservationStatus = ({ diagnostics, onTryAgain, onRunAdvanced, disabled }: Props) => {
  if (!diagnostics) return null;

  const chips: string[] = [];
  const coreCoverage = diagnostics.coverage?.core;
  const advancedCoverage = diagnostics.coverage?.advanced;

  const coreMissingEntries = coreCoverage
    ? Object.entries(coreCoverage).filter(([, stat]) => (stat?.missing?.length ?? 0) > 0)
    : [];
  const coreMissing = coreMissingEntries.length > 0;

  const coreTotals = coreCoverage ? Object.values(coreCoverage) : [];
  const coreObservedSum = coreTotals.reduce((sum, stat) => sum + (stat?.observed ?? 0), 0);
  const coreTotalSum = coreTotals.reduce((sum, stat) => sum + (stat?.total ?? 0), 0);
  const coreAllUnobserved = coreTotals.length > 0 && coreTotalSum > 0 && coreObservedSum === 0;

  if (coreMissingEntries.length > 0) {
    coreMissingEntries.forEach(([key, stat]) => {
      const label = CORE_LABELS[key] ?? key;
      chips.push(`Not observed: ${label} (${formatObserved(stat)})`);
    });
  } else if (!coreCoverage && diagnostics.unobservedCounts) {
    Object.entries(diagnostics.unobservedCounts).forEach(([key, count]) => {
      if (!count) return;
      const label = CORE_LABELS[key] ?? key;
      chips.push(`Not observed: ${label} (${count})`);
    });
  }

  const advancedStats = advancedCoverage ? Object.values(advancedCoverage) : [];
  const allAdvancedUnavailable =
    advancedStats.length > 0 && advancedStats.every((stat) => stat?.available === false);

  const advancedMissingEntries = !allAdvancedUnavailable && advancedCoverage
    ? Object.entries(advancedCoverage).filter(([, stat]) => {
        if (!stat) return false;
        if (stat.available === false) return true;
        return (stat.missing?.length ?? 0) > 0;
      })
    : [];
  const advancedMissing = allAdvancedUnavailable || advancedMissingEntries.length > 0;

  if (allAdvancedUnavailable) {
    chips.push("Not observed: Advanced signals (not run)");
  } else {
    advancedMissingEntries.forEach(([key, stat]) => {
      const label = ADVANCED_LABELS[key] ?? key;
      if (stat?.available === false) {
        chips.push(`Not observed: ${label} (advanced not run)`);
        return;
      }
      chips.push(`Not observed: ${label} (${formatObserved(stat)})`);
    });
  }

  if (!advancedCoverage && diagnostics.advancedMetricsDefaulted) {
    chips.push("Not observed: Advanced signals (not run)");
  }

  if (chips.length === 0) {
    return null;
  }

  const reasonSet = new Set<string>();
  if (diagnostics.ingestionPreflight && !diagnostics.ingestionPreflight.ok) {
    reasonSet.add(
      `Ingestion failure: ${diagnostics.ingestionPreflight.failureMessage ?? "URL ingestion unavailable."}`,
    );
  }

  if (diagnostics.advancedMetricsDefaulted) {
    reasonSet.add(formatAdvancedReason(diagnostics.advancedMetricsDefaultReason));
  }

  if (coreAllUnobserved) {
    reasonSet.add("Ingestion failure or safety block: no core signals were observed.");
  } else if (coreMissing || advancedMissing) {
    reasonSet.add(
      "Insufficient signal or safety block: audio/visual cues were too weak to observe confidently.",
    );
  }

  if (diagnostics.salvage?.attempted) {
    const count = diagnostics.salvage.sections?.length ?? 0;
    reasonSet.add(
      count > 0
        ? `Retry attempted on ${count} section${count === 1 ? "" : "s"}.`
        : "Retry attempted on low-coverage sections.",
    );
  }

  const reasons = Array.from(reasonSet);
  const showRunAdvanced = diagnostics.advancedMetricsDefaulted && Boolean(onRunAdvanced);

  return (
    <div className="cs-panel space-y-3 border border-border/80 bg-surface p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-foreground">Some signals were not observed</p>
          <p className="text-xs text-muted">
            Missing metrics are labeled as Not observed so they do not read as low scores.
          </p>
        </div>
        <span className="cs-badge bg-white/80 text-[11px] font-semibold text-accent-contrast">Not observed</span>
      </div>

      <div className="flex flex-wrap gap-2">
        {chips.map((chip, idx) => (
          <span key={`${chip}-${idx}`} className="cs-pill bg-surface-strong text-[11px] text-muted">
            {chip}
          </span>
        ))}
      </div>

      {reasons.length ? (
        <div className="space-y-1 text-xs text-muted">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">Why this happened</p>
          <ul className="list-disc space-y-1 pl-4">
            {reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        {onTryAgain ? (
          <button
            type="button"
            className="cs-button"
            onClick={onTryAgain}
            disabled={disabled}
          >
            Try again
          </button>
        ) : null}
        {showRunAdvanced ? (
          <button
            type="button"
            className="cs-button-secondary"
            onClick={onRunAdvanced}
            disabled={disabled}
          >
            Run advanced
          </button>
        ) : null}
        <a
          href="/docs/axes_and_domains.md"
          target="_blank"
          rel="noreferrer"
          className="text-xs font-semibold text-foreground underline"
        >
          What does "Not observed" mean?
        </a>
      </div>
    </div>
  );
};
