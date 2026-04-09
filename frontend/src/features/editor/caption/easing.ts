import type { EasingFunction } from "./types";

function cubicBezierAt(
  t: number,
  _x1: number,
  y1: number,
  _x2: number,
  y2: number
) {
  const inv = 1 - t;
  return 3 * inv * inv * t * y1 + 3 * inv * t * t * y2 + t * t * t;
}

export function springValue(
  t: number,
  stiffness: number,
  damping: number,
  mass: number
): number {
  const omega0 = Math.sqrt(stiffness / Math.max(mass, 0.0001));
  const zeta = damping / (2 * Math.sqrt(stiffness * Math.max(mass, 0.0001)));

  if (zeta < 1) {
    const omegaD = omega0 * Math.sqrt(1 - zeta * zeta);
    return (
      1 -
      Math.exp(-zeta * omega0 * t) *
        (Math.cos(omegaD * t) +
          (zeta / Math.sqrt(1 - zeta * zeta)) * Math.sin(omegaD * t))
    );
  }

  return 1 - Math.exp(-omega0 * t);
}

export function evaluate(fn: EasingFunction, t: number): number {
  const clamped = Math.max(0, Math.min(1, t));

  switch (fn.type) {
    case "linear":
      return clamped;
    case "ease-in":
      return clamped ** fn.power;
    case "ease-out":
      return 1 - (1 - clamped) ** fn.power;
    case "ease-in-out":
      return clamped < 0.5
        ? 2 * clamped * clamped
        : -1 + (4 - 2 * clamped) * clamped;
    case "cubic-bezier":
      return cubicBezierAt(clamped, fn.x1, fn.y1, fn.x2, fn.y2);
    case "spring":
      return springValue(clamped, fn.stiffness, fn.damping, fn.mass);
    default:
      return clamped;
  }
}
