/**
 * Logo officiel GODSON MARKETPLACE (fourni par la marque).
 *
 * Assets (public/) :
 *  - /logo-symbol.png : le symbole (G + swoosh) sur fond clair, pour le header
 *  - /logo.png        : logo complet symbole + wordmark, pour les pages
 *
 * Le symbole est un raster sur fond #FDFDFD : sur les zones sombres il est
 * présenté dans une tuile claire arrondie (classe `.logo__mark`).
 */
import { Link } from 'react-router-dom';

/** Symbole du logo dans sa tuile (header, 404…). */
export function LogoMark({ size = 38, title }: { size?: number; title?: string }) {
  return (
    <img
      src="/logo-symbol.png"
      alt={title ? '' : undefined}
      title={title}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      className="logo__mark"
      width={size}
      height={size}
      style={{ width: size, height: size }}
      loading="eager"
    />
  );
}

/** Alias de LogoMark : tuile carrée (favicon, icône app, page 404). */
export function GMTile({ size = 64 }: { size?: number }) {
  return <LogoMark size={size} />;
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
  const size = compact ? 30 : 38;
  const content = (
    <>
      <LogoMark size={size} title="GODSON Marketplace" />
      <span className={`logo-word${compact ? ' logo-word--compact' : ''}`}>
        <span className="logo-word__main">GODSON</span>
        <span className="logo-word__sub">MARKETPLACE</span>
      </span>
    </>
  );
  if (as === 'div') {
    return <span className={`logo logo--${variant}`}>{content}</span>;
  }
  return (
    <Link to="/" className={`logo logo--${variant}`} aria-label="GODSON Marketplace — accueil">
      {content}
    </Link>
  );
}
