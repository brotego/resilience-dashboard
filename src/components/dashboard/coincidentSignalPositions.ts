import { geoContains } from "d3-geo";

export type SignalDisplayPosition = {
  lng: number;
  lat: number;
  /** Globe only: added to base point altitude so stacked markers do not z-fight. */
  altitudeExtra: number;
};

const EARTH_RADIUS_M = 6_371_000;

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

function clusterByProximity<T extends { id: string; coordinates: [number, number] }>(
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

/**
 * If a spread position left the country polygon that contains the original signal, pull it back toward home.
 */
export function clampPositionsToContainingCountry<
  T extends { id: string; coordinates: [number, number] },
>(
  signals: T[],
  spread: Map<string, SignalDisplayPosition>,
  countryFeatures: { geometry: unknown }[],
): Map<string, SignalDisplayPosition> {
  if (!countryFeatures.length) return spread;
  const out = new Map(spread);

  for (const signal of signals) {
    const cur = out.get(signal.id);
    if (!cur) continue;
    const [homeLng, homeLat] = signal.coordinates;
    const feat = findContainingFeature(homeLng, homeLat, countryFeatures);
    if (!feat) continue;

    const { lng, lat } = cur;
    let candidateInside = false;
    try {
      candidateInside = geoContains(feat as GeoJSON.GeoJSON, [lng, lat]);
    } catch {
      candidateInside = false;
    }
    if (candidateInside) continue;

    let best = { lng: homeLng, lat: homeLat };
    for (let t = 0.45; t >= 0.05; t -= 0.1) {
      const nl = homeLng + (lng - homeLng) * t;
      const na = homeLat + (lat - homeLat) * t;
      try {
        if (geoContains(feat as GeoJSON.GeoJSON, [nl, na])) {
          best = { lng: nl, lat: na };
          break;
        }
      } catch {
        /* ignore */
      }
    }
    out.set(signal.id, { ...cur, lng: best.lng, lat: best.lat });
  }
  return out;
}

/**
 * Groups signals that are within `proximityMeters` of each other (not just identical coordinates),
 * spreads them on a ring, and assigns a small altitude offset for the globe to avoid z-fighting.
 */
export function spreadCoincidentSignalPositions<T extends { id: string; coordinates: [number, number] }>(
  items: T[],
  options?: { proximityMeters?: number; ringStepDeg?: number; altitudeStep?: number },
): Map<string, SignalDisplayPosition> {
  const proximityMeters = options?.proximityMeters ?? 1_600;
  const ringStepDeg = options?.ringStepDeg ?? 0.014;
  const altitudeStep = options?.altitudeStep ?? 0.004;

  const out = new Map<string, SignalDisplayPosition>();
  const clusters = clusterByProximity(items, proximityMeters);

  for (const group of clusters) {
    if (group.length === 1) {
      const [lng, lat] = group[0].coordinates;
      out.set(group[0].id, { lng, lat, altitudeExtra: 0 });
      continue;
    }
    const sorted = [...group].sort((a, b) => a.id.localeCompare(b.id));
    const n = sorted.length;
    const lng0 = sorted.reduce((s, p) => s + p.coordinates[0], 0) / n;
    const lat0 = sorted.reduce((s, p) => s + p.coordinates[1], 0) / n;
    const r = ringStepDeg * Math.sqrt(Math.max(1, n / 2));
    sorted.forEach((p, i) => {
      const theta = (2 * Math.PI * i) / n - Math.PI / 2;
      const latRad = lat0 * (Math.PI / 180);
      const dLat = r * Math.sin(theta);
      const dLng = (r * Math.cos(theta)) / Math.max(0.35, Math.cos(latRad));
      out.set(p.id, {
        lng: lng0 + dLng,
        lat: lat0 + dLat,
        altitudeExtra: i * altitudeStep,
      });
    });
  }
  return out;
}
