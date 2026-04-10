import { ArrowLeft, AlertTriangle, TrendingUp, Globe2 } from "lucide-react";
import { SIGNALS } from "@/data/signals";
import { GENZ_SIGNALS } from "@/data/genzSignals";
import { DOMAINS } from "@/data/domains";
import { GENZ_CATEGORIES } from "@/data/genzCategories";
import { COUNTRY_ALIASES } from "./GlobalMap";
import { COMPANIES, CompanyId } from "@/data/companies";
import { ResilienceSignal } from "@/data/types";
import { GenZSignal } from "@/data/genzTypes";
import { DashboardMode } from "./DashboardLayout";
import { ScrollArea } from "@/components/ui/scroll-area";
import NewsFeedSection from "./NewsFeedSection";

interface Props {
  countryName: string;
  mode: DashboardMode;
  selectedCompany: CompanyId | null;
  onClose: () => void;
  onSignalClick: (signal: ResilienceSignal | GenZSignal, mode: DashboardMode) => void;
}

function matchesCountry(location: string, countryName: string): boolean {
  if (location.toLowerCase().includes(countryName.toLowerCase())) return true;
  const aliases = COUNTRY_ALIASES[countryName] || [];
  return aliases.some((a) => location.toLowerCase().includes(a.toLowerCase()));
}

function findAllMatchingCountryNames(countryName: string): string[] {
  if (COUNTRY_ALIASES[countryName]) return [countryName];
  for (const [key, aliases] of Object.entries(COUNTRY_ALIASES)) {
    if (aliases.some((a) => a.toLowerCase() === countryName.toLowerCase())) {
      return [key];
    }
  }
  return [countryName];
}

// Hardcoded resilience exposure scores
const RESILIENCE_SCORES: Record<string, number> = {
  "United States of America": 78, "Japan": 92, "United Kingdom": 71, "Germany": 68,
  "France": 65, "China": 74, "India": 69, "Brazil": 55, "Australia": 72,
  "South Korea": 76, "Indonesia": 52, "Nigeria": 48, "Kenya": 51, "Thailand": 58,
  "Sweden": 80, "Denmark": 82, "Singapore": 85, "Egypt": 44, "South Africa": 47,
  "Colombia": 50, "Argentina": 46, "Vietnam": 54, "Philippines": 49, "Belgium": 70,
  "Netherlands": 77, "Ghana": 43, "Kazakhstan": 41, "United Arab Emirates": 73,
  "Peru": 45, "Chile": 53,
};

const COUNTRY_REGIONS: Record<string, string> = {
  "United States of America": "North America", "Japan": "East Asia", "United Kingdom": "Western Europe",
  "Germany": "Western Europe", "France": "Western Europe", "China": "East Asia",
  "India": "South Asia", "Brazil": "South America", "Australia": "Oceania",
  "South Korea": "East Asia", "Indonesia": "Southeast Asia", "Nigeria": "West Africa",
  "Kenya": "East Africa", "Thailand": "Southeast Asia", "Sweden": "Northern Europe",
  "Denmark": "Northern Europe", "Singapore": "Southeast Asia", "Egypt": "North Africa",
  "South Africa": "Southern Africa", "Colombia": "South America", "Argentina": "South America",
  "Vietnam": "Southeast Asia", "Philippines": "Southeast Asia", "Belgium": "Western Europe",
  "Netherlands": "Western Europe", "Ghana": "West Africa", "Kazakhstan": "Central Asia",
  "United Arab Emirates": "Middle East", "Peru": "South America", "Chile": "South America",
  "Russia": "Eurasia", "Canada": "North America", "Mexico": "North America",
  "Turkey": "Middle East", "Iran": "Middle East", "Saudi Arabia": "Middle East",
};

