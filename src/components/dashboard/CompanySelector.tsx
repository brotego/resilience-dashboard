import { COMPANIES, CompanyId } from "@/data/companies";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Props {
  selectedCompany: CompanyId | null;
  onSelect: (id: CompanyId | null) => void;
}

const CompanySelector = ({ selectedCompany, onSelect }: Props) => {
  return (
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
  );
};

export default CompanySelector;
