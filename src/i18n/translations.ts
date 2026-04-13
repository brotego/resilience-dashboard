export type Lang = "en" | "jp";

const t = {
  // Header
  "app.title": { en: "Flourishing Through Resilience", jp: "レジリエンスを通じた繁栄" },
  "app.subtitle": { en: "Anchorstar × Mori Building", jp: "アンカースター × 森ビル" },
  "header.activeSignals": { en: "active signals", jp: "件のアクティブシグナル" },
  "header.live": { en: "LIVE", jp: "ライブ" },

  // Mode toggle
  "mode.resilience": { en: "Global Resilience", jp: "グローバルレジリエンス" },
  "mode.genz": { en: "Gen Z Signal", jp: "Z世代シグナル" },

  // Company selector
  "company.all": { en: "All companies", jp: "全企業" },
  "company.search": { en: "Search company...", jp: "企業を検索..." },
  "company.empty": { en: "No company found.", jp: "企業が見つかりません。" },

  // Domains
  "domain.work": { en: "Work", jp: "仕事" },
  "domain.selfhood": { en: "Selfhood", jp: "自己" },
  "domain.community": { en: "Community", jp: "コミュニティ" },
  "domain.aging": { en: "Aging", jp: "高齢化" },
  "domain.environment": { en: "Environment", jp: "環境" },

  // Gen Z categories
  "genz.authenticity": { en: "Brand Authenticity", jp: "ブランド真正性" },
  "genz.worklife": { en: "Work-Life Integration", jp: "ワークライフ統合" },
  "genz.climate": { en: "Climate Action", jp: "気候変動対策" },
  "genz.digital": { en: "Digital Identity", jp: "デジタルアイデンティティ" },
  "genz.belonging": { en: "Community & Belonging", jp: "コミュニティ＆帰属意識" },

  // AI Insight Panel
  "panel.resilienceBrief": { en: "RESILIENCE INTELLIGENCE BRIEF", jp: "レジリエンスインテリジェンスブリーフ" },
  "panel.genzBrief": { en: "GEN Z SIGNAL BRIEF", jp: "Z世代シグナルブリーフ" },
  "panel.intelligencePanel": { en: "Intelligence Panel", jp: "インテリジェンスパネル" },
  "panel.clickSignal": { en: "Click a signal on the map", jp: "マップ上のシグナルをクリック" },
  "panel.clickSignalDesc": { en: "Select a dot to view its AI intelligence brief", jp: "ドットを選択してAIインテリジェンスブリーフを表示" },
  "panel.tailoredFor": { en: "tailored for", jp: "向けにカスタマイズ" },
  "panel.resilienceExposure": { en: "Resilience Exposure", jp: "レジリエンスエクスポージャー" },
  "panel.domainFit": { en: "Domain fit", jp: "ドメイン適合度" },
  "panel.keywordMatch": { en: "Keyword match", jp: "キーワード一致度" },
  "panel.recency": { en: "Recency", jp: "新しさ" },
  "panel.sourceQuality": { en: "Source quality", jp: "情報源の信頼性" },
  "panel.generating": { en: "Generating intelligence brief...", jp: "インテリジェンスブリーフを生成中..." },
  "panel.whatToDo": { en: "What To Do", jp: "推奨アクション" },
  "panel.risks": { en: "Risks", jp: "リスク" },
  "panel.opportunities": { en: "Opportunities", jp: "機会" },
  "panel.whyMatters": { en: "Why This Matters", jp: "なぜ重要か" },
  "panel.deeperContext": { en: "Deeper Context", jp: "詳細なコンテキスト" },
  "panel.genzSignal": { en: "Gen Z Signal", jp: "Z世代シグナル" },
  "panel.originalSignal": { en: "Original Signal", jp: "元のシグナル" },
  "panel.urgency": { en: "urgency", jp: "緊急度" },

  // Urgency levels
  "urgency.critical": { en: "critical", jp: "危機的" },
  "urgency.high": { en: "high", jp: "高" },
  "urgency.medium": { en: "medium", jp: "中" },
  "urgency.low": { en: "low", jp: "低" },

  // Country Outlook Panel
  "country.backToGlobal": { en: "Back to Global", jp: "グローバルに戻る" },
  "country.resilienceExposure": { en: "Resilience Exposure", jp: "レジリエンスエクスポージャー" },
  "country.whatThisMeans": { en: "What This Means for", jp: "これが意味すること：" },
  "country.strategicContext": { en: "Strategic Context", jp: "戦略的コンテキスト" },
  "country.recentSignals": { en: "Recent Signals", jp: "最近のシグナル" },
  "country.noSignals": { en: "No signals tracked in", jp: "シグナルが追跡されていない国：" },
  "country.yet": { en: "yet.", jp: "" },
  "country.japanPerception": { en: "Japan Perception", jp: "対日認知" },
  "country.recommendedActions": { en: "Recommended Actions", jp: "推奨アクション" },
  "country.selectCompany": { en: "Select a company to see tailored strategic insights for this market.", jp: "この市場向けのカスタマイズされた戦略的インサイトを表示するには、企業を選択してください。" },

  // News Feed
  "news.businessFeed": { en: "Business News Feed", jp: "ビジネスニュースフィード" },
  "news.genzFeed": { en: "Gen Z Signal Feed", jp: "Z世代シグナルフィード" },
  "news.seedData": { en: "(seed data)", jp: "(サンプルデータ)" },
  "news.noArticles": { en: "No articles found.", jp: "記事が見つかりません。" },
  "news.businessSources": { en: "Sources: Reuters, Bloomberg, NYT, BBC, Nikkei", jp: "情報源：ロイター、ブルームバーグ、NYT、BBC、日経" },
  "news.genzSources": { en: "Sources: Social trend coverage, Gen Z media, viral signals", jp: "情報源：ソーシャルトレンド、Z世代メディア、バイラルシグナル" },

  // Map tooltip
  "map.score": { en: "Score", jp: "スコア" },

  // Clock format
  "clock.locale": { en: "en-US", jp: "ja-JP" },
} as const;

export type TranslationKey = keyof typeof t;

export function tr(key: TranslationKey, lang: Lang): string {
  return t[key]?.[lang] || t[key]?.en || key;
}

export default t;
