# CreatorSight – Functional Upgrade Plan (Grounded Analysis)

Purpose: replace hallucinated, URL-only analysis with grounded signals while staying aligned with the MVP PRD. This plan adds concrete ingestion and scoring steps for the creative domains and optional performance overlay.

---

## 1) Gaps Today
- Gemini is only given a YouTube URL; it cannot see/hear the video, so transcripts, scenes, and all domain judgments are guessed.
- No real audio/text evidence → wrong story/music/voice calls; users see shapes without meaningful text.
- Axis explanations live in multiple places and do not tie back to measured signals.

## 2) Ingestion & Evidence (no persistent video storage)
Data we actually need to collect per video:
- **Metadata**: title, channel, duration (YouTube Data API).
- **Transcript**: official captions via timedtext; fallback ASR.
- **Audio slices**: short-lived temp audio (no persistence) for prosody features and music/SFX detection.
- **Frames & cuts**: lightweight shot boundary detection to estimate cut pace and visual setup changes.

Concrete approach:
1. **Transcript first**  
   - Try YouTube captions (`timedtext`/`captions` APIs).  
   - If missing, stream low-bitrate audio only and run ASR (Whisper-small or Gemini audio). Delete temp files immediately; keep only segmented text+timestamps.
2. **Prosody audio pass (30–90s sampled windows)**  
   - Extract word-level timing from transcript; refine with silence detection to find pauses/resets.  
   - Use DSP on sampled audio windows (e.g., 1s RMS + pitch contour) to compute loudness range and pitch variance. No full-video storage.
3. **Shot/cut detection (lightweight)**  
   - Sample frames at ~1 fps; compute frame diffs or color histograms to flag cuts.  
   - Derive cut rate distribution (early vs late), environment stability (% frames with same background cluster).
4. **Music/SFX detection (lightweight)**  
   - On audio windows, compute spectral centroid/flatness and voice-vs-music energy; mark music coverage %.  
   - Count transient bursts for SFX density; identify silence spans used for emphasis.

All raw audio/frame artifacts are temp only (ephemeral storage), keeping PRD’s “no storage of raw video” intent.

## 3) Domain Scoring Inputs
We will feed Gemini with grounded evidence (not just a URL). Each domain prompt gets:
- Canonical transcript segments (time-aligned).
- Beat/scene boundaries from shot + transcript segmentation.
- Prosody stats (wpm, filler ppm, pause lengths, resets).
- Visual/editing stats (cut pace, environment stability, b-roll % estimate).
- Sound stats (music % coverage, loudness balance, silence spans, SFX density).

### Voice
- Avg words/min + distribution; filler words/min; pause frequency/length; resets per minute.
- Loudness dynamic range; pitch variation within sentences and across video.
- Sample prompt fields: `{speech_rate_wpm, filler_ppm, avg_pause_ms, reset_events, loudness_range_db, pitch_var_within, pitch_var_across}`.

### Language
- Abstract vs concrete ratio (concrete noun density); simile/metaphor density.
- Reference type counts (cultural/historical/scientific); humor frequency.
- Teaching vs riffing tone split (instruction vs opinion vs narrative).

### Narrative
- Explicit beats: hook, setup, escalation, payoff, outro (LLM labels on beats).
- Mini-arc density; foreshadowing, callbacks, open loops, cliffhangers.
- Transition clarity (hard vs guided) derived from cut detection + connective language.

### Visual / Editing / Sound
- Environment stability %; talking-head vs real-world vs graphics time (frame clustering).  
- Cut rate & distribution (fast early, slow later); b-roll coverage % (frames without mouth motion / with overlays).  
- Transitions/pattern interrupts/memes/overlays (from cut anomalies + keyword cues).  
- Music changes, SFX density, silence for emphasis (from audio windows).

## 4) Pipeline Overview (per analysis job)
1. **Fetch metadata** (YouTube Data API).  
2. **Fetch captions**; if absent, **ASR** from streamed audio (temp).  
3. **Segment transcript** into sentences and beats (LLM on text only).  
4. **Audio feature pass** on sampled windows: WPM, fillers, pauses/resets, loudness range, pitch variance, music/SFX/silence spans.  
5. **Visual/editing pass** on sampled frames: cut boundaries, environment clusters, talking-head vs b-roll ratio.  
6. **Assemble evidence bundle** (text, stats, timelines) → **Gemini domain prompts** (one per domain) that cite the evidence explicitly.  
7. **Compute meta axes + archetypes** from domain profiles; persist fingerprint + supporting evidence (textual stats, not raw media).  
8. **Similarity** against reference library; return nearest neighbours + niche averages.  
9. **(Optional) Performance**: if OAuth + ownership, fetch retention/CTR and align with beats/cuts.

## 5) Efficiency & Cost Controls
- Prefer captions → avoid ASR when possible.  
- Sampled audio (e.g., 10 x 20s windows) instead of full-stream DSP.  
- Frame sampling at ~1 fps for cut detection; no video download.  
- Single Gemini call per domain with structured JSON output; deterministic prompts (temp=0.2).  
- Cache transcripts and derived stats by `videoId` to reuse across reruns.

## 6) Outputs (what we store)
- `fingerprint`: domain profiles + meta axes + supporting stats (no raw media).  
- `supporting`: transcript segments, beat map, cut map, prosody/music summaries.  
- `diagnostics`: which evidence sources were used (captions vs ASR; audio/window counts; frame sample rate) and confidence flags.

## 7) Work Plan (implementation-ready)
1. **Captions + ASR**: add caption fetcher; add streamed-audio ASR fallback with immediate deletion of temp files.  
2. **Prosody/stat extractor**: compute WPM, fillers, pauses/resets, loudness range, pitch variance from transcript + audio windows.  
3. **Frame/cut analyzer**: 1 fps sampling + histogram diff to get cut map, environment clusters, b-roll estimate.  
4. **Audio texture analyzer**: music/silence/SFX spans from spectral features on sampled windows.  
5. **Beat + device labeling**: LLM on transcript + cut map to label beats (hook/setup/escalation/payoff/outro), foreshadow/callback/open-loop flags.  
6. **Domain prompt redesign**: inject measured stats into each domain call; enforce schemas with validations.  
7. **Diagnostics & confidence**: log which evidence was present; surface “low confidence” if captions missing or ASR coverage <80%.  
8. **UI text**: display explanatory text per domain pulling from measured stats (not placeholders); include axis hover help from a single metadata source.  
9. **Performance alignment** (optional): map retention points to beats/cuts once OAuth confirms ownership.

## 8) Acceptance Checks
- Story/music detection uses measured beats + music coverage, not guesses.  
- Transcript displayed matches spoken words (captions/ASR); LLM only summarizes, never invents.  
- Axis meanings are sourced from one metadata file and shown consistently.  
- No raw video/audio persists after processing; only derived stats and text remain.  
- End-to-end latency stays within PRD target by sampling (not full-stream) and minimizing Gemini calls.