// Japan perception by country
const JAPAN_PERCEPTION: Record<string, string> = {
  "United States of America": "Strong cultural affinity through anime, gaming, and automotive. Japanese brands are seen as premium and reliable. Growing interest in Japanese work culture reforms.",
  "United Kingdom": "Japan is viewed as a sophisticated innovation partner. Post-Brexit trade deal strengthens bilateral ties. Strong interest in Japanese design and craftsmanship.",
  "Germany": "Mutual respect as manufacturing powerhouses. Japan seen as a model for aging-society management. Growing collaboration in automotive electrification.",
  "France": "Deep cultural appreciation — Japan is seen as a kindred spirit in preserving heritage while innovating. Strong luxury and gastronomy connections.",
  "China": "Complex relationship — admiration for Japanese quality and culture, tension on geopolitics. Japanese brands maintain premium positioning despite diplomatic friction.",
  "India": "Growing strategic partnership. Japan seen as a key infrastructure investor and technology partner. Positive perception driven by bullet train and development projects.",
  "Brazil": "Largest Japanese diaspora outside Japan. Strong cultural ties through Nikkei communities. Japanese brands deeply trusted in automotive and electronics.",
  "South Korea": "Cultural exchange booming despite historical tensions. K-pop and J-pop crossover creating new consumer bridges. Youth see Japan as a travel and lifestyle destination.",
  "Australia": "Japan viewed as a critical trade partner and cultural ally. Strong tourism links. Japanese food culture deeply embedded in Australian cities.",
  "Indonesia": "Japan is the top investor and most trusted development partner. Japanese brands dominate automotive. Growing anime and manga influence among youth.",
  "Nigeria": "Japan seen as aspirational — a model of rapid modernization. Growing interest in Japanese technology and anime. Limited but expanding business presence.",
  "Thailand": "Deep economic ties — Japan is the largest foreign investor. Japanese convenience culture (7-Eleven, ramen) deeply integrated. Very positive public perception.",
  "Singapore": "Japan as a premium lifestyle and innovation benchmark. Strong business ties in finance and technology. Japanese F&B and retail highly popular.",
};

// Company-specific country insights
function getCompanyCountryInsight(companyId: CompanyId | null, countryName: string): string {
  if (!companyId) return "Select a company to see tailored strategic insights for this market.";
  const company = COMPANIES.find(c => c.id === companyId);
  if (!company) return "";
  
  const insights: Record<string, Record<string, string>> = {
    mori_building: {
      "United States of America": "US urban development is shifting toward mixed-use vertical communities — Mori Building's core competency. NYC and SF present partnership opportunities for vertical garden city concepts.",
      "China": "China's Tier 1 cities are building vertical communities at scale. Mori Building's premium positioning and design philosophy can differentiate in Shanghai and Shenzhen's luxury urban segments.",
      "India": "India's rapid urbanization creates demand for integrated urban planning. Mori Building's smart city expertise is directly applicable to Mumbai and Bangalore's development corridors.",
    },
    kirin: {
      "United States of America": "US functional beverage market growing 12% annually. Kirin's health sciences portfolio — particularly immunology and gut health products — has strong product-market fit.",
      "Thailand": "Thailand's wellness tourism sector creates distribution channels for Kirin's functional health products. Partner with hospitality chains for health-focused beverage placement.",
      "Australia": "Australia's health-conscious consumer base and premium beverage market align with Kirin's craft and functional offerings. Lion (subsidiary) provides existing distribution infrastructure.",
    },
    nintendo: {
      "United States of America": "US remains Nintendo's largest market. Opportunities in health gaming and cognitive wellness applications for aging Baby Boomers align with Nintendo's inclusive design philosophy.",
      "India": "India's 500M+ mobile gamers represent a massive untapped audience. Nintendo's family-friendly brand could dominate the premium mobile gaming segment.",
      "Brazil": "Brazil's passionate gaming community and growing middle class present expansion opportunities. Localized content and pricing strategies are key.",
    },
  };

  return insights[companyId]?.[countryName] || 
    `${company.name}'s expertise in ${company.sector.toLowerCase()} positions it to capitalize on emerging trends in ${countryName}. Focus on ${company.relevantDomains.join(" and ")} domains for maximum strategic impact.`;
}

function getRecommendedActions(companyId: CompanyId | null, countryName: string): string[] {
  const company = companyId ? COMPANIES.find(c => c.id === companyId) : null;
  const companyName = company?.name || "your organization";
  
  return [
    `Commission a market-entry feasibility study for ${companyName} in ${countryName}, focusing on regulatory landscape and local partnerships.`,
    `Identify 3-5 local innovation partners in ${countryName} whose capabilities complement ${companyName}'s strategic priorities.`,
    `Monitor resilience signals in ${countryName} quarterly to detect early shifts in consumer behavior and policy direction.`,
  ];
}

const URGENCY_COLORS: Record<string, string> = {
  high: "bg-red-500/20 text-red-400 border-red-500/30",
  medium: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  low: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
};

function getUrgency(intensity: number): { label: string; style: string } {
  if (intensity >= 8) return { label: "High", style: URGENCY_COLORS.high };
  if (intensity >= 5) return { label: "Medium", style: URGENCY_COLORS.medium };
  return { label: "Low", style: URGENCY_COLORS.low };
}

