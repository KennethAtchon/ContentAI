interface Props {
  peaks: Float32Array | null;
  loading: boolean;
  color: string;
}

/**
 * Renders a bar-chart waveform inside a clip block.
 *
 * Geometry:
 *  - Fills the parent container via `absolute inset-0`.
 *  - Uses a normalised SVG viewBox (0 0 PEAK_COUNT 1) with preserveAspectRatio="none"
 *    so the waveform stretches to any clip width without recalculating bar coordinates.
 *  - Each bar is 0.8 units wide with a 0.2-unit gap, centred vertically.
 *  - Minimum bar height of 0.02 keeps silent sections visually present as a thin line.
 *
 * Loading state:
 *  - Shows a CSS pulse shimmer in the track colour while decoding.
 *  - The shimmer fills the same absolute inset-0 area so the clip label is still readable.
 */
export function WaveformBars({ peaks, loading, color }: Props) {
  if (loading) {
    return (
      <div
        className="absolute inset-0 animate-pulse pointer-events-none"
        style={{ backgroundColor: color + "22" }}
      />
    );
  }

  if (!peaks || peaks.length === 0) return null;

  const N = peaks.length;

  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none"
      viewBox={`0 0 ${N} 1`}
      preserveAspectRatio="none"
      aria-hidden
    >
      {Array.from(peaks).map((peak, i) => {
        const h = Math.max(peak, 0.02);
        return (
          <rect
            key={i}
            x={i}
            y={(1 - h) / 2}
            width={0.8}
            height={h}
            fill={color}
            opacity={0.45}
          />
        );
      })}
    </svg>
  );
}
