import type { SegmentAdvancedMetrics } from "./advancedMetrics";
import type { CoreMetrics } from "./coreMetrics";
import type { VideoSkeleton } from "./skeleton";

export type DerivedScore = {
  value: number;
  observed: boolean;
};

export interface DerivedScores {
  metaAxes: {
    voiceIntensity: DerivedScore;
    conceptualDepth: DerivedScore;
    narrativeStructureStrength: DerivedScore;
    visualDynamism: DerivedScore;
    productionPolish: DerivedScore;
  };
  alignment: {
    audioVisualAlignment: DerivedScore;
    beatsEditsAlignment: DerivedScore;
    prosodySemanticAlignment: DerivedScore;
    overallAlignment: DerivedScore;
  };
  balance: {
    redundancyScore: DerivedScore;
    complementarityScore: DerivedScore;
    overRelianceScore: DerivedScore;
    overallBalance: DerivedScore;
  };
  cognitiveLoad: {
    averageLoad: DerivedScore;
    peakLoad: DerivedScore;
    loadVariance: DerivedScore;
    overloadMoments: DerivedScore;
  };
  secondOrder: {
    alignmentScore: DerivedScore;
    driftScore: DerivedScore;
    decayScore: DerivedScore;
    balanceScore: DerivedScore;
    timingScore: DerivedScore;
  };
}

export interface DerivedScoreInput {
  coreMetrics: CoreMetrics;
  skeleton?: VideoSkeleton;
  advancedMetrics?: SegmentAdvancedMetrics[];
}
