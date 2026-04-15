import { useState, useCallback, useRef, useEffect, memo } from "react";
import {
  ComposableMap,
  ZoomableGroup,
  Geographies,
  Geography,
  Marker,
} from "react-simple-maps";
import { geoCentroid, geoBounds } from "d3-geo";
import { DOMAINS } from "@/data/domains";
import { COMPANIES, CompanyId } from "@/data/companies";
import { WORLD_CITIES } from "@/data/capitals";
import { DomainId, MindsetId } from "@/data/types";
import { GenZCategoryId } from "@/data/genzTypes";
import { UnifiedSignal } from "@/data/unifiedSignalTypes";
import { DashboardMode } from "./DashboardLayout";
import { Plus, Minus } from "lucide-react";

const GEO_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-50m.json";

interface Props {
  mode: DashboardMode;
  activeDomains: DomainId[];
  activeMindset: MindsetId;
  activeCategories: GenZCategoryId[];
  selectedCompany: CompanyId | null;
  onSignalClick: (signal: UnifiedSignal) => void;
  onCountryClick: (countryName: string, geo: any) => void;
  selectedSignalId: string | null;
  selectedCountry: string | null;
  signals: UnifiedSignal[];
}

const GENZ_COLOR = "#1ab5a5";
const MIN_ZOOM = 1;
const MAX_ZOOM = 20;
const ZOOM_STEP = 1.18;

const LNG_BOUNDS: [number, number] = [-180, 180];
const LAT_BOUNDS: [number, number] = [-60, 85];

function softClamp(value: number, min: number, max: number, elasticity: number = 0.22): number {
  if (value < min) return min + (value - min) * elasticity;
  if (value > max) return max + (value - max) * elasticity;
  return value;
}

function clampCoords(coords: [number, number], zoom: number): [number, number] {
  const lngRange = 180 / zoom;
  const latRange = 70 / zoom;
  return [
    softClamp(coords[0], LNG_BOUNDS[0] + lngRange, LNG_BOUNDS[1] - lngRange),
    softClamp(coords[1], LAT_BOUNDS[0] + latRange, LAT_BOUNDS[1] - latRange),
  ];
}

function isRelevantToCompany(text: string, companyId: CompanyId): boolean {
  const company = COMPANIES.find((c) => c.id === companyId);
  if (!company) return false;
  const lower = text.toLowerCase();
  return company.keywords.some((kw) => lower.includes(kw.toLowerCase()));
}

const COUNTRY_ALIASES: Record<string, string[]> = {
  "United States of America": ["USA", "United States", "US", "San Francisco", "New York", "Los Angeles", "Chicago"],
  "United Kingdom": ["UK", "London", "England", "Britain"],
  "Japan": ["Tokyo", "Osaka", "Kyoto", "Nagoya", "Fukuoka", "Sendai", "Sapporo", "Hiroshima", "Akihabara", "Roppongi", "Shibuya"],
  "Germany": ["Berlin", "Munich"],
  "France": ["Paris"],
  "Brazil": ["São Paulo", "Rio"],
  "India": ["Mumbai", "Bangalore", "Delhi"],
  "China": ["Beijing", "Shanghai", "Shenzhen"],
  "South Korea": ["Seoul"],
  "Australia": ["Melbourne", "Sydney"],
  "Indonesia": ["Jakarta", "Bali"],
  "Nigeria": ["Lagos"],
  "Kenya": ["Nairobi"],
  "Thailand": ["Bangkok"],
  "Vietnam": ["Ho Chi Minh"],
  "Egypt": ["Cairo"],
  "South Africa": ["Johannesburg", "Cape Town"],
  "Colombia": ["Bogotá"],
  "Chile": ["Santiago"],
  "Argentina": ["Buenos Aires"],
  "Philippines": ["Manila"],
  "Singapore": ["Singapore"],
  "Netherlands": ["Amsterdam"],
  "Sweden": ["Stockholm"],
  "Belgium": ["Brussels"],
  "Denmark": ["Copenhagen"],
  "Ghana": ["Accra"],
  "Kazakhstan": ["Almaty"],
  "United Arab Emirates": ["Dubai", "UAE"],
  "Peru": ["Lima"],
};

