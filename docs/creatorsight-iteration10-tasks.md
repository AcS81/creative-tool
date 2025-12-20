# CreatorSight – Iteration 10 Implementation Tasks (User Presentation & Coaching of Advanced Signals)

## Document Information
- **Product**: CreatorSight
- **Iteration**: 10 – Advanced Signal Presentation & Actionable Coaching (post-Iteration 8 UI uplift)
- **Version**: 1.0
- **Status**: Draft – starts after Iteration 9 signal coverage lands
- **Target Outcome**: Surface the remaining hidden factors from `todo.md` with clear visuals and coaching. Focus on data-only signals (language texture ratios/compression/reference density, prosody/energy details, visual entropy/cut refinement, redundancy/complementarity, second-order summaries, audience-address) while keeping the Iteration 8 wins (pace/humor/silence timelines, alignment/load panel) intact.

> Scope: Turn the upgraded metrics into a polished, comprehensible experience without redoing the Iteration 8 surfaces. Keep schema intact; focus on presentation, navigation, and clarity for the signals that are still invisible to users.

---

## High-level Outcomes
- Overview and domain tabs surface the still-hidden advanced signals: language texture ratios/compression/reference density, prosody/energy timelines (emphasis alignment, energy drift), visual entropy + cut refinement, redundancy/complementarity, second-order summary row, and the audience-address metric.
- Cross-modal alignment and cognitive load visuals from Iteration 8 remain; add glossary tooltips and badges for the new surfaces.
- Coaching bullets tie second-order scores (Alignment/Drift/Decay/Balance/Timing) to actionable guidance; no references to missing data.
- Mobile/desktop layouts handle dense data with collapsible sections and clear empty/fallback states.

---

## Phase 0: UX Narrative & IA
- [x] Design a concise “Advanced signals” narrative for the remaining hidden data: language texture, prosody/energy, visual entropy/cut refinement, modality balance, second-order summaries, audience-address.
- [x] IA update: anchors/sections to jump directly to these widgets; keep existing pace/humor/silence/alignment UI unchanged.
- [x] Glossary/tooltips plan that reuses `docs/axes_and_domains.md` entries; avoid duplicating copy.

---

## Phase 1: Overview Surfaces
- [x] Add a multi-lane strip for the still-hidden metrics:
  - Energy drift trend (prosody).
  - Visual entropy strip with spikes.
  - Cut-rate refinement summary (median/variance/beat coupling).
  - Redundancy/complementarity proportions badge.
  - Audience-address frequency badge (you/we per minute; rhetorical vs direct).
- [x] Second-order summary row: Alignment/Drift/Decay/Balance/Timing with short labels, hover hints, and “not observed” states.
- [x] Keep existing Alignment & Load panel; add glossary tooltips and links where missing.

---

## Phase 2: Domain Tabs – Deep Exposure

### Voice/Delivery
- [ ] Add energy-drift and emphasis-alignment badges; keep existing pace mini-chart.
- [ ] Audience-address frequency badge (you/we per minute, rhetorical vs direct) with short interpretation.
- [ ] Keep humor timing/question mix widget; add prosody vs semantic importance note if observed.

### Language
- [ ] Visualize analogy/example/definition ratios (stacked bar) and sentence compression distribution.
- [ ] Reference density per minute with type legend; keep metaphor density/concreteness tooltips.

### Narrative
- [ ] Open-loop resolution list and segment cohesion drift mini-chart; keep time-to-hook/hook strength callout.
- [ ] Mini-arc bar remains; add drift flag when high.

### Visual/Edit
- [ ] Visual entropy strip with spike annotations; cut-rate refinement card (median/variance/beat coupling).
- [ ] Keep silence spans overlay; add beat-aligned labels if present.

### Sound/Performance
- [ ] Add redundancy/complementarity badge to show mix of audio/visual/text signals.
- [ ] Keep alignment note and silence fidelity badge; performance tab stays as refreshed in Iteration 8.

---

## Phase 3: Coaching & Copy
- [ ] Generate actionable insights that map second-order scores to guidance (e.g., “Low balance: redundancy high—add complementary visuals”).
- [ ] Add microcopy beside each new chart explaining what “good” looks like (pull from metric semantics docs).
- [ ] Guardrails: never show advice when metrics are unobserved; display a friendly “Not observed” chip instead.

---

## Phase 4: Responsiveness, States, and Accessibility
- [ ] Collapsible sections for dense timelines on mobile; preserve hover data via tap-to-focus.
- [ ] Empty/fallback states per new widget (entropy timeline missing, cut refinement missing, etc.) with reasons from diagnostics.
- [ ] ARIA/keyboard: ensure new charts and badges are keyboard-focusable with text alternatives; verify contrast.

---

## Phase 5: E2E & Regression
- [ ] Add `docs/iteration_10_e2e.md` with a checklist that walks through every new advanced surface on desktop and mobile (including mock mode).
- [ ] Update visual regression/screenshot set to cover the new advanced strips, entropy/cut refinement, language texture charts, and second-order summary row.
- [ ] Quick smoke script to assert UI renders when any advanced metric is unobserved (no crashes, clear messaging).

---

## Done When
- Users can see and interpret the remaining `todo.md` signals in the UI with clear labels, timelines/spans, and short coaching.
- Alignment/load/pace/arc/silence visuals from Iteration 8 stay intact; new entropy/cut, language texture, and balance surfaces render on desktop and mobile with graceful fallbacks.
- Insights and badges never reference missing data; diagnostics explain what was observed.
- E2E checklist and visual snapshots cover the new components; no regressions or dead states.
