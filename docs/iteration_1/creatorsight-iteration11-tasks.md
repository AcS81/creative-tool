# CreatorSight - Iteration 11 Implementation Tasks (Contract + Reliability Hardening)

## Document Information
- Product: CreatorSight
- Iteration: 11 - Contract + Reliability Hardening (Local-only)
- Version: 1.0
- Status: Ready for implementation
- Target Outcome:
  - Fingerprint is a versioned API with enforced schema alignment and migrations.
  - Long-running Gemini/YouTube analyses survive restarts and resume safely.
  - Golden-set evals gate schema changes before new metrics ship.

> This iteration is about trust and durability. It does not add new metrics. It makes the existing brain (Gemini + YouTube) safe to evolve.

---

## High-level Scope for Iteration 11

This iteration focuses on:
- Contract alignment: schema, types, and defaults never drift.
- Versioned fingerprint API: migrations and schema hashes are enforced.
- Golden-set evaluation gating for schema changes.
- Long-running analysis reliability (durable jobs + resumable stages).

Out of scope:
- New metrics or new UI features.
- Cloud deployment or multi-user auth.
- New integrations beyond Gemini/YouTube.

---

## Phase 0: Contract Baseline

### Task 0.1: Canonical Fingerprint Contract

**Context**
- The fingerprint contract currently exists in two places: TypeScript types and Zod schema.
- Drift is already visible (example: a metric required by types but missing in the schema).

**Goals**
- [x] Choose a single source of truth for the fingerprint contract (recommendation: Zod schema).
- [x] Centralize metric key lists in one module (reuse `ADVANCED_METRIC_SECTIONS`).
- [x] Build the fingerprint schema from those lists so new metrics cannot be added in only one place.
- [x] Add a contract parity test that fails when schema and key lists diverge.
- [x] Patch existing drift (e.g. missing `audienceAddressFrequency`).

**Constraints**
- Keep the solution local-only (no external codegen required).
- Prefer a runtime parity test over a build-step dependency if possible.

**Acceptance Criteria**
- [x] Fingerprint schema uses the centralized metric lists.
- [x] A parity test fails if any metric is missing or extra.
- [x] Current missing fields are fixed and covered by the test.

---

### Task 0.2: Schema Version + Schema Hash

**Context**
- The app has `version` in the fingerprint, but schema changes are not enforced in cache or storage.

**Goals**
- [x] Define `FINGERPRINT_SCHEMA_VERSION` (bump on any contract change).
- [x] Compute `FINGERPRINT_SCHEMA_HASH` from version + metric lists.
- [x] Store schema version/hash per analysis and include them in `analysisConfigSignature`.
- [x] Reject or migrate fingerprints with mismatched schema hash.

**Acceptance Criteria**
- [x] `analysisConfigSignature` changes whenever the fingerprint contract changes.
- [x] Cached results never cross schema boundaries.

---

## Phase 1: Versioned Migration Pipeline

### Task 1.1: Upgrade Functions for Legacy Fingerprints

**Context**
- Legacy fingerprints must remain readable after contract changes.

**Goals**
- [x] Make each schema version upgrade explicit (`v1.2` -> `v1.3`, `v1.3` -> `v1.4`, etc).
- [x] Use `buildDefaultAdvancedMetrics` to backfill new fields.
- [x] Store upgrade logic in a single place (`src/lib/schemas/fingerprint.ts`).

**Acceptance Criteria**
- [x] Fixtures for each version load and upgrade to the latest schema.
- [x] `validateFingerprint` always returns the newest schema version.

---

### Task 1.2: Strict Load Path

**Context**
- If a fingerprint is incompatible, it should fail loudly and explain why.

**Goals**
- [x] On load, validate schema version + hash.
- [x] If incompatible, return a clear error state to the UI (and include it in diagnostics).
- [x] Ensure `hasPerformanceData` remains correct after upgrade.

**Acceptance Criteria**
- [x] Incompatible fingerprints are not silently rendered.
- [x] Users see a friendly error that suggests re-running analysis.

---

## Phase 2: Golden-set Gating

