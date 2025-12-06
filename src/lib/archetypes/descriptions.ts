type DomainKey = "voice" | "language" | "narrative" | "visual" | "editing" | "sound";

const library: Record<
  DomainKey,
  Record<
    string,
    {
      title: string;
      description: string;
    }
  >
> = {
  voice: {
    "Hyperactive Commentator": {
      title: "Hyperactive Commentator",
      description: "High-energy delivery with frequent resets and bright emphasis to keep attention.",
    },
    "Reflective Analyst": {
      title: "Reflective Analyst",
      description: "Measured, thoughtful cadence that favors clarity over speed.",
    },
    "Warm Narrator": {
      title: "Warm Narrator",
      description: "Gentle pacing and inviting tone that feels intimate and steady.",
    },
  },
  language: {
    "Analytical Explainer": {
      title: "Analytical Explainer",
      description: "Dense with reasoning, examples, and structured arguments.",
    },
    "Reflective Essayist": {
      title: "Reflective Essayist",
      description: "Balances abstract framing with concrete detail and personal POV.",
    },
    "Punchy Commentator": {
      title: "Punchy Commentator",
      description: "Short, declarative phrasing that prioritizes takeaways over narrative.",
    },
  },
  narrative: {
    "Arc-Driven Storyteller": {
      title: "Arc-Driven Storyteller",
      description: "Clear setups and payoffs with momentum across sections.",
    },
    "Segmented Explainer": {
      title: "Segmented Explainer",
      description: "Moves through modular beats with light hooks anchoring each section.",
    },
    "Structured Deep Dive": {
      title: "Structured Deep Dive",
      description: "Outlines, defends, and recaps with an emphasis on logical flow.",
    },
  },
  visual: {
    "Dynamic Desk Setup": {
      title: "Dynamic Desk Setup",
      description: "Frequent micro-movements, framing tweaks, and expressive gestures.",
    },
    "Stable Frame": {
      title: "Stable Frame",
      description: "Minimal camera movement; presence and props carry the visual.",
    },
    "Composed Studio": {
      title: "Composed Studio",
      description: "Clean, intentional composition with occasional overlays.",
    },
  },
  editing: {
    "Cut-Heavy Pacing": {
      title: "Cut-Heavy Pacing",
      description: "Fast cuts and pattern interrupts to maintain speed and attention.",
    },
    "Measured Cuts": {
      title: "Measured Cuts",
      description: "Longer takes with trims at beat changes; keeps flow steady.",
    },
    "Polished Post": {
      title: "Polished Post",
      description: "Tight edits, subtle motion graphics, and minimal dead air.",
    },
  },
  sound: {
    "Upbeat Underscore": {
      title: "Upbeat Underscore",
      description: "Light music bed that lifts energy without overpowering the voice.",
    },
    "Subtle Underscore": {
      title: "Subtle Underscore",
      description: "Sparse music used to mark transitions while keeping vocals dominant.",
    },
    "Balanced Mix": {
      title: "Balanced Mix",
      description: "Voice-forward mix with restrained music and purposeful SFX.",
    },
  },
};

export function describeArchetype(domain: DomainKey, name?: string) {
  if (!name) return null;
  const entry = library[domain]?.[name];
  return entry ?? { title: name, description: "A distinctive style for this domain." };
}

export type { DomainKey };
