import { ArrowLeft } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { DOMAINS } from "@/data/domains";
import { GENZ_CATEGORIES } from "@/data/genzCategories";
import { COUNTRY_ALIASES } from "./GlobalMap";
import { COMPANIES, CompanyId } from "@/data/companies";
import { UnifiedSignal } from "@/data/unifiedSignalTypes";
import { DashboardMode } from "./DashboardLayout";
import { ScrollArea } from "@/components/ui/scroll-area";
import NewsFeedSection from "./NewsFeedSection";
import { useLang } from "@/i18n/LanguageContext";
import { useJpUi } from "@/i18n/jpUiContext";
import { getCompanyDisplayName } from "@/i18n/companyLocale";
import { translateJapaneseArticleRows } from "@/api/translateJapaneseUi";
import { tr, type Lang, type TranslationKey } from "@/i18n/translations";
import { invokeNewsFeed } from "@/api/newsFeed";
import { invokeArticleSentimentBatch, invokeSentimentFallbackOpinion, invokeCountryCompanyInsight, ArticleSentiment } from "@/api/aiInsight";

interface Props {
  countryName: string;
  mode: DashboardMode;
  selectedCompany: CompanyId | null;
  signals: UnifiedSignal[];
  onClose: () => void;
  onSignalClick: (signal: any) => void;
}

type SentimentView = "company" | "japan";
type SentimentArticle = { id: string; title: string; source: string; description: string; date: string; url: string };

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

const COUNTRY_REGIONS_JP: Record<string, string> = {
  "United States of America": "北米", "Japan": "東アジア", "United Kingdom": "西ヨーロッパ",
  "Germany": "西ヨーロッパ", "France": "西ヨーロッパ", "China": "東アジア",
  "India": "南アジア", "Brazil": "南米", "Australia": "オセアニア",
  "South Korea": "東アジア", "Indonesia": "東南アジア", "Nigeria": "西アフリカ",
  "Kenya": "東アフリカ", "Thailand": "東南アジア", "Sweden": "北ヨーロッパ",
  "Denmark": "北ヨーロッパ", "Singapore": "東南アジア", "Egypt": "北アフリカ",
  "South Africa": "南アフリカ", "Colombia": "南米", "Argentina": "南米",
  "Vietnam": "東南アジア", "Philippines": "東南アジア", "Belgium": "西ヨーロッパ",
  "Netherlands": "西ヨーロッパ", "Ghana": "西アフリカ", "Kazakhstan": "中央アジア",
  "United Arab Emirates": "中東", "Peru": "南米", "Chile": "南米",
  "Russia": "ユーラシア", "Canada": "北米", "Mexico": "北米",
  "Turkey": "中東", "Iran": "中東", "Saudi Arabia": "中東",
};

const COUNTRY_NAMES_JP: Record<string, string> = {
  "United States of America": "アメリカ合衆国", "Japan": "日本", "United Kingdom": "イギリス",
  "Germany": "ドイツ", "France": "フランス", "China": "中国",
  "India": "インド", "Brazil": "ブラジル", "Australia": "オーストラリア",
  "South Korea": "韓国", "Indonesia": "インドネシア", "Nigeria": "ナイジェリア",
  "Kenya": "ケニア", "Thailand": "タイ", "Sweden": "スウェーデン",
  "Denmark": "デンマーク", "Singapore": "シンガポール", "Egypt": "エジプト",
  "South Africa": "南アフリカ", "Colombia": "コロンビア", "Argentina": "アルゼンチン",
  "Vietnam": "ベトナム", "Philippines": "フィリピン", "Belgium": "ベルギー",
  "Netherlands": "オランダ", "Ghana": "ガーナ", "Kazakhstan": "カザフスタン",
  "United Arab Emirates": "アラブ首長国連邦", "Peru": "ペルー", "Chile": "チリ",
  "Russia": "ロシア", "Canada": "カナダ", "Mexico": "メキシコ",
  "Turkey": "トルコ", "Iran": "イラン", "Saudi Arabia": "サウジアラビア",
  "Taiwan": "台湾", "New Zealand": "ニュージーランド", "Israel": "イスラエル",
  "Malaysia": "マレーシア", "Pakistan": "パキスタン", "Bangladesh": "バングラデシュ",
  "Sri Lanka": "スリランカ", "Nepal": "ネパール", "Myanmar": "ミャンマー",
  "Cambodia": "カンボジア", "Morocco": "モロッコ", "Tunisia": "チュニジア",
  "Ethiopia": "エチオピア", "Tanzania": "タンザニア", "Rwanda": "ルワンダ",
  "Senegal": "セネガル", "Cuba": "キューバ", "Jamaica": "ジャマイカ",
  "Iceland": "アイスランド", "Norway": "ノルウェー", "Finland": "フィンランド",
  "Ireland": "アイルランド", "Poland": "ポーランド", "Ukraine": "ウクライナ",
  "Romania": "ルーマニア", "Czech Republic": "チェコ", "Austria": "オーストリア",
  "Switzerland": "スイス", "Portugal": "ポルトガル", "Greece": "ギリシャ",
  "Hungary": "ハンガリー", "Georgia": "ジョージア", "Uzbekistan": "ウズベキスタン",
  "Jordan": "ヨルダン", "Lebanon": "レバノン", "Qatar": "カタール",
  "Namibia": "ナミビア", "Spain": "スペイン", "Italy": "イタリア",
};

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