const CountryOutlookPanel = ({ countryName, mode, selectedCompany, onClose, onSignalClick }: Props) => {
  const matchNames = findAllMatchingCountryNames(countryName);
  const matchSignal = (location: string) => matchNames.some((name) => matchesCountry(location, name));

  const resilienceSignals = SIGNALS.filter((s) => matchSignal(s.location));
  const genzSignals = GENZ_SIGNALS.filter((s) => matchSignal(s.location));
  const allSignals = [...resilienceSignals, ...genzSignals];

  const score = RESILIENCE_SCORES[countryName] ?? Math.floor(Math.random() * 40 + 30);
  const region = COUNTRY_REGIONS[countryName] || "Global";
  const japanPerception = JAPAN_PERCEPTION[countryName] || `${countryName} has growing awareness of Japanese brands and culture, with opportunities for deeper engagement through strategic cultural exchange and business partnerships.`;
  const companyInsight = getCompanyCountryInsight(selectedCompany, countryName);
  const actions = getRecommendedActions(selectedCompany, countryName);
  const company = selectedCompany ? COMPANIES.find(c => c.id === selectedCompany) : null;

  const scoreColor = score >= 70 ? "text-emerald-400" : score >= 50 ? "text-amber-400" : "text-red-400";
  const scoreBg = score >= 70 ? "bg-emerald-500/10 border-emerald-500/20" : score >= 50 ? "bg-amber-500/10 border-amber-500/20" : "bg-red-500/10 border-red-500/20";

  return (
    <div className="h-full flex flex-col bg-card border-l border-border">
      {/* Back button + header */}
      <div className="px-4 py-3 border-b border-border">
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-2"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Global
        </button>
        <h2 className="text-xl font-bold text-foreground leading-tight">{countryName}</h2>
        <span className="text-[11px] text-muted-foreground">{region}</span>
      </div>

      <ScrollArea className="flex-1">
        <div className="px-4 py-4 space-y-5">
          {/* Resilience Exposure Score */}
          <div className={`rounded-lg border p-4 ${scoreBg}`}>
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Resilience Exposure</h4>
                <div className={`text-3xl font-black mt-1 ${scoreColor}`}>{score}</div>
              </div>
              <div className="w-12 h-12 rounded-full border-2 flex items-center justify-center" style={{ borderColor: score >= 70 ? "#34d399" : score >= 50 ? "#fbbf24" : "#f87171" }}>
                <Globe2 className="h-5 w-5" style={{ color: score >= 70 ? "#34d399" : score >= 50 ? "#fbbf24" : "#f87171" }} />
              </div>
            </div>
            <div className="mt-2 h-1.5 bg-background/40 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${score}%`,
                  backgroundColor: score >= 70 ? "#34d399" : score >= 50 ? "#fbbf24" : "#f87171",
                }}
              />
            </div>
          </div>

          {/* Company insight */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-primary mb-2">
              {company ? `What This Means for ${company.name}` : "Strategic Context"}
            </h4>
            <p className="text-[12px] text-foreground/80 leading-relaxed">{companyInsight}</p>
          </div>

          {/* Recent Signals */}
          {allSignals.length > 0 && (
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-primary mb-2">
                Recent Signals ({allSignals.length})
              </h4>
              <div className="space-y-1.5">
                {allSignals.map((signal) => {
                  const isResilience = 'domain' in signal;
                  const urgency = getUrgency(signal.intensity);
                  const tag = isResilience
                    ? DOMAINS.find((d) => d.id === (signal as ResilienceSignal).domain)
                    : GENZ_CATEGORIES.find((c) => c.id === (signal as GenZSignal).category);

                  return (
                    <button
                      key={signal.id}
                      onClick={() => onSignalClick(signal, isResilience ? "resilience" : "genz")}
                      className="w-full text-left rounded-lg border border-border bg-background/50 hover:bg-accent/10 p-2.5 transition-colors group"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <h5 className="text-[11px] font-semibold text-foreground group-hover:text-primary transition-colors leading-snug flex-1">
                          {signal.title}
                        </h5>
                        <span className={`shrink-0 inline-block px-1.5 py-0.5 text-[9px] font-bold rounded border ${urgency.style}`}>
                          {urgency.label}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {allSignals.length === 0 && (
            <div className="text-center py-6">
              <div className="text-2xl mb-1">🌍</div>
              <p className="text-xs text-muted-foreground">No signals tracked in {countryName} yet.</p>
            </div>
          )}

          {/* Japan Perception */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
              🇯🇵 Japan Perception
            </h4>
            <p className="text-[11px] text-foreground/70 leading-relaxed">{japanPerception}</p>
          </div>

          {/* Recommended Actions */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: "#ff6701" }}>
              <span className="flex items-center gap-1.5">
                <TrendingUp className="h-3.5 w-3.5" />
                Recommended Actions
              </span>
            </h4>
            <div className="space-y-2">
              {actions.map((action, i) => (
                <div key={i} className="flex gap-2 text-[11px]">
                  <span className="font-black shrink-0" style={{ color: "#ff6701" }}>{i + 1}.</span>
                  <span className="text-foreground/80 leading-relaxed">{action}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
};

export default CountryOutlookPanel;
