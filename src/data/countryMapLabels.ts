/** Shared country label placement + progressive disclosure (2D map + 3D globe). */

export const LABEL_OVERRIDES: Record<string, [number, number]> = {
  "United States of America": [-98, 39],
  Russia: [100, 60],
  Canada: [-106, 56],
  France: [2, 47],
  Norway: [9, 62],
  Indonesia: [118, -2],
  Malaysia: [109, 4],
  Chile: [-71, -33],
  "New Zealand": [174, -41],
};

export const DISPLAY_NAMES: Record<string, string> = {
  "United States of America": "United States",
  "United Kingdom": "UK",
  "United Arab Emirates": "UAE",
  "Dem. Rep. Congo": "DR Congo",
  "Dominican Rep.": "Dom. Rep.",
  "Central African Rep.": "C.A.R.",
  "Bosnia and Herz.": "Bosnia",
  "Czech Republic": "Czech Rep.",
  "Republic of the Congo": "Congo",
  "Democratic Republic of the Congo": "DR Congo",
};

export const COUNTRY_TIERS: Record<string, number> = {
  Russia: 1,
  China: 1,
  "United States of America": 1,
  Canada: 1,
  Brazil: 1,
  Australia: 1,
  India: 1,
  Japan: 1,
  Argentina: 2,
  Mexico: 2,
  Indonesia: 2,
  "Saudi Arabia": 2,
  Germany: 2,
  France: 2,
  "United Kingdom": 2,
  Turkey: 2,
  Iran: 2,
  Egypt: 2,
  "South Africa": 2,
  Nigeria: 2,
  Kazakhstan: 2,
  Algeria: 2,
  Libya: 2,
  Sudan: 2,
  Colombia: 2,
  Peru: 2,
  Mongolia: 2,
  Pakistan: 2,
  Congo: 2,
  "Dem. Rep. Congo": 2,
  "Democratic Republic of the Congo": 2,
  Ethiopia: 2,
  Angola: 2,
  Mali: 2,
  Niger: 2,
  Chad: 2,
  Tanzania: 2,
  Mozambique: 2,
  Zambia: 2,
  Myanmar: 2,
  Afghanistan: 2,
  Somalia: 2,
  Madagascar: 2,
  Kenya: 2,
  Morocco: 2,
  Spain: 3,
  Italy: 3,
  Poland: 3,
  Ukraine: 3,
  Romania: 3,
  Sweden: 3,
  Norway: 3,
  Finland: 3,
  Thailand: 3,
  Vietnam: 3,
  Philippines: 3,
  Malaysia: 3,
  "South Korea": 3,
  Iraq: 3,
  Chile: 3,
  Venezuela: 3,
  Ecuador: 3,
  Bolivia: 3,
  Paraguay: 3,
  Uruguay: 3,
  Cuba: 3,
  "New Zealand": 3,
  Ghana: 3,
  "Ivory Coast": 3,
  "Côte d'Ivoire": 3,
  Cameroon: 3,
  Zimbabwe: 3,
  Botswana: 3,
  Namibia: 3,
  Senegal: 3,
  Guinea: 3,
  Uganda: 3,
  Uzbekistan: 3,
  Turkmenistan: 3,
  Bangladesh: 3,
  Nepal: 3,
  "Sri Lanka": 3,
  Laos: 3,
  Cambodia: 3,
  "Papua New Guinea": 3,
  Gabon: 3,
};

export const WATERMARK_COUNTRIES = new Set([
  "Russia",
  "Canada",
  "United States of America",
  "China",
  "Brazil",
  "Australia",
  "India",
  "Argentina",
  "Kazakhstan",
  "Algeria",
  "Saudi Arabia",
  "Mexico",
  "Indonesia",
  "Sudan",
  "Libya",
  "Iran",
  "Mongolia",
  "Peru",
  "Chad",
  "Niger",
  "Angola",
  "Mali",
  "South Africa",
  "Colombia",
  "Ethiopia",
  "Bolivia",
  "Egypt",
  "Nigeria",
  "Tanzania",
  "Turkey",
]);

export function getCountryTier(name: string): number {
  return COUNTRY_TIERS[name] || 4;
}

export function getMinZoomForTier(tier: number): number {
  switch (tier) {
    case 1:
      return 1.3;
    case 2:
      return 2;
    case 3:
      return 3.5;
    default:
      return 6;
  }
}

/** Map globe camera altitude (~0.4–25) to a rough 2D-map zoom so tier rules match GlobalMap. */
export function equivalentMapZoomFromGlobeAltitude(altitude: number): number {
  return Math.max(0.9, Math.min(22, 6.2 / Math.max(altitude, 0.35)));
}

/**
 * Same tier math as the 2D map, but scaled for globe.gl camera altitude so “map zoom” isn’t stuck low.
 * With 6.2/alt, default alt ~2.5 → equiv ~2.5, so tier 4 (minZoom 6) never appeared until extreme zoom — most countries looked “unnamed”.
 * This curve targets ~6+ at typical world view (alt ~2.5) so small countries can earn labels like on the flat map at comparable framing.
 */
export function globeEquivalentMapZoom(altitude: number): number {
  return Math.max(0.9, Math.min(22, 16 / Math.max(altitude, 0.35)));
}

export function displayNameForCountry(rawName: string): string {
  return DISPLAY_NAMES[rawName] || rawName;
}
