import { useState, useCallback, useRef, useEffect, memo } from "react";
import {
  ComposableMap,
  ZoomableGroup,
  Geographies,
  Geography,
  Marker,
} from "react-simple-maps";
import { geoCentroid } from "d3-geo";
import { SIGNALS } from "@/data/signals";
import { GENZ_SIGNALS } from "@/data/genzSignals";
import { DOMAINS } from "@/data/domains";
import { COMPANIES, CompanyId } from "@/data/companies";
import { DomainId, MindsetId, ResilienceSignal } from "@/data/types";
import { GenZCategoryId, GenZSignal } from "@/data/genzTypes";
import { DashboardMode } from "./DashboardLayout";
import { Plus, Minus } from "lucide-react";

const GEO_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

interface Props {
  mode: DashboardMode;
  activeDomains: DomainId[];
  activeMindset: MindsetId;
  activeCategories: GenZCategoryId[];
  selectedCompany: CompanyId | null;
  onSignalClick: (signal: ResilienceSignal | GenZSignal, mode: DashboardMode) => void;
  onCountryClick: (countryName: string) => void;
  selectedSignalId: string | null;
  selectedCountry: string | null;
}

const GENZ_COLOR = "#1ab5a5";
const MIN_ZOOM = 1.3;
const MAX_ZOOM = 20;
const ZOOM_STEP = 1.18;

// Pan boundaries (lng/lat) — soft clamp prevents panning beyond Earth
const LNG_BOUNDS: [number, number] = [-180, 180];
const LAT_BOUNDS: [number, number] = [-60, 85];

// Soft clamp with elastic resistance instead of a hard stop
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

// Tier system: countries appear at different zoom levels based on size/importance
// Tier 1 (zoom >= 1.3): Major countries always visible
// Tier 2 (zoom >= 2): Medium countries
// Tier 3 (zoom >= 3.5): Smaller countries
// Tier 4 (zoom >= 6): Tiny countries
const COUNTRY_TIERS: Record<string, number> = {
  // Tier 1 — always visible
  "Russia": 1, "China": 1, "United States of America": 1, "Canada": 1,
  "Brazil": 1, "Australia": 1, "India": 1, "Japan": 1,
  // Tier 2
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
  // Tier 3
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
  // Tier 4 — everything else
};

function getCountryTier(name: string): number {
  return COUNTRY_TIERS[name] || 4;
}

function getMinZoomForTier(tier: number): number {
  switch (tier) {
    case 1: return 1.3;
    case 2: return 2;
    case 3: return 3.5;
    default: return 6;
  }
}

