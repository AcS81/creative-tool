# Schema Migration: v1.3.0 → v2.0.0

## Document Information
- **Purpose**: Migration plan from current flat schema to tiered schema
- **Related**: `creatorsight-stability-refactor.md`, `prompt-templates.md`
- **Current Version**: 1.3.0
- **Target Version**: 2.0.0
- **Status**: Proposal

---

## Overview

The v2.0.0 schema introduces:
1. **Tiered metric structure** (tier 1/2/3 separation)
2. **Video skeleton** as first-class data
3. **Per-chapter metrics** with aggregation
4. **Simplified core metrics** (no timelines in tier 1)
5. **Selective advanced metrics** (only for analyzed segments)
6. **Locally computed derived scores**

---

## Current Schema (v1.3.0)

```typescript
// Current fingerprint structure
interface VideoFingerprintJson {
  version: "1.3.0";
  createdAt: string;
  
  // Meta (computed from profiles)
  metaAxes: MetaAxes;
  
  // Per-domain profiles (flat)
  perDomain: {
    voiceProfile: DomainProfile;
    languageProfile: DomainProfile;
    narrativeProfile: DomainProfile;
    visualProfile: DomainProfile;
    editingProfile: DomainProfile;
    soundProfile: DomainProfile;
  };
  
  overallArchetype?: string;
  
  // Supporting data
  supporting?: {
    transcriptSegments?: TranscriptSegment[];
    sceneSegments?: SceneSegment[];
    beats?: BeatSegment[];
    axisDetails?: Record<string, AxisDetail>;
  };
  
  // Advanced metrics (all at once)
  prosodyArc: ProsodyArc;
  languageTexture: LanguageTexture;
  narrativeArc: NarrativeArc;
  visualEditAlignment: VisualEditAlignment;
  modalityBalance: ModalityBalance;
  cognitiveLoad: CognitiveLoad;
  secondOrder: SecondOrderSummary;
  
  // Performance (optional)
  performanceProfile?: PerformanceProfile;
  hasPerformanceData?: boolean;
}
```

---

## Target Schema (v2.0.0)

```typescript
interface VideoFingerprintJson_v2 {
  version: "2.0.0";
  schemaHash: string;
  createdAt: string;
  
  // ====== TIER 0: SKELETON ======
  skeleton: VideoSkeleton;
  
  // ====== TIER 1: CORE METRICS ======
  coreMetrics: {
    // Aggregated scores (weighted by chapter duration)
    aggregated: CoreMetricsAggregated;
    
    // Per-chapter breakdown
    perChapter: Record<string, ChapterCoreMetrics>;
    
    // Coverage info
    coverage: {
      chaptersAnalyzed: number;
      totalChapters: number;
      tier1ObservedPct: number;
    };
  };
  
  // ====== TIER 2: ADVANCED METRICS ======
  advancedMetrics?: {
    // Which segments were analyzed
    analyzedSegments: AdvancedSegmentSummary[];
    
    // Metrics by segment
    bySegment: Record<string, SegmentAdvancedMetrics>;
    
    // Coverage info
    coverage: {
      segmentsAnalyzed: number;
      tier2ObservedPct: number;
    };
  };
  
  // ====== TIER 3: DERIVED SCORES ======
  derivedScores: {
    metaAxes: MetaAxes;
    alignment: AlignmentScores;
    balance: BalanceScores;
    cognitiveLoad: CognitiveLoadSummary;
    secondOrder: SecondOrderScores;
    
    // Computation metadata
    computation: {
      inputsAvailable: string[];
      inputsMissing: string[];
      confidence: number;
    };
  };
  
  // ====== LEGACY COMPAT ======
  // Computed from above for backward compatibility
  perDomain: FingerprintPerDomain;
  
  // ====== PERFORMANCE (unchanged) ======
  performanceProfile?: PerformanceProfile;
  hasPerformanceData: boolean;
  
  // ====== DIAGNOSTICS ======
  diagnostics: AnalysisDiagnostics;
}
```

### Tier 0: Skeleton Types

