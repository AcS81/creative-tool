# CreatorSight Prompt Templates

## Document Information
- **Purpose**: Canonical prompts for each analysis tier
- **Related**: `creatorsight-stability-refactor.md`
- **Status**: Ready for implementation

---

## Design Principles

### 1. Context-First
Every prompt includes relevant context from prior tiers. The model should understand:
- What kind of video this is
- What it's already analyzed
- What specifically it needs to measure now

### 2. Output-Constrained
- Explicit JSON schemas in every prompt
- Hard limits on array lengths
- No prose, JSON only

### 3. Graceful Unknowns
- Always provide `observed: false` escape hatch
- Never ask model to guess or hallucinate
- Prefer "unobserved" over wrong data

### 4. Duration-Aware
- Different prompts/limits for different video lengths
- Explicit timeline point caps
- Chapter-aware chunking

---

## Tier 0: Structure Pass

### Primary Prompt

```
SYSTEM:
You are a video structure analyzer. Your job is to understand HOW a video is organized, not to measure or score anything.

USER:
Analyze the structure of this YouTube video.

VIDEO URL: {{youtubeUrl}}

Return JSON matching this exact schema:

{
  "durationSeconds": number,
  "videoType": "tutorial" | "essay" | "vlog" | "reaction" | "interview" | "documentary" | "entertainment" | "other",
  "topicSummary": "2-3 sentence summary of what this video is about",
  
  "chapters": [
    {
      "id": "ch1",
      "title": "Chapter title (use YouTube chapter if available)",
      "startSeconds": number,
      "endSeconds": number,
      "summary": "One sentence describing this chapter",
      "chapterType": "intro" | "hook" | "body" | "example" | "tangent" | "conclusion" | "cta" | "outro"
    }
  ],
  
  "keyMoments": [
    {
      "type": "hook" | "peak" | "twist" | "payoff" | "cta",
      "timestamp": number,
      "chapterId": "ch1",
      "description": "10 words max describing this moment"
    }
  ],
  
  "contentMix": {
    "talkingHeadPct": number,
    "brollPct": number,
    "graphicsPct": number,
    "screencastPct": number,
    "otherPct": number
  },
  
  "analysisHints": {
    "hasMusic": boolean,
    "hasSFX": boolean,
    "hasOnScreenText": boolean,
    "hasMultipleSpeakers": boolean,
    "primaryLanguage": "en" | "es" | "other",
    "estimatedComplexity": "low" | "medium" | "high"
  }
}

RULES:
1. Chapters: Create {{chapterCount}} chapters that evenly cover the video
2. If YouTube provides chapters in the video, use those titles
3. keyMoments: Only mark {{keyMomentCount}} most important narrative moments
4. All descriptions must be under 15 words
5. contentMix percentages must sum to 100
6. JSON only - no explanations, no prose

CHAPTER COUNT GUIDE:
- Under 3 minutes: 3-4 chapters
- 3-10 minutes: 4-5 chapters
- 10-20 minutes: 5-6 chapters
- Over 20 minutes: 6-7 chapters
```

### Fallback Prompt (if primary fails)

```
SYSTEM:
You are a video structure analyzer. Return minimal structure information.

USER:
Analyze the basic structure of this video: {{youtubeUrl}}

Return JSON:
{
  "durationSeconds": number,
  "videoType": "tutorial" | "essay" | "vlog" | "reaction" | "interview" | "documentary" | "entertainment" | "other",
  "topicSummary": "1 sentence summary",
  "chapterCount": number (estimate 3-7),
  "hasHook": boolean,
  "hasCTA": boolean,
  "contentMix": {
    "talkingHeadPct": number,
    "brollPct": number,
    "graphicsPct": number,
    "screencastPct": number,
    "otherPct": number
  }
}

JSON only.
```

---

## Tier 1: Core Metrics

### Per-Chapter Prompt

