import { useState } from "react";
import { DomainId, MindsetId } from "@/data/types";
import ModeToggle from "./ModeToggle";
import DomainSelector from "./DomainSelector";
import MindsetSelector from "./MindsetSelector";
import JapanFocusPanel from "./JapanFocusPanel";
import AIInsightPanel from "./AIInsightPanel";
import GlobalMap from "./GlobalMap";
import { ScrollArea } from "@/components/ui/scroll-area";

const DashboardLayout = () => {
  const [activeDomains, setActiveDomains] = useState<DomainId[]>(["work"]);
  const [activeMindset, setActiveMindset] = useState<MindsetId>("cracks");

  const toggleDomain = (id: DomainId) => {
    setActiveDomains((prev) =>
      prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]
    );
  };

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      <ModeToggle />
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar */}
        <ScrollArea className="w-72 shrink-0 border-r border-border bg-card">
          <div className="p-4 space-y-6">
            <DomainSelector activeDomains={activeDomains} onToggle={toggleDomain} />
            <div className="border-t border-border" />
            <MindsetSelector activeMindset={activeMindset} onSelect={setActiveMindset} />
            <div className="border-t border-border" />
            <JapanFocusPanel activeDomains={activeDomains} />
          </div>
        </ScrollArea>

        {/* Map */}
        <div className="flex-1 relative">
          <GlobalMap activeDomains={activeDomains} activeMindset={activeMindset} />
        </div>

        {/* Right Panel */}
        <div className="w-80 shrink-0">
          <AIInsightPanel activeDomains={activeDomains} activeMindset={activeMindset} />
        </div>
      </div>
    </div>
  );
};

export default DashboardLayout;
