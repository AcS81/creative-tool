# Iteration 9 Gap Matrix (Task 0.1)

Purpose: map each `todo.md` factor to current schema fields (or new ones) and define what "done" means for Iteration 9 measurement coverage. Schema names reference `src/lib/types/fingerprint.ts` (advanced metrics) and the multimodal response keys for baseline domains.

Status legend: **existing** = already in schema, needs quality/tolerance improvements. **new** = add field across schema, prompt, defaults, mocks, and validators.

## Prosody, Pace, and Emphasis

| Factor (todo.md) | Schema field(s) | Status | Iteration 9 acceptance |
| --- | --- | --- | --- |
| Speaking pace (mean, variance, intra-segment change) | `voice.speaking_rate` (baseline), `prosodyArc.paceMeanWpm`, `prosodyArc.paceVariabilityPct`, `prosodyArc.withinSegmentPaceChangePct` | existing | - Observed values with units (`wpm`, `%`); baseline `value` not `unobserved` when transcript exists.<br>- `timeline` at <=10s windows for mean/variability; `segments` include signed start->end drift per segment.<br>- Scores reflect coefficient-of-variation and drift direction (accelerate vs slow/reset). |
| Prosodic emphasis vs key phrases | `prosodyArc.emphasisAlignmentScore` | existing | - `items` list with `{ phrase, stressed: boolean }` or equivalent alignment diagnostics.<br>- Alignment computed against detected key phrases (not filler); >=5 phrases checked on a 3-5 min clip.<br>- Score increases with precision/recall of stress on important phrases; false stress lowers score. |
| Energy drift over time | `prosodyArc.energyDriftDbPerMin` | existing | - `value` includes slope with unit (`db/min`) and `trend` sign matches slope.<br>- `timeline` (~15s windows) shows gradual ramp/decay; noise spikes smoothed.<br>- Observed when audio track present; not defaulted to `unobserved` when transcript-only. |
| Silence for emphasis (usable even with crowd/bed noise) | `visual_edit_sound.silence_for_emphasis` (baseline), `visualEditAlignment.silenceForEmphasisFidelity` (advanced) | existing (needs upgrade) | - Detection uses relative-energy + speech-activity gaps vs local floor; ignores crowd/room hum.<br>- `spans` include `startSeconds`, `endSeconds`, duration, and optional `alignedBeat`/`alignedPunchline` labels.<br>- Recall >=80% on labeled pauses in noisy test clips; spans >0.6s required for observation. |

## Language Texture and Audience Address

| Factor (todo.md) | Schema field(s) | Status | Iteration 9 acceptance |
| --- | --- | --- | --- |
| Audience address frequency ("you," "we"; rhetorical vs direct) | `languageTexture.audienceAddressFrequency` (advanced) | **new** | - `value` reports count per minute; `counts` include `{ direct, rhetorical }` (and optional timeline of address events).<br>- Observed when >=1 direct/rhetorical address detected; zero-count clips mark `observed=false` with `value="unobserved"`.<br>- Precision guard: avoids counting quoted speech; ties to sentence boundaries. |
| Analogy vs example vs definition ratio | `languageTexture.analogyExampleDefinitionRatio` | existing | - `counts` for `{ analogies, examples, definitions }` populate; `value` expresses ratios (e.g., `2/5/1`).<br>- Observed whenever transcript tokens >0; balanced mix scores highest. |
| Sentence complexity/compression | `languageTexture.sentenceCompressionRatio` | existing | - `value` in words-per-idea; distribution or `timeline` shows spread.<br>- Observed when transcript parsed; not left `unobserved` on non-empty text. |
| Humor signals (setup/punch timing) | `languageTexture.humorTimingScore` | existing | - `items` include `{ setupStart, punchStart, deltaSeconds, landed }`; positive deltas required.<br>- Observed when >=1 candidate joke; otherwise `observed=false` with explicit `value="unobserved"`. |
| Reference density (cultural/topical/personal) | `languageTexture.referenceDensityPerMin` | existing | - `value` in refs/min; `counts` by type (cultural/topical/personal/etc.).<br>- Observed when any reference present; empty clips mark unobserved. |
| Question rate (rhetorical vs genuine) | `languageTexture.questionRate` | existing | - `value` in questions/min; `counts` include `{ rhetorical, genuine }`.<br>- Observed when questions detected; rhetorical share influences score. |
| Metaphor density (biggun) | `language.metaphor_density` (baseline domain) | existing | - `value` in metaphors per 1k words; explanation populated.<br>- Observed whenever transcript exists; aligns with axis metadata/tooltips. |

