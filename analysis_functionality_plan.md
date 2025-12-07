# CreatorSight – Native Multimodal Analysis Plan (Gemini with YouTube URL file parts)

This replaces the previous plan. It assumes we use Gemini’s native video ingestion (YouTube URL passed as a `file_data` part) so the model “sees/hears” the video instead of hallucinating from text. Scope and outputs stay aligned to the MVP PRD.

---

## 1) Reality Check: How Gemini Must Be Called
- Passing the URL as plain text is text-only → hallucinations.
- Passing the URL as `file_data` with `mime_type: "video/*"` (Google AI Studio / Vertex “YouTube import” capability) lets Gemini fetch frames/audio directly.
- We must verify entitlement: if `file_data` fails (403/unsupported), fall back to a lightweight fetch + signed URL upload, still without persisting raw media after use.

### Multimodal Reality (Iteration 2 – Task 0.1)
- New probe script: `tsx scripts/probe-multimodal-ingestion.ts --url <youtube-url> [--force-fallback] [--skip-gemini] [--bytes N]`. It runs the multimodal call (when `GEMINI_API_KEY` is set) and also inspects the fallback download bytes.
- Observation from the fallback downloader (Node fetch with Range bytes): a plain watch URL returns `status=200`, `content-type=text/html`, ~1.5MB of HTML starting with `<!DOCTYPE html>`. This means our current fallback (`inline_data` built from `fetch(youtubeUrl)`) is not providing audio/video to Gemini.
- Primary `file_data` entitlement could not be validated in this environment (no `GEMINI_API_KEY` available at run time); rerun the probe with a key to confirm whether direct YouTube ingestion works for this account.
- Recommendation: treat the PRD “no download” non-goal as needing a narrow exception—fallback must stream real media bytes (e.g., via a short progressive audio/video pull or a signed temp upload) instead of watch-page HTML, otherwise multimodal quality will remain unreliable.
- Axis semantics and glossary live in `docs/axes_and_domains.md`; the UI now links to this doc from the Overview to explain how each axis is measured and what “unobserved” means.

---

## 2) Architecture (per analysis job)
1) **Metadata**: YouTube Data API (title, channel, duration).  
2) **Primary path: Native Gemini video read**  
   - Call Gemini once per domain bundle with a `file_data` part referencing the YouTube URL.  
   - Use a single, wide system instruction + structured JSON schema covering all domains.  
3) **Fallback path (only if file_data rejected)**  
   - Stream audio + sparse frames to temp storage, upload as a FilePart (signed URL), then invoke Gemini.  
   - Delete temp artifacts immediately after the call.  
4) **Post-process**: build fingerprint, meta-axes, archetypes, nearest references; optional performance overlay if OAuth + ownership.

---

## 3) API Call Design (client rewrite)
- Endpoint: Gemini 1.5 Pro (multimodal).  
- Request parts:
  - `file_data`: `{ mime_type: "video/mp4", file_uri: youtubeUrl }`  
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

## 5) Dual-chart model (independent radar + spectrum shape)
- **Chart A (independent radar)**: keeps the current pentagram-style axes where each facet stands alone (no implied midpoint). Use this for traits that are not inherently “more is better”, e.g., pitch variation, filler control, environment stability.
- **Chart B (spectrum shape – hexagram/diamond)**: 3–4 axes per domain where a midpoint is meaningful. Each spectrum has low/mid/high labels to show balance rather than “chase the max”. Spectrums also expose “unobserved/low-confidence” states and short copy on what low/mid/high look like.
- **Quant + qual together**: numeric bands stay (0–100) but tooltips and legend copy emphasize interpretation and when “mid” is desirable. Overlay a faint reference/archetype outline plus the user polygon for both shapes.
- **Bucketization**: reuse returned metrics → buckets → bands:
  - Independent axes: direct mapping from returned scores.
  - Spectrum axes: use signed weights so opposing sides push in opposite directions around a midpoint (e.g., structured↔riffing uses pauses as low-weight, filler as high-weight; stable↔roaming uses stability as low-weight, movement as high-weight).
