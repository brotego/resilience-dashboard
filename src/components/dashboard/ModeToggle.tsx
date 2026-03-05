import { Badge } from "@/components/ui/badge";
import { DashboardMode } from "./DashboardLayout";

interface Props {
  mode: DashboardMode;
  onModeChange: (mode: DashboardMode) => void;
}

const ModeToggle = ({ mode, onModeChange }: Props) => {
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
        <button
          onClick={() => onModeChange("resilience")}
          className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
            mode === "resilience"
              ? "bg-primary text-primary-foreground"
              : "bg-secondary text-muted-foreground hover:text-foreground"
          }`}
        >
          Global Resilience
        </button>
        <button
          onClick={() => onModeChange("genz")}
          className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
            mode === "genz"
              ? "bg-genz text-white"
              : "bg-secondary text-muted-foreground hover:text-foreground"
          }`}
        >
          Gen Z Signal
        </button>
      </div>
    </header>
  );
};

export default ModeToggle;
