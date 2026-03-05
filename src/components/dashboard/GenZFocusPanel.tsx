import { GENZ_FOCUS } from "@/data/genzFocus";
import { GenZCategoryId } from "@/data/genzTypes";

interface Props {
  activeCategories: GenZCategoryId[];
}

const GenZFocusPanel = ({ activeCategories }: Props) => {
  const focusCategory = activeCategories.length > 0 ? activeCategories[activeCategories.length - 1] : "authenticity";
  const data = GENZ_FOCUS.find((f) => f.category === focusCategory);
  if (!data) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-genz" />
        <h3 className="text-xs font-semibold uppercase tracking-wider text-genz">Japan × Gen Z</h3>
      </div>
      <p className="text-sm font-semibold text-foreground leading-snug">{data.headline}</p>

      <div className="grid grid-cols-3 gap-1.5">
        {data.stats.map((s, i) => (
          <div key={i} className="bg-secondary/50 rounded-md px-2 py-1.5 text-center">
            <div className="text-sm font-bold text-genz">{s.value}</div>
            <div className="text-[10px] text-muted-foreground leading-tight">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="space-y-1.5">
        {data.trends.map((t, i) => (
          <div key={i} className="flex gap-2 text-xs text-muted-foreground">
            <span className="text-genz mt-0.5 shrink-0">›</span>
            <span className="leading-snug">{t}</span>
          </div>
        ))}
      </div>

      <div className="bg-genz/10 border border-genz/20 rounded-md p-3">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-genz mb-1">CEO Insight</div>
        <p className="text-xs text-foreground leading-relaxed">{data.ceoInsight}</p>
      </div>
    </div>
  );
};

export default GenZFocusPanel;
