export type Lang = "en" | "jp";

const t = {
  // Header
  "app.title": { en: "Weak Signal Radar", jp: "ウィークシグナルレーダー" },
  "app.subtitle": { en: "Anchorstar × Mori Building", jp: "アンカースター × 森ビル" },
  "header.activeSignals": { en: "active signals", jp: "件のアクティブシグナル" },
  "header.live": { en: "LIVE", jp: "ライブ" },
  "tab.dashboard": { en: "Dashboard", jp: "ダッシュボード" },
  "tab.map": { en: "Global Map", jp: "グローバルマップ" },

  // Mode toggle
  "mode.resilience": { en: "Global Resilience", jp: "グローバルレジリエンス" },
  "mode.genz": { en: "Gen Z Signal", jp: "Z世代シグナル" },

  // Company selector
  "company.all": { en: "All companies", jp: "全企業" },
  "company.search": { en: "Search company...", jp: "企業を検索..." },
  "company.empty": { en: "No company found.", jp: "企業が見つかりません。" },

  // Company display names / sectors (UI only; API queries still use English `companies.ts`)
  "companyProfile.kodansha.name": { en: "Kodansha", jp: "講談社" },
  "companyProfile.kodansha.sector": { en: "Publishing & Media", jp: "出版・メディア" },
  "companyProfile.persol.name": { en: "PERSOL", jp: "パーソル" },
  "companyProfile.persol.sector": { en: "HR & Staffing", jp: "人材・派遣" },
  "companyProfile.ntt_east.name": { en: "NTT East", jp: "NTT東日本" },
  "companyProfile.ntt_east.sector": { en: "Telecommunications", jp: "電気通信" },
  "companyProfile.kikkoman.name": { en: "Kikkoman", jp: "キッコーマン" },
  "companyProfile.kikkoman.sector": { en: "Food & Beverage", jp: "食品" },
  "companyProfile.kirin.name": { en: "Kirin", jp: "キリン" },
  "companyProfile.kirin.sector": { en: "Beverages & Health", jp: "飲料・ヘルスケア" },
  "companyProfile.nintendo.name": { en: "Nintendo", jp: "任天堂" },
  "companyProfile.nintendo.sector": { en: "Interactive Entertainment", jp: "ゲーム・エンタメ" },
  "companyProfile.mori_building.name": { en: "Mori Building", jp: "森ビル" },
  "companyProfile.mori_building.sector": {
    en: "Real Estate & Urban Development",
    jp: "不動産・都市開発",
  },

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
  "panel.resilienceExposure": { en: "Company Fit", jp: "企業適合度" },
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

  // Sentiment tone labels (article perception)
  "sentiment.positive": { en: "Positive", jp: "ポジティブ" },
  "sentiment.mixed": { en: "Mixed", jp: "ミックス" },
  "sentiment.negative": { en: "Negative", jp: "ネガティブ" },

  // Urgency levels
  "urgency.critical": { en: "critical", jp: "危機的" },
  "urgency.high": { en: "high", jp: "高" },
  "urgency.medium": { en: "medium", jp: "中" },
  "urgency.low": { en: "low", jp: "低" },

  // Country Outlook Panel
  "country.backToGlobal": { en: "Back to Global", jp: "グローバルに戻る" },
  "country.resilienceExposure": { en: "Company Fit", jp: "企業適合度" },
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
  "news.translatingTitles": { en: "Translating headlines…", jp: "見出しを翻訳中…" },
  "news.businessSources": { en: "Sources: Reuters, Bloomberg, NYT, BBC, Nikkei", jp: "情報源：ロイター、ブルームバーグ、NYT、BBC、日経" },
  "news.genzSources": { en: "Sources: Social trend coverage, Gen Z media, viral signals", jp: "情報源：ソーシャルトレンド、Z世代メディア、バイラルシグナル" },

  // Map tooltip
  "map.score": { en: "Score", jp: "スコア" },
  "map.reScore": { en: "RE:", jp: "レジリエンス:" },
  "map.zoomIn": { en: "Zoom in", jp: "ズームイン" },
  "map.zoomOut": { en: "Zoom out", jp: "ズームアウト" },
  "map.view2d": { en: "2D map", jp: "2Dマップ" },
  "map.view3d": { en: "3D globe", jp: "3D地球儀" },

  // Header extras (tabs already have keys; these match dashboard strings)
  "header.signalsUnit": { en: "signals", jp: "件" },
  "header.searchingArticles": { en: "Searching articles...", jp: "記事を検索中..." },

  // AI insight panel
  "panel.autoCycling": { en: "auto-cycling", jp: "自動巡回中" },
  "panel.insightFailed": { en: "Failed to generate insight", jp: "インサイトの生成に失敗しました" },
  "panel.articleSummary": { en: "Article summary", jp: "記事要約" },
  "panel.moreInfo": { en: "More info", jp: "詳細を見る" },
  "panel.prevStackedSignal": { en: "Previous overlapping signal", jp: "重なる前のシグナル" },
  "panel.nextStackedSignal": { en: "Next overlapping signal", jp: "重なる次のシグナル" },
  "panel.marginalSignal": { en: "Marginal signal", jp: "限定的シグナル" },
  "panel.companyFitSlider": { en: "Company fit", jp: "企業適合" },
  "panel.signalFallback": { en: "Signal", jp: "シグナル" },

  // Dashboard / country / company panels (shared chrome)
  "dashboard.analyzingSignals": { en: "Analyzing signals...", jp: "分析中..." },
  "dashboard.sentimentAnalysis": { en: "Sentiment analysis", jp: "センチメント分析" },
  "dashboard.colCompany": { en: "Company", jp: "企業" },
  "dashboard.colJapan": { en: "Japan", jp: "日本" },
  "dashboard.loadingCoverage": { en: "Loading relevant coverage...", jp: "関連報道を読み込み中..." },
  "dashboard.generatingSentimentOverview": {
    en: "Generating AI overview of this coverage…",
    jp: "この報道セットのAI概要を生成中…",
  },
  "dashboard.sentimentAiOverviewLabel": { en: "AI coverage overview", jp: "AIによる報道概要" },
  "dashboard.openArticlePage": { en: "Open in-app article view", jp: "アプリ内の記事ビューを開く" },
  "dashboard.fallbackClaude": {
    en: "Showing Claude fallback opinion because no matching articles were found.",
    jp: "関連記事が不足しているため、Claudeの推定意見を表示しています。",
  },
  "dashboard.noCoverageYet": {
    en: "No relevant coverage found for this filter yet.",
    jp: "この条件の関連報道はまだありません。",
  },
  "dashboard.sentimentCompanyHint": {
    en: "Select a company to view company sentiment.",
    jp: "企業を選択すると企業センチメントを表示します。",
  },
  "dashboard.companyFitHeader": { en: "Company fit", jp: "企業適合度" },
  "dashboard.activeSignals": { en: "Active signals", jp: "アクティブシグナル" },
  "dashboard.noSignalsPeriod": { en: "No signals in this time period", jp: "この期間のシグナルはありません" },
  "dashboard.newsletterSummary": { en: "Newsletter summary", jp: "ニュースレター要約" },
  "dashboard.aiCurated": { en: "AI curated", jp: "AI選定" },
  "dashboard.risingRisks": { en: "Rising risks", jp: "高まるリスク" },
  "dashboard.risingOpportunities": { en: "Rising opportunities", jp: "高まる機会" },
  "dashboard.companyBrief": { en: "Company brief", jp: "企業ブリーフ" },
  "dashboard.businessModel": { en: "Business model", jp: "ビジネスモデル" },
  "dashboard.strategicPriorities": { en: "Strategic priorities", jp: "戦略的優先事項" },
  "dashboard.keyMarkets": { en: "Key markets", jp: "主要市場" },
  "dashboard.noSummary": { en: "No summary available", jp: "要約なし" },
  "dashboard.signalFeed": { en: "Signal feed", jp: "シグナルフィード" },
  "dashboard.time24h": { en: "24h", jp: "24時間" },
  "dashboard.time7d": { en: "7d", jp: "7日" },
  "dashboard.time30d": { en: "30d", jp: "30日" },

  // Signal detail page
  "signal.notFound": { en: "Signal not found", jp: "シグナルが見つかりません" },
  "signal.notFoundHintApp": {
    en: "Open this page from the in-app More info button.",
    jp: "このページはアプリ内の「詳細を見る」から開いてください。",
  },
  "signal.notFoundHint": {
    en: "This link may be invalid or the signal is no longer available.",
    jp: "リンクが無効か、シグナルが利用できなくなっている可能性があります。",
  },
  "signal.backDashboard": { en: "Back to dashboard", jp: "ダッシュボードに戻る" },
  "signal.detailBreadcrumb": { en: "Detail", jp: "詳細" },
  "signal.articleDetails": { en: "Article details", jp: "記事詳細" },
  "signal.loadingFullArticle": { en: "Loading full article text…", jp: "全文を読み込み中…" },
  "signal.openOriginal": { en: "Open original article", jp: "元記事を開く" },
  "signal.fetchingArticle": { en: "Fetching full article text...", jp: "記事本文を取得中..." },
  "signal.snippetOnly": {
    en: "Full article text could not be loaded in-app. Open the original article to read the complete story.",
    jp: "アプリ内で全文を読み込めませんでした。続きは元記事でご覧ください。",
  },
  "signal.articleUnavailableBody": {
    en: "The full article is not available in-app right now. Open the source site for complete coverage.",
    jp: "全文記事は現在利用できません。外部サイトで確認してください。",
  },
  "signal.goExternal": { en: "Go to external site", jp: "外部サイトへ移動" },

  // Article meta (signal detail)
  "article.meta.curation": { en: "Curation lens (company)", jp: "選定の視点（企業）" },
  "article.meta.published": { en: "Published", jp: "掲載日時" },
  "article.meta.author": { en: "Author", jp: "著者" },
  "article.meta.source": { en: "Source", jp: "ソース" },
  "article.meta.region": { en: "Region", jp: "地域" },
  "article.meta.title": { en: "Article info", jp: "記事情報" },
  "article.meta.curationHint": {
    en: "Articles come from shared news feeds; relevance is scored with this company’s keywords and focus domains.",
    jp: "記事の取得は共通フィードです。関連度は企業キーワード・ドメインでスコア化しています。",
  },

  // News feed errors
  "news.feedUnavailable": {
    en: "Country-specific feed is temporarily unavailable. Use the tracked signals shown above.",
    jp: "この国向けの追加フィードは現在利用できません。上部の追跡シグナルをご確認ください。",
  },

  // 404
  "notFound.title": { en: "Page not found", jp: "ページが見つかりません" },
  "notFound.lead": { en: "The page you are looking for does not exist.", jp: "お探しのページは存在しません。" },
  "notFound.home": { en: "Return to home", jp: "ホームに戻る" },

  // Mindset selector (if used)
  "mindset.lensTitle": { en: "Mindset lens", jp: "マインドセットの視点" },
  "mindset.cracks": { en: "Cracks", jp: "亀裂" },
  "mindset.reinvention": { en: "Reinvention", jp: "再創造" },
  "mindset.redefining": { en: "Redefine", jp: "再定義" },
  "mindset.collective": { en: "Collective", jp: "集合" },

  // Focus side panels (titles / CEO block — body copy may stay English in seed data)
  "focus.ceoInsight": { en: "CEO insight", jp: "CEOインサイト" },
  "focus.japanJapan": { en: "Japan × Gen Z", jp: "日本 × Z世代" },
  "focus.companyGenZ": { en: "× Gen Z", jp: " × Z世代" },
  "focus.japanFocus": { en: "Japan focus", jp: "日本フォーカス" },
  "focus.companyJapan": { en: "× Japan", jp: " × 日本" },

  // Urgency (full word for map tooltips — badge uses urgency.*)
  "urgency.labelHigh": { en: "High", jp: "高" },
  "urgency.labelMedium": { en: "Medium", jp: "中" },
  "urgency.labelLow": { en: "Low", jp: "低" },

  // Clock format
  "clock.locale": { en: "en-US", jp: "ja-JP" },
} as const;

export type TranslationKey = keyof typeof t;

export function tr(key: TranslationKey, lang: Lang): string {
  return t[key]?.[lang] || t[key]?.en || key;
}

export default t;
