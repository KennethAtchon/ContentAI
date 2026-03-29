export function AudioRow({
  label,
  url,
  noneLabel,
}: {
  label: string;
  url: string | null;
  noneLabel: string;
}) {
  return (
    <div className="space-y-1.5">
      <span className="text-sm text-dim-3">{label}</span>
      {url ? (
        <audio src={url} controls className="w-full h-8" preload="metadata" />
      ) : (
        <span className="text-sm text-dim-3 italic">{noneLabel}</span>
      )}
    </div>
  );
}
