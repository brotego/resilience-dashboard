import { COMPANIES, CompanyId } from "@/data/companies";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2 } from "lucide-react";

interface Props {
  selectedCompany: CompanyId | null;
  onSelect: (id: CompanyId | null) => void;
}

const CompanySelector = ({ selectedCompany, onSelect }: Props) => {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Building2 className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-bold uppercase tracking-wider text-primary">Company Lens</h3>
      </div>
      <Select
        value={selectedCompany || "none"}
        onValueChange={(v) => onSelect(v === "none" ? null : v as CompanyId)}
      >
        <SelectTrigger className="w-full bg-secondary/50 border-border text-sm h-9 rounded-lg">
          <SelectValue placeholder="All companies" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">All companies</SelectItem>
          {COMPANIES.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              <div className="flex flex-col">
                <span className="font-semibold">{c.name}</span>
                <span className="text-[10px] text-muted-foreground">{c.sector}</span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {selectedCompany && (
        <p className="text-[11px] text-muted-foreground leading-snug">
          {COMPANIES.find((c) => c.id === selectedCompany)?.description}
        </p>
      )}
    </div>
  );
};

export default CompanySelector;
