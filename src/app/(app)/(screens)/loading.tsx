// Shown inside the app's screen the moment it opens, until its data arrives.
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading" className="animate-fade-in">
      <div className="skeleton mb-2.5 h-3 w-24 rounded-full" />
      <div className="skeleton mb-8 h-8 w-72 rounded-xl" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="skeleton h-32 rounded-[18px]" />
        ))}
      </div>
    </div>
  );
}
