export function TabSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="rounded-xl border border-overlay-sm p-6 space-y-4"
        >
          <div className="h-4 w-40 bg-overlay-sm rounded" />
          <div className="h-9 w-full bg-overlay-sm rounded-md" />
          <div className="h-9 w-full bg-overlay-sm rounded-md" />
        </div>
      ))}
    </div>
  );
}
