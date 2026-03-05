import { DOMAINS } from "@/data/domains";
import { DomainId } from "@/data/types";
import { Switch } from "@/components/ui/switch";
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
    <div className="space-y-1">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Domains</h3>
      {DOMAINS.map((d) => {
        const Icon = ICONS[d.icon];
        const active = activeDomains.includes(d.id);
        return (
          <label
            key={d.id}
            className="flex items-center gap-3 px-2 py-2 rounded-md cursor-pointer hover:bg-secondary/60 transition-colors"
          >
            <Switch checked={active} onCheckedChange={() => onToggle(d.id)} />
            {Icon && <Icon className="h-4 w-4 shrink-0" style={{ color: d.color }} />}
            <div className="flex-1 min-w-0">
              <span className="text-sm font-medium text-foreground">{d.label}</span>
              <p className="text-[11px] text-muted-foreground leading-tight">{d.description}</p>
            </div>
          </label>
        );
      })}
    </div>
  );
};

export default DomainSelector;
