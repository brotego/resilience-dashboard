import { useEffect, useRef, useCallback } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { SIGNALS } from "@/data/signals";
import { GENZ_SIGNALS } from "@/data/genzSignals";
import { DOMAINS } from "@/data/domains";
import { GENZ_CATEGORIES } from "@/data/genzCategories";
import { COMPANIES, CompanyId } from "@/data/companies";
import { DomainId, MindsetId } from "@/data/types";
import { GenZCategoryId } from "@/data/genzTypes";
import { DashboardMode } from "./DashboardLayout";

interface Props {
  mode: DashboardMode;
  activeDomains: DomainId[];
  activeMindset: MindsetId;
  activeCategories: GenZCategoryId[];
  selectedCompany: CompanyId | null;
}

const GENZ_COLOR = "hsl(170, 55%, 46%)";

const TOOLTIP_STYLES = `
  position:absolute;pointer-events:none;z-index:10;
  background:hsl(213,30%,13%);border:1px solid hsl(213,20%,20%);
  border-radius:8px;padding:10px 12px;
  box-shadow:0 10px 30px -10px rgba(0,0,0,0.6);
  font-family:Inter,system-ui,sans-serif;max-width:280px;
  white-space:normal;left:50%;top:50%;transform:translate(50%,-50%);
`;

