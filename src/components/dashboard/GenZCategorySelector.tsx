import { GENZ_CATEGORIES } from "@/data/genzCategories";
import { GenZCategoryId } from "@/data/genzTypes";
import { Switch } from "@/components/ui/switch";
import { Shield, Coffee, Sprout, Smartphone, Heart } from "lucide-react";

const ICONS: Record<string, React.ElementType> = {
  Shield, Coffee, Sprout, Smartphone, Heart,
};

interface Props {
  activeCategories: GenZCategoryId[];
  onToggle: (id: GenZCategoryId) => void;
}

const GenZCategorySelector = ({ activeCategories, onToggle }: Props) => {
  return (
    <div className="space-y-1">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Gen Z Categories</h3>
      {GENZ_CATEGORIES.map((c) => {
        const Icon = ICONS[c.icon];
        const active = activeCategories.includes(c.id);
        return (
          <label
            key={c.id}
            className="flex items-center gap-3 px-2 py-2 rounded-md cursor-pointer hover:bg-secondary/60 transition-colors"
          >
            <Switch checked={active} onCheckedChange={() => onToggle(c.id)} />
            {Icon && <Icon className="h-4 w-4 shrink-0 text-genz" />}
            <div className="flex-1 min-w-0">
              <span className="text-sm font-medium text-foreground">{c.label}</span>
              <p className="text-[11px] text-muted-foreground leading-tight">{c.description}</p>
            </div>
          </label>
        );
      })}
    </div>
  );
};

export default GenZCategorySelector;
