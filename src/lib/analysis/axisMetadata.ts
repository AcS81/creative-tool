export type AxisMetadata = {
  id: string;
  label: string;
  description: string;
  domain?: string;
};

export const metaAxesMetadata: AxisMetadata[] = [
  {
    id: "voiceIntensity",
    label: "Voice intensity",
    description: "How energetic and projected the delivery feels.",
  },
  {
    id: "conceptualDepth",
    label: "Conceptual depth",
    description: "How much abstract thinking and depth shows up.",
  },
  {
    id: "narrativeStructureStrength",
    label: "Narrative structure",
    description: "How clearly the story beats and arcs land.",
  },
  {
    id: "visualDynamism",
    label: "Visual dynamism",
    description: "How much motion and visual change the viewer sees.",
  },
  {
    id: "productionPolish",
    label: "Production polish",
    description: "Perceived finish across cuts, mix, and overall sheen.",
  },
];

type DomainMetricMetadata = Record<
  string,
  {
    id: string;
    label: string;
    description: string;
  }
>;

export const domainMetricMetadata: Record<string, DomainMetricMetadata> = {
  voice: {
    energy: { id: "energy", label: "Energy", description: "Perceived vocal drive and loudness." },
    expressiveness: {
      id: "expressiveness",
      label: "Expressiveness",
      description: "Pitch and tone variation used to shape phrases.",
    },
    clarity: { id: "clarity", label: "Clarity", description: "Diction and ease of comprehension." },
    warmth: { id: "warmth", label: "Warmth", description: "Intimacy and friendliness in tone." },
    flow: { id: "flow", label: "Flow/Resets", description: "Cadence smoothness and reset cadence." },
    speaking_rate: {
      id: "speaking_rate",
      label: "Speaking Rate",
      description: "Words per minute and pacing feel.",
    },
    filler_rate: { id: "filler_rate", label: "Filler Rate", description: "Frequency of fillers per minute." },
    pauses: { id: "pauses", label: "Pauses/Resets", description: "Pause length and reset rhythm." },
    loudness_range: {
      id: "loudness_range",
      label: "Loudness Range",
      description: "Dynamic range across the delivery.",
    },
    pitch_variation: {
      id: "pitch_variation",
      label: "Pitch Variation",
      description: "How much pitch moves to emphasize ideas.",
    },
  },
  language: {
    abstractVsConcrete: {
      id: "abstractVsConcrete",
      label: "Abstract vs Concrete",
      description: "Balance of tangible examples vs abstract ideas.",
    },
    storyPresence: {
      id: "storyPresence",
      label: "Story Presence",
      description: "How often narrative elements appear.",
    },
    explanationWeight: {
      id: "explanationWeight",
      label: "Explanation Weight",
      description: "Share of structured explanation vs commentary.",
    },
    visualizability: {
      id: "visualizability",
      label: "Visualizability",
      description: "How easy it is to picture what is said.",
    },
    concreteness: {
      id: "concreteness",
      label: "Concreteness",
      description: "Concrete nouns/examples density.",
    },
    metaphor_density: {
      id: "metaphor_density",
      label: "Metaphor Density",
      description: "Frequency of metaphors/similes per word count.",
    },
    references: {
      id: "references",
      label: "References",
      description: "Cultural/historical/scientific references used.",
    },
    humor: { id: "humor", label: "Humor", description: "Jokes or humorous asides frequency." },
    teaching_vs_riffing: {
      id: "teaching_vs_riffing",
      label: "Teaching vs Riffing",
      description: "Instructional share vs riffs/tangents.",
    },
  },
  narrative: {
    structure: {
      id: "structure",
      label: "Structure Strength",
      description: "How clearly the story arc is built.",
    },
    hooks: { id: "hooks", label: "Hooks", description: "Strength and frequency of hooks." },
    callbacks: {
      id: "callbacks",
      label: "Callbacks",
      description: "Use of callbacks/foreshadowing to tie beats.",
    },
    interrupts: {
      id: "interrupts",
      label: "Pattern Interrupts",
      description: "Attention resets inside the narrative.",
    },
    mini_arc_density: {
      id: "mini_arc_density",
      label: "Mini Arc Density",
      description: "Count of mini arcs within the video.",
    },
    foreshadow_callbacks: {
      id: "foreshadow_callbacks",
      label: "Foreshadow & Callbacks",
      description: "Use of open loops and callbacks.",
    },
    transition_clarity: {
      id: "transition_clarity",
      label: "Transition Clarity",
      description: "How cleanly segments transition.",
    },
  },
  visual: {
    movement: { id: "movement", label: "Movement", description: "Body and camera movement level." },
    stability: {
      id: "stability",
      label: "Background Stability",
      description: "How often the background/setup changes.",
    },
    expression: {
      id: "expression",
      label: "Expression",
      description: "Facial expression and eye contact dynamism.",
    },
    environment_stability: {
      id: "environment_stability",
      label: "Environment Stability",
      description: "Percentage of time in the same setup.",
    },
    talking_vs_broll_vs_graphics: {
      id: "talking_vs_broll_vs_graphics",
      label: "Talking/B-roll/Graphics Mix",
      description: "Share of talking head vs b-roll vs on-screen graphics.",
    },
  },
  editing: {
    cutPace: { id: "cutPace", label: "Cut Pace", description: "Tempo and frequency of cuts." },
    patternInterrupts: {
      id: "patternInterrupts",
      label: "Pattern Interrupts",
      description: "Unexpected visual/audio resets.",
    },
    broll: { id: "broll", label: "B-roll Presence", description: "B-roll frequency and coverage." },
    cut_rate: { id: "cut_rate", label: "Cut Rate", description: "Average seconds between cuts." },
    broll_coverage: { id: "broll_coverage", label: "B-roll Coverage", description: "Share of runtime with b-roll." },
  },
  sound: {
    musicCoverage: {
      id: "musicCoverage",
      label: "Music Coverage",
      description: "Percentage of runtime with music under.",
    },
    musicBalance: {
      id: "musicBalance",
      label: "Music vs Voice",
      description: "Balance of music level vs narration.",
    },
    sfxPurpose: { id: "sfxPurpose", label: "SFX Purposefulness", description: "Use of SFX for emphasis." },
    music_changes: {
      id: "music_changes",
      label: "Music Changes",
      description: "Count and style of music transitions.",
    },
    sfx_density: { id: "sfx_density", label: "SFX Density", description: "Notable SFX count." },
    silence_for_emphasis: {
      id: "silence_for_emphasis",
      label: "Silence for Emphasis",
      description: "Purposeful silence spans.",
    },
  },
};

export const getAxisLabel = (id: string, domain?: string) => {
  const domainMap = domain ? domainMetricMetadata[domain] : undefined;
  const metric = domainMap?.[id];
  return metric?.label ?? metaAxesMetadata.find((axis) => axis.id === id)?.label ?? id;
};

export const getAxisDescription = (id: string, domain?: string) => {
  const domainMap = domain ? domainMetricMetadata[domain] : undefined;
  const metric = domainMap?.[id];
  return metric?.description ?? metaAxesMetadata.find((axis) => axis.id === id)?.description ?? "";
};
