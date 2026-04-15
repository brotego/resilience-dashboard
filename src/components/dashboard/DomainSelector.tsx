import { DOMAINS } from "@/data/domains";
import { DomainId } from "@/data/types";
import { Briefcase, User, Users, Heart, Leaf } from "lucide-react";
import { useLang } from "@/i18n/LanguageContext";
import { TranslationKey } from "@/i18n/translations";

const ICONS: Record<string, React.ElementType> = {
  Briefcase, User, Users, Heart, Leaf,
};

const DOMAIN_KEYS: Record<string, TranslationKey> = {
  work: "domain.work",
  selfhood: "domain.selfhood",
  community: "domain.community",
  aging: "domain.aging",
  environment: "domain.environment",
};

interface Props {
  activeDomains: DomainId[];
  onToggle: (id: DomainId) => void;
}

const DomainSelector = ({ activeDomains, onToggle }: Props) => {
  const { t } = useLang();
  return (
    <div className="flex flex-wrap gap-1">
      {DOMAINS.map((d) => {
        const Icon = ICONS[d.icon];
        const active = activeDomains.includes(d.id);
        return (
          <button
            key={d.id}
            onClick={() => onToggle(d.id)}
            className={`flex items-center gap-1.5 px-2 py-0.5 rounded-sm text-[10px] font-mono font-medium transition-all border ${
              active
                ? "bg-primary/15 border-primary/40 text-foreground"
                : "bg-secondary/30 border-transparent text-muted-foreground hover:bg-secondary/60"
            }`}
          >
            {Icon && <Icon className="h-2.5 w-2.5 shrink-0" style={{ color: d.color }} />}
            <span>{t(DOMAIN_KEYS[d.id])}</span>
          </button>
        );
      })}
    </div>
  );
};

export default DomainSelector;
