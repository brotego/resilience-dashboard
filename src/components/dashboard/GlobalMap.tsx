import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { SIGNALS } from "@/data/signals";
import { GENZ_SIGNALS } from "@/data/genzSignals";
import { DOMAINS } from "@/data/domains";
import { DomainId, MindsetId } from "@/data/types";
import { GenZCategoryId } from "@/data/genzTypes";
import { DashboardMode } from "./DashboardLayout";

interface Props {
  mode: DashboardMode;
  activeDomains: DomainId[];
  activeMindset: MindsetId;
  activeCategories: GenZCategoryId[];
}

const GENZ_COLOR = "hsl(170, 55%, 46%)";

const GlobalMap = ({ mode, activeDomains, activeMindset, activeCategories }: Props) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const popupRef = useRef<maplibregl.Popup | null>(null);

  // Initialize map
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
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
          },
        },
        layers: [
          {
            id: "carto-dark-layer",
            type: "raster",
            source: "carto-dark",
            minzoom: 0,
            maxzoom: 19,
          },
        ],
      },
      center: [100, 30],
      zoom: 2.2,
      minZoom: 1.5,
      maxZoom: 12,
    });

    map.addControl(new maplibregl.NavigationControl(), "bottom-right");
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Update markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Clear old
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];
    if (popupRef.current) {
      popupRef.current.remove();
      popupRef.current = null;
    }

    if (mode === "resilience") {
      const filtered = SIGNALS.filter((s) => activeDomains.includes(s.domain));

      filtered.forEach((signal) => {
        const domain = DOMAINS.find((d) => d.id === signal.domain);
        const color = domain?.color || "hsl(38, 78%, 56%)";
        const size = signal.isJapan ? 16 : 10 + signal.intensity;

        const el = document.createElement("div");
        el.style.width = `${size}px`;
        el.style.height = `${size}px`;
        el.style.borderRadius = "50%";
        el.style.backgroundColor = signal.isJapan ? "hsl(38, 78%, 56%)" : color;
        el.style.border = signal.isJapan ? "2px solid hsl(38, 78%, 70%)" : `2px solid ${color}`;
        el.style.boxShadow = signal.isJapan
          ? "0 0 12px hsla(38, 78%, 56%, 0.6)"
          : `0 0 8px ${color.replace(")", ", 0.4)")}`;
        el.style.cursor = "pointer";
        el.style.transition = "transform 0.15s";
        el.onmouseenter = () => { el.style.transform = "scale(1.3)"; };
        el.onmouseleave = () => { el.style.transform = "scale(1)"; };

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat(signal.coordinates)
          .addTo(map);

        el.addEventListener("click", (e) => {
          e.stopPropagation();
          if (popupRef.current) popupRef.current.remove();
          const mindsetText = signal.mindsetRelevance[activeMindset];
          const popup = new maplibregl.Popup({ offset: [0, -size / 2], maxWidth: "320px", anchor: "bottom" })
            .setLngLat(signal.coordinates)
            .setHTML(`
              <div style="font-family: Inter, system-ui, sans-serif;">
                <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px;">
                  ${signal.isJapan ? '<span style="font-size:12px;">🇯🇵</span>' : ''}
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
          popupRef.current = popup;
        });

        markersRef.current.push(marker);
      });
    } else {
      // Gen Z mode
      const filtered = GENZ_SIGNALS.filter((s) => activeCategories.includes(s.category));

      filtered.forEach((signal) => {
        const size = signal.isJapan ? 16 : 10 + signal.intensity;

        const el = document.createElement("div");
        el.style.width = `${size}px`;
        el.style.height = `${size}px`;
        el.style.borderRadius = "50%";
        el.style.backgroundColor = GENZ_COLOR;
        el.style.border = signal.isJapan ? `2px solid hsl(170, 55%, 60%)` : `2px solid ${GENZ_COLOR}`;
        el.style.boxShadow = signal.isJapan
          ? "0 0 12px hsla(170, 55%, 46%, 0.6)"
          : "0 0 8px hsla(170, 55%, 46%, 0.4)";
        el.style.cursor = "pointer";
        el.style.transition = "transform 0.15s";
        el.onmouseenter = () => { el.style.transform = "scale(1.3)"; };
        el.onmouseleave = () => { el.style.transform = "scale(1)"; };

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat(signal.coordinates)
          .addTo(map);

        el.addEventListener("click", (e) => {
          e.stopPropagation();
          if (popupRef.current) popupRef.current.remove();
          const popup = new maplibregl.Popup({ offset: [0, -size / 2], maxWidth: "320px", anchor: "bottom" })
            .setLngLat(signal.coordinates)
            .setHTML(`
              <div style="font-family: Inter, system-ui, sans-serif;">
                <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px;">
                  ${signal.isJapan ? '<span style="font-size:12px;">🇯🇵</span>' : ''}
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
          popupRef.current = popup;
        });

        markersRef.current.push(marker);
      });
    }
  }, [mode, activeDomains, activeMindset, activeCategories]);

  return (
    <div ref={containerRef} className="w-full h-full" />
  );
};

export default GlobalMap;
