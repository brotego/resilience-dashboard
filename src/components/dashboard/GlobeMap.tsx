import { memo, useCallback, useEffect, useMemo, useRef, useState, startTransition } from "react";
import { createRoot, type Root } from "react-dom/client";
import Globe from "react-globe.gl";
import { DOMAINS } from "@/data/domains";
import { COMPANIES, CompanyId } from "@/data/companies";
import { UnifiedSignal } from "@/data/unifiedSignalTypes";
import { DashboardMode } from "./DashboardLayout";
import { geoBounds, geoCentroid } from "d3-geo";
import {
  LABEL_OVERRIDES,
  displayNameForCountry,
  globeEquivalentMapZoom,
  getCountryTier,
  getMinZoomForTier,
} from "@/data/countryMapLabels";
import {
  getSignalBaseR,
  getUrgencyMultiplier,
  globeDotScaleFromCameraAltitude,
  globeSignalRadiusDeg,
} from "./signalMarkerStyle";
import {
  clampPositionsToContainingCountry,
  spreadCoincidentSignalPositions,
} from "./coincidentSignalPositions";
import SignalMapDot from "./SignalMapDot";
import { useJpUi } from "@/i18n/jpUiContext";

type CountryFeature = { properties?: { name?: string; NAME?: string }; geometry: any; type?: string };

interface Props {
  mode: DashboardMode;
  signals: UnifiedSignal[];
  selectedCompany: CompanyId | null;
  selectedSignalId: string | null;
  readSignalIds: string[];
  onSignalClick: (signal: UnifiedSignal) => void;
  onCountryClick: (countryName: string, geo: CountryFeature) => void;
  selectedCountry: string | null;
}

type GlobeSignalMarker = {
  id: string;
  lat: number;
  lng: number;
  altitudeExtra: number;
  signal: UnifiedSignal;
  r: number;
  dotScale: number;
  renderColor: string;
  dimmed: boolean;
  score: number;
  isSelected: boolean;
};

/** WebGL point used only for raycast picking; globe.gl resolves clicks before DOM (HTML) markers receive them. */
type GlobeSignalPickPoint = UnifiedSignal & {
  lat: number;
  lng: number;
  altitudeExtra: number;
  pickRadius: number;
};
type CountryLabel = { lat: number; lng: number; text: string; color: string; size: number };

const GENZ_COLOR = "#1ab5a5";
const COUNTRY_GEOJSON_URL = "https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson";

/** Slightly above the country fill so text reads as “on” the polygon, not floating in space. */
const LABEL_ALTITUDE = 0.006;

/** Globe points are cylinders on the surface — radius (deg) controls hit area; keep altitude modest so they read as dots. */
const SIGNAL_DOT_ALTITUDE = 0.012;

/** Finer than label buckets so signal dot radii track zoom without excessive React churn. */
function bucketSignalAltitude(alt: number): number {
  return Math.round(alt * 10) / 10;
}

/** Camera `altitude` from globe.gl is distance in globe-radius units (default ~2.5). Larger = zoomed out. */
function baseLabelSizeForAltitude(altitude: number): number {
  const a = Math.max(altitude, 0.45);
  // Slightly sublinear: shrinks faster when zoomed out than pure 1/alt
  const scaled = 0.5 * Math.pow(2.5 / a, 0.92);
  return Math.min(0.58, Math.max(0.045, scaled));
}

function tierSizeMultiplier(tier: number): number {
  switch (tier) {
    case 1:
      return 1;
    case 2:
      return 0.88;
    case 3:
      return 0.74;
    default:
      return 0.6;
  }
}

function lengthSizeMultiplier(text: string): number {
  const len = text.length;
  if (len <= 5) return 1;
  if (len <= 8) return 0.9;
  if (len <= 12) return 0.78;
  return 0.66;
}

function quantizeLabelSize(size: number): number {
  return Math.round(size / 0.025) * 0.025;
}

/**
 * When zoomed in (low camera altitude), coarser steps → fewer label state updates while scrolling the wheel.
 * When zoomed out, finer steps keep tier/opacity responsive.
 */
function bucketEquivZoom(ez: number, alt: number): number {
  if (alt < 1.5) return Math.round(ez * 2) / 2;
  return Math.round(ez * 4) / 4;
}

