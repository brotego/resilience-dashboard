import { useState } from "react";
import { COMPANIES, CompanyId } from "@/data/companies";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useLang } from "@/i18n/LanguageContext";

interface Props {
  selectedCompany: CompanyId | null;
  onSelect: (id: CompanyId | null) => void;
}

const CompanySelector = ({ selectedCompany, onSelect }: Props) => {
  const [open, setOpen] = useState(false);
  const { t } = useLang();
  const selected = COMPANIES.find((c) => c.id === selectedCompany);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between bg-secondary/50 border-border text-[11px] font-mono h-7 rounded-sm font-normal"
        >
          {selected ? selected.name : t("company.all")}
          <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[220px] p-0 rounded-sm" align="end">
        <Command>
          <CommandInput placeholder={t("company.search")} className="h-8 text-[11px]" />
          <CommandList>
            <CommandEmpty className="text-[10px] font-mono">{t("company.empty")}</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="all-companies"
                onSelect={() => { onSelect(null); setOpen(false); }}
                className="text-[11px]"
              >
                {t("company.all")}
                <Check className={cn("ml-auto h-3 w-3", !selectedCompany ? "opacity-100" : "opacity-0")} />
              </CommandItem>
              {COMPANIES.map((c) => (
                <CommandItem
                  key={c.id}
                  value={c.name}
                  onSelect={() => { onSelect(c.id); setOpen(false); }}
                  className="text-[11px]"
                >
                  <div className="flex flex-col">
                    <span className="font-semibold">{c.name}</span>
                    <span className="text-[9px] font-mono text-muted-foreground">{c.sector}</span>
                  </div>
                  <Check className={cn("ml-auto h-3 w-3", selectedCompany === c.id ? "opacity-100" : "opacity-0")} />
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