function getShortTitle(title: string): string {
  const words = title.split(" ");
  if (words.length <= 4) return title;
  return words.slice(0, 4).join(" ") + "…";
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
}: Props) => {
  const [position, setPosition] = useState<{ coordinates: [number, number]; zoom: number }>({
    coordinates: [30, 20],
    zoom: 1.5,
  });
  const positionRef = useRef<{ coordinates: [number, number]; zoom: number }>({
    coordinates: [30, 20],
    zoom: 1.5,
  });
  const targetZoomRef = useRef(1.5);
  const animFrameRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const clampZoom = (z: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));

  const animateToPosition = useCallback((target: { coordinates: [number, number]; zoom: number }, easing: number = 0.08) => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);

    const step = () => {
      setPosition((prev) => {
        const lngDiff = target.coordinates[0] - prev.coordinates[0];
        const latDiff = target.coordinates[1] - prev.coordinates[1];
        const zoomDiff = target.zoom - prev.zoom;

        if (Math.abs(lngDiff) < 0.02 && Math.abs(latDiff) < 0.02 && Math.abs(zoomDiff) < 0.005) {
          animFrameRef.current = null;
          positionRef.current = target;
          return target;
        }

        const next = {
          coordinates: [
            prev.coordinates[0] + lngDiff * easing,
            prev.coordinates[1] + latDiff * easing,
          ] as [number, number],
          zoom: prev.zoom + zoomDiff * easing,
        };

        positionRef.current = next;
        animFrameRef.current = requestAnimationFrame(step);
        return next;
      });
    };

    animFrameRef.current = requestAnimationFrame(step);
  }, []);

  const handleMoveEnd = useCallback((pos: { coordinates: [number, number]; zoom: number }) => {
    const clampedCoords = clampCoords(pos.coordinates, pos.zoom);
    const next = { coordinates: pos.coordinates, zoom: pos.zoom };
    positionRef.current = next;
    setPosition(next);
    targetZoomRef.current = pos.zoom;

    const needsSettle =
      Math.abs(clampedCoords[0] - pos.coordinates[0]) > 0.02 ||
      Math.abs(clampedCoords[1] - pos.coordinates[1]) > 0.02;

    if (needsSettle) {
      animateToPosition({ coordinates: clampedCoords, zoom: pos.zoom }, 0.07);
    }
  }, [animateToPosition]);

  const animateZoom = useCallback((targetZoom: number) => {
    targetZoomRef.current = targetZoom;
    const current = positionRef.current;
    animateToPosition(
      {
        coordinates: clampCoords(current.coordinates, targetZoom),
        zoom: targetZoom,
      },
      0.07,
    );
  }, [animateToPosition]);

  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // ctrlKey is set by trackpad pinch-to-zoom in browsers
    if (e.ctrlKey) {
      const direction = e.deltaY < 0 ? 1.04 : 0.96;
      const newTarget = clampZoom(targetZoomRef.current * direction);
      animateZoom(newTarget);
    } else {
      const direction = e.deltaY < 0 ? 1.03 : 0.97;
      const newTarget = clampZoom(targetZoomRef.current * direction);
      animateZoom(newTarget);
    }
  }, [animateZoom]);

  // Prevent native browser pinch-to-zoom and gesture events on the map container
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const preventGesture = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
    };

    // Wheel with { passive: false } to allow preventDefault
    el.addEventListener('wheel', handleWheel, { passive: false });
    // Safari gesture events
    el.addEventListener('gesturestart', preventGesture);
    el.addEventListener('gesturechange', preventGesture);
    el.addEventListener('gestureend', preventGesture);
    // Prevent touch zoom (pinch)
    el.addEventListener('touchmove', (e: TouchEvent) => {
      if (e.touches.length > 1) e.preventDefault();
    }, { passive: false });

    return () => {
      el.removeEventListener('wheel', handleWheel);
      el.removeEventListener('gesturestart', preventGesture);
      el.removeEventListener('gesturechange', preventGesture);
      el.removeEventListener('gestureend', preventGesture);
    };
  }, [handleWheel]);

  const zoomIn = useCallback(() => {
    const newTarget = clampZoom(targetZoomRef.current * ZOOM_STEP);
    animateZoom(newTarget);
  }, [animateZoom]);

  const zoomOut = useCallback(() => {
    const newTarget = clampZoom(targetZoomRef.current / ZOOM_STEP);
    animateZoom(newTarget);
  }, [animateZoom]);

  const dotScale = 1 / position.zoom;
  const labelFontSize = Math.max(3, 7 * dotScale);

  const resilienceFiltered = mode === "resilience"
    ? SIGNALS.filter((s) => activeDomains.includes(s.domain))
    : [];
  const genzFiltered = mode === "genz"
    ? GENZ_SIGNALS.filter((s) => activeCategories.includes(s.category))
    : [];

  const handleCountryClickCb = useCallback((geo: any) => {
    const name = geo.properties?.name || geo.properties?.NAME;
    if (name) onCountryClick(name);
  }, [onCountryClick]);

  const currentZoom = position.zoom;

  return (
    <div
      ref={containerRef}
      className="w-full h-full bg-background relative touch-none"
    >
      {/* Zoom level indicator */}
      <div className="absolute top-3 left-3 z-10 bg-background/80 backdrop-blur-sm border border-border rounded-md px-2 py-1 text-xs font-mono text-muted-foreground">
        {position.zoom.toFixed(1)}x
      </div>

      {/* Zoom controls */}
      <div className="absolute bottom-4 right-4 z-10 flex flex-col gap-1">
        <button
          onClick={zoomIn}
          className="w-8 h-8 flex items-center justify-center bg-background/80 backdrop-blur-sm border border-border rounded-md text-foreground hover:bg-accent transition-colors"
          aria-label="Zoom in"
        >
          <Plus size={16} />
        </button>
        <button
          onClick={zoomOut}
          className="w-8 h-8 flex items-center justify-center bg-background/80 backdrop-blur-sm border border-border rounded-md text-foreground hover:bg-accent transition-colors"
          aria-label="Zoom out"
        >
          <Minus size={16} />
        </button>
      </div>

      <ComposableMap
        projection="geoMercator"
        projectionConfig={{ scale: 140, center: [0, 20] }}
        style={{ width: "100%", height: "100%" }}
      >
        <ZoomableGroup
          center={position.coordinates}
          zoom={position.zoom}
          onMoveEnd={handleMoveEnd}
          minZoom={MIN_ZOOM}
          maxZoom={MAX_ZOOM}
          translateExtent={[[-200, -100], [1200, 700]]}
          filterZoomEvent={(evt: any) => {
            if (evt?.type === "wheel") return false;
            return true;
          }}
        >
          <Geographies geography={GEO_URL}>
            {({ geographies }) => (
              <>
                {geographies.map((geo) => {
                  const geoName = geo.properties?.name || geo.properties?.NAME || "";
                  const isSelected = selectedCountry === geoName ||
                    (selectedCountry && COUNTRY_ALIASES[geoName]?.some(a => a === selectedCountry));
                  return (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      onClick={() => handleCountryClickCb(geo)}
                      fill={isSelected ? "hsl(220, 14%, 24%)" : "hsl(220, 14%, 16%)"}
                      stroke="hsl(220, 14%, 22%)"
                      strokeWidth={0.5}
                      style={{
                        default: { outline: "none", cursor: "pointer" },
                        hover: { fill: "hsl(220, 14%, 22%)", outline: "none", cursor: "pointer" },
                        pressed: { fill: "hsl(220, 14%, 26%)", outline: "none" },
                      }}
                    />
                  );
                })}
                {/* Country labels — progressive reveal based on zoom */}
                {geographies.map((geo) => {
                  const geoName = geo.properties?.name || geo.properties?.NAME || "";
                  if (!geoName) return null;

                  const tier = getCountryTier(geoName);
                  const minZoom = getMinZoomForTier(tier);
                  if (currentZoom < minZoom) return null;

                  const override = LABEL_OVERRIDES[geoName];
                  const centroid = override || geoCentroid(geo) as [number, number];
                  if (!centroid || (centroid[0] === 0 && centroid[1] === 0)) return null;
                  const displayName = DISPLAY_NAMES[geoName] || geoName;

                  // Fade in: labels that just appeared are slightly transparent
                  const fadeRange = minZoom * 0.3;
                  const opacity = Math.min(1, (currentZoom - minZoom) / fadeRange + 0.5);

                  return (
                    <Marker key={`label-${geo.rsmKey}`} coordinates={centroid}>
                      <text
                        textAnchor="middle"
                        dy="0.35em"
                        style={{
                          fontFamily: "'Noto Sans JP', system-ui, sans-serif",
                          fill: "hsl(220, 10%, 42%)",
                          fontSize: `${labelFontSize}px`,
                          fontWeight: 500,
                          pointerEvents: "none",
                          userSelect: "none",
                          opacity,
                          transition: "opacity 0.3s",
                        }}
                      >
                        {displayName}
                      </text>
                    </Marker>
                  );
                })}
              </>
            )}
          </Geographies>

          {/* Resilience signals */}
          {mode === "resilience" &&
            resilienceFiltered.map((signal) => {
              const domain = DOMAINS.find((d) => d.id === signal.domain);
              const color = domain?.color || "hsl(38, 90%, 55%)";
              const relevant = selectedCompany
                ? isRelevantToCompany(`${signal.title} ${signal.description}`, selectedCompany)
                : false;
              const dimmed = !!(selectedCompany && !relevant && !signal.isJapan);
              const baseR = signal.isJapan ? 6 : relevant ? 6 : 3 + signal.intensity * 0.4;
              const r = baseR * dotScale;
              const isSelected = selectedSignalId === signal.id;
              const fillColor = signal.isJapan ? "#1241ea" : color;

              return (
                <Marker
                  key={signal.id}
                  coordinates={signal.coordinates}
                  onClick={() => onSignalClick(signal, "resilience")}
                  style={{ cursor: "pointer" }}
                >
                  <title>{getShortTitle(signal.title)}</title>
                  <circle r={r * 2} fill={fillColor} opacity={dimmed ? 0 : 0.15} />
                  <circle
                    r={r}
                    fill={fillColor}
                    stroke={isSelected ? "#ffffff" : fillColor}
                    strokeWidth={isSelected ? 2 * dotScale : 1 * dotScale}
                    opacity={dimmed ? 0.25 : 1}
                    className="transition-all duration-200 hover:opacity-100"
                    style={{ transition: "opacity 0.3s, r 0.2s" }}
                    onMouseEnter={(e) => {
                      const el = e.currentTarget;
                      el.setAttribute("r", String(r * 1.5));
                    }}
                    onMouseLeave={(e) => {
                      const el = e.currentTarget;
                      el.setAttribute("r", String(r));
                    }}
                  />
                  {isSelected && (
                    <circle
                      r={r * 2.5}
                      fill="none"
                      stroke="#ffffff"
                      strokeWidth={0.5 * dotScale}
                      opacity={0.4}
                    />
                  )}
                  {signal.isJapan && (
                    <text
                      textAnchor="middle"
                      y={-r - 4 * dotScale}
                      style={{ fontSize: `${10 * dotScale}px`, pointerEvents: "none" }}
                    >
                      🇯🇵
                    </text>
                  )}
                </Marker>
              );
            })}

          {/* Gen Z signals */}
          {mode === "genz" &&
            genzFiltered.map((signal) => {
              const relevant = selectedCompany
                ? isRelevantToCompany(`${signal.title} ${signal.description}`, selectedCompany)
                : false;
              const dimmed = !!(selectedCompany && !relevant && !signal.isJapan);
              const baseR = signal.isJapan ? 6 : relevant ? 6 : 3 + signal.intensity * 0.4;
              const r = baseR * dotScale;
              const isSelected = selectedSignalId === signal.id;

              return (
                <Marker
                  key={signal.id}
                  coordinates={signal.coordinates}
                  onClick={() => onSignalClick(signal, "genz")}
                  style={{ cursor: "pointer" }}
                >
                  <title>{getShortTitle(signal.title)}</title>
                  <circle r={r * 2} fill={GENZ_COLOR} opacity={dimmed ? 0 : 0.15} />
                  <circle
                    r={r}
                    fill={GENZ_COLOR}
                    stroke={isSelected ? "#ffffff" : GENZ_COLOR}
                    strokeWidth={isSelected ? 2 * dotScale : 1 * dotScale}
                    opacity={dimmed ? 0.25 : 1}
                    className="transition-all duration-200 hover:opacity-100"
                    onMouseEnter={(e) => {
                      const el = e.currentTarget;
                      el.setAttribute("r", String(r * 1.5));
                    }}
                    onMouseLeave={(e) => {
                      const el = e.currentTarget;
                      el.setAttribute("r", String(r));
                    }}
                  />
                  {isSelected && (
                    <circle
                      r={r * 2.5}
                      fill="none"
                      stroke="#ffffff"
                      strokeWidth={0.5 * dotScale}
                      opacity={0.4}
                    />
                  )}
                  {signal.isJapan && (
                    <text
                      textAnchor="middle"
                      y={-r - 4 * dotScale}
                      style={{ fontSize: `${10 * dotScale}px`, pointerEvents: "none" }}
                    >
                      🇯🇵
                    </text>
                  )}
                </Marker>
              );
            })}
        </ZoomableGroup>
      </ComposableMap>
    </div>
  );
});

GlobalMap.displayName = "GlobalMap";

export default GlobalMap;

export { COUNTRY_ALIASES };
