# Multimodal Golden Set (Regression Helper)

Use this opt-in script to sanity-check multimodal outputs against a handful of known videos. It is **not** required for CI; it’s for local/staging runs when you have valid Gemini + YouTube keys.

## Prereqs
- `ANALYSIS_MODE=gemini`
- `GEMINI_API_KEY` (and optionally `YOUTUBE_API_KEY` if needed in your environment)
- Multimodal flag on by default; no other env needed.

## Run
```bash
npm run golden:multimodal [-- --dry-run]
```
- Without `--dry-run`, the script runs the multimodal analyzer for each video in `scripts/run-multimodal-golden.ts`.
- If you don’t have keys handy, add `--dry-run` and it will exit early after checking envs.

## What to look for
- Logs include fallback usage, unobserved metric counts, and key metrics: music coverage/changes, cut rate, and story presence.
- Compare the printed metrics to the expected notes in the script (story/music/pacing). Large mismatches are a signal to revisit prompts or parsers.
- `fallback=yes` means the inline upload path was used; rerun when possible to confirm primary `file_data` entitlement.

## CI guidance
- Do not enable real golden runs in CI. If you add a CI-friendly variant, mock Gemini responses and gate it behind an env (not provided here).
