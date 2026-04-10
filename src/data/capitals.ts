/** Top 50 world capitals with coordinates [lng, lat] */
export interface Capital {
  name: string;
  country: string;
  coordinates: [number, number];
  tier: 1 | 2 | 3; // 1 = major (zoom 3+), 2 = medium (zoom 4+), 3 = smaller (zoom 5.5+)
}

export const WORLD_CAPITALS: Capital[] = [
  // Tier 1 — major capitals, show at zoom 3+
  { name: "Tokyo", country: "Japan", coordinates: [139.69, 35.69], tier: 1 },
  { name: "Washington D.C.", country: "United States of America", coordinates: [-77.04, 38.91], tier: 1 },
  { name: "Beijing", country: "China", coordinates: [116.41, 39.90], tier: 1 },
  { name: "London", country: "United Kingdom", coordinates: [-0.12, 51.51], tier: 1 },
  { name: "Paris", country: "France", coordinates: [2.35, 48.86], tier: 1 },
  { name: "Berlin", country: "Germany", coordinates: [13.41, 52.52], tier: 1 },
  { name: "Moscow", country: "Russia", coordinates: [37.62, 55.76], tier: 1 },
  { name: "New Delhi", country: "India", coordinates: [77.21, 28.61], tier: 1 },
  { name: "Brasília", country: "Brazil", coordinates: [-47.93, -15.78], tier: 1 },
  { name: "Canberra", country: "Australia", coordinates: [149.13, -35.28], tier: 1 },
  { name: "Ottawa", country: "Canada", coordinates: [-75.70, 45.42], tier: 1 },
  { name: "Seoul", country: "South Korea", coordinates: [126.98, 37.57], tier: 1 },

  // Tier 2 — medium capitals, show at zoom 4+
  { name: "Mexico City", country: "Mexico", coordinates: [-99.13, 19.43], tier: 2 },
  { name: "Jakarta", country: "Indonesia", coordinates: [106.85, -6.21], tier: 2 },
  { name: "Cairo", country: "Egypt", coordinates: [31.24, 30.04], tier: 2 },
  { name: "Buenos Aires", country: "Argentina", coordinates: [-58.38, -34.60], tier: 2 },
  { name: "Ankara", country: "Turkey", coordinates: [32.87, 39.93], tier: 2 },
  { name: "Bangkok", country: "Thailand", coordinates: [100.50, 13.76], tier: 2 },
  { name: "Riyadh", country: "Saudi Arabia", coordinates: [46.72, 24.69], tier: 2 },
  { name: "Tehran", country: "Iran", coordinates: [51.39, 35.69], tier: 2 },
  { name: "Rome", country: "Italy", coordinates: [12.50, 41.90], tier: 2 },
  { name: "Madrid", country: "Spain", coordinates: [-3.70, 40.42], tier: 2 },
  { name: "Pretoria", country: "South Africa", coordinates: [28.19, -25.75], tier: 2 },
  { name: "Abuja", country: "Nigeria", coordinates: [7.49, 9.06], tier: 2 },
  { name: "Nairobi", country: "Kenya", coordinates: [36.82, -1.29], tier: 2 },
  { name: "Warsaw", country: "Poland", coordinates: [21.01, 52.23], tier: 2 },
  { name: "Kyiv", country: "Ukraine", coordinates: [30.52, 50.45], tier: 2 },
  { name: "Bogotá", country: "Colombia", coordinates: [-74.07, 4.71], tier: 2 },
  { name: "Lima", country: "Peru", coordinates: [-77.04, -12.05], tier: 2 },
  { name: "Hanoi", country: "Vietnam", coordinates: [105.85, 21.03], tier: 2 },
  { name: "Stockholm", country: "Sweden", coordinates: [18.07, 59.33], tier: 2 },

  // Tier 3 — smaller capitals, show at zoom 5.5+
  { name: "Singapore", country: "Singapore", coordinates: [103.85, 1.35], tier: 3 },
  { name: "Amsterdam", country: "Netherlands", coordinates: [4.90, 52.37], tier: 3 },
  { name: "Brussels", country: "Belgium", coordinates: [4.35, 50.85], tier: 3 },
  { name: "Copenhagen", country: "Denmark", coordinates: [12.57, 55.68], tier: 3 },
  { name: "Oslo", country: "Norway", coordinates: [10.75, 59.91], tier: 3 },
  { name: "Helsinki", country: "Finland", coordinates: [24.94, 60.17], tier: 3 },
  { name: "Lisbon", country: "Portugal", coordinates: [-9.14, 38.74], tier: 3 },
  { name: "Vienna", country: "Austria", coordinates: [16.37, 48.21], tier: 3 },
  { name: "Bucharest", country: "Romania", coordinates: [26.10, 44.43], tier: 3 },
  { name: "Manila", country: "Philippines", coordinates: [120.98, 14.60], tier: 3 },
  { name: "Santiago", country: "Chile", coordinates: [-70.67, -33.45], tier: 3 },
  { name: "Accra", country: "Ghana", coordinates: [-0.19, 5.56], tier: 3 },
  { name: "Addis Ababa", country: "Ethiopia", coordinates: [38.75, 9.02], tier: 3 },
  { name: "Kuala Lumpur", country: "Malaysia", coordinates: [101.69, 3.14], tier: 3 },
  { name: "Abu Dhabi", country: "United Arab Emirates", coordinates: [54.37, 24.45], tier: 3 },
  { name: "Islamabad", country: "Pakistan", coordinates: [73.05, 33.69], tier: 3 },
  { name: "Dhaka", country: "Bangladesh", coordinates: [90.41, 23.81], tier: 3 },
  { name: "Kathmandu", country: "Nepal", coordinates: [85.32, 27.72], tier: 3 },
  { name: "Phnom Penh", country: "Cambodia", coordinates: [104.92, 11.56], tier: 3 },
];