```
SYSTEM:
You are a video metrics analyzer. Measure specific attributes of video content and return structured scores.

USER:
Analyze this chapter of a {{videoType}} video.

VIDEO URL: {{youtubeUrl}}
VIDEO CONTEXT: "{{topicSummary}}"

CHAPTER: "{{chapterTitle}}" ({{chapterType}})
TIME RANGE: {{startSeconds}}s - {{endSeconds}}s ({{chapterDuration}} seconds)

Measure these metrics for THIS CHAPTER ONLY and return scores (0-100):

{
  "chapterId": "{{chapterId}}",
  
  "voice": {
    "speakingRate": { "score": number, "value": "X wpm", "observed": boolean },
    "fillerRate": { "score": number, "value": "X per min", "observed": boolean },
    "pauseUsage": { "score": number, "value": "description", "observed": boolean },
    "loudnessRange": { "score": number, "value": "description", "observed": boolean },
    "pitchVariation": { "score": number, "value": "description", "observed": boolean },
    "clarity": { "score": number, "value": "description", "observed": boolean },
    "warmth": { "score": number, "value": "description", "observed": boolean }
  },
  
  "language": {
    "concreteness": { "score": number, "value": "description", "observed": boolean },
    "metaphorDensity": { "score": number, "value": "X per 1k words", "observed": boolean },
    "references": { "score": number, "value": "description", "observed": boolean },
    "humor": { "score": number, "value": "description", "observed": boolean },
    "teachingVsRiffing": { "score": number, "value": "description", "observed": boolean },
    "storyPresence": { "score": number, "value": "description", "observed": boolean }
  },
  
  "narrative": {
    "structureClarity": { "score": number, "value": "description", "observed": boolean },
    "hookPresence": { "score": number, "value": "description", "observed": boolean },
    "transitionQuality": { "score": number, "value": "description", "observed": boolean },
    "payoffDelivery": { "score": number, "value": "description", "observed": boolean }
  },
  
  "visual": {
    "cutRate": { "score": number, "value": "X sec avg between cuts", "observed": boolean },
    "environmentStability": { "score": number, "value": "description", "observed": boolean },
    "movement": { "score": number, "value": "description", "observed": boolean },
    "expression": { "score": number, "value": "description", "observed": boolean }
  },
  
  "sound": {
    "musicCoverage": { "score": number, "value": "X% with music", "observed": boolean },
    "musicBalance": { "score": number, "value": "description", "observed": boolean },
    "sfxDensity": { "score": number, "value": "description", "observed": boolean },
    "silenceUsage": { "score": number, "value": "description", "observed": boolean }
  }
}

SCORING GUIDE:
- 0-20: Very low / Poor / Absent
- 21-40: Low / Below average
- 41-60: Moderate / Average
- 61-80: High / Above average
- 81-100: Very high / Excellent / Dominant

RULES:
1. Only analyze the specified time range
2. Set observed:false if you cannot confidently measure that metric
3. Value strings should be short (under 20 characters) with units where applicable
4. Score 0 only if metric is completely absent, not just low
5. JSON only - no explanations
```

### Full Video Core Prompt (for short videos < 3 min)

```
SYSTEM:
You are a video metrics analyzer. Measure specific attributes of video content and return structured scores.

USER:
Analyze this {{videoType}} video.

VIDEO URL: {{youtubeUrl}}
VIDEO CONTEXT: "{{topicSummary}}"
DURATION: {{durationSeconds}} seconds

Measure these metrics for the ENTIRE VIDEO and return scores (0-100):

{
  "voice": {
    "speakingRate": { "score": number, "value": "X wpm", "observed": boolean },
    "fillerRate": { "score": number, "value": "X per min", "observed": boolean },
    "pauseUsage": { "score": number, "value": "description", "observed": boolean },
    "loudnessRange": { "score": number, "value": "description", "observed": boolean },
    "pitchVariation": { "score": number, "value": "description", "observed": boolean },
    "clarity": { "score": number, "value": "description", "observed": boolean },
    "warmth": { "score": number, "value": "description", "observed": boolean }
  },
  
  "language": {
    "concreteness": { "score": number, "value": "description", "observed": boolean },
    "metaphorDensity": { "score": number, "value": "X per 1k words", "observed": boolean },
    "references": { "score": number, "value": "description", "observed": boolean },
    "humor": { "score": number, "value": "description", "observed": boolean },
    "teachingVsRiffing": { "score": number, "value": "description", "observed": boolean },
    "storyPresence": { "score": number, "value": "description", "observed": boolean }
  },
  
  "narrative": {
    "structureClarity": { "score": number, "value": "description", "observed": boolean },
    "hookPresence": { "score": number, "value": "description", "observed": boolean },
    "transitionQuality": { "score": number, "value": "description", "observed": boolean },
    "payoffDelivery": { "score": number, "value": "description", "observed": boolean }
  },
  
  "visual": {
    "cutRate": { "score": number, "value": "X sec avg between cuts", "observed": boolean },
    "environmentStability": { "score": number, "value": "description", "observed": boolean },
    "movement": { "score": number, "value": "description", "observed": boolean },
    "expression": { "score": number, "value": "description", "observed": boolean }
  },
  
  "sound": {
    "musicCoverage": { "score": number, "value": "X% with music", "observed": boolean },
    "musicBalance": { "score": number, "value": "description", "observed": boolean },
    "sfxDensity": { "score": number, "value": "description", "observed": boolean },
    "silenceUsage": { "score": number, "value": "description", "observed": boolean }
  }
}

RULES:
1. Set observed:false if you cannot confidently measure that metric
2. Value strings should be short (under 20 characters) with units where applicable
3. JSON only - no explanations
```

