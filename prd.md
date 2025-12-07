
CreatorSight – MVP Product Requirements Document

0. Document Info
	•	Product Name: CreatorSight (working title)
	•	Version: 1.0 (MVP – Gemini + YouTube URL)
	•	Status: Draft
	•	Owner: [Your Name]
	•	Last Updated: 5 Dec 2025

⸻

1. Product Overview

1.1 One-liner

CreatorSight is a creative x-ray for YouTube videos: paste a YouTube URL and get a deep, personality-style analysis of how you speak, think, appear, edit, and sound, plus how you compare to established YouTubers across those dimensions.

1.2 Problem

Existing tools (TubeBuddy, vidIQ, basic YouTube Studio):
	•	Focus on surface metrics (CTR, views, retention).
	•	Give generic optimization tips (“shorten intro”, “better thumbnail”).
	•	Don’t tell creators:
	•	What their voice style actually is.
	•	How their editing, body language, and story structure function.
	•	How they compare creatively to channels they admire.
	•	What creative archetype they fall into.

Creators who care about craft and identity want:
	•	A high-resolution mirror that shows them who they are on camera.
	•	A way to understand themselves in relation to the ecosystem of great creators.

1.3 Solution

CreatorSight takes a YouTube video (via URL) and:
	1.	Uses multimodal AI (Gemini) to analyze:
	•	Voice & delivery (energy, expressiveness, clarity, warmth, flow).
	•	Language & thinking (abstract vs concrete, story vs explanation).
	•	Narrative structure (beats, hooks, devices like contrast/callbacks).
	•	Visual presence (environment, movement, expression).
	•	Editing & pacing (perceived cuts, pattern interrupts, B-roll).
	•	Soundscape (music, SFX, silence).
	2.	(Optionally) Uses YouTube Analytics (if the user owns the video & connects their channel) to overlay:
	•	Retention curve
	•	CTR & engagement
	•	Performance vs structure moments.
	3.	Produces a “creative fingerprint” and maps the creator into:
	•	Domain-specific archetypes (e.g. “Reflective Analyst Voice”, “Essayist Narrative”).
	•	An overall creator archetype.
	•	Similarity to a library of reference creators (top ~100 YouTubers analyzed in advance).
	4.	Displays everything in a visual, archetype-based UI:
	•	Radar/pentagram charts per domain plus a second spectrum-style chart (hexagram/diamond) per domain
	•	Archetype cards with example channels
	•	“Where you’re unusual vs typical”
	•	“Who you’re most like” in the YouTube universe.

MVP: no PDFs, just web UI.

⸻

2. Scope, Goals, Non-goals

2.1 MVP Scope
	•	Platform: YouTube only.
	•	Input: Public / unlisted YouTube URL (no file uploads).
	•	Analysis: Gemini-based multimodal understanding, prompt+schema driven (no in-house CV/DSP).
	•	Users:
	•	Normal creators (paste their own or others’ videos).
	•	Internal use for reference creators (top channels) to seed comparison library.

2.2 Goals (MVP)
	1.	Analyze any public YouTube video by URL
	•	No download or local processing.
	•	Use Gemini to get transcript, segments, qualitative metrics for voice, visual, story, editing, sound.
	2.	Compute a creative fingerprint per video
	•	Compact structured representation across domains (voice, language, narrative, visual, editing, audio, performance*).
	3.	Support two Creator types
	•	user (regular users).
	•	reference (established YouTubers you pre-analyze).
	4.	Build an internal reference library
	•	At least ~50–100 reference creators with fingerprints.
	•	Store them separately, for similarity comparisons.
	5.	Present results visually
	•	“Overview” page with overall archetype + big radar.
	•	Per-domain views:
	•	Radar/pentagram for that domain.
	•	Archetype name & description.
	•	Example YouTubers from that archetype.
	•	Short, human-readable explanation of their style.
	6.	Optionally align with real performance data
	•	If and only if user connects their YouTube (OAuth) and owns the video:
	•	Fetch retention, CTR, etc. and show a simple retention vs content timeline.

