import type { DomainKey } from "../archetypes/descriptions";

export type MetaAxisId =
  | "voiceIntensity"
  | "conceptualDepth"
  | "narrativeStructureStrength"
  | "visualDynamism"
  | "productionPolish";

export type DomainMetricId = `${DomainKey}.${string}`;
export type AxisId = MetaAxisId | DomainMetricId | string;

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
    howMeasured: "Relative-energy speech gaps that drop below the local floor for >0.6s, ignoring bed/crowd noise.",
    scaleDirection: "low=none, high=frequent",
    aliases: ["silence_for_emphasis"],
  },
];

const prosodyArcAxes: AxisMetadata[] = [
  {
    id: "voice.pace_mean_wpm",
    domain: "voice",
    label: "Speaking pace (mean)",
    shortDescription: "Average speaking pace in words per minute.",
    howMeasured: "Mean WPM measured over 10s windows and averaged.",
    scaleDirection: "low=slow/deliberate, high=fast/pressured",
    aliases: ["pace_mean_wpm"],
  },
  {
    id: "voice.pace_variability_pct",
    domain: "voice",
    label: "Pace variability",
    shortDescription: "How much pace swings versus the mean.",
    howMeasured: "Coefficient of variation of pace across 10s windows.",
    scaleDirection: "low=flat, high=erratic",
    aliases: ["pace_variability_pct"],
  },
  {
    id: "voice.within_segment_pace_change_pct",
    domain: "voice",
    label: "Within-segment pace drift",
    shortDescription: "Speed-ups or slowdowns inside segments.",
    howMeasured: "Start→end pace deltas per segment, normalized as % change.",
    scaleDirection: "low=stable, high=drifting",
    aliases: ["within_segment_pace_change_pct"],
  },
  {
    id: "voice.emphasis_alignment_score",
    domain: "voice",
    label: "Emphasis vs key phrases",
    shortDescription: "How well vocal stress lands on important phrases.",
    howMeasured: "Precision/recall of stressed syllables against detected key phrases.",
    scaleDirection: "low=misplaced, high=aligned",
    aliases: ["emphasis_alignment_score"],
  },
  {
    id: "voice.energy_drift_db_per_min",
    domain: "voice",
    label: "Energy drift",
    shortDescription: "Trend of vocal energy over time.",
    howMeasured: "Slope of loudness (dB) per minute plus 15s window timeline.",
    scaleDirection: "low=fade, mid=steady, high=building",
    aliases: ["energy_drift_db_per_min"],
  },
];

const languageTextureAxes: AxisMetadata[] = [
  {
    id: "language.analogy_example_definition_ratio",
    domain: "language",
    label: "Analogy/example/definition mix",
    shortDescription: "Balance of analogies, examples, and definitions.",
    howMeasured: "Counts per 1k words across analogies, examples, and definitions.",
    scaleDirection: "low=skewed, high=balanced",
    aliases: ["analogy_example_definition_ratio"],
  },
  {
    id: "language.sentence_compression_ratio",
    domain: "language",
    label: "Sentence compression",
    shortDescription: "Words per idea/clause as a tightness proxy.",
    howMeasured: "Distribution of words per atomic idea to gauge compression.",
    scaleDirection: "low=telegraphic, mid=crisp, high=rambling",
    aliases: ["sentence_compression_ratio"],
  },
  {
    id: "language.humor_timing_score",
    domain: "language",
    label: "Humor timing",
    shortDescription: "Setup-to-punch spacing and landed punchlines.",
    howMeasured: "Setup/punch deltas and landed rates across jokes.",
    scaleDirection: "low=buried/late, high=timely",
    aliases: ["humor_timing_score"],
  },
  {
    id: "language.reference_density_per_min",
    domain: "language",
    label: "Reference density",
    shortDescription: "How often topical/cultural references appear.",
    howMeasured: "References per minute with type annotations.",
    scaleDirection: "low=sparse, high=rich/varied",
    aliases: ["reference_density_per_min"],
  },
  {
    id: "language.question_rate",
    domain: "language",
    label: "Question rate",
    shortDescription: "Frequency and mix of rhetorical vs genuine questions.",
    howMeasured: "Questions per minute plus rhetorical vs genuine share.",
    scaleDirection: "low=none, mid=engaging, high=interrogative barrage",
    aliases: ["question_rate"],
  },
];

