import { useState, useEffect, useRef } from "react";
import { invokeNewsFeed } from "@/api/newsFeed";
import { isNewsApiAiConfigured } from "@/lib/newsApiConfigured";
import { readSessionCache, writeSessionCache } from "@/lib/newsSessionCache";

export interface NewsArticle {
  title: string;
  source: string;
  date: string;
  description: string;
  content?: string;
  url: string;
}

interface CacheEntry {
  articles: NewsArticle[];
  timestamp: number;
}

const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours (aligned with live map bundle refresh)
const cache = new Map<string, CacheEntry>();

// Country name to ISO 2-letter locale code (UI / legacy mapping).
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

// Seed data fallback
const randomDate = (daysAgo: number) => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(Math.floor(Math.random() * 14) + 6, Math.floor(Math.random() * 60));
  return d.toISOString();
};

const BUSINESS_SEED: Record<string, NewsArticle[]> = {
  "Japan": [
    { title: "Bank of Japan holds rates steady amid yen volatility", source: "Nikkei Asia", date: randomDate(1), description: "BOJ maintained ultra-low interest rates as the yen continues its slide against the dollar.", url: "#" },
    { title: "Toyota accelerates solid-state battery production timeline", source: "Reuters", date: randomDate(3), description: "Toyota moved up its solid-state battery mass production target to 2027.", url: "#" },
    { title: "Japan's semiconductor revival draws $20B in foreign investment", source: "Bloomberg", date: randomDate(5), description: "TSMC and Samsung expand Japan fab investments as chip subsidy program accelerates.", url: "#" },
    { title: "Nikkei 225 hits all-time high on export optimism", source: "Financial Times", date: randomDate(7), description: "Japanese equities surged as weak yen boosts corporate earnings forecasts.", url: "#" },
    { title: "Japan workforce shortage reaches critical levels in construction", source: "Japan Times", date: randomDate(9), description: "Construction industry faces 30% labor deficit ahead of infrastructure modernization projects.", url: "#" },
  ],
  "United States of America": [
    { title: "Fed signals potential rate cut in September meeting", source: "Wall Street Journal", date: randomDate(1), description: "Federal Reserve officials indicated openness to easing monetary policy if inflation data continues to cool.", url: "#" },
    { title: "US tech giants invest $150B in AI infrastructure", source: "CNBC", date: randomDate(2), description: "Microsoft, Google, and Amazon collectively commit to massive AI data center expansion.", url: "#" },
    { title: "US manufacturing reshoring creates 200K new jobs", source: "Bloomberg", date: randomDate(4), description: "CHIPS Act and IRA incentives drive unprecedented domestic manufacturing growth.", url: "#" },
    { title: "Consumer spending resilience surprises economists", source: "Reuters", date: randomDate(6), description: "US retail sales exceeded expectations despite persistent inflation concerns.", url: "#" },
    { title: "Commercial real estate crisis deepens in major metros", source: "Financial Times", date: randomDate(10), description: "Office vacancy rates hit record 22% nationally as remote work patterns solidify.", url: "#" },
  ],
  "China": [
    { title: "China's EV exports surge 45% despite EU tariff threats", source: "South China Morning Post", date: randomDate(1), description: "BYD and NIO lead aggressive global expansion even as trade barriers mount.", url: "#" },
    { title: "PBoC cuts reserve requirement ratio to boost lending", source: "Reuters", date: randomDate(3), description: "People's Bank of China eases monetary policy to support flagging property sector.", url: "#" },
    { title: "China's youth unemployment hits 21% in urban areas", source: "Bloomberg", date: randomDate(5), description: "Record joblessness among 16-24 year olds raises social stability concerns.", url: "#" },
    { title: "Shenzhen tech corridor attracts record venture capital", source: "Nikkei Asia", date: randomDate(8), description: "AI and biotech startups in Greater Bay Area raised $18B in Q1.", url: "#" },
    { title: "China property market shows signs of stabilization", source: "Financial Times", date: randomDate(11), description: "New home sales in tier-1 cities increased for the first time in 18 months.", url: "#" },
  ],
  "South Korea": [
    { title: "Samsung unveils 2nm chip process ahead of TSMC", source: "Korea Herald", date: randomDate(2), description: "Samsung Foundry claims process leadership with gate-all-around transistor technology.", url: "#" },
    { title: "K-content exports exceed $13B as Hallyu wave accelerates", source: "Yonhap", date: randomDate(4), description: "Korean dramas, music, and webtoons drive record cultural export revenue.", url: "#" },
    { title: "South Korea's birth rate drops to 0.68, world's lowest", source: "Reuters", date: randomDate(6), description: "Government announces emergency demographic measures including housing subsidies for young families.", url: "#" },
    { title: "Hyundai-Kia captures 10% of global EV market", source: "Bloomberg", date: randomDate(8), description: "Korean automakers gain ground on Tesla and BYD with competitive pricing strategy.", url: "#" },
    { title: "Seoul launches $5B AI sovereignty fund", source: "Nikkei Asia", date: randomDate(12), description: "South Korea targets top-3 global AI ranking by 2027 with massive state investment.", url: "#" },
  ],
  "India": [
    { title: "India GDP growth hits 7.8%, fastest among major economies", source: "Economic Times", date: randomDate(1), description: "Strong domestic consumption and services exports drive India's economic outperformance.", url: "#" },
    { title: "India's UPI processes 14 billion transactions in March", source: "Mint", date: randomDate(3), description: "Digital payments infrastructure continues exponential growth trajectory.", url: "#" },
    { title: "Tata Electronics breaks ground on $11B semiconductor fab", source: "Reuters", date: randomDate(5), description: "India's first advanced chip fabrication facility targets production by 2027.", url: "#" },
    { title: "India overtakes China as Apple's fastest-growing market", source: "Bloomberg", date: randomDate(7), description: "iPhone shipments to India doubled year-over-year as middle class expands.", url: "#" },
    { title: "Mumbai infrastructure push transforms commercial real estate", source: "Financial Times", date: randomDate(10), description: "Metro expansion and coastal road project drive 40% increase in premium office demand.", url: "#" },
  ],
  "Germany": [
    { title: "German industrial output falls for third consecutive quarter", source: "Handelsblatt", date: randomDate(2), description: "Manufacturing recession deepens as energy costs and China slowdown weigh on Mittelstand.", url: "#" },
    { title: "Volkswagen accelerates factory closures amid EV transition", source: "Reuters", date: randomDate(4), description: "VW plans to shut two German plants as it shifts resources to electric vehicle production.", url: "#" },
    { title: "Germany's renewable energy hits 55% of electricity mix", source: "Bloomberg", date: randomDate(6), description: "Wind and solar generation milestones reached ahead of 2030 targets.", url: "#" },
    { title: "Berlin startup ecosystem raises record €8B in 2024", source: "TechCrunch", date: randomDate(9), description: "German capital emerges as Europe's leading tech hub, rivaling London.", url: "#" },
    { title: "German labor market tightens as skilled worker gap widens", source: "DW", date: randomDate(11), description: "400,000 unfilled technical positions threaten industrial competitiveness.", url: "#" },
  ],
  "France": [
    { title: "France unveils €10B sovereign AI investment plan", source: "Le Monde", date: randomDate(1), description: "Macron announces major push to establish France as Europe's AI leader.", url: "#" },
    { title: "French luxury sector defies global slowdown", source: "Financial Times", date: randomDate(3), description: "LVMH and Hermès report strong Q1 results driven by aspirational consumers.", url: "#" },
    { title: "Paris Olympics infrastructure boosts long-term urban development", source: "Reuters", date: randomDate(6), description: "Post-Olympics redevelopment attracts €5B in private investment.", url: "#" },
    { title: "France's nuclear renaissance attracts global attention", source: "Bloomberg", date: randomDate(8), description: "EDF plans 6 new EPR reactors as Europe reassesses energy security.", url: "#" },
    { title: "French agritech startups lead EU sustainable farming push", source: "Euronews", date: randomDate(12), description: "Precision agriculture technology deployed across 30% of EU farmland.", url: "#" },
  ],
  "United Kingdom": [
    { title: "London retains position as global fintech capital", source: "Financial Times", date: randomDate(2), description: "UK fintech firms raised £12B in 2024 despite broader venture capital pullback.", url: "#" },
    { title: "UK housing crisis deepens as prices hit 12x average salary", source: "BBC", date: randomDate(4), description: "Government announces emergency planning reforms to accelerate home construction.", url: "#" },
    { title: "UK-India free trade deal enters final negotiation stage", source: "Reuters", date: randomDate(7), description: "Bilateral agreement expected to boost UK exports by £28B annually.", url: "#" },
    { title: "NHS workforce plan targets 300K new staff by 2030", source: "The Guardian", date: randomDate(9), description: "Largest healthcare recruitment drive in UK history launched.", url: "#" },
    { title: "UK green hydrogen projects attract sovereign wealth funds", source: "Bloomberg", date: randomDate(11), description: "Abu Dhabi and Saudi funds commit £8B to UK hydrogen infrastructure.", url: "#" },
  ],
  "Brazil": [
    { title: "Brazil's agribusiness exports hit $160B record", source: "Reuters", date: randomDate(1), description: "Soy, beef, and coffee exports drive historic trade surplus.", url: "#" },
    { title: "Nubank reaches 100M customers across Latin America", source: "TechCrunch", date: randomDate(3), description: "Brazilian neobank becomes largest digital bank in the world by customer count.", url: "#" },
    { title: "Amazon deforestation drops 40% under enforcement push", source: "The Guardian", date: randomDate(6), description: "Satellite monitoring and increased penalties drive significant reduction.", url: "#" },
    { title: "Brazil positions itself as green hydrogen superpower", source: "Bloomberg", date: randomDate(8), description: "Abundant wind and solar resources make Brazil ideal for green hydrogen production.", url: "#" },
    { title: "São Paulo startup ecosystem valued at $100B+", source: "Latin Finance", date: randomDate(12), description: "Fintech and healthtech lead Brazilian venture capital activity.", url: "#" },
  ],
  "Indonesia": [
    { title: "Indonesia's nickel processing dominance reshapes EV supply chain", source: "Nikkei Asia", date: randomDate(2), description: "Country controls 50% of global nickel refining capacity for EV batteries.", url: "#" },
    { title: "Jakarta-Bandung high-speed rail exceeds ridership targets", source: "Reuters", date: randomDate(4), description: "China-built HSR line carries 5M passengers in first 6 months of operation.", url: "#" },
    { title: "Indonesia's digital economy projected to hit $130B by 2025", source: "Google-Temasek", date: randomDate(7), description: "E-commerce and ride-hailing drive Southeast Asia's largest digital market.", url: "#" },
    { title: "New capital Nusantara construction accelerates", source: "Bloomberg", date: randomDate(9), description: "IKN development enters Phase 2 with $20B in committed investment.", url: "#" },
    { title: "Indonesia halal economy targets $300B market", source: "Jakarta Post", date: randomDate(13), description: "Government promotes halal certification as competitive advantage.", url: "#" },
  ],
  "Turkey": [
    { title: "Turkey's inflation eases to 45% after aggressive rate hikes", source: "Reuters", date: randomDate(1), description: "Central bank's orthodox monetary policy begins to show results.", url: "#" },
    { title: "Istanbul becomes Europe's busiest airport hub", source: "Bloomberg", date: randomDate(3), description: "IST airport surpasses Heathrow and CDG in passenger traffic.", url: "#" },
    { title: "Turkish defense exports double to $6B", source: "Anadolu Agency", date: randomDate(6), description: "Baykar drones and armored vehicles drive record defense industry revenue.", url: "#" },
    { title: "Turkey-EU customs union modernization talks resume", source: "Financial Times", date: randomDate(8), description: "Updated trade agreement could unlock €30B in additional bilateral commerce.", url: "#" },
    { title: "Istanbul Finance Center opens with 30 global tenants", source: "Daily Sabah", date: randomDate(11), description: "New financial district aims to position Turkey as regional banking hub.", url: "#" },
  ],
  "United Arab Emirates": [
    { title: "UAE non-oil GDP growth hits 6.2%", source: "Gulf News", date: randomDate(2), description: "Tourism, fintech, and logistics drive economic diversification success.", url: "#" },
    { title: "Abu Dhabi sovereign fund increases Asia tech allocation", source: "Bloomberg", date: randomDate(4), description: "Mubadala shifts $15B toward AI and semiconductor investments in Asia.", url: "#" },
    { title: "Dubai positions as global AI regulatory hub", source: "Reuters", date: randomDate(7), description: "UAE launches progressive AI governance framework attracting tech companies.", url: "#" },
    { title: "UAE green hydrogen export agreements signed with Germany, Japan", source: "Financial Times", date: randomDate(9), description: "Bilateral hydrogen corridors established with major industrial economies.", url: "#" },
    { title: "Dubai real estate market sees 30% price surge", source: "Arabian Business", date: randomDate(12), description: "Influx of wealthy expatriates and golden visa holders drive property demand.", url: "#" },
  ],
  "Nigeria": [
    { title: "Nigeria's fintech sector attracts $2B in investment", source: "TechCabal", date: randomDate(1), description: "Flutterwave, Moniepoint, and Paystack expansions drive Africa's largest tech ecosystem.", url: "#" },
    { title: "Lagos emerges as Africa's startup capital", source: "Rest of World", date: randomDate(3), description: "City hosts 40% of Africa's funded startups as tech talent pool deepens.", url: "#" },
    { title: "Nigeria's Dangote refinery reaches full capacity", source: "Reuters", date: randomDate(6), description: "Africa's largest oil refinery transforms Nigeria from fuel importer to exporter.", url: "#" },
    { title: "Nollywood streaming revenue surpasses $1B globally", source: "Bloomberg", date: randomDate(8), description: "Nigerian film industry finds massive audiences via Netflix and local platforms.", url: "#" },
    { title: "Nigeria population projected to reach 400M by 2050", source: "UN Population Fund", date: randomDate(11), description: "Demographic boom presents both workforce opportunity and infrastructure challenges.", url: "#" },
  ],
  "Australia": [
    { title: "Australia's critical minerals strategy targets $50B exports", source: "AFR", date: randomDate(2), description: "Lithium, cobalt, and rare earths position Australia as key EV supply chain player.", url: "#" },
    { title: "Sydney and Melbourne housing affordability crisis worsens", source: "Reuters", date: randomDate(4), description: "Median home prices reach 13x median household income in major cities.", url: "#" },
    { title: "Australia-Japan green energy partnership expands", source: "Nikkei Asia", date: randomDate(6), description: "Hydrogen and ammonia export agreements worth $10B signed between nations.", url: "#" },
    { title: "Australia's tech sector grows 8% despite global slowdown", source: "The Australian", date: randomDate(9), description: "Cybersecurity and fintech lead growth in Australia's digital economy.", url: "#" },
    { title: "Great Barrier Reef coral recovery surprises scientists", source: "BBC", date: randomDate(12), description: "Largest coral cover in 36 years recorded amid ongoing climate concerns.", url: "#" },
  ],
  "Thailand": [
    { title: "Thailand targets 30% EV production share by 2030", source: "Bangkok Post", date: randomDate(1), description: "Board of Investment incentives attract BYD, Great Wall, and MG factories.", url: "#" },
    { title: "Thai tourism recovery hits 35M visitors", source: "Reuters", date: randomDate(3), description: "Tourism revenues approach pre-pandemic levels driven by Chinese and Indian visitors.", url: "#" },
    { title: "Bangkok emerges as digital nomad hub of Southeast Asia", source: "Nikkei Asia", date: randomDate(6), description: "New long-term visa program attracts remote workers from 50+ countries.", url: "#" },
    { title: "Thailand's medical tourism industry reaches $5B", source: "Bloomberg", date: randomDate(9), description: "Premium hospitals draw patients from across Asia and Middle East.", url: "#" },
    { title: "Thai food exports hit record on global demand surge", source: "The Nation", date: randomDate(12), description: "Rice, seafood, and processed food exports benefit from food security concerns.", url: "#" },
  ],
  default: [
    { title: "Global markets rally on trade optimism", source: "Reuters", date: randomDate(2), description: "Stock markets worldwide gained ground as investors reacted positively to new trade agreements.", url: "#" },
    { title: "Central banks signal cautious approach to rate cuts", source: "Bloomberg", date: randomDate(5), description: "Major central banks indicated they will take a measured approach to easing monetary policy.", url: "#" },
    { title: "Tech sector leads innovation investment surge", source: "NYT", date: randomDate(7), description: "Technology companies increased R&D spending by 18% year-over-year.", url: "#" },
    { title: "Supply chain resilience becomes board-level priority", source: "BBC", date: randomDate(9), description: "Corporate boards are increasingly prioritizing supply chain diversification strategies.", url: "#" },
    { title: "Green bonds issuance hits record high in Q1", source: "Nikkei", date: randomDate(13), description: "Sustainable finance instruments reached unprecedented levels in the first quarter.", url: "#" },
  ],
};

