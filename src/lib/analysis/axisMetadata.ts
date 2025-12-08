import type { DomainKey } from "../archetypes/descriptions";

export type MetaAxisId =
  | "voiceIntensity"
  | "conceptualDepth"
  | "narrativeStructureStrength"
  | "visualDynamism"
  | "productionPolish";

export type DomainMetricId = `${DomainKey}.${string}`;
export type AxisId = MetaAxisId | DomainMetricId;

export type AxisMetadata = {
  id: AxisId;
  domain: DomainKey | "meta";
  label: string;
  shortDescription: string;
  howMeasured: string;
  scaleDirection: string;
  aliases?: string[];
};

const metaAxes: AxisMetadata[] = [
  {
    id: "voiceIntensity",
    domain: "meta",
    label: "Voice intensity",
    shortDescription: "How energetic or projected the delivery feels.",
    howMeasured: "Average of voice pacing, loudness range, and prosody signals.",
    scaleDirection: "low=calm/soft, high=projected/urgent",
  },
  {
    id: "conceptualDepth",
    domain: "meta",
    label: "Conceptual depth",
    shortDescription: "Balance of abstract thinking vs concrete examples.",
    howMeasured: "Blend of language concreteness, metaphors, and reference density.",
    scaleDirection: "low=concrete, high=abstract/idea-heavy",
  },
  {
    id: "narrativeStructureStrength",
    domain: "meta",
    label: "Narrative structure",
    shortDescription: "Clarity of beats, arcs, and payoffs.",
    howMeasured: "Presence of hooks, transitions, and mini-arcs across the video.",
    scaleDirection: "low=loose, high=deliberate arc",
  },
  {
    id: "visualDynamism",
    domain: "meta",
    label: "Visual dynamism",
    shortDescription: "How much the visuals change or move.",
    howMeasured: "Movement, environment changes, cut pace, and pattern interrupts.",
    scaleDirection: "low=static, high=varied/kinetic",
  },
  {
    id: "productionPolish",
    domain: "meta",
    label: "Production polish",
    shortDescription: "Overall smoothness of edits and mix.",
    howMeasured: "Cut smoothness, mix balance, and absence of rough edges.",
    scaleDirection: "low=rough, high=polished",
  },
];

const voiceAxes: AxisMetadata[] = [
  {
    id: "voice.speaking_rate",
    domain: "voice",
    label: "Speech pace",
    shortDescription: "How fast the speaker moves through words.",
    howMeasured: "Estimated words per minute across the video.",
    scaleDirection: "low=slow, high=fast",
    aliases: ["speaking_rate"],
  },
  {
    id: "voice.filler_rate",
    domain: "voice",
    label: "Filler rate",
    shortDescription: "Frequency of fillers like um/uh/like.",
    howMeasured: "Fillers per minute relative to total speech.",
    scaleDirection: "low=few, high=frequent",
    aliases: ["filler_rate"],
  },
  {
    id: "voice.pauses",
    domain: "voice",
    label: "Pauses/resets",
    shortDescription: "Use of pauses and reset rhythms.",
    howMeasured: "Average pause length and intentional resets.",
    scaleDirection: "low=rare/short, high=frequent/longer",
    aliases: ["pauses", "flow"],
  },
  {
    id: "voice.loudness_range",
    domain: "voice",
    label: "Loudness range",
    shortDescription: "Dynamic range of the voice.",
    howMeasured: "Spread between quietest and loudest delivery moments.",
    scaleDirection: "low=flat, high=dynamic",
    aliases: ["loudness_range", "energy"],
  },
  {
    id: "voice.pitch_variation",
    domain: "voice",
    label: "Pitch variation",
    shortDescription: "How much pitch moves to emphasize ideas.",
    howMeasured: "Pitch range/variance across phrases.",
    scaleDirection: "low=monotone, high=varied",
    aliases: ["pitch_variation", "expressiveness"],
  },
  {
    id: "voice.clarity",
    domain: "voice",
    label: "Clarity",
    shortDescription: "How crisp and intelligible the diction is.",
    howMeasured: "Perceived articulation and enunciation of words.",
    scaleDirection: "low=muddy, high=crisp",
  },
  {
    id: "voice.warmth",
    domain: "voice",
    label: "Warmth",
    shortDescription: "Friendliness or intimacy of tone.",
    howMeasured: "Tone color and phrasing that feels inviting vs distant.",
    scaleDirection: "low=cold, high=warm",
  },
];

