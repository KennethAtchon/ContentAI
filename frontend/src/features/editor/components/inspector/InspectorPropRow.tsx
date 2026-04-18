import type { ReactNode } from "react";

export function InspectorPropRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-2 py-0.5 min-w-0">
      <span className="text-xs text-dim-2 shrink-0">{label}</span>
      {children}
    </div>
  );
}

export function InspectorSliderRow({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-2 py-0.5">
      <span className="text-xs text-dim-2 w-16 shrink-0">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1 h-1 accent-studio-accent"
      />
      <span className="text-xs text-dim-3 w-8 text-right">{value}</span>
    </div>
  );
}

export function InspectorValuePill({ value }: { value: string | number }) {
  return (
    <span className="text-xs bg-overlay-sm text-dim-1 px-2 py-0.5 rounded">
      {value}
    </span>
  );
}
