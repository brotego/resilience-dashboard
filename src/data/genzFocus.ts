import { GenZCategoryId } from "./genzTypes";

export interface GenZFocusData {
  category: GenZCategoryId;
  headline: string;
  stats: { label: string; value: string }[];
  trends: string[];
  ceoInsight: string;
}

export const GENZ_FOCUS: GenZFocusData[] = [
  {
    category: "authenticity",
    headline: "Japanese Gen Z demands radical brand honesty — mottainai values meet modern transparency",
    stats: [
      { label: "Trust gap", value: "73%" },
      { label: "Pay premium", value: "+28%" },
      { label: "Switch brands", value: "64%" },
    ],
    trends: [
      "Muji and Uniqlo gaining Gen Z loyalty through material transparency",
      "Japanese cosmetics brands leading clean beauty with traditional ingredients",
      "Kikkoman's 300-year heritage becoming authenticity advantage",
    ],
    ceoInsight: "Gen Z doesn't want perfection — they want honesty. Japanese brands with genuine heritage stories have a structural advantage over competitors manufacturing purpose.",
  },
  {
    category: "worklife",
    headline: "Japan's young workforce is rejecting salaryman culture — PERSOL data shows 60% want to leave first jobs",
    stats: [
      { label: "Want flexibility", value: "82%" },
      { label: "Side hustles", value: "45%" },
      { label: "Leave in 3yr", value: "60%" },
    ],
    trends: [
      "Record startup applications from under-30s in Tokyo and Fukuoka",
      "Japanese companies introducing 4-day weeks and sabbaticals",
      "NTT East's remote-first policy attracting young talent back to regions",
    ],
    ceoInsight: "The talent war for Gen Z is not about compensation — it's about autonomy, purpose, and flexibility. Companies that cling to traditional structures will lose this generation entirely.",
  },
  {
    category: "climate",
    headline: "Japanese Gen Z leads Asia in climate-conscious consumption — but demands action over promises",
    stats: [
      { label: "Climate anxious", value: "68%" },
      { label: "Check labels", value: "71%" },
      { label: "Resale growth", value: "+40%" },
    ],
    trends: [
      "Secondhand fashion platforms like Mercari seeing record Gen Z adoption",
      "Plant-forward dining trend aligning with traditional Japanese shojin ryori",
      "Osaka's zero food waste initiative led by Gen Z activists",
    ],
    ceoInsight: "Japanese companies have a unique opportunity: cultural traditions like mottainai and shojin ryori are perfectly aligned with Gen Z climate values. Authenticity, not marketing, is the strategy.",
  },
  {
    category: "digital",
    headline: "Japan's VTuber economy worth ¥800B — Gen Z digital identity is Japan's biggest cultural export",
    stats: [
      { label: "VTuber market", value: "¥800B" },
      { label: "AI tool usage", value: "85%" },
      { label: "Creator share", value: "42%" },
    ],
    trends: [
      "VTubers earning more than traditional TV celebrities among Gen Z audience",
      "Kodansha IP being remixed by Gen Z creators on TikTok and YouTube",
      "Nintendo's community ecosystem as model for Gen Z digital belonging",
    ],
    ceoInsight: "Japan is the world leader in virtual identity and character-based economy. This isn't niche — it's Gen Z's default mode of digital expression and it's worth billions.",
  },
  {
    category: "belonging",
    headline: "Gen Z craves real belonging — Mori Building's community spaces are exactly what this generation needs",
    stats: [
      { label: "Feel lonely", value: "61%" },
      { label: "Prefer small groups", value: "68%" },
      { label: "Co-living interest", value: "52%" },
    ],
    trends: [
      "Mori Building's community programming attracting young professionals to Roppongi",
      "Fukuoka attracting Japan's young creatives with community-first urbanism",
      "New 'third place 2.0' concepts blending café, library, and co-working",
    ],
    ceoInsight: "The loneliness economy is worth $20B globally. Japanese companies that create genuine community — not just consumer experiences — will capture Gen Z loyalty for decades.",
  },
];
