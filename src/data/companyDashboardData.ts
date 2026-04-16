import { CompanyId } from "./companies";

export interface CompanyDashboardData {
  risks: { en: string; jp: string }[];
  opportunities: { en: string; jp: string }[];
  archetypes: { name: { en: string; jp: string }; score: number }[];
  brief: {
    businessModel: { en: string; jp: string };
    priorities: { en: string; jp: string }[];
    keyMarkets: { en: string; jp: string };
  };
  sentiment?: {
    global: {
      summary: { en: string; jp: string };
      items: {
        title: { en: string; jp: string };
        source: { en: string; jp: string };
        time: { en: string; jp: string };
        impact: { en: string; jp: string };
        sentiment: "positive" | "mixed" | "negative";
      }[];
    };
    japan: {
      summary: { en: string; jp: string };
      items: {
        title: { en: string; jp: string };
        source: { en: string; jp: string };
        time: { en: string; jp: string };
        impact: { en: string; jp: string };
        sentiment: "positive" | "mixed" | "negative";
      }[];
    };
  };
}

export const COMPANY_DASHBOARD_DATA: Record<CompanyId, CompanyDashboardData> = {
  kodansha: {
    risks: [
      { en: "AI-native platforms could attract emerging creators before Kodansha can sign them", jp: "AIネイティブプラットフォームがKodanshaより先に新進クリエイターを獲得する可能性" },
      { en: "Webtoon vertical-scroll format capturing Gen Z readers away from traditional manga pagination", jp: "Webtoonの縦スクロール形式がZ世代読者を従来のマンガページネーションから奪取" },
      { en: "Aging editorial workforce may not connect with Gen Z creator expectations", jp: "高齢化する編集部がZ世代クリエイターの期待に応えられない可能性" },
      { en: "Content pipeline too slow to capture fast-moving cultural narrative cycles", jp: "コンテンツパイプラインが急速な文化的ナラティブサイクルに対応できない" },
      { en: "Global licensing revenue at risk as local publishers build direct creator relationships", jp: "現地出版社がクリエイターと直接関係を構築し、グローバルライセンス収入が脅かされる" },
    ],
    opportunities: [
      { en: "Launch AI-assisted creator incubator to identify and develop Gen Z IP before competitors", jp: "AIを活用したクリエイターインキュベーターを立ち上げ、競合より先にZ世代IPを発掘・育成" },
      { en: "Kodansha's manga IP library is an untapped creator economy asset — licensing to Gen Z creators could transform revenue", jp: "KodanshaのマンガIPライブラリはクリエイターエコノミーの未開拓資産 — Z世代クリエイターへのライセンスが収益を変革" },
      { en: "Commission content exploring intergenerational knowledge transfer in Japanese manufacturing", jp: "日本の製造業における世代間知識移転を探るコンテンツを企画" },
      { en: "Partner with business media for co-branded visual content reaching both executive and Gen Z audiences", jp: "ビジネスメディアと提携し、エグゼクティブとZ世代の両方に届くコブランドビジュアルコンテンツを制作" },
    ],
    archetypes: [
      { name: { en: "Optimizer", jp: "オプティマイザー" }, score: 3 },
      { name: { en: "Explorer", jp: "エクスプローラー" }, score: 5 },
      { name: { en: "Builder", jp: "ビルダー" }, score: 4 },
      { name: { en: "Grounded Minimalist", jp: "堅実ミニマリスト" }, score: 2 },
    ],
    brief: {
      businessModel: { en: "Japan's largest publisher — manga, digital media, IP licensing across 100+ titles", jp: "日本最大の出版社 — マンガ、デジタルメディア、100以上のタイトルのIPライセンス" },
      priorities: [
        { en: "Expand digital-first manga distribution globally", jp: "デジタルファーストのマンガ配信をグローバルに拡大" },
        { en: "Build creator economy platform around existing IP", jp: "既存IPを活用したクリエイターエコノミープラットフォームの構築" },
        { en: "Develop AI-enhanced editorial tools for faster content cycles", jp: "AI強化された編集ツールでコンテンツサイクルを高速化" },
      ],
      keyMarkets: { en: "Japan, North America, Southeast Asia, Europe", jp: "日本、北米、東南アジア、ヨーロッパ" },
    },
    sentiment: {
      global: {
        summary: {
          en: "International coverage reflects cautious optimism around Kodansha's licensing expansion, with concerns over AI-generated content and IP protection.",
          jp: "海外報道では、Kodanshaのライセンス拡大に慎重な楽観論がある一方、AI生成コンテンツとIP保護への懸念も示されています。",
        },
        items: [
          {
            title: { en: "Kodansha's Anime Adaptations Continue Global Box Office Momentum", jp: "講談社作品のアニメ実写化が世界興行で勢いを維持" },
            source: { en: "Variety", jp: "Variety" },
            time: { en: "6h ago", jp: "6時間前" },
            impact: { en: "Global IP momentum remains strong.", jp: "グローバルIPの勢いは引き続き強い。" },
            sentiment: "positive",
          },
          {
            title: { en: "Manga Publishers Face New AI Copyright Challenges", jp: "マンガ出版社がAI著作権問題に直面" },
            source: { en: "The Verge", jp: "The Verge" },
            time: { en: "9h ago", jp: "9時間前" },
            impact: { en: "Defensive legal posture needed.", jp: "防御的な法務対応が必要。" },
            sentiment: "mixed",
          },
          {
            title: { en: "Digital Subscription Growth Offsets Print Decline", jp: "デジタル購読の成長が紙媒体減少を一部補完" },
            source: { en: "Nikkei Asia", jp: "Nikkei Asia" },
            time: { en: "1d ago", jp: "1日前" },
            impact: { en: "Monetization mix is improving.", jp: "収益構成の改善が進んでいる。" },
            sentiment: "positive",
          },
        ],
      },
      japan: {
        summary: {
          en: "Domestic sentiment is mixed: strong franchise traction is offset by pressure on print economics and creator retention.",
          jp: "国内センチメントは強弱混在で、主要IPの好調さの一方、紙媒体収益とクリエイター確保に圧力があります。",
        },
        items: [
          {
            title: { en: "Weekly Manga Sales Stay Resilient Despite Print Contraction", jp: "紙市場縮小下でも週刊マンガ販売は底堅い" },
            source: { en: "Oricon", jp: "オリコン" },
            time: { en: "4h ago", jp: "4時間前" },
            impact: { en: "Core domestic fanbase remains durable.", jp: "国内コアファン基盤は堅調。" },
            sentiment: "positive",
          },
          {
            title: { en: "Young Creators Shift Toward Independent Platforms", jp: "若手クリエイターの独立系プラットフォーム志向が拡大" },
            source: { en: "ITmedia", jp: "ITmedia" },
            time: { en: "11h ago", jp: "11時間前" },
            impact: { en: "Creator pipeline risk is rising.", jp: "クリエイターパイプラインのリスクが上昇。" },
            sentiment: "negative",
          },
          {
            title: { en: "Licensing Partnerships with Streamers Expand Reach", jp: "配信プラットフォームとのライセンス提携が拡大" },
            source: { en: "Toyo Keizai", jp: "東洋経済" },
            time: { en: "1d ago", jp: "1日前" },
            impact: { en: "Cross-media discovery is improving.", jp: "クロスメディアでの発見性が向上。" },
            sentiment: "mixed",
          },
        ],
      },
    },
  },
  persol: {
    risks: [
      { en: "AI automation threatening core staffing business as companies reduce temporary headcount", jp: "AI自動化がコア人材派遣事業を脅かし、企業が派遣人員を削減" },
      { en: "Gen Z workforce expects purpose-driven roles — traditional placement models feel transactional", jp: "Z世代はパーパス重視の仕事を期待 — 従来の人材紹介モデルは取引的に映る" },
      { en: "Global HR platforms (LinkedIn, Indeed) commoditizing local staffing advantage", jp: "グローバルHRプラットフォーム（LinkedIn、Indeed）がローカル人材紹介の優位性をコモディティ化" },
      { en: "Japan's labor shortage masking structural inefficiencies in talent matching", jp: "日本の労働力不足が人材マッチングの構造的非効率を覆い隠している" },
    ],
    opportunities: [
      { en: "Build Japan's first AI-powered reskilling marketplace connecting displaced workers to emerging roles", jp: "日本初のAI搭載リスキリングマーケットプレイスを構築し、失業者を新たな職種に接続" },
      { en: "Export Japan's workforce transformation methodology to aging Asian economies", jp: "日本の労働力変革方法論を高齢化するアジア経済に輸出" },
      { en: "Create 'purpose matching' platform that pairs Gen Z values with company missions", jp: "Z世代の価値観と企業ミッションをマッチングする「パーパスマッチング」プラットフォームを構築" },
      { en: "Partner with regional governments for rural telework talent distribution programs", jp: "地方自治体と連携し、地方テレワーク人材配置プログラムを展開" },
    ],
    archetypes: [
      { name: { en: "Optimizer", jp: "オプティマイザー" }, score: 5 },
      { name: { en: "Explorer", jp: "エクスプローラー" }, score: 3 },
      { name: { en: "Builder", jp: "ビルダー" }, score: 4 },
      { name: { en: "Grounded Minimalist", jp: "堅実ミニマリスト" }, score: 3 },
    ],
    brief: {
      businessModel: { en: "Leading HR and staffing group — workforce transformation, talent platforms, staffing services", jp: "リーディングHR・人材グループ — 労働力変革、タレントプラットフォーム、人材派遣サービス" },
      priorities: [
        { en: "Transition from staffing to workforce intelligence platform", jp: "人材派遣からワークフォースインテリジェンスプラットフォームへの転換" },
        { en: "Scale AI-driven talent matching across APAC", jp: "APAC全域でAI駆動のタレントマッチングを拡大" },
        { en: "Develop reskilling programs for mid-career professionals", jp: "ミッドキャリアプロフェッショナル向けリスキリングプログラムの開発" },
      ],
      keyMarkets: { en: "Japan, Australia, Singapore, Vietnam", jp: "日本、オーストラリア、シンガポール、ベトナム" },
    },
  },
  ntt_east: {
    risks: [
      { en: "5G infrastructure investment returns uncertain as rural adoption lags projections", jp: "農村部の導入が予測を下回り、5Gインフラ投資のリターンが不確実" },
      { en: "Digital divide deepening between urban and rural communities threatens brand promise", jp: "都市部と農村部のデジタルデバイド拡大がブランドの約束を脅かす" },
      { en: "Younger demographics view NTT as legacy infrastructure — not innovation", jp: "若年層がNTTをイノベーションではなくレガシーインフラと認識" },
      { en: "Municipal budget constraints limiting smart city deployment pace", jp: "自治体の予算制約がスマートシティ展開ペースを制限" },
    ],
    opportunities: [
      { en: "Deploy AI-powered elderly monitoring systems across Japan's 1,700+ municipalities", jp: "日本の1,700以上の自治体にAI搭載の高齢者見守りシステムを展開" },
      { en: "Position as the digital backbone for Japan's rural revitalization strategy", jp: "日本の地方創生戦略のデジタル基盤として位置づけ" },
      { en: "Build community connectivity platforms that blend physical and digital social spaces", jp: "物理的・デジタル的な社会空間を融合するコミュニティ接続プラットフォームの構築" },
      { en: "Export smart city solutions to Southeast Asian infrastructure markets", jp: "スマートシティソリューションを東南アジアのインフラ市場に輸出" },
    ],
    archetypes: [
      { name: { en: "Optimizer", jp: "オプティマイザー" }, score: 4 },
      { name: { en: "Explorer", jp: "エクスプローラー" }, score: 2 },
      { name: { en: "Builder", jp: "ビルダー" }, score: 5 },
      { name: { en: "Grounded Minimalist", jp: "堅実ミニマリスト" }, score: 4 },
    ],
    brief: {
      businessModel: { en: "Regional telecom giant — digital infrastructure, smart cities, rural connectivity, IoT services", jp: "地域通信大手 — デジタルインフラ、スマートシティ、農村接続、IoTサービス" },
      priorities: [
        { en: "Accelerate smart city deployments in tier-2 Japanese cities", jp: "日本の地方都市でのスマートシティ展開を加速" },
        { en: "Scale elderly care IoT solutions nationally", jp: "高齢者ケアIoTソリューションを全国展開" },
        { en: "Build next-gen community platforms for rural revitalization", jp: "地方創生のための次世代コミュニティプラットフォームの構築" },
      ],
      keyMarkets: { en: "Eastern Japan, Rural prefectures, Municipal governments", jp: "東日本、農村部、自治体" },
    },
  },
  kikkoman: {
    risks: [
      { en: "Plant-based and lab-grown condiment alternatives emerging with lower carbon footprints", jp: "植物由来・培養調味料の代替品が低炭素フットプリントで出現" },
      { en: "Gen Z consumers questioning heritage brands that can't prove sustainability claims", jp: "Z世代消費者がサステナビリティの主張を証明できないヘリテージブランドに疑問" },
      { en: "Supply chain disruptions in soybean sourcing from climate volatility", jp: "気候変動による大豆調達のサプライチェーン混乱" },
      { en: "Heritage positioning risks becoming irrelevant to speed-focused food tech startups", jp: "ヘリテージポジショニングがスピード重視のフードテックスタートアップに対して陳腐化するリスク" },
    ],
    opportunities: [
      { en: "Launch transparent supply chain tracker visible to consumers — '300 years of trust, verified daily'", jp: "消費者に見えるサプライチェーントラッカーを開始 — 「300年の信頼を毎日検証」" },
      { en: "Develop fermentation-science platform licensing Kikkoman's microbiome expertise to wellness brands", jp: "キッコーマンの微生物叢の専門知識をウェルネスブランドにライセンスする発酵科学プラットフォームの開発" },
      { en: "Create community-supported agriculture partnerships in key soybean regions", jp: "主要な大豆産地でコミュニティ支援型農業パートナーシップを構築" },
      { en: "Position 'heritage + science' narrative to capture premiumization trend in Asian condiments", jp: "「ヘリテージ＋科学」のナラティブでアジア調味料のプレミアム化トレンドを獲得" },
    ],
    archetypes: [
      { name: { en: "Optimizer", jp: "オプティマイザー" }, score: 2 },
      { name: { en: "Explorer", jp: "エクスプローラー" }, score: 3 },
      { name: { en: "Builder", jp: "ビルダー" }, score: 3 },
      { name: { en: "Grounded Minimalist", jp: "堅実ミニマリスト" }, score: 5 },
    ],
    brief: {
      businessModel: { en: "Global soy sauce & food company — 300+ year heritage, fermentation science, condiment production", jp: "グローバル醤油・食品企業 — 300年以上の伝統、発酵科学、調味料生産" },
      priorities: [
        { en: "Achieve carbon-neutral production by 2030", jp: "2030年までにカーボンニュートラル生産を達成" },
        { en: "Expand premium product lines in North America and Europe", jp: "北米・ヨーロッパでプレミアム製品ラインを拡大" },
        { en: "Develop fermentation-based wellness products", jp: "発酵ベースのウェルネス製品の開発" },
      ],
      keyMarkets: { en: "Japan, North America, Europe, China", jp: "日本、北米、ヨーロッパ、中国" },
    },
  },
  kirin: {
    risks: [
      { en: "Alcohol consumption declining globally among health-conscious Gen Z consumers", jp: "健康志向のZ世代消費者の間でアルコール消費量がグローバルに減少" },
      { en: "Health sciences diversification stretching brand identity too thin", jp: "ヘルスサイエンスの多角化がブランドアイデンティティを薄めすぎる" },
      { en: "Regulatory uncertainty around functional food health claims in key markets", jp: "主要市場での機能性食品の健康効能表示に関する規制の不確実性" },
      { en: "Climate impact on barley and hops supply chains threatening core beer business", jp: "大麦とホップのサプライチェーンへの気候影響がコアビール事業を脅かす" },
    ],
    opportunities: [
      { en: "Build 'longevity beverages' category combining immunology research with consumer products", jp: "免疫学研究と消費者製品を組み合わせた「長寿飲料」カテゴリーの構築" },
      { en: "Acquire or partner with functional mushroom and adaptogen startups", jp: "機能性キノコ・アダプトゲンスタートアップの買収またはパートナーシップ" },
      { en: "Position Kirin as Japan's wellness export brand for aging populations worldwide", jp: "キリンを世界中の高齢化社会向け日本のウェルネス輸出ブランドとして位置づけ" },
      { en: "Develop non-alcoholic premium line targeting sober-curious Gen Z market", jp: "ソバーキュリアスなZ世代市場をターゲットにしたノンアルコールプレミアムラインの開発" },
    ],
    archetypes: [
      { name: { en: "Optimizer", jp: "オプティマイザー" }, score: 4 },
      { name: { en: "Explorer", jp: "エクスプローラー" }, score: 4 },
      { name: { en: "Builder", jp: "ビルダー" }, score: 3 },
      { name: { en: "Grounded Minimalist", jp: "堅実ミニマリスト" }, score: 4 },
    ],
    brief: {
      businessModel: { en: "Beverage conglomerate expanding into health sciences — beer, functional foods, immunology research", jp: "ヘルスサイエンスに拡大する飲料コングロマリット — ビール、機能性食品、免疫学研究" },
      priorities: [
        { en: "Scale health sciences division to 30% of revenue", jp: "ヘルスサイエンス部門を売上の30%まで拡大" },
        { en: "Develop functional beverages for aging demographics", jp: "高齢者向け機能性飲料の開発" },
        { en: "Reduce environmental footprint across brewing operations", jp: "醸造オペレーション全体の環境フットプリントを削減" },
      ],
      keyMarkets: { en: "Japan, Australia, Southeast Asia, United States", jp: "日本、オーストラリア、東南アジア、アメリカ" },
    },
  },
  nintendo: {
    risks: [
      { en: "Mobile gaming and free-to-play models eroding premium console game pricing power", jp: "モバイルゲームと基本無料モデルがプレミアムコンソールゲームの価格決定力を侵食" },
      { en: "Metaverse platforms (Roblox, Fortnite) capturing Gen Z social gaming time", jp: "メタバースプラットフォーム（Roblox、Fortnite）がZ世代のソーシャルゲーム時間を獲得" },
      { en: "Hardware innovation cycle pressure — Switch 2 must match unprecedented predecessor success", jp: "ハードウェアイノベーションサイクルのプレッシャー — Switch 2は前例のない前機種の成功に匹敵する必要" },
      { en: "IP licensing expansion risks diluting brand's premium perception", jp: "IPライセンス拡大がブランドのプレミアム認知を希薄化するリスク" },
    ],
    opportunities: [
      { en: "Develop cognitive health gaming products for Japan's aging population", jp: "日本の高齢化人口向けの認知健康ゲーム製品の開発" },
      { en: "Nintendo IP theme park expansion creates physical community touchpoints globally", jp: "任天堂IPテーマパーク拡大がグローバルに物理的コミュニティ接点を創出" },
      { en: "Launch creator tools that let Gen Z build and share within Nintendo IP universes", jp: "Z世代が任天堂IP世界で構築・共有できるクリエイターツールの立ち上げ" },
      { en: "Partner with elderly care facilities for gamified cognitive stimulation programs", jp: "高齢者介護施設と連携し、ゲーミフィケーションによる認知刺激プログラムを展開" },
      { en: "Explore family wellness gaming — position Switch as intergenerational bonding tool", jp: "ファミリーウェルネスゲーミングの探求 — Switchを世代間絆ツールとして位置づけ" },
    ],
    archetypes: [
      { name: { en: "Optimizer", jp: "オプティマイザー" }, score: 3 },
      { name: { en: "Explorer", jp: "エクスプローラー" }, score: 5 },
      { name: { en: "Builder", jp: "ビルダー" }, score: 5 },
      { name: { en: "Grounded Minimalist", jp: "堅実ミニマリスト" }, score: 2 },
    ],
    brief: {
      businessModel: { en: "Global gaming powerhouse — console hardware, first-party game development, IP licensing, theme parks", jp: "グローバルゲーム大手 — コンソールハードウェア、ファーストパーティゲーム開発、IPライセンス、テーマパーク" },
      priorities: [
        { en: "Successfully launch next-generation console platform", jp: "次世代コンソールプラットフォームの成功的な立ち上げ" },
        { en: "Expand IP monetization through theme parks and films", jp: "テーマパークと映画を通じたIPマネタイゼーションの拡大" },
        { en: "Develop cognitive health applications of gaming technology", jp: "ゲーム技術の認知健康アプリケーションの開発" },
      ],
      keyMarkets: { en: "Japan, North America, Europe, China", jp: "日本、北米、ヨーロッパ、中国" },
    },
  },
  mori_building: {
    risks: [
      { en: "Remote work reducing premium office demand in Tokyo's central business districts", jp: "リモートワークが東京のCBDにおけるプレミアムオフィス需要を減少" },
      { en: "Rising construction costs and material shortages delaying development timelines", jp: "建設コスト上昇と資材不足が開発スケジュールを遅延" },
      { en: "Earthquake and climate risks increasing insurance and structural costs for high-rises", jp: "地震と気候リスクが高層ビルの保険・構造コストを増大" },
      { en: "Competitor developments in Shibuya and Shinagawa fragmenting Tokyo's premium district appeal", jp: "渋谷・品川の競合開発が東京のプレミアム地区の魅力を分散" },
    ],
    opportunities: [
      { en: "Position vertical garden city concept as global standard for climate-resilient urban development", jp: "垂直庭園都市コンセプトを気候レジリエントな都市開発のグローバルスタンダードとして位置づけ" },
      { en: "Develop intergenerational living communities combining elderly care with family housing", jp: "高齢者ケアとファミリー住宅を組み合わせた世代間共生コミュニティの開発" },
      { en: "Export Azabudai Hills mixed-use model to select Asian megacities", jp: "麻布台ヒルズの複合用途モデルを選定アジアのメガシティに輸出" },
      { en: "Create 'cultural infrastructure' positioning — art, education, wellness integrated into every development", jp: "「文化インフラ」ポジショニングの構築 — アート、教育、ウェルネスをすべての開発に統合" },
      { en: "Build community resilience index for Mori Building properties — measurable social impact", jp: "森ビル物件のコミュニティレジリエンス指数の構築 — 測定可能な社会的インパクト" },
    ],
    archetypes: [
      { name: { en: "Optimizer", jp: "オプティマイザー" }, score: 4 },
      { name: { en: "Explorer", jp: "エクスプローラー" }, score: 3 },
      { name: { en: "Builder", jp: "ビルダー" }, score: 5 },
      { name: { en: "Grounded Minimalist", jp: "堅実ミニマリスト" }, score: 3 },
    ],
    brief: {
      businessModel: { en: "Tokyo-based urban developer — Roppongi Hills, Toranomon Hills, Azabudai Hills. Vertical garden city philosophy.", jp: "東京拠点の都市開発企業 — 六本木ヒルズ、虎ノ門ヒルズ、麻布台ヒルズ。垂直庭園都市哲学。" },
      priorities: [
        { en: "Complete and monetize Azabudai Hills development", jp: "麻布台ヒルズ開発の完成と収益化" },
        { en: "Integrate community resilience metrics into all properties", jp: "すべての物件にコミュニティレジリエンス指標を統合" },
        { en: "Expand international consulting on vertical urban development", jp: "垂直型都市開発の国際コンサルティングを拡大" },
        { en: "Develop elderly-friendly smart building infrastructure", jp: "高齢者対応スマートビルインフラの開発" },
      ],
      keyMarkets: { en: "Tokyo (Minato-ku,港区), Select Asian megacities", jp: "東京（港区）、選定アジアメガシティ" },
    },
  },
};