### Task 2.1: Golden-set Baselines Per Schema Version

**Context**
- The golden set exists, but it is not tied to schema version or gating.

**Goals**
- [x] Extend `scripts/run-multimodal-golden.ts` to emit a compact summary (hash + key stats).
- [x] Store a baseline file keyed by schema version (ex: `scripts/golden-set.baseline.v1.3.json`).
- [x] Add a comparison script that fails on schema mismatch or out-of-bounds regressions.

**Constraints**
- Keep private URLs in `scripts/golden-set.json` (local-only).
- Use `scripts/golden-set.sample.json` for non-sensitive examples.

**Acceptance Criteria**
- [x] `npm run eval:golden` fails if contract drift or regressions appear.
- [x] Baseline files exist for the current schema version.

---

### Task 2.2: Contract Change Checklist

**Context**
- Schema changes need a predictable process or drift will creep back.

**Goals**
- [x] Add a short checklist doc (ex: `docs/contract_change_checklist.md`).
- [x] Checklist includes: bump schema version, update schema hash, migrate legacy, update golden baseline.

**Acceptance Criteria**
- [x] Every schema change is paired with a checklist update and a fresh golden baseline.

---

## Phase 3: Long-running Analysis Reliability

### Task 3.1: Durable Worker Loop

**Context**
- Current job execution uses `setTimeout` inside the API process, which dies on restart.

**Goals**
- [x] Add a local worker loop (ex: `scripts/analysis-worker.ts`) that polls SQLite for jobs.
- [x] Add lease fields to `VideoAnalysis` (lease owner, lease expiry, heartbeat).
- [x] Implement atomic job claim + lease extension.
- [x] Add scripts: `npm run worker` and `npm run dev:all` (Next + worker).

**Constraints**
- No external queue. Keep it local and file-based.

**Acceptance Criteria**
- [x] Restarting the server does not lose active jobs.
- [x] Stale jobs are reclaimed after lease expiry.

---

### Task 3.2: Stage Persistence and Resume

**Context**
- Gemini runs can take 20-40 minutes; failures should not waste completed steps.

**Goals**
- [x] Add stage fields (ex: `analysisStage`, `stageStartedAt`, `stageCompletedAt`).
- [x] Persist intermediate payloads (ingestion, core metrics, advanced metrics).
- [x] On retry, resume from the last completed stage if schema/config hashes match.

**Acceptance Criteria**
- [x] A crashed run resumes without repeating already completed stages.
- [x] A schema/config change forces a full rerun.

---

### Task 3.3: User-facing Progress

**Context**
- Long runs need clear status to feel trustworthy.

**Goals**
- [x] Surface stage name and last heartbeat in the UI.
- [x] Provide a retry or resume action if a job stalls.

**Acceptance Criteria**
- [x] Users can see which stage is active and whether it is stalled.

---

## Phase 4: Tests and Docs

### Task 4.1: Contract and Worker Tests

**Goals**
- [x] Add a contract parity test for schema keys.
- [x] Add tests for lease claiming and resume logic.

**Acceptance Criteria**
- [x] Tests fail on contract drift or broken job recovery.

---

### Task 4.2: Docs Updates

**Goals**
- [x] Add a short `docs/iteration_11_e2e.md` with: start Next, start worker, run analysis, restart worker mid-run, resume successfully.
- [x] Update `README.md` to explain the local worker requirement.

**Acceptance Criteria**
- [x] A new contributor can run the app locally with durable jobs in under 10 minutes.

---

## Phase Transition Checklist (Iteration 11)

### Contract Reliability
- [x] Schema version and hash are enforced in cache + load paths.
- [x] Zod schema and metric lists are guaranteed to match.

### Golden-set Gating
- [x] Golden-set baselines exist for the current schema version.
- [x] Schema changes fail without updated baselines.

### Job Reliability
- [x] Worker loop claims and resumes jobs reliably.
- [x] Stalled jobs are re-queued safely.

---

## Summary

Iteration 11 converts the fingerprint into a stable, versioned API and makes long Gemini runs durable. It is the reliability layer that lets you add new metrics later without breaking trust or history.