```typescript
interface VideoSkeleton {
  durationSeconds: number;
  videoType: VideoType;
  topicSummary: string;
  
  chapters: Chapter[];
  keyMoments: KeyMoment[];
  contentMix: ContentMix;
  analysisHints: AnalysisHints;
}

type VideoType = 
  | 'tutorial' 
  | 'essay' 
  | 'vlog' 
  | 'reaction' 
  | 'interview' 
  | 'documentary' 
  | 'entertainment' 
  | 'other';

interface Chapter {
  id: string;
  title: string;
  startSeconds: number;
  endSeconds: number;
  summary: string;
  chapterType: ChapterType;
}

type ChapterType = 
  | 'intro' 
  | 'hook' 
  | 'body' 
  | 'example' 
  | 'tangent' 
  | 'conclusion' 
  | 'cta' 
  | 'outro';

interface KeyMoment {
  type: 'hook' | 'peak' | 'twist' | 'payoff' | 'cta';
  timestamp: number;
  chapterId: string;
  description: string;
}

interface ContentMix {
  talkingHeadPct: number;
  brollPct: number;
  graphicsPct: number;
  screencastPct: number;
  otherPct: number;
}

interface AnalysisHints {
  hasMusic: boolean;
  hasSFX: boolean;
  hasOnScreenText: boolean;
  hasMultipleSpeakers: boolean;
  primaryLanguage: string;
  estimatedComplexity: 'low' | 'medium' | 'high';
}
```

### Tier 1: Core Metrics Types

```typescript
// Simple metric without timelines
interface SummaryMetric {
  score: number;       // 0-100
  value: string;       // Human-readable
  observed: boolean;   // False if couldn't measure
}

interface CoreMetricsDomain {
  [metricKey: string]: SummaryMetric;
}

interface ChapterCoreMetrics {
  chapterId: string;
  chapterTitle: string;
  startSeconds: number;
  endSeconds: number;
  durationSeconds: number;
  
  voice: {
    speakingRate: SummaryMetric;
    fillerRate: SummaryMetric;
    pauseUsage: SummaryMetric;
    loudnessRange: SummaryMetric;
    pitchVariation: SummaryMetric;
    clarity: SummaryMetric;
    warmth: SummaryMetric;
  };
  
  language: {
    concreteness: SummaryMetric;
    metaphorDensity: SummaryMetric;
    references: SummaryMetric;
    humor: SummaryMetric;
    teachingVsRiffing: SummaryMetric;
    storyPresence: SummaryMetric;
  };
  
  narrative: {
    structureClarity: SummaryMetric;
    hookPresence: SummaryMetric;
    transitionQuality: SummaryMetric;
    payoffDelivery: SummaryMetric;
  };
  
  visual: {
    cutRate: SummaryMetric;
    environmentStability: SummaryMetric;
    movement: SummaryMetric;
    expression: SummaryMetric;
  };
  
  sound: {
    musicCoverage: SummaryMetric;
    musicBalance: SummaryMetric;
    sfxDensity: SummaryMetric;
    silenceUsage: SummaryMetric;
  };
}

interface CoreMetricsAggregated {
  voice: CoreMetricsDomain;
  language: CoreMetricsDomain;
  narrative: CoreMetricsDomain;
  visual: CoreMetricsDomain;
  sound: CoreMetricsDomain;
}
```

### Tier 2: Advanced Metrics Types

```typescript
interface TimelinePoint {
  timeSeconds: number;
  value: number;
  label?: string;
}

interface SpanHighlight {
  startSeconds: number;
  endSeconds: number;
  durationSeconds: number;
  value?: number;
  label?: string;
  strength?: number;
  alignedToBeat?: boolean;
  alignedToPunchline?: boolean;
}

interface RichMetric {
  score: number;
  value: string;
  observed: boolean;
  timeline?: TimelinePoint[];
  spans?: SpanHighlight[];
  items?: Record<string, unknown>[];
  counts?: Record<string, number>;
  proportions?: Record<string, number>;
  trend?: number;
}

interface AdvancedSegmentSummary {
  segmentId: string;
  chapterId: string;
  startSeconds: number;
  endSeconds: number;
  analysisTypes: AdvancedAnalysisType[];
  reason: string;
}

type AdvancedAnalysisType = 
  | 'hook' 
  | 'prosody_language' 
  | 'visual_edit' 
  | 'narrative_arc' 
  | 'ending';

interface SegmentAdvancedMetrics {
  segmentId: string;
  
  // Hook analysis (if type includes 'hook')
  hook?: {
    timeToHook: RichMetric;
    hookStrength: RichMetric;
    attentionGrab: RichMetric;
  };
  
  // Prosody (if type includes 'prosody_language')
  prosody?: {
    paceVariability: RichMetric;
    paceWithinSegment: RichMetric;
    emphasisAlignment: RichMetric;
    energyDrift: RichMetric;
  };
  
  // Language texture (if type includes 'prosody_language')
  languageTexture?: {
    sentenceCompression: RichMetric;
    humorTiming: RichMetric;
    audienceAddress: RichMetric;
    questionRate: RichMetric;
  };
  
  // Visual/edit (if type includes 'visual_edit')
  visualEdit?: {
    visualEntropy: RichMetric;
    cutRefinement: RichMetric;
    silenceSpans: RichMetric;
    beatEditAlignment: RichMetric;
  };
  
  // Narrative arc (if type includes 'narrative_arc')
  narrativeArc?: {
    segmentCohesion: RichMetric;
    openLoops: RichMetric;
    transitionClarity: RichMetric;
  };
  
  // Ending (if type includes 'ending')
  ending?: {
    endingResolution: RichMetric;
    openLoopsResolved: RichMetric;
    ctaClarity: RichMetric;
    emotionalLanding: RichMetric;
  };
}
```

