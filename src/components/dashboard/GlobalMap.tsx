import { useState, useCallback, memo } from "react";
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
import { GENZ_CATEGORIES } from "@/data/genzCategories";
import { COMPANIES, CompanyId } from "@/data/companies";
import { DomainId, MindsetId, ResilienceSignal } from "@/data/types";
import { GenZCategoryId, GenZSignal } from "@/data/genzTypes";
import { DashboardMode } from "./DashboardLayout";

const GEO_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

interface Props {
  mode: DashboardMode;
  activeDomains: DomainId[];
  activeMindset: MindsetId;
  activeCategories: GenZCategoryId[];
  selectedCompany: CompanyId | null;
  onSignalClick: (signal: ResilienceSignal | GenZSignal, mode: DashboardMode) => void;
  selectedSignalId: string | null;
}

const GENZ_COLOR = "#1ab5a5";

function isRelevantToCompany(text: string, companyId: CompanyId): boolean {
  const company = COMPANIES.find((c) => c.id === companyId);
  if (!company) return false;
  const lower = text.toLowerCase();
  return company.keywords.some((kw) => lower.includes(kw.toLowerCase()));
}

const COUNTRY_LABELS: Array<{ name: string; coordinates: [number, number] }> = [
  { name: "United States", coordinates: [-98, 39] },
  { name: "Brazil", coordinates: [-53, -10] },
  { name: "Japan", coordinates: [138, 37] },
  { name: "China", coordinates: [104, 35] },
  { name: "India", coordinates: [79, 22] },
  { name: "Germany", coordinates: [10, 51] },
  { name: "Australia", coordinates: [134, -25] },
  { name: "Nigeria", coordinates: [8, 10] },
  { name: "UK", coordinates: [-2, 54] },
  { name: "Indonesia", coordinates: [118, -2] },
  { name: "South Korea", coordinates: [128, 36] },
  { name: "Kenya", coordinates: [38, 0] },
  { name: "France", coordinates: [2, 47] },
  { name: "Saudi Arabia", coordinates: [45, 24] },
  { name: "Colombia", coordinates: [-73, 4] },
  { name: "Chile", coordinates: [-71, -33] },
  { name: "Argentina", coordinates: [-64, -34] },
  { name: "Thailand", coordinates: [101, 15] },
  { name: "Vietnam", coordinates: [107, 16] },
  { name: "Egypt", coordinates: [30, 27] },
  { name: "South Africa", coordinates: [25, -29] },
  { name: "Ghana", coordinates: [-2, 8] },
  { name: "Malaysia", coordinates: [109, 4] },
  { name: "Singapore", coordinates: [104, 1.3] },
  { name: "Philippines", coordinates: [122, 12] },
  { name: "Peru", coordinates: [-76, -10] },
  { name: "Netherlands", coordinates: [5, 52] },
  { name: "Sweden", coordinates: [16, 63] },
  { name: "Finland", coordinates: [26, 64] },
  { name: "UAE", coordinates: [54, 24] },
  { name: "Kazakhstan", coordinates: [67, 48] },
  { name: "Belgium", coordinates: [4, 51] },
  { name: "Denmark", coordinates: [10, 56] },
];

const GlobalMap = memo(({
  mode,
  activeDomains,
  activeMindset,
  activeCategories,
  selectedCompany,
  onSignalClick,
  selectedSignalId,
}: Props) => {
  const [position, setPosition] = useState<{ coordinates: [number, number]; zoom: number }>({
    coordinates: [30, 20],
    zoom: 1.5,
  });

  const handleMoveEnd = useCallback((pos: { coordinates: [number, number]; zoom: number }) => {
    setPosition(pos);
  }, []);

  const dotScale = 1 / position.zoom;
  const showLabels = position.zoom >= 2.5;

  const resilienceFiltered = mode === "resilience"
    ? SIGNALS.filter((s) => activeDomains.includes(s.domain))
    : [];
  const genzFiltered = mode === "genz"
    ? GENZ_SIGNALS.filter((s) => activeCategories.includes(s.category))
    : [];

  return (
    <div className="w-full h-full bg-background">
      <ComposableMap
        projection="geoMercator"
        projectionConfig={{ scale: 140, center: [0, 20] }}
        style={{ width: "100%", height: "100%" }}
      >
        <ZoomableGroup
          center={position.coordinates}
          zoom={position.zoom}
          onMoveEnd={handleMoveEnd}
          minZoom={1}
          maxZoom={12}
        >
          <Geographies geography={GEO_URL}>
            {({ geographies }) =>
              geographies.map((geo) => (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  fill="hsl(220, 14%, 16%)"
                  stroke="hsl(220, 14%, 22%)"
                  strokeWidth={0.5}
                  style={{
                    default: { outline: "none" },
                    hover: { fill: "hsl(220, 14%, 20%)", outline: "none" },
                    pressed: { outline: "none" },
                  }}
                />
              ))
            }
          </Geographies>

          {/* Country labels */}
          {showLabels &&
            COUNTRY_LABELS.map((c) => (
              <Marker key={c.name} coordinates={c.coordinates}>
                <text
                  textAnchor="middle"
                  style={{
                    fontFamily: "'Noto Sans JP', system-ui, sans-serif",
                    fill: "hsl(220, 10%, 40%)",
                    fontSize: `${10 * dotScale}px`,
                    fontWeight: 500,
                    pointerEvents: "none",
                    userSelect: "none",
                  }}
                >
                  {c.name}
                </text>
              </Marker>
            ))}

          {/* Resilience markers */}
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
                  {/* Glow */}
                  <circle
                    r={r * 2}
                    fill={fillColor}
                    opacity={dimmed ? 0 : 0.15}
                  />
                  {/* Main dot */}
                  <circle
                    r={r}
                    fill={fillColor}
                    stroke={isSelected ? "#ffffff" : fillColor}
                    strokeWidth={isSelected ? 2 * dotScale : 1 * dotScale}
                    opacity={dimmed ? 0.25 : 1}
                    style={{ transition: "opacity 0.3s" }}
                  />
                  {/* Japan flag indicator */}
                  {signal.isJapan && (
                    <text
                      textAnchor="middle"
                      y={-r - 4 * dotScale}
                      style={{
                        fontSize: `${10 * dotScale}px`,
                        pointerEvents: "none",
                      }}
                    >
                      🇯🇵
                    </text>
                  )}
                </Marker>
              );
            })}

          {/* Gen Z markers */}
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
                  <circle
                    r={r * 2}
                    fill={GENZ_COLOR}
                    opacity={dimmed ? 0 : 0.15}
                  />
                  <circle
                    r={r}
                    fill={GENZ_COLOR}
                    stroke={isSelected ? "#ffffff" : GENZ_COLOR}
                    strokeWidth={isSelected ? 2 * dotScale : 1 * dotScale}
                    opacity={dimmed ? 0.25 : 1}
                    style={{ transition: "opacity 0.3s" }}
                  />
                  {signal.isJapan && (
                    <text
                      textAnchor="middle"
                      y={-r - 4 * dotScale}
                      style={{
                        fontSize: `${10 * dotScale}px`,
                        pointerEvents: "none",
                      }}
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
