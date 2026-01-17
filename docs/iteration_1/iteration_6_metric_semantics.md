# Iteration 6 Metric Semantics (Task 0.1)

Purpose: lock the metric definitions, units, interpretations, and output shapes needed for the alignment/arc/cognitive load upgrade so schema, mock data, and UI share one source of truth.

## Conventions
- Scores are 0–100 with 50 = neutral/balanced unless otherwise noted.
- Diagnostics are arrays/timelines kept alongside scores for UI/tooltips: `{ timeSeconds, value, label? }` unless a different key is called out.
- “Alignment” metrics favor synchronous/intentional coupling across modes; “over-reliance” flags when one mode carries most meaning.

## Prosody Arc (voice/prosody)
- `pace_mean_wpm` — Score + diagnostic timeline (10s windows). Unit: words per minute. Interpretation: low=slow/deliberate, high=fast/pressured; sweet spot 140–190 wpm. Tooltip: “Average speaking pace (wpm).”
- `pace_variability_pct` — Score + diagnostic timeline (10s windows of local coefficient of variation). Unit: % swing vs mean pace. Interpretation: low=flat pacing, high=erratic; mid-range implies purposeful variety. Tooltip: “How much your pace swings from the average.”
- `within_segment_pace_change_pct` — Diagnostic per segment (start→end % change) + stability score (penalizes unintentional drift, rewards deliberate resets). Unit: % change. Interpretation: positive=accelerates, negative=slows/resets; near-zero=stable. Tooltip: “Pace drift inside segments (speed-ups or slowdowns).”
- `emphasis_alignment_score` — Score + diagnostic pairs `{ phrase, timeSeconds, stressed }`. Unit: alignment precision/recall vs detected key phrases. Interpretation: high=stressed syllables land on important words; low=emphasis on throwaways. Tooltip: “Vocal emphasis lands on key phrases.”
- `energy_drift_db_per_min` — Score + slope diagnostic (db/min) and timeline (15s windows). Unit: decibel change per minute. Interpretation: near-zero=steady energy, positive=ramps up, negative=fade/burnout. Tooltip: “Vocal energy trend across the video.”

## Language Texture
- `analogy_example_definition_ratio` — Score + diagnostic counts per 1k words `{ analogies, examples, definitions }`. Unit: ratio. Interpretation: balanced mix (examples + occasional analogies + crisp definitions) scores highest; heavy skew lowers score. Tooltip: “Balance of analogies, examples, and definitions.”
- `sentence_compression_ratio` — Score + distribution diagnostic. Unit: words per atomic idea/clause. Interpretation: low=tight/telegraphic, high=rambling; mid-range (10–18 words/idea) preferred. Tooltip: “How compressed each idea is (words per idea).”
- `humor_timing_score` — Score + diagnostic list `{ setupStart, punchStart, deltaSeconds, landed:boolean }`. Unit: setup→punch delta seconds. Interpretation: high=clear setups with timely punches; low=buried or missing punches. Tooltip: “Setup/punch spacing for jokes.”
- `reference_density_per_min` — Score + diagnostic list of references `{ timeSeconds, type, text }`. Unit: references per minute. Interpretation: low=few touchpoints, high=richly sourced; extreme overload penalized. Tooltip: “How often you cite cultural/topical references.”
- `question_rate` — Score + diagnostic counts `{ totalPerMin, rhetoricalShare, genuineShare }`. Unit: questions per minute and rhetorical vs genuine mix. Interpretation: balanced/genuine engagement scores higher; interrogative barrage or zero questions score lower. Tooltip: “How often you ask questions (and whether they’re genuine).”

## Narrative Arc
- `time_to_hook_seconds` — Diagnostic scalar + contribution to timing score. Unit: seconds from 0 to first hook beat. Interpretation: <10s strong, 10–25s moderate, >25s weak. Tooltip: “How quickly the first hook appears.”
- `hook_strength_score` — Score + diagnostic `{ beatTime, devices[], promiseClarity }`. Unit: 0–100 strength proxy. Interpretation: high=clear promise/tension, low=vague open. Tooltip: “Strength of the opening hook.”
- `segment_cohesion_drift` — Score + diagnostic timeline of adjacent segment similarity deltas. Unit: semantic similarity drop (0–1). Interpretation: high=cohesive flow, low=frequent topic drift. Tooltip: “How smoothly segments relate vs drift.”
- `open_loops_unresolved_ratio` — Score + diagnostic list `{ openedAt, resolvedAt?, label }`. Unit: unresolved/total open loops. Interpretation: high score when most loops close; penalties for dangling loops. Tooltip: “Open loops that never get resolved.”
- `ending_resolution_score` — Score + diagnostic `{ payoffDelivered:boolean, ctaClarity, callbackCount }`. Unit: 0–100. Interpretation: high=clear payoff/closure, low=abrupt or unfinished ending. Tooltip: “How fully the ending resolves promises.”