### Tier 3: Derived Scores Types

```typescript
interface MetaAxes {
  voiceIntensity: number;
  conceptualDepth: number;
  narrativeStructureStrength: number;
  visualDynamism: number;
  productionPolish: number;
}

interface AlignmentScores {
  audioVisualAlignment: number;
  beatsEditsAlignment: number;
  prosodySemanticAlignment: number;
  overallAlignment: number;
  observed: boolean;
}

interface BalanceScores {
  redundancyScore: number;
  complementarityScore: number;
  overRelianceScore: number;
  overallBalance: number;
  observed: boolean;
}

interface CognitiveLoadSummary {
  averageLoad: number;
  peakLoad: number;
  loadVariance: number;
  overloadMomentCount: number;
  observed: boolean;
}

interface SecondOrderScores {
  alignmentScore: number;
  driftScore: number;
  decayScore: number;
  balanceScore: number;
  timingScore: number;
  observed: boolean;
}
```

---

## Migration Strategy

### Phase 1: Parallel Schemas

1. Keep v1.3.0 as primary
2. Add v2.0.0 types alongside
3. New analyses generate both formats
4. UI continues to read v1.3.0

```typescript
// src/lib/schemas/fingerprintV2.ts
import { z } from 'zod';

export const FINGERPRINT_SCHEMA_VERSION_V2 = '2.0.0';

// ... all v2 zod schemas
```

### Phase 2: Migration Functions

```typescript
// src/lib/schemas/fingerprintMigration.ts

/**
 * Upgrade v1.3.0 fingerprint to v2.0.0 structure
 * Used for viewing old analyses in new UI
 */
export function upgradeV130ToV200(
  legacy: VideoFingerprintJson
): VideoFingerprintJson_v2 {
  
  // Build skeleton from legacy beats
  const skeleton = buildSkeletonFromLegacy(legacy);
  
  // Convert flat metrics to core structure
  const coreMetrics = buildCoreFromLegacy(legacy, skeleton);
  
  // Preserve advanced metrics (already in similar structure)
  const advancedMetrics = buildAdvancedFromLegacy(legacy, skeleton);
  
  // Recompute derived scores
  const derivedScores = computeDerivedScores(coreMetrics, advancedMetrics);
  
  // Build legacy compat layer
  const perDomain = buildPerDomainFromCore(coreMetrics);
  
  return {
    version: '2.0.0',
    schemaHash: computeSchemaHash(),
    createdAt: legacy.createdAt,
    skeleton,
    coreMetrics,
    advancedMetrics,
    derivedScores,
    perDomain,
    performanceProfile: legacy.performanceProfile,
    hasPerformanceData: legacy.hasPerformanceData ?? false,
    diagnostics: {
      migratedFrom: '1.3.0',
      migrationDate: new Date().toISOString(),
    },
  };
}

/**
 * Downgrade v2.0.0 to v1.3.0 for legacy UI
 * Used during transition period
 */
export function downgradeV200ToV130(
  modern: VideoFingerprintJson_v2
): VideoFingerprintJson {
  
  // Flatten core metrics
  const flatMetrics = flattenCoreMetrics(modern.coreMetrics);
  
  // Convert skeleton chapters to beats
  const beats = buildBeatsFromSkeleton(modern.skeleton);
  
  // Rebuild legacy advanced structure
  const legacyAdvanced = buildLegacyAdvanced(modern.advancedMetrics);
  
  return {
    version: '1.3.0',
    createdAt: modern.createdAt,
    metaAxes: modern.derivedScores.metaAxes,
    perDomain: modern.perDomain,
    overallArchetype: deriveArchetype(modern.derivedScores.metaAxes),
    supporting: {
      beats,
      axisDetails: buildAxisDetails(modern),
    },
    ...legacyAdvanced,
    performanceProfile: modern.performanceProfile,
    hasPerformanceData: modern.hasPerformanceData,
  };
}
```

