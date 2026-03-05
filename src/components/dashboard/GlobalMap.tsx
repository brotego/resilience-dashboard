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

function isRelevantToCompany(text: string, companyId: CompanyId): boolean {
  const company = COMPANIES.find((c) => c.id === companyId);
  if (!company) return false;
  const lower = text.toLowerCase();
  return company.keywords.some((kw) => lower.includes(kw.toLowerCase()));
}

const GlobalMap = ({ mode, activeDomains, activeMindset, activeCategories, selectedCompany }: Props) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const clickPopupRef = useRef<maplibregl.Popup | null>(null);
  // Store the active hover tooltip div + its lnglat so we can reposition on map move
  const hoverElRef = useRef<HTMLDivElement | null>(null);
  const hoverCoordsRef = useRef<[number, number] | null>(null);

  const removeHoverTooltip = useCallback(() => {
    if (hoverElRef.current) {
      try { hoverElRef.current.remove(); } catch (_) { /* already removed */ }
      hoverElRef.current = null;
    }
    hoverCoordsRef.current = null;
  }, []);

  const repositionHoverTooltip = useCallback(() => {
    const map = mapRef.current;
    const el = hoverElRef.current;
    const coords = hoverCoordsRef.current;
    if (!map || !el || !coords) return;
    const point = map.project(new maplibregl.LngLat(coords[0], coords[1]));
    el.style.left = `${point.x + 20}px`;
    el.style.top = `${point.y - 40}px`;
  }, []);

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

    const onMapMove = () => repositionHoverTooltip();
    map.on("move", onMapMove);

    mapRef.current = map;

    return () => {
      removeHoverTooltip();
      map.off("move", onMapMove);
      map.remove();
      mapRef.current = null;
    };
  }, []);

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

    const showHoverTooltip = (html: string, coordinates: [number, number]) => {
      removeHoverTooltip();
      const tooltip = document.createElement("div");
      tooltip.style.cssText = `
        position:absolute;pointer-events:none;z-index:10;
        background:hsl(213,30%,13%);border:1px solid hsl(213,20%,20%);
        border-radius:8px;padding:10px 12px;
        box-shadow:0 10px 30px -10px rgba(0,0,0,0.6);
        font-family:Inter,system-ui,sans-serif;max-width:280px;
      `;
      tooltip.innerHTML = html;
      // Append to the map container div (which has position:relative)
      map.getContainer().appendChild(tooltip);
      hoverElRef.current = tooltip;
      hoverCoordsRef.current = coordinates;
      // Position immediately using map.project
      const point = map.project(new maplibregl.LngLat(coordinates[0], coordinates[1]));
      tooltip.style.left = `${point.x + 20}px`;
      tooltip.style.top = `${point.y - 40}px`;
    };

    if (mode === "resilience") {
      const filtered = SIGNALS.filter((s) => activeDomains.includes(s.domain));

      filtered.forEach((signal) => {
        const domain = DOMAINS.find((d) => d.id === signal.domain);
        const color = domain?.color || "hsl(38, 78%, 56%)";
        const domainLabel = domain?.label || signal.domain;
        const relevant = selectedCompany ? isRelevantToCompany(`${signal.title} ${signal.description}`, selectedCompany) : false;
        const dimmed = selectedCompany && !relevant && !signal.isJapan;
        const size = signal.isJapan ? 16 : relevant ? 16 : 10 + signal.intensity;

        const el = document.createElement("div");
        el.style.width = `${size}px`;
        el.style.height = `${size}px`;
        el.style.borderRadius = "50%";
        el.style.backgroundColor = signal.isJapan ? "hsl(38, 78%, 56%)" : color;
        el.style.border = signal.isJapan ? "2px solid hsl(38, 78%, 70%)" : `2px solid ${color}`;
        el.style.opacity = dimmed ? "0.3" : "1";
        el.style.boxShadow = dimmed
          ? "none"
          : signal.isJapan
            ? "0 0 12px hsla(38, 78%, 56%, 0.6)"
            : relevant
              ? `0 0 14px ${color.replace(")", ", 0.7)")}`
              : `0 0 8px ${color.replace(")", ", 0.4)")}`;
        el.style.cursor = "pointer";
        el.style.transition = "transform 0.15s, opacity 0.3s";

        el.addEventListener("mouseenter", () => {
          el.style.transform = "scale(1.3)";
          showHoverTooltip(
            `<div>
              <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">
                ${signal.isJapan ? '<span style="font-size:11px;">🇯🇵</span>' : ""}
                <strong style="font-size:13px;color:hsl(30,20%,90%);line-height:1.3;">${signal.title}</strong>
              </div>
              <p style="font-size:11px;color:hsl(30,10%,60%);margin:0 0 4px;">${signal.location}</p>
              <p style="font-size:11px;color:hsl(30,20%,78%);margin:0 0 6px;line-height:1.4;">${signal.description.length > 100 ? `${signal.description.slice(0, 100)}…` : signal.description}</p>
              <span style="font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:${color};">${domainLabel}</span>
            </div>`,
            signal.coordinates
          );
        });

        el.addEventListener("mouseleave", () => {
          el.style.transform = "scale(1)";
          removeHoverTooltip();
        });

        const marker = new maplibregl.Marker({ element: el, anchor: "center" }).setLngLat(signal.coordinates).addTo(map);

        el.addEventListener("click", (e) => {
          e.stopPropagation();
          removeHoverTooltip();
          if (clickPopupRef.current) {
            clickPopupRef.current.remove();
            clickPopupRef.current = null;
          }

          const mindsetText = signal.mindsetRelevance[activeMindset];
          const popup = new maplibregl.Popup({ offset: [0, -(size / 2 + 6)], maxWidth: "320px", anchor: "bottom" })
            .setLngLat(signal.coordinates)
            .setHTML(`
              <div style="font-family:Inter,system-ui,sans-serif;">
                <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px;">
                  ${signal.isJapan ? '<span style="font-size:12px;">🇯🇵</span>' : ""}
                  <strong style="font-size:14px;color:hsl(30,20%,90%);">${signal.title}</strong>
                </div>
                <p style="font-size:12px;color:hsl(30,10%,60%);margin:0 0 8px;">${signal.location}</p>
                <p style="font-size:12px;color:hsl(30,20%,82%);margin:0 0 10px;line-height:1.5;">${signal.description}</p>
                <div style="border-top:1px solid hsl(213,20%,20%);padding-top:8px;">
                  <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.5px;color:hsl(38,78%,56%);margin-bottom:4px;">Mindset Lens</div>
                  <p style="font-size:11px;color:hsl(30,20%,82%);line-height:1.4;margin:0;">${mindsetText}</p>
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

      filtered.forEach((signal) => {
        const cat = GENZ_CATEGORIES.find((c) => c.id === signal.category);
        const catLabel = cat?.label || signal.category;
        const relevant = selectedCompany ? isRelevantToCompany(`${signal.title} ${signal.description}`, selectedCompany) : false;
        const dimmed = selectedCompany && !relevant && !signal.isJapan;
        const size = signal.isJapan ? 16 : relevant ? 16 : 10 + signal.intensity;

        const el = document.createElement("div");
        el.style.width = `${size}px`;
        el.style.height = `${size}px`;
        el.style.borderRadius = "50%";
        el.style.backgroundColor = GENZ_COLOR;
        el.style.border = signal.isJapan ? "2px solid hsl(170, 55%, 60%)" : `2px solid ${GENZ_COLOR}`;
        el.style.opacity = dimmed ? "0.3" : "1";
        el.style.boxShadow = dimmed
          ? "none"
          : signal.isJapan
            ? "0 0 12px hsla(170, 55%, 46%, 0.6)"
            : relevant
              ? "0 0 14px hsla(170, 55%, 46%, 0.7)"
              : "0 0 8px hsla(170, 55%, 46%, 0.4)";
        el.style.cursor = "pointer";
        el.style.transition = "transform 0.15s, opacity 0.3s";

        el.addEventListener("mouseenter", () => {
          el.style.transform = "scale(1.3)";
          showHoverTooltip(
            `<div>
              <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">
                ${signal.isJapan ? '<span style="font-size:11px;">🇯🇵</span>' : ""}
                <strong style="font-size:13px;color:hsl(30,20%,90%);line-height:1.3;">${signal.title}</strong>
              </div>
              <p style="font-size:11px;color:hsl(30,10%,60%);margin:0 0 4px;">${signal.location}</p>
              <p style="font-size:11px;color:hsl(30,20%,78%);margin:0 0 6px;line-height:1.4;">${signal.description.length > 100 ? `${signal.description.slice(0, 100)}…` : signal.description}</p>
              <span style="font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:${GENZ_COLOR};">${catLabel}</span>
            </div>`,
            signal.coordinates
          );
        });

        el.addEventListener("mouseleave", () => {
          el.style.transform = "scale(1)";
          removeHoverTooltip();
        });

        const marker = new maplibregl.Marker({ element: el, anchor: "center" }).setLngLat(signal.coordinates).addTo(map);

        el.addEventListener("click", (e) => {
          e.stopPropagation();
          removeHoverTooltip();
          if (clickPopupRef.current) {
            clickPopupRef.current.remove();
            clickPopupRef.current = null;
          }

          const popup = new maplibregl.Popup({ offset: [0, -(size / 2 + 6)], maxWidth: "320px", anchor: "bottom" })
            .setLngLat(signal.coordinates)
            .setHTML(`
              <div style="font-family:Inter,system-ui,sans-serif;">
                <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px;">
                  ${signal.isJapan ? '<span style="font-size:12px;">🇯🇵</span>' : ""}
                  <strong style="font-size:14px;color:hsl(30,20%,90%);">${signal.title}</strong>
                </div>
                <p style="font-size:12px;color:hsl(30,10%,60%);margin:0 0 8px;">${signal.location}</p>
                <p style="font-size:12px;color:hsl(30,20%,82%);margin:0 0 10px;line-height:1.5;">${signal.description}</p>
                <div style="border-top:1px solid hsl(213,20%,20%);padding-top:8px;">
                  <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.5px;color:hsl(170,55%,46%);margin-bottom:4px;">Japan Insight</div>
                  <p style="font-size:11px;color:hsl(30,20%,82%);line-height:1.4;margin:0;">${signal.insight}</p>
                </div>
              </div>
            `)
            .addTo(map);

          clickPopupRef.current = popup;
        });

        markersRef.current.push(marker);
      });
    }
  }, [mode, activeDomains, activeMindset, activeCategories, selectedCompany]);

  return <div ref={containerRef} className="w-full h-full relative" />;
};

export default GlobalMap;