## Narrative and Arc Understanding

| Factor (todo.md) | Schema field(s) | Status | Iteration 9 acceptance |
| --- | --- | --- | --- |
| Act/arc understanding (beats, hook/setup/escalation/payoff/outro) | `narrative.beats` (baseline) feeding `BeatSegment.role`, plus advanced `narrativeArc.*` | existing | - Beats include roles with `start`/`end`; hook role present for time-to-hook.<br>- Devices tracked in `narrative.devices`; beats power downstream alignment (edits, timing score). |
| Time-to-hook | `narrativeArc.timeToHookSeconds` | existing | - Derived from first `hook` beat; `value` numeric seconds.<br>- Observed when hook beat exists; contributes to `timingScore`. |
| Hook strength proxy | `narrativeArc.hookStrengthScore` | existing | - `items` include `{ beatTime, devices[], promiseClarity }`; higher scores for clear promise/tension.<br>- Observed whenever a hook beat is present. |
| Segment cohesion and drift | `narrativeArc.segmentCohesionDrift` | existing | - `timeline` of adjacent-segment similarity deltas; negative swings highlight drift.<br>- Observed when >=2 segments; feeds `driftScore`. |
| Open loops left unresolved | `narrativeArc.openLoopsUnresolvedRatio` | existing | - `items` list `{ openedAt, resolvedAt?, label }`; ratio = unresolved/total.<br>- Observed when any loops detected; unresolved loops lower score and timing. |
| Ending strength/resolution completeness | `narrativeArc.endingResolutionScore` | existing | - `items` include `{ payoffDelivered, ctaClarity, callbackCount }`.<br>- Observed when ending evaluated; ties to closure of open loops. |

## Visual/Edit Dynamics and Emphasis Alignment

| Factor (todo.md) | Schema field(s) | Status | Iteration 9 acceptance |
| --- | --- | --- | --- |
| Visual entropy (overall visual change rate) | `visualEditAlignment.visualEntropy` | existing | - `timeline` (~1s windows) normalized 0-1; spikes correspond to edits/overlays.<br>- Observed when video frames available; unobserved only on media failure. |
| Cut rate (biggun) | `visual_edit_sound.cut_rate` (baseline), `visualEditAlignment.cutRateRefinement` (advanced) | existing | - Baseline `value` in avg seconds between cuts.<br>- Advanced `items` include `{ medianShotSeconds, variance, beatCouplingDelta }`; `timeline` shows consistency and intentional spikes near beats. |
| Audio-visual emphasis alignment | `visualEditAlignment.audioVisualEmphasisAlignment` | existing | - `timeline` or `items` with peak pairs and `deltaSeconds`; aligned when |delta| <=0.5-1.0s.<br>- Observed when both audio peaks and visual peaks detected; fuels `alignmentScore`. |
| Narrative beats vs edit changes alignment | `visualEditAlignment.beatsVsEditsAlignment` | existing | - `items` tie each beat (with role) to nearest cut and offset; payoff/hook beats expected to be supported by cuts.<br>- Observed when beats + cut timeline available; offsets reported even when misaligned. |
| Prosody vs semantic importance alignment | `visualEditAlignment.prosodyVsSemanticImportanceAlignment` | existing | - `items` include `{ phrase, importanceScore, stressed }`; coverage of top phrases per clip.<br>- Observed when key phrases extracted; mis-stress lowers score. |

## Modality Balance, Cognitive Load, and Second-order Scores

