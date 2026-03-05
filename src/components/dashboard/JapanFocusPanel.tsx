import { JAPAN_FOCUS } from "@/data/japanFocus";
import { DomainId } from "@/data/types";

interface Props {
  activeDomains: DomainId[];
}

const JapanFocusPanel = ({ activeDomains }: Props) => {
  const focusDomain = activeDomains.length > 0 ? activeDomains[activeDomains.length - 1] : "work";
  const data = JAPAN_FOCUS.find((j) => j.domain === focusDomain);
  if (!data) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-primary" />
        <h3 className="text-xs font-semibold uppercase tracking-wider text-primary">Japan Focus</h3>
      </div>
      <p className="text-sm font-semibold text-foreground leading-snug">{data.headline}</p>

      <div className="grid grid-cols-3 gap-1.5">
        {data.stats.map((s, i) => (
          <div key={i} className="bg-secondary/50 rounded-md px-2 py-1.5 text-center">
            <div className="text-sm font-bold text-primary">{s.value}</div>
            <div className="text-[10px] text-muted-foreground leading-tight">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="space-y-1.5">
        {data.trends.map((t, i) => (
          <div key={i} className="flex gap-2 text-xs text-muted-foreground">
            <span className="text-primary mt-0.5 shrink-0">›</span>
            <span className="leading-snug">{t}</span>
          </div>
        ))}
      </div>

      <div className="bg-primary/10 border border-primary/20 rounded-md p-3">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-primary mb-1">CEO Insight</div>
        <p className="text-xs text-foreground leading-relaxed">{data.ceoInsight}</p>
      </div>
    </div>
  );
};

export default JapanFocusPanel;
