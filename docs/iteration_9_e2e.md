# Iteration 9 E2E Checklist

Use this quick run-through to validate the Iteration 9 upgrades in Gemini mode (or mock with awareness that values are synthetic).

## Pre-reqs
- ENV: `ANALYSIS_MODE=gemini`, `ENABLE_ANALYSIS_V2_MULTIMODAL=true`, `ENABLE_ADVANCED_METRICS=true`, `GEMINI_API_KEY`, `YOUTUBE_API_KEY`.
- Optional: `GOLDEN_SET_PATH` pointing to your golden clips, or edit `scripts/run-multimodal-golden.ts` URLs.

## Flow
1) Run a full analysis on a known clip (ideally one golden video).
2) Verify fingerprint contains:
   - Silence spans (`visualEditAlignment.silenceForEmphasisFidelity.spans`) with labels (reset/punch/transition) and alignedBeat/punchline flags.
   - Audience address frequency counts (direct vs rhetorical) and non-empty value/timeline when addresses exist.
   - Beat roles populated (hook/setup/escalation/payoff/outro) and `timeToHookSeconds`/`hookStrengthScore` observed.
   - Visual entropy and cut refinement timelines populated (not empty).
   - Second-order scores present (alignment/drift/decay/balance/timing) with `diagnostics.advancedMetricsObservedBySection` showing observed=true for each section when data is present.
3) Confirm diagnostics callouts:
   - `diagnostics.multimodalFallbackUsed` false in normal runs; lowerConfidenceReason set if true.
   - `diagnostics.advancedMetricsDefaulted` false when advanced metrics returned; default reason present when disabled.
4) UI checks (desktop + mobile):
   - Silence spans overlay renders; audience-address badge appears with counts.
   - Language texture widgets show counts/timelines (analogy/example/definition, question rate) without blank states.
   - Arc beats display roles and hook timing; second-order badges populated.
5) Golden script (optional): `npm run eval:golden` (alias for `tsx scripts/run-multimodal-golden.ts`) reports PASS for each configured clip (silence spans, audience addresses, hook timing, entropy/cut timelines).

## Troubleshooting
- If advanced metrics are unobserved, check GEMINI_API_KEY/YOUTUBE_API_KEY and ensure `ENABLE_ADVANCED_METRICS` is not false.
- If golden checks fail, confirm clip URLs are set (no `REPLACE_...` placeholders) and rerun; review reported failure reasons (e.g., missing entropy timeline, too few silence spans).
