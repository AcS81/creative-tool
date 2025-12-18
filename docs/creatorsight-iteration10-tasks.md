# CreatorSight – Iteration 10 Implementation Tasks (User Presentation & Coaching of Advanced Signals)

## Document Information
- **Product**: CreatorSight  
- **Iteration**: 10 – Advanced Signal Presentation & Actionable Coaching  
- **Version**: 1.0  
- **Status**: Draft – starts after Iteration 9 signal coverage lands  
- **Target Outcome**: Every factor from `todo.md` is visible, legible, and actionable in the UI. Users can see pacing, silence, arc, alignment, and language texture at a glance, with clear coaching and no hidden data.

> Scope: Turn the upgraded metrics into a polished, comprehensible experience. Add timelines, badges, and microcopy so users understand what the signals mean and how to act on them. Keep schema intact; focus on presentation, navigation, and clarity.

---

## High-level Outcomes
- Overview and domain tabs surface all advanced signals (pace mean/variance/drift, emphasis alignment, energy drift, audience address, analogies/examples/definitions, humor timing, question mix, reference density, time-to-hook/arc health, silence fidelity, visual entropy/cut pace, alignment/balance/timing scores).
- Cross-modal alignment and cognitive load are visualized with timelines/spans and linked glossary tooltips.
- Coaching bullets tie second-order scores (Alignment/Drift/Decay/Balance/Timing) to actionable guidance; no references to missing data.
- Mobile/desktop layouts handle dense data with collapsible sections and clear empty/fallback states.

---

## Phase 0: UX Narrative & IA
- [ ] Design a single “Advanced signals” narrative: what the user should learn first, second, third (pace → arc → alignment → load → balance).
- [ ] IA update: ensure navigation or anchors let users jump to pace, arc, alignment, load, language texture, and silence visuals quickly.
- [ ] Glossary/tooltips plan that reuses `docs/axes_and_domains.md` entries; avoid duplicating copy.

---

## Phase 1: Overview Surfaces
- [ ] Add a multi-lane strip under the radar showing:  
  - Speaking pace mean + variance timeline (10s bins).  
  - Energy drift trend.  
  - Cognitive load timeline with spike badges.  
  - Silence-for-emphasis spans (with beat/punch alignment).
- [ ] Alignment timeline: paired audio/visual peak offsets + beats-vs-edits list (worst/best deltas) + modality over-reliance badge.
- [ ] Second-order summary row: Alignment/Drift/Decay/Balance/Timing with short labels and hover hints; hide metrics marked unobserved.
- [ ] Add an “Analysis status” chip summarizing observed/unobserved counts and fallback usage.

---

## Phase 2: Domain Tabs – Deep Exposure

### Voice/Delivery
- [ ] Show speaking pace mean/variance and within-segment drift mini-chart; include emphasis-alignment and energy-drift notes.
- [ ] Add audience-address frequency badge (you/we per minute, rhetorical vs direct) with a short interpretation.
- [ ] Humor timing and question mix widgets (setup→punch deltas, rhetorical vs genuine counts).

### Language
- [ ] Visualize analogy/example/definition ratios (stacked bar) and sentence compression distribution; show reference density per minute with type legend.
- [ ] Surface metaphor density and concreteness in the score bars with tooltips that link to glossary.

### Narrative
- [ ] Display time-to-hook marker on a mini timeline; show hook strength chip and open-loop resolution list.  
- [ ] Mini-arc bar overlays beats/segments plus cohesion drift timeline; flag drift when high.

### Visual/Edit
- [ ] Visual entropy strip chart with spikes annotated; cut-rate refinement card (median/variance/beat coupling).  
- [ ] Silence-for-emphasis spans overlaid on timeline; highlight if aligned to beats/punchlines.  
- [ ] Big-guns callouts (pace, cut rate, metaphor density) pinned for quick read.

### Sound/Performance
- [ ] Alignment note card (audio-visual emphasis alignment) and silence fidelity badge in Sound tab.  
- [ ] If performance data exists, keep the refreshed layout from Iteration 8 but add alignment with beats (retention + beat overlays).

---

## Phase 3: Coaching & Copy
- [ ] Generate actionable insights that map second-order scores to guidance (e.g., “Low timing: hooks land late; try moving first hook <10s and align silences with payoffs”).  
- [ ] Add microcopy beside each chart explaining what “good” looks like (pull from metric semantics docs).  
- [ ] Guardrails: never show advice when metrics are unobserved; display a friendly “Not observed” chip instead.

---

## Phase 4: Responsiveness, States, and Accessibility
- [ ] Collapsible sections for dense timelines on mobile; preserve hover data via tap-to-focus.  
- [ ] Empty/fallback states per widget (pace timeline missing, silence spans missing, etc.) with reasons from diagnostics.  
- [ ] ARIA/keyboard: ensure new charts and badges are keyboard-focusable with text alternatives; verify contrast.

---

## Phase 5: E2E & Regression
- [ ] Add `docs/iteration_10_e2e.md` with a checklist that walks through every advanced surface on desktop and mobile (including mock mode).  
- [ ] Update visual regression/screenshot set to cover the new advanced strips, silence spans, alignment timeline, and language texture charts.  
- [ ] Quick smoke script to assert UI renders when any advanced metric is unobserved (no crashes, clear messaging).

---

## Done When
- Users can see and interpret all `todo.md` signals in the UI with clear labels, timelines/spans, and short coaching.  
- Alignment/load/pace/arc/silence and language texture visuals render on desktop and mobile with graceful fallbacks.  
- Insights and badges never reference missing data; diagnostics explain what was observed.  
- E2E checklist and visual snapshots cover the new components; no regressions or dead states.