### Phase 3: Validation

```typescript
// src/lib/schemas/fingerprintV2.ts

export function validateFingerprintV2(json: unknown): VideoFingerprintJson_v2 {
  // Try v2 first
  const v2Result = fingerprintSchemaV2.safeParse(json);
  if (v2Result.success) {
    return v2Result.data;
  }
  
  // Try v1.3 and upgrade
  const v1Result = fingerprintSchema.safeParse(json);
  if (v1Result.success) {
    return upgradeV130ToV200(v1Result.data);
  }
  
  // Try earlier versions
  const legacyResult = legacyFingerprintSchema.safeParse(json);
  if (legacyResult.success) {
    const v1 = upgradeLegacyToV130(legacyResult.data);
    return upgradeV130ToV200(v1);
  }
  
  throw new Error(`Invalid fingerprint: ${v2Result.error.message}`);
}
```

### Phase 4: Database Migration

```sql
-- Add new columns for v2 data
ALTER TABLE VideoFingerprint ADD COLUMN fingerprint_v2 TEXT;
ALTER TABLE VideoFingerprint ADD COLUMN schema_version VARCHAR(10) DEFAULT '1.3.0';

-- Index for quick version filtering
CREATE INDEX idx_fingerprint_version ON VideoFingerprint(schema_version);
```

```typescript
// Prisma schema update
model VideoFingerprint {
  id              String   @id @default(cuid())
  videoAnalysisId String   @unique
  fingerprint     String   // v1.3.0 format (JSON)
  fingerprintV2   String?  // v2.0.0 format (JSON), nullable during transition
  schemaVersion   String   @default("1.3.0")
  createdAt       DateTime @default(now())
  
  videoAnalysis   VideoAnalysis @relation(fields: [videoAnalysisId], references: [id])
}
```

### Phase 5: API Changes

```typescript
// GET /api/analysis/:id
interface AnalysisResponse {
  // Always present
  fingerprint: VideoFingerprintJson_v2;
  
  // Legacy format (deprecated, remove in v3)
  legacyFingerprint?: VideoFingerprintJson;
  
  // Version info
  schemaVersion: '2.0.0';
  
  // Analysis metadata
  analysisId: string;
  videoId: string;
  status: 'complete' | 'partial' | 'failed';
}
```

---

## Backward Compatibility

### UI Components

Components need to handle both formats during transition:

```typescript
// src/lib/analysis/fingerprintAdapter.ts

export function adaptFingerprint(
  raw: unknown
): NormalizedFingerprint {
  // Detect version
  const version = detectVersion(raw);
  
  if (version === '2.0.0') {
    return normalizeV2(raw as VideoFingerprintJson_v2);
  }
  
  if (version === '1.3.0') {
    const upgraded = upgradeV130ToV200(raw as VideoFingerprintJson);
    return normalizeV2(upgraded);
  }
  
  throw new Error(`Unsupported fingerprint version: ${version}`);
}

interface NormalizedFingerprint {
  // Unified interface for UI
  skeleton: VideoSkeleton;
  coreScores: Record<string, Record<string, number>>;
  advancedAvailable: boolean;
  advancedScores?: Record<string, Record<string, RichMetric>>;
  derivedScores: DerivedScores;
  
  // For radar charts
  radarData: {
    meta: number[];
    voice: number[];
    language: number[];
    narrative: number[];
    visual: number[];
    sound: number[];
  };
}
```

### Feature Flags

```typescript
// src/lib/config.ts

export interface AppConfig {
  // Schema version to use for new analyses
  fingerprintSchemaVersion: '1.3.0' | '2.0.0';
  
  // Generate both versions for comparison
  generateDualSchema: boolean;
  
  // UI to use
  uiVersion: 'v1' | 'v2';
}
```

---

## Rollback Plan

If v2.0.0 causes issues:

1. **Immediate**: Set `fingerprintSchemaVersion: '1.3.0'` in config
2. **Short-term**: UI falls back to `legacyFingerprint` if present
3. **Long-term**: Keep v1.3.0 codepath for 2 releases