const JAPAN_PERCEPTION_JP: Record<string, string> = {
  "United States of America": "アニメ、ゲーム、自動車を通じた強い文化的親和性。日本ブランドはプレミアムで信頼性が高いと見なされている。日本の働き方改革への関心が高まっている。",
  "United Kingdom": "日本は洗練されたイノベーションパートナーと見なされている。ブレグジット後の貿易協定が二国間関係を強化。日本のデザインと職人技への強い関心。",
  "Germany": "製造大国としての相互尊重。日本は高齢社会管理のモデルと見なされている。自動車電動化での協力が拡大中。",
  "France": "深い文化的敬意 — 日本は伝統を守りながら革新する精神的な同志と見なされている。高級品と食文化での強いつながり。",
  "China": "複雑な関係 — 日本の品質と文化への称賛と地政学的緊張が共存。外交摩擦にもかかわらず日本ブランドはプレミアムポジションを維持。",
  "India": "成長する戦略的パートナーシップ。日本は主要なインフラ投資家および技術パートナーと見なされている。新幹線プロジェクトによる好意的な認知。",
  "Brazil": "日本国外最大の日系人コミュニティ。日系コミュニティを通じた強い文化的つながり。自動車と電機分野で日本ブランドへの深い信頼。",
  "South Korea": "歴史的緊張にもかかわらず文化交流が活発化。K-POPとJ-POPのクロスオーバーが新たな消費者の架け橋を形成。若者は日本を旅行・ライフスタイルの目的地と見なしている。",
  "Australia": "日本は重要な貿易パートナーおよび文化的同盟国。強い観光つながり。日本食文化がオーストラリアの都市に深く根付いている。",
  "Indonesia": "日本は最大の投資国であり最も信頼される開発パートナー。自動車で日本ブランドが支配的。若者の間でアニメ・マンガの影響力が拡大中。",
  "Nigeria": "日本は憧れの対象 — 急速な近代化のモデル。日本の技術とアニメへの関心が高まっている。限定的だが拡大中のビジネスプレゼンス。",
  "Thailand": "深い経済的つながり — 日本は最大の外国投資国。コンビニ文化やラーメンなど日本の利便文化が深く統合。非常に好意的な世論。",
  "Singapore": "日本はプレミアムなライフスタイルとイノベーションのベンチマーク。金融とテクノロジーでの強いビジネス関係。日本の飲食・小売が非常に人気。",
};

