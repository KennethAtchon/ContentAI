export function CopyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <p className="text-sm text-dim-3">{label}</p>
      <p className="text-sm text-dim-1 leading-relaxed whitespace-pre-line">
        {value}
      </p>
    </div>
  );
}
