import { geoBounds, geoContains, geoCentroid } from "d3-geo";

export type SignalDisplayPosition = {
  lng: number;
  lat: number;
  /** Globe only: added to base point altitude so stacked markers do not z-fight. */
  altitudeExtra: number;
};

const EARTH_RADIUS_M = 6_371_000;
const COUNTRY_NAME_ALIASES: Record<string, string> = {
  "united states of america": "united states",
  "usa": "united states",
  "u.s.a.": "united states",
  "u.s.": "united states",
  "uk": "united kingdom",
  "russian federation": "russia",
  "korea, republic of": "south korea",
  "republic of korea": "south korea",
  "viet nam": "vietnam",
  "czechia": "czech republic",
};

function compactCountryName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeCountryName(name: string): string {
  const n = compactCountryName(name);
  return COUNTRY_NAME_ALIASES[n] || n;
}

function haversineMeters(a: [number, number], b: [number, number]): number {
  const [lng1, lat1] = a;
  const [lng2, lat2] = b;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const s1 = Math.sin(dLat / 2) ** 2;
  const s2 =
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(s1 + s2)));
}

function clusterByProximity<T extends { id: string; coordinates: [number, number]; location?: string }>(
  items: T[],
  maxMeters: number,
): T[][] {
  const n = items.length;
  const parent = Array.from({ length: n }, (_, i) => i);
  function find(a: number): number {
    if (parent[a] !== a) parent[a] = find(parent[a]);
    return parent[a];
  }
  function union(a: number, b: number) {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[rb] = ra;
  }
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      // Keep clustering country-local so nearby countries don't get merged into one spread ring.
      const li = items[i].location;
      const lj = items[j].location;
      if (li && lj && normalizeCountryName(li) !== normalizeCountryName(lj)) continue;
      if (haversineMeters(items[i].coordinates, items[j].coordinates) <= maxMeters) {
        union(i, j);
      }
    }
  }
  const groups = new Map<number, T[]>();
  for (let i = 0; i < n; i++) {
    const r = find(i);
    if (!groups.has(r)) groups.set(r, []);
    groups.get(r)!.push(items[i]);
  }
  return [...groups.values()];
}

/**
 * Signals that share the same map stack as the selected one (same proximity cluster as spreadCoincidentSignalPositions).
 * Sorted by id to match the order used when spreading dots on the ring.
 */
export function getCoincidentSignalsForSelection<T extends { id: string; coordinates: [number, number]; location?: string }>(
  items: T[],
  selectedId: string,
  options?: { proximityMeters?: number },
): { cluster: T[]; index: number } | null {
  if (!items.length) return null;
  const proximityMeters = options?.proximityMeters ?? 1_600;
  const clusters = clusterByProximity(items, proximityMeters);
  for (const group of clusters) {
    const sorted = [...group].sort((a, b) => a.id.localeCompare(b.id));
    const index = sorted.findIndex((s) => s.id === selectedId);
    if (index >= 0) return { cluster: sorted, index };
  }
  return null;
}

function findContainingFeature(
  lng: number,
  lat: number,
  countryFeatures: { geometry: unknown }[],
): { geometry: unknown } | null {
  const pt: [number, number] = [lng, lat];
  for (const f of countryFeatures) {
    try {
      if (geoContains(f as GeoJSON.GeoJSON, pt)) return f;
    } catch {
      /* invalid geometry */
    }
  }
  return null;
}

function featureCountryName(feature: { geometry: unknown; properties?: Record<string, unknown> }): string | null {
  const p = feature.properties || {};
  const raw = (p.name || p.NAME || p.ADMIN || p.sovereignt) as string | undefined;
  if (!raw || typeof raw !== "string") return null;
  return normalizeCountryName(raw);
}

function featureCountryKeys(feature: { geometry: unknown; properties?: Record<string, unknown> }): string[] {
  const p = feature.properties || {};
  const rawCandidates = [
    p.name,
    p.NAME,
    p.ADMIN,
    p.sovereignt,
    p.abbrev,
    p.iso_a2,
    p.iso_a3,
  ].filter((v): v is string => typeof v === "string" && v.trim().length > 0);
  const keys = new Set<string>();
  for (const raw of rawCandidates) {
    const n = normalizeCountryName(raw);
    if (n) keys.add(n);
  }
  return [...keys];
}