function getCompanyCountryInsight(companyId: CompanyId | null, countryName: string, lang: Lang): string {
  if (!companyId) return tr("country.selectCompany", lang);
  const company = COMPANIES.find(c => c.id === companyId);
  if (!company) return "";
  
  const insights: Record<string, Record<string, string>> = {
    mori_building: {
      "United States of America": lang === "jp" ? "米国の都市開発は複合用途の垂直コミュニティに移行中 — 森ビルのコアコンピタンスです。NYCとSFは垂直庭園都市コンセプトのパートナーシップ機会を提供。" : "US urban development is shifting toward mixed-use vertical communities — Mori Building's core competency. NYC and SF present partnership opportunities for vertical garden city concepts.",
      "China": lang === "jp" ? "中国のTier 1都市は垂直コミュニティを大規模に構築中。森ビルのプレミアムポジショニングとデザイン哲学は上海・深圳の高級都市セグメントで差別化可能。" : "China's Tier 1 cities are building vertical communities at scale. Mori Building's premium positioning and design philosophy can differentiate in Shanghai and Shenzhen's luxury urban segments.",
      "India": lang === "jp" ? "インドの急速な都市化は統合的な都市計画への需要を創出。森ビルのスマートシティ専門知識はムンバイとバンガロールの開発回廊に直接適用可能。" : "India's rapid urbanization creates demand for integrated urban planning. Mori Building's smart city expertise is directly applicable to Mumbai and Bangalore's development corridors.",
    },
    kirin: {
      "United States of America": lang === "jp" ? "米国の機能性飲料市場は年12%成長。キリンの健康科学ポートフォリオ — 特に免疫学と腸内健康製品 — は強い製品市場適合性を持つ。" : "US functional beverage market growing 12% annually. Kirin's health sciences portfolio — particularly immunology and gut health products — has strong product-market fit.",
      "Thailand": lang === "jp" ? "タイのウェルネスツーリズム部門はキリンの機能性健康製品の流通チャネルを創出。ホスピタリティチェーンとの提携による健康志向飲料の配置を推奨。" : "Thailand's wellness tourism sector creates distribution channels for Kirin's functional health products. Partner with hospitality chains for health-focused beverage placement.",
    },
  };

  const fallback = lang === "jp" 
    ? `${company.name}の${company.sector.toLowerCase()}における専門性は、${COUNTRY_NAMES_JP[countryName] || countryName}の新興トレンドを活用するのに有利な位置にあります。${company.relevantDomains.join("と")}ドメインに注力することで最大の戦略的インパクトが期待できます。`
    : `${company.name}'s expertise in ${company.sector.toLowerCase()} positions it to capitalize on emerging trends in ${countryName}. Focus on ${company.relevantDomains.join(" and ")} domains for maximum strategic impact.`;

  return insights[companyId]?.[countryName] || fallback;
}

function getRecommendedActions(companyId: CompanyId | null, countryName: string, lang: Lang): string[] {
  const company = companyId ? COMPANIES.find(c => c.id === companyId) : null;
  const companyName = company?.name || (lang === "jp" ? "御社" : "your organization");
  const cn = lang === "jp" ? (COUNTRY_NAMES_JP[countryName] || countryName) : countryName;
  
  if (lang === "jp") {
    return [
      `${cn}における${companyName}の市場参入フィージビリティスタディを実施し、規制環境とローカルパートナーシップに焦点を当てる。`,
      `${cn}で${companyName}の戦略的優先事項を補完する能力を持つ3〜5社のローカルイノベーションパートナーを特定する。`,
      `${cn}のレジリエンスシグナルを四半期ごとにモニタリングし、消費者行動と政策方向の早期変化を検知する。`,
    ];
  }
  return [
    `Commission a market-entry feasibility study for ${companyName} in ${countryName}, focusing on regulatory landscape and local partnerships.`,
    `Identify 3-5 local innovation partners in ${countryName} whose capabilities complement ${companyName}'s strategic priorities.`,
    `Monitor resilience signals in ${countryName} quarterly to detect early shifts in consumer behavior and policy direction.`,
  ];
}

function includesAny(text: string, keywords: string[]): boolean {
  return keywords.some((kw) => text.includes(kw.toLowerCase()));
}

function pickWithFallback<T>(items: T[], strict: (item: T) => boolean, limit: number): T[] {
  const strictMatches = items.filter(strict).slice(0, limit);
  if (strictMatches.length > 0) return strictMatches;
  return items.slice(0, limit);
}

function isJapanArticle(article: SentimentArticle): boolean {
  const text = `${article.title} ${article.description} ${article.source}`.toLowerCase();
  return includesAny(text, ["japan", "japanese", "tokyo", "osaka", "jp"]);
}

