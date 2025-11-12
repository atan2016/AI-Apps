export function LoadingSkeleton() {
  return (
    <div className="relative flex flex-col rounded-lg border bg-card overflow-hidden shadow-sm animate-pulse">
      {/* Image skeleton */}
      <div className="relative aspect-square bg-gradient-to-br from-muted/50 to-muted">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer" />
      </div>

      {/* Footer skeleton */}
      <div className="p-3 flex items-center justify-between gap-2 border-t bg-background">
        <div className="h-4 bg-muted rounded w-20" />
        <div className="h-4 bg-muted rounded w-8" />
      </div>
    </div>
  );
}