function approxFeatureBBoxAreaDegSq(feature: { geometry: unknown }): number {
  try {
    const b = geoBounds(feature as GeoJSON.GeoJSON);
    const w = b[1][0] - b[0][0];
    const h = b[1][1] - b[0][1];
    if (!Number.isFinite(w) || !Number.isFinite(h)) return 0;
    return Math.max(0, w) * Math.max(0, h);
  } catch {
    return 0;
  }
}

function buildFeaturesByCountry(
  countryFeatures: { geometry: unknown; properties?: Record<string, unknown> }[],
): Map<string, { geometry: unknown; properties?: Record<string, unknown> }[]> {
  const featuresByCountry = new Map<string, { geometry: unknown; properties?: Record<string, unknown> }[]>();
  for (const f of countryFeatures) {
    const keys = featureCountryKeys(f);
    for (const name of keys) {
      if (!featuresByCountry.has(name)) featuresByCountry.set(name, []);
      featuresByCountry.get(name)!.push(f);
    }
  }
  return featuresByCountry;
}

/**
 * Pick the GeoJSON feature that best represents `signal.location`, using home coordinates only to
 * disambiguate multi-part countries — never a foreign neighbor polygon.
 */
function resolveCountryFeatureForSignal<T extends { coordinates: [number, number]; location?: string }>(
  signal: T,
  countryFeatures: { geometry: unknown; properties?: Record<string, unknown> }[],
  featuresByCountry: Map<string, { geometry: unknown; properties?: Record<string, unknown> }[]>,
): { geometry: unknown; properties?: Record<string, unknown> } | null {
  const [homeLng, homeLat] = signal.coordinates;
  const raw = (signal.location || "").trim();
  const targetNorm = raw ? normalizeCountryName(raw) : "";
  const isGlobal = !targetNorm || targetNorm === "global";

  if (isGlobal || !countryFeatures.length) {
    return (
      findContainingFeature(homeLng, homeLat, countryFeatures) ||
      nearestFeatureByCentroid(homeLng, homeLat, countryFeatures)
    );
  }

  let candidates: { geometry: unknown; properties?: Record<string, unknown> }[] = [];
  if (featuresByCountry.has(targetNorm)) {
    candidates = featuresByCountry.get(targetNorm)!;
  } else {
    const fuzzy = countryFeatures.filter((f) => {
      const name = featureCountryName(f);
      if (!name) return false;
      return name.includes(targetNorm) || targetNorm.includes(name);
    });
    if (fuzzy.length > 0) candidates = fuzzy;
  }

  if (candidates.length === 0) {
    return (
      findContainingFeature(homeLng, homeLat, countryFeatures) ||
      nearestFeatureByCentroid(homeLng, homeLat, countryFeatures)
    );
  }
  if (candidates.length === 1) return candidates[0];

  for (const f of candidates) {
    try {
      if (geoContains(f as GeoJSON.GeoJSON, [homeLng, homeLat])) return f;
    } catch {
      /* ignore */
    }
  }

  let best = candidates[0];
  let bestDist = Number.POSITIVE_INFINITY;
  for (const f of candidates) {
    const interior = findInteriorPoint(f);
    if (!interior) continue;
    const d = haversineMeters([homeLng, homeLat], interior);
    if (d < bestDist) {
      bestDist = d;
      best = f;
    }
  }
  if (bestDist < Number.POSITIVE_INFINITY) return best;

  return candidates.reduce((a, b) => (approxFeatureBBoxAreaDegSq(a) >= approxFeatureBBoxAreaDegSq(b) ? a : b));
}

function nearestFeatureByCentroid(
  lng: number,
  lat: number,
  countryFeatures: { geometry: unknown }[],
): { geometry: unknown } | null {
  if (!countryFeatures.length) return null;
  let best: { geometry: unknown } | null = null;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const f of countryFeatures) {
    try {
      const c = geoCentroid(f as GeoJSON.GeoJSON) as [number, number];
      if (!Number.isFinite(c[0]) || !Number.isFinite(c[1])) continue;
      const d = haversineMeters([lng, lat], c);
      if (d < bestDist) {
        bestDist = d;
        best = f;
      }
    } catch {
      /* invalid geometry */
    }
  }
  return best;
}

