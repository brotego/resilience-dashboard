import { MINDSETS } from "@/data/domains";
import { MindsetId } from "@/data/types";

interface Props {
  activeMindset: MindsetId;
  onSelect: (id: MindsetId) => void;
}

const MindsetSelector = ({ activeMindset, onSelect }: Props) => {
  return (
    <div className="space-y-1">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Mindset Lens</h3>
      <div className="grid grid-cols-2 gap-1.5">
        {MINDSETS.map((m) => {
          const active = activeMindset === m.id;
          return (
            <button
              key={m.id}
              onClick={() => onSelect(m.id)}
              className={`text-left px-2.5 py-2 rounded-md text-xs transition-all border ${
                active
                  ? "bg-primary/15 border-primary text-foreground"
                  : "bg-secondary/40 border-transparent text-muted-foreground hover:bg-secondary/70"
              }`}
            >
              <span className="font-medium block leading-tight">{m.shortLabel}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default MindsetSelector;