const GENZ_SEED: Record<string, NewsArticle[]> = {
  "Japan": [
    { title: "Japanese Gen Z rejecting salaryman culture en masse", source: "Japan Times", date: randomDate(1), description: "72% of under-25s prefer freelance or startup careers over traditional corporate paths.", url: "#" },
    { title: "VTuber economy reaches ¥800B as virtual idols dominate", source: "Nikkei", date: randomDate(3), description: "Virtual YouTuber industry grows 3x as Gen Z audiences prefer avatar-based creators.", url: "#" },
    { title: "Shibuya's Gen Z create 'neo-kissaten' coffee boom", source: "Vice Japan", date: randomDate(6), description: "Young owners blend retro aesthetics with sustainability in café culture revival.", url: "#" },
    { title: "TikTok Japan drives 'quiet luxury' trend among youth", source: "WWD Japan", date: randomDate(8), description: "Understated fashion brands gain traction as Gen Z rejects fast fashion logos.", url: "#" },
    { title: "Japanese youth lead Asia's mental health destigmatization", source: "NHK World", date: randomDate(11), description: "Online communities created by young Japanese normalize therapy and self-care.", url: "#" },
  ],
  "United States of America": [
    { title: "Gen Z voter registration surges ahead of 2026 midterms", source: "Axios", date: randomDate(1), description: "Under-25 registration up 40% driven by climate and housing issues.", url: "#" },
    { title: "TikTok Shop reshapes US e-commerce as Gen Z abandons Amazon", source: "Business Insider", date: randomDate(3), description: "Social commerce captures 25% of Gen Z purchasing via algorithm-driven discovery.", url: "#" },
    { title: "US Gen Z entrepreneurship rate highest in a generation", source: "Forbes", date: randomDate(5), description: "18% of Gen Z Americans have started a business, double millennials at same age.", url: "#" },
    { title: "Gen Z mental health crisis drives $4B therapy app market", source: "TechCrunch", date: randomDate(8), description: "BetterHelp, Talkspace, and AI-powered platforms compete for young users.", url: "#" },
    { title: "'De-influencing' trend reshapes brand marketing strategies", source: "Ad Age", date: randomDate(11), description: "Gen Z creators gain followers by discouraging purchases, forcing authenticity.", url: "#" },
  ],
  "China": [
    { title: "'Lying flat' evolves into 'let it rot' among Chinese Gen Z", source: "SCMP", date: randomDate(2), description: "Youth disillusionment deepens as job market remains challenging for graduates.", url: "#" },
    { title: "Chinese Gen Z drives $50B domestic travel boom", source: "Sixth Tone", date: randomDate(4), description: "Young travelers favor budget 'special forces tourism' over luxury vacations.", url: "#" },
    { title: "Bilibili becomes China's YouTube as Gen Z content explodes", source: "TechNode", date: randomDate(6), description: "Platform hits 400M users with Gen Z driving knowledge-sharing content.", url: "#" },
    { title: "Chinese youth embrace 'guochao' nationalist fashion", source: "Jing Daily", date: randomDate(9), description: "Li-Ning and Anta overtake Nike among under-25 consumers.", url: "#" },
    { title: "Gen Z in China pioneers community group buying revolution", source: "KrASIA", date: randomDate(12), description: "Neighborhood collective purchasing reshapes last-mile retail economics.", url: "#" },
  ],
  "South Korea": [
    { title: "K-pop fan economy drives Gen Z financial literacy", source: "Korea Herald", date: randomDate(1), description: "Young fans learn investing through idol group stock portfolios.", url: "#" },
    { title: "Korean Gen Z sparks 'no-marriage' movement", source: "Chosun Ilbo", date: randomDate(4), description: "60% of young Koreans say they don't plan to marry, accelerating population decline.", url: "#" },
    { title: "Webtoon culture goes global as Korean creators dominate", source: "Rest of World", date: randomDate(6), description: "Vertical-scroll comics capture 100M+ readers worldwide.", url: "#" },
    { title: "Seoul's Seongsu-dong becomes Gen Z entrepreneurship mecca", source: "Vice", date: randomDate(9), description: "Converted warehouse district hosts 500+ youth-founded brands.", url: "#" },
    { title: "Korean beauty pivot: skinimalism replaces 10-step routines", source: "Allure", date: randomDate(12), description: "Young consumers drive demand for simplified, sustainable beauty products.", url: "#" },
  ],
  "India": [
    { title: "India's Gen Z creators earn $2B+ on YouTube and Instagram", source: "Economic Times", date: randomDate(1), description: "Vernacular content explosion in Hindi, Tamil, Telugu, and Bengali.", url: "#" },
    { title: "Indian Gen Z drives 'quick commerce' revolution", source: "Mint", date: randomDate(3), description: "Blinkit, Zepto capture young urban consumers with 10-minute delivery.", url: "#" },
    { title: "Campus startup culture explodes at IITs and IIMs", source: "YourStory", date: randomDate(6), description: "Student-founded ventures raise $500M+ as Gen Z embraces entrepreneurship.", url: "#" },
    { title: "Indian youth lead global growth in coding education", source: "TechCrunch", date: randomDate(8), description: "India produces 1.5M new programmers annually as Gen Z pursues tech.", url: "#" },
    { title: "Bollywood loses Gen Z to Korean dramas and anime", source: "Scroll.in", date: randomDate(11), description: "Under-25 Indians prefer K-content and anime over traditional Hindi cinema.", url: "#" },
  ],
  "Turkey": [
    { title: "Turkish Gen Z emigration intent hits 75%", source: "Bianet", date: randomDate(2), description: "Young Turks increasingly seek opportunities in Europe and Gulf states.", url: "#" },
    { title: "Istanbul's youth-led creative economy defies recession", source: "Vice", date: randomDate(4), description: "Gen Z entrepreneurs build thriving design and food businesses in Kadıköy.", url: "#" },
    { title: "Turkish anime fandom becomes one of world's largest", source: "Anime News Network", date: randomDate(7), description: "Turkey ranks top 5 globally for anime streaming among under-25s.", url: "#" },
    { title: "Gen Z Turks drive second-hand fashion marketplace boom", source: "Rest of World", date: randomDate(9), description: "Dolap sees 300% growth as inflation makes new clothes unaffordable.", url: "#" },
    { title: "Turkish youth climate activism grows despite pressure", source: "The Guardian", date: randomDate(12), description: "Young activists organize around Istanbul Canal and coal plant opposition.", url: "#" },
  ],
  "United Arab Emirates": [
    { title: "Dubai becomes Gen Z content creator capital of Middle East", source: "Arabian Business", date: randomDate(1), description: "Tax-free income and luxury backdrops attract global influencers.", url: "#" },
    { title: "Emirati Gen Z challenge traditional career expectations", source: "The National", date: randomDate(4), description: "Young nationals increasingly choose startups over government positions.", url: "#" },
    { title: "UAE gaming industry targets $1B as youth engagement soars", source: "Gulf News", date: randomDate(7), description: "Abu Dhabi and Dubai invest in esports infrastructure.", url: "#" },
    { title: "Gen Z expats reshape Dubai's food and nightlife scene", source: "Time Out Dubai", date: randomDate(9), description: "Young professionals from 150+ nationalities create hypercultural dining.", url: "#" },
    { title: "UAE youth sustainability initiative plants 50M mangroves", source: "WAM", date: randomDate(13), description: "Gen Z-led program becomes region's largest coastal restoration project.", url: "#" },
  ],
  "Nigeria": [
    { title: "Afrobeats Gen Z artists generate $1B+ in global streams", source: "Billboard", date: randomDate(1), description: "Rema, Ayra Starr capture global youth audiences.", url: "#" },
    { title: "Lagos Gen Z tech talent becomes Africa's most recruited", source: "TechCabal", date: randomDate(3), description: "Nigerian developers under 25 hired remotely by Silicon Valley firms.", url: "#" },
    { title: "Nigerian Gen Z 'japa' trend transforms diaspora economy", source: "Rest of World", date: randomDate(6), description: "Youth emigration creates $25B annual remittance flow.", url: "#" },
    { title: "TikTok Nigeria becomes platform's fastest-growing market", source: "Business Insider Africa", date: randomDate(9), description: "Nigerian creators drive pan-African trends reaching 200M+ viewers.", url: "#" },
    { title: "Gen Z Nigerians build alternative finance through crypto", source: "CoinDesk", date: randomDate(12), description: "Youth-driven crypto usage reaches 35% penetration, highest in Africa.", url: "#" },
  ],
  "Brazil": [
    { title: "Brazilian Gen Z creators dominate Portuguese-language internet", source: "Rest of World", date: randomDate(2), description: "Young Brazilians produce 80% of Portuguese content consumed globally.", url: "#" },
    { title: "Favela-born startups receive $500M in impact investment", source: "Forbes Brasil", date: randomDate(4), description: "Gen Z founders build inclusive tech solutions from Rio peripheries.", url: "#" },
    { title: "Brazil's Gen Z environmental activism focuses on Amazon", source: "The Guardian", date: randomDate(7), description: "Youth movements combine indigenous knowledge with digital organizing.", url: "#" },
    { title: "Pix transforms Gen Z financial behavior in Brazil", source: "Bloomberg Línea", date: randomDate(9), description: "Instant payments adoption among under-25 Brazilians reaches 95%.", url: "#" },
    { title: "Brazilian funk goes global via TikTok", source: "Pitchfork", date: randomDate(13), description: "Gen Z artists bring Brazilian sounds to global charts.", url: "#" },
  ],
  "Indonesia": [
    { title: "Indonesian Gen Z drives Southeast Asia's largest creator economy", source: "KrASIA", date: randomDate(1), description: "10M+ young Indonesians earn income through TikTok and Shopee Live.", url: "#" },
    { title: "Jakarta's Gen Z Muslim fashion brands go global", source: "Vogue Business", date: randomDate(4), description: "Modest fashion startups capture $100B global market.", url: "#" },
    { title: "Indonesian youth lead digital mutual aid movement", source: "Rest of World", date: randomDate(7), description: "Traditional communal values merge with crowdfunding among Gen Z.", url: "#" },
    { title: "Bahasa content creation explodes on YouTube Shorts", source: "The Drum", date: randomDate(9), description: "Indonesian Gen Z creators produce viral short-form content.", url: "#" },
    { title: "Gen Z Indonesians reject parent's consumption patterns", source: "Jakarta Globe", date: randomDate(12), description: "Sustainability and minimalism movements grow among urban youth.", url: "#" },
  ],
  "Germany": [
    { title: "German Gen Z workers demand 4-day week as non-negotiable", source: "Handelsblatt", date: randomDate(2), description: "68% of under-25 Germans reject jobs without flexible work arrangements.", url: "#" },
    { title: "Fridays for Future evolves into youth political party movement", source: "DW", date: randomDate(5), description: "Climate activists transition from protest to direct political participation.", url: "#" },
    { title: "Berlin Gen Z nightlife faces gentrification threat", source: "Resident Advisor", date: randomDate(7), description: "Rising rents force iconic youth venues to outer boroughs.", url: "#" },
    { title: "German Gen Z increasingly multilingual, driving EU mobility", source: "Euronews", date: randomDate(10), description: "Young Germans work across EU at 3x the rate of previous generations.", url: "#" },
    { title: "Sustainability tops brand selection for Gen Z in DACH", source: "McKinsey", date: randomDate(13), description: "Environmental impact outweighs price for 55% of young consumers.", url: "#" },
  ],
  "France": [
    { title: "French Gen Z lead European 'slow living' movement", source: "Le Monde", date: randomDate(1), description: "Young French reject hustle culture, prioritize quality of life.", url: "#" },
    { title: "Paris Gen Z streetwear scene rivals Tokyo and New York", source: "Highsnobiety", date: randomDate(4), description: "Youth-founded brands merge luxury heritage with street culture.", url: "#" },
    { title: "French youth climate lawsuit wins landmark damages", source: "The Guardian", date: randomDate(6), description: "Gen Z-backed legal action forces government to accelerate emissions cuts.", url: "#" },
    { title: "TikTok France cooking content drives bistronomy revival", source: "Bon Appétit", date: randomDate(9), description: "Young chefs make traditional cuisine accessible and viral.", url: "#" },
    { title: "Gen Z French workers unionize tech companies", source: "Mediapart", date: randomDate(13), description: "Young employees organize at Ubisoft and other French tech firms.", url: "#" },
  ],
  "United Kingdom": [
    { title: "UK Gen Z homeownership rate drops to historic 8%", source: "The Guardian", date: randomDate(2), description: "Under-25 Brits face average deposit requiring 15 years of saving.", url: "#" },
    { title: "British Gen Z reshape high street with charity shop culture", source: "BBC", date: randomDate(4), description: "Thrifting becomes mainstream as youth reject fast fashion for vintage.", url: "#" },
    { title: "UK uni applications drop as Gen Z opts for apprenticeships", source: "Financial Times", date: randomDate(7), description: "Alternative paths gain traction amid £50K+ student debt concerns.", url: "#" },
    { title: "London Gen Z food entrepreneurs drive ghost kitchen boom", source: "Evening Standard", date: randomDate(9), description: "Young founders launch delivery-only restaurants from shared kitchens.", url: "#" },
    { title: "British youth mental health spending reaches £2B annually", source: "The Lancet", date: randomDate(12), description: "NHS scales up services as Gen Z demand for support surges.", url: "#" },
  ],
  "Australia": [
    { title: "Australian Gen Z drive indigenous reconciliation forward", source: "ABC News", date: randomDate(2), description: "Young Australians lead engagement with First Nations culture and rights.", url: "#" },
    { title: "Melbourne Gen Z coffee culture goes global via social media", source: "Broadsheet", date: randomDate(5), description: "Young baristas influence global specialty coffee trends.", url: "#" },
    { title: "Gen Z Australians lead world in gap year participation", source: "SBS", date: randomDate(7), description: "70% of school leavers take structured gap experiences before university.", url: "#" },
    { title: "Australian youth climate anxiety reaches 85%", source: "The Conversation", date: randomDate(10), description: "Bushfire experiences drive highest recorded eco-anxiety rates.", url: "#" },
    { title: "Aussie Gen Z creators build $500M influencer economy", source: "Marketing Magazine", date: randomDate(13), description: "Australian creators punch above weight in global social media.", url: "#" },
  ],
  "Thailand": [
    { title: "Thai Gen Z pro-democracy movement reshapes politics", source: "Nikkei Asia", date: randomDate(1), description: "Youth-led parties gain unprecedented parliamentary seats.", url: "#" },
    { title: "Bangkok's Gen Z creative economy rivals Seoul", source: "Monocle", date: randomDate(4), description: "Young Thai designers, musicians, and filmmakers gain global recognition.", url: "#" },
    { title: "Thai Gen Z drive BL content into $1B global industry", source: "Rest of World", date: randomDate(7), description: "Youth-created queer content reaches massive global audiences.", url: "#" },
    { title: "Gen Z Thai street food vendors modernize with apps", source: "Bangkok Post", date: randomDate(9), description: "Young hawkers blend traditional recipes with digital ordering.", url: "#" },
    { title: "Thailand's Gen Z Buddhist mindfulness app reaches 10M users", source: "Vice Asia", date: randomDate(13), description: "Young developers blend meditation tradition with technology.", url: "#" },
  ],
  default: [
    { title: "Gen Z driving shift toward conscious consumption globally", source: "Vice", date: randomDate(2), description: "Young consumers factor sustainability into purchase decisions.", url: "#" },
    { title: "TikTok trend sparks global climate action movement", source: "The Guardian", date: randomDate(5), description: "Viral challenge raised awareness about carbon footprint reduction.", url: "#" },
    { title: "Youth-led brands disrupting traditional retail worldwide", source: "Business Insider", date: randomDate(7), description: "Gen Z entrepreneurs create D2C brands challenging incumbents.", url: "#" },
    { title: "Digital natives reshape workplace expectations globally", source: "Forbes", date: randomDate(10), description: "Gen Z workers prioritize flexibility, purpose, and mental health.", url: "#" },
    { title: "Viral sustainability challenges gain corporate backing", source: "Fast Company", date: randomDate(13), description: "Companies sponsor youth-driven environmental challenges.", url: "#" },
  ],
};

