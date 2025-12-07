import type { VideoFingerprintJson } from "./types";
import type { AnalyzeVideoResult } from "./analysis/types";

const sampleFingerprint: VideoFingerprintJson = {
  version: "1.2.0",
  createdAt: new Date().toISOString(),
  metaAxes: {
    voiceIntensity: 72,
    conceptualDepth: 68,
    narrativeStructureStrength: 74,
    visualDynamism: 58,
    productionPolish: 70,
  },
  perDomain: {
    voiceProfile: {
      primaryArchetype: "Hyperactive Commentator",
      secondaryArchetype: "Measured Host",
      summaryText: "Punchy, upbeat delivery with clear articulation and frequent resets.",
      scores: [
        { key: "energy", label: "Energy", value: 78 },
        { key: "expressiveness", label: "Expressiveness", value: 72 },
        { key: "clarity", label: "Clarity", value: 70 },
        { key: "warmth", label: "Warmth", value: 62 },
        { key: "flow", label: "Flow/Resets", value: 74 },
      ],
      highlights: ["High tempo", "Bright emphasis", "Clear resets"],
    },
    languageProfile: {
      primaryArchetype: "Analytical Explainer",
      secondaryArchetype: "Punchy Commentator",
      summaryText: "Dense with examples and takes, balancing structured reasoning and punchlines.",
      scores: [
        { key: "abstractVsConcrete", label: "Abstract vs Concrete", value: 66 },
        { key: "storyPresence", label: "Story Presence", value: 58 },
        { key: "explanationWeight", label: "Explanation Weight", value: 74 },
        { key: "visualizability", label: "Visualizability", value: 62 },
      ],
      highlights: ["Uses concrete hooks", "Balances explanation and takes"],
    },
    narrativeProfile: {
      primaryArchetype: "Structured Deep Dive",
      secondaryArchetype: "Segmented Explainer",
      summaryText: "Clear setups and payoffs with modular beats that keep the pace moving.",
      scores: [
        { key: "structure", label: "Structure Strength", value: 76 },
        { key: "hooks", label: "Hooks", value: 72 },
        { key: "callbacks", label: "Callbacks", value: 62 },
        { key: "interrupts", label: "Pattern Interrupts", value: 68 },
      ],
      highlights: ["Strong open and recap", "Uses callbacks lightly"],
    },
    visualProfile: {
      primaryArchetype: "Composed Studio",
      secondaryArchetype: "Dynamic Desk Setup",
      summaryText: "Steady framing with occasional gestures and overlays to keep motion alive.",
      scores: [
        { key: "movement", label: "Movement", value: 55 },
        { key: "expression", label: "Expression", value: 60 },
        { key: "stability", label: "Background Stability", value: 64 },
      ],
      highlights: ["Clean framing", "Light hand movement"],
    },
    editingProfile: {
      primaryArchetype: "Cut-Heavy Pacing",
      secondaryArchetype: "Polished Post",
      summaryText: "Frequent jump cuts with subtle polish and occasional pattern interrupts.",
      scores: [
        { key: "cutPace", label: "Cut Pace", value: 78 },
        { key: "patternInterrupts", label: "Pattern Interrupts", value: 70 },
        { key: "broll", label: "B-roll Presence", value: 62 },
      ],
      highlights: ["Tight cuts", "Interrupts to reset attention"],
    },
    soundProfile: {
      primaryArchetype: "Balanced Mix",
      secondaryArchetype: "Upbeat Underscore",
      summaryText: "Voice-forward mix with light music to lift energy without overpowering.",
      scores: [
        { key: "musicCoverage", label: "Music Coverage", value: 64 },
        { key: "musicBalance", label: "Music vs Voice", value: 70 },
        { key: "sfxPurpose", label: "SFX Purposefulness", value: 60 },
      ],
      highlights: ["Music balanced under VO", "Sparse, purposeful SFX"],
    },
  },
  overallArchetype: "Hyperactive Commentator",
  supporting: {
    transcriptSegments: [
      { startSeconds: 0, endSeconds: 20, text: "Hook and cold open" },
      { startSeconds: 20, endSeconds: 60, text: "Main argument setup" },
    ],
    sceneSegments: [
      { startSeconds: 0, endSeconds: 30, label: "Intro", shortSummary: "Opening hook" },
      { startSeconds: 30, endSeconds: 90, label: "Main Body", shortSummary: "Key points" },
    ],
    beats: [{ startSeconds: 5, endSeconds: 25, label: "Hook", devices: ["contrast"] }],
  },
};

export const sampleAnalysisResult: AnalyzeVideoResult = {
  fingerprint: sampleFingerprint,
  overallArchetype: sampleFingerprint.overallArchetype ?? "Sample Archetype",
  diagnostics: { source: "mock", analysisPath: "mock", analysisVersion: "v1" },
};

export const sampleMetadata = {
  title: "Sample CreatorSight Walkthrough",
  channelTitle: "CreatorSight Demo",
  publishedAt: "2024-06-01T00:00:00Z",
  durationSeconds: 420,
  thumbnailUrl: "https://i.ytimg.com/vi/aqz-KE-bpKQ/hqdefault.jpg",
};
