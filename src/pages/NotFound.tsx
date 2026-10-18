import { Link } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { GMTile } from '../components/Logo';
import { usePageMeta } from '../hooks/usePageMeta';

export default function NotFound() {
  usePageMeta('Page introuvable', "La page demandée n'existe pas ou a été déplacée.");
  return (
    <div className="container notfound">
      <GMTile size={64} />
      <p className="notfound__code">404</p>
      <h1 className="page-title">Page introuvable</h1>
      <p className="page-sub">
        Cette page n'existe pas, a été déplacée ou l'annonce a été retirée.
      </p>
      <div className="notfound__actions">
        <Link to="/" className="btn btn--primary">
          <Icon name="home" size={16} /> Retour à l'accueil
        </Link>
        <Link to="/annonces" className="btn btn--ghost">
          <Icon name="grid" size={16} /> Parcourir le catalogue
        </Link>
      </div>
    </div>
  );
}
