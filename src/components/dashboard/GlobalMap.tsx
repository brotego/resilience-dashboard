import { useState, useCallback, useRef, memo } from "react";
import {
  ComposableMap,
  ZoomableGroup,
  Geographies,
  Geography,
  Marker,
} from "react-simple-maps";
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

const COUNTRY_LABELS: Array<{ name: string; coordinates: [number, number] }> = [
  { name: "United States", coordinates: [-98, 39] },
  { name: "Canada", coordinates: [-106, 56] },
  { name: "Mexico", coordinates: [-102, 24] },
  { name: "Brazil", coordinates: [-53, -10] },
  { name: "Argentina", coordinates: [-64, -34] },
  { name: "Chile", coordinates: [-71, -33] },
  { name: "Colombia", coordinates: [-73, 4] },
  { name: "Peru", coordinates: [-76, -10] },
  { name: "Venezuela", coordinates: [-66, 8] },
  { name: "Ecuador", coordinates: [-78, -1] },
  { name: "Bolivia", coordinates: [-65, -17] },
  { name: "Paraguay", coordinates: [-58, -23] },
  { name: "Uruguay", coordinates: [-56, -33] },
  { name: "Cuba", coordinates: [-79, 22] },
  { name: "Japan", coordinates: [138, 37] },
  { name: "China", coordinates: [104, 35] },
  { name: "India", coordinates: [79, 22] },
  { name: "Germany", coordinates: [10, 51] },
  { name: "France", coordinates: [2, 47] },
  { name: "UK", coordinates: [-2, 54] },
  { name: "Spain", coordinates: [-4, 40] },
  { name: "Italy", coordinates: [12, 43] },
  { name: "Portugal", coordinates: [-8, 40] },
  { name: "Netherlands", coordinates: [5, 52] },
  { name: "Belgium", coordinates: [4, 51] },
  { name: "Switzerland", coordinates: [8, 47] },
  { name: "Austria", coordinates: [14, 48] },
  { name: "Poland", coordinates: [20, 52] },
  { name: "Czech Rep.", coordinates: [15, 50] },
  { name: "Romania", coordinates: [25, 46] },
  { name: "Ukraine", coordinates: [32, 49] },
  { name: "Sweden", coordinates: [16, 63] },
  { name: "Norway", coordinates: [9, 62] },
  { name: "Finland", coordinates: [26, 64] },
  { name: "Denmark", coordinates: [10, 56] },
  { name: "Ireland", coordinates: [-8, 53] },
  { name: "Greece", coordinates: [22, 39] },
  { name: "Turkey", coordinates: [35, 39] },
  { name: "Russia", coordinates: [100, 60] },
  { name: "Australia", coordinates: [134, -25] },
  { name: "New Zealand", coordinates: [174, -41] },
  { name: "Indonesia", coordinates: [118, -2] },
  { name: "South Korea", coordinates: [128, 36] },
  { name: "Thailand", coordinates: [101, 15] },
  { name: "Vietnam", coordinates: [107, 16] },
  { name: "Philippines", coordinates: [122, 12] },
  { name: "Malaysia", coordinates: [109, 4] },
  { name: "Singapore", coordinates: [104, 1.3] },
  { name: "Mongolia", coordinates: [104, 47] },
  { name: "Pakistan", coordinates: [69, 30] },
  { name: "Bangladesh", coordinates: [90, 24] },
  { name: "Myanmar", coordinates: [96, 20] },
  { name: "Nigeria", coordinates: [8, 10] },
  { name: "Kenya", coordinates: [38, 0] },
  { name: "South Africa", coordinates: [25, -29] },
  { name: "Ghana", coordinates: [-2, 8] },
  { name: "Egypt", coordinates: [30, 27] },
  { name: "Ethiopia", coordinates: [40, 9] },
  { name: "Tanzania", coordinates: [35, -6] },
  { name: "DR Congo", coordinates: [24, -3] },
  { name: "Morocco", coordinates: [-6, 32] },
  { name: "Algeria", coordinates: [3, 28] },
  { name: "Libya", coordinates: [17, 27] },
  { name: "Sudan", coordinates: [30, 16] },
  { name: "Saudi Arabia", coordinates: [45, 24] },
  { name: "UAE", coordinates: [54, 24] },
  { name: "Iran", coordinates: [53, 33] },
  { name: "Iraq", coordinates: [44, 33] },
  { name: "Afghanistan", coordinates: [67, 34] },
  { name: "Kazakhstan", coordinates: [67, 48] },
  { name: "Uzbekistan", coordinates: [64, 41] },
];

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
  const labelFontSize = Math.max(6, 8 * dotScale);

  const resilienceFiltered = mode === "resilience"
    ? SIGNALS.filter((s) => activeDomains.includes(s.domain))
    : [];
  const genzFiltered = mode === "genz"
    ? GENZ_SIGNALS.filter((s) => activeCategories.includes(s.category))
    : [];

  const handleCountryClick = useCallback((geo: any) => {
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
            {({ geographies }) =>
              geographies.map((geo) => {
                const geoName = geo.properties?.name || geo.properties?.NAME || "";
                const isSelected = selectedCountry === geoName ||
                  (selectedCountry && COUNTRY_ALIASES[geoName]?.some(a => a === selectedCountry));
                return (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    onClick={() => handleCountryClick(geo)}
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
              })
            }
          </Geographies>

          {/* Country labels — always visible */}
          {COUNTRY_LABELS.map((c) => (
            <Marker key={c.name} coordinates={c.coordinates}>
              <text
                textAnchor="middle"
                style={{
                  fontFamily: "'Noto Sans JP', system-ui, sans-serif",
                  fill: "hsl(220, 10%, 40%)",
                  fontSize: `${labelFontSize}px`,
                  fontWeight: 500,
                  pointerEvents: "none",
                  userSelect: "none",
                }}
              >
                {c.name}
              </text>
            </Marker>
          ))}

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