---

## Tier 2: Advanced Metrics

### Hook Analysis Prompt

```
SYSTEM:
You are a video hook analyzer. Measure the effectiveness of a video's opening.

USER:
Analyze the HOOK section of this {{videoType}} video.

VIDEO URL: {{youtubeUrl}}
VIDEO CONTEXT: "{{topicSummary}}"
ANALYZE: First {{hookDuration}} seconds (0s - {{hookDuration}}s)

Return detailed metrics with timelines (max {{maxTimelinePoints}} points):

{
  "hookAnalysis": {
    "timeToHook": {
      "score": number,
      "value": "X seconds",
      "observed": boolean,
      "details": "What makes this the hook moment"
    },
    
    "hookStrength": {
      "score": number,
      "value": "weak" | "moderate" | "strong",
      "observed": boolean,
      "devices": ["curiosity_gap", "bold_claim", "story_open", "pattern_interrupt", "question", "promise"],
      "promiseClarity": number
    },
    
    "paceVariability": {
      "score": number,
      "value": "X% variation",
      "observed": boolean,
      "timeline": [
        { "timeSeconds": number, "value": number, "label": "description" }
      ]
    },
    
    "energyLevel": {
      "score": number,
      "value": "description",
      "observed": boolean,
      "timeline": [
        { "timeSeconds": number, "value": number }
      ]
    },
    
    "attentionGrab": {
      "score": number,
      "value": "description",
      "observed": boolean,
      "techniques": ["visual_surprise", "audio_spike", "question", "statement", "movement"]
    }
  }
}

RULES:
1. Timeline arrays: MAX {{maxTimelinePoints}} points, evenly spaced
2. timeToHook: Measure seconds until the first clear hook/promise
3. hookStrength: Evaluate clarity of promise and tension created
4. JSON only - no explanations
```

### Segment Advanced Prompt (Prosody/Language)

```
SYSTEM:
You are a video prosody and language texture analyzer. Measure detailed speech patterns and language characteristics.

USER:
Analyze this segment for prosody and language texture.

VIDEO URL: {{youtubeUrl}}
VIDEO CONTEXT: "{{topicSummary}}"
SEGMENT: "{{chapterTitle}}" ({{startSeconds}}s - {{endSeconds}}s)

Return metrics with timelines (max {{maxTimelinePoints}} points per metric):

{
  "segmentId": "{{segmentId}}",
  
  "prosody": {
    "paceVariability": {
      "score": number,
      "value": "X% CoV",
      "observed": boolean,
      "timeline": [{ "timeSeconds": number, "value": number }]
    },
    
    "paceWithinSegment": {
      "score": number,
      "value": "accelerating" | "decelerating" | "stable" | "erratic",
      "observed": boolean,
      "startPace": number,
      "endPace": number,
      "trend": number
    },
    
    "emphasisAlignment": {
      "score": number,
      "value": "description",
      "observed": boolean,
      "items": [
        { "phrase": "string", "timeSeconds": number, "stressed": boolean, "shouldBeStressed": boolean }
      ]
    },
    
    "energyDrift": {
      "score": number,
      "value": "X dB/min",
      "observed": boolean,
      "trend": number,
      "timeline": [{ "timeSeconds": number, "value": number }]
    }
  },
  
  "languageTexture": {
    "sentenceCompression": {
      "score": number,
      "value": "X words per idea",
      "observed": boolean,
      "distribution": { "tight": number, "medium": number, "loose": number }
    },
    
    "humorTiming": {
      "score": number,
      "value": "description",
      "observed": boolean,
      "items": [
        { "setupTime": number, "punchTime": number, "deltaSeconds": number, "landed": boolean }
      ]
    },
    
    "audienceAddress": {
      "score": number,
      "value": "X per min",
      "observed": boolean,
      "counts": { "direct": number, "rhetorical": number },
      "timeline": [{ "timeSeconds": number, "type": "direct" | "rhetorical" }]
    },
    
    "questionRate": {
      "score": number,
      "value": "X per min",
      "observed": boolean,
      "counts": { "rhetorical": number, "genuine": number }
    }
  }
}

RULES:
1. Timeline arrays: MAX {{maxTimelinePoints}} points
2. items arrays: MAX 10 items
3. Set observed:false if insufficient data
4. JSON only
```

