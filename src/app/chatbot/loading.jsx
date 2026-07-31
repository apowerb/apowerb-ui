import { Skeleton } from "@/components/Skeleton";

export default function Loading() {
  return (
    <div className="flex h-full animate-fade-in">
      {/* Sidebar skeleton */}
      <div className="w-64 p-4 space-y-3 th-border border-r hidden md:block">
        <Skeleton className="w-full h-10 rounded-xl mb-4" />
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} variant="text" className="w-full h-12 rounded-lg" />
        ))}
      </div>
      {/* Chat area skeleton */}
      <div className="flex-1 flex flex-col p-6">
        <div className="flex-1 space-y-4">
          {/* Message skeletons */}
          <div className="flex gap-3">
            <Skeleton variant="circular" className="w-8 h-8" />
            <Skeleton className="w-2/3 h-16 rounded-2xl" />
          </div>
          <div className="flex gap-3 justify-end">
            <Skeleton className="w-1/2 h-12 rounded-2xl" />
          </div>
          <div className="flex gap-3">
            <Skeleton variant="circular" className="w-8 h-8" />
            <Skeleton className="w-3/4 h-24 rounded-2xl" />
          </div>
        </div>
        {/* Input skeleton */}
        <Skeleton className="w-full h-14 rounded-2xl mt-4" />
      </div>
    </div>
  );
}