function snapLngLatToPolygon(
  feature: { geometry: unknown } | null,
  lng: number,
  lat: number,
  anchorLng: number,
  anchorLat: number,
): { lng: number; lat: number } {
  if (!feature) return { lng, lat };
  try {
    if (geoContains(feature as GeoJSON.GeoJSON, [lng, lat])) return { lng, lat };
  } catch {
    /* ignore */
  }

  const interior = findInteriorPoint(feature);
  const il = interior?.[0] ?? anchorLng;
  const ia = interior?.[1] ?? anchorLat;

  let best = { lng: il, lat: ia };
  let found = false;
  for (let t = 1; t >= 0; t -= 0.02) {
    const nl = anchorLng + (lng - anchorLng) * t;
    const na = anchorLat + (lat - anchorLat) * t;
    try {
      if (geoContains(feature as GeoJSON.GeoJSON, [nl, na])) {
        best = { lng: nl, lat: na };
        found = true;
        break;
      }
    } catch {
      /* ignore */
    }
  }
  if (!found && interior) best = { lng: interior[0], lat: interior[1] };
  return best;
}

function isInsideFeature(
  feature: { geometry: unknown } | null,
  lng: number,
  lat: number,
): boolean {
  if (!feature) return false;
  try {
    return geoContains(feature as GeoJSON.GeoJSON, [lng, lat]);
  } catch {
    return false;
  }
}

const interiorPointCache = new WeakMap<object, [number, number] | null>();

function findInteriorPoint(feature: { geometry: unknown }): [number, number] | null {
  const key = feature as unknown as object;
  if (interiorPointCache.has(key)) {
    return interiorPointCache.get(key) ?? null;
  }

  let result: [number, number] | null = null;
  try {
    const center = geoCentroid(feature as GeoJSON.GeoJSON) as [number, number];
    if (
      Number.isFinite(center[0]) &&
      Number.isFinite(center[1]) &&
      geoContains(feature as GeoJSON.GeoJSON, center)
    ) {
      result = center;
    } else {
      const bounds = geoBounds(feature as GeoJSON.GeoJSON);
      const [minLng, minLat] = bounds[0];
      const [maxLng, maxLat] = bounds[1];
      const cols = 12;
      const rows = 12;
      for (let ring = 0; ring < Math.max(cols, rows); ring++) {
        for (let yi = 0; yi <= ring; yi++) {
          const xi = ring - yi;
          const checks: [number, number][] = [
            [xi, yi],
            [cols - xi, yi],
            [xi, rows - yi],
            [cols - xi, rows - yi],
          ];
          for (const [cx, cy] of checks) {
            const tLng = cols === 0 ? 0.5 : cx / cols;
            const tLat = rows === 0 ? 0.5 : cy / rows;
            const lng = minLng + (maxLng - minLng) * tLng;
            const lat = minLat + (maxLat - minLat) * tLat;
            if (geoContains(feature as GeoJSON.GeoJSON, [lng, lat])) {
              result = [lng, lat];
              break;
            }
          }
          if (result) break;
        }
        if (result) break;
      }
    }
  } catch {
    result = null;
  }

  interiorPointCache.set(key, result);
  return result;
}

/**
 * If a spread position left the country polygon that contains the original signal, pull it back toward home.
 */
export function clampPositionsToContainingCountry<
  T extends { id: string; coordinates: [number, number]; location?: string },
