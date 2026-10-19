/**
 * Squelettes de chargement (shimmer) : même gabarit que le contenu final,
 * pour une perception de rapidité sans saut de mise en page.
 */
export function SkeletonCard() {
  return (
    <div className="card skeleton-card" aria-hidden="true">
      <div className="skeleton skeleton--media" />
      <div className="card__body">
        <div className="skeleton skeleton--line skeleton--w55" />
        <div className="skeleton skeleton--line skeleton--w90" />
        <div className="skeleton skeleton--line skeleton--w40" />
      </div>
    </div>
  );
}

export function SkeletonCatGrid({ count = 8 }: { count?: number }) {
  return (
    <div className="cat-grid" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="cat-card skeleton-cat">
          <span className="skeleton skeleton--icon" />
          <span className="skeleton skeleton--line skeleton--w80" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonListingGrid({ count = 8 }: { count?: number }) {
  return (
    <div className="listing-grid" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}
