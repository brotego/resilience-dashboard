import { useState } from "react";
import { COMPANIES, CompanyId } from "@/data/companies";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface Props {
  selectedCompany: CompanyId | null;
  onSelect: (id: CompanyId | null) => void;
}

const CompanySelector = ({ selectedCompany, onSelect }: Props) => {
  const [open, setOpen] = useState(false);
  const selected = COMPANIES.find((c) => c.id === selectedCompany);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between bg-secondary/50 border-border text-sm h-9 rounded-lg font-normal"
        >
          {selected ? selected.name : "All companies"}
          <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[220px] p-0" align="end">
        <Command>
          <CommandInput placeholder="Search company..." className="h-9" />
          <CommandList>
            <CommandEmpty>No company found.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="all-companies"
                onSelect={() => { onSelect(null); setOpen(false); }}
              >
                All companies
                <Check className={cn("ml-auto h-4 w-4", !selectedCompany ? "opacity-100" : "opacity-0")} />
              </CommandItem>
              {COMPANIES.map((c) => (
                <CommandItem
                  key={c.id}
                  value={c.name}
                  onSelect={() => { onSelect(c.id); setOpen(false); }}
                >
                  <div className="flex flex-col">
                    <span className="font-semibold">{c.name}</span>
                    <span className="text-[10px] text-muted-foreground">{c.sector}</span>
                  </div>
                  <Check className={cn("ml-auto h-4 w-4", selectedCompany === c.id ? "opacity-100" : "opacity-0")} />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

export default CompanySelector;
