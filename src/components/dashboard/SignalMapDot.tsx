import { memo, useCallback, useState, type MouseEvent } from "react";

export interface SignalMapDotProps {
  r: number;
  dotScale: number;
  renderColor: string;
  dimmed: boolean;
  score: number;
  isSelected: boolean;
  onClick?: (e: MouseEvent) => void;
  onMainMouseEnter?: (e: React.MouseEvent<SVGCircleElement>) => void;
  onMainMouseMove?: (e: React.MouseEvent<SVGCircleElement>) => void;
  onMainMouseLeave?: (e: React.MouseEvent<SVGCircleElement>) => void;
}

/**
 * Same layered circles as `GlobalMap` “UNIFIED SIGNAL DOTS” (SVG).
 * `r` and `dotScale` match 2D: `r = getSignalBaseR(relevant) * getUrgencyMultiplier(score) * dotScale`.
 */
const SignalMapDot = memo(
  ({
    r,
    dotScale,
    renderColor,
    dimmed,
    score,
    isSelected,
    onClick,
    onMainMouseEnter,
    onMainMouseMove,
    onMainMouseLeave,
  }: SignalMapDotProps) => {
    const [hover, setHover] = useState(false);
    const mainR = hover ? r * 1.3 : r;
    const glowOpacity = hover ? 0.3 : dimmed ? 0.04 : 0.15;

    const isCritical = score >= 9;
    const isHigh = score >= 7 && !isCritical;

    const vb = r * 4.5;
    const px = Math.max(28, Math.min(120, r * 10));

    const handleMainEnter = useCallback(
      (e: React.MouseEvent<SVGCircleElement>) => {
        setHover(true);
        onMainMouseEnter?.(e);
      },
      [onMainMouseEnter],
    );

    const handleMainLeave = useCallback(
      (e: React.MouseEvent<SVGCircleElement>) => {
        setHover(false);
        onMainMouseLeave?.(e);
      },
      [onMainMouseLeave],
    );

    return (
      <svg
        width={px}
        height={px}
        viewBox={`${-vb} ${-vb} ${vb * 2} ${vb * 2}`}
        style={{ display: "block", overflow: "visible" }}
        onClick={(e) => {
          if (!onClick) return;
          e.stopPropagation();
          onClick(e);
        }}
      >
        {isCritical && !dimmed && (
          <circle r={r * 3} fill={renderColor} opacity={0}>
            <animate attributeName="r" from={String(r * 1.5)} to={String(r * 4)} dur="2s" repeatCount="indefinite" />
            <animate attributeName="opacity" from="0.25" to="0" dur="2s" repeatCount="indefinite" />
          </circle>
        )}
        {isHigh && !dimmed && <circle r={r * 2.2} fill={renderColor} opacity={0.12} />}
        <circle r={r * 2} fill={renderColor} opacity={glowOpacity} />
        <circle
          r={mainR}
          fill={renderColor}
          stroke={renderColor}
          strokeWidth={1 * dotScale}
          opacity={dimmed ? 0.45 : score < 4 ? 0.55 : 1}
          style={{ transition: "r 150ms ease, opacity 150ms ease" }}
          onMouseEnter={handleMainEnter}
          onMouseMove={onMainMouseMove}
          onMouseLeave={handleMainLeave}
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
      </svg>
    );
  },
);

SignalMapDot.displayName = "SignalMapDot";

export default SignalMapDot;
