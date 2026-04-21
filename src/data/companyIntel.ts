/**
 * Rich company dossiers for AI prompts (newsletter, sentiment, insight panel).
 * Keep {@link formatCompanyContextForAi} output within token budgets — overview is the main narrative.
 */
export type CompanyIntel = {
  legalName?: string;
  headquarters?: string;
  /** 2–6 sentences: what the company is, how it makes money, geographic footprint. */
  overview: string;
  coreBusinessLines: string[];
  strategicPriorities: string[];
  keyMarkets: string[];
  competitorsOrPeers?: string[];
  ownership?: string;
  leadershipNote?: string;
  brandsAndAssets?: string[];
  /** How media / Gen Z / talent narratives often frame the company — useful for tone. */
  reputationAndGenZ?: string;
  /** Themes to watch in signal analysis (not predictions). */
  riskAndWatchThemes?: string[];
};

export const COMPANY_INTEL = {
  kodansha: {
    legalName: "Kodansha Ltd. (株式会社講談社)",
    headquarters: "Tokyo, Japan",
    overview:
      "Japan's largest publisher by many measures: manga magazines, books, digital distribution (notably K Manga for English simulpub), and global IP licensing for anime, film, and merchandise. Kodansha Studios (Hollywood) marks a strategic push into direct production. The company is private and family-influenced; digital share of revenue has grown materially. Core assets are blockbuster manga IP (e.g. Attack on Titan, Blue Lock, Tokyo Revengers, Fairy Tail, Ghost in the Shell) and magazine brands (Weekly Shōnen Magazine, Young Magazine, etc.).",
    coreBusinessLines: [
      "Manga and magazine publishing (print + digital)",
      "K Manga — global English digital platform",
      "IP licensing — anime, film, games, goods",
      "Kodansha USA / international offices",
      "Kodansha Studios — film/TV production",
      "Creators' Lab / Game Creator's Lab — indie game & cross-media IP",
    ],
    strategicPriorities: [
      "Own the global digital manga relationship (K Manga vs subscription competitors)",
      "Expand Hollywood and cross-border production control via Kodansha Studios",
      "Protect IP from generative AI training without permission (industry joint statements)",
      "Recruit international creators (Manga Academy, DAYS NEO)",
    ],
    keyMarkets: ["Japan", "North America", "Europe", "Southeast Asia", "global licensing"],
    competitorsOrPeers: ["Shueisha", "Shogakukan", "Kadokawa", "webtoon platforms", "Manga Plus"],
    ownership: "Private; Noma family leadership tradition",
    leadershipNote: "CEO Yoshinobu Noma has emphasized global IP, youth audiences, and cross-media 'content is content' positioning.",
    brandsAndAssets: ["Attack on Titan", "Blue Lock", "Tokyo Revengers", "Fairy Tail", "Ghost in the Shell", "Akira", "K Manga", "Kodansha Studios"],
    reputationAndGenZ:
      "Strong with anime/manga fandom globally; K Manga monetization (points vs flat subscription) draws mixed Gen Z feedback. Seen as legacy publisher catching up digitally but with irreplaceable IP.",
    riskAndWatchThemes: [
      "AI copyright and training-data policy",
      "Manga piracy and platform competition",
      "Hollywood production execution risk",
      "FX exposure on U.S. revenue",
    ],
  },

  persol: {
    legalName: "PERSOL HOLDINGS CO., LTD. (TYO: 2181)",
    headquarters: "Tokyo, Japan",
    overview:
      "Major listed HR group in Japan: temporary staffing (Persol Tempstaff — largest segment), recruitment media (doda), BPO, IT staffing, overseas operations (PERSOLKELLY joint venture, Programmed in Australia, Glints in Southeast Asia). Rebranded from Tempstaff to PERSOL in 2017. Positioned at the center of Japan's labor shortage, work-style reform, and reskilling. Strong ESG index inclusion (e.g. GPIF).",
    coreBusinessLines: [
      "Staffing and dispatch (Tempstaff)",
      "Recruitment and career change (doda, Persol Career)",
      "BPO and outsourcing",
      "IT/engineering staffing",
      "APAC — PERSOLKELLY, Programmed, Glints",
      "PERSOL DIVERSE — employment for people with disabilities",
    ],
    strategicPriorities: [
      "Shift from pure staffing to workforce intelligence and platforms",
      "APAC expansion and digital talent marketplaces",
      "Post-merger integration of acquisitions (e.g. Fujitsu Communication Services)",
      "ESG and DEI leadership in HR sector",
    ],
    keyMarkets: ["Japan", "Australia", "Singapore", "Southeast Asia", "select global cities"],
    competitorsOrPeers: ["Recruit Holdings", "ManpowerGroup Japan", "local staffing firms", "Indeed/LinkedIn globally"],
    ownership: "Public; widely held",
    leadershipNote: "Professional management; APAC CEO for PERSOLKELLY; founder legacy (Yoshiko Shinohara) part of brand story.",
    brandsAndAssets: ["PERSOL", "Tempstaff", "doda", "PERSOLKELLY", "Glints", "Global Challenge Program"],
    reputationAndGenZ:
      "Infrastructure-like employer brand in Japan; Gen Z engagement via eSports cup and youth programs; some scrutiny as largest temp agency on labor conditions.",
    riskAndWatchThemes: [
      "Automation reducing temp demand",
      "Gen Z preference for purpose over transactional placement",
      "M&A integration costs",
    ],
  },

  ntt_east: {
    legalName: "NTT East Corporation (東日本電信電話株式会社)",
    headquarters: "Tokyo, Japan (Shinjuku)",
    overview:
      "Fixed-line regional telecom for eastern Japan under the NTT Group. Provides FLET'S Hikari fiber, enterprise network services, smart-city and municipal solutions, disaster-resilient infrastructure, and initiatives for rural connectivity and aging society (IoT, monitoring, local DX). Not the same brand as NTT DOCOMO mobile — focus on wireline, regional coverage, and B2G/B2B digital infrastructure.",
    coreBusinessLines: [
      "Fiber and broadband (FLET'S Hikari)",
      "Enterprise and regional network services",
      "Smart city / municipal DX partnerships",
      "IoT and elderly-care connectivity solutions",
      "Disaster-resilient communications",
    ],
    strategicPriorities: [
      "Maintain universal service and rural fiber penetration",
      "Scale smart-city and healthcare IoT with municipalities",
      "Support national resilience and disaster response networks",
    ],
    keyMarkets: ["Eastern Japan prefectures", "municipal governments", "enterprises", "consumers"],
    competitorsOrPeers: ["KDDI", "SoftBank", "regional utilities' telecom arms", "cable operators"],
    ownership: "NTT Group (listed parent NTT, Inc.)",
    leadershipNote: "Operates under NTT Group governance; strong policy alignment with national digital and regional revitalization goals.",
    brandsAndAssets: ["NTT East", "FLET'S Hikari", "regional NTT East subsidiaries"],
    reputationAndGenZ:
      "Often seen as reliable infrastructure rather than 'cool' tech; relevance through gigabit fiber, remote work, and local community digital inclusion.",
    riskAndWatchThemes: [
      "5G/fiber ROI in rural areas",
      "Legacy brand vs. startup disruptors",
      "Cybersecurity and critical infrastructure responsibility",
    ],
  },

  kikkoman: {
    legalName: "Kikkoman Corporation (キッコーマン株式会社)",
    headquarters: "Noda, Chiba, Japan",
    overview:
      "Global soy sauce and Japanese foods company with 300+ year brewing heritage. Iconic glass bottle and industrial-scale fermentation science. Major overseas production in the U.S. (Wisconsin, California), Europe (Netherlands), and Asia. JFC International handles broad Asian food distribution. Strong sustainability and sourcing narratives; significant North America growth story.",
    coreBusinessLines: [
      "Soy sauce and soy-based seasonings",
      "Del Monte Asia joint ventures and processed foods",
      "Foodservice and retail globally",
      "JFC International — Asian food distribution (North America/Europe)",
    ],
    strategicPriorities: [
      "Global Vision 2030 — expand soy sauce as global seasoning",
      "North America capacity (e.g. Wisconsin expansion)",
      "Sustainable sourcing and carbon reduction",
    ],
    keyMarkets: ["Japan", "United States", "Europe", "Asia", "Oceania"],
    competitorsOrPeers: ["Yamasa", "Haitian / Foshan Haitian", "regional artisan soy brands", "private label"],
    ownership: "Public; Mogi family influence",
    leadershipNote: "Long-tenured executive tradition; Honorary Chairman Yuzaburo Mogi symbolizes globalization era.",
    brandsAndAssets: ["Kikkoman", "JFC International", "Del Monte (Asia JVs)"],
    reputationAndGenZ:
      "Authentic pantry staple; bottle design has cultural cachet on social media; less 'lifestyle brand' than ingredient authority.",
    riskAndWatchThemes: [
      "FX and reported JPY results",
      "Gen Z premium challenger brands",
      "Climate impact on soybean supply",
    ],
  },

  kirin: {
    legalName: "Kirin Holdings Company, Limited",
    headquarters: "Nakano, Tokyo, Japan",
    overview:
      "Diversified group: alcoholic and non-alcoholic beverages (Kirin Ichiban, happoshu, soft drinks), pharmaceuticals via listed subsidiary Kyowa Kirin (oncology, immunology, nephrology), and health science (FANCL, Blackmores, LC-Plasma functional ingredient). Strategic pivot from pure brewer to 'CSV' and health-science conglomerate. Exited problematic Myanmar JV; strong ESG and science-based climate targets narrative.",
    coreBusinessLines: [
      "Beer and RTDs (Japan and Lion in Oceania)",
      "Soft drinks and health beverages",
      "Pharmaceuticals — Kyowa Kirin",
      "Health science — supplements, skincare, functional foods",
    ],
    strategicPriorities: [
      "Grow health sciences and pharma share of profit",
      "Premiumization in beer where volume is weak",
      "Global M&A in wellness (FANCL, Blackmores)",
      "Science-based net-zero and water stewardship",
    ],
    keyMarkets: ["Japan", "Oceania", "Southeast Asia", "United States (craft/New Belgium)", "pharma globally"],
    competitorsOrPeers: ["Asahi", "Suntory", "AB InBev globally", "Big Pharma peers for Kyowa Kirin"],
    ownership: "Public; cross-shareholding history with peer brewers reduced over time",
    leadershipNote: "Leadership emphasizes CSV and global health vision; pharma patent cliffs are an analyst watch item.",
    brandsAndAssets: ["Kirin", "Kyowa Kirin", "FANCL", "Blackmores", "Lion", "New Belgium"],
    reputationAndGenZ:
      "Beer can feel 'parent generation' in Japan; wellness acquisitions aim at younger wellness consumers internationally.",
    riskAndWatchThemes: [
      "Pharma patent cliffs",
      "Alcohol demand decline among young consumers",
      "Functional claim regulation",
    ],
  },

  nintendo: {
    legalName: "Nintendo Co., Ltd. (任天堂株式会社)",
    headquarters: "Kyoto, Japan",
    overview:
      "Integrated game platform company: hardware (Switch family, Switch 2), first-party software (Mario, Zelda, Pokémon, Animal Crossing, Splatoon), mobile titles, IP licensing (films, theme parks with Universal), and cautious metaverse/VR stance. Known for quality-first, family-friendly IP and long hardware cycles. Massive global fan base and nostalgia capital.",
    coreBusinessLines: [
      "Dedicated game hardware and OS",
      "First- and second-party software",
      "Mobile and subscription (Switch Online)",
      "IP licensing — film, merchandise, Super Nintendo World",
    ],
    strategicPriorities: [
      "Successful next-generation platform transitions",
      "Expand IP beyond games without dilution",
      "Cognitive and wellness-adjacent gaming experiments (e.g. past Ring Fit, Brain Age lineage)",
    ],
    keyMarkets: ["Japan", "North America", "Europe", "China (partner operations)"],
    competitorsOrPeers: ["Sony PlayStation", "Microsoft Xbox", "mobile F2P ecosystems", "Roblox/Fortnite for youth time"],
    ownership: "Public; founding Yamauchi family legacy",
    leadershipNote: "President Shuntaro Furukawa and creative leads (Miyamoto, etc.) emphasize IP durability and controlled expansion.",
    brandsAndAssets: ["Nintendo Switch", "Super Mario", "Zelda", "Pokémon", "Animal Crossing", "Super Nintendo World"],
    reputationAndGenZ:
      "Trusted across generations; strong with families and nostalgia; competes for youth attention with social and mobile games.",
    riskAndWatchThemes: [
      "Hardware cycle risk",
      "Mobile and F2P competition for Gen Z time",
      "IP expansion execution (films, parks)",
    ],
  },

  mori_building: {
    legalName: "Mori Building Co., Ltd. (森ビル株式会社)",
    headquarters: "Roppongi Hills Mori Tower, Minato, Tokyo",
    overview:
      "Private urban developer-operator: large-scale mixed-use 'Hills' complexes in central Tokyo (Roppongi Hills, Toranomon Hills, Azabudai Hills — among the largest urban projects in Japan). Revenue drivers include Grade A office leasing, residential (MORI LIVING), hotels, culture (Mori Art Museum, teamLab Borderless at Azabudai), and town management. International footprint: Shanghai landmarks, Jakarta Mori Tower, Singapore office, minority stake in NYC One Vanderbilt. Innovation hubs: Tokyo Venture Capital Hub, ARCH, CIC Tokyo; Mori Building Innovation Fund. Vertical garden city and sustainability leadership (LEED/CASBEE/WELL).",
    coreBusinessLines: [
      "Office leasing — core cash flow",
      "Residential sales and rental",
      "Hotels and retail within developments",
      "Culture and events — museums, exhibitions",
      "International development and consulting",
    ],
    strategicPriorities: [
      "Monetize completed Azabudai and Toranomon phases",
      "Next-generation large-scale Hills project (CEO has signaled successor planning)",
      "Innovation ecosystem and startup density in Hills",
      "Net-zero and resilience-by-design buildings",
    ],
    keyMarkets: ["Tokyo Minato and central wards", "Shanghai", "Jakarta", "Singapore", "select global partnerships"],
    competitorsOrPeers: ["Mitsubishi Estate", "Mitsui Fudosan", "Tokyu Land", "Mori Trust (separate company)", "global developers"],
    ownership: "Private; Mori family controlled",
    leadershipNote: "CEO Shingo Tsuji (professional manager); multiple Mori family members in executive roles.",
    brandsAndAssets: [
      "Roppongi Hills",
      "Toranomon Hills",
      "Azabudai Hills",
      "Mori Art Museum",
      "teamLab Borderless",
      "MORI LIVING",
      "Tokyo Venture Capital Hub",
    ],
    reputationAndGenZ:
      "Premium Tokyo lifestyle and workplace destination; art and innovation programming targets global talent and younger creative class.",
    riskAndWatchThemes: [
      "Hybrid work vs premium office demand",
      "Construction costs and earthquake risk",
      "IR/casino optionality (policy-dependent)",
    ],
  },
} as const satisfies Record<string, CompanyIntel>;

