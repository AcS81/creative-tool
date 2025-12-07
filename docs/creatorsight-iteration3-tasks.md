# CreatorSight – Iteration 3 Implementation Tasks (Experience & Coaching Upgrade)

## Document Information
- **Product**: CreatorSight  
- **Iteration**: 3 – Experience & Coaching Upgrade (“From Raw Analysis → Clear Insight”)  
- **Version**: 1.0  
- **Status**: Ready for AI-Driven Implementation  
- **Target Outcome**: A locally runnable app where:
  - The existing **Gemini-powered creative analysis** (Iteration 2) feels:
    - Visually cohesive and high-signal.  
    - Easy to understand at a glance.  
    - Actionable via simple, grounded coaching insights.  
  - The **Overview** and **domain views** (Voice, Language, Narrative, Visual, Editing, Sound) reflect the PRD’s “creative x-ray” spirit:
    - Stronger layout and visual hierarchy.  
    - Better copy and domain explanations.  
    - Clear “Where you’re unusual” and “What to do next” sections.  
  - No new external APIs are required:
    - We reuse Iteration 2’s Gemini + YouTube Data integration.  
    - **Performance / YouTube Analytics (FR-12, FR-13)** is explicitly deferred to Iteration 4.

> Iteration 3 = “Make it feel like a product, not a prototype.” We turn the existing creative fingerprint into a polished, legible, and lightly coached experience before adding performance overlays later.

---

## High-level Scope for Iteration 3

From the PRD, Iteration 3 focuses on:

- **UX & visual design**:
  - App shell, layout, typography, and spacing.  
  - Overview screen that tells a clear story.  
  - Domain views that read like “Your {Domain}” pages, not raw data dumps.  
- **Insights & coaching v1** (no Analytics yet):
  - Deepen “Where you’re unusual vs typical”.  
  - Add simple, rule-based suggestions based on creative fingerprints + reference library.  
- **Reliability & hygiene**:
  - Close remaining Iteration 2 gaps that affect stability and interpretability.  

Out of scope for this iteration:

- YouTube OAuth + Analytics (retention / CTR / performance domain).  
- Channel-level aggregation, exports, or advanced coaching flows.  

Those become the focus of Iteration 4 (“Performance-Aware Coaching Slice”).

---

## Phase 0: Stabilize Iteration 2 (Hygiene Before UX)

### Task 0.1: Close Remaining Iteration 2 Gaps

**Context**

- PRD Sections: 5.5 (Fingerprint & Similarity), 7 (Pipelines).  
- Iteration 2 spec listed some tasks as partial/incomplete (seed updates, failure handling, similarity refinements, “Where you’re unusual” powered by real data).  
- Before polishing UX, we want the underlying data and behavior to be predictable.

**Goals**

- [x] Verify and complete the following from Iteration 2:
  - Seeded reference fingerprints:
    - Updated to the latest fingerprint schema (all domains populated with scores + summaries).  
    - Pass `validateFingerprint` and match TypeScript/Zod types.  
  - `/api/analyze`:
    - Uses YouTube metadata and Gemini pipeline when enabled.  
    - Properly sets `VideoAnalysis.status` to `pending` / `complete` / `failed`.  
    - Records `failureReason` on failures and returns typed error payloads to the frontend.  
  - Similarity engine:
    - Computes distances on updated meta axes (and optionally selected domain scores).  
    - Returns at least one nearest reference for any valid fingerprint.  
  - “Where you’re unusual”:
    - Uses updated reference fingerprints and meta axes to compute percentile-style insights.  

**Constraints**

- No new concepts or APIs; this task is about finishing and hardening Iteration 2 behavior.  
- Prefer targeted refactors and tests over broad rewrites.

**Acceptance Criteria**

- [x] All Iteration 2 checkboxes that impact analysis, fingerprints, similarity, or insights are either:
  - Implemented and verified, or  
  - Explicitly deferred with justification in comments/docs.  
- [x] `/api/analyze`:
  - Returns consistent, typed success and error structures.  
  - Never leaves `VideoAnalysis` rows in ambiguous states.  
