# Iteration 10 E2E Checklist

Use this to verify the advanced presentation and coaching surfaces on desktop and mobile.

## Pre-reqs
- Run an analysis (mock or Gemini) with advanced metrics populated.
- Ensure `analysis_mode` tab navigation works (Overview + domain tabs).

## Overview
- Advanced Signals strip shows energy drift, entropy, cut refinement, redundancy/complementarity, and audience-address values with “Not observed” when missing.
- Second-order summary row displays Alignment/Drift/Decay/Balance/Timing; unobserved metrics show a dashed style or “Not observed”.
- Advanced Coaching list appears; when metrics are unobserved, guidance uses “Not observed” wording instead of guesses.
- Glossary link present on the advanced strip.

## Domain tabs
- Voice tab: badges for energy drift, emphasis alignment, audience address; pace mini-chart still present.
- Language tab: badges for analogy/example/definition counts, compression timeline count, references by type, questions with split; language timing mini-chart still present.
- Narrative tab: badges for open loops, cohesion drift, ending resolution; mini-arc and timelines render; silence spans overlay includes labels.
- Visual/Edit tabs: entropy and cut refinement badges with timeline counts/beat coupling; silence spans overlay with beat labels when present.
- Sound tab: redundancy/complementarity badge present; silence fidelity badge retained.

## States & accessibility
- Tabs reachable via keyboard; tab panels have `role=tabpanel`.
- Advanced Signals and Advanced Coaching regions have `role=region` and labels.
- “Not observed” states render clearly with muted styling; no empty cards.
- Mobile: strips/cards wrap without overflow; badges stack; timelines remain readable.

## Regression
- No overlap or double-render with existing Alignment & Load section.
- Running with mock analysis still populates advanced surfaces (no crashes).
- When advanced metrics are disabled or unobserved, surfaces show “Not observed” gracefully.
