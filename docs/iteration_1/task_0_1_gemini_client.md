# Task 0.1 – Gemini Multimodal Client (file_data + fallback)

This documents the new multimodal client that powers Iteration 1’s unified Gemini call.

## Entry points

- `callGeminiMultimodalJson(request: GeminiMultimodalRequest): GeminiMultimodalResult`
  - Primary path: `file_data: { mime_type: "video/mp4", file_uri: youtubeUrl }`
  - Fallback: on 403/`file_data` rejection, streams a small media sample (<=5MB), uploads inline (base64), and re-calls once.
  - Returns:
    - `ok: true` → `{ fromFallback: boolean; rawJson: unknown; status }`
    - `ok: false` → `{ errorCode, errorMessage, status? }` with codes: `FEATURE_DISABLED | CONFIG_MISSING | INVALID_URL | UPSTREAM_ERROR | INVALID_RESPONSE | FALLBACK_FAILED`
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
  console.log(result.fromFallback ? "used fallback" : "primary path", result.rawJson);
} else {
  console.error(result.errorCode, result.errorMessage);
}
```

## Privacy & temp media

- No raw media is persisted to disk; fallback keeps a small buffer in memory, zeroes it after use, and removes any temporary handles.

## Manual test checklist

1) Valid YouTube URL with flag on → `ok: true`, `fromFallback: false`.
2) Force entitlement failure (403/file_data) → fallback runs once → `ok: true`, `fromFallback: true`.
3) Bad URL → `INVALID_URL`.
4) No API key → `CONFIG_MISSING`.
5) Corrupt Gemini payload → `INVALID_RESPONSE`.
