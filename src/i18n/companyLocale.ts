import type { Company } from "@/data/companies";
import { tr, type Lang, type TranslationKey } from "@/i18n/translations";

export function getCompanyDisplayName(company: Company, lang: Lang): string {
  if (lang !== "jp") return company.name;
  const key = `companyProfile.${company.id}.name` as TranslationKey;
  const jp = tr(key, "jp");
  if (!jp || jp === key) return company.name;
  return jp;
}

export function getCompanyDisplaySector(company: Company, lang: Lang): string {
  if (lang !== "jp") return company.sector;
  const key = `companyProfile.${company.id}.sector` as TranslationKey;
  const jp = tr(key, "jp");
  if (!jp || jp === key) return company.sector;
  return jp;
}