const narrativeArcAxes: AxisMetadata[] = [
  {
    id: "narrative.time_to_hook_seconds",
    domain: "narrative",
    label: "Time to hook",
    shortDescription: "Seconds until the first hook lands.",
    howMeasured: "Elapsed time from start to first detected hook beat.",
    scaleDirection: "low=fast hook, high=delayed",
    aliases: ["time_to_hook_seconds"],
  },
  {
    id: "narrative.hook_strength_score",
    domain: "narrative",
    label: "Hook strength",
    shortDescription: "Clarity and potency of opening promise/tension.",
    howMeasured: "Hook device strength and promise clarity at first hook beat.",
    scaleDirection: "low=vague, high=compelling",
    aliases: ["hook_strength_score"],
  },
  {
    id: "narrative.segment_cohesion_drift",
    domain: "narrative",
    label: "Segment cohesion",
    shortDescription: "How smoothly segments relate versus drift.",
    howMeasured: "Semantic similarity deltas between adjacent segments.",
    scaleDirection: "low=drifty, high=cohesive",
    aliases: ["segment_cohesion_drift"],
  },
  {
    id: "narrative.open_loops_unresolved_ratio",
    domain: "narrative",
    label: "Open loops resolved",
    shortDescription: "Share of open loops that get closed.",
    howMeasured: "Unresolved loops divided by total detected loops.",
    scaleDirection: "low=lots unresolved, high=closed loops",
    aliases: ["open_loops_unresolved_ratio"],
  },
  {
    id: "narrative.ending_resolution_score",
    domain: "narrative",
    label: "Ending resolution",
    shortDescription: "How fully the ending pays off promises.",
    howMeasured: "Presence of payoff, callbacks, and CTA clarity.",
    scaleDirection: "low=abrupt, high=resolved",
    aliases: ["ending_resolution_score"],
  },
];

const visualAlignmentAxes: AxisMetadata[] = [
  {
    id: "visual.visual_entropy",
    domain: "visual",
    label: "Visual entropy",
    shortDescription: "Overall visual change rate/entropy.",
    howMeasured: "Normalized entropy of visual changes over 1s windows.",
    scaleDirection: "low=static, mid=purposeful spikes, high=chaotic",
    aliases: ["visual_entropy"],
  },
  {
    id: "editing.cut_rate_refinement",
    domain: "editing",
    label: "Cut rate refinement",
    shortDescription: "Consistency of cut pacing with intentional peaks.",
    howMeasured: "Median shot length, variance, and beat-coupling deltas.",
    scaleDirection: "low=erratic/flat, high=deliberate",
    aliases: ["cut_rate_refinement"],
  },
  {
    id: "sound.silence_for_emphasis_fidelity",
    domain: "sound",
    label: "Silence for emphasis fidelity",
    shortDescription: "Whether silences line up with hooks/payoffs.",
    howMeasured:
      "Relative-energy speech gaps >0.6s with strength scores, labeled intent (reset/punch/transition), and alignment to beats or punchlines.",
    scaleDirection: "low=absent/mistimed, high=well-placed",
    aliases: ["silence_for_emphasis_fidelity"],
  },
];

