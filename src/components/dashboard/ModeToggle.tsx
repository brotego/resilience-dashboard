import { DashboardMode } from "./DashboardLayout";

interface Props {
  mode: DashboardMode;
  onModeChange: (mode: DashboardMode) => void;
}

const ModeToggle = ({ mode, onModeChange }: Props) => {
  return (
    <header className="flex items-center justify-between px-6 py-3 border-b border-border bg-card">
      <div className="flex flex-col">
        <h1 className="text-lg font-bold tracking-tight text-foreground">
          Flourishing Through Resilience
        </h1>
        <span className="text-[11px] text-muted-foreground">
          Anchorstar × Mori Building
        </span>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onModeChange("resilience")}
          className={`px-4 py-1.5 text-sm font-semibold rounded-oval transition-colors ${
            mode === "resilience"
              ? "bg-primary text-primary-foreground"
              : "bg-secondary text-muted-foreground hover:text-foreground"
          }`}
        >
          Global Resilience
        </button>
        <button
          onClick={() => onModeChange("genz")}
          className={`px-4 py-1.5 text-sm font-semibold rounded-oval transition-colors ${
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
