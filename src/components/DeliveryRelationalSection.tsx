import { resolveAxisMetadata } from "../lib/analysis/axisMetadata";
import type { AxisDetail } from "../lib/types";

type TonePlacement = {
  arousal?: number;
  valence?: number;
};

type ConnectionPlacement = {
  closeness?: number;
  care?: number;
};

type QuadrantLabels = {
  topLeft: string;
  topRight: string;
  bottomLeft: string;
  bottomRight: string;
  center?: string;
};

type QuadrantMapProps = {
  title: string;
  xLabelLeft: string;
  xLabelRight: string;
  yLabelBottom: string;
  yLabelTop: string;
  xValue?: number;
  yValue?: number;
  quadrants: QuadrantLabels;
  badge: string;
  summary: string;
  examples: string[];
};

const clampScore = (value?: number, fallback = 50) => Math.max(0, Math.min(100, value ?? fallback));

const getQuadrantBadge = (x: number, y: number, labels: QuadrantLabels) => {
  const centered = Math.abs(x - 50) < 8 && Math.abs(y - 50) < 8;
  if (centered && labels.center) return labels.center;
  if (y >= 50 && x >= 50) return labels.topRight;
  if (y >= 50 && x < 50) return labels.topLeft;
  if (y < 50 && x >= 50) return labels.bottomRight;
  return labels.bottomLeft;
};

function QuadrantMap({
  title,
  xLabelLeft,
  xLabelRight,
  yLabelBottom,
  yLabelTop,
  xValue,
  yValue,
  quadrants,
  badge,
  summary,
  examples,
}: QuadrantMapProps) {
  const x = clampScore(xValue);
  const y = clampScore(yValue);
  const markerStyle = { left: `${x}%`, top: `${100 - y}%` };

  return (
    <div className="space-y-3 rounded-lg border border-border/60 bg-white/80 p-3 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">{title}</p>
          <p className="text-sm text-foreground">{summary}</p>
        </div>
        <span className="cs-pill shrink-0 text-[11px] font-semibold text-muted">{badge}</span>
      </div>
      <div className="relative h-48 w-full rounded-md border border-border/70 bg-surface-strong">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-y-0 left-1/2 -ml-[0.5px] border-l border-dashed border-border/80" />
          <div className="absolute inset-x-0 top-1/2 -mt-[0.5px] border-t border-dashed border-border/80" />
          <div className="absolute left-2 top-2 text-[11px] text-muted">{quadrants.topLeft}</div>
          <div className="absolute right-2 top-2 text-[11px] text-muted text-right">{quadrants.topRight}</div>
          <div className="absolute left-2 bottom-2 text-[11px] text-muted">{quadrants.bottomLeft}</div>
          <div className="absolute right-2 bottom-2 text-[11px] text-muted text-right">{quadrants.bottomRight}</div>
          {quadrants.center ? (
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[11px] text-muted">
              {quadrants.center}
            </div>
          ) : null}
          <div className="absolute left-1/2 top-2 -translate-x-1/2 text-[11px] font-semibold text-muted">{yLabelTop}</div>
          <div className="absolute left-1/2 bottom-2 -translate-x-1/2 text-[11px] font-semibold text-muted">
            {yLabelBottom}
          </div>
          <div className="absolute left-2 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-muted">
            {xLabelLeft}
          </div>
          <div className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-muted">
            {xLabelRight}
          </div>
        </div>
        <div
          className="absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-accent shadow-md"
          style={markerStyle}
        />
      </div>
      <div className="grid gap-1 text-[12px] text-muted">
        {examples.map((example) => (
          <span key={example} className="leading-relaxed">
            • {example}
          </span>
        ))}
      </div>
    </div>
  );
}