const languageAxes: AxisMetadata[] = [
  {
    id: "language.concreteness",
    domain: "language",
    label: "Concreteness",
    shortDescription: "Concrete examples vs abstraction.",
    howMeasured: "Share of concrete nouns and tangible references.",
    scaleDirection: "low=abstract, high=concrete",
    aliases: ["concreteness", "abstractVsConcrete"],
  },
  {
    id: "language.metaphor_density",
    domain: "language",
    label: "Metaphor density",
    shortDescription: "Use of metaphors or similes to illustrate ideas.",
    howMeasured: "Metaphors per thousand words or per segment.",
    scaleDirection: "low=literal, high=figurative",
    aliases: ["metaphor_density"],
  },
  {
    id: "language.references",
    domain: "language",
    label: "References",
    shortDescription: "Mentions of cultural, historical, or scientific touchpoints.",
    howMeasured: "Count and diversity of cited references.",
    scaleDirection: "low=few, high=frequent",
    aliases: ["references"],
  },
  {
    id: "language.humor",
    domain: "language",
    label: "Humor",
    shortDescription: "Presence of jokes or playful turns.",
    howMeasured: "Notable punchlines, asides, or comedic beats.",
    scaleDirection: "low=serious, high=playful",
    aliases: ["humor"],
  },
  {
    id: "language.teaching_vs_riffing",
    domain: "language",
    label: "Teaching vs riffing",
    shortDescription: "Structured instruction vs loose commentary.",
    howMeasured: "Share of explicit instruction relative to tangents/riffs.",
    scaleDirection: "low=riffing, high=instructional",
    aliases: ["teaching_vs_riffing", "explanationWeight"],
  },
  {
    id: "language.story_presence",
    domain: "language",
    label: "Story presence",
    shortDescription: "Amount of narrative or anecdotal framing.",
    howMeasured: "Density of story-driven phrasing vs straight exposition.",
    scaleDirection: "low=explanatory, high=story-driven",
    aliases: ["storyPresence"],
  },
  {
    id: "language.visualizability",
    domain: "language",
    label: "Visualizability",
    shortDescription: "How easy it is to picture what is said.",
    howMeasured: "Imagery, sensory cues, and concrete descriptors.",
    scaleDirection: "low=abstract, high=visual",
    aliases: ["visualizability"],
  },
  {
    id: "language.sentiment",
    domain: "language",
    label: "Sentiment / positivity",
    shortDescription: "Overall positive vs negative affect in wording.",
    howMeasured: "Lexical sentiment and valence across phrases.",
    scaleDirection: "low=critical/dry, high=positive/warm",
    aliases: ["positivity", "sentiment"],
  },
  {
    id: "language.directive_density",
    domain: "language",
    label: "Directive density",
    shortDescription: "How often the speaker gives instructions or imperatives.",
    howMeasured: "Frequency of directive phrases vs open commentary.",
    scaleDirection: "low=hands-off, high=instructional",
    aliases: ["directive_density", "directiveness"],
  },
  {
    id: "language.self_disclosure",
    domain: "language",
    label: "Self-disclosure",
    shortDescription: "Personal anecdotes or emotional reveals.",
    howMeasured: "Presence of first-person sharing and vulnerability cues.",
    scaleDirection: "low=impersonal, high=personal",
    aliases: ["self_disclosure", "disclosure"],
  },
  {
    id: "language.sarcasm_irony",
    domain: "language",
    label: "Sarcasm / irony",
    shortDescription: "Dry or ironic delivery that undercuts literal meaning.",
    howMeasured: "Detections of sarcastic/ironic phrasing and tone markers.",
    scaleDirection: "low=earnest, high=sarcastic",
    aliases: ["sarcasm", "irony", "sarcasm_irony"],
  },
];

