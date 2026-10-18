import { Link } from 'react-router-dom';
import { useState } from 'react';
import type { ListingFull } from '../lib/types';
import { CONDITION_LABELS } from '../lib/types';
import { formatFCFA, timeAgo } from '../lib/format';
import { Icon } from './Icon';

export function ListingCard({ item }: { item: ListingFull }) {
  const { listing } = item;
  const [imgError, setImgError] = useState(false);
  const price = formatFCFA(listing.price);

  return (
    <article className="card">
      <Link
        to={`/annonce/${listing.slug}`}
        className="card__media"
        aria-label={listing.title}
      >
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
