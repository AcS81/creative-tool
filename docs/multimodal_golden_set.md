# CreatorSight – Multimodal Golden Video Set (Iteration 2 QA)

Use these public YouTube videos as a repeatable QA set for multimodal analysis. Each entry lists why it was chosen and the expected qualitative outputs (story presence, music coverage, editing pace, etc.).

Run guidance:
- Enable `analysis_v2_multimodal` and a valid `GEMINI_API_KEY`.
- Use `npm run probe:ingestion -- --url <video>` if you need to verify ingestion/fallback behaviour first.
- Prefer the `/dev/multimodal` runner to capture unobserved counts and fallback usage.

## Video A – Strong Story Arc, No Music
- URL: https://www.youtube.com/watch?v=2b6KuoWZ6n0
- Why: Clear hook → setup → escalation → payoff; minimal background music.
- Expected:
  - Narrative: Story presence high; beats with hook/setup/escalation/payoff visible; devices like callbacks/contrast present.
  - Sound: Music coverage ~0–5%; music changes near zero; silence_for_emphasis present.
  - Editing: Cut rate medium (~3–5s); few pattern interrupts.

## Video B – Heavy Continuous Background Music, Weak Narrative
- URL: https://www.youtube.com/watch?v=JGwWNGJdvx8
- Why: Music bed runs almost entire runtime; narrative is secondary to performance.
- Expected:
  - Sound: Music coverage >70%; multiple music_changes; music vs voice balanced or slightly high.
  - Narrative: Story_presence low/medium; beats mostly generic (intro/chorus/outro), minimal devices.
  - Editing: Cut rate medium-fast; visual_edit_sound shows B-roll/graphics supporting music.

## Video C – Fast-Cut Commentary with Memes/Pattern Interrupts
- URL: https://www.youtube.com/watch?v=QwZT7T-TXT0
- Why: High-frequency cuts, overlays/memes, commentary-style pacing.
- Expected:
  - Editing: Cut rate high (<2s avg); pattern_interrupts present; broll_coverage moderate.
  - Sound: Music coverage moderate (~40–60%) with a few changes.
  - Narrative: Story_presence low; beats more segment-based than arc-based.

## Video D – Tutorial/Explainer with Light Music and Screenshare
- URL: https://www.youtube.com/watch?v=Ke90Tje7VS0
- Why: Instructional, stable setup, occasional light music, screenshare/graphics.
- Expected:
  - Narrative: Transition_clarity high; story_presence low/medium; beats aligned to steps.
  - Sound: Music coverage light (~15–35%); few music_changes; silence minimal.
  - Visual/Edit: Environment_stability high; talking_vs_broll_vs_graphics shows significant graphics/screenshare.

## Video E – Vlog with Multiple Setups and Occasional Music Stings
- URL: https://www.youtube.com/watch?v=GPeeZ6viNgY
- Why: Multiple locations, movement, occasional music stings to bridge scenes.
- Expected:
  - Visual: Environment_stability mid/low (many setups); movement high.
  - Sound: Music coverage low/medium (~20–40%) with several short music_changes/stings.
  - Narrative: Mini_arc_density medium; clear intro/outro; devices may include contrast or payoff.
