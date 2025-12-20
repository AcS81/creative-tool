type BadgeItem = {
  label: string;
  value?: string | number | null;
  detail?: string;
};

const formatValue = (value?: string | number | null) => {
  if (value === undefined || value === null) return "Not observed";
  const str = typeof value === "string" ? value.trim() : `${value}`;
  if (str === "" || str.toLowerCase() === "unobserved") return "Not observed";
  return str;
};

export const DomainBadges = ({ items }: { items: BadgeItem[] }) => (
  <div className="flex flex-wrap gap-2">
    {items.map((item) => (
      <div key={item.label} className="rounded-md border border-border bg-surface p-2 text-xs shadow-sm">
        <p className="font-semibold text-muted">{item.label}</p>
        <p className="font-semibold text-foreground">{formatValue(item.value)}</p>
        {item.detail ? <p className="text-[11px] text-muted">{item.detail}</p> : null}
      </div>
    ))}
  </div>
);
