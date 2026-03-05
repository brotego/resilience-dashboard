import { Badge } from "@/components/ui/badge";

const ModeToggle = () => {
  return (
    <header className="flex items-center justify-between px-6 py-3 border-b border-border bg-card">
      <div className="flex items-center gap-3">
        <h1 className="text-lg font-semibold tracking-tight text-foreground">
          Flourishing Through Resilience
        </h1>
        <span className="text-xs text-muted-foreground hidden sm:inline">
          Anchorstar × Mori Building
        </span>
      </div>
      <div className="flex items-center gap-2">
        <button className="px-3 py-1.5 text-sm font-medium rounded-md bg-primary text-primary-foreground">
          Global Resilience
        </button>
        <button className="px-3 py-1.5 text-sm font-medium rounded-md bg-secondary text-muted-foreground cursor-not-allowed relative" disabled>
          Gen Z Signal
          <Badge variant="outline" className="ml-2 text-[10px] py-0 px-1.5 border-muted-foreground/40 text-muted-foreground">
            Soon
          </Badge>
        </button>
      </div>
    </header>
  );
};

export default ModeToggle;
