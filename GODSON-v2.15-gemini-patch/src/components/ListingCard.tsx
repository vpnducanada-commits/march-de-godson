import { Link } from 'react-router-dom';
import { useState } from 'react';
import type { ListingFull } from '../lib/types';
import { CONDITION_LABELS } from '../lib/types';
import { formatFCFA, timeAgo } from '../lib/format';
import { haversine } from '../lib/api';
import { Icon } from './Icon';

export function ListingCard({ item, near }: { item: ListingFull; near?: { lat: number; lng: number } }) {
  const nearStored = (() => {
    try {
      const v = localStorage.getItem('gm_near');
      return v ? (JSON.parse(v) as { lat?: number; lng?: number }) : null;
    } catch {
      return null;
    }
  })();
  const n = near || nearStored;
  const hasExactCoords =
    item.listing.latitude != null &&
    item.listing.longitude != null &&
    Number.isFinite(item.listing.latitude) &&
    Number.isFinite(item.listing.longitude);

  const computedExact =
    hasExactCoords && n && Number.isFinite(n.lat) && Number.isFinite(n.lng)
      ? haversine(n.lat as number, n.lng as number, item.listing.latitude as number, item.listing.longitude as number)
      : null;

  const distanceKm = item.distanceKm != null ? item.distanceKm : computedExact;
  const isApprox = item.distanceKm != null && !hasExactCoords;
  const { listing } = item;
  const [imgError, setImgError] = useState(false);
  const price = formatFCFA(listing.price);

  return (
    <article className="card">
      <Link to={`/annonce/${listing.slug}`} className="card__media" aria-label={listing.title}>
        {!imgError ? (
          <img
            src={item.images[0]}
            alt={listing.title}
            loading="lazy"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="card__media-fallback">
            <Icon name="image" size={26} />
          </div>
        )}
        {listing.is_demo && <span className="card__badge card__badge--demo">Démo</span>}
        {listing.condition && (
          <span className="card__badge card__badge--cond">{CONDITION_LABELS[listing.condition]}</span>
        )}
        <span className="card__time" title={new Date(listing.created_at).toLocaleString('fr-FR')}>
          <Icon name="clock" size={12} />
          {timeAgo(listing.created_at)}
        </span>
      </Link>
      {distanceKm !== null && (
        <span
          style={{
            position: 'absolute',
            top: 8,
            right: 8,
            background: 'rgba(10,22,51,0.85)',
            color: '#fff',
            fontSize: 11,
            padding: '4px 8px',
            borderRadius: 999,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          {isApprox
            ? `~${Math.max(1, Math.round(distanceKm))} km`
            : distanceKm < 1
              ? `${Math.round(distanceKm * 1000)} m`
              : `${distanceKm.toFixed(1)} km`}
        </span>
      )}
      <div className="card__body">
        {price ? (
          <p className="card__price">
            {price}
            {listing.negotiable && <span className="card__negotiable"> · négociable</span>}
          </p>
        ) : (
          <p className="card__price card__price--na">Prix à discuter</p>
        )}
        <h3 className="card__title">
          <Link to={`/annonce/${listing.slug}`}>{listing.title}</Link>
        </h3>
        <p className="card__meta">
          <Icon name="map-pin" size={13} />
          {item.city ? `${item.city.name}` : 'Gabon'}
          {listing.area ? ` · ${listing.area}` : ''}
        </p>
      </div>
    </article>
  );
}