## Visual/Edit Alignment
- `visual_entropy` — Score + diagnostic timeline (1s windows) of normalized visual change/entropy. Unit: 0–1 normalized entropy. Interpretation: low=static, high=chaotic; mid with purposeful spikes preferred. Tooltip: “Overall visual change rate/entropy.”
- `cut_rate_refinement` — Score + diagnostic `{ medianShotSeconds, variance, beatCouplingDelta }`. Unit: seconds between cuts + variance. Interpretation: high=steady cut pacing with intentional spikes near beats; low=erratic or monotonous. Tooltip: “Cut pacing consistency and intentional peaks.”
- `silence_for_emphasis_fidelity` — Score + diagnostic list `{ start, end, value (strength), label (reset|punch|transition), alignedBeat?, alignedPunchline? }`. Unit: count/duration of silence spans (>0.6s) detected via relative-energy gaps below the local floor (tolerates crowd/bed noise). Interpretation: high when silences coincide with hooks/payoffs or resets; low when absent or mistimed. Tooltip: “Silence used intentionally for emphasis.”

## Cross-modal & Modality Balance
- `audio_visual_emphasis_alignment` — Score + diagnostic pairs `{ timeSeconds, audioPeak, visualPeak, deltaSeconds }`. Unit: alignment offset seconds. Interpretation: high when loudness/pitch/pauses co-occur with cuts/zooms/graphics. Tooltip: “Do audio emphasis moments line up with visual emphasis?”
- `beats_vs_edits_alignment` — Score + diagnostic list `{ beatRole, beatTime, nearestCutDelta }`. Unit: seconds offset. Interpretation: high when narrative beat transitions are supported by edit transitions; low when beats occur mid-shot with no visual support. Tooltip: “Edits reinforce narrative beats.”
- `prosody_vs_semantic_importance_alignment` — Score + diagnostic `{ phrase, importanceScore, stressed:boolean }`. Unit: alignment precision. Interpretation: high when important phrases are vocally stressed; low when stress is on filler. Tooltip: “Prosody matches semantic importance.”
- `redundancy_vs_complementarity` — Score (favoring complementary) + diagnostic proportions `{ redundantPct, complementaryPct, conflictingPct }`. Unit: % of moments. Interpretation: high when modes add new info without conflict; penalties for conflict or pure redundancy. Tooltip: “How audio/visual/text share or add meaning.”
- `modality_over_reliance` — Score where high=over-reliant on one mode; diagnostic `{ dominantMode, dominantPct }`. Unit: % of meaning from top modality. Interpretation: balance preferred; heavy single-mode reliance scores low in balance but high in “over-reliance”. Tooltip: “One modality doing most of the work.”

## Cognitive Load
- `load_per_second` — Diagnostic timeline (1 Hz, smoothed) of load 0–100 derived from pace density, visual entropy, jargon, and cut pace. Interpretation: higher=denser/more taxing. Tooltip: “Moment-by-moment cognitive load estimate.”
- `load_highlights` — Score (inverse of peak overload) + diagnostic top spikes `{ start, end, value, driver }`. Unit: 0–100 for peak load segments. Interpretation: high score when peaks are short/rare; low when sustained overload. Tooltip: “Where cognitive load spikes.”

## Second-order Summary Scores
- `alignment_score` — Aggregates `emphasis_alignment_score`, `audio_visual_emphasis_alignment`, `beats_vs_edits_alignment`, `prosody_vs_semantic_importance_alignment`. Interpretation: high=modalities and emphasis sync. Tooltip: “Overall cross-modal alignment.”
- `drift_score` — Aggregates `energy_drift_db_per_min`, `pace_variability_pct`, `segment_cohesion_drift`. Interpretation: high=stable trajectory with intentional shifts; low=unintended wandering/fade. Tooltip: “How steady the arc stays vs drifts.”
- `decay_score` — Captures degradation over time using `within_segment_pace_change_pct`, `energy_drift_db_per_min`, `load_per_second` tail trend. Interpretation: high=minimal fatigue/decay, low=clear falloff. Tooltip: “Does delivery or clarity decay over time?”
- `balance_score` — Mix of `redundancy_vs_complementarity`, `modality_over_reliance`, and `language` vs `visual_entropy` interplay. Interpretation: high=balanced complementary modes; low=single-mode overload or conflict. Tooltip: “Balance between modalities.”
- `timing_score` — Combines `time_to_hook_seconds`, `hook_strength_score`, `beats_vs_edits_alignment`, `silence_for_emphasis_fidelity`, and punch timing. Interpretation: high=beats, cuts, silences, and punches land at effective times; improved with accurate beat roles and silence alignment. Tooltip: “Timing of hooks, edits, and emphases.”