/** Coarser bucket for base text scale — updates less often while zooming (less globe work). */
function bucketSizeAltitude(alt: number): number {
  return Math.round(alt * 2) / 2;
}

/** Zoom changes altitude every frame → label digest lags; rotation does not. Throttle label state during zoom only. */
const LABEL_ZOOM_THROTTLE_MS = 120;

/** Tighter zoom = more labels on screen → heavier TextGeometry work; throttle label updates more. */
function zoomThrottleMsForAltitude(alt: number): number {
  if (alt < 1.2) return 240;
  if (alt < 1.55) return 200;
  if (alt < 2.2) return 160;
  return LABEL_ZOOM_THROTTLE_MS;
}

/** After last wheel event, restore country labels (sync to final camera). */
const WHEEL_LABEL_IDLE_MS = 340;

/**
 * Globe.gl camera altitude: lower = closer to the surface (more “zoomed in”).
 * Map from country bounding-box span (degrees). The old 16/z2d mapping pulled large
 * countries out to altitude 5–8 — farther than the default world view (~2.5) — which felt like zooming out.
 */
function globeAltitudeForCountryBounds(maxSpanDeg: number): number {
  const span = Math.max(0.5, Math.min(180, maxSpanDeg));
  const alt = 0.45 + span * 0.042;
  return Math.min(2.35, Math.max(0.45, alt));
}

function countryLabelFromFeature(f: CountryFeature): string | undefined {
  const p = f.properties as { name?: string; NAME?: string; ADMIN?: string } | undefined;
  if (!p) return undefined;
  return p.name || p.NAME || p.ADMIN;
}

function getSignalColor(signal: UnifiedSignal, mode: DashboardMode): string {
  if (signal.layer === "genz") return GENZ_COLOR;
  if (signal.layer === "live-news") {
    if (mode === "genz") return GENZ_COLOR;
    if (signal.domain) {
      const domain = DOMAINS.find((d) => d.id === signal.domain);
      if (domain?.color) return domain.color;
    }
    return "#3b82f6";
  }
  if (signal.domain) {
    const domain = DOMAINS.find((d) => d.id === signal.domain);
    return domain?.color || "hsl(38, 90%, 55%)";
  }
  return "#3b82f6";
}

function isRelevantToCompany(text: string, companyId: CompanyId): boolean {
  const company = COMPANIES.find((c) => c.id === companyId);
  if (!company) return false;
  const lower = text.toLowerCase();
  return company.keywords.some((kw) => lower.includes(kw.toLowerCase()));
}