const narrativeAxes: AxisMetadata[] = [
  {
    id: "narrative.story_presence",
    domain: "narrative",
    label: "Story presence",
    shortDescription: "Amount of narrative or anecdotal framing across the video.",
    howMeasured: "Share of beats that are hook/setup/escalation/payoff versus straight explanation.",
    scaleDirection: "low=instructional, high=story-led",
    aliases: ["story_presence", "storyPresence"],
  },
  {
    id: "narrative.mini_arc_density",
    domain: "narrative",
    label: "Mini-arc density",
    shortDescription: "Presence of small setups/payoffs within the video.",
    howMeasured: "Count of identifiable mini arcs across beats.",
    scaleDirection: "low=few arcs, high=many arcs",
    aliases: ["mini_arc_density", "structure"],
  },
  {
    id: "narrative.foreshadow_callbacks",
    domain: "narrative",
    label: "Foreshadow & callbacks",
    shortDescription: "Use of open loops, foreshadowing, and callbacks.",
    howMeasured: "Occurrences of open questions and later callbacks.",
    scaleDirection: "low=rare, high=frequent",
    aliases: ["foreshadow_callbacks", "callbacks"],
  },
  {
    id: "narrative.transition_clarity",
    domain: "narrative",
    label: "Transition clarity",
    shortDescription: "Smoothness of movement between sections.",
    howMeasured: "Verbal/visual bridges that guide the listener.",
    scaleDirection: "low=jarring, high=guided",
    aliases: ["transition_clarity"],
  },
  {
    id: "narrative.hooks",
    domain: "narrative",
    label: "Hooks",
    shortDescription: "Strength of the opening and re-engagement hooks.",
    howMeasured: "Clarity and potency of hook beats in the timeline.",
    scaleDirection: "low=weak, high=strong",
    aliases: ["hooks"],
  },
  {
    id: "narrative.pattern_interrupts",
    domain: "narrative",
    label: "Pattern interrupts",
    shortDescription: "Narrative-level resets or contrasts.",
    howMeasured: "Moments that deliberately break the flow or expectation.",
    scaleDirection: "low=smooth, high=disruptive",
    aliases: ["interrupts", "pattern_interrupts"],
  },
];

const visualAxes: AxisMetadata[] = [
  {
    id: "visual.environment_stability",
    domain: "visual",
    label: "Environment stability",
    shortDescription: "How often the setup or background changes.",
    howMeasured: "Percentage of runtime in the primary setup vs other locations.",
    scaleDirection: "low=frequent changes, high=stable",
    aliases: ["environment_stability", "stability"],
  },
  {
    id: "visual.talking_vs_broll_vs_graphics",
    domain: "visual",
    label: "Talking/B-roll/graphics mix",
    shortDescription: "Balance between talking head, b-roll, and overlays.",
    howMeasured: "Share of runtime across talking head vs supporting visuals.",
    scaleDirection: "low=talking-heavy, high=visual-heavy mix",
    aliases: ["talking_vs_broll_vs_graphics"],
  },
  {
    id: "visual.movement",
    domain: "visual",
    label: "Movement",
    shortDescription: "Camera and body motion on screen.",
    howMeasured: "Perceived movement level across shots.",
    scaleDirection: "low=static, high=active",
    aliases: ["movement"],
  },
  {
    id: "visual.expression",
    domain: "visual",
    label: "Expression",
    shortDescription: "Facial expressiveness and eye contact.",
    howMeasured: "Range of expressions and direct engagement with camera.",
    scaleDirection: "low=neutral, high=expressive",
    aliases: ["expression"],
  },
];

