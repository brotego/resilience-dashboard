export type CompanyId = "kodansha" | "persol" | "ntt_east" | "kikkoman" | "kirin" | "nintendo";

export interface Company {
  id: CompanyId;
  name: string;
  sector: string;
  relevantDomains: string[];
  relevantGenZCategories: string[];
  description: string;
  /** Keywords that make a signal relevant to this company */
  keywords: string[];
}

export const COMPANIES: Company[] = [
  {
    id: "kodansha",
    name: "Kodansha",
    sector: "Publishing & Media",
    relevantDomains: ["selfhood", "community"],
    relevantGenZCategories: ["digital", "authenticity", "belonging"],
    description: "Japan's largest publisher — manga, digital media, IP licensing",
    keywords: ["content", "creator", "identity", "media", "IP", "digital", "VTuber", "manga", "publishing", "culture", "brand"],
  },
  {
    id: "persol",
    name: "PERSOL",
    sector: "HR & Workforce Solutions",
    relevantDomains: ["work"],
    relevantGenZCategories: ["worklife"],
    description: "Leading HR and staffing group — workforce transformation, talent platforms",
    keywords: ["work", "talent", "labor", "hiring", "remote", "workforce", "employment", "career", "gig", "AI workforce", "reskilling", "startup"],
  },
  {
    id: "ntt_east",
    name: "NTT East",
    sector: "Telecommunications & Infrastructure",
    relevantDomains: ["community", "aging"],
    relevantGenZCategories: ["digital", "belonging"],
    description: "Regional telecom giant — digital infrastructure, smart cities, rural connectivity",
    keywords: ["digital", "infrastructure", "connectivity", "smart", "rural", "telecom", "mobility", "community", "elderly", "network"],
  },
  {
    id: "kikkoman",
    name: "Kikkoman",
    sector: "Food & Beverage",
    relevantDomains: ["environment", "community"],
    relevantGenZCategories: ["authenticity", "climate"],
    description: "Global soy sauce & food company — 300+ year heritage, sustainability leader",
    keywords: ["food", "sustainability", "agriculture", "heritage", "brand", "transparency", "circular", "waste", "plant", "organic", "community"],
  },
  {
    id: "kirin",
    name: "Kirin",
    sector: "Beverages & Health Sciences",
    relevantDomains: ["aging", "environment"],
    relevantGenZCategories: ["climate", "authenticity"],
    description: "Beverage conglomerate expanding into health sciences and functional foods",
    keywords: ["health", "longevity", "beverage", "sustainability", "carbon", "functional", "aging", "wellness", "green", "food"],
  },
  {
    id: "nintendo",
    name: "Nintendo",
    sector: "Gaming & Entertainment",
    relevantDomains: ["selfhood", "community", "aging"],
    relevantGenZCategories: ["digital", "belonging"],
    description: "Global gaming powerhouse — community building through play, cognitive health",
    keywords: ["gaming", "community", "cognitive", "entertainment", "digital", "creator", "identity", "VTuber", "social", "elderly", "wellness"],
  },
];
