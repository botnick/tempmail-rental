interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <div className={`bg-white/[0.04] rounded-xl animate-pulse ${className}`} />
  );
}

export function SkeletonCard() {
  return (
    <div className="bg-white/[0.025] border border-border-subtle rounded-2xl p-5 space-y-3">
      <Skeleton className="w-11 h-11 rounded-xl" />
      <Skeleton className="w-20 h-7" />
      <Skeleton className="w-28 h-3" />
    </div>
  );
}

export function SkeletonRow() {
  return (
    <div className="flex items-center gap-4 p-4 rounded-xl bg-white/[0.015]">
      <Skeleton className="w-8 h-8 rounded-lg shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="w-48 h-4" />
        <Skeleton className="w-24 h-3" />
      </div>
      <Skeleton className="w-16 h-6 rounded-full" />
    </div>
  );
}

export function SkeletonTable({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonRow key={i} />
      ))}
    </div>
  );
}
