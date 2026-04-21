export type CompanyId = "kodansha" | "persol" | "ntt_east" | "kikkoman" | "kirin" | "nintendo" | "mori_building";

export interface Company {
  id: CompanyId;
  name: string;
  sector: string;
  relevantDomains: string[];
  relevantGenZCategories: string[];
  description: string;
  /** Keywords that make a signal relevant to this company */
  keywords: string[];
  /** Sentiment tab: title+description must mention the company name or one of these phrases (no loose industry-only matches). */
  sentimentBrandMarkers?: string[];
}

export const COMPANIES: Company[] = [
  {
    id: "mori_building",
    name: "Mori Building",
    sector: "Real Estate & Urban Development",
    relevantDomains: ["community", "environment", "aging"],
    relevantGenZCategories: ["belonging", "climate", "authenticity"],
    description: "Tokyo-based private urban developer behind Roppongi Hills, Toranomon Hills, and Azabudai Hills. Operates mixed-use vertical city ecosystems across office, residential, culture, and innovation.",
    sentimentBrandMarkers: [
      "Mori Building",
      "Roppongi Hills",
      "Toranomon Hills",
      "Azabudai",
      "Mori Art Museum",
      "MORI LIVING",
      "teamLab Borderless",
      "CIC Tokyo",
      "ARCH Toranomon",
      "vertical garden city",
      "Tokyo Venture Capital Hub",
    ],
    keywords: [
      "Mori Building",
      "Roppongi Hills",
      "Toranomon Hills",
      "Azabudai Hills",
      "urban redevelopment",
      "mixed-use development",
      "vertical garden city",
      "town management",
      "Grade A office",
      "MORI LIVING",
      "Mori Art Museum",
      "teamLab Borderless",
      "Tokyo Venture Capital Hub",
      "ARCH Toranomon",
      "CIC Tokyo",
      "smart city",
      "resilience",
      "sustainability",
      "LEED",
      "CASBEE",
      "WELL",
      "disaster preparedness",
      "Tokyo",
      "Minato",
    ],
  },
];
