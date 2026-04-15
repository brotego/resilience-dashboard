import { GENZ_CATEGORIES } from "@/data/genzCategories";
import { GenZCategoryId } from "@/data/genzTypes";
import { Shield, Coffee, Sprout, Smartphone, Heart } from "lucide-react";
import { useLang } from "@/i18n/LanguageContext";
import { TranslationKey } from "@/i18n/translations";

const ICONS: Record<string, React.ElementType> = {
  Shield, Coffee, Sprout, Smartphone, Heart,
};

const CATEGORY_KEYS: Record<string, TranslationKey> = {
  authenticity: "genz.authenticity",
  worklife: "genz.worklife",
  climate: "genz.climate",
  digital: "genz.digital",
  belonging: "genz.belonging",
};

interface Props {
  activeCategories: GenZCategoryId[];
  onToggle: (id: GenZCategoryId) => void;
}

const GenZCategorySelector = ({ activeCategories, onToggle }: Props) => {
  const { t } = useLang();
  return (
    <div className="flex flex-wrap gap-1">
      {GENZ_CATEGORIES.map((c) => {
        const Icon = ICONS[c.icon];
        const active = activeCategories.includes(c.id);
        return (
          <button
            key={c.id}
            onClick={() => onToggle(c.id)}
            className={`flex items-center gap-1.5 px-2 py-0.5 rounded-sm text-[10px] font-mono font-medium transition-all border ${
              active
                ? "bg-genz/15 border-genz/40 text-foreground"
                : "bg-secondary/30 border-transparent text-muted-foreground hover:bg-secondary/60"
            }`}
          >
            {Icon && <Icon className="h-2.5 w-2.5 shrink-0 text-genz" />}
            <span>{t(CATEGORY_KEYS[c.id])}</span>
          </button>
        );
      })}
    </div>
  );
};

export default GenZCategorySelector;
