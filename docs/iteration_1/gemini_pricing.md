# Gemini Pricing Reference (CreatorSight)

This document captures the Gemini 2.5 pricing you provided, and how CreatorSight estimates cost.

## What the app estimates
- Uses Gemini `usageMetadata` token counts (prompt + output).
- Ignores context caching, grounding, and storage charges.
- Does not split audio vs text/image/video pricing (Gemini does not report that breakdown).
- For Gemini 2.5 Pro, uses the <=200k tier unless `promptTokens > 200,000`.

You can override the estimator with env vars (USD per 1K tokens):
- `GEMINI_COST_PER_1K_INPUT_TOKENS`
- `GEMINI_COST_PER_1K_OUTPUT_TOKENS`
- `GEMINI_COST_PER_1K_TOKENS`

If overrides are unset, the built-in pricing table below is used.

---

## Gemini 2.5 Pro (`gemini-2.5-pro`)

Standard pricing (per 1M tokens):
- Input: $1.25 (prompts <= 200k), $2.50 (> 200k)
- Output (incl. thinking): $10.00 (<= 200k), $15.00 (> 200k)

Context caching (not used by the estimator):
- $0.125 / 1M (<= 200k), $0.25 / 1M (> 200k)
- Storage: $4.50 / 1,000,000 tokens per hour

Per 1K conversions used by the estimator:
- Input: $0.00125 (<= 200k), $0.0025 (> 200k)
- Output: $0.01 (<= 200k), $0.015 (> 200k)

---

## Gemini 2.5 Flash (`gemini-2.5-flash`)

Standard pricing (per 1M tokens):
- Input (text/image/video): $0.30
- Input (audio): $1.00
- Output (incl. thinking): $2.50

Context caching (not used by the estimator):
- $0.03 / 1M (text/image/video)
- $0.10 / 1M (audio)
- Storage: $1.00 / 1,000,000 tokens per hour

Per 1K conversions used by the estimator (text/image/video):
- Input: $0.0003
- Output: $0.0025

---

## Gemini 2.5 Flash Preview (`gemini-2.5-flash-preview-09-2025`)

Same pricing as Gemini 2.5 Flash.

---

## Gemini 2.5 Flash-Lite (`gemini-2.5-flash-lite`)

Standard pricing (per 1M tokens):
- Input (text/image/video): $0.10
- Input (audio): $0.30
- Output (incl. thinking): $0.40

Context caching (not used by the estimator):
- $0.01 / 1M (text/image/video)
- $0.03 / 1M (audio)
- Storage: $1.00 / 1,000,000 tokens per hour

Per 1K conversions used by the estimator (text/image/video):
- Input: $0.0001
- Output: $0.0004

---

## Gemini 2.5 Flash-Lite Preview (`gemini-2.5-flash-lite-preview-09-2025`)

Same pricing as Gemini 2.5 Flash-Lite.