### Segment Advanced Prompt (Visual/Edit)

```
SYSTEM:
You are a video visual dynamics and editing analyzer. Measure cut patterns, visual entropy, and silence usage.

USER:
Analyze this segment for visual dynamics and editing patterns.

VIDEO URL: {{youtubeUrl}}
VIDEO CONTEXT: "{{topicSummary}}"
SEGMENT: "{{chapterTitle}}" ({{startSeconds}}s - {{endSeconds}}s)

Return metrics with timelines (max {{maxTimelinePoints}} points):

{
  "segmentId": "{{segmentId}}",
  
  "visualDynamics": {
    "visualEntropy": {
      "score": number,
      "value": "low" | "moderate" | "high" | "chaotic",
      "observed": boolean,
      "timeline": [{ "timeSeconds": number, "value": number, "label": "cut" | "zoom" | "graphic" | "motion" }]
    },
    
    "cutRefinement": {
      "score": number,
      "value": "description",
      "observed": boolean,
      "medianShotSeconds": number,
      "variance": number,
      "beatCouplingScore": number
    },
    
    "silenceSpans": {
      "score": number,
      "value": "X intentional pauses",
      "observed": boolean,
      "spans": [
        {
          "startSeconds": number,
          "endSeconds": number,
          "durationSeconds": number,
          "strength": number,
          "label": "reset" | "punch" | "transition" | "dramatic",
          "alignedToBeat": boolean,
          "alignedToPunchline": boolean
        }
      ]
    },
    
    "beatEditAlignment": {
      "score": number,
      "value": "description",
      "observed": boolean,
      "items": [
        { "beatTime": number, "beatRole": string, "nearestCutTime": number, "offsetSeconds": number }
      ]
    }
  }
}

RULES:
1. Timeline arrays: MAX {{maxTimelinePoints}} points
2. spans/items arrays: MAX 15 items
3. For silenceSpans: Only include gaps > 0.6 seconds that appear intentional
4. JSON only
```

### Narrative Arc Prompt

```
SYSTEM:
You are a video narrative arc analyzer. Measure story structure, cohesion, and resolution.

USER:
Analyze narrative arc for this segment.

VIDEO URL: {{youtubeUrl}}
VIDEO CONTEXT: "{{topicSummary}}"
SEGMENT: "{{chapterTitle}}" ({{startSeconds}}s - {{endSeconds}}s)
CHAPTER TYPE: {{chapterType}}

Return narrative metrics:

{
  "segmentId": "{{segmentId}}",
  
  "narrativeArc": {
    "segmentCohesion": {
      "score": number,
      "value": "description",
      "observed": boolean,
      "driftPoints": [
        { "timeSeconds": number, "fromTopic": "string", "toTopic": "string", "severity": number }
      ]
    },
    
    "openLoops": {
      "score": number,
      "value": "X open, Y resolved",
      "observed": boolean,
      "items": [
        { "openedAt": number, "resolvedAt": number | null, "label": "string", "resolved": boolean }
      ]
    },
    
    "transitionClarity": {
      "score": number,
      "value": "description",
      "observed": boolean,
      "transitionIn": { "type": "smooth" | "abrupt" | "signposted", "quality": number },
      "transitionOut": { "type": "smooth" | "abrupt" | "signposted", "quality": number }
    }
  }
}

RULES:
1. driftPoints: Only significant topic changes, MAX 5
2. openLoops items: MAX 10
3. JSON only
```

### Ending Analysis Prompt

