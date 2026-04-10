/** World capitals + major cities with coordinates [lng, lat] */
export interface CityMarker {
  name: string;
  country: string;
  coordinates: [number, number];
  isCapital: boolean;
  tier: 1 | 2 | 3 | 4; // 1 = zoom 3+, 2 = zoom 4+, 3 = zoom 5+, 4 = zoom 6.5+
}

export const WORLD_CITIES: CityMarker[] = [
  // ── JAPAN ──
  { name: "Tokyo", country: "Japan", coordinates: [139.69, 35.69], isCapital: true, tier: 1 },
  { name: "Osaka", country: "Japan", coordinates: [135.50, 34.69], isCapital: false, tier: 3 },
  { name: "Fukuoka", country: "Japan", coordinates: [130.42, 33.59], isCapital: false, tier: 4 },
  { name: "Nagoya", country: "Japan", coordinates: [136.91, 35.18], isCapital: false, tier: 4 },
  { name: "Sapporo", country: "Japan", coordinates: [141.35, 43.06], isCapital: false, tier: 4 },
  { name: "Kyoto", country: "Japan", coordinates: [135.77, 35.01], isCapital: false, tier: 4 },

  // ── UNITED STATES ──
  { name: "Washington D.C.", country: "United States of America", coordinates: [-77.04, 38.91], isCapital: true, tier: 1 },
  { name: "New York", country: "United States of America", coordinates: [-74.0, 40.71], isCapital: false, tier: 2 },
  { name: "Los Angeles", country: "United States of America", coordinates: [-118.24, 34.05], isCapital: false, tier: 2 },
  { name: "Chicago", country: "United States of America", coordinates: [-87.63, 41.88], isCapital: false, tier: 3 },
  { name: "San Francisco", country: "United States of America", coordinates: [-122.42, 37.77], isCapital: false, tier: 3 },
  { name: "Houston", country: "United States of America", coordinates: [-95.37, 29.76], isCapital: false, tier: 4 },

  // ── CHINA ──
  { name: "Beijing", country: "China", coordinates: [116.41, 39.90], isCapital: true, tier: 1 },
  { name: "Shanghai", country: "China", coordinates: [121.47, 31.23], isCapital: false, tier: 2 },
  { name: "Shenzhen", country: "China", coordinates: [114.07, 22.54], isCapital: false, tier: 3 },
  { name: "Guangzhou", country: "China", coordinates: [113.26, 23.13], isCapital: false, tier: 4 },

  // ── UNITED KINGDOM ──
  { name: "London", country: "United Kingdom", coordinates: [-0.12, 51.51], isCapital: true, tier: 1 },
  { name: "Manchester", country: "United Kingdom", coordinates: [-2.24, 53.48], isCapital: false, tier: 3 },
  { name: "Edinburgh", country: "United Kingdom", coordinates: [-3.19, 55.95], isCapital: false, tier: 4 },

  // ── FRANCE ──
  { name: "Paris", country: "France", coordinates: [2.35, 48.86], isCapital: true, tier: 1 },
  { name: "Lyon", country: "France", coordinates: [4.83, 45.76], isCapital: false, tier: 4 },
  { name: "Marseille", country: "France", coordinates: [5.37, 43.30], isCapital: false, tier: 4 },

  // ── GERMANY ──
  { name: "Berlin", country: "Germany", coordinates: [13.41, 52.52], isCapital: true, tier: 1 },
  { name: "Munich", country: "Germany", coordinates: [11.58, 48.14], isCapital: false, tier: 3 },
  { name: "Frankfurt", country: "Germany", coordinates: [8.68, 50.11], isCapital: false, tier: 4 },

  // ── RUSSIA ──
  { name: "Moscow", country: "Russia", coordinates: [37.62, 55.76], isCapital: true, tier: 1 },
  { name: "St. Petersburg", country: "Russia", coordinates: [30.32, 59.93], isCapital: false, tier: 3 },

  // ── INDIA ──
  { name: "New Delhi", country: "India", coordinates: [77.21, 28.61], isCapital: true, tier: 1 },
  { name: "Mumbai", country: "India", coordinates: [72.88, 19.08], isCapital: false, tier: 2 },
  { name: "Bangalore", country: "India", coordinates: [77.59, 12.97], isCapital: false, tier: 3 },

  // ── BRAZIL ──
  { name: "Brasília", country: "Brazil", coordinates: [-47.93, -15.78], isCapital: true, tier: 1 },
  { name: "São Paulo", country: "Brazil", coordinates: [-46.63, -23.55], isCapital: false, tier: 2 },
  { name: "Rio de Janeiro", country: "Brazil", coordinates: [-43.17, -22.91], isCapital: false, tier: 3 },

  // ── AUSTRALIA ──
  { name: "Canberra", country: "Australia", coordinates: [149.13, -35.28], isCapital: true, tier: 1 },
  { name: "Sydney", country: "Australia", coordinates: [151.21, -33.87], isCapital: false, tier: 2 },
  { name: "Melbourne", country: "Australia", coordinates: [144.96, -37.81], isCapital: false, tier: 3 },

  // ── CANADA ──
  { name: "Ottawa", country: "Canada", coordinates: [-75.70, 45.42], isCapital: true, tier: 1 },
  { name: "Toronto", country: "Canada", coordinates: [-79.38, 43.65], isCapital: false, tier: 2 },
  { name: "Vancouver", country: "Canada", coordinates: [-123.12, 49.28], isCapital: false, tier: 3 },

  // ── SOUTH KOREA ──
  { name: "Seoul", country: "South Korea", coordinates: [126.98, 37.57], isCapital: true, tier: 1 },
  { name: "Busan", country: "South Korea", coordinates: [129.04, 35.18], isCapital: false, tier: 4 },

  // ── MEXICO ──
  { name: "Mexico City", country: "Mexico", coordinates: [-99.13, 19.43], isCapital: true, tier: 2 },
  { name: "Guadalajara", country: "Mexico", coordinates: [-103.35, 20.67], isCapital: false, tier: 4 },

  // ── INDONESIA ──
  { name: "Jakarta", country: "Indonesia", coordinates: [106.85, -6.21], isCapital: true, tier: 2 },
  { name: "Bali", country: "Indonesia", coordinates: [115.19, -8.41], isCapital: false, tier: 4 },

  // ── EGYPT ──
  { name: "Cairo", country: "Egypt", coordinates: [31.24, 30.04], isCapital: true, tier: 2 },
  { name: "Alexandria", country: "Egypt", coordinates: [29.92, 31.20], isCapital: false, tier: 4 },

  // ── ARGENTINA ──
  { name: "Buenos Aires", country: "Argentina", coordinates: [-58.38, -34.60], isCapital: true, tier: 2 },

  // ── TURKEY ──
  { name: "Ankara", country: "Turkey", coordinates: [32.87, 39.93], isCapital: true, tier: 2 },
  { name: "Istanbul", country: "Turkey", coordinates: [28.98, 41.01], isCapital: false, tier: 2 },

  // ── THAILAND ──
  { name: "Bangkok", country: "Thailand", coordinates: [100.50, 13.76], isCapital: true, tier: 2 },

  // ── SAUDI ARABIA ──
  { name: "Riyadh", country: "Saudi Arabia", coordinates: [46.72, 24.69], isCapital: true, tier: 2 },
  { name: "Jeddah", country: "Saudi Arabia", coordinates: [39.17, 21.54], isCapital: false, tier: 4 },

  // ── IRAN ──
  { name: "Tehran", country: "Iran", coordinates: [51.39, 35.69], isCapital: true, tier: 2 },

  // ── ITALY ──
  { name: "Rome", country: "Italy", coordinates: [12.50, 41.90], isCapital: true, tier: 2 },
  { name: "Milan", country: "Italy", coordinates: [9.19, 45.46], isCapital: false, tier: 3 },

  // ── SPAIN ──
  { name: "Madrid", country: "Spain", coordinates: [-3.70, 40.42], isCapital: true, tier: 2 },
  { name: "Barcelona", country: "Spain", coordinates: [2.17, 41.39], isCapital: false, tier: 3 },

  // ── SOUTH AFRICA ──
  { name: "Pretoria", country: "South Africa", coordinates: [28.19, -25.75], isCapital: true, tier: 2 },
  { name: "Johannesburg", country: "South Africa", coordinates: [28.05, -26.20], isCapital: false, tier: 3 },
  { name: "Cape Town", country: "South Africa", coordinates: [18.42, -33.93], isCapital: false, tier: 4 },

  // ── NIGERIA ──
  { name: "Abuja", country: "Nigeria", coordinates: [7.49, 9.06], isCapital: true, tier: 2 },
  { name: "Lagos", country: "Nigeria", coordinates: [3.39, 6.45], isCapital: false, tier: 2 },

  // ── KENYA ──
  { name: "Nairobi", country: "Kenya", coordinates: [36.82, -1.29], isCapital: true, tier: 2 },

  // ── POLAND ──
  { name: "Warsaw", country: "Poland", coordinates: [21.01, 52.23], isCapital: true, tier: 2 },

  // ── UKRAINE ──
  { name: "Kyiv", country: "Ukraine", coordinates: [30.52, 50.45], isCapital: true, tier: 2 },

  // ── COLOMBIA ──
  { name: "Bogotá", country: "Colombia", coordinates: [-74.07, 4.71], isCapital: true, tier: 2 },

  // ── PERU ──
  { name: "Lima", country: "Peru", coordinates: [-77.04, -12.05], isCapital: true, tier: 2 },

  // ── VIETNAM ──
  { name: "Hanoi", country: "Vietnam", coordinates: [105.85, 21.03], isCapital: true, tier: 2 },
  { name: "Ho Chi Minh City", country: "Vietnam", coordinates: [106.63, 10.82], isCapital: false, tier: 3 },

  // ── SWEDEN ──
  { name: "Stockholm", country: "Sweden", coordinates: [18.07, 59.33], isCapital: true, tier: 2 },

  // ── SMALLER CAPITALS + CITIES ──
  { name: "Singapore", country: "Singapore", coordinates: [103.85, 1.35], isCapital: true, tier: 3 },
  { name: "Amsterdam", country: "Netherlands", coordinates: [4.90, 52.37], isCapital: true, tier: 3 },
  { name: "Brussels", country: "Belgium", coordinates: [4.35, 50.85], isCapital: true, tier: 3 },
  { name: "Copenhagen", country: "Denmark", coordinates: [12.57, 55.68], isCapital: true, tier: 3 },
  { name: "Oslo", country: "Norway", coordinates: [10.75, 59.91], isCapital: true, tier: 3 },
  { name: "Helsinki", country: "Finland", coordinates: [24.94, 60.17], isCapital: true, tier: 3 },
  { name: "Lisbon", country: "Portugal", coordinates: [-9.14, 38.74], isCapital: true, tier: 3 },
  { name: "Vienna", country: "Austria", coordinates: [16.37, 48.21], isCapital: true, tier: 3 },
  { name: "Bucharest", country: "Romania", coordinates: [26.10, 44.43], isCapital: true, tier: 3 },
  { name: "Manila", country: "Philippines", coordinates: [120.98, 14.60], isCapital: true, tier: 3 },
  { name: "Santiago", country: "Chile", coordinates: [-70.67, -33.45], isCapital: true, tier: 3 },
  { name: "Accra", country: "Ghana", coordinates: [-0.19, 5.56], isCapital: true, tier: 3 },
  { name: "Addis Ababa", country: "Ethiopia", coordinates: [38.75, 9.02], isCapital: true, tier: 3 },
  { name: "Kuala Lumpur", country: "Malaysia", coordinates: [101.69, 3.14], isCapital: true, tier: 3 },
  { name: "Abu Dhabi", country: "United Arab Emirates", coordinates: [54.37, 24.45], isCapital: true, tier: 3 },
  { name: "Dubai", country: "United Arab Emirates", coordinates: [55.27, 25.20], isCapital: false, tier: 3 },
  { name: "Islamabad", country: "Pakistan", coordinates: [73.05, 33.69], isCapital: true, tier: 3 },
  { name: "Karachi", country: "Pakistan", coordinates: [67.01, 24.86], isCapital: false, tier: 3 },
  { name: "Dhaka", country: "Bangladesh", coordinates: [90.41, 23.81], isCapital: true, tier: 3 },
  { name: "Kathmandu", country: "Nepal", coordinates: [85.32, 27.72], isCapital: true, tier: 3 },
  { name: "Phnom Penh", country: "Cambodia", coordinates: [104.92, 11.56], isCapital: true, tier: 3 },
];
