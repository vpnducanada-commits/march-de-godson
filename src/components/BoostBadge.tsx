export function BoostBadge({ featured, listingId }: { featured?: boolean; listingId?: string }){
  void listingId;
  if(!featured) return null;
  return <span className="badge-sponsored">Sponsorisé</span>;
}
