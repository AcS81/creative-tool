"use client";

import { useState, type ReactElement } from "react";
import type { VideoSkeleton, Chapter, KeyMoment, ChapterType, KeyMomentType } from "../lib/analysis/types/skeleton";

type Props = {
  skeleton: VideoSkeleton;
  showContentMix?: boolean;
};

const CHAPTER_TYPE_COLORS: Record<ChapterType, { bg: string; border: string; text: string }> = {
  intro: { bg: "bg-blue-500", border: "border-blue-600", text: "text-blue-900" },
  hook: { bg: "bg-accent", border: "border-red-600", text: "text-red-900" },
  body: { bg: "bg-purple-500", border: "border-purple-600", text: "text-purple-900" },
  example: { bg: "bg-emerald-500", border: "border-emerald-600", text: "text-emerald-900" },
  tangent: { bg: "bg-amber-500", border: "border-amber-600", text: "text-amber-900" },
  conclusion: { bg: "bg-indigo-500", border: "border-indigo-600", text: "text-indigo-900" },
  cta: { bg: "bg-accent-amber", border: "border-amber-700", text: "text-amber-900" },
  outro: { bg: "bg-slate-500", border: "border-slate-600", text: "text-slate-900" },
};

const KEY_MOMENT_ICONS: Record<KeyMomentType, string> = {
  hook: "🎣",
  peak: "⚡",
  twist: "🔄",
  payoff: "✨",
  cta: "📢",
};

const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

const formatDuration = (seconds: number): string => {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
};

