# CreatorSight – Native Multimodal Analysis Plan (Gemini URL Ingestion)

This replaces the previous plan. It assumes we use Gemini’s native URL ingestion (YouTube URL provided as the video input) so the model “sees/hears” the video instead of hallucinating from text. Scope and outputs stay aligned to the MVP PRD.

---

## 1) Reality Check: How Gemini Must Be Called
- Passing the URL as plain text is text-only → hallucinations.
- Passing the URL as a video input (Gemini URL ingestion) lets Gemini fetch frames/audio directly.
- If URL ingestion fails (entitlement/model/project), surface a clear error and retry with a different model/key. No download/upload fallback.

### Multimodal Reality (Iteration 2 – Task 0.1)
- New probe script: `tsx scripts/probe-multimodal-ingestion.ts --url <youtube-url> [--skip-gemini]`. It runs the multimodal call (when `GEMINI_API_KEY` is set) and summarizes unobserved counts + highlights.
- URL ingestion entitlement could not be validated in this environment (no `GEMINI_API_KEY` available at run time); rerun the probe with a key to confirm whether direct YouTube ingestion works for this account.
- Recommendation: stay URL-only and fail fast; do not add download/upload fallbacks.
- Axis semantics and glossary live in `docs/axes_and_domains.md`; the UI now links to this doc from the Overview to explain how each axis is measured and what “unobserved” means.

---

## 2) Architecture (per analysis job)
1) **Metadata**: YouTube Data API (title, channel, duration).  
2) **Primary path: Native Gemini video read**  
   - Call Gemini once per domain bundle using URL ingestion for the video input.  
   - Use a single, wide system instruction + structured JSON schema covering all domains.  
3) **Post-process**: build fingerprint, meta-axes, archetypes, nearest references; optional performance overlay if OAuth + ownership.

---

## 3) API Call Design (client rewrite)
- Endpoint: Gemini 1.5 Pro (multimodal).  
- Request parts:
  - Video input: YouTube URL + `mime_type` (`video/*`) via URL ingestion.  
  - `text`: system + user instruction containing required metrics and JSON schema.  
- Temperature: 0.2; `responseMimeType: "application/json"`.  
- Single-shot response containing **all domains**, not fragmented per-domain calls.

---

## 4) JSON Schema (single source of truth for axes + explanations)
For each domain, return `score` (0–100), `value` (raw measurement string), and `explanation` (short text). No “Axis 4/5” placeholders.

```json
{
  "voice": {
    "speaking_rate": { "score": 0, "value": "160 wpm", "explanation": "" },
    "filler_rate": { "score": 0, "value": "4 per min", "explanation": "" },
    "pauses": { "score": 0, "value": "0.8s avg, 12 resets", "explanation": "" },
    "loudness_range": { "score": 0, "value": "12 dB", "explanation": "" },
    "pitch_variation": { "score": 0, "value": "medium", "explanation": "" }
  },
  "language": {
    "concreteness": { "score": 0, "value": "62% concrete nouns", "explanation": "" },
    "metaphor_density": { "score": 0, "value": "5 per 1k words", "explanation": "" },
    "references": { "score": 0, "value": "cultural 3 / historical 0 / scientific 1", "explanation": "" },
    "humor": { "score": 0, "value": "2 jokes", "explanation": "" },
    "teaching_vs_riffing": { "score": 0, "value": "70% instructional", "explanation": "" }
  },
  "narrative": {
    "beats": [
      { "label": "hook", "start": 0, "end": 15 },
      { "label": "setup", "start": 15, "end": 90 }
    ],
    "mini_arc_density": { "score": 0, "value": "3", "explanation": "" },
    "foreshadow_callbacks": { "score": 0, "value": "2 callbacks, 1 open loop", "explanation": "" },
    "transition_clarity": { "score": 0, "value": "guided", "explanation": "" }
  },
  "visual_edit_sound": {
    "environment_stability": { "score": 0, "value": "78% same setup", "explanation": "" },
    "talking_vs_broll_vs_graphics": { "score": 0, "value": "60/30/10", "explanation": "" },
    "cut_rate": { "score": 0, "value": "avg 2.1s", "explanation": "" },
    "pattern_interrupts": { "score": 0, "value": "memes/overlays at 4 timestamps", "explanation": "" },
    "broll_coverage": { "score": 0, "value": "30%", "explanation": "" },
    "music_changes": { "score": 0, "value": "music under 70% runtime, 3 changes", "explanation": "" },
    "sfx_density": { "score": 0, "value": "6 notable SFX", "explanation": "" },
    "silence_for_emphasis": { "score": 0, "value": "3 spans ~1.0s", "explanation": "" }
  }
}
```

