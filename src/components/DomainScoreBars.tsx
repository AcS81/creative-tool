"use client";

import type { DomainProfile } from "../lib/types";

type DomainScores = {
  voice: number;
  language: number;
  narrative: number;
  visual: number;
  sound: number;
};

type Props =
  | {
      profile: DomainProfile;
      scores?: never;
    }
  | {
      scores: DomainScores;
      profile?: never;
    };

export const DomainScoreBars = ({ profile, scores }: Props) => {
  // If profile is provided, extract scores from it
  const displayScores = profile
    ? profile.scores.map((s) => ({
        key: s.key,
        label: s.label || s.key,
        value: s.value,
      }))
    : scores
      ? Object.entries(scores).map(([key, value]) => ({
          key,
          label: key.charAt(0).toUpperCase() + key.slice(1),
          value,
        }))
      : [];

  const getColorClass = (index: number) => {
    const colors = [
      "from-blue-400 to-blue-500",
      "from-purple-400 to-purple-500",
      "from-pink-400 to-pink-500",
      "from-orange-400 to-orange-500",
      "from-teal-400 to-teal-500",
      "from-indigo-400 to-indigo-500",
    ];
    return colors[index % colors.length];
  };

  return (
    <div className="space-y-3">
      {displayScores.map((item, idx) => (
        <div key={item.key} className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-foreground">{item.label}</span>
            <span className="text-sm font-bold text-foreground">{Math.round(item.value)}/100</span>
          </div>
          <div className="relative h-3 w-full overflow-hidden rounded-full bg-surface-strong">
            <div
              className={`absolute inset-y-0 left-0 rounded-full bg-gradient-to-r ${getColorClass(idx)} transition-all duration-1000 ease-out`}
              style={{ width: `${Math.min(100, Math.max(0, item.value))}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
};
