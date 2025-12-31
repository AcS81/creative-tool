# CreatorSight – Final Boss Roadmap (Reliable Multimodal + “All Bells” Product)

## Document Information
- **Product**: CreatorSight
- **Document Type**: Master plan / roadmap (implementation-oriented)
- **Version**: 1.0
- **Status**: Draft (living document)
- **Target Outcome**: A production-grade CreatorSight that reliably delivers **high-coverage, high-trust** creative analysis for YouTube URLs, with polished UX, reference comparisons, optional performance overlays, and operational confidence (cost, latency, monitoring, regression safety).

> This roadmap complements `prd.md` (what we’re building) and the iteration task docs in `docs/` (how we’ve been executing). It focuses on the remaining work to reach a “boss” version that behaves predictably in the real world.

---

## 0) Executive Summary (What Must Change)

**Current functional failure mode**
- The Gemini call now returns `200 OK`, but many metrics come back as `"unobserved"` (empty-looking UI) because we overload a single multimodal request.

**Root cause**
- We ask one model to produce 50+ interdependent measurements, timelines, and derived scores in one pass, and we explicitly instruct it to avoid guessing.

**Strategy**
- Move from **single-pass “everything”** to a **staged analysis engine**:
  - Core metrics first (high coverage).
  - Advanced sections in focused passes.
  - Deterministic server-side derivations (reduce model burden).
  - Salvage retries for the specific sections that came back unobserved.

**Definition of “works properly”**
- Not “no crashes,” but: coverage, trust, and consistent behavior under real variance (video types, model load, entitlement failures).

---

## 1) Success Criteria (Non-Negotiables)

### 1.1 Quality & Coverage
- **Core coverage**: On the golden set, at least **80%** of *base-domain* metrics are `observed` (not `"unobserved"` and not `score=0`).
- **Advanced coverage**: On the golden set, at least **60%** of advanced metrics are `observed` *in paid/full mode*, with per-section diagnostics.
- **No silent emptiness**: If a metric is unobserved, the UI must show “Not observed” and the diagnostics must indicate *why* (capacity, entitlement fallback, safety block, etc.).

### 1.2 Reliability & Performance
- **Latency budgets (target)**:
  - Core results: p95 < **30s** (or “job accepted” in async mode).
  - Full results (core + advanced): p95 < **90s** (budget depends on pass count and model).
- **Error budgets**:
  - Analysis request hard failure rate < **1%** on the golden set.
  - Retry success rate > **50%** when triggered by high-unobserved sections.

### 1.3 Cost & Control
- **Cost**: Average analysis cost within PRD target (< **$0.50–$1.00**), achieved via:
  - Tiering (core vs advanced),
  - Skipping advanced passes when not requested,
  - Smaller models for narrow passes (when acceptable),
  - Avoiding redundant work via caching.

---

## 2) Current State Snapshot (Repo Reality)

### 2.1 What Exists Today
- **Single multimodal pass**: `src/lib/analysis/geminiMultimodalAnalyzer.ts` requests base + `advanced_metrics` together.
- **Diagnostics already exist**:
  - `unobservedCounts` for base domains,
  - advanced metrics defaulting + observed detection in `src/lib/analysis/service.ts`.
- **Dev tools**:
  - `/dev/multimodal`: `src/app/dev/multimodal/page.tsx` (shows fallback + unobserved counts),
  - `scripts/probe-multimodal-ingestion.ts` (ingestion + unobserved summaries),
  - `scripts/run-multimodal-golden.ts` + `docs/multimodal_golden_set.md` (manual regression helper).

### 2.2 Known Footguns to Fix
- **Schema mismatch**: Gemini request JSON schema currently requires `advanced_metrics`, but the validator treats it as optional. This encourages overload and “unobserved everywhere.”
- **Metric-key drift**: Some keys are referenced downstream (e.g., additional language axes) without being requested in the prompt/schema, guaranteeing “missing/unobserved” and muddying diagnostics.

---

## 3) Key Decisions (Make These Explicit)

### Decision A — Media ingestion fallback when `file_data` fails
Choose (and document) one:
- **A1. Require `file_data` entitlement** and fail fast with a clear message if unavailable (simplest; lowest compliance risk; highest product friction).
- **A2. Text-only fallback** (captions/transcript only) that returns a *partial* fingerprint (voice/language/narrative) and explicitly marks visual/edit/sound metrics as not observed.
- **A3. Ephemeral media download + temp upload** (most reliable, highest complexity/compliance risk; must be vetted against YouTube terms and internal policies).
- **A4. User upload fallback** (adds UX complexity; avoids YouTube download but changes product).

**Decision**: A2 as the “always works” baseline + A1 primary.
**Notes**: Keep a clear, user-facing error when entitlement is missing; avoid partial confusion.