2.3 Non-goals (MVP)
	•	❌ No local download of videos, no ffmpeg, no custom ML models.
	•	❌ No TikTok, Instagram, or Shorts support.
	•	❌ No multi-video channel analysis yet (aggregated “career” profile is later).
	•	❌ No live recording feedback or real-time coaching.
	•	❌ No script editing or idea generation tools.
	•	❌ No PDFs or report export (for now; HTML-only).
	•	❌ No advanced team/agency features.

⸻

3. Users & Use Cases

3.1 Users

U1 – Curious Creator (URL-only)
	•	Pastes a YouTube URL (their own or someone else’s).
	•	Wants to see their creative fingerprint and archetype.
	•	Doesn’t connect YouTube Analytics.

U2 – Serious Creator (with Analytics)
	•	Owns a channel, logs in via Google OAuth.
	•	Wants creative analysis and performance context (retention, CTR).
	•	Likely to pay for repeated analyses.

Internal User – You (or the team)
	•	Uses the same system to analyze large channels and mark them as reference creators.
	•	Curates which archetypes they exemplify.

3.2 Core use cases
	1.	Analyze my video
	•	Paste URL → see who I am creatively in that video, and who I resemble.
	2.	Compare myself to big channels
	•	See that my voice is like X, my editing like Y, my narrative like Z.
	3.	Analyze established creators (internal)
	•	Run the system on big channels’ iconic videos.
	•	Store their fingerprints as reference anchors for everyone else.
	4.	(Optional) See performance vs content
	•	For my own video: see retention curve and where viewers drop vs what I’m doing (hook, tangent, rant, etc.).

⸻

4. High-level UX / Visualizations

(This guides the product, not exact UI spec.)

4.1 Overview Screen
	•	Top section:
	•	Big card:
	•	Overall Archetype name (e.g. “Reflective Reactor”, “Hyperactive Commentator”).
	•	Short description (2–3 lines).
	•	Chips showing per-domain archetypes:
	•	Voice: Reflective Analyst
	•	Language: Philosopher Teacher
	•	Narrative: Essayist with Beats
	•	Visual: Static Lecturer with Expressive Body
	•	Editing: Medium-paced Commentary
	•	Sound: Subtle Underscore
	•	Center:
	•	Large radar chart with 5 meta axes:
	1.	Voice intensity
	2.	Conceptual depth
	3.	Narrative structure strength
	4.	Visual dynamism
	5.	Production polish
	•	Shows user polygon vs a faint niche-average polygon.
	•	Below:
	•	Closest famous neighbours: row of creator avatars + labels like:
	•	Voice closest to: X
	•	Editing closest to: Y
	•	Story closest to: Z
	•	“Where you’re unusual” bullet list:
	•	“More abstract than 85% of channels in [topic].”
	•	“Much higher environment stability than typical.”
	•	“Resets in bottom 20% of our dataset.”
	•	Tabs / links to deep-dive sections:
	•	Voice, Language, Narrative, Visual, Editing, Sound, Performance (if available).

⸻

4.2 Voice View (“Your Voice”)

Left: Voice pentagram (5 axes, independent facets)
	•	Energy (low–high)
	•	Expressiveness (flat–varied)
	•	Clarity (muddy–precise)
	•	Warmth (cold–intimate)
	•	Flow/Resets (rambling–rhythmic)

Overlay:
	•	Your filled polygon.
	•	Faint outlines for 2–3 voice archetypes.

Right: Archetype card
	•	Primary voice archetype (e.g. “Reflective Analyst”)
	•	Secondary archetype (e.g. “Storyteller Host”)
	•	2–3 sentence description.
	•	Example creators with similar voice fingerprints.

Below: Spectrum chart (3–4 axes with meaningful midpoints, e.g. Pace balance, Calm ↔ Animated, Structured ↔ Riffing, Intimate ↔ Broadcast). Copy emphasizes what low/mid/high mean; mid can be desirable.

Below: Breakdown of B1–B3 in simple bars / labels:
	•	Prosody (pitch, loudness, speech rate, resets).
	•	Habits (filler words, questions, “I vs you vs we”).
	•	Emotional tone & arc.