export type CompanyId = keyof typeof COMPANY_INTEL;

/** Compact briefing for LLM system/user context (truncated for token limits). */
export function formatCompanyContextForAi(intel: CompanyIntel, options?: { maxChars?: number }): string {
  const max = options?.maxChars ?? 5500;
  const lines: string[] = [];

  if (intel.legalName) lines.push(`Legal name: ${intel.legalName}`);
  if (intel.headquarters) lines.push(`Headquarters: ${intel.headquarters}`);
  lines.push(`Overview: ${intel.overview}`);
  lines.push(`Core business lines:\n- ${intel.coreBusinessLines.join("\n- ")}`);
  lines.push(`Strategic priorities:\n- ${intel.strategicPriorities.join("\n- ")}`);
  lines.push(`Key markets: ${intel.keyMarkets.join(", ")}`);
  if (intel.competitorsOrPeers?.length) lines.push(`Peers / competitors: ${intel.competitorsOrPeers.join(", ")}`);
  if (intel.ownership) lines.push(`Ownership: ${intel.ownership}`);
  if (intel.leadershipNote) lines.push(`Leadership: ${intel.leadershipNote}`);
  if (intel.brandsAndAssets?.length) lines.push(`Key brands & assets: ${intel.brandsAndAssets.join(", ")}`);
  if (intel.reputationAndGenZ) lines.push(`Reputation & Gen Z: ${intel.reputationAndGenZ}`);
  if (intel.riskAndWatchThemes?.length) lines.push(`Watch themes:\n- ${intel.riskAndWatchThemes.join("\n- ")}`);

  let out = lines.join("\n\n");
  if (out.length > max) out = out.slice(0, max).trimEnd() + "\n…";
  return out;
}

export function hashCompanyContextSnippet(s: string): string {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}