function isCompanyOrIndustryArticle(article: SentimentArticle, companyName: string, sector: string, keywords: string[]): boolean {
  const text = `${article.title} ${article.description} ${article.source}`.toLowerCase();
  const sectorTokens = sector
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 4);
  return includesAny(text, [companyName, ...keywords, ...sectorTokens]);
}

const COUNTRY_CODES: Record<string, string> = {
  "United States of America": "us", "Japan": "jp", "United Kingdom": "gb",
  "Germany": "de", "France": "fr", "China": "cn", "India": "in",
  "Brazil": "br", "Australia": "au", "South Korea": "kr", "Indonesia": "id",
  "Nigeria": "ng", "Kenya": "ke", "Thailand": "th", "Sweden": "se",
  "Denmark": "dk", "Singapore": "sg", "Egypt": "eg", "South Africa": "za",
  "Colombia": "co", "Argentina": "ar", "Vietnam": "vn", "Philippines": "ph",
  "Belgium": "be", "Netherlands": "nl", "Ghana": "gh", "Kazakhstan": "kz",
  "United Arab Emirates": "ae", "Peru": "pe", "Chile": "cl",
  "Russia": "ru", "Canada": "ca", "Mexico": "mx", "Turkey": "tr",
  "Iran": "ir", "Saudi Arabia": "sa", "Italy": "it", "Spain": "es",
  "Poland": "pl", "Ukraine": "ua", "Romania": "ro", "Czech Republic": "cz",
  "Austria": "at", "Switzerland": "ch", "Portugal": "pt", "Greece": "gr",
  "Hungary": "hu", "Norway": "no", "Finland": "fi", "Ireland": "ie",
  "New Zealand": "nz", "Israel": "il", "Malaysia": "my", "Taiwan": "tw",
  "Pakistan": "pk", "Bangladesh": "bd", "Sri Lanka": "lk",
};

const URGENCY_COLORS: Record<string, string> = {
  high: "bg-red-500/20 text-red-400 border-red-500/30",
  medium: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  low: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
};

function getUrgency(intensity: number, t: (key: TranslationKey) => string): { label: string; style: string } {
  if (intensity >= 8) return { label: t("urgency.labelHigh"), style: URGENCY_COLORS.high };
  if (intensity >= 5) return { label: t("urgency.labelMedium"), style: URGENCY_COLORS.medium };
  return { label: t("urgency.labelLow"), style: URGENCY_COLORS.low };
}

function sentimentToneLabel(tone: ArticleSentiment, t: (key: TranslationKey) => string): string {
  return t(`sentiment.${tone}` as TranslationKey);
}

