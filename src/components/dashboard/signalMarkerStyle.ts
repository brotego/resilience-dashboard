/**
 * Shared sizing for signal markers: 2D map (SVG px) and 3D globe (deg on sphere).
 * Mirrors GlobalMap: urgency multiplier, relevance base width, and `map2dDotScaleFromZoom`.
 */

export function getUrgencyMultiplier(score: number): number {
  return score >= 9 ? 2.0 : score >= 7 ? 1.5 : score >= 4 ? 1.0 : 0.7;
}

export function getSignalBaseR(relevant: boolean): number {
  return relevant ? 5 : 3.5;
}

/**
 * 2D map (react-simple-maps): ZoomableGroup scales content by `zoom`. Using pure 1/zoom
 * for dot radius cancels that and keeps dots a constant *screen* size — they stay huge
 * when zoomed out. An exponent below 1 lets markers shrink when zoomed out and grow when zoomed in.
 */
export function map2dDotScaleFromZoom(zoom: number): number {
  const z = Math.max(0.85, Math.min(22, zoom));
  const comp = 0.62;
  return 1 / Math.pow(z, comp);
}

/** GlobalMap uses dotScale = 1 / liveZoom (default liveZoom ~1.5). Map globe camera altitude to the same intent. */
export function globeDotScaleFromCameraAltitude(cameraAltitude: number): number {
  const refAlt = 2.5;
  const refLiveZoom = 1.5;
  return (refAlt / Math.max(cameraAltitude, 0.35)) * (1 / refLiveZoom);
}

/**
 * Radius in globe.gl “degrees” (passed to pointRadius). Calibrated so dots match 2D relative sizes.
 */
export function globeSignalRadiusDeg(o: {
  score: number;
  relevant: boolean;
  cameraAltitude: number;
  isSelected: boolean;
}): number {
  const urgency = getUrgencyMultiplier(o.score);
  const baseR = getSignalBaseR(o.relevant) * urgency;
  const r = baseR * globeDotScaleFromCameraAltitude(o.cameraAltitude);
  const deg = r * 0.028;
  const selectedBoost = o.isSelected ? 1.15 : 1;
  return Math.min(0.52, Math.max(0.065, deg * selectedBoost));
}

/** Same opacity rules as GlobalMap signal circles. */
export function signalMarkerOpacity(score: number, dimmed: boolean): number {
  if (dimmed) return 0.45;
  if (score < 4) return 0.55;
  return 1;
}

/** Apply alpha to hex / hsl / rgba for three-globe materials. */
export function withOpacity(color: string, alpha: number): string {
  const a = Math.max(0, Math.min(1, alpha));
  if (color.startsWith("hsla(")) {
    return color.replace(/hsla\(([^)]+)\)/, (_, inner) => {
      const parts = inner.split(",").map((s) => s.trim());
      if (parts.length >= 4) {
        parts[3] = String(a);
        return `hsla(${parts.join(", ")})`;
      }
      return `hsla(${inner}, ${a})`;
    });
  }
  if (color.startsWith("rgba(")) {
    return color.replace(/rgba\(([^)]+)\)/, (_, inner) => {
      const parts = inner.split(",").map((s) => s.trim());
      if (parts.length >= 4) {
        parts[3] = String(a);
        return `rgba(${parts.join(", ")})`;
      }
      return `rgba(${inner}, ${a})`;
    });
  }
  if (color.startsWith("hsl(")) {
    return color.replace(/^hsl\(/, "hsla(").replace(/\)$/, `, ${a})`);
  }
  if (color.startsWith("#") && (color.length === 7 || color.length === 4)) {
    const hex =
      color.length === 4
        ? `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}`
        : color;
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${a})`;
  }
  return color;
}