- **Per-domain wiring (existing metrics → the two charts)**:
  - Voice: Chart A = pace, filler, pauses, loudness, pitch; Chart B = pace balance, calm↔animated (pitch+loudness), structured↔riffing (pauses+filler), intimate↔broadcast (projection).
  - Language: Chart A = concreteness, metaphor, references, humor, teaching_vs_riffing; Chart B = abstract↔concrete, instructional↔exploratory, playful↔serious, sparse↔reference-rich.
  - Narrative: Chart A = story presence, mini arcs, foreshadow/callbacks, transition clarity, hooks, pattern interrupts; Chart B = guided↔freeform, story-led↔expository, device-light↔heavy, flat↔rising tension.
  - Visual: Chart A = stability, talking/b-roll/graphics mix, movement, expression, shot variety; Chart B = static↔dynamic, minimal↔graphic-rich, stable↔roaming, clean↔stylized.
  - Editing: Chart A = cut rate, pattern interrupts, b-roll coverage, rhythm consistency; Chart B = slow↔fast cuts, clean↔interrupt-heavy, sparse↔layered b-roll, smooth↔choppy.
  - Sound: Chart A = music coverage, music changes, music vs voice, SFX density, silence for emphasis; Chart B = dry↔musical bed, understated↔overpowering mix, minimal↔SFX-heavy, silence rare↔often.
- **Per-domain micro-viz**: timelines (beats/cuts/music), badges (SFX/B-roll), and raw measurements stay adjacent so qualitative text is primary and numbers act as context.

---

## 6) Prompt Content (embedded in client)
- System: “You are a video analysis engine. You watch the attached YouTube video via file_data. You must measure the requested metrics from the audio + visual content, then emit strict JSON matching the schema. Do not guess or hallucinate; if a metric is not observable, set `value: "unobserved"` and `score: 0`.”
- User: include definitions for each metric (speaking rate, filler, concreteness, simile/metaphor, hook/setup/escalation/payoff/outro, environment stability, b-roll, cut pace, pattern interrupts, music coverage, SFX, silence). Require timestamps for beats.
- Response: `responseMimeType: "application/json"`.

---

## 7) Implementation Steps (repo-specific)
1) **Gemini client rewrite** (`src/lib/gemini/client.ts`): add multimodal request builder using `file_data` for YouTube URL; add fallback path for temp upload if direct fetch rejected. Keep schema validation.  
2) **Domain analyzer consolidation** (`src/lib/analysis/geminiDomains.ts` → new multimodal call): move to a single-call schema (above) instead of six separate text-only calls. Parse into DomainProfiles + supporting beats/cuts/music stats.  
3) **Axis metadata single source**: keep one module for labels/explanations; frontend reads from it for tooltips and descriptions.  
4) **Fingerprint builder**: map multimodal JSON into `VideoFingerprintJson` (meta axes, per-domain scores, beats, music coverage, cut pace).  
5) **UI wiring**: show explanations from the response; no placeholder axes. Surface diagnostics when fallback (temp upload) was used or when metrics are `unobserved`.  
6) **Tests**: add integration test stubs with mocked Gemini response; unit tests for parser/validator and the fallback path selection.

---

## 8) Validation Plan
- Use a video with clear music bed and a simple story arc; verify returned `music_changes`, `beats`, and `cut_rate` match reality.  
- Check that removing captions still works (Gemini should rely on audio/video).  
- Ensure any failure to fetch via `file_data` triggers the fallback and surfaces a “lower confidence” flag in diagnostics.

---

## 9) Risks & Mitigations
- **Entitlement/quotas**: file_data access to YouTube may be gated; mitigate with temp-upload fallback.  
- **Latency/cost**: single multimodal call is heavier; keep temperature low and request only needed fields.  
- **Schema drift**: enforce zod schema and reject non-conforming responses; display partial results with clear flags.

---

## 10) Runtime Flags and Diagnostics
- `ANALYSIS_MODE=mock` → deterministic offline pipeline. `ANALYSIS_MODE=gemini` → requires Gemini + YouTube keys.
- Multimodal is **default-on** when `ANALYSIS_MODE=gemini` and keys are present. Text-only v1 is **removed**; `ANALYSIS_VERSION=v1` now throws a configuration error instead of routing to the deprecated path.
- Optional override: `ANALYSIS_VERSION=v2` keeps the canonical path explicit; no extra flag needed in normal dev/prod.
- `/api/analyze` surfaces `diagnostics.source` as `mock | gemini-v2-multimodal` for new runs (legacy records may still show `gemini-v1-text`) and includes `diagnostics.multimodalFallbackUsed` when the temp-upload inline path is taken.
- Fingerprint schema: `VideoFingerprintJson` v2 (`version=1.2.0`) is canonical. Legacy v1.1 fingerprints are accepted only via an upgrade shim that rewrites them to `1.2.0`; new analyses always emit `1.2.0`.