const CountryOutlookPanel = ({ countryName, mode, selectedCompany, signals, onClose, onSignalClick }: Props) => {
  const { lang, t } = useLang();
  const { getSignalDisplay } = useJpUi();
  const [jpSentimentArticleMap, setJpSentimentArticleMap] = useState<
    Record<string, { title: string; description: string }>
  >({});
  const [sentimentView, setSentimentView] = useState<SentimentView>("japan");
  const [sentimentArticles, setSentimentArticles] = useState<Record<SentimentView, SentimentArticle[]>>({ company: [], japan: [] });
  const [sentimentLabels, setSentimentLabels] = useState<Record<SentimentView, Record<string, ArticleSentiment>>>({ company: {}, japan: {} });
  const [sentimentFallbackOpinion, setSentimentFallbackOpinion] = useState<Record<SentimentView, { tone: ArticleSentiment; opinion: string } | null>>({ company: null, japan: null });
  const [sentimentLoading, setSentimentLoading] = useState(false);
  const [companyInsightText, setCompanyInsightText] = useState<string>("");
  const [companyInsightLoading, setCompanyInsightLoading] = useState(false);
  const matchNames = findAllMatchingCountryNames(countryName);
  const matchSignal = (location: string) => matchNames.some((name) => matchesCountry(location, name));

  const allSignals = signals.filter((s) => {
    if (!matchSignal(s.location)) return false;
    if (mode === "resilience") return s.layer === "resilience" || s.layer === "live-news";
    return s.layer === "genz" || s.layer === "live-news";
  });

  const score = RESILIENCE_SCORES[countryName] ?? Math.floor(Math.random() * 40 + 30);
  const region = lang === "jp" ? (COUNTRY_REGIONS_JP[countryName] || COUNTRY_REGIONS[countryName] || "グローバル") : (COUNTRY_REGIONS[countryName] || "Global");
  const japanPerception = lang === "jp" ? (JAPAN_PERCEPTION_JP[countryName] || JAPAN_PERCEPTION[countryName] || `${COUNTRY_NAMES_JP[countryName] || countryName}は日本のブランドと文化への認知が高まっており、戦略的な文化交流とビジネスパートナーシップを通じたより深いエンゲージメントの機会があります。`) : (JAPAN_PERCEPTION[countryName] || `${countryName} has growing awareness of Japanese brands and culture, with opportunities for deeper engagement through strategic cultural exchange and business partnerships.`);
  const companyInsight = companyInsightText || getCompanyCountryInsight(selectedCompany, countryName, lang);
  const company = selectedCompany ? COMPANIES.find(c => c.id === selectedCompany) : null;
  const businessIndustryQuery = company
    ? [
        company.sector,
        ...company.keywords.slice(0, 4),
        ...company.relevantDomains,
      ]
        .filter(Boolean)
        .join(" ")
    : undefined;
  const displayName = lang === "jp" ? (COUNTRY_NAMES_JP[countryName] || countryName) : countryName;
  const activeSentimentArticles = sentimentArticles[sentimentView];
  const activeSentimentText = sentimentView === "japan"
    ? (lang === "jp"
      ? `${displayName}の主要報道における日本への見方を、見出し・論調・リスク認識の観点から整理して表示します。直近の報道温度感をもとに、友好的な評価か、慎重姿勢か、懸念が強いかを読み取り、対外メッセージや連携方針の調整に活用できます。`
      : `This view summarizes how media in ${countryName} is framing Japan across recent coverage, including tone, risk perception, and narrative direction. Use it to gauge whether the current sentiment climate is supportive, cautious, or adverse when shaping local partnerships and communications.`)
    : (company
      ? (lang === "jp"
        ? `${displayName}の報道文脈における${getCompanyDisplayName(company, lang)}への評価を、期待・懸念・実行リスクの3点で可視化します。好意的な論調だけでなく、慎重論や逆風シグナルも含めて把握することで、現地での優先アクションと打ち手の順序を明確にできます。`
        : `This view shows how coverage in ${countryName} perceives ${company.name}, including positive momentum, caution signals, and execution risk themes. The goal is to help prioritize local actions based on the current narrative, not just headline-level sentiment.`)
      : t("dashboard.sentimentCompanyHint"));

  const sentimentArticlesSig = useMemo(
    () => activeSentimentArticles.map((a) => a.id).join("|"),
    [activeSentimentArticles],
  );

  useEffect(() => {
    if (lang !== "jp" || activeSentimentArticles.length === 0) {
      setJpSentimentArticleMap({});
      return;
    }
    let cancelled = false;
    translateJapaneseArticleRows(
      activeSentimentArticles.slice(0, 14).map((a) => ({
        id: a.id,
        title: a.title,
        description: a.description || "",
      })),
    ).then((map) => {
      if (!cancelled) setJpSentimentArticleMap(map);
    });
    return () => {
      cancelled = true;
    };
  }, [lang, sentimentArticlesSig]);

  const perceptionToneClasses: Record<"positive" | "mixed" | "negative", string> = {
    positive: "text-emerald-300 border-emerald-500/40 bg-emerald-500/10",
    mixed: "text-sky-300 border-sky-500/40 bg-sky-500/10",
    negative: "text-red-300 border-red-500/40 bg-red-500/10",
  };

  const scoreColor = score >= 70 ? "text-emerald-400" : score >= 50 ? "text-amber-400" : "text-red-400";
  const scoreBg = score >= 70 ? "bg-emerald-500/10 border-emerald-500/20" : score >= 50 ? "bg-amber-500/10 border-amber-500/20" : "bg-red-500/10 border-red-500/20";

  const withTimeout = async <T,>(promise: Promise<T>, ms: number, fallback: T): Promise<T> => {
    let timeout: ReturnType<typeof setTimeout> | null = null;
    const timeoutPromise = new Promise<T>((resolve) => {
      timeout = setTimeout(() => resolve(fallback), ms);
    });
    const result = await Promise.race([promise, timeoutPromise]);
    if (timeout) clearTimeout(timeout);
    return result;
  };

  useEffect(() => {
    const countryCode = COUNTRY_CODES[countryName] || "us";
    const companyName = company?.name;
    const companyKeywords = company?.keywords.slice(0, 4).map((k) => `"${k}"`).join(" | ");
    const companyQuery = companyName
      ? `"${companyName}"${companyKeywords ? ` | (${companyKeywords})` : ""}`
      : "";
    const japanQuery = `"Japan" | Japanese | "Japanese government" | "Japanese companies"`;

    let cancelled = false;
    setSentimentLoading(true);

    Promise.all([
      withTimeout(
        companyQuery
          ? invokeNewsFeed({
              type: "sentiment",
              countryCode,
              countryName,
              topicQuery: companyQuery,
              pageSize: 6,
            })
          : Promise.resolve({ data: { articles: [] }, error: null }),
        12000,
        { data: { articles: [] }, error: new Error("timeout") },
      ),
      withTimeout(
        invokeNewsFeed({
          type: "sentiment",
          countryCode,
          countryName,
          topicQuery: japanQuery,
          pageSize: 6,
        }),
        12000,
        { data: { articles: [] }, error: new Error("timeout") },
      ),
    ]).then(async ([companyData, japanData]) => {
      if (cancelled) return;
      const rawCompanyArticles = (companyData.data?.articles || [])
        .map((a, idx) => ({ ...a, id: a.url || `${a.title}-${idx}` }));
      const rawJapanArticles = (japanData.data?.articles || [])
        .map((a, idx) => ({ ...a, id: a.url || `${a.title}-${idx}` }));

      const companyArticles = pickWithFallback(
        rawCompanyArticles,
        (a) => !company || isCompanyOrIndustryArticle(a, company.name, company.sector, company.keywords),
        6,
      );
      const japanArticles = pickWithFallback(rawJapanArticles, (a) => isJapanArticle(a), 6);

      const [companySentiment, japanSentiment, companyOpinion, japanOpinion] = await Promise.all([
        withTimeout(
          invokeArticleSentimentBatch({
            lens: "company",
            company: company?.name || null,
            industry: company?.sector || null,
            countryName,
            language: lang,
            articles: companyArticles.map((a) => ({
              id: a.id,
              title: a.title,
              description: a.description,
              source: a.source,
              date: a.date,
              url: a.url,
            })),
          }),
          12000,
          { data: {}, error: new Error("timeout") },
        ),
        withTimeout(
          invokeArticleSentimentBatch({
            lens: "japan",
            countryName,
            language: lang,
            articles: japanArticles.map((a) => ({
              id: a.id,
              title: a.title,
              description: a.description,
              source: a.source,
              date: a.date,
              url: a.url,
            })),
          }),
          12000,
          { data: {}, error: new Error("timeout") },
        ),
        companyArticles.length === 0
          ? withTimeout(
              invokeSentimentFallbackOpinion({
                lens: "company",
                company: company?.name || null,
                industry: company?.sector || null,
                countryName,
                language: lang,
              }),
              12000,
              { data: null, error: new Error("timeout") },
            )
          : Promise.resolve({ data: null, error: null }),
        japanArticles.length === 0
          ? withTimeout(
              invokeSentimentFallbackOpinion({
                lens: "japan",
                countryName,
                language: lang,
              }),
              12000,
              { data: null, error: new Error("timeout") },
            )
          : Promise.resolve({ data: null, error: null }),
      ]);

      if (cancelled) return;
      setSentimentArticles({
        company: companyArticles,
        japan: japanArticles,
      });
      setSentimentLabels({
        company: companySentiment.data || {},
        japan: japanSentiment.data || {},
      });
      setSentimentFallbackOpinion({
        company: companyOpinion.data || null,
        japan: japanOpinion.data || null,
      });
      setSentimentLoading(false);
    }).catch(() => {
      if (cancelled) return;
      setSentimentArticles({ company: [], japan: [] });
      setSentimentLabels({ company: {}, japan: {} });
      setSentimentFallbackOpinion({ company: null, japan: null });
      setSentimentLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [countryName, company?.id, lang]);

  useEffect(() => {
    let cancelled = false;
    if (!company) {
      setCompanyInsightText("");
      setCompanyInsightLoading(false);
      return;
    }
    setCompanyInsightLoading(true);
    withTimeout(
      invokeCountryCompanyInsight({
        company: company.name,
        industry: company.sector,
        countryName,
        language: lang,
        signals: allSignals.map((s) => ({
          title: s.title,
          description: s.description,
          source: s.source,
          location: s.location,
          domain: s.domain || s.category,
          urgency: s.urgency,
        })),
      }),
      12000,
      { data: null, error: new Error("timeout") },
    )
      .then((result) => {
        if (cancelled) return;
        setCompanyInsightText(result.data?.insight || getCompanyCountryInsight(selectedCompany, countryName, lang));
        setCompanyInsightLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setCompanyInsightText(getCompanyCountryInsight(selectedCompany, countryName, lang));
        setCompanyInsightLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [company?.id, countryName, lang, allSignals.length]);

  return (
    <div className="h-full flex flex-col bg-card border-l border-border">
      <div className="px-3 py-2 border-b border-border">
        <button
          onClick={onClose}
          className="flex items-center gap-1 text-[10px] font-mono text-muted-foreground hover:text-foreground transition-colors mb-1.5 uppercase tracking-widest"
        >
          <ArrowLeft className="h-3 w-3" />
          {t("country.backToGlobal")}
        </button>
        <h2 className="text-lg font-bold text-foreground leading-tight">{displayName}</h2>
        <span className="text-[10px] font-mono text-muted-foreground">{region}</span>
      </div>

      <ScrollArea className="flex-1">
        <div className="px-3 py-3 space-y-3">
          {/* Company fit position bar */}
          <div className={`rounded-sm border p-3 ${scoreBg}`}>
            <h4 className="text-[9px] font-mono font-bold uppercase tracking-widest text-muted-foreground">{t("country.resilienceExposure")}</h4>
            <div className="relative mt-2 h-[6px] bg-background/40 rounded-sm overflow-hidden">
              <div
                className="absolute inset-y-0 left-0 rounded-sm transition-all duration-700"
                style={{
                  width: `${score}%`,
                  backgroundColor: score >= 70 ? "#34d399" : score >= 50 ? "#fbbf24" : "#f87171",
                }}
              />
              <div
                className="absolute top-1/2 -translate-y-1/2 h-2.5 w-2.5 rounded-full border"
                style={{
                  left: `calc(${score}% - 5px)`,
                  backgroundColor: score >= 70 ? "#34d399" : score >= 50 ? "#fbbf24" : "#f87171",
                  borderColor: score >= 70 ? "#34d399" : score >= 50 ? "#fbbf24" : "#f87171",
                }}
              />
            </div>
            <div className="mt-1.5 flex items-center justify-between text-[9px] font-mono text-muted-foreground">
              <span>{t("panel.marginalSignal")}</span>
              <span>{t("panel.companyFitSlider")}</span>
            </div>
          </div>

          {/* Company insight */}
          <div>
            <h4 className="text-[10px] font-mono font-bold uppercase tracking-widest text-primary mb-1.5">
              {company ? `${t("country.whatThisMeans")} ${getCompanyDisplayName(company, lang)}` : t("country.strategicContext")}
            </h4>
            <p className="text-[11px] text-foreground/80 leading-snug">
              {companyInsightLoading ? t("dashboard.analyzingSignals") : companyInsight}
            </p>
          </div>

          {/* Recent Signals */}
          {allSignals.length > 0 && (
            <div>
              <h4 className="text-[10px] font-mono font-bold uppercase tracking-widest text-primary mb-1.5">
                {t("country.recentSignals")} ({allSignals.length})
              </h4>
              <div className="space-y-1">
                {allSignals.map((signal) => {
                  const urgency = getUrgency(Math.round(signal.resilienceScore), t);
                  const disp = getSignalDisplay(signal);
                  return (
                    <button
                      key={signal.id}
                      onClick={() => onSignalClick(signal)}
                      className="w-full text-left rounded-sm border border-border bg-background/50 hover:bg-secondary/30 p-2 transition-colors group"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <h5 className="text-[10px] font-semibold text-foreground group-hover:text-primary transition-colors leading-snug flex-1">
                          {disp.title}
                        </h5>
                        <span className={`shrink-0 inline-block px-1.5 py-0.5 text-[8px] font-mono font-bold rounded-sm border ${urgency.style}`}>
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
            <div className="text-center py-4">
              <p className="text-[10px] font-mono text-muted-foreground">{t("country.noSignals")} {displayName} {t("country.yet")}</p>
            </div>
          )}

          {/* Business News Feed */}
          <NewsFeedSection countryName={countryName} type="business" topicQuery={businessIndustryQuery} />

          {/* Sentiment toggle: company vs Japan lens */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <h4 className="text-[10px] font-mono font-bold uppercase tracking-widest text-muted-foreground">
                {t("dashboard.sentimentAnalysis")}
              </h4>
              <div className="flex gap-1">
                <button
                  onClick={() => setSentimentView("company")}
                  disabled={!company}
                  className={`px-2 py-0.5 text-[8px] font-mono font-semibold uppercase tracking-wider rounded-sm transition-colors ${
                    sentimentView === "company" ? "bg-accent text-accent-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"
                  } ${!company ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  {t("dashboard.colCompany")}
                </button>
                <button
                  onClick={() => setSentimentView("japan")}
                  className={`px-2 py-0.5 text-[8px] font-mono font-semibold uppercase tracking-wider rounded-sm transition-colors ${
                    sentimentView === "japan" ? "bg-accent text-accent-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t("dashboard.colJapan")}
                </button>
              </div>
            </div>
            <div className="border border-border rounded-sm overflow-hidden bg-card/60">
              <div className="px-2 py-2 border-b border-border bg-background/30">
                <p className="text-[10px] text-foreground/80 leading-snug">{activeSentimentText}</p>
              </div>
              <div className="divide-y divide-border">
                {sentimentLoading ? (
                  <div className="px-2 py-2 text-[10px] text-muted-foreground">
                    {t("dashboard.loadingCoverage")}
                  </div>
                ) : activeSentimentArticles.length > 0 ? (
                  activeSentimentArticles.map((article, idx) => {
                    const tone = sentimentLabels[sentimentView][article.id] || "mixed";
                    const trArt = jpSentimentArticleMap[article.id];
                    const titleUi = lang === "jp" && trArt?.title ? trArt.title : article.title;
                    return (
                      <div key={`perception-${idx}`} className="px-2 py-2 flex items-start justify-between gap-2">
                        <div>
                          <p className="text-[10px] text-foreground/85 leading-snug">{titleUi}</p>
                          <p className="text-[9px] text-muted-foreground mt-0.5 uppercase tracking-wider">{article.source}</p>
                        </div>
                        <span
                          className={`shrink-0 px-1.5 py-0.5 rounded-sm border text-[8px] font-mono font-semibold uppercase tracking-wider ${perceptionToneClasses[tone]}`}
                        >
                          {sentimentToneLabel(tone, t)}
                        </span>
                      </div>
                    );
                  })
                ) : (
                  <div className="px-2 py-2 text-[10px] text-muted-foreground">
                    {sentimentFallbackOpinion[sentimentView] ? (
                      <div className="space-y-1.5">
                        <span
                          className={`inline-flex px-1.5 py-0.5 rounded-sm border text-[8px] font-mono font-semibold uppercase tracking-wider ${perceptionToneClasses[sentimentFallbackOpinion[sentimentView]!.tone]}`}
                        >
                          {sentimentToneLabel(sentimentFallbackOpinion[sentimentView]!.tone, t)}
                        </span>
                        <p className="text-[10px] text-foreground/85 leading-snug">
                          {sentimentFallbackOpinion[sentimentView]!.opinion}
                        </p>
                        <p className="text-[9px] text-muted-foreground">
                          {t("dashboard.fallbackClaude")}
                        </p>
                      </div>
                    ) : (
                      t("dashboard.noCoverageYet")
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

        </div>
      </ScrollArea>
    </div>
  );
};

export default CountryOutlookPanel;
