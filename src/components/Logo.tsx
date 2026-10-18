import { Link } from 'react-router-dom';

/**
 * Monogramme GM de GODSON MARKETPLACE.
 *
 * Construction géométrique (viewBox 64×64) :
 *  - Le G : anneau ouvert à droite (arc 300°) + barre centrale — l'échange.
 *  - Le M : polygone doré posé sur la même base, entrelacé au G — le lien
 *    entre acheteurs et vendeurs.
 *  - Bleu nuit = confiance, doré = accent commercial.
 */
export function GMSymbol({
  size = 40,
  variant = 'dark',
  title,
}: {
  size?: number;
  /** dark : G bleu nuit (sur fond clair) · light : G blanc (sur fond sombre) */
  variant?: 'dark' | 'light';
  title?: string;
}) {
  const gColor = variant === 'light' ? '#FFFFFF' : '#0A1633';
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      {/* G : arc ouvert à droite */}
      <path
        d="M 33.25 46.29 A 16.5 16.5 0 1 1 33.25 17.71"
        stroke={gColor}
        strokeWidth="6"
        strokeLinecap="round"
      />
      {/* Barre du G */}
      <line x1="25" y1="32" x2="38.5" y2="32" stroke={gColor} strokeWidth="6" strokeLinecap="round" />
      {/* M : entrelacé */}
      <path
        d="M 43 48 L 43 16 L 52 38 L 61 16 L 61 48"
        stroke="#F5B82E"
        strokeWidth="5.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

/** Tuile carrée (favicon, icône app) : fond bleu nuit arrondi + monogramme. */
export function GMTile({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <rect x="0" y="0" width="64" height="64" rx="14" fill="#0A1633" />
      <path
        d="M 33.25 46.29 A 16.5 16.5 0 1 1 33.25 17.71"
        stroke="#FFFFFF"
        strokeWidth="6"
        strokeLinecap="round"
        fill="none"
      />
      <line x1="25" y1="32" x2="38.5" y2="32" stroke="#FFFFFF" strokeWidth="6" strokeLinecap="round" />
      <path
        d="M 43 48 L 43 16 L 52 38 L 61 16 L 61 48"
        stroke="#F5B82E"
        strokeWidth="5.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

/** Logo horizontal : symbole + wordmark. */
export function Logo({
  variant = 'dark',
  compact = false,
  as = 'link',
}: {
  variant?: 'dark' | 'light';
  compact?: boolean;
  as?: 'link' | 'div';
}) {
  const text = (
    <span className={`logo-word${compact ? ' logo-word--compact' : ''}`} style={variant === 'light' ? undefined : undefined}>
      <span className="logo-word__main">GODSON</span>
      <span className="logo-word__sub">MARKETPLACE</span>
    </span>
  );
  if (as === 'div') {
    return (
      <span className={`logo logo--${variant}`}>
        <GMSymbol size={compact ? 30 : 38} variant={variant} />
        {text}
      </span>
    );
  }
  return (
    <Link to="/" className={`logo logo--${variant}`} aria-label="GODSON Marketplace — accueil">
      <GMSymbol size={compact ? 30 : 38} variant={variant} title="GODSON Marketplace" />
      {text}
    </Link>
  );
}
