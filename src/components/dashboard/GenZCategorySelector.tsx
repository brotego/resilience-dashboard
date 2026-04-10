import { GENZ_CATEGORIES } from "@/data/genzCategories";
import { GenZCategoryId } from "@/data/genzTypes";
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
    <div className="flex flex-wrap gap-1.5">
      {GENZ_CATEGORIES.map((c) => {
        const Icon = ICONS[c.icon];
        const active = activeCategories.includes(c.id);
        return (
          <button
            key={c.id}
            onClick={() => onToggle(c.id)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium transition-all border ${
              active
                ? "bg-genz/15 border-genz/40 text-foreground"
                : "bg-secondary/30 border-transparent text-muted-foreground hover:bg-secondary/60"
            }`}
          >
            {Icon && <Icon className="h-3 w-3 shrink-0 text-genz" />}
            <span>{c.label}</span>
          </button>
        );
      })}
    </div>
  );
};

export default GenZCategorySelector;