- [x] Nearest-reference and “Where you’re unusual” outputs are stable and reproducible for the same inputs.

---

## Phase 1: UX Foundation & Layout

### Task 1.1: Design Tokens, Typography, and Spacing

**Context**

- PRD Sections: 1 (Product Overview), 4 (High-level UX / Visualizations).  
- The app should feel cohesive and legible before layering on complex visualizations.

**Goals**

- [x] Define or refine a small design token set in Tailwind / CSS:
  - Typography scale (e.g. `text-xs`–`text-3xl`) with semantic usage (`heading`, `subheading`, `body`, `caption`).  
  - Spacing scale (`gap`, `padding`, `margin`), focusing on consistent vertical rhythm.  
  - Color palette tuned for analysis dashboards (backgrounds, neutrals, accent colors for charts and archetypes).  
- [x] Apply tokens to:
  - Top-level app layout.  
  - Buttons, inputs, cards used in analysis pages.  

**Constraints**

- Stay within Tailwind’s idioms; avoid bespoke CSS unless needed.  
- Ensure good contrast and basic accessibility (AA-level where feasible).

**Acceptance Criteria**

- [x] Overview and domain pages use a consistent typography, spacing, and color system.  
- [x] No obvious one-off styles where shared tokens/components would be appropriate.

---

### Task 1.2: App Shell & Navigation

**Context**

- PRD Sections: 4.1 (Overview Screen) and 4.3 (Other domain views).  
- We need a clear mental model of “home → analysis → domains”.

**Goals**

- [x] Implement or refine an app shell that includes:
  - Top navigation with product name, simple logo, and link back to the landing/home page.  
  - Entry point for analysis (URL input) and a way to get back to the last analysis.  
- [x] For analysis views:
  - Provide persistent domain navigation (tabs or pill-nav) for:
    - `Overview`, `Voice`, `Language`, `Narrative`, `Visual`, `Editing`, `Sound`.  
  - Ensure tab state is reflected in the URL or at least in client-side state so deep linking is possible later.

**Constraints**

- Keep navigation lightweight; no complex auth flows yet.  
- Layout must work on desktop and mobile.

- **Acceptance Criteria**

- [x] A user can:
  - Land on home, paste a URL, run analysis.  
  - Navigate between Overview and domain tabs without losing current analysis data.  
- [x] The shell feels like a single product, not disjointed pages.

---

## Phase 2: Overview Screen 2.0

### Task 2.1: Overview Hero & Metadata Card

**Context**

- PRD Section 4.1 (Overview Screen).  
- Overview should answer at a glance: “What is this video, who am I, and what archetype am I in this analysis?”

**Goals**

- [x] Redesign the top section of Overview to include:
  - Video metadata card:
    - Thumbnail, title, channel, duration, publish date.  
  - Primary archetype card:
    - Overall archetype name.  
    - 2–3 line description.  
    - Chips showing per-domain archetypes (Voice, Language, Narrative, Visual, Editing, Sound).  
- [x] Use clear headings and subtle dividers to separate metadata from creative fingerprint content.

**Constraints**

- Use existing data from Iteration 2 (YouTube metadata + fingerprint).  
- Avoid overwhelming users with text; keep the hero section scannable.

- **Acceptance Criteria**

- [x] Overview hero shows:
  - Video metadata.  
  - Overall archetype card with domain chips.  
- [x] Layout is responsive and readable on both mobile and desktop.

---

### Task 2.2: Radar Chart & Neighbours Polish

**Context**

- PRD Section 4.1 (Overview – meta-level radar + “Closest neighbours”).  
- The current radar and neighbours are functional but can be more legible and compelling.

**Goals**

- [x] Refine the Overview radar chart:
  - Clear axis labels matching PRD meta axes:
    - Voice intensity  
    - Conceptual depth  
    - Narrative structure strength  
    - Visual dynamism  
    - Production polish  
  - Legend explaining user vs niche-average polygon.  
  - Tooltips or hover/press states that show numeric values and short copy for each axis.  