function isRelevantToCompany(text: string, companyId: CompanyId): boolean {
  const company = COMPANIES.find((c) => c.id === companyId);
  if (!company) return false;
  const lower = text.toLowerCase();
  return company.keywords.some((kw) => lower.includes(kw.toLowerCase()));
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function buildTooltipHtml(title: string, location: string, description: string, accentLabel: string, accentColor: string, isJapan: boolean): string {
  const shortDesc = description.length > 100 ? `${escapeHtml(description.slice(0, 100))}…` : escapeHtml(description);
  return `<div>
    <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">
      ${isJapan ? '<span style="font-size:11px;">🇯🇵</span>' : ""}
      <strong style="font-size:13px;color:hsl(30,20%,90%);line-height:1.3;">${escapeHtml(title)}</strong>
    </div>
    <p style="font-size:11px;color:hsl(30,10%,60%);margin:0 0 4px;">${escapeHtml(location)}</p>
    <p style="font-size:11px;color:hsl(30,20%,78%);margin:0 0 6px;line-height:1.4;">${shortDesc}</p>
    <span style="font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:${accentColor};">${escapeHtml(accentLabel)}</span>
  </div>`;
}

const GlobalMap = ({ mode, activeDomains, activeMindset, activeCategories, selectedCompany }: Props) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const clickPopupRef = useRef<maplibregl.Popup | null>(null);
  const hoverTooltipRef = useRef<HTMLDivElement | null>(null);

  const removeHoverTooltip = useCallback(() => {
    if (hoverTooltipRef.current) {
      try { hoverTooltipRef.current.remove(); } catch (_) { /* noop */ }
      hoverTooltipRef.current = null;
    }
  }, []);

  const showTooltipOnMarker = useCallback((markerEl: HTMLElement, html: string) => {
    removeHoverTooltip();
    const tooltip = document.createElement("div");
    tooltip.style.cssText = TOOLTIP_STYLES;
    tooltip.innerHTML = html;
    markerEl.style.position = "relative";
    markerEl.style.overflow = "visible";
    markerEl.appendChild(tooltip);
    hoverTooltipRef.current = tooltip;
  }, [removeHoverTooltip]);

  // Map init
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: {
        version: 8,
        sources: {
          "carto-dark": {
            type: "raster",
            tiles: [
              "https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png",
              "https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png",
            ],
            tileSize: 256,
            attribution:
              '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
          },
        },
        layers: [{ id: "carto-dark-layer", type: "raster", source: "carto-dark", minzoom: 0, maxzoom: 19 }],
      },
      center: [100, 30],
      zoom: 2.2,
      minZoom: 1.5,
      maxZoom: 12,
    });

    map.addControl(new maplibregl.NavigationControl(), "bottom-right");
    mapRef.current = map;

    return () => {
      removeHoverTooltip();
      map.remove();
      mapRef.current = null;
    };
  }, [removeHoverTooltip]);

  // Markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];
    removeHoverTooltip();
    if (clickPopupRef.current) {
      clickPopupRef.current.remove();
      clickPopupRef.current = null;
    }

    const createMarkerElements = (size: number, color: string, borderColor: string, dimmed: boolean, glowColor: string) => {
      const wrapper = document.createElement("div");
      wrapper.style.width = `${size}px`;
      wrapper.style.height = `${size}px`;
      wrapper.style.position = "relative";
      wrapper.style.overflow = "visible";
      wrapper.style.cursor = "pointer";

      const dot = document.createElement("div");
      dot.style.width = "100%";
      dot.style.height = "100%";
      dot.style.borderRadius = "50%";
      dot.style.backgroundColor = color;
      dot.style.border = `2px solid ${borderColor}`;
      dot.style.opacity = dimmed ? "0.3" : "1";
      dot.style.boxShadow = dimmed ? "none" : glowColor;
      dot.style.transition = "transform 0.15s, opacity 0.3s";
      dot.style.transformOrigin = "center center";

      wrapper.appendChild(dot);
      return { wrapper, dot };
    };

    if (mode === "resilience") {
      const filtered = SIGNALS.filter((s) => activeDomains.includes(s.domain));
      console.log("[MapDebug] Resilience mode — first 5 marker coords:", filtered.slice(0, 5).map(s => ({ title: s.title, location: s.location, coordinates: s.coordinates })));

      filtered.forEach((signal) => {
        const domain = DOMAINS.find((d) => d.id === signal.domain);
        const color = domain?.color || "hsl(38, 78%, 56%)";
        const domainLabel = domain?.label || signal.domain;
        const relevant = selectedCompany ? isRelevantToCompany(`${signal.title} ${signal.description}`, selectedCompany) : false;
        const dimmed = !!(selectedCompany && !relevant && !signal.isJapan);
        const size = signal.isJapan ? 16 : relevant ? 16 : 10 + signal.intensity;

        const bgColor = signal.isJapan ? "hsl(38, 78%, 56%)" : color;
        const borderColor = signal.isJapan ? "hsl(38, 78%, 70%)" : color;
        const glow = signal.isJapan
          ? "0 0 12px hsla(38, 78%, 56%, 0.6)"
          : relevant
            ? `0 0 14px ${color.replace(")", ", 0.7)")}`
            : `0 0 8px ${color.replace(")", ", 0.4)")}`;

        const { wrapper: markerEl, dot } = createMarkerElements(size, bgColor, borderColor, dimmed, glow);

        markerEl.addEventListener("mouseenter", () => {
          dot.style.transform = "scale(1.3)";
          showTooltipOnMarker(markerEl, buildTooltipHtml(signal.title, signal.location, signal.description, domainLabel, color, signal.isJapan));
        });

        markerEl.addEventListener("mouseleave", () => {
          dot.style.transform = "scale(1)";
          removeHoverTooltip();
        });

        const marker = new maplibregl.Marker({ element: markerEl, anchor: "center" }).setLngLat(signal.coordinates).addTo(map);

        markerEl.addEventListener("click", (e) => {
          e.stopPropagation();
          removeHoverTooltip();
          if (clickPopupRef.current) { clickPopupRef.current.remove(); clickPopupRef.current = null; }

          const mindsetText = signal.mindsetRelevance[activeMindset];
          const popup = new maplibregl.Popup({ offset: [0, -(size / 2 + 6)], maxWidth: "320px", anchor: "bottom" })
            .setLngLat(signal.coordinates)
            .setHTML(`
              <div style="font-family:Inter,system-ui,sans-serif;">
                <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px;">
                  ${signal.isJapan ? '<span style="font-size:12px;">🇯🇵</span>' : ""}
                  <strong style="font-size:14px;color:hsl(30,20%,90%);">${escapeHtml(signal.title)}</strong>
                </div>
                <p style="font-size:12px;color:hsl(30,10%,60%);margin:0 0 8px;">${escapeHtml(signal.location)}</p>
                <p style="font-size:12px;color:hsl(30,20%,82%);margin:0 0 10px;line-height:1.5;">${escapeHtml(signal.description)}</p>
                <div style="border-top:1px solid hsl(213,20%,20%);padding-top:8px;">
                  <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.5px;color:hsl(38,78%,56%);margin-bottom:4px;">Mindset Lens</div>
                  <p style="font-size:11px;color:hsl(30,20%,82%);line-height:1.4;margin:0;">${escapeHtml(mindsetText)}</p>
                </div>
              </div>
            `)
            .addTo(map);
          clickPopupRef.current = popup;
        });

        markersRef.current.push(marker);
      });
    } else {
      const filtered = GENZ_SIGNALS.filter((s) => activeCategories.includes(s.category));
      console.log("[MapDebug] GenZ mode — first 5 marker coords:", filtered.slice(0, 5).map(s => ({ title: s.title, location: s.location, coordinates: s.coordinates })));

      filtered.forEach((signal) => {
        const cat = GENZ_CATEGORIES.find((c) => c.id === signal.category);
        const catLabel = cat?.label || signal.category;
        const relevant = selectedCompany ? isRelevantToCompany(`${signal.title} ${signal.description}`, selectedCompany) : false;
        const dimmed = !!(selectedCompany && !relevant && !signal.isJapan);
        const size = signal.isJapan ? 16 : relevant ? 16 : 10 + signal.intensity;

        const borderColor = signal.isJapan ? "hsl(170, 55%, 60%)" : GENZ_COLOR;
        const glow = signal.isJapan
          ? "0 0 12px hsla(170, 55%, 46%, 0.6)"
          : relevant
            ? "0 0 14px hsla(170, 55%, 46%, 0.7)"
            : "0 0 8px hsla(170, 55%, 46%, 0.4)";

        const { wrapper: markerEl, dot } = createMarkerElements(size, GENZ_COLOR, borderColor, dimmed, glow);

        markerEl.addEventListener("mouseenter", () => {
          dot.style.transform = "scale(1.3)";
          showTooltipOnMarker(markerEl, buildTooltipHtml(signal.title, signal.location, signal.description, catLabel, GENZ_COLOR, signal.isJapan));
        });

        markerEl.addEventListener("mouseleave", () => {
          dot.style.transform = "scale(1)";
          removeHoverTooltip();
        });

        const marker = new maplibregl.Marker({ element: markerEl, anchor: "center" }).setLngLat(signal.coordinates).addTo(map);

        markerEl.addEventListener("click", (e) => {
          e.stopPropagation();
          removeHoverTooltip();
          if (clickPopupRef.current) { clickPopupRef.current.remove(); clickPopupRef.current = null; }

          const popup = new maplibregl.Popup({ offset: [0, -(size / 2 + 6)], maxWidth: "320px", anchor: "bottom" })
            .setLngLat(signal.coordinates)
            .setHTML(`
              <div style="font-family:Inter,system-ui,sans-serif;">
                <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px;">
                  ${signal.isJapan ? '<span style="font-size:12px;">🇯🇵</span>' : ""}
                  <strong style="font-size:14px;color:hsl(30,20%,90%);">${escapeHtml(signal.title)}</strong>
                </div>
                <p style="font-size:12px;color:hsl(30,10%,60%);margin:0 0 8px;">${escapeHtml(signal.location)}</p>
                <p style="font-size:12px;color:hsl(30,20%,82%);margin:0 0 10px;line-height:1.5;">${escapeHtml(signal.description)}</p>
                <div style="border-top:1px solid hsl(213,20%,20%);padding-top:8px;">
                  <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.5px;color:hsl(170,55%,46%);margin-bottom:4px;">Japan Insight</div>
                  <p style="font-size:11px;color:hsl(30,20%,82%);line-height:1.4;margin:0;">${escapeHtml(signal.insight)}</p>
                </div>
              </div>
            `)
            .addTo(map);
          clickPopupRef.current = popup;
        });

        markersRef.current.push(marker);
      });
    }
  }, [mode, activeDomains, activeMindset, activeCategories, selectedCompany, removeHoverTooltip, showTooltipOnMarker]);

  return <div ref={containerRef} className="w-full h-full relative" />;
};

export default GlobalMap;