```
SYSTEM:
You are a video ending analyzer. Measure how well a video concludes.

USER:
Analyze the ENDING of this {{videoType}} video.

VIDEO URL: {{youtubeUrl}}
VIDEO CONTEXT: "{{topicSummary}}"
ANALYZE: Last {{endingDuration}} seconds ({{startSeconds}}s - {{endSeconds}}s)

OPEN LOOPS FROM EARLIER: {{openLoopsFromPriorAnalysis}}

Return ending metrics:

{
  "endingAnalysis": {
    "endingResolution": {
      "score": number,
      "value": "description",
      "observed": boolean,
      "payoffDelivered": boolean,
      "promiseFulfilled": boolean,
      "callbacks": [
        { "originalTime": number, "callbackTime": number, "topic": "string" }
      ]
    },
    
    "openLoopsResolved": {
      "score": number,
      "value": "X of Y resolved",
      "observed": boolean,
      "resolvedLoops": ["loop labels"],
      "unresolvedLoops": ["loop labels"]
    },
    
    "ctaClarity": {
      "score": number,
      "value": "description",
      "observed": boolean,
      "ctaType": "subscribe" | "like" | "comment" | "link" | "product" | "none" | "multiple",
      "ctaTiming": number,
      "ctaNaturalness": number
    },
    
    "emotionalLanding": {
      "score": number,
      "value": "description",
      "observed": boolean,
      "finalTone": "energized" | "reflective" | "urgent" | "warm" | "neutral" | "abrupt"
    }
  }
}

RULES:
1. callbacks array: MAX 5 items
2. Consider open loops passed from earlier analysis
3. JSON only
```

---

## Template Variable Reference

| Variable | Description | Example |
|----------|-------------|---------|
| `{{youtubeUrl}}` | Full YouTube URL | `https://www.youtube.com/watch?v=abc123` |
| `{{videoType}}` | From skeleton | `tutorial` |
| `{{topicSummary}}` | From skeleton | `A guide to making sourdough bread at home` |
| `{{chapterCount}}` | Based on duration | `5` |
| `{{keyMomentCount}}` | Based on duration | `4` |
| `{{chapterId}}` | Unique chapter ID | `ch3` |
| `{{chapterTitle}}` | Chapter name | `Mixing the Dough` |
| `{{chapterType}}` | Chapter classification | `body` |
| `{{startSeconds}}` | Segment start | `120` |
| `{{endSeconds}}` | Segment end | `240` |
| `{{chapterDuration}}` | Segment length | `120` |
| `{{durationSeconds}}` | Total video duration | `900` |
| `{{maxTimelinePoints}}` | Cap for timelines | `20` |
| `{{hookDuration}}` | Hook analysis window | `60` |
| `{{endingDuration}}` | Ending analysis window | `90` |
| `{{segmentId}}` | Unique segment ID | `seg_ch3_prosody` |
| `{{openLoopsFromPriorAnalysis}}` | JSON of open loops | `[{"label": "Why did X happen?"}]` |

---

## JSON Schema Definitions

### Shared Schemas (for Gemini responseSchema)

```typescript
// SummaryMetric (Tier 1)
const summaryMetricSchema = {
  type: "object",
  properties: {
    score: { type: "number", minimum: 0, maximum: 100 },
    value: { type: "string", maxLength: 50 },
    observed: { type: "boolean" }
  },
  required: ["score", "value", "observed"]
};

// TimelinePoint (Tier 2)
const timelinePointSchema = {
  type: "object",
  properties: {
    timeSeconds: { type: "number", minimum: 0 },
    value: { type: "number" },
    label: { type: "string", maxLength: 30 }
  },
  required: ["timeSeconds", "value"]
};

// RichMetric (Tier 2)
const richMetricSchema = {
  type: "object",
  properties: {
    score: { type: "number", minimum: 0, maximum: 100 },
    value: { type: "string", maxLength: 50 },
    observed: { type: "boolean" },
    timeline: {
      type: "array",
      items: timelinePointSchema,
      maxItems: 30
    },
    items: {
      type: "array",
      items: { type: "object" },
      maxItems: 15
    },
    counts: { type: "object" },
    proportions: { type: "object" },
    trend: { type: "number" }
  },
  required: ["score", "value", "observed"]
};
```

---

## Prompt Selection Logic