const editingAxes: AxisMetadata[] = [
  {
    id: "editing.cut_rate",
    domain: "editing",
    label: "Cut rate",
    shortDescription: "Average time between cuts.",
    howMeasured: "Estimated shot duration across the video.",
    scaleDirection: "low=long shots, high=rapid cuts",
    aliases: ["cut_rate", "cutPace"],
  },
  {
    id: "editing.pattern_interrupts",
    domain: "editing",
    label: "Pattern interrupts",
    shortDescription: "Visual resets like memes, overlays, or jump zooms.",
    howMeasured: "Count of notable interrupt moments in edits.",
    scaleDirection: "low=rare, high=frequent",
    aliases: ["pattern_interrupts", "patternInterrupts"],
  },
  {
    id: "editing.broll_coverage",
    domain: "editing",
    label: "B-roll coverage",
    shortDescription: "Portion of runtime covered by b-roll.",
    howMeasured: "Percent of the video with b-roll layered over narration.",
    scaleDirection: "low=minimal, high=heavy b-roll",
    aliases: ["broll_coverage", "broll", "brollPresence"],
  },
];

const soundAxes: AxisMetadata[] = [
  {
    id: "sound.music_changes",
    domain: "sound",
    label: "Music changes",
    shortDescription: "Distinct background music shifts.",
    howMeasured: "Count of transitions between music beds or tracks.",
    scaleDirection: "low=single/none, high=frequent changes",
    aliases: ["music_changes"],
  },
  {
    id: "sound.music_coverage",
    domain: "sound",
    label: "Music coverage",
    shortDescription: "Portion of the video with music under voice.",
    howMeasured: "Approximate percentage of runtime with background music.",
    scaleDirection: "low=none, high=continuous",
    aliases: ["musicCoverage"],
  },
  {
    id: "sound.music_balance",
    domain: "sound",
    label: "Music vs voice",
    shortDescription: "Balance between music loudness and narration.",
    howMeasured: "Relative loudness of music compared to the voice track.",
    scaleDirection: "low=understated, high=overpowering",
    aliases: ["musicBalance"],
  },
  {
    id: "sound.sfx_density",
    domain: "sound",
    label: "SFX density",
    shortDescription: "Use of sound effects for emphasis.",
    howMeasured: "Notable SFX count across the video.",
    scaleDirection: "low=rare, high=frequent",
    aliases: ["sfx_density", "sfxPurpose"],
  },
  {
    id: "sound.silence_for_emphasis",
    domain: "sound",
    label: "Silence for emphasis",
    shortDescription: "Intentional use of quiet moments.",
    howMeasured: "Distinct spans of silence used to punctuate ideas.",
    scaleDirection: "low=none, high=frequent",
    aliases: ["silence_for_emphasis"],
  },
];

export const metaAxesMetadata = metaAxes;
export const domainAxesMetadata: AxisMetadata[] = [
  ...voiceAxes,
  ...languageAxes,
  ...narrativeAxes,
  ...visualAxes,
  ...editingAxes,
  ...soundAxes,
];
export const allAxesMetadata: AxisMetadata[] = [...metaAxesMetadata, ...domainAxesMetadata];

const axisIndex = new Map<string, AxisMetadata>();
allAxesMetadata.forEach((axis) => {
  axisIndex.set(axis.id, axis);
  const metricPart = axis.id.includes(".") ? axis.id.split(".")[1] : undefined;
  if (metricPart) {
    axisIndex.set(metricPart, axis);
  }
  axis.aliases?.forEach((alias) => axisIndex.set(alias, axis));
});

export const resolveAxisMetadata = (key: string): AxisMetadata | undefined => axisIndex.get(key);

export const getAxesForDomain = (domain: DomainKey): AxisMetadata[] =>
  domainAxesMetadata.filter((axis) => axis.domain === domain);
