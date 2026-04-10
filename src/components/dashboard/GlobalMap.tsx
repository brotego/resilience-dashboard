import { useState, useCallback, useRef, memo, useMemo } from "react";
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
const ZOOM_STEP = 1.4;

function isRelevantToCompany(text: string, companyId: CompanyId): boolean {
  const company = COMPANIES.find((c) => c.id === companyId);
  if (!company) return false;
  const lower = text.toLowerCase();
  return company.keywords.some((kw) => lower.includes(kw.toLowerCase()));
}

// Country name aliases for matching signals to countries
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

// Manual centroid overrides for countries whose computed centroid is off
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

// Short display names
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
  "S. Sudan": "S. Sudan",
};

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
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMoveEnd = useCallback((pos: { coordinates: [number, number]; zoom: number }) => {
    setPosition(pos);
  }, []);

  const clampZoom = (z: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setPosition((prev) => ({
      ...prev,
      zoom: clampZoom(prev.zoom * (e.deltaY < 0 ? 1.08 : 0.92)),
    }));
  }, []);

  const zoomIn = useCallback(() => {
    setPosition((prev) => ({ ...prev, zoom: clampZoom(prev.zoom * ZOOM_STEP) }));
  }, []);

  const zoomOut = useCallback(() => {
    setPosition((prev) => ({ ...prev, zoom: clampZoom(prev.zoom / ZOOM_STEP) }));
  }, []);

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

  return (
    <div
      ref={containerRef}
      className="w-full h-full bg-background relative"
      onWheel={handleWheel}
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
                {/* Country labels from geography centroids */}
                {geographies.map((geo) => {
                  const geoName = geo.properties?.name || geo.properties?.NAME || "";
                  if (!geoName) return null;
                  const override = LABEL_OVERRIDES[geoName];
                  const centroid = override || geoCentroid(geo) as [number, number];
                  // Skip labels at extreme latitudes or invalid centroids
                  if (!centroid || (centroid[0] === 0 && centroid[1] === 0)) return null;
                  const displayName = DISPLAY_NAMES[geoName] || geoName;
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
