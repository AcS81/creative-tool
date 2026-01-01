type BadgeItem = {
  label: string;
  value?: string | number | null;
  detail?: string;
};

const formatValue = (value?: string | number | null) => {
  if (value === undefined || value === null) return { observed: false, text: "Not observed" };
  const str = typeof value === "string" ? value.trim() : `${value}`;
  if (str === "" || str.toLowerCase() === "unobserved") return { observed: false, text: "Not observed" };
  return { observed: true, text: str };
};

export const DomainBadges = ({ items }: { items: BadgeItem[] }) => (
  <div className="flex flex-wrap gap-2">
    {items.map((item) => {
      const display = formatValue(item.value);
      return (
        <div key={item.label} className="rounded-md border border-border bg-surface p-2 text-xs shadow-sm">
          <p className="font-semibold text-muted">{item.label}</p>
          {display.observed ? (
            <p className="font-semibold text-foreground">{display.text}</p>
          ) : (
            <span className="cs-badge bg-amber-100 text-[10px] text-amber-800">{display.text}</span>
          )}
          {item.detail ? <p className="text-[11px] text-muted">{item.detail}</p> : null}
        </div>
      );
    })}
  </div>
);
