# CreatorSight – Iteration 8 Implementation Tasks (UI Elevation & Experience Cohesion)

## Document Information
- **Product**: CreatorSight  
- **Iteration**: 8 – UI Elevation, Diagnostics Surfacing, and Interaction Polish  
- **Version**: 1.0  
- **Status**: Draft – Ready once Iteration 7 is green  
- **Target Outcome**: A visibly upgraded UI that makes advanced alignment/load metrics understandable at a glance, improves navigation and responsiveness, and ships with clearer states, accessibility, and regression confidence.

> Scope: Take the real alignment/load signals from Iteration 7 and present them in a cohesive, high-quality UI. Focus on layout, typography, motion, state handling, and explanatory affordances without changing the fingerprint schema or analysis contract.

---

## High-level Outcomes
- A refreshed design system (tokens for color/typography/spacing) applied to core surfaces: landing, Overview, domain tabs, and Alignment & Load.
- Alignment/load visualization upgraded from simple tiles to interactive timelines/badges with tooltips and explanatory microcopy.
- Domain tabs gain clearer structure (headings, summaries, charts) and consistent navigation with mobile-first layout.
- Error/empty/loading states are explicit and friendly; recent analyses and sample runs feel intentional.
- Accessibility and responsiveness checks in place; lightweight visual regression or screenshot checks for key screens.

---

## Phase 0: Design System & Theming

### Task 0.1: Tokens & Typography
- [ ] Define a small token set (colors, spacing scale, radius, shadow, typography stack) in Tailwind or CSS variables; document in `docs/ui_tokens.md`.
- [ ] Pick an expressive font pairing (headline + body) and apply globally; ensure fallbacks.
- [ ] Update base components (buttons, inputs, cards, pills, badges) to consume tokens.

### Task 0.2: Layout Grid & Responsiveness
- [ ] Establish grid constraints and max widths for landing/Overview; ensure mobile-first breakpoints.
- [ ] Audit padding/margins to use the spacing scale; remove ad-hoc inline spacing.

---

## Phase 1: Landing & Navigation Refresh

### Task 1.1: Landing Card & Hero
- [ ] Redesign the landing hero/card: clearer headline/subhead, primary CTA (Analyze), secondary CTA (Try sample).
- [ ] Add a short “How it works” strip (3 steps) with icons/labels using the new token set.

### Task 1.2: Navigation & Tabs
- [ ] Update tab styling (Overview, Voice, Language, Narrative, Visual, Editing, Sound, Performance if enabled) for clarity and touch targets.
- [ ] Persist navigation state on refresh via URL hash or query (lightweight) without altering backend.

---

## Phase 2: Alignment & Load Visualization

### Task 2.1: Interactive Alignment Panel
- [ ] Replace static Alignment & Load tiles with:  
  - Audio-visual alignment mini-chart (offset sparkline or paired peaks).  
  - Beats vs edits alignment list with worst/best deltas.  
  - Modality over-reliance badge showing dominant modality and %.
- [ ] Add tooltips tied to `axisDetails` and glossary links (alignment glossary).

### Task 2.2: Cognitive Load Timeline
- [ ] Upgrade the cognitive load sparkline to an interactive timeline with hover values and spike badges (from `loadHighlights`).
- [ ] Graceful fallback when timelines are missing: clear message + link to docs.

---

## Phase 3: Domain Tabs Cohesion

### Task 3.1: Voice & Language
- [ ] Add mini charts for pace timeline and humor timing (setup→punch deltas) using advanced metrics.
- [ ] Summaries surface key scores with inline badges (e.g., “Pace variance”, “Question mix”).

### Task 3.2: Narrative & Visual/Edit
- [ ] Show time-to-hook and hook strength with a small timeline marker.  
- [ ] Visual entropy and silence-for-emphasis spans shown as bars/overlays on a simple strip chart.

### Task 3.3: Sound/Performance
- [ ] If performance data present, ensure the tab uses the new tokens and has aligned cards; otherwise show a polished empty state.

---

## Phase 4: States, Accessibility, and Diagnostics

### Task 4.1: State Handling
- [ ] Add explicit loading, error, and empty states for form submission, recent analyses, and chart data.  
- [ ] Toasts or inline banners for API errors with retry guidance.

### Task 4.2: Accessibility & Keyboard
- [ ] Ensure tab focus rings, contrast ratios, and keyboard navigation for tabs/forms/charts.  
- [ ] Add aria labels for charts/tooltips and meaningful alt text for thumbnails.

### Task 4.3: Diagnostics Surfacing
- [ ] Surface `diagnostics.advancedMetricsObserved` and fallback flags in a small “analysis status” chip; hide in mock mode unless helpful.

---

## Phase 5: Regression & Docs

### Task 5.1: Visual Checks
- [ ] Add lightweight screenshot snapshots for key screens (landing, Overview with data, Alignment & Load, one domain tab) via Playwright or Storybook visual test; gated behind an opt-in script to avoid CI flakiness.

### Task 5.2: Documentation & E2E
- [ ] Create `docs/iteration_8_e2e.md` with a UI-focused checklist (mobile + desktop).  
- [ ] Update README with a short “What’s new in Iteration 8” UI note and how to run visual checks.

---

## Done When
- Core screens use the new design tokens and typography; spacing and layout feel cohesive on mobile and desktop.
- Alignment & Load panel is interactive and explanatory; cognitive load timeline shows spikes with hover details.
- Domain tabs surface key advanced metrics with small visuals and readable summaries.
- States and accessibility are improved; diagnostics flags are visible and unobtrusive.
- Visual checks and E2E doc exist; README mentions the UI uplift and how to verify it.