Same pattern will apply to other domains, just with different axes/archetypes.

⸻

4.3 Other domain views (same pattern)

Each domain gets:
	1.	Radar/pentagram with ~5 key independent axes.
	2.	Second chart: 3–4 spectrums (hexagram/diamond) with balanced midpoints; show “unobserved/low-confidence” states and short copy on what each side means.
	2.	Domain archetype card (with example creators).
	3.	Domain explanation (1–2 paragraphs of LLM-generated text).
	4.	Some simple supporting visuals:
	•	Timeline for narrative & performance.
	•	Word highlights for language.
	•	Simple counts/badges for editing & sound.

Domains:
	•	Language & Content (C) – “How You Think on Camera”
	•	Narrative & Structure (D) – “How You Tell a Story”
	•	Visual Presence (E) – “How You Appear”
	•	Editing & Pacing (F) – “How Your Video Moves”
	•	Soundscape (G) – “How You Sound Beyond Your Voice”
	•	Performance (H) – “How the Audience Responds” (only if analytics connected)

⸻

5. Functional Requirements (MVP)

5.1 Input & Video Handling

FR-1: YouTube URL intake
	•	Users can paste a valid YouTube URL (public / unlisted).
	•	System validates format and reachability.
	•	No downloading or storing raw video.

FR-2: Video metadata retrieval
	•	Use YouTube Data API to get:
	•	title, description, duration, channel name, publish date.
	•	Used for display and niche inference.

⸻

5.2 Creator Profiles & Reference Creators

FR-3: Creator profiles
	•	System maintains CreatorProfile records with:
	•	id, type ("user" or "reference"), channel_id (optional), name, metadata.

FR-4: Reference creators
	•	Any video analyzed can be marked as:
	•	creator_profile.type = "reference".
	•	Reference creators are:
	•	top channels you choose and process internally.
	•	Their fingerprints are stored and used for similarity comparisons, but their full reports are not shown to other users.

⸻

5.3 Gemini-based Analysis

FR-5: Transcript & segmentation
	•	For a given YouTube URL:
	•	Call Gemini video understanding to:
	•	Generate a transcript in segments with approximate timestamps.
	•	Segment video into logical scenes/sections with short summaries.

FR-6: Voice analysis (B1–B3)
	•	Ask Gemini to analyze:
	•	Pitch level & variation (qualitative)
	•	Loudness & variation (qualitative)
	•	Speech rate (slow/med/fast)
	•	Pause & reset patterns (qualitative)
	•	Filler word frequency & types
	•	Emotional tone & arc
	•	Output is a qualitative voice profile (e.g. low/med/high, or 0–100 approximate scores).

FR-7: Language & content analysis (C)
	•	Gemini on transcript to estimate:
	•	Abstract vs concrete ratio
	•	Story vs explanation vs instruction vs humor ratios
	•	Visualizability score
	•	Example density
	•	Output: normalized categorical or 0–100 scores.

FR-8: Narrative & device analysis (D)
	•	Segment transcripts into beats (20–80 per video).
	•	Classify each beat’s role (hook, setup, explanation, story, tangent, escalation, payoff, CTA, outro).
	•	Detect story devices in beats:
	•	Contrast, foreshadow, callback, analogy/simile, reversal, pattern interrupt, stakes change.
	•	Summarize densities & arc.

FR-9: Visual presence analysis (E)
	•	Ask Gemini to estimate:
	•	Environment stability (% time same background)
	•	Number of visually distinct setups
	•	Creator movement level (body)
	•	Facial expressiveness, eye contact style
	•	Output: qualitative levels + a few tags.

FR-10: Editing & pacing analysis (F)
	•	Ask Gemini:
	•	Perceived cut frequency (slow/med/fast)
	•	Transition style (mostly hard cuts / stylized / chaotic)
	•	B-roll presence & usage style
	•	Moments of strong visual pattern interrupts.

FR-11: Soundscape analysis (G)
	•	Ask Gemini:
	•	Approx. % of video with background music
	•	Music loudness vs voice (under / balanced / overpowering)
	•	Music mood
	•	SFX usage and purposefulness
	•	Silence & dead-air pockets.

