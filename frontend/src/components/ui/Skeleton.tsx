import clsx from 'clsx';

interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'card' | 'stat' | 'circle';
}

export function Skeleton({ className, variant = 'text' }: SkeletonProps) {
  const base = 'bg-white/[0.06] skeleton-pulse rounded-xl';

  switch (variant) {
    case 'circle':
      return <div className={clsx(base, 'w-10 h-10 rounded-full', className)} />;
    case 'stat':
      return (
        <div className={clsx('bg-[#141820] border border-white/[0.06] rounded-2xl p-5', className)}
          style={{ boxShadow: '4px 4px 12px rgba(0,0,0,0.4), -2px -2px 8px rgba(255,255,255,0.02)' }}>
          <div className="flex items-center gap-4">
            <div className={clsx(base, 'w-12 h-12 rounded-xl')} />
            <div className="flex-1 space-y-2">
              <div className={clsx(base, 'h-7 w-12')} />
              <div className={clsx(base, 'h-4 w-20')} />
            </div>
          </div>
        </div>
      );
    case 'card':
      return (
        <div className={clsx('bg-[#141820] border border-white/[0.06] rounded-2xl p-6', className)}
          style={{ boxShadow: '4px 4px 12px rgba(0,0,0,0.4), -2px -2px 8px rgba(255,255,255,0.02)' }}>
          <div className="flex items-start justify-between mb-4">
            <div className={clsx(base, 'h-5 w-32')} />
            <div className={clsx(base, 'h-5 w-12 rounded-full')} />
          </div>
          <div className="space-y-3">
            <div className={clsx(base, 'h-4 w-40')} />
            <div className={clsx(base, 'h-4 w-24')} />
            <div className={clsx(base, 'h-4 w-28')} />
          </div>
          <div className="mt-4 pt-4 border-t border-white/[0.04]">
            <div className={clsx(base, 'h-3 w-20')} />
          </div>
        </div>
      );
    default:
      return <div className={clsx(base, 'h-4 w-full', className)} />;
  }
}

export function DashboardSkeleton() {
  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div className="space-y-2">
          <Skeleton className="h-7 w-56" />
          <Skeleton className="h-4 w-36" />
        </div>
        <Skeleton className="h-10 w-32 rounded-xl" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[...Array(4)].map((_, i) => <Skeleton key={i} variant="stat" />)}
      </div>
      <Skeleton className="h-5 w-32 mb-4" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => <Skeleton key={i} variant="card" />)}
      </div>
    </div>
  );
}

export function ProjectDetailSkeleton() {
  return (
    <div>
      <div className="flex items-start justify-between mb-8">
        <div className="space-y-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-56" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-10 w-28 rounded-xl" />
          <Skeleton className="h-10 w-10 rounded-xl" />
        </div>
      </div>
      <Skeleton variant="card" className="mb-6" />
      <Skeleton className="h-5 w-40 mb-4" />
      <div className="space-y-2">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="bg-[#141820] border border-white/[0.06] rounded-2xl p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Skeleton className="h-5 w-12 rounded-full" />
                <Skeleton className="h-4 w-16" />
              </div>
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