const GlobeMap = memo(
  ({
    mode,
    signals,
    selectedCompany,
    selectedSignalId,
    readSignalIds,
    onSignalClick,
    onCountryClick,
    selectedCountry,
  }: Props) => {
  const { getSignalDisplay } = useJpUi();
  const globeRef = useRef<any>(null);
  /** Prevents duplicate pointOfView runs (polygon click + useEffect, or React Strict Mode double-effect). */
  const lastFlyTargetCountryRef = useRef<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const signalMarkerRootsRef = useRef(new Map<string, { container: HTMLDivElement; root: Root }>());
  const labelsSuppressedRef = useRef(false);
  const wheelIdleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const zoomRafRef = useRef<number | null>(null);
  const pendingAltRef = useRef<number | null>(null);
  const lastEzBucketRef = useRef(bucketEquivZoom(globeEquivalentMapZoom(2.5), 2.5));
  const lastSizeAltBucketRef = useRef(bucketSizeAltitude(2.5));
  const lastLabelFlushAtRef = useRef(0);
  const pendingLabelRef = useRef<{ ez: number; ezB: number; szB: number } | null>(null);
  const zoomLabelTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [labelView, setLabelView] = useState(() => {
    const ez0 = globeEquivalentMapZoom(2.5);
    return {
      equivZoom: ez0,
      sizeAltitude: bucketSizeAltitude(2.5),
    };
  });
  const lastGlobeAltBucketRef = useRef(bucketSignalAltitude(2.5));
  const [globeCameraAltitude, setGlobeCameraAltitude] = useState(2.5);
  /** Finer than label buckets: HTML signal dots track true camera distance (label throttle was freezing dot size mid–fly-to-country). */
  const [signalViewAltitude, setSignalViewAltitude] = useState(2.5);
  const signalAltPendingRef = useRef<number | null>(null);
  const signalAltRafRef = useRef<number | null>(null);

  const scheduleSignalViewAltitude = useCallback((alt: number) => {
    if (!Number.isFinite(alt)) return;
    signalAltPendingRef.current = alt;
    if (signalAltRafRef.current != null) return;
    signalAltRafRef.current = requestAnimationFrame(() => {
      signalAltRafRef.current = null;
      const a = signalAltPendingRef.current;
      if (a == null || !Number.isFinite(a)) return;
      setSignalViewAltitude((prev) => (Math.abs(prev - a) < 0.007 ? prev : a));
    });
  }, []);

  const bumpGlobeAltitudeIfNeeded = useCallback((alt: number) => {
    if (!Number.isFinite(alt)) return;
    const b = bucketSignalAltitude(alt);
    if (b === lastGlobeAltBucketRef.current) return;
    lastGlobeAltBucketRef.current = b;
    startTransition(() => setGlobeCameraAltitude(b));
  }, []);
  const [labelsSuppressed, setLabelsSuppressed] = useState(false);
  const [countries, setCountries] = useState<CountryFeature[]>([]);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const updateViewport = () => {
      const nextWidth = Math.max(1, Math.round(el.clientWidth));
      const nextHeight = Math.max(1, Math.round(el.clientHeight));
      setViewport((prev) =>
        prev.width === nextWidth && prev.height === nextHeight
          ? prev
          : { width: nextWidth, height: nextHeight }
      );
    };

    updateViewport();
    const ro = new ResizeObserver(updateViewport);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const syncLabelStateFromAltitude = useCallback((alt: number) => {
    scheduleSignalViewAltitude(alt);
    bumpGlobeAltitudeIfNeeded(alt);
    const ez = globeEquivalentMapZoom(alt);
    lastEzBucketRef.current = bucketEquivZoom(ez, alt);
    lastSizeAltBucketRef.current = bucketSizeAltitude(alt);
    lastLabelFlushAtRef.current = performance.now();
    pendingLabelRef.current = null;
    if (zoomLabelTimerRef.current != null) {
      clearTimeout(zoomLabelTimerRef.current);
      zoomLabelTimerRef.current = null;
    }
    startTransition(() => {
      setLabelView({ equivZoom: ez, sizeAltitude: bucketSizeAltitude(alt) });
    });
  }, [bumpGlobeAltitudeIfNeeded, scheduleSignalViewAltitude]);

  const finishWheelZoomLabels = useCallback(() => {
    const pov = globeRef.current?.pointOfView?.();
    if (!pov || !Number.isFinite(pov.altitude)) {
      labelsSuppressedRef.current = false;
      startTransition(() => setLabelsSuppressed(false));
      return;
    }
    const alt = pov.altitude;
    scheduleSignalViewAltitude(alt);
    bumpGlobeAltitudeIfNeeded(alt);
    const ez = globeEquivalentMapZoom(alt);
    lastEzBucketRef.current = bucketEquivZoom(ez, alt);
    lastSizeAltBucketRef.current = bucketSizeAltitude(alt);
    lastLabelFlushAtRef.current = performance.now();
    pendingLabelRef.current = null;
    if (zoomLabelTimerRef.current != null) {
      clearTimeout(zoomLabelTimerRef.current);
      zoomLabelTimerRef.current = null;
    }
    labelsSuppressedRef.current = false;
    startTransition(() => {
      setLabelView({ equivZoom: ez, sizeAltitude: bucketSizeAltitude(alt) });
      setLabelsSuppressed(false);
    });
  }, [bumpGlobeAltitudeIfNeeded, scheduleSignalViewAltitude]);

  const flushPendingLabelView = useCallback(() => {
    const p = pendingLabelRef.current;
    if (!p) return;
    if (p.ezB === lastEzBucketRef.current && p.szB === lastSizeAltBucketRef.current) {
      pendingLabelRef.current = null;
      return;
    }
    lastEzBucketRef.current = p.ezB;
    lastSizeAltBucketRef.current = p.szB;
    pendingLabelRef.current = null;
    lastLabelFlushAtRef.current = performance.now();
    startTransition(() => {
      setLabelView({ equivZoom: p.ez, sizeAltitude: p.szB });
    });
  }, []);

  const queueLabelViewForZoom = useCallback(
    (ez: number, alt: number) => {
      const ezB = bucketEquivZoom(ez, alt);
      const szB = bucketSizeAltitude(alt);
      if (ezB === lastEzBucketRef.current && szB === lastSizeAltBucketRef.current) return;

      pendingLabelRef.current = { ez, ezB, szB };

      const now = performance.now();
      const elapsed = now - lastLabelFlushAtRef.current;
      const throttleMs = zoomThrottleMsForAltitude(alt);
      if (elapsed >= throttleMs) {
        if (zoomLabelTimerRef.current != null) {
          clearTimeout(zoomLabelTimerRef.current);
          zoomLabelTimerRef.current = null;
        }
        flushPendingLabelView();
        return;
      }
      if (zoomLabelTimerRef.current == null) {
        zoomLabelTimerRef.current = setTimeout(() => {
          zoomLabelTimerRef.current = null;
          flushPendingLabelView();
        }, throttleMs - elapsed);
      }
    },
    [flushPendingLabelView],
  );

  const handleZoom = useCallback((pov: { lat: number; lng: number; altitude: number }) => {
    if (Number.isFinite(pov.altitude)) {
      scheduleSignalViewAltitude(pov.altitude);
    }
    if (labelsSuppressedRef.current) return;
    pendingAltRef.current = pov.altitude;
    if (zoomRafRef.current != null) return;
    zoomRafRef.current = requestAnimationFrame(() => {
      zoomRafRef.current = null;
      const alt = pendingAltRef.current;
      if (alt == null) return;
      bumpGlobeAltitudeIfNeeded(alt);
      const ez = globeEquivalentMapZoom(alt);
      const ezB = bucketEquivZoom(ez, alt);
      const szB = bucketSizeAltitude(alt);
      if (ezB === lastEzBucketRef.current && szB === lastSizeAltBucketRef.current) return;
      queueLabelViewForZoom(ez, alt);
    });
  }, [queueLabelViewForZoom, bumpGlobeAltitudeIfNeeded, scheduleSignalViewAltitude]);

  const labels = useMemo<CountryLabel[]>(() => {
    if (labelsSuppressed) return [];
    if (!countries.length) return [];
    type Row = {
      lat: number;
      lng: number;
      text: string;
      color: string;
      tier: number;
    };
    const rows: Row[] = [];
    for (const feature of countries) {
      const raw =
        feature.properties?.name ||
        feature.properties?.NAME ||
        (feature.properties as { ADMIN?: string })?.ADMIN ||
        "";
      if (!raw) continue;
      const tier = getCountryTier(raw);
      const minZoom = getMinZoomForTier(tier);
      if (labelView.equivZoom < minZoom) continue;
      try {
        const override = LABEL_OVERRIDES[raw];
        const centroid = geoCentroid(feature as any) as [number, number];
        const [lng, lat] = override ?? centroid;
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
        const fadeRange = minZoom * 0.3;
        const opacity = Math.min(1, (labelView.equivZoom - minZoom) / fadeRange + 0.5);
        const color = `hsla(220, 10%, 42%, ${opacity})`;
        const text = displayNameForCountry(raw);
        rows.push({ lat, lng, text, color, tier });
      } catch {
        /* skip invalid geometry */
      }
    }

    const base = baseLabelSizeForAltitude(labelView.sizeAltitude);
    const n = rows.length;
    const densityMul =
      n > 130 ? 0.78 : n > 95 ? 0.86 : n > 65 ? 0.92 : 1;

    return rows.map((r) => {
      const rawSize = base * tierSizeMultiplier(r.tier) * lengthSizeMultiplier(r.text) * densityMul;
      return {
        lat: r.lat,
        lng: r.lng,
        text: r.text,
        color: r.color,
        size: quantizeLabelSize(rawSize),
      };
    });
  }, [countries, labelView.equivZoom, labelView.sizeAltitude, labelsSuppressed]);

  useEffect(() => {
    let cancelled = false;
    fetch(COUNTRY_GEOJSON_URL)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        setCountries(Array.isArray(data?.features) ? data.features : []);
      })
      .catch(() => {
        if (cancelled) return;
        setCountries([]);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (zoomRafRef.current != null) cancelAnimationFrame(zoomRafRef.current);
      if (signalAltRafRef.current != null) cancelAnimationFrame(signalAltRafRef.current);
      if (zoomLabelTimerRef.current != null) clearTimeout(zoomLabelTimerRef.current);
      if (wheelIdleTimerRef.current != null) clearTimeout(wheelIdleTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = () => {
      labelsSuppressedRef.current = true;
      setLabelsSuppressed(true);
      pendingLabelRef.current = null;
      if (zoomLabelTimerRef.current != null) {
        clearTimeout(zoomLabelTimerRef.current);
        zoomLabelTimerRef.current = null;
      }
      if (wheelIdleTimerRef.current != null) clearTimeout(wheelIdleTimerRef.current);
      wheelIdleTimerRef.current = setTimeout(() => {
        wheelIdleTimerRef.current = null;
        finishWheelZoomLabels();
      }, WHEEL_LABEL_IDLE_MS);
    };
    el.addEventListener("wheel", onWheel, { passive: true, capture: true });
    return () => {
      el.removeEventListener("wheel", onWheel, { capture: true });
      if (wheelIdleTimerRef.current != null) clearTimeout(wheelIdleTimerRef.current);
    };
  }, [finishWheelZoomLabels]);

  const polygonCapColor = useCallback(
    (d: object) => {
      const feat = d as CountryFeature;
      const name = countryLabelFromFeature(feat);
      const isSel = !!(selectedCountry && name && name === selectedCountry);
      if (name === "Japan") {
        return isSel ? "hsl(220, 18%, 26%)" : "hsl(220, 14%, 22%)";
      }
      if (isSel) return "hsl(220, 16%, 24%)";
      return "hsl(220, 14%, 20%)";
    },
    [selectedCountry],
  );

  const polygonSideColor = useCallback(() => "hsl(220, 14%, 18%)", []);
  const polygonStrokeColor = useCallback(
    (d: object) => {
      const name = countryLabelFromFeature(d as CountryFeature);
      const isSel = !!(selectedCountry && name && name === selectedCountry);
      if (isSel) return "rgba(18, 65, 234, 0.85)";
      return "rgba(160, 176, 198, 0.65)";
    },
    [selectedCountry],
  );
  const polygonStrokeWidthAccessor = useCallback(
    (d: object) => {
      const name = countryLabelFromFeature(d as CountryFeature);
      const isSel = !!(selectedCountry && name && name === selectedCountry);
      return isSel ? 1.35 : 0.8;
    },
    [selectedCountry],
  );
  const labelColor = useCallback((d: object) => (d as CountryLabel).color, []);
  const labelSizeAccessor = useCallback((d: object) => (d as CountryLabel).size, []);

  const onGlobeReady = useCallback(() => {
    const pov = globeRef.current?.pointOfView?.();
    if (pov && Number.isFinite(pov.altitude)) {
      syncLabelStateFromAltitude(pov.altitude);
    }
  }, [syncLabelStateFromAltitude]);

  const flyToGlobalView = useCallback(() => {
    globeRef.current?.pointOfView({ lat: 20, lng: 30, altitude: 2.5 }, 1000);
  }, []);

  const flyToCountryFeature = useCallback((geo: CountryFeature): boolean => {
    const g = globeRef.current;
    if (!g?.pointOfView) return false;
    try {
      const centroid = geoCentroid(geo as Parameters<typeof geoCentroid>[0]) as [number, number];
      const [lng, lat] = centroid;
      if (!Number.isFinite(lng) || !Number.isFinite(lat)) return false;
      const b = geoBounds(geo as Parameters<typeof geoBounds>[0]);
      const maxSpan = Math.max(Math.abs(b[1][0] - b[0][0]), Math.abs(b[1][1] - b[0][1]));
      const altitude = globeAltitudeForCountryBounds(maxSpan);
      if (!Number.isFinite(altitude)) return false;
      g.pointOfView({ lat, lng, altitude }, 1000);
      return true;
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    if (!selectedCountry) {
      lastFlyTargetCountryRef.current = null;
      return;
    }
    if (!countries.length) return;
    const feature = countries.find((f) => countryLabelFromFeature(f) === selectedCountry);
    if (!feature) return;
    if (lastFlyTargetCountryRef.current === selectedCountry) return;
    if (flyToCountryFeature(feature)) {
      lastFlyTargetCountryRef.current = selectedCountry;
    }
  }, [selectedCountry, countries, flyToCountryFeature]);

  const prevSelectedCountryRef = useRef<string | null>(null);
  useEffect(() => {
    // Clearing country alone (e.g. closing the country panel) should return to world view.
    // Clearing country because a signal was selected must not reset the camera — that felt like a random zoom-out.
    if (prevSelectedCountryRef.current && !selectedCountry && !selectedSignalId) {
      flyToGlobalView();
    }
    prevSelectedCountryRef.current = selectedCountry;
  }, [selectedCountry, selectedSignalId, flyToGlobalView]);

  const onPolygonClick = useCallback(
    (polygon: object) => {
      const f = polygon as CountryFeature;
      const name = countryLabelFromFeature(f);
      if (!name) return;
      onCountryClick(name, f);
    },
    [onCountryClick],
  );

  const onPointClick = useCallback(
    (d: object) => {
      onSignalClick(d as UnifiedSignal);
    },
    [onSignalClick],
  );

  const pickPointLabel = useCallback(
    (d: object) => {
      const s = d as UnifiedSignal;
      const disp = getSignalDisplay(s);
      return `<div style="padding:4px 6px"><strong>${disp.title}</strong><br/>${disp.location}</div>`;
    },
    [getSignalDisplay],
  );

  /**
   * Let clicks reach country polygons: skip label meshes and the atmosphere shell (it can sit in front of land).
   */
  const pointerEventsFilter = useCallback((obj: object) => {
    const type = (obj as { __globeObjType?: string }).__globeObjType ?? "";
    return type !== "label" && type !== "atmosphere";
  }, []);

  const showPointerCursor = useCallback(
    (objType: string) => objType === "point" || objType === "polygon",
    [],
  );

  const labelResolution = useMemo(
    () => (labelView.equivZoom >= 4.35 ? 1 : 2),
    [labelView.equivZoom],
  );

  const spreadPositions = useMemo(() => {
    const raw = spreadCoincidentSignalPositions(signals, {
      proximityMeters: 1_600,
      ringStepDeg: 0.008,
      altitudeStep: 0.004,
      countryFeatures: countries,
    });
    return clampPositionsToContainingCountry(signals, raw, countries);
  }, [signals, countries]);

  const signalMarkers = useMemo<GlobeSignalMarker[]>(() => {
    const dotScale = globeDotScaleFromCameraAltitude(signalViewAltitude);
    return signals.map((signal) => {
      const baseColor = getSignalColor(signal, mode);
      const score = signal.resilienceScore;
      const relevant = selectedCompany
        ? isRelevantToCompany(`${signal.title} ${signal.description}`, selectedCompany)
        : false;
      const dimmed = !!(selectedCompany && !relevant && signal.layer !== "live-news");
      const isSelected = signal.id === selectedSignalId;
      const isRead = readSignalIds.includes(signal.id);
      const renderColor = isSelected || isRead ? "hsl(220, 8%, 48%)" : baseColor;

      const urgency = getUrgencyMultiplier(score);
      const baseR = getSignalBaseR(relevant) * urgency;
      const r = baseR * dotScale;

      const pos = spreadPositions.get(signal.id)!;
      return {
        id: signal.id,
        lat: pos.lat,
        lng: pos.lng,
        altitudeExtra: pos.altitudeExtra,
        signal,
        r,
        dotScale,
        renderColor,
        dimmed,
        score,
        isSelected,
      };
    });
  }, [signals, spreadPositions, selectedCompany, selectedSignalId, readSignalIds, mode]);

  const ensureSignalMarkerHost = useCallback((id: string) => {
    let row = signalMarkerRootsRef.current.get(id);
    if (!row) {
      const container = document.createElement("div");
      container.style.cssText =
        "transform:translate(-50%,-50%);pointer-events:auto;cursor:pointer;line-height:0;";
      const root = createRoot(container);
      row = { container, root };
      signalMarkerRootsRef.current.set(id, row);
    }
    return row;
  }, []);

  const htmlElement = useCallback(
    (obj: object) => {
      const d = obj as GlobeSignalMarker;
      const { container, root } = ensureSignalMarkerHost(d.id);
      root.render(
        <SignalMapDot
          r={d.r}
          dotScale={d.dotScale}
          renderColor={d.renderColor}
          dimmed={d.dimmed}
          score={d.score}
          isSelected={d.isSelected}
        />,
      );
      return container;
    },
    [ensureSignalMarkerHost],
  );

  const htmlElementVisibilityModifier = useCallback((el: HTMLElement, isVisible: boolean) => {
    el.style.opacity = isVisible ? "1" : "0";
  }, []);

  useEffect(() => {
    const keep = new Set(signalMarkers.map((m) => m.id));
    for (const [id, host] of [...signalMarkerRootsRef.current.entries()]) {
      if (!keep.has(id)) {
        host.root.unmount();
        signalMarkerRootsRef.current.delete(id);
      }
    }
    for (const d of signalMarkers) {
      const host = signalMarkerRootsRef.current.get(d.id);
      if (!host) continue;
      host.root.render(
        <SignalMapDot
          r={d.r}
          dotScale={d.dotScale}
          renderColor={d.renderColor}
          dimmed={d.dimmed}
          score={d.score}
          isSelected={d.isSelected}
        />,
      );
    }
  }, [signalMarkers]);

  const pickPoints = useMemo<GlobeSignalPickPoint[]>(() => {
    return signals.map((signal) => {
      const score = signal.resilienceScore;
      const relevant = selectedCompany
        ? isRelevantToCompany(`${signal.title} ${signal.description}`, selectedCompany)
        : false;
      const isSelected = signal.id === selectedSignalId;
      const baseR = globeSignalRadiusDeg({
        score,
        relevant,
        cameraAltitude: signalViewAltitude,
        isSelected,
      });
      const pickRadius = Math.min(0.55, Math.max(0.045, baseR * 2.2));
      const pos = spreadPositions.get(signal.id)!;
      return {
        ...signal,
        lat: pos.lat,
        lng: pos.lng,
        altitudeExtra: pos.altitudeExtra,
        pickRadius,
      };
    });
  }, [signals, spreadPositions, selectedCompany, selectedSignalId, signalViewAltitude]);

  useEffect(() => {
    return () => {
      for (const [, host] of signalMarkerRootsRef.current) {
        host.root.unmount();
      }
      signalMarkerRootsRef.current.clear();
    };
  }, []);

  return (
    <div ref={containerRef} className="w-full h-full bg-background relative overflow-hidden">
      <Globe
        ref={globeRef}
        width={viewport.width}
        height={viewport.height}
        backgroundColor="rgba(0,0,0,0)"
        showGlobe
        showAtmosphere
        atmosphereColor="#8ab4ff"
        atmosphereAltitude={0.1}
        onGlobeReady={onGlobeReady}
        onZoom={handleZoom}
        pointerEventsFilter={pointerEventsFilter}
        showPointerCursor={showPointerCursor}
        polygonsData={countries}
        polygonCapColor={polygonCapColor}
        polygonSideColor={polygonSideColor}
        polygonStrokeColor={polygonStrokeColor}
        polygonStrokeWidth={polygonStrokeWidthAccessor}
        polygonAltitude={0.004}
        polygonsTransitionDuration={0}
        onPolygonClick={onPolygonClick}
        labelsData={labels}
        labelLat="lat"
        labelLng="lng"
        labelText="text"
        labelColor={labelColor}
        labelSize={labelSizeAccessor}
        labelAltitude={LABEL_ALTITUDE}
        labelDotRadius={0}
        labelIncludeDot={false}
        labelResolution={labelResolution}
        labelsTransitionDuration={0}
        htmlElementsData={signalMarkers}
        htmlLat="lat"
        htmlLng="lng"
        htmlAltitude={(d) => SIGNAL_DOT_ALTITUDE + (d as GlobeSignalMarker).altitudeExtra}
        htmlElement={htmlElement}
        htmlElementVisibilityModifier={htmlElementVisibilityModifier}
        htmlTransitionDuration={0}
        pointsData={pickPoints}
        pointLat="lat"
        pointLng="lng"
        pointColor="rgba(0,0,0,0.02)"
        pointAltitude={(d) => SIGNAL_DOT_ALTITUDE + (d as GlobeSignalPickPoint).altitudeExtra}
        pointRadius="pickRadius"
        pointResolution={12}
        pointLabel={pickPointLabel}
        onPointClick={onPointClick}
        pointsTransitionDuration={0}
      />
    </div>
  );
});

GlobeMap.displayName = "GlobeMap";

export default GlobeMap;
