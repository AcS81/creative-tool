# Iteration 4 Preflight (Baseline Check – Iterations 1–3)

This note captures the current state of the creative-only stack before adding the Performance/Analytics slice.

## Fingerprint shape (v1.1.0)
- Required fields: `version: "1.1.0"`, `createdAt` (ISO string with offset), `metaAxes`, `perDomain`.
- Meta axes (0–100): `voiceIntensity`, `conceptualDepth`, `narrativeStructureStrength`, `visualDynamism`, `productionPolish`. In Gemini mode they are derived from the average of domain score arrays (visual/production combine averages from visual+editing and editing+sound respectively) and clamped to 0–100.
- Per-domain profiles: `primaryArchetype`, optional `secondaryArchetype`, `summaryText`, `scores: Array<{ key; label; value 0–100 }>` and optional `highlights`.
- Optional extras: `overallArchetype` (derived heuristically from meta axes), `supporting.transcriptSegments`, `sceneSegments`, `beats` (all with `startSeconds`/`endSeconds`; beats include `label` and `devices`).
- No performance domain yet: there is no `performanceProfile` or `hasPerformanceData` flag; fingerprints that include those would currently fail validation.

## /api/analyze semantics (iterations 1–3)
- Request (POST JSON): `{ url: string, creatorDisplayName?: string, title?: string, durationSeconds?: number }`.
- Flow:
  - Validates URL via `parseYouTubeUrl`; returns `400 InvalidYouTubeUrl` if it fails.
  - Always fetches YouTube metadata via Data API (`fetchYoutubeMetadata`), which **requires `YOUTUBE_API_KEY` even in mock mode**. Metadata supplies title/channel/publish date/duration/thumbnail.
  - Looks up/creates a `CreatorProfile` (`type: "user"`) by `displayName` (fallback to channel title or “Local Anonymous”).
  - Creates a `VideoAnalysis` row with `status=pending`, then calls `analyzeVideo`:
    - `ANALYSIS_MODE=mock` (default) → deterministic mock fingerprint.
    - `ANALYSIS_MODE=gemini` → Gemini transcript+scene call, six domain calls, meta computation, heuristic overall archetype.
  - Persists `VideoFingerprint` JSON, updates `VideoAnalysis.status` to `complete`.
  - Reference data: loads all `CreatorProfile.type="reference"` analyses, parses fingerprints (skips invalid JSON), computes `nearestReferences` (Euclidean on meta axes, top 3) and `nicheAverageMetaAxes` (average of reference meta axes). `referenceMetaAxes` feeds insights.
  - Generates overview insights (`generateInsights`) and domain micro-insights (`generateDomainInsights`, best-effort).
- Success response includes:
  - `videoAnalysisId`, `fingerprint`, `overallArchetype`
  - `nearestReferences`, `nicheAverageMetaAxes`, `insights`, `insightDetails`, `domainInsights`
  - `metadata`: `{ title, channelTitle, publishedAt, durationSeconds, thumbnailUrl }`
- Errors:
  - Missing envs in Gemini mode → `500 { error: "MisconfiguredEnvironment", ... }`
  - Upstream Gemini/YouTube errors → `500 { error: "AnalysisFailed", message }` and `VideoAnalysis.status` set to `failed` with `failureReason`.
  - Generic fallback message if error is not typed.

## Known constraints / limitations to respect in Iteration 4
- Fingerprint validator enforces `version: "1.1.0"` and lacks a performance domain; adding `performanceProfile` will require schema/type changes (and possibly a version bump or optional fields).
- `/api/analyze` always calls YouTube Data API; running fully offline is not supported today despite mock analysis.
- Creator association is naive (deduped by displayName, not auth); `channelId` is unique, so re-creating a profile with the same channel but different display name will conflict.
- Pipeline is synchronous and blocking (no queue/polling); long Gemini runs can time out at the request layer.
- Similarity/insights use only meta axes; reference fingerprints with invalid JSON are silently skipped, and distance ignores domain-level nuance.
- Overall archetype is a simple heuristic on meta axes; domain archetypes come directly from Gemini/mock outputs without central taxonomy enforcement.