Meta-axes and archetypes derive from these scores; axis labels/explanations come from one metadata module (single source).

---

## 5) Prompt Content (embedded in client)
- System: “You are a video analysis engine. You watch the attached YouTube video via the provided URL. You must measure the requested metrics from the audio + visual content, then emit strict JSON matching the schema. Do not guess or hallucinate; if a metric is not observable, set `value: "unobserved"` and `score: 0`.”
- User: include definitions for each metric (speaking rate, filler, concreteness, simile/metaphor, hook/setup/escalation/payoff/outro, environment stability, b-roll, cut pace, pattern interrupts, music coverage, SFX, silence). Require timestamps for beats.
- Response: `responseMimeType: "application/json"`.

---

## 6) Implementation Steps (repo-specific)
1) **Gemini client rewrite** (`src/lib/gemini/client.ts`): add multimodal request builder using URL ingestion for YouTube URLs. Keep schema validation.  
2) **Domain analyzer consolidation** (`src/lib/analysis/geminiDomains.ts` → new multimodal call): move to a single-call schema (above) instead of six separate text-only calls. Parse into DomainProfiles + supporting beats/cuts/music stats.  
3) **Axis metadata single source**: keep one module for labels/explanations; frontend reads from it for tooltips and descriptions.  
4) **Fingerprint builder**: map multimodal JSON into `VideoFingerprintJson` (meta axes, per-domain scores, beats, music coverage, cut pace).  
5) **UI wiring**: show explanations from the response; no placeholder axes. Surface diagnostics when metrics are `unobserved`.  
6) **Tests**: add integration test stubs with mocked Gemini response; unit tests for parser/validator.

---

## 7) Validation Plan
- Use a video with clear music bed and a simple story arc; verify returned `music_changes`, `beats`, and `cut_rate` match reality.  
- Check that removing captions still works (Gemini should rely on audio/video).  
- Ensure any URL ingestion failure surfaces a clear error and does not silently downgrade outputs.

---

## 8) Risks & Mitigations
- **Entitlement/quotas**: URL ingestion access to YouTube may be gated; mitigate with explicit error messaging and model/key retries.  
- **Latency/cost**: single multimodal call is heavier; keep temperature low and request only needed fields.  
- **Schema drift**: enforce zod schema and reject non-conforming responses; display partial results with clear flags.

---

## 9) Runtime Flags and Diagnostics
- `ANALYSIS_MODE=mock` → deterministic offline pipeline. `ANALYSIS_MODE=gemini` → requires Gemini + YouTube keys.
- Multimodal is **default-on** when `ANALYSIS_MODE=gemini` and keys are present. Text-only v1 is **removed**; `ANALYSIS_VERSION=v1` now throws a configuration error instead of routing to the deprecated path.
- Optional override: `ANALYSIS_VERSION=v2` keeps the canonical path explicit; no extra flag needed in normal dev/prod.
- `/api/analyze` surfaces `diagnostics.source` as `mock | gemini-v2-multimodal` for new runs (legacy records may still show `gemini-v1-text`).
- Fingerprint schema: `VideoFingerprintJson` v2 (`version=1.3.0`) is canonical. Legacy v1.1 and v1.2 fingerprints are accepted only via an upgrade shim that rewrites them to `1.3.0`; new analyses always emit `1.3.0`.