### Decision B — Tiering (cost control)
- **Free**: core pass only (fast, meaningful).
- **Paid / Pro**: advanced passes + deeper coaching + storage/history.
**Decision**: Defer tiering until reliability is solid; keep all features available during stabilization.
### Decision C — Synchronous vs async analysis
- **Sync** (current): simpler but fragile at scale and with multi-pass.
- **Async**: `/api/analyze` creates a job, returns quickly, client polls/streams progress.
**Decision**: Async for production hardening; keep sync for dev and early testing.



---

## 4) Roadmap Phases (Implementation Plan)

## Phase 0 — Lock Contracts + Instrument Reality (Fast, High-Leverage)

### Task 0.1: Align metric keys end-to-end
**Goals**
- [x] Create a single source of truth for metric keys per domain/pass.
- [x] Remove references to metrics that are not requested anywhere (or explicitly add them to a pass).
- [x] Ensure UI components only expect what the analyzer can actually emit.

**Acceptance Criteria**
- [x] No “phantom” axes show up as unobserved just because they’re never requested.
- [x] The analyzer prompt/schema, validator, and UI agree on the same set of keys.

### Task 0.2: Make `advanced_metrics` optional in the Gemini request schema
**Goals**
- [x] Update the Gemini request JSON schema so `advanced_metrics` is optional or removed from the core pass.

**Acceptance Criteria**
- [x] Core analysis can succeed without advanced metrics.
- [x] Advanced metrics can be added via subsequent passes.

### Task 0.3: Store and surface coverage diagnostics
**Goals**
- [x] Add per-pass and per-section coverage stats:
  - observed count / total count,
  - which metrics are missing/unobserved,
  - whether salvage retry ran.

**Acceptance Criteria**
- [x] Dev UI and API response can display “why this feels empty” with specific counts and reasons.

---

## Phase 1 — Analysis Engine v3: Staged Multimodal (Fix the Actual Problem)

### Task 1.1: Split the multimodal analysis into focused passes
**Proposed passes**
- [ ] **Pass 1 (Core)**: base domains + beats/devices (no `advanced_metrics`).
- [ ] **Pass 2 (Advanced: Audio/Text)**: prosodyArc + languageTexture + narrativeArc.
- [ ] **Pass 3 (Advanced: Visual/Cross)**: visualEditAlignment + modalityBalance + cognitiveLoad.
- [ ] **Pass 2b (Supplemental nuance)**: warmth + sentiment + directive density + self-disclosure + sarcasm/irony (text-heavy, optional).

**Acceptance Criteria**
- [ ] Core pass alone yields a “non-empty” report on the golden set.
- [ ] Advanced passes materially increase coverage without tanking core reliability.

### Task 1.2: Salvage retries for high-unobserved sections
**Goals**
- [ ] If a pass returns >X% unobserved metrics, re-run *only that section* with a narrower prompt/schema.

**Acceptance Criteria**
- [ ] Salvage improves coverage on at least 50% of the “bad” golden runs (track this).

### Task 1.3: Derive second-order scores server-side (reduce model load)
**Goals**
- [ ] Stop asking Gemini to output second-order properties directly (Alignment/Drift/Decay/Balance/Timing).
- [ ] Compute second-order scores deterministically from observed advanced metrics.

**Acceptance Criteria**
- [ ] Second-order values are stable across retries and correlate with underlying signals.
- [ ] Missing components produce `observed=false` second-order outputs (no hallucinated summaries).

### Task 1.4: Add pass-level feature flags + tier gating
**Goals**
- [ ] Add config that selects:
  - core-only,
  - core+advanced,
  - which model per pass (optional).

**Acceptance Criteria**
- [ ] A “core-only” run is always available and fast.
- [ ] A “full” run is gated and cost-controlled.

---

## Phase 2 — Ingestion Reliability (So Videos Actually Get Seen)

### Task 2.1: Preflight entitlement & content-type checks
**Goals**
- [ ] Preflight the YouTube URL for:
  - validity,
  - whether `file_data` path is available,
  - whether fallback (if chosen) is viable.

**Acceptance Criteria**
- [ ] No confusing runs where “media wasn’t actually ingested” but the UI blames the model.

### Task 2.2: Implement chosen fallback strategy (Decision A)
Pick one path and execute it fully with diagnostics:
- [ ] A1 entitlement-required (clear error UX)
- [ ] A2 transcript-only partial analysis
- [ ] A3 ephemeral media download + temp upload (compliance reviewed)
- [ ] A4 user upload fallback

**Acceptance Criteria**
- [ ] If multimodal ingestion fails, we still return *something* valuable or a crisp failure message.

---

## Phase 3 — Evaluation Harness (So We Know It Works)

### Task 3.1: Expand and formalize the golden set
**Goals**
- [ ] Replace `REPLACE_*` placeholders with real canonical clips (private list allowed).
- [ ] Encode expectations per clip (hook time, music coverage, entropy timeline presence, etc.).