| Factor (todo.md) | Schema field(s) | Status | Iteration 9 acceptance |
| --- | --- | --- | --- |
| Redundancy vs complementarity across modes | `modalityBalance.redundancyVsComplementarity` | existing | - `proportions` populated `{ redundantPct, complementaryPct, conflictingPct }` summing to 1.<br>- Observed when audio, visual, and text signals present; complementary share >0 for non-static videos. |
| Modality over-reliance score | `modalityBalance.modalityOverReliance` | existing | - `proportions` include modality shares (e.g., `{ voicePct, visualPct, textPct }`); dominant mode named in `value`.<br>- High score reflects over-reliance; feeds `balanceScore`. |
| Cognitive load per second | `cognitiveLoad.loadPerSecond`, `cognitiveLoad.loadHighlights` | existing | - `timeline` at >=1 Hz with smoothing; values 0-100.<br>- `loadHighlights.spans` capture peak windows with `label` driver (e.g., rapid cuts, jargon).<br>- Observed when any upstream metric present; unobserved only if inputs missing. |
| Second-order properties (Alignment, Drift, Decay, Balance, Timing) | `secondOrder.alignmentScore`, `driftScore`, `decayScore`, `balanceScore`, `timingScore` | existing | - Derived from underlying advanced metrics (per `iteration_6_metric_semantics.md`); no static defaults.<br>- `observed` only when component metrics observed; otherwise `value="unobserved"`.<br>- Each score reflects component changes (e.g., `alignmentScore` moves with emphasis/edit/semantic alignment; `timingScore` responds to hook timing, beats vs edits, silence spans). |

## Measurement correctness thresholds (Iteration 9)
- Silence gaps: recall >=0.8 on labeled pauses >0.6s in noisy clips; false positives <=0.2; beat/punchline alignment offset <=0.7s for aligned spans.
- Pace/energy: pace mean MAE <=10 wpm vs labeled; pace variability pct MAE <=5 points; within-segment drift sign matches labels >=0.85 of the time; energy drift slope error <=0.5 dB/min on 5 min clips.
- Audience address: precision >=0.8 and recall >=0.7 for direct/rhetorical "you/we" detection (excluding quoted speech); counts per minute within 10% of labels on 3–5 min clips.
- Language texture: analogy/example/definition counts within 15% of label totals; sentence compression median within 2 words/idea; humor timing delta error <=1.0s on labeled setups/punches; reference type counts within 1 of labels per minute; question rate within 0.3 q/min of labels with rhetorical/genuine split error <=0.15 fraction.
- Arc/act: beat role accuracy >=0.75 on labeled set; time-to-hook error <=3s; hook strength ordering (strong>weak) preserved on labeled pairs; open loop resolution ratio within 0.15 absolute; ending resolution callback count within 1 of labels.
- Visual/edit dynamics: cut detection median error <=0.3s; visual entropy timeline populated >=95% of runtime; cut refinement median within 0.4s of label and variance within 20%; beat-to-cut offset median <=0.8s when aligned beats exist.
- Cross-modal alignment: audio-visual emphasis and prosody-vs-semantic importance offsets median <=0.7s; redundancy/complementarity proportions within 0.1 absolute vs labels on mixed-modality clips.
- Cognitive load: timeline values track composite drivers with MAE <=8 points vs labeled reference; load highlight spans recover >=80% of labeled overload windows.
- Second-order: scores move in the correct direction for paired fixtures (aligned vs misaligned, steady vs drifty); deltas >=10 points in the expected direction for each paired comparison.

## Rollback flag behaviour
- Environment flag: `ENABLE_ADVANCED_METRICS=false` forces defaults via `getAppConfig` (`advancedMetricsEnabled=false`).
- Service path: `analysis/service.ts` skips Gemini advanced metrics when the flag is false and uses `buildDefaultAdvancedMetrics()` while surfacing `Advanced metrics disabled via ENABLE_ADVANCED_METRICS=false.` in diagnostics.
- Diagnostics: `advancedMetricsObservedBySection` flags which advanced metric groups were populated vs defaulted.
- Schema stability: fingerprint still emits v1.3.0 shape with advanced blocks present but marked unobserved; downstream UI should remain stable.