⸻

5.4 Performance Integration (Optional, H)

FR-12: YouTube OAuth (optional)
	•	Allow users to connect their YouTube channel via Google OAuth.
	•	Scopes: read-only access to their data.

FR-13: Analytics retrieval (optional)
	•	For a connected user’s own video:
	•	Fetch retention curve (elapsedVideoTimeRatio vs audienceWatchRatio / relativeRetentionPerformance).
	•	Fetch CTR, views, avg view duration, likes, comments.
	•	Align retention points with beat structure for display.

If user does not connect YouTube, this step is skipped; the rest of the analysis still works.

⸻

5.5 Fingerprint & Similarity

FR-14: Creative fingerprint construction
	•	System aggregates all domain outputs into a compact fingerprint JSON, including:
	•	voice_profile
	•	language_profile
	•	narrative_profile
	•	visual_profile
	•	editing_profile
	•	sound_profile
	•	performance_profile (if available)

FR-15: Reference library & similarity
	•	System stores fingerprints for all reference CreatorProfiles.
	•	For any new video:
	•	Compute similarity to reference fingerprints for each domain.
	•	Identify top N nearest reference creators per domain.
	•	Expose names/avatars in UI as “closest neighbours”.

⸻

5.6 UI & Visualization

FR-16: Overview page
	•	Show:
	•	Overall archetype card.
	•	Global radar chart with meta axes.
	•	“Closest neighbours” section.
	•	“Where you’re unusual” section.
	•	Links/tabs to domain views.

FR-17: Domain views (Voice, Language, Narrative, Visual, Editing, Sound, Performance)
	•	For each:
	•	Radar/pentagram with 5 axes.
	•	Archetype card with description & example creators.
	•	Domain text explanation.
	•	Supporting small visuals (bars, timelines, tags).

FR-18: Session management
	•	User can re-run analysis on another URL.
	•	Basic session or simple account structure to revisit past analyses (lightweight for MVP).

⸻

6. Non-functional Requirements
	•	Latency:
	•	Acceptable for MVP: up to ~5–10 minutes for a 20-minute video (processing is asynchronous; UI should show job status).
	•	Cost:
	•	Target per video analysis cost: < $0.50–$1.00 using efficient Gemini variants and limited prompt calls.
	•	Scalability:
	•	MVP: limited volume (invite-based / early access).
	•	Architecture with a queue-based worker model for future scaling.
	•	Reliability:
	•	If any analysis sub-call fails, mark that domain as “partial” and still show others.
	•	Log failures for debugging.
	•	Privacy & Data:
	•	No storage of raw video.
	•	Store only:
	•	YouTube URLs
	•	Derived fingerprints
	•	Reports/archetype results
	•	OAuth tokens encrypted and revocable.

⸻

7. Data & Architecture (High-level, No Schemas Yet)
	•	Entities:
	•	CreatorProfile (type: user|reference)
	•	VideoAnalysis (per-analyzed video)
	•	VideoFingerprint (JSON blob per analysis)
	•	Pipelines:
	•	URL → Gemini: main analysis pipeline.
	•	Optional Analytics: URL + OAuth → YouTube Analytics pipeline.
	•	Fingerprint builder: merges all domain outputs into a canonical structure.
	•	Similarity engine: computes distances between user fingerprints and reference library.
	•	Front-end:
	•	Single-page/web app with Overview + domain tabs, visualizations built from the fingerprint JSON.

⸻

8. Roadmap & Iterations

MVP (this PRD)
	•	URL input.
	•	Gemini-based analysis across all domains (qualitative).
	•	Fingerprint + reference similarity.
	•	Overview + domain visualizations.
	•	Optional YouTube OAuth for performance overlay.

Future Iterations (beyond this PRD)
	•	Channel-level aggregation (multiple videos → stable creator profile).
	•	Finer-grained numeric analysis via additional APIs (Video Intelligence, dedicated audio prosody if you relax “URL-only”).
	•	Export/shareable reports.
	•	Full coaching layer (suggestions, exercises, “break your archetype” mode).
	•	Support for TikTok/Shorts/Reels.