const crossModalAxes: AxisMetadata[] = [
  {
    id: "alignment.audio_visual_emphasis_alignment",
    domain: "meta",
    label: "Audio-visual emphasis alignment",
    shortDescription: "Do vocal emphasis moments coincide with visual emphasis?",
    howMeasured: "Offset between loudness/pitch/pauses and cuts/zooms/graphics.",
    scaleDirection: "low=misaligned, high=locked",
    aliases: ["audio_visual_emphasis_alignment"],
  },
  {
    id: "alignment.beats_vs_edits_alignment",
    domain: "meta",
    label: "Beats vs edits alignment",
    shortDescription: "Whether edits support narrative beat transitions.",
    howMeasured: "Distance between beat changes and nearest cut/transition.",
    scaleDirection: "low=unsupported, high=reinforced",
    aliases: ["beats_vs_edits_alignment"],
  },
  {
    id: "alignment.prosody_vs_semantic_importance_alignment",
    domain: "meta",
    label: "Prosody vs semantic importance",
    shortDescription: "Vocal stress on important phrases.",
    howMeasured: "Alignment of stressed phrases to semantic importance scores.",
    scaleDirection: "low=misplaced, high=aligned",
    aliases: ["prosody_vs_semantic_importance_alignment"],
  },
  {
    id: "balance.redundancy_vs_complementarity",
    domain: "meta",
    label: "Redundant vs complementary",
    shortDescription: "Whether modes add new info or repeat/conflict.",
    howMeasured: "Share of redundant, complementary, and conflicting moments.",
    scaleDirection: "low=conflicting/redundant, high=complementary",
    aliases: ["redundancy_vs_complementarity"],
  },
  {
    id: "balance.modality_over_reliance",
    domain: "meta",
    label: "Modality over-reliance",
    shortDescription: "One modality carrying most meaning.",
    howMeasured: "Dominant modality share of meaning vs supporting modes.",
    scaleDirection: "low=balanced, high=over-reliant",
    aliases: ["modality_over_reliance"],
  },
];

const cognitiveLoadAxes: AxisMetadata[] = [
  {
    id: "cognitive_load.load_per_second",
    domain: "meta",
    label: "Cognitive load timeline",
    shortDescription: "Moment-by-moment cognitive load estimate.",
    howMeasured: "1 Hz smoothed load from pace density, visual entropy, jargon, and cut pace.",
    scaleDirection: "low=light, high=dense/taxing",
    aliases: ["load_per_second"],
  },
  {
    id: "cognitive_load.load_highlights",
    domain: "meta",
    label: "Cognitive load spikes",
    shortDescription: "Where cognitive load peaks occur.",
    howMeasured: "Top load spikes with drivers and durations.",
    scaleDirection: "low=overloaded, high=rare/brief peaks",
    aliases: ["load_highlights"],
  },
];

const secondOrderAxes: AxisMetadata[] = [
  {
    id: "summary.alignment_score",
    domain: "meta",
    label: "Alignment score",
    shortDescription: "Overall cross-modal alignment of emphasis and beats.",
    howMeasured: "Blend of emphasis alignment, audio-visual alignment, beats vs edits, and prosody vs importance.",
    scaleDirection: "low=disjoint, high=aligned",
    aliases: ["alignment_score"],
  },
  {
    id: "summary.drift_score",
    domain: "meta",
    label: "Drift score",
    shortDescription: "Stability of pace, energy, and cohesion over time.",
    howMeasured: "Energy drift, pace variability, and segment cohesion changes.",
    scaleDirection: "low=wandering/fading, high=steady/intentional",
    aliases: ["drift_score"],
  },
  {
    id: "summary.decay_score",
    domain: "meta",
    label: "Decay score",
    shortDescription: "Resistance to fatigue or clarity loss across the video.",
    howMeasured: "Within-segment pace change, energy drift, and late-stage load trend.",
    scaleDirection: "low=clear decay, high=holds up",
    aliases: ["decay_score"],
  },
  {
    id: "summary.balance_score",
    domain: "meta",
    label: "Balance score",
    shortDescription: "Complementarity across modalities without over-reliance.",
    howMeasured: "Redundancy vs complementarity and modality reliance mix.",
    scaleDirection: "low=conflict/overload, high=balanced blend",
    aliases: ["balance_score"],
  },
  {
    id: "summary.timing_score",
    domain: "meta",
    label: "Timing score",
    shortDescription: "Effectiveness of hooks, cuts, silences, and punch timing.",
    howMeasured: "Time to hook, hook strength, beats vs edits, silence fidelity, and punch deltas.",
    scaleDirection: "low=late/misaligned, high=well-timed",
    aliases: ["timing_score"],
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
  ...prosodyArcAxes,
  ...languageTextureAxes,
  ...narrativeArcAxes,
  ...visualAlignmentAxes,
  ...crossModalAxes,
  ...cognitiveLoadAxes,
  ...secondOrderAxes,
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