export function DeliveryRelationalSection({
  tone,
  connection,
  axisDetails,
}: {
  tone: TonePlacement;
  connection: ConnectionPlacement;
  axisDetails?: Record<string, AxisDetail>;
}) {
  const describeLean = (value: number, low: string, high: string) => {
    if (value > 60) return `Leans ${high.toLowerCase()} (${value}/100).`;
    if (value < 40) return `Leans ${low.toLowerCase()} (${value}/100).`;
    return `Balanced between ${low.toLowerCase()} and ${high.toLowerCase()} (${value}/100).`;
  };

  const pickDetail = (candidates: string[]) => {
    if (!axisDetails) return null;
    for (const key of candidates) {
      const meta =
        resolveAxisMetadata(key) ??
        resolveAxisMetadata(key.replace(/^language\./, "")) ??
        resolveAxisMetadata(key.replace(/^voice\./, ""));
      const id = meta?.id ?? key;
      const detail = axisDetails[id];
      if (!detail) continue;
      const label = meta?.label ?? key;
      const observed = detail.observed !== false && detail.rawValue !== "unobserved";
      return { label, observed, raw: detail.rawValue, explanation: detail.explanation };
    }
    return null;
  };

  const toneArousal = clampScore(tone.arousal);
  const toneValence = clampScore(tone.valence);
  const toneBadge = getQuadrantBadge(toneValence, toneArousal, {
    topLeft: "High arousal • Negative",
    topRight: "High arousal • Positive",
    bottomLeft: "Low arousal • Negative",
    bottomRight: "Low arousal • Positive",
    center: "Neutral / even",
  });

  const connectionCloseness = clampScore(connection.closeness);
  const connectionCare = clampScore(connection.care);
  const connectionBadge = getQuadrantBadge(connectionCloseness, connectionCare, {
    topLeft: "Authoritative expert",
    topRight: "Supportive coach",
    bottomLeft: "Respectful joker",
    bottomRight: "Candid peer",
    center: "Even stance",
  });

  const toneSummary =
    toneBadge === "High arousal • Positive"
      ? "High energy that rallies or hypes."
      : toneBadge === "High arousal • Negative"
        ? "High energy that can feel sharp or alarmed."
        : toneBadge === "Low arousal • Positive"
          ? "Calm warmth that reassures."
          : toneBadge === "Low arousal • Negative"
            ? "Dry, distant, and understated."
            : "Even, neutral tone.";

  const speakingRate = pickDetail(["voice.speaking_rate", "speaking_rate"]);
  const loudness = pickDetail(["voice.loudness_range", "loudness_range"]);
  const pitch = pickDetail(["voice.pitch_variation", "pitch_variation"]);
  const filler = pickDetail(["voice.filler_rate", "filler_rate"]);
  const pauses = pickDetail(["voice.pauses", "pauses", "flow"]);
  const humor = pickDetail(["language.humor", "humor"]);
  const warmth = pickDetail(["voice.warmth", "language.warmth", "warmth"]);
  const references = pickDetail(["language.references", "references"]);
  const concreteness = pickDetail(["language.concreteness", "abstractVsConcrete", "concreteness"]);
  const metaphors = pickDetail(["language.metaphor_density", "metaphor_density"]);
  const sentiment = pickDetail(["language.sentiment", "positivity", "sentiment"]);
  const teaching = pickDetail(["language.teaching_vs_riffing", "explanationWeight", "teaching_vs_riffing"]);
  const directiveDensity = pickDetail(["language.directive_density", "directive_density", "directiveness"]);
  const selfDisclosure = pickDetail(["language.self_disclosure", "self_disclosure", "disclosure"]);
  const storyPresence = pickDetail(["narrative.story_presence", "language.storyPresence", "story_presence"]);
  const structure = pickDetail(["narrative.mini_arc_density", "structure"]);
  const hooks = pickDetail(["narrative.hooks", "hooks"]);

  const isObserved = (detail?: ReturnType<typeof pickDetail>) =>
    !!detail && detail.observed !== false && detail.raw !== "unobserved";

  const toSnippet = (detail?: ReturnType<typeof pickDetail>) => {
    if (!detail) return null;
    const text = detail.explanation || detail.raw;
    if (!text) return null;
    return text.trim().replace(/\s+/g, " ");
  };

  const snippetsFrom = (details: Array<ReturnType<typeof pickDetail>>, max = 2) => {
    const snippets = details.filter(isObserved).map((d) => toSnippet(d)).filter(Boolean) as string[];
    if (snippets.length === 0) return null;
    return snippets.slice(0, max).join(" | ");
  };

  const toneEnergyDetails = [speakingRate, loudness, pitch, filler, pauses].filter(Boolean);
  const toneMoodDetails = [humor, warmth, references, concreteness, metaphors, sentiment].filter(Boolean);
  const toneDetails = [...toneEnergyDetails, ...toneMoodDetails];
  const observedToneDetails = toneDetails.filter(isObserved);
  const totalToneSignals = toneDetails.length || 1;
  const toneConfidence =
    toneDetails.length === 0 ? 0 : Math.round((observedToneDetails.length / toneDetails.length) * 100);
  const tonePull = Math.round(
    (Math.hypot(toneValence - 50, toneArousal - 50) / Math.hypot(50, 50)) * 100,
  );

  const toneEnergyVibe =
    toneBadge === "High arousal • Positive"
      ? "hype/amped energy"
      : toneBadge === "High arousal • Negative"
        ? "urgent/edgy energy"
        : toneBadge === "Low arousal • Positive"
          ? "steady/cozy energy"
          : toneBadge === "Low arousal • Negative"
            ? "dry/flat energy"
            : "even/neutral energy";

  const hasHumor = isObserved(humor);
  const hasWarmth = isObserved(warmth);
  const hasReferences = isObserved(references);
  const moodDescriptor =
    toneValence > 65
      ? hasHumor
        ? "playful and upbeat"
        : hasWarmth
          ? "warm and encouraging"
          : "positive and forward"
      : toneValence < 35
        ? hasHumor
          ? "snarky or dry"
          : "serious and cool"
        : hasReferences
          ? "balanced with informational cues"
          : "balanced, neutral mood";

  const energyReasons = snippetsFrom(toneEnergyDetails);
  const moodReasons = snippetsFrom(toneMoodDetails);

  const toneNarrativeParts: string[] = [
    energyReasons
      ? `${toneBadge.toLowerCase()} because ${energyReasons}. Feels ${toneEnergyVibe}.`
      : `${toneBadge.toLowerCase()} based on placement; feels ${toneEnergyVibe}.`,
    moodReasons
      ? `Mood color: ${moodReasons}; reads ${moodDescriptor}.`
      : `Mood color leans ${moodDescriptor}; cues were thin so leaning on placement.`,
    toneDetails.length === 0
      ? `Tone pull ${tonePull}/100 from neutral; no supporting tone cues observed.`
      : `Tone pull ${tonePull}/100 from neutral; confidence ${toneConfidence}% (${observedToneDetails.length}/${totalToneSignals} tone cues).`,
  ].filter(Boolean);

  const toneExamples =
    toneNarrativeParts.length > 0
      ? toneNarrativeParts
      : [
          `${toneBadge} placement — ${toneSummary}`,
          describeLean(toneValence, "Negative", "Positive"),
          describeLean(toneArousal, "Low arousal", "High arousal"),
        ];

  const connectionSummary =
    connectionBadge === "Supportive coach"
      ? "Close and caring: guiding with investment."
      : connectionBadge === "Authoritative expert"
        ? "Invested in outcomes but keeps professional distance."
        : connectionBadge === "Candid peer"
          ? "Close and candid with light steering."
          : connectionBadge === "Respectful joker"
            ? "Hands-off and distant; humor allowed without directing you."
            : "Balanced distance and care.";

  const stanceDetails = [warmth, storyPresence, selfDisclosure].filter(Boolean);
  const careDetails = [teaching, directiveDensity, references, structure, hooks].filter(Boolean);

  const stanceObserved = stanceDetails.filter(isObserved);
  const careObserved = careDetails.filter(isObserved);
  const stanceConfidence =
    stanceDetails.length === 0 ? 0 : Math.round((stanceObserved.length / stanceDetails.length) * 100);
  const careConfidence = careDetails.length === 0 ? 0 : Math.round((careObserved.length / careDetails.length) * 100);

  const stanceDescriptor =
    connectionCloseness > 60 ? "close" : connectionCloseness < 40 ? "distant" : "balanced between close and distant";
  const careDescriptor =
    connectionCare > 60 ? "invested" : connectionCare < 40 ? "hands-off" : "balanced between caring and hands-off";

  const stanceReasons = snippetsFrom(stanceDetails);
  const careReasons = snippetsFrom(careDetails);

  const connectionExamples = [
    stanceReasons
      ? `Stance: ${stanceDescriptor} because ${stanceReasons}.`
      : `Stance: ${stanceDescriptor}; leaning on placement (few closeness cues observed).`,
    careReasons
      ? `Care: ${careDescriptor} because ${careReasons}.`
      : `Care: ${careDescriptor}; leaning on placement (few care cues observed).`,
    `${connectionBadge} — ${connectionSummary}`,
    `Confidence: stance ${stanceConfidence}% (${stanceObserved.length}/${stanceDetails.length || 1}), care ${careConfidence}% (${careObserved.length}/${careDetails.length || 1}).`,
  ].filter(Boolean);

  return (
    <div className="grid gap-3 rounded-lg border border-border/60 bg-surface-strong p-4 shadow-sm md:grid-cols-2">
      <QuadrantMap
        title="Emotional tone / energy"
        xLabelLeft="Negative"
        xLabelRight="Positive"
        yLabelBottom="Low arousal"
        yLabelTop="High arousal"
        xValue={toneValence}
        yValue={toneArousal}
        quadrants={{
          topLeft: "Angry / alarmed",
          topRight: "Amped / rallying",
          bottomLeft: "Dry / distant",
          bottomRight: "Warm / reassuring",
          center: "Neutral",
        }}
        badge={toneBadge}
        summary={toneSummary}
        examples={toneExamples}
      />
      <QuadrantMap
        title="Empathy / identity / connection"
        xLabelLeft="Distant"
        xLabelRight="Close"
        yLabelBottom="Low care"
        yLabelTop="High care"
        xValue={connectionCloseness}
        yValue={connectionCare}
        quadrants={{
          topLeft: "Authoritative expert",
          topRight: "Supportive coach",
          bottomLeft: "Respectful joker",
          bottomRight: "Candid peer",
          center: "Even stance",
        }}
        badge={connectionBadge}
        summary={connectionSummary}
        examples={connectionExamples}
      />
    </div>
  );
}
