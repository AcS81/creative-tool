# Iteration 10 – Advanced Signals UX Narrative & IA (Phase 0)

Purpose: define the story, navigation anchors, and glossary usage for surfacing advanced metrics without disrupting Iteration 8 UI wins.

## Narrative (“Advanced signals”)
- **Language texture**: show how the creator mixes analogies/examples/definitions, compresses sentences, asks questions, references culture, and addresses the audience (you/we, direct vs rhetorical).
- **Prosody/energy**: highlight emphasis alignment, energy drift, and silence placement alongside pace.
- **Visual/edit fidelity**: surface visual entropy spikes, cut-rate refinement (median/variance/beat coupling), and silence spans overlaid on beats.
- **Modality balance**: reveal redundancy vs complementarity and over-reliance per mode.
- **Second-order summaries**: Alignment/Drift/Decay/Balance/Timing row that connects inputs to outcomes.
- **Audience address**: badge with counts per minute and split; note when unobserved.

## IA / anchors
- Overview: `#advanced-signals` section with a multi-lane strip (energy drift, entropy, cut refinement, redundancy/complementarity, audience-address) and a second-order summary row anchored as `#second-order-summary`.
- Domain tabs:
  - Voice: `#voice-energy-drift`, `#voice-emphasis-alignment`, `#voice-audience-address`.
  - Language: `#language-texture-ratios`, `#language-compression`, `#language-questions`, `#language-references`.
  - Narrative: `#narrative-open-loops`, `#narrative-cohesion`, `#narrative-arc-drift`.
  - Visual/Edit: `#visual-entropy`, `#editing-cut-refinement`, `#editing-silence-spans`.
  - Sound/Performance: `#sound-balance` (redundancy/complementarity) plus existing alignment/silence fidelity badges.
- Keep existing pace/humor/silence/alignment UI unchanged; add jump links from Overview to each anchor.

## Glossary/tooltips plan
- Reuse entries from `docs/axes_and_domains.md` for all advanced signals (audience address, silence fidelity, entropy, cut refinement, redundancy/complementarity, second-order scores).
- Tooltip copy should reference those definitions verbatim; no duplicated prose in components.
- “Not observed” states pull diagnostics/observed flags from the fingerprint and align with the glossary guidance on unobserved metrics.