export const VideoStructure = ({ skeleton, showContentMix = true }: Props) => {
  const [hoveredChapter, setHoveredChapter] = useState<string | null>(null);
  const [hoveredMoment, setHoveredMoment] = useState<string | null>(null);

  const totalDuration = skeleton.durationSeconds;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-foreground">Video Structure</h3>
          <p className="mt-1 text-sm text-muted">
            {skeleton.chapters.length} chapters • {skeleton.keyMoments.length} key moments •{" "}
            {formatDuration(totalDuration)}
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-lg bg-surface-strong px-3 py-2 shadow-sm ring-1 ring-border">
          <span className="text-xs font-semibold text-muted">Type:</span>
          <span className="text-sm font-bold text-foreground capitalize">{skeleton.videoType}</span>
        </div>
      </div>

      {/* Chapter Timeline */}
      <div className="rounded-xl border-2 border-border bg-gradient-to-br from-white to-surface p-6 shadow-lg">
        <div className="space-y-4">
          {/* Timeline visualization */}
          <div className="relative">
            {/* Timeline track */}
            <div className="relative h-24 w-full overflow-hidden rounded-lg bg-surface-strong shadow-inner">
              {/* Chapter bars */}
              {skeleton.chapters.map((chapter) => {
                const startPct = (chapter.startSeconds / totalDuration) * 100;
                const widthPct = ((chapter.endSeconds - chapter.startSeconds) / totalDuration) * 100;
                const colors = CHAPTER_TYPE_COLORS[chapter.chapterType];
                const isHovered = hoveredChapter === chapter.id;

                return (
                  <div
                    key={chapter.id}
                    className={`absolute top-0 h-full cursor-pointer transition-all duration-300 ${colors.bg} ${colors.border} border-r-2 ${
                      isHovered ? "z-10 scale-105 shadow-lg" : "shadow-sm"
                    }`}
                    style={{
                      left: `${startPct}%`,
                      width: `${widthPct}%`,
                    }}
                    onMouseEnter={() => setHoveredChapter(chapter.id)}
                    onMouseLeave={() => setHoveredChapter(null)}
                  >
                    <div className="flex h-full flex-col items-center justify-center px-2 text-center">
                      <span className="text-xs font-bold text-white drop-shadow-md">
                        {widthPct > 8 ? chapter.title : ""}
                      </span>
                      {widthPct > 12 && (
                        <span className="mt-1 text-[10px] font-semibold text-white/90">{chapter.chapterType}</span>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Key moment markers */}
              {skeleton.keyMoments.map((moment, idx) => {
                const positionPct = (moment.timestamp / totalDuration) * 100;
                const isHovered = hoveredMoment === `${moment.type}-${idx}`;

                return (
                  <div
                    key={`${moment.type}-${idx}`}
                    className={`absolute top-0 z-20 flex h-full items-center transition-all duration-300 ${
                      isHovered ? "scale-125" : ""
                    }`}
                    style={{ left: `${positionPct}%`, transform: "translateX(-50%)" }}
                    onMouseEnter={() => setHoveredMoment(`${moment.type}-${idx}`)}
                    onMouseLeave={() => setHoveredMoment(null)}
                  >
                    <div className="relative">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-2xl shadow-lg ring-2 ring-accent">
                        {KEY_MOMENT_ICONS[moment.type]}
                      </div>
                      {isHovered && (
                        <div className="absolute left-1/2 top-12 z-30 w-48 -translate-x-1/2 rounded-lg border border-border bg-white p-3 shadow-xl">
                          <p className="text-xs font-bold text-foreground capitalize">{moment.type}</p>
                          <p className="mt-1 text-xs text-muted">{moment.description}</p>
                          <p className="mt-1 text-[10px] font-semibold text-accent">{formatTime(moment.timestamp)}</p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Time markers */}
            <div className="mt-2 flex items-center justify-between text-xs font-semibold text-muted">
              <span>0:00</span>
              <span>{formatTime(totalDuration / 2)}</span>
              <span>{formatTime(totalDuration)}</span>
            </div>
          </div>

          {/* Hovered chapter details */}
          {hoveredChapter && (
            <div className="rounded-lg border-2 border-accent/20 bg-accent/5 p-4">
              {(() => {
                const chapter = skeleton.chapters.find((c) => c.id === hoveredChapter);
                if (!chapter) return null;
                const duration = chapter.endSeconds - chapter.startSeconds;
                return (
                  <>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <h4 className="text-base font-bold text-foreground">{chapter.title}</h4>
                        <p className="mt-1 text-sm text-muted">{chapter.summary}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <span
                          className={`inline-block rounded-full px-2.5 py-1 text-xs font-bold ${CHAPTER_TYPE_COLORS[chapter.chapterType].bg} text-white`}
                        >
                          {chapter.chapterType}
                        </span>
                        <p className="mt-1 text-xs font-semibold text-muted">
                          {formatTime(chapter.startSeconds)} - {formatTime(chapter.endSeconds)}
                        </p>
                        <p className="text-xs text-muted">{formatDuration(duration)}</p>
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>
          )}
        </div>
      </div>

      {/* Chapter List */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {skeleton.chapters.map((chapter, idx) => {
          const duration = chapter.endSeconds - chapter.startSeconds;
          const colors = CHAPTER_TYPE_COLORS[chapter.chapterType];
          const momentsInChapter = skeleton.keyMoments.filter((m) => m.chapterId === chapter.id);

          return (
            <div
              key={chapter.id}
              className={`group cursor-pointer rounded-lg border-2 p-4 shadow-sm transition-all duration-300 hover:shadow-md ${
                hoveredChapter === chapter.id
                  ? `${colors.border} bg-gradient-to-br from-white to-${colors.bg}/10`
                  : "border-border bg-white hover:border-accent/50"
              }`}
              onMouseEnter={() => setHoveredChapter(chapter.id)}
              onMouseLeave={() => setHoveredChapter(null)}
            >
              <div className="flex items-start gap-3">
                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${colors.bg} text-sm font-bold text-white shadow-sm`}>
                  {idx + 1}
                </div>
                <div className="flex-1 space-y-2">
                  <div>
                    <h4 className="text-sm font-bold text-foreground group-hover:text-accent">{chapter.title}</h4>
                    <p className="mt-1 text-xs text-muted line-clamp-2">{chapter.summary}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${colors.bg} text-white`}>
                      {chapter.chapterType}
                    </span>
                    <span className="text-[10px] font-semibold text-muted">{formatDuration(duration)}</span>
                    {momentsInChapter.length > 0 && (
                      <span className="text-[10px]">
                        {momentsInChapter.map((m) => KEY_MOMENT_ICONS[m.type]).join(" ")}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Content Mix */}
      {showContentMix && (
        <div className="rounded-xl border-2 border-border bg-gradient-to-br from-white to-surface p-6 shadow-lg">
          <h4 className="mb-4 text-base font-bold text-foreground">Content Mix</h4>
          <div className="space-y-4">
            {/* Visual bar */}
            <div className="relative h-8 w-full overflow-hidden rounded-lg shadow-inner">
              {Object.entries(skeleton.contentMix)
                .filter(([_, pct]) => pct > 0)
                .sort((a, b) => b[1] - a[1])
                .reduce(
                  (acc, [type, pct]) => {
                    const colors = {
                      talkingHeadPct: "bg-blue-500",
                      brollPct: "bg-purple-500",
                      graphicsPct: "bg-accent-amber",
                      screencastPct: "bg-emerald-500",
                      otherPct: "bg-slate-400",
                    };
                    const labels = {
                      talkingHeadPct: "Talking Head",
                      brollPct: "B-Roll",
                      graphicsPct: "Graphics",
                      screencastPct: "Screencast",
                      otherPct: "Other",
                    };
                    acc.elements.push(
                      <div
                        key={type}
                        className={`h-full ${colors[type as keyof typeof colors]} flex items-center justify-center text-xs font-bold text-white transition-all duration-300 hover:brightness-110`}
                        style={{ width: `${pct}%` }}
                        title={`${labels[type as keyof typeof labels]}: ${Math.round(pct)}%`}
                      >
                        {pct > 10 ? `${Math.round(pct)}%` : ""}
                      </div>
                    );
                    return acc;
                  },
                  { elements: [] as ReactElement[] }
                ).elements}
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-3">
              {Object.entries({
                talkingHeadPct: { label: "Talking Head", color: "bg-blue-500" },
                brollPct: { label: "B-Roll", color: "bg-purple-500" },
                graphicsPct: { label: "Graphics", color: "bg-accent-amber" },
                screencastPct: { label: "Screencast", color: "bg-emerald-500" },
                otherPct: { label: "Other", color: "bg-slate-400" },
              }).map(([key, { label, color }]) => {
                const pct = skeleton.contentMix[key as keyof typeof skeleton.contentMix];
                if (pct === 0) return null;
                return (
                  <div key={key} className="flex items-center gap-2">
                    <div className={`h-3 w-3 rounded ${color}`} />
                    <span className="text-xs text-muted">
                      {label}: <span className="font-semibold text-foreground">{Math.round(pct)}%</span>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