- [x] Improve “Closest neighbours” section:
  - Show a small row of reference creators with:
    - Display name.  
    - Domain-specific closeness labels (e.g. “Voice closest to X”).  
  - Keep layout compact and aligned with archetype card.

**Constraints**

- Reuse existing `recharts` setup where possible.  
- Ensure charts degrade gracefully if data is missing or partial.

**Acceptance Criteria**

- [x] Radar chart and neighbours:
  - Render reliably for a valid fingerprint.  
  - Provide enough context (labels, legend) for a new user to interpret them.  
- [x] On mobile, chart and neighbours remain usable without horizontal scrolling.

---

### Task 2.3: Loading, Empty, and Error States for Overview

**Context**

- PRD Section 6 (Reliability).  
- Good UX requires handling non-happy paths elegantly.

**Goals**

- [x] Implement explicit UI states on Overview for:
  - No analysis yet (prompt user to paste a URL).  
  - Analysis in progress (skeletons/spinners with short explanations).  
  - Analysis failed (clear error message, surface of `failureReason` if appropriate, and a “Try again” affordance).  
- [x] Ensure these states are wired to real backend statuses from `/api/analyze`.

**Constraints**

- Avoid jarring layout shifts; use skeletons/placeholders where feasible.  
- Error copy should be simple and non-technical.

**Acceptance Criteria**

- [x] Manual tests confirm each state appears correctly under the corresponding backend conditions.  
- [x] Overview never shows half-rendered content; there is always a meaningful state.

---

## Phase 3: Domain Deep-Dive Views

### Task 3.1: Domain View Layout Template

**Context**

- PRD Sections 4.2–4.3 (Voice View and other domain views).  
- Domain pages should share a consistent structure while allowing domain-specific content.

**Goals**

- [x] Create a reusable `DomainView` layout component (e.g. `src/components/analysis/DomainView.tsx`) that provides:
  - Header (“Your {Domain}”).  
  - Primary archetype + optional secondary archetype.  
  - Short summary paragraph.  
  - Slot for domain-specific visual (radar or bar chart).  
  - Slot for domain-specific tags or metrics.  
- [x] Refactor each domain tab (`Voice`, `Language`, `Narrative`, `Visual`, `Editing`, `Sound`) to use this template.

**Constraints**

- All domain data should still come from the fingerprint.  
- Keep component props typed and aligned with fingerprint schema.

**Acceptance Criteria**

- [x] All domain tabs render via the shared layout component.  
- [x] The UI across domains feels cohesive (same basic structure, domain-specific content).

---

### Task 3.2: Domain Visuals & Tags

**Context**

- PRD Sections 4.2–4.3 (radar/pentagram per domain, small supporting visuals).  
- We want domains to feel more than just text.

- **Goals**

- [x] For each domain:
  - Implement a small visual representation of key scores:
    - Radar chart or bar chart with 4–6 axes relevant to the domain (e.g. Voice = Energy, Expressiveness, Clarity, Warmth, Flow).  
  - Render a set of tags/badges summarizing key qualitative descriptors (e.g. “High energy”, “Abstract-heavy”, “Pattern interrupts often”).  
- [x] Ensure visuals and tags are driven by fingerprint domain scores and summary fields, not hardcoded placeholders.

**Constraints**

- Avoid overloading pages with too many charts; 1 primary visual per domain is enough.  
- Keep charts readable on narrow screens.

**Acceptance Criteria**

- [x] Each domain tab shows:
  - A domain-specific visual.  
  - Tags summarizing the domain style.  
- [x] Visuals render correctly even when some scores are missing (e.g. fallback to text-only state).

---

### Task 3.3: Domain Copy & Archetype Descriptions

**Context**

- PRD Sections 4.2–4.3 (domain descriptions, archetype explanations).  
- The PRD emphasizes short, human-readable explanations.

- **Goals**

- [x] Create a small, hand-authored library of archetype descriptions per domain (config or JSON in `src/lib/archetypes/`), e.g.:
  - Voice: “Reflective Analyst”, “Storyteller Host”, “Hyperactive Commentator”.  
  - Narrative: “Essayist with Beats”, “Linear Explainer”, etc.  