```typescript
// Emergency rollback
export function getFingerprint(analysis: VideoAnalysis): VideoFingerprintJson {
  const config = getAppConfig();
  
  if (config.fingerprintSchemaVersion === '1.3.0') {
    // Direct v1.3.0
    return JSON.parse(analysis.fingerprint);
  }
  
  if (analysis.fingerprintV2) {
    try {
      const v2 = JSON.parse(analysis.fingerprintV2);
      if (config.uiVersion === 'v1') {
        return downgradeV200ToV130(v2);
      }
      return v2;
    } catch {
      // Fallback to v1
      return JSON.parse(analysis.fingerprint);
    }
  }
  
  return JSON.parse(analysis.fingerprint);
}
```

---

## Testing Migration

### Unit Tests

```typescript
// src/lib/schemas/fingerprintMigration.test.ts

describe('fingerprint migration', () => {
  describe('upgradeV130ToV200', () => {
    it('preserves all core metric scores', () => {
      const legacy = loadFixture('v1.3.0/complete.json');
      const upgraded = upgradeV130ToV200(legacy);
      
      // Voice scores should match
      expect(upgraded.coreMetrics.aggregated.voice.speakingRate.score)
        .toBe(legacy.perDomain.voiceProfile.scores.find(s => s.key === 'speaking_rate')?.value);
    });
    
    it('builds skeleton from beats', () => {
      const legacy = loadFixture('v1.3.0/with-beats.json');
      const upgraded = upgradeV130ToV200(legacy);
      
      expect(upgraded.skeleton.chapters.length).toBeGreaterThan(0);
      expect(upgraded.skeleton.keyMoments.length).toBeGreaterThan(0);
    });
    
    it('handles missing advanced metrics', () => {
      const legacy = loadFixture('v1.3.0/core-only.json');
      const upgraded = upgradeV130ToV200(legacy);
      
      expect(upgraded.advancedMetrics).toBeUndefined();
      expect(upgraded.derivedScores.alignment.observed).toBe(false);
    });
  });
  
  describe('downgradeV200ToV130', () => {
    it('round-trips without data loss', () => {
      const original = loadFixture('v1.3.0/complete.json');
      const upgraded = upgradeV130ToV200(original);
      const downgraded = downgradeV200ToV130(upgraded);
      
      // Core scores should survive round-trip
      expect(downgraded.perDomain.voiceProfile.scores)
        .toEqual(original.perDomain.voiceProfile.scores);
    });
  });
});
```

### Golden Set Validation

```typescript
// scripts/validate-migration.ts

async function validateMigration() {
  const goldenSet = loadGoldenSet();
  const results: ValidationResult[] = [];
  
  for (const video of goldenSet.videos) {
    // Load v1.3.0 analysis
    const v1 = await loadAnalysis(video.id);
    
    // Upgrade to v2.0.0
    const v2 = upgradeV130ToV200(v1.fingerprint);
    
    // Compare key metrics
    results.push({
      videoId: video.id,
      metaAxesDrift: compareMetaAxes(v1.fingerprint.metaAxes, v2.derivedScores.metaAxes),
      coreScoresDrift: compareCoreScores(v1.fingerprint.perDomain, v2.coreMetrics.aggregated),
      advancedPreserved: checkAdvancedPreserved(v1.fingerprint, v2.advancedMetrics),
    });
  }
  
  // Report
  const failed = results.filter(r => 
    r.metaAxesDrift > 5 || r.coreScoresDrift > 10 || !r.advancedPreserved
  );
  
  if (failed.length > 0) {
    console.error('Migration validation FAILED:', failed);
    process.exit(1);
  }
  
  console.log('Migration validation PASSED');
}
```

---

## Timeline

| Week | Task | Deliverable |
|------|------|-------------|
| 1 | Define v2 types | `src/lib/types/fingerprintV2.ts` |
| 1 | Zod schemas | `src/lib/schemas/fingerprintV2.ts` |
| 2 | Migration functions | `src/lib/schemas/fingerprintMigration.ts` |
| 2 | Unit tests | Migration test suite |
| 3 | Database migration | Prisma schema + migration |
| 3 | API updates | Dual-format endpoints |
| 4 | UI adapter | `fingerprintAdapter.ts` |
| 4 | Golden set validation | `validate-migration.ts` |
| 5 | Feature flag rollout | Gradual v2 enablement |
| 6 | Deprecate v1 generation | v2-only for new analyses |
