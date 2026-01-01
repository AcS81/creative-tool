# Task 0.1 – Gemini Multimodal Client (URL-only ingestion)

This documents the new multimodal client that powers Iteration 1’s unified Gemini call.

## Entry points

- `callGeminiMultimodalJson(request: GeminiMultimodalRequest): GeminiMultimodalResult`
  - URL ingestion only (Gemini ingests the YouTube URL directly).
  - Returns:
    - `ok: true` → `{ rawJson: unknown; status }`
    - `ok: false` → `{ errorCode, errorMessage, status? }` with codes: `FEATURE_DISABLED | CONFIG_MISSING | INVALID_URL | UPSTREAM_ERROR | INVALID_RESPONSE`
- Helper: `isMultimodalClientEnabled(config?)` reads feature flag.

## Feature flag and env

- Enable with `ENABLE_ANALYSIS_V2_MULTIMODAL=true`.
- Requires `ANALYSIS_MODE=gemini` and `GEMINI_API_KEY` to actually call Gemini. In mock mode or when the flag is off, the client returns `FEATURE_DISABLED` unless `forceEnable` is set on the request.

## Usage sketch

```ts
const result = await callGeminiMultimodalJson({
  youtubeUrl: "https://youtu.be/...",
  prompt: "…structured prompt with schema…",
  jsonSchema,
  systemInstruction,
  config, // optional; defaults to getAppConfig()
});

if (result.ok) {
  console.log("ok", result.rawJson);
} else {
  console.error(result.errorCode, result.errorMessage);
}
```

## Manual test checklist

1) Valid YouTube URL with flag on → `ok: true`.
2) Bad URL → `INVALID_URL`.
3) No API key → `CONFIG_MISSING`.
4) Corrupt Gemini payload → `INVALID_RESPONSE`.