```typescript
function selectPrompt(
  tier: 0 | 1 | 2,
  segment: AnalysisSegment,
  context: AnalysisContext
): PromptConfig {
  
  if (tier === 0) {
    return {
      template: STRUCTURE_PROMPT,
      variables: {
        youtubeUrl: context.youtubeUrl,
        chapterCount: getChapterCount(context.durationSeconds),
        keyMomentCount: getKeyMomentCount(context.durationSeconds),
      },
      maxOutputTokens: 2000,
      temperature: 0.1, // Low creativity for structure
    };
  }
  
  if (tier === 1) {
    if (context.durationSeconds <= 180) {
      return {
        template: CORE_FULL_VIDEO_PROMPT,
        variables: {
          youtubeUrl: context.youtubeUrl,
          videoType: context.skeleton.videoType,
          topicSummary: context.skeleton.topicSummary,
          durationSeconds: context.durationSeconds,
        },
        maxOutputTokens: 3000,
        temperature: 0.2,
      };
    }
    
    return {
      template: CORE_PER_CHAPTER_PROMPT,
      variables: {
        youtubeUrl: context.youtubeUrl,
        videoType: context.skeleton.videoType,
        topicSummary: context.skeleton.topicSummary,
        chapterId: segment.chapterId,
        chapterTitle: segment.title,
        chapterType: segment.chapterType,
        startSeconds: segment.startSeconds,
        endSeconds: segment.endSeconds,
        chapterDuration: segment.endSeconds - segment.startSeconds,
      },
      maxOutputTokens: 2500,
      temperature: 0.2,
    };
  }
  
  if (tier === 2) {
    const maxTimelinePoints = getMaxTimelinePoints(
      segment.endSeconds - segment.startSeconds
    );
    
    switch (segment.analysisType) {
      case 'hook':
        return {
          template: HOOK_ANALYSIS_PROMPT,
          variables: {
            youtubeUrl: context.youtubeUrl,
            videoType: context.skeleton.videoType,
            topicSummary: context.skeleton.topicSummary,
            hookDuration: Math.min(90, segment.endSeconds),
            maxTimelinePoints,
          },
          maxOutputTokens: 2000,
          temperature: 0.2,
        };
      
      case 'prosody_language':
        return {
          template: SEGMENT_PROSODY_LANGUAGE_PROMPT,
          variables: {
            youtubeUrl: context.youtubeUrl,
            videoType: context.skeleton.videoType,
            topicSummary: context.skeleton.topicSummary,
            segmentId: segment.id,
            chapterTitle: segment.title,
            startSeconds: segment.startSeconds,
            endSeconds: segment.endSeconds,
            maxTimelinePoints,
          },
          maxOutputTokens: 2500,
          temperature: 0.2,
        };
      
      case 'visual_edit':
        return {
          template: SEGMENT_VISUAL_EDIT_PROMPT,
          variables: {
            // ... similar
          },
          maxOutputTokens: 2500,
          temperature: 0.2,
        };
      
      case 'ending':
        return {
          template: ENDING_ANALYSIS_PROMPT,
          variables: {
            youtubeUrl: context.youtubeUrl,
            videoType: context.skeleton.videoType,
            topicSummary: context.skeleton.topicSummary,
            startSeconds: segment.startSeconds,
            endSeconds: segment.endSeconds,
            endingDuration: segment.endSeconds - segment.startSeconds,
            openLoopsFromPriorAnalysis: JSON.stringify(context.openLoops || []),
          },
          maxOutputTokens: 2000,
          temperature: 0.2,
        };
    }
  }
}

function getMaxTimelinePoints(segmentDuration: number): number {
  if (segmentDuration <= 30) return 10;
  if (segmentDuration <= 60) return 15;
  if (segmentDuration <= 120) return 20;
  return 25;
}

function getChapterCount(durationSeconds: number): number {
  if (durationSeconds <= 180) return 3;
  if (durationSeconds <= 600) return 5;
  if (durationSeconds <= 1200) return 6;
  return 7;
}

function getKeyMomentCount(durationSeconds: number): number {
  if (durationSeconds <= 180) return 2;
  if (durationSeconds <= 600) return 4;
  return 5;
}
```

---

## Error Handling in Prompts

### Graceful Failure Instructions

Add to all prompts:
```
If you cannot analyze the video due to:
- Content restrictions
- Language barriers
- Technical issues
- Insufficient visual/audio data

Return this fallback response:
{
  "error": true,
  "errorType": "content_restricted" | "language_unsupported" | "technical_failure" | "insufficient_data",
  "errorMessage": "Brief explanation",
  "partialData": { /* any metrics you could observe */ }
}
```

---

## Appendix: Model Configuration

| Tier | Model | Temperature | Max Output | Timeout |
|------|-------|-------------|------------|---------|
| 0 | gemini-1.5-flash | 0.1 | 2000 | 30s |
| 1 (short) | gemini-1.5-flash | 0.2 | 3000 | 45s |
| 1 (chapter) | gemini-1.5-flash | 0.2 | 2500 | 30s |
| 2 (hook) | gemini-1.5-pro | 0.2 | 2000 | 45s |
| 2 (prosody) | gemini-1.5-pro | 0.2 | 2500 | 45s |
| 2 (visual) | gemini-1.5-pro | 0.2 | 2500 | 45s |
| 2 (ending) | gemini-1.5-pro | 0.2 | 2000 | 45s |