- [x] Wire domain views to:
  - Display these archetype descriptions based on the fingerprint’s `primaryArchetype` / `secondaryArchetype`.  
  - Fallback gracefully when an archetype name has no defined description.

**Constraints**

- Keep the archetype library small but evocative; 3–7 per domain is enough.  
- Avoid hardcoding text inside components; centralize in config where possible.

**Acceptance Criteria**

- [x] For common archetypes, domain views show meaningful descriptions.  
- [x] For unknown archetypes, the UI shows a simple, generic fallback.

---

## Phase 4: Insights & Coaching v1 (No Analytics)

### Task 4.1: Generalized Insights Engine

**Context**

- PRD Section 4.1 (“Where you’re unusual vs typical”) and 3.2 (Compare yourself to big channels).  
- Iteration 1–2 introduced a basic “Where you’re unusual” based on meta axes; Iteration 3 deepens this and moves towards coaching.

**Goals**

- [x] Extend `src/lib/analysis/insights.ts` (or equivalent) to:
  - Compute:
    - Global meta-axis comparisons vs reference library (percentiles).  
    - Simple domain-level comparisons (e.g. “Your narrative structure is stronger than X% of reference videos in this archetype”).  
  - Output a structured `Insights` object with:
    - `unusualnessInsights` (where you deviate from typical).  
    - `strengthInsights` (what you’re particularly strong at).  
    - `growthInsights` (where you’re relatively weak).  
- [x] Keep logic rule-based and transparent; document high-level rules.

**Constraints**

- Do not require Analytics; rely only on creative fingerprints + reference fingerprints.  
- Avoid over-engineering; a few clear heuristics are better than many noisy ones.

**Acceptance Criteria**

- [x] For a set of sample fingerprints, the engine returns 3–8 insights total, distributed across unusualness/strength/growth.  
- [x] Insights are stable and grounded in numeric differences, not random text.

---

### Task 4.2: Overview “Insights” Section

**Context**

- PRD Section 4.1 (“Where you’re unusual vs typical”).  
- We want Overview to show the most important 3–5 takeaways.

**Goals**

- [x] Add an “Insights” section on Overview that:
  - Surfaces 3–5 bullets combining:
    - “Where you’re unusual vs typical”.  
    - 1–2 “growth” suggestions phrased as actions.  
  - Keeps copy short, concrete, and clearly tied to axes/domains (e.g. “Your conceptual depth is in the top 10% of our reference set; consider pairing it with more visual examples to stay accessible.”).  
- [x] Ensure section degrades nicely when reference data is missing (fallback message).

**Constraints**

- Keep copy in plain language; avoid technical jargon.  
- No Analytics-based insights yet; this is purely creative-style oriented.

**Acceptance Criteria**

- [x] After an analysis, Overview always shows either:
  - 3–5 concise, meaningful insights, or  
  - A clear explanation that reference data is insufficient.  
- [x] Insights reference specific axes or domains rather than generic “make better videos” advice.

---

### Task 4.3: Per-Domain Micro-Insights

**Context**

- PRD Sections 4.2–4.3 (domain breakdowns).  
- Domain pages should offer a bit of “what to do about it”, not just scores.

**Goals**

- [x] For each domain view, add a small “Domain Insights” block that:
  - Shows 2–3 domain-specific observations derived from the generalized insights engine.  
  - Optionally includes one suggestion aligned with the archetype (e.g. Voice: “You have high warmth but low dynamism; try varying your pacing in key moments.”).  
- [x] Reuse the same underlying insights logic to avoid duplication.

**Constraints**

- Keep text short (1–2 short sentences per insight).  
- Avoid promising performance outcomes; focus on creative craft.

**Acceptance Criteria**

- [x] Each domain tab shows:
  - At least one domain-specific insight when data is available.  
  - A gentle fallback when insights cannot be computed.  
- [x] Insights and suggestions feel coherent with the Overview “Insights” section.

---

## Phase 5: Dev Experience & E2E (UX-Focused)

### Task 5.1: Demo / Sample Analysis Mode

**Context**

