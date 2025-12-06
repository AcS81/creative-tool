import { ReactNode } from "react";

type TabKey = "overview" | "voice" | "language" | "narrative" | "visual" | "editing" | "sound";

const tabs: { key: TabKey; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "voice", label: "Voice" },
  { key: "language", label: "Language" },
  { key: "narrative", label: "Narrative" },
  { key: "visual", label: "Visual" },
  { key: "editing", label: "Editing" },
  { key: "sound", label: "Sound" },
];

export function AnalysisLayout({
  activeTab,
  onTabChange,
  children,
}: {
  activeTab: TabKey;
  onTabChange: (tab: TabKey) => void;
  children: ReactNode;
}) {
  return (
    <div className="w-full space-y-4">
      <div className="flex flex-wrap gap-2">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => onTabChange(tab.key)}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                isActive
                  ? "bg-accent text-accent-foreground shadow-sm"
                  : "border border-border bg-white/70 text-foreground hover:border-accent"
              }`}
              type="button"
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      <div>{children}</div>
    </div>
  );
}
