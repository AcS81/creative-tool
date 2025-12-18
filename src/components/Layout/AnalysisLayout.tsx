import { ReactNode } from "react";

type TabKey =
  | "overview"
  | "voice"
  | "delivery"
  | "narrative"
  | "visual"
  | "editing"
  | "sound"
  | "performance";

const tabs: { key: TabKey; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "voice", label: "Voice" },
  { key: "delivery", label: "Delivery" },
  { key: "narrative", label: "Narrative" },
  { key: "visual", label: "Visual" },
  { key: "editing", label: "Editing" },
  { key: "sound", label: "Sound" },
  { key: "performance", label: "Performance" },
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
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Analysis sections">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;
          const tabId = `tab-${tab.key}`;
          return (
            <button
              id={tabId}
              key={tab.key}
              onClick={() => onTabChange(tab.key)}
              className={`cs-pill min-w-[120px] justify-center px-4 py-2.5 text-sm font-semibold transition ${
                isActive
                  ? "border-transparent bg-gradient-to-r from-accent to-accent-amber text-white shadow-sm"
                  : "bg-white/60 hover:border-accent-amber/70 hover:text-foreground"
              }`}
              role="tab"
              aria-selected={isActive}
              aria-controls={`${tab.key}-panel`}
              tabIndex={isActive ? 0 : -1}
              aria-current={isActive ? "page" : undefined}
              type="button"
              onKeyDown={(e) => {
                if (e.key === "ArrowRight" || e.key === "ArrowDown") {
                  e.preventDefault();
                  const currentIndex = tabs.findIndex((t) => t.key === activeTab);
                  const next = tabs[(currentIndex + 1) % tabs.length];
                  onTabChange(next.key);
                }
                if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
                  e.preventDefault();
                  const currentIndex = tabs.findIndex((t) => t.key === activeTab);
                  const prev = tabs[(currentIndex - 1 + tabs.length) % tabs.length];
                  onTabChange(prev.key);
                }
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      <div id={`${activeTab}-panel`} role="tabpanel" aria-labelledby={`tab-${activeTab}`} className="focus:outline-none">
        {children}
      </div>
    </div>
  );
}
