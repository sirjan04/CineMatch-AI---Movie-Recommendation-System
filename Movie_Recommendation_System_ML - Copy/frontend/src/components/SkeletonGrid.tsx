export function SkeletonGrid({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="animate-pulse">
          <div className="aspect-[2/3] rounded-2xl bg-elevated" />
          <div className="mt-3 h-4 w-4/5 rounded bg-elevated" />
          <div className="mt-2 h-3 w-1/2 rounded bg-surface" />
        </div>
      ))}
    </div>
  );
}