>(
  signals: T[],
  spread: Map<string, SignalDisplayPosition>,
  countryFeatures: { geometry: unknown; properties?: Record<string, unknown> }[],
): Map<string, SignalDisplayPosition> {
  if (!countryFeatures.length) return spread;
  const out = new Map(spread);
  const featuresByCountry = buildFeaturesByCountry(countryFeatures);

  for (const signal of signals) {
    const cur = out.get(signal.id);
    if (!cur) continue;
    const [homeLng, homeLat] = signal.coordinates;
    const feat = resolveCountryFeatureForSignal(signal, countryFeatures, featuresByCountry);
    if (!feat) continue;

    const { lng, lat } = cur;
    let candidateInside = false;
    try {
      candidateInside = geoContains(feat as GeoJSON.GeoJSON, [lng, lat]);
    } catch {
      candidateInside = false;
    }
    if (candidateInside) continue;

    const interiorSeed = findInteriorPoint(feat);
    const anchorLng = interiorSeed?.[0] ?? homeLng;
    const anchorLat = interiorSeed?.[1] ?? homeLat;

    let best = snapLngLatToPolygon(feat, lng, lat, anchorLng, anchorLat);
    if (!isInsideFeature(feat, best.lng, best.lat)) {
      let found = false;
      for (let t = 1; t >= 0; t -= 0.02) {
        const nl = homeLng + (lng - homeLng) * t;
        const na = homeLat + (lat - homeLat) * t;
        try {
          if (geoContains(feat as GeoJSON.GeoJSON, [nl, na])) {
            best = { lng: nl, lat: na };
            found = true;
            break;
          }
        } catch {
          /* ignore */
        }
      }
      if (!found && interiorSeed) {
        best = { lng: interiorSeed[0], lat: interiorSeed[1] };
      }
    }

    // Stay inside the labeled country's polygon only (never jump to a neighbor across water).
    if (!isInsideFeature(feat, best.lng, best.lat)) {
      const interior = findInteriorPoint(feat);
      if (interior) {
        best = snapLngLatToPolygon(feat, best.lng, best.lat, interior[0], interior[1]);
      }
    }
    if (!isInsideFeature(feat, best.lng, best.lat)) {
      const interior = findInteriorPoint(feat);
      if (interior) best = { lng: interior[0], lat: interior[1] };
    }
    out.set(signal.id, { ...cur, lng: best.lng, lat: best.lat });
  }
  return out;
}

/**
 * Groups signals that are within `proximityMeters` of each other (not just identical coordinates),
 * spreads them on a ring, and assigns a small altitude offset for the globe to avoid z-fighting.
 */
export function spreadCoincidentSignalPositions<T extends { id: string; coordinates: [number, number]; location?: string }>(
  items: T[],
  options?: {
    proximityMeters?: number;
    ringStepDeg?: number;
    altitudeStep?: number;
    countryFeatures?: { geometry: unknown; properties?: Record<string, unknown> }[];
  },
): Map<string, SignalDisplayPosition> {
  const proximityMeters = options?.proximityMeters ?? 1_600;
  const ringStepDeg = options?.ringStepDeg ?? 0.008;
  const altitudeStep = options?.altitudeStep ?? 0.004;
  const countryFeatures = options?.countryFeatures ?? [];

  const out = new Map<string, SignalDisplayPosition>();
  const clusters = clusterByProximity(items, proximityMeters);

  const featuresByCountry = buildFeaturesByCountry(countryFeatures);

  const resolveFeatureForSignal = (signal: T): { geometry: unknown; properties?: Record<string, unknown> } | null =>
    resolveCountryFeatureForSignal(signal, countryFeatures, featuresByCountry);

  for (const group of clusters) {
    if (group.length === 1) {
      const [lng, lat] = group[0].coordinates;
      const feat = resolveFeatureForSignal(group[0]);
      const snapped = snapLngLatToPolygon(feat, lng, lat, lng, lat);
      out.set(group[0].id, { lng: snapped.lng, lat: snapped.lat, altitudeExtra: 0 });
      continue;
    }
    const sorted = [...group].sort((a, b) => a.id.localeCompare(b.id));
    const n = sorted.length;
    const lng0 = sorted.reduce((s, p) => s + p.coordinates[0], 0) / n;
    const lat0 = sorted.reduce((s, p) => s + p.coordinates[1], 0) / n;
    const feat = resolveFeatureForSignal(sorted[0]);
    const anchor = snapLngLatToPolygon(feat, lng0, lat0, lng0, lat0);
    const r = ringStepDeg * Math.sqrt(Math.max(1, n / 2));
    sorted.forEach((p, i) => {
      const theta = (2 * Math.PI * i) / n - Math.PI / 2;
      const latRad = anchor.lat * (Math.PI / 180);
      const dLat = r * Math.sin(theta);
      const dLng = (r * Math.cos(theta)) / Math.max(0.35, Math.cos(latRad));
      const rawLng = anchor.lng + dLng;
      const rawLat = anchor.lat + dLat;
      const snapped = snapLngLatToPolygon(feat, rawLng, rawLat, anchor.lng, anchor.lat);
      out.set(p.id, {
        lng: snapped.lng,
        lat: snapped.lat,
        altitudeExtra: i * altitudeStep,
      });
    });
  }
  return out;
}