**Acceptance Criteria**
- [ ] Running the golden set produces a clear pass/fail summary with coverage deltas.

### Task 3.2: Add CI-friendly “mocked golden” regressions
**Goals**
- [ ] Add tests that validate parsing, merging, and coverage math with mocked Gemini payloads.

**Acceptance Criteria**
- [ ] Multi-pass merge logic has unit tests that prevent regressions.

### Task 3.3: Track coverage, latency, and cost per pass
**Goals**
- [ ] Capture:
  - wall time per pass,
  - retries,
  - token usage (if available),
  - estimated cost per run.

**Acceptance Criteria**
- [ ] We can answer “what did this analysis cost and why” for any run.

---

## Phase 4 — UX: Trust, Clarity, and “Boss” Presentation

### Task 4.1: Make emptiness impossible to misinterpret
**Goals**
- [ ] When metrics are unobserved, show:
  - “Not observed” chips,
  - a short reason (insufficient signal, ingestion fallback, safety block, etc.),
  - and a “try again / run advanced” action when relevant.

**Acceptance Criteria**
- [ ] Users never confuse “unobserved” with “broken,” and they know what to do next.

### Task 4.2: Progressive results & loading states
**Goals**
- [ ] If async mode exists, stream core results first and append advanced results.
- [ ] If sync mode remains, show meaningful progress states.

**Acceptance Criteria**
- [ ] A user sees value quickly even when advanced passes take longer.

### Task 4.3: Coaching that never references missing data
**Goals**
- [ ] Coaching rules only fire when underlying metrics are observed.
- [ ] When not observed, show alternate guidance (“capture better audio”, “video too static”, etc.).

**Acceptance Criteria**
- [ ] No advice bullets derived from placeholder defaults or unobserved metrics.

---

## Phase 5 — Reference Library “Boss Mode”

### Task 5.1: Scale reference ingestion and refresh
**Goals**
- [ ] Add a repeatable pipeline to:
  - seed reference creators,
  - refresh fingerprints periodically,
  - detect drift between model versions.

**Acceptance Criteria**
- [ ] Reference results remain stable and explainable across upgrades.

### Task 5.2: Similarity quality improvements
**Goals**
- [ ] Improve similarity using:
  - normalized axes,
  - per-domain weighting,
  - confidence-aware similarity (don’t compare missing signals).

**Acceptance Criteria**
- [ ] “Closest neighbours” feels consistent on the golden set and internal spot checks.

---

## Phase 6 — Production Hardening & Launch Readiness

### Task 6.1: Async analysis jobs with retries and idempotency
**Goals**
- [ ] `/api/analyze` returns a job ID quickly.
- [ ] Background worker runs staged passes with retry policies.
- [ ] Job status visible to client (pending/running/complete/failed).

**Acceptance Criteria**
- [ ] No request timeouts for long videos; retries don’t duplicate DB rows.

### Task 6.2: Caching + rate limiting + quotas
**Goals**
- [ ] Cache results by video ID + analysis version + config flags.
- [ ] Add basic abuse protection (rate limits, per-session quotas).

**Acceptance Criteria**
- [ ] Re-analyzing the same URL is fast and cheap.

### Task 6.3: Observability (logs, traces, alerts)
**Goals**
- [ ] Emit structured logs for:
  - ingestion path,
  - pass outcomes,
  - coverage,
  - retries,
  - safety blocks.

**Acceptance Criteria**
- [ ] You can debug “why this run was empty” from logs alone.

---

## 5) Stretch Goals (“All Bells”)

These are optional until Phases 0–6 are solid.

- [ ] **Channel-level profile**: aggregate last N videos into a stable creator fingerprint.
- [ ] **Export/share**: shareable report links; PDF export for paid tier.
- [ ] **Experiments**: “Try this next video” A/B suggestions tied to observed weaknesses.
- [ ] **Uploads**: user-provided video upload for non-YouTube sources or restricted videos.
- [ ] **Teams**: agencies, shared libraries, multi-seat collaboration.

---

## 6) “Boss Version” Release Checklist (Gating)

- [ ] Golden set passes at target coverage thresholds (core + advanced).
- [ ] Unobserved-heavy runs always explain themselves (UI + diagnostics).
- [ ] End-to-end flows documented in `docs/iteration_*_e2e.md` and up to date.
- [ ] Cost and latency budgets measured and within targets.
- [ ] Clear fallback behavior for ingestion entitlement failures.
- [ ] No schema drift: `validateFingerprint` passes for all new analyses.

---

## 7) Appendix: Useful Reference Docs (Repo)
- `prd.md` (product scope)
- `analysis_functionality_plan.md` (multimodal ingestion notes)
- `docs/iteration_9_gap_matrix.md` (advanced metric semantics + acceptance thresholds)
- `docs/multimodal_golden_set.md` (regression runner expectations)
- `docs/axes_and_domains.md` (glossary; “unobserved” semantics)