const FEED_TIMEOUT_MS = 12000;

export function useNewsFeed(countryName: string, type: "business" | "genz", topicQuery?: string) {
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  /** True only when showing built-in seed articles (no API key). */
  const [isFallback, setIsFallback] = useState(false);
  /** Set when API key is configured but the request failed or returned nothing. */
  const [fetchError, setFetchError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const configured = isNewsApiAiConfigured();
    const topicScope = (topicQuery || "").trim().toLowerCase();
    const cacheKey = `${configured ? "api" : "seed"}:${type}:${countryName}:${topicScope}`;
    const cached = cache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      setArticles(cached.articles);
      setLoading(false);
      setIsFallback(false);
      setFetchError(null);
      return;
    }

    const sessionEntry = readSessionCache<NewsArticle[]>(cacheKey);
    const fromSession =
      sessionEntry?.data && sessionEntry.data.length > 0 ? sessionEntry.data : null;
    if (fromSession) {
      cache.set(cacheKey, { articles: fromSession, timestamp: sessionEntry.savedAt });
      setArticles(fromSession);
      setIsFallback(false);
      setFetchError(null);
      setLoading(false);
    } else {
      setLoading(true);
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setFetchError(null);

    const countryCode = COUNTRY_CODES[countryName] || "us";

    const withTimeout = async <T,>(promise: Promise<T>, ms: number, fallback: T): Promise<T> => {
      let timeout: ReturnType<typeof setTimeout> | null = null;
      const timeoutPromise = new Promise<T>((resolve) => {
        timeout = setTimeout(() => resolve(fallback), ms);
      });
      const result = await Promise.race([promise, timeoutPromise]);
      if (timeout) clearTimeout(timeout);
      return result;
    };

    const keepCachedArticlesOnFailure = () => {
      const snap = cache.get(cacheKey);
      if (snap?.articles?.length) {
        setArticles(snap.articles);
        setFetchError(null);
        return true;
      }
      return false;
    };

    (async () => {
      try {
        const primary = await withTimeout(
          invokeNewsFeed({ type, countryCode, countryName, topicQuery }),
          FEED_TIMEOUT_MS,
          { data: { articles: [], fallback: true, error: "Request timeout" }, error: null },
        );
        if (controller.signal.aborted) return;

        const configured = isNewsApiAiConfigured();
        const primaryFailed = !!(primary.error || primary.data?.fallback || !primary.data);
        const primaryArticles = Array.isArray(primary.data?.articles) ? primary.data!.articles : [];
        const needsBroadBusinessFallback = type === "business" && (!!topicQuery) && (primaryFailed || primaryArticles.length === 0);

        if (needsBroadBusinessFallback) {
          const broad = await withTimeout(
            invokeNewsFeed({ type, countryCode, countryName }),
            FEED_TIMEOUT_MS,
            { data: { articles: [], fallback: true, error: "Request timeout" }, error: null },
          );
          if (controller.signal.aborted) return;
          const broadFailed = !!(broad.error || broad.data?.fallback || !broad.data);
          const broadArticles = Array.isArray(broad.data?.articles) ? broad.data!.articles : [];

          if (!broadFailed && broadArticles.length > 0) {
            setArticles(broadArticles);
            setIsFallback(false);
            setFetchError(null);
            const now = Date.now();
            cache.set(cacheKey, { articles: broadArticles, timestamp: now });
            writeSessionCache(cacheKey, broadArticles);
            setLoading(false);
            return;
          }
        }

        if (primaryFailed) {
          if (configured) {
            if (!keepCachedArticlesOnFailure()) {
              // Final safety net: keep business panel populated even when provider fails.
              if (type === "business") {
                const seed = BUSINESS_SEED[countryName] || BUSINESS_SEED.default || [];
                setArticles(seed);
                setIsFallback(true);
                setFetchError(null);
              } else {
                setArticles([]);
                setIsFallback(false);
                setFetchError(primary.data?.error || primary.error?.message || "News request failed");
              }
            }
          } else {
            const seed = type === "business" ? BUSINESS_SEED : GENZ_SEED;
            const fallbackArticles = seed[countryName] || seed.default || [];
            setArticles(fallbackArticles);
            setIsFallback(true);
            setFetchError(null);
          }
          setLoading(false);
          return;
        }

        setArticles(primaryArticles);
        setIsFallback(false);
        setFetchError(null);
        if (primaryArticles.length > 0) {
          const now = Date.now();
          cache.set(cacheKey, { articles: primaryArticles, timestamp: now });
          writeSessionCache(cacheKey, primaryArticles);
        }
        setLoading(false);
      } catch {
        if (controller.signal.aborted) return;
        if (isNewsApiAiConfigured()) {
          if (!keepCachedArticlesOnFailure()) {
            if (type === "business") {
              const seed = BUSINESS_SEED[countryName] || BUSINESS_SEED.default || [];
              setArticles(seed);
              setIsFallback(true);
              setFetchError(null);
            } else {
              setArticles([]);
              setIsFallback(false);
              setFetchError("Network error");
            }
          }
        } else {
          const seed = type === "business" ? BUSINESS_SEED : GENZ_SEED;
          setArticles(seed[countryName] || seed.default || []);
          setIsFallback(true);
          setFetchError(null);
        }
        setLoading(false);
      }
    })();

    return () => controller.abort();
  }, [countryName, type, topicQuery]);

  return { articles, loading, isFallback, fetchError };
}
