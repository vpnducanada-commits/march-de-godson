import { Link, Navigate } from 'react-router-dom';
import { Spinner } from '../components/ui/Spinner';
import { useAuth } from '../context/AuthContext';
import { usePageMeta } from '../hooks/usePageMeta';

/**
 * Cible du lien de réinitialisation de mot de passe (et des flux OAuth éventuels).
 * Le client Supabase traite le jeton présent dans l'URL à l'initialisation
 * (detectSessionInUrl) ; ici on attend simplement que la session soit établie,
 * puis on renvoie l'utilisateur vers son espace.
 */
export default function AuthCallback() {
  usePageMeta('Restauration de session', 'Vérification de votre session GODSON Marketplace.');
  const { session, loading } = useAuth();

  if (loading) return <Spinner label="Vérification de votre session…" />;
  if (session) return <Navigate to="/compte" replace />;

  return (
    <div className="container page-narrow" style={{ paddingTop: 48 }}>
      <h1 className="page-title">Session non restaurée</h1>
      <p className="page-sub">
        Le lien utilisé est peut-être expiré ou déjà utilisé. Demandez un nouveau lien de
        réinitialisation, puis réessayez.
      </p>
      <Link to="/connexion" className="btn btn--primary">
        Retour à la connexion
      </Link>
    </div>
  );
}
