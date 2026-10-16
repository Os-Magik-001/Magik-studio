export default function Loading() {
  return (
    <div className="animate-pulse" aria-busy="true" aria-label="Loading">
      <div className="mb-2 h-4 w-24 rounded bg-surface-2" />
      <div className="mb-8 h-8 w-64 rounded bg-surface-2" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-28 rounded-xl border border-line bg-surface" />
        ))}
      </div>
    </div>
  );
}