const LABEL_OVERRIDES: Record<string, [number, number]> = {
  "United States of America": [-98, 39],
  "Russia": [100, 60],
  "Canada": [-106, 56],
  "France": [2, 47],
  "Norway": [9, 62],
  "Indonesia": [118, -2],
  "Malaysia": [109, 4],
  "Chile": [-71, -33],
  "New Zealand": [174, -41],
};

const DISPLAY_NAMES: Record<string, string> = {
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

const COUNTRY_TIERS: Record<string, number> = {
  "Russia": 1, "China": 1, "United States of America": 1, "Canada": 1,
  "Brazil": 1, "Australia": 1, "India": 1, "Japan": 1,
  "Argentina": 2, "Mexico": 2, "Indonesia": 2, "Saudi Arabia": 2,
  "Germany": 2, "France": 2, "United Kingdom": 2, "Turkey": 2,
  "Iran": 2, "Egypt": 2, "South Africa": 2, "Nigeria": 2,
  "Kazakhstan": 2, "Algeria": 2, "Libya": 2, "Sudan": 2,
  "Colombia": 2, "Peru": 2, "Mongolia": 2, "Pakistan": 2,
  "Congo": 2, "Dem. Rep. Congo": 2, "Democratic Republic of the Congo": 2,
  "Ethiopia": 2, "Angola": 2, "Mali": 2, "Niger": 2,
  "Chad": 2, "Tanzania": 2, "Mozambique": 2, "Zambia": 2,
  "Myanmar": 2, "Afghanistan": 2, "Somalia": 2, "Madagascar": 2,
  "Kenya": 2, "Morocco": 2,
  "Spain": 3, "Italy": 3, "Poland": 3, "Ukraine": 3, "Romania": 3,
  "Sweden": 3, "Norway": 3, "Finland": 3, "Thailand": 3, "Vietnam": 3,
  "Philippines": 3, "Malaysia": 3, "South Korea": 3, "Iraq": 3,
  "Chile": 3, "Venezuela": 3, "Ecuador": 3, "Bolivia": 3,
  "Paraguay": 3, "Uruguay": 3, "Cuba": 3, "New Zealand": 3,
  "Ghana": 3, "Ivory Coast": 3, "Côte d'Ivoire": 3, "Cameroon": 3,
  "Zimbabwe": 3, "Botswana": 3, "Namibia": 3, "Senegal": 3,
  "Guinea": 3, "Uganda": 3, "Uzbekistan": 3, "Turkmenistan": 3,
  "Bangladesh": 3, "Nepal": 3, "Sri Lanka": 3, "Laos": 3, "Cambodia": 3,
  "Papua New Guinea": 3, "Gabon": 3,
};

const WATERMARK_COUNTRIES = new Set([
  "Russia", "Canada", "United States of America", "China", "Brazil",
  "Australia", "India", "Argentina", "Kazakhstan", "Algeria",
  "Saudi Arabia", "Mexico", "Indonesia", "Sudan", "Libya",
  "Iran", "Mongolia", "Peru", "Chad", "Niger",
  "Angola", "Mali", "South Africa", "Colombia", "Ethiopia",
  "Bolivia", "Egypt", "Nigeria", "Tanzania", "Turkey",
]);

function getCountryTier(name: string): number { return COUNTRY_TIERS[name] || 4; }
function getMinZoomForTier(tier: number): number {
  switch (tier) { case 1: return 1.3; case 2: return 2; case 3: return 3.5; default: return 6; }
}
function getCityMinZoom(tier: 1 | 2 | 3 | 4): number {
  switch (tier) { case 1: return 3; case 2: return 4; case 3: return 5; case 4: return 6.5; }
}

function calcCountryZoom(geo: any): number {
  const bounds = geoBounds(geo);
  const lngSpan = Math.abs(bounds[1][0] - bounds[0][0]);
  const latSpan = Math.abs(bounds[1][1] - bounds[0][1]);
  const maxSpan = Math.max(lngSpan, latSpan);
  return Math.min(MAX_ZOOM, Math.max(2, 120 / maxSpan));
}

function getSignalColor(signal: UnifiedSignal): string {
  if (signal.layer === "genz") return GENZ_COLOR;
  if (signal.layer === "live-news") return signal.category ? "#ff6701" : "#3b82f6";
  if (signal.domain) {
    const domain = DOMAINS.find(d => d.id === signal.domain);
    return domain?.color || "hsl(38, 90%, 55%)";
  }
  return "#3b82f6";
}

const GlobalMap = memo(({
  mode,
  activeDomains,
  activeMindset,
  activeCategories,
  selectedCompany,
  onSignalClick,
  onCountryClick,
  selectedSignalId,
  selectedCountry,
  signals,
}: Props) => {
  const [position, setPosition] = useState<{ coordinates: [number, number]; zoom: number }>({
    coordinates: [30, 20], zoom: 1.5,
  });
  const [liveZoom, setLiveZoom] = useState(1.5);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; title: string; location: string; urgency: string; score: number } | null>(null);
  const positionRef = useRef({ coordinates: [30, 20] as [number, number], zoom: 1.5 });
  const targetZoomRef = useRef(1.5);
  const animFrameRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const showTooltip = useCallback((e: React.MouseEvent, title: string, location: string, urgency: string, score: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setTooltip({ x: e.clientX - rect.left + 12, y: e.clientY - rect.top - 10, title, location, urgency, score });
  }, []);
  const hideTooltip = useCallback(() => setTooltip(null), []);

  const clampZoom = (z: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));

  const animateToPosition = useCallback((target: { coordinates: [number, number]; zoom: number }, easing: number = 0.08) => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    const step = () => {
      const prev = positionRef.current;
      const lngDiff = target.coordinates[0] - prev.coordinates[0];
      const latDiff = target.coordinates[1] - prev.coordinates[1];
      const zoomDiff = target.zoom - prev.zoom;
      if (Math.abs(lngDiff) < 0.02 && Math.abs(latDiff) < 0.02 && Math.abs(zoomDiff) < 0.005) {
        animFrameRef.current = null;
        positionRef.current = target;
        setPosition(target);
        setLiveZoom(target.zoom);
        return;
      }
      const next = {
        coordinates: [prev.coordinates[0] + lngDiff * easing, prev.coordinates[1] + latDiff * easing] as [number, number],
        zoom: prev.zoom + zoomDiff * easing,
      };
      positionRef.current = next;
      setPosition(next);
      setLiveZoom(next.zoom);
      animFrameRef.current = requestAnimationFrame(step);
    };
    animFrameRef.current = requestAnimationFrame(step);
  }, []);

  const zoomToCountry = useCallback((geo: any) => {
    const centroid = geoCentroid(geo) as [number, number];
    const zoom = calcCountryZoom(geo);
    targetZoomRef.current = zoom;
    animateToPosition({ coordinates: centroid, zoom }, 0.06);
  }, [animateToPosition]);

  const zoomToGlobal = useCallback(() => {
    const target = { coordinates: [30, 20] as [number, number], zoom: 1.5 };
    targetZoomRef.current = 1.5;
    animateToPosition(target, 0.06);
  }, [animateToPosition]);

  const panToSignal = useCallback((coords: [number, number]) => {
    const current = positionRef.current;
    const lngOffset = -12 / Math.max(1, current.zoom);
    const target = {
      coordinates: [coords[0] + lngOffset, coords[1]] as [number, number],
      zoom: Math.max(current.zoom, 2),
    };
    targetZoomRef.current = target.zoom;
    animateToPosition(target, 0.06);
  }, [animateToPosition]);

  const zoomToCountryRef = useRef(zoomToCountry);
  const zoomToGlobalRef = useRef(zoomToGlobal);
  zoomToCountryRef.current = zoomToCountry;
  zoomToGlobalRef.current = zoomToGlobal;

  const prevSelectedCountry = useRef(selectedCountry);
  useEffect(() => {
    if (prevSelectedCountry.current && !selectedCountry) zoomToGlobalRef.current();
    prevSelectedCountry.current = selectedCountry;
  }, [selectedCountry]);

  const handleMove = useCallback((pos: any) => {
    const zoom = pos.zoom ?? pos.k ?? positionRef.current.zoom;
    setLiveZoom(zoom);
    targetZoomRef.current = zoom;
  }, []);

  const handleMoveEnd = useCallback((pos: { coordinates: [number, number]; zoom: number }) => {
    const clampedCoords = clampCoords(pos.coordinates, pos.zoom);
    positionRef.current = { coordinates: pos.coordinates, zoom: pos.zoom };
    setPosition({ coordinates: pos.coordinates, zoom: pos.zoom });
    setLiveZoom(pos.zoom);
    targetZoomRef.current = pos.zoom;
    const needsSettle = Math.abs(clampedCoords[0] - pos.coordinates[0]) > 0.02 || Math.abs(clampedCoords[1] - pos.coordinates[1]) > 0.02;
    if (needsSettle) animateToPosition({ coordinates: clampedCoords, zoom: pos.zoom }, 0.07);
  }, [animateToPosition]);

  const animateZoom = useCallback((targetZoom: number) => {
    targetZoomRef.current = targetZoom;
    const current = positionRef.current;
    animateToPosition({ coordinates: clampCoords(current.coordinates, targetZoom), zoom: targetZoom }, 0.07);
  }, [animateToPosition]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const prevent = (e: Event) => { e.preventDefault(); e.stopPropagation(); };
    const handleWheel = (e: WheelEvent) => { if (e.ctrlKey) e.preventDefault(); };
    el.addEventListener('wheel', handleWheel, { passive: false });
    el.addEventListener('gesturestart', prevent);
    el.addEventListener('gesturechange', prevent);
    el.addEventListener('gestureend', prevent);
    return () => {
      el.removeEventListener('wheel', handleWheel);
      el.removeEventListener('gesturestart', prevent);
      el.removeEventListener('gesturechange', prevent);
      el.removeEventListener('gestureend', prevent);
    };
  }, []);

  const zoomIn = useCallback(() => animateZoom(clampZoom(targetZoomRef.current * ZOOM_STEP)), [animateZoom]);
  const zoomOut = useCallback(() => animateZoom(clampZoom(targetZoomRef.current / ZOOM_STEP)), [animateZoom]);

  const dotScale = 1 / liveZoom;
  const labelFontSize = Math.max(0.6, 5 / Math.pow(liveZoom, 1.05));
  const capitalFontSize = Math.max(0.5, 4 / Math.pow(liveZoom, 1.05));
  const capitalDotR = Math.max(0.4, 1.2 * dotScale);
  const currentZoom = liveZoom;

  const handleCountryClickCb = useCallback((geo: any) => {
    const name = geo.properties?.name || geo.properties?.NAME;
    if (name) {
      zoomToCountryRef.current(geo);
      onCountryClick(name, geo);
    }
  }, [onCountryClick]);

  return (
    <div ref={containerRef} className="w-full h-full bg-background relative">
      {/* Zoom controls */}
      <div className="absolute bottom-3 right-3 z-10 flex flex-col gap-0.5">
        <button onClick={zoomIn} className="w-7 h-7 flex items-center justify-center bg-[rgba(6,10,12,0.85)] backdrop-blur-sm border border-border rounded-sm text-foreground hover:text-primary transition-colors" aria-label="Zoom in"><Plus size={14} /></button>
        <button onClick={zoomOut} className="w-7 h-7 flex items-center justify-center bg-[rgba(6,10,12,0.85)] backdrop-blur-sm border border-border rounded-sm text-foreground hover:text-primary transition-colors" aria-label="Zoom out"><Minus size={14} /></button>
      </div>

      <ComposableMap projection="geoMercator" projectionConfig={{ scale: 140, center: [0, 20] }} style={{ width: "100%", height: "100%" }}>
        <ZoomableGroup
          center={position.coordinates}
          zoom={position.zoom}
          onMove={handleMove}
          onMoveEnd={handleMoveEnd}
          minZoom={MIN_ZOOM}
          maxZoom={MAX_ZOOM}
          translateExtent={[[-200, -100], [1200, 700]]}
          filterZoomEvent={() => true}
        >
          <Geographies geography={GEO_URL}>
            {({ geographies }) => (
              <>
                {geographies.map((geo) => {
                  const geoName = geo.properties?.name || geo.properties?.NAME || "";
                  const isSelected = selectedCountry === geoName || (selectedCountry && COUNTRY_ALIASES[geoName]?.some(a => a === selectedCountry));
                  const isJapanGeo = geoName === "Japan";
                  const baseFill = isSelected ? "#1a2a35" : isJapanGeo ? "hsl(220, 14%, 18%)" : "hsl(220, 14%, 16%)";
                  const baseStroke = isSelected ? "rgba(18, 65, 234, 0.6)" : "hsl(220, 14%, 22%)";
                  return (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      onClick={() => handleCountryClickCb(geo)}
                      fill={baseFill}
                      stroke={baseStroke}
                      strokeWidth={isSelected ? 1.5 / currentZoom : 0.5 / Math.max(1, currentZoom * 0.5)}
                      style={{
                        default: { outline: "none", cursor: "pointer" },
                        hover: { fill: isSelected ? "#1a2a35" : "hsl(220, 14%, 22%)", outline: "none", cursor: "pointer" },
                        pressed: { fill: "hsl(220, 14%, 26%)", outline: "none" },
                      }}
                    />
                  );
                })}

                {/* Watermark country labels */}
                {(() => {
                  const watermarkFontSize = Math.max(1.5, 8 / Math.pow(liveZoom, 0.9));
                  return geographies
                    .filter(geo => WATERMARK_COUNTRIES.has(geo.properties?.name || geo.properties?.NAME || ""))
                    .map(geo => {
                      const name = geo.properties?.name || geo.properties?.NAME || "";
                      const override = LABEL_OVERRIDES[name];
                      const centroid = override || geoCentroid(geo) as [number, number];
                      if (!centroid || (centroid[0] === 0 && centroid[1] === 0)) return null;
                      const displayName = DISPLAY_NAMES[name] || name;
                      const opacity = currentZoom < 1.3 ? 0.3 : Math.max(0, 0.3 - (currentZoom - 1.3) * 0.15);
                      if (opacity <= 0.02) return null;
                      return (
                        <Marker key={`wm-${geo.rsmKey}`} coordinates={centroid}>
                          <text textAnchor="middle" dy="0.35em" style={{
                            fontFamily: "'Georgia', 'Times New Roman', serif",
                            fill: "hsl(220, 10%, 35%)", fontSize: `${watermarkFontSize}px`,
                            fontWeight: 400, letterSpacing: "0.15em", textTransform: "uppercase",
                            pointerEvents: "none", userSelect: "none", opacity, transition: "opacity 0.5s",
                          }}>{displayName}</text>
                        </Marker>
                      );
                    });
                })()}

                {/* Country labels — progressive reveal */}
                {(() => {
                  const candidates = geographies.map(geo => {
                    const geoName = geo.properties?.name || geo.properties?.NAME || "";
                    if (!geoName) return null;
                    const tier = getCountryTier(geoName);
                    const minZoom = getMinZoomForTier(tier);
                    if (currentZoom < minZoom) return null;
                    const override = LABEL_OVERRIDES[geoName];
                    const centroid = override || geoCentroid(geo) as [number, number];
                    if (!centroid || (centroid[0] === 0 && centroid[1] === 0)) return null;
                    const displayName = DISPLAY_NAMES[geoName] || geoName;
                    const fadeRange = minZoom * 0.3;
                    const opacity = Math.min(1, (currentZoom - minZoom) / fadeRange + 0.5);
                    return { geo, geoName, tier, centroid, displayName, opacity };
                  }).filter(Boolean) as Array<{ geo: any; geoName: string; tier: number; centroid: [number, number]; displayName: string; opacity: number }>;

                  candidates.sort((a, b) => a.tier - b.tier);
                  const charWidthDeg = (labelFontSize * 0.6) / currentZoom;
                  const labelHeightDeg = (labelFontSize * 1.4) / currentZoom;
                  const placed: Array<{ x: number; y: number; w: number; h: number }> = [];
                  const visible: typeof candidates = [];
                  for (const c of candidates) {
                    const w = c.displayName.length * charWidthDeg;
                    const h = labelHeightDeg;
                    const x = c.centroid[0] - w / 2;
                    const y = c.centroid[1] - h / 2;
                    const overlaps = placed.some(p => x < p.x + p.w && x + w > p.x && y < p.y + p.h && y + h > p.y);
                    if (!overlaps) { placed.push({ x, y, w, h }); visible.push(c); }
                  }
                  return visible.map(c => (
                    <Marker key={`label-${c.geo.rsmKey}`} coordinates={c.centroid}>
                      <text textAnchor="middle" dy="0.35em" style={{
                        fontFamily: "'Noto Sans JP', system-ui, sans-serif",
                        fill: "hsl(220, 10%, 42%)", fontSize: `${labelFontSize}px`,
                        fontWeight: 500, pointerEvents: "none", userSelect: "none",
                        opacity: c.opacity, transition: "opacity 0.3s",
                      }}>{c.displayName}</text>
                    </Marker>
                  ));
                })()}
              </>
            )}
          </Geographies>

          {/* City markers */}
          {currentZoom >= 3 && WORLD_CITIES.map(city => {
            const minZoom = getCityMinZoom(city.tier);
            if (currentZoom < minZoom) return null;
            const fadeProgress = Math.min(1, (currentZoom - minZoom) / 1);
            return (
              <Marker key={`city-${city.name}-${city.country}`} coordinates={city.coordinates}>
                <circle r={city.isCapital ? capitalDotR * 1.2 : capitalDotR} fill={city.isCapital ? "hsl(220, 20%, 60%)" : "hsl(220, 10%, 50%)"} opacity={fadeProgress * 0.8} />
                <text textAnchor="start" x={capitalDotR + 1.5 * dotScale} dy="0.3em" style={{
                  fontFamily: "'Noto Sans JP', system-ui, sans-serif",
                  fill: city.isCapital ? "hsl(220, 15%, 60%)" : "hsl(220, 10%, 50%)",
                  fontSize: `${city.isCapital ? capitalFontSize * 1.1 : capitalFontSize * 0.9}px`,
                  fontWeight: city.isCapital ? 500 : 400, fontStyle: city.isCapital ? "normal" : "italic",
                  pointerEvents: "none", userSelect: "none", opacity: fadeProgress * 0.7, transition: "opacity 0.3s",
                }}>{city.name}</text>
              </Marker>
            );
          })}

          {/* UNIFIED SIGNAL DOTS */}
          {signals.map(signal => {
            const color = getSignalColor(signal);
            const score = signal.resilienceScore;
            const relevant = selectedCompany ? isRelevantToCompany(`${signal.title} ${signal.description}`, selectedCompany) : false;
            const dimmed = !!(selectedCompany && !relevant && signal.layer !== "live-news");

            const urgencyMultiplier = score >= 9 ? 2.0 : score >= 7 ? 1.5 : score >= 4 ? 1.0 : 0.7;
            const isCritical = score >= 9;
            const isHigh = score >= 7;
            const urgencyLabel = signal.urgency.charAt(0).toUpperCase() + signal.urgency.slice(1);

            const baseR = (relevant ? 5 : 3.5) * urgencyMultiplier;
            const r = baseR * dotScale;
            const isSelected = selectedSignalId === signal.id;

            return (
              <Marker
                key={signal.id}
                coordinates={signal.coordinates}
                onClick={() => { onSignalClick(signal); panToSignal(signal.coordinates); }}
                style={{ cursor: "pointer" }}
              >
                {isCritical && !dimmed && (
                  <circle r={r * 3} fill={color} opacity={0}>
                    <animate attributeName="r" from={String(r * 1.5)} to={String(r * 4)} dur="2s" repeatCount="indefinite" />
                    <animate attributeName="opacity" from="0.25" to="0" dur="2s" repeatCount="indefinite" />
                  </circle>
                )}
                {isHigh && !isCritical && !dimmed && (
                  <circle r={r * 2.2} fill={color} opacity={0.12} />
                )}
                <circle r={r * 2} fill={color} opacity={dimmed ? 0.04 : 0.15} />
                <circle
                  r={r}
                  fill={color}
                  stroke={color}
                  strokeWidth={1 * dotScale}
                  opacity={dimmed ? 0.45 : score < 4 ? 0.55 : 1}
                  style={{ transition: "r 150ms ease, opacity 150ms ease" }}
                  onMouseEnter={(e) => {
                    e.currentTarget.setAttribute("r", String(r * 1.3));
                    const glow = e.currentTarget.previousElementSibling as SVGCircleElement | null;
                    if (glow) glow.setAttribute("opacity", "0.3");
                    showTooltip(e as any, signal.title, signal.location, urgencyLabel, score);
                  }}
                  onMouseMove={(e) => showTooltip(e as any, signal.title, signal.location, urgencyLabel, score)}
                  onMouseLeave={(e) => {
                    e.currentTarget.setAttribute("r", String(r));
                    const glow = e.currentTarget.previousElementSibling as SVGCircleElement | null;
                    if (glow) glow.setAttribute("opacity", "0.15");
                    hideTooltip();
                  }}
                />
                {isSelected && (
                  <>
                    <circle r={r * 2.5} fill="none" stroke="#1241ea" strokeWidth={1.5 * dotScale} opacity={0.7}>
                      <animate attributeName="r" from={String(r * 2.2)} to={String(r * 3)} dur="1.5s" repeatCount="indefinite" />
                      <animate attributeName="opacity" from="0.7" to="0.2" dur="1.5s" repeatCount="indefinite" />
                    </circle>
                    <circle r={r * 2} fill="none" stroke="#1241ea" strokeWidth={1 * dotScale} opacity={0.9} />
                  </>
                )}
              </Marker>
            );
          })}
        </ZoomableGroup>
      </ComposableMap>

      {/* Tooltip overlay */}
      {tooltip && (
        <div className="absolute z-50 pointer-events-none" style={{ left: tooltip.x, top: tooltip.y, transform: "translateY(-100%)" }}>
          <div className="bg-card/95 backdrop-blur-sm border border-border rounded-sm px-2.5 py-1.5 max-w-[220px]">
            <p className="text-[10px] font-bold text-foreground leading-tight truncate">{tooltip.title}</p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[9px] font-mono text-muted-foreground">{tooltip.location}</span>
              <span className="text-[8px] font-mono font-bold uppercase tracking-wider text-primary">{tooltip.urgency}</span>
            </div>
            <div className="flex items-center gap-1 mt-0.5">
              <span className="text-[8px] font-mono text-muted-foreground">RE:</span>
              <span className="text-[9px] font-mono font-bold text-primary">{tooltip.score}/10</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

GlobalMap.displayName = "GlobalMap";

export default GlobalMap;

export { COUNTRY_ALIASES };
