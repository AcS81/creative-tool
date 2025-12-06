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
              className={`cs-pill text-sm font-semibold transition ${
                isActive
                  ? "border-transparent bg-accent text-white shadow-sm"
                  : "hover:border-accent/70 hover:text-foreground"
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
