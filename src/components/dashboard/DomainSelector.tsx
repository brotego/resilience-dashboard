import { DOMAINS } from "@/data/domains";
import { DomainId } from "@/data/types";
import { Briefcase, User, Users, Heart, Leaf } from "lucide-react";

const ICONS: Record<string, React.ElementType> = {
  Briefcase, User, Users, Heart, Leaf,
};

interface Props {
  activeDomains: DomainId[];
  onToggle: (id: DomainId) => void;
}

const DomainSelector = ({ activeDomains, onToggle }: Props) => {
  return (
    <div className="flex flex-wrap gap-1.5">
      {DOMAINS.map((d) => {
        const Icon = ICONS[d.icon];
        const active = activeDomains.includes(d.id);
        return (
          <button
            key={d.id}
            onClick={() => onToggle(d.id)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium transition-all border ${
              active
                ? "bg-primary/15 border-primary/40 text-foreground"
                : "bg-secondary/30 border-transparent text-muted-foreground hover:bg-secondary/60"
            }`}
          >
            {Icon && <Icon className="h-3 w-3 shrink-0" style={{ color: d.color }} />}
            <span>{d.label}</span>
          </button>
        );
      })}
    </div>
  );
};

export default DomainSelector;
