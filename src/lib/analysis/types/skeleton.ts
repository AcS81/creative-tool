export type VideoType =
  | "tutorial"
  | "essay"
  | "vlog"
  | "reaction"
  | "interview"
  | "documentary"
  | "entertainment"
  | "other";

export type ChapterType =
  | "intro"
  | "hook"
  | "body"
  | "example"
  | "tangent"
  | "conclusion"
  | "cta"
  | "outro";

export type KeyMomentType = "hook" | "peak" | "twist" | "payoff" | "cta";

export type EstimatedComplexity = "low" | "medium" | "high";

export interface Chapter {
  id: string;
  title: string;
  startSeconds: number;
  endSeconds: number;
  summary: string; // Keep under 15 words.
  chapterType: ChapterType;
}

export interface KeyMoment {
  type: KeyMomentType;
  timestamp: number;
  chapterId: string;
  description: string; // Keep under 15 words.
}

export interface ContentMix {
  talkingHeadPct: number;
  brollPct: number;
  graphicsPct: number;
  screencastPct: number;
  otherPct: number;
}

export interface AnalysisHints {
  hasMusic: boolean;
  hasSFX: boolean;
  hasOnScreenText: boolean;
  hasMultipleSpeakers: boolean;
  primaryLanguage: string;
  estimatedComplexity: EstimatedComplexity;
}

export interface VideoSkeleton {
  durationSeconds: number;
  videoType: VideoType;
  topicSummary: string;
  chapters: Chapter[];
  keyMoments: KeyMoment[];
  contentMix: ContentMix;
  analysisHints: AnalysisHints;
}
