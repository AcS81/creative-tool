import type {
  LanguageTexture,
  NarrativeArc,
  ProsodyArc,
  ScoredMetric,
  TimelinePoint,
  VisualEditAlignment,
} from "../../types";

export type AdvancedSegmentType = "hook" | "prosody_language" | "visual_edit" | "narrative_arc" | "ending";

export type RichMetric = ScoredMetric;

// Timeline arrays are capped by segment duration (<=25 points by default).
export type AdvancedTimelinePoint = TimelinePoint;

export interface SegmentAdvancedMetrics {
  segmentId: string;
  chapterId: string;
  startSeconds: number;
  endSeconds: number;
  segmentType: AdvancedSegmentType;
  prosodyArc?: Partial<ProsodyArc>;
  languageTexture?: Partial<LanguageTexture>;
  narrativeArc?: Partial<NarrativeArc>;
  visualEditAlignment?: Partial<VisualEditAlignment>;
  diagnostics?: Record<string, unknown>;
}