- PRD Section 3.3 (Internal user – you using the system to analyze big channels).  
- It’s useful to have a “demo” analysis that loads instantly without hitting external APIs.

**Goals**

- [x] Add a simple “Try a sample analysis” button on the landing or Overview empty state that:
  - Loads a pre-seeded `VideoAnalysis` + `VideoFingerprint` from the DB (or a static JSON) and renders it as if the user had just analyzed that video.  
- [x] Ensure this sample uses:
  - Realistic fingerprints.  
  - Archetypes and insights that showcase the UI.

**Constraints**

- Do not introduce a separate code path for sample vs real; reuse the same components and data shape.  
- Clearly label the sample as such so users don’t confuse it with their own video.

**Acceptance Criteria**

- [x] Clicking “Try a sample analysis” on a fresh setup yields a fully populated Overview + domain views without entering a URL.  
- [x] The sample path works even if external API keys are missing (mock mode).

---

### Task 5.2: README & E2E Flow for the Polished UX

**Context**

- PRD Section 6 (Non-functional requirements), earlier iterations’ E2E docs.  
- We want a clear story for new contributors: “Here’s what the app does now.”

**Goals**

- [x] Update `README.md` and/or add `docs/iteration_3_e2e.md` to describe:
  - Current analysis capabilities (Gemini-powered creative fingerprint).  
  - New UX features: Overview 2.0, domain views, insights.  
  - How to run:
    - Mock mode.  
    - Gemini mode (if keys are available).  
  - How to trigger and explore:
    - A real analysis run.  
    - The sample/demo analysis.  
- [x] Perform a manual E2E run following the docs and adjust any misleading steps.

**Constraints**

- Documentation should be enough for a fresh developer to see a polished analysis in <10 minutes.  
- No reliance on YouTube Analytics/OAuth in this iteration’s E2E.

**Acceptance Criteria**

- [x] Fresh environment can follow docs to:
  - Run the app.  
  - Trigger either a real or sample analysis.  
  - Explore Overview and domain views with insights.  
- [x] All existing tests still pass; any new tests for UX behavior (where applicable) are green.

---

## Phase Transition Checklist (Iteration 3)

Use this checklist to confirm **Iteration 3** is complete before moving on.

### ✅ Base Stability

- [x] Iteration 2 gaps impacting analysis, fingerprints, similarity, or insights are closed or explicitly deferred.  
- [x] Seeded reference fingerprints align with the current schema and validation.

### ✅ UX & Layout

- [x] App shell, typography, spacing, and color usage feel cohesive.  
- [x] Navigation between Overview and domain tabs is smooth on desktop and mobile.

### ✅ Overview & Domains

- [x] Overview hero shows video metadata and archetype card with domain chips.  
- [x] Radar + neighbours are clearly labeled and interpretable.  
- [x] Domain views share a consistent layout and each includes a visual + tags + archetype descriptions.

### ✅ Insights & Coaching v1

- [x] “Insights” section on Overview surfaces 3–5 grounded insights per analysis when reference data exists.  
- [x] Each domain tab has at least one domain-specific micro-insight where data allows.  
- [x] Insights are rule-based, deterministic, and grounded in the fingerprint vs references.

### ✅ Dev & E2E

- [x] Demo/sample analysis works without external keys.  
- [x] README / iteration 3 docs describe the polished UX and how to experience it.  
- [x] Manual E2E flows succeed on a fresh environment.

---

## Summary

- **Iteration 1**: Local mock MVP – URL → mock analysis → fingerprint + Overview + domain skeletons.  
- **Iteration 2**: Gemini-powered creative analysis – real transcript/scenes and rich domain fingerprints across B–G.  
- **Iteration 3 (this document)**: Elevates CreatorSight from prototype to product by:
  - Polishing the UX and visual design across Overview and domain views.  
  - Deepening “Where you’re unusual” into a small but meaningful insights/coaching layer—purely from creative fingerprints and references, without yet requiring Analytics.  
  - Setting a strong experiential foundation for a future Iteration 4 focused on **Performance / YouTube Analytics** and richer coaching.
