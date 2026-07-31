export function Skeleton({ className = "", variant = "rectangular" }) {
  const baseClass = "animate-pulse th-skeleton rounded";
  const variants = {
    rectangular: "rounded-lg",
    circular: "rounded-full",
    text: "rounded h-4",
  };

  return <div className={`${baseClass} ${variants[variant]} ${className}`} />;
}

export function SkeletonCard({ className = "" }) {
  return (
    <div className={`glass-card p-6 space-y-4 ${className}`}>
      <div className="flex items-center gap-3">
        <Skeleton variant="circular" className="w-10 h-10" />
        <div className="flex-1 space-y-2">
          <Skeleton variant="text" className="w-1/3" />
          <Skeleton variant="text" className="w-1/2 h-3" />
        </div>
      </div>
      <Skeleton className="w-full h-20" />
      <div className="flex gap-2">
        <Skeleton className="w-16 h-6 rounded-full" />
        <Skeleton className="w-20 h-6 rounded-full" />
      </div>
    </div>
  );
}

export function SkeletonList({ count = 3, className = "" }) {
  return (
    <div className={`space-y-3 ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-3">
          <Skeleton variant="circular" className="w-8 h-8" />
          <div className="flex-1 space-y-2">
            <Skeleton variant="text" className="w-2/3" />
            <Skeleton variant="text" className="w-1/3 h-3" />
          </div>
        </div>
      ))}
    </div>
  );
}
