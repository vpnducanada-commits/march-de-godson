import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { Logo } from '../components/Logo';
import { supabase } from '../lib/supabase';
import { demoMode } from '../lib/api';
import { usePageMeta } from '../hooks/usePageMeta';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';

export default function AuthPages({ mode }: { mode: 'login' | 'signup' | 'forgot' }) {
  usePageMeta(
    mode === 'login' ? 'Connexion' : mode === 'signup' ? 'Créer un compte' : 'Mot de passe oublié',
    mode === 'signup'
      ? 'Créez votre compte GODSON Marketplace gratuitement et publiez vos annonces.'
      : 'Connectez-vous pour publier et gérer vos annonces.',
  );
  const navigate = useNavigate();
  const { toast } = useToast();
  const { refreshProfile } = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const frMessage = (msg: string): string => {
    const m = msg.toLowerCase();
    if (m.includes('invalid login credentials')) return 'Email ou mot de passe incorrect.';
    if (m.includes('already registered')) return 'Un compte existe déjà avec cet email. Connectez-vous.';
    if (m.includes('at least 6') || m.includes('password')) return 'Le mot de passe doit contenir au moins 6 caractères.';
    if (m.includes('valid email')) return 'Adresse email invalide.';
    if (m.includes('rate limit')) return 'Trop de tentatives. Réessayez dans quelques minutes.';
    if (m.includes('failed to fetch') || m.includes('network')) return 'Connexion au serveur impossible. Vérifiez votre réseau.';
    return msg;
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!supabase) {
      setError('La connexion nécessite la configuration de Supabase (variables d\'environnement).');
      return;
    }
    setError(null);
    setInfo(null);
    if (mode === 'signup' && password !== confirm) {
      setError('Les deux mots de passe ne correspondent pas.');
      return;
    }
    setBusy(true);
    try {
      if (mode === 'login') {
        const { data, error: err } = await supabase.auth.signInWithPassword({ email, password });
        if (err) throw err;
        if (data.user?.email_confirmed_at === null) {
          setInfo('Votre email n\u2019est pas encore confirmé. Vérifiez votre boîte de réception.');
        } else {
          toast('success', 'Connexion réussie. Bienvenue !');
          await refreshProfile();
          navigate('/compte');
        }
      } else if (mode === 'signup') {
        const { error: err } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { name: name.trim() || undefined } },
        });
        if (err) throw err;
        toast('success', 'Compte créé ! Vous pouvez maintenant vous connecter.');
        navigate('/connexion');
      } else {
        // Le lien de l'e-mail amène sur /auth/callback : le code PKCE y est
        // échangé automatiquement (detectSessionInUrl) et la page redirige
        // vers les paramètres, où l'utilisateur choisit son nouveau mot de passe.
        const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth/callback`,
        });
        if (err) throw err;
        setInfo(
          'Si cet email existe sur la plateforme, un lien vient de vous être envoyé. Suivez-le : vous serez reconnecté directement à votre espace, rubrique « Mot de passe », pour choisir un nouveau mot de passe.',
        );
      }
    } catch (err) {
      setError(frMessage(err instanceof Error ? err.message : 'Une erreur est survenue.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-card__brand">
          <Logo variant="dark" as="div" />
        </div>
        <h1 className="auth-card__title">
          {mode === 'login' ? 'Bon retour parmi nous' : mode === 'signup' ? 'Créez votre compte' : 'Mot de passe oublié'}
        </h1>
        <p className="auth-card__sub">
          {mode === 'login'
            ? 'Connectez-vous pour publier, modifier et suivre vos annonces.'
            : mode === 'signup'
              ? 'Gratuit et sans carte bancaire. Quelques secondes suffisent.'
              : 'Saisissez votre email : nous vous enverrons un lien pour choisir un nouveau mot de passe.'}
        </p>

        {demoMode && (
          <div className="alert alert--info">
            <Icon name="info" size={16} />
            <span>Environnement non configuré : renseignez les variables Supabase pour activer la connexion.</span>
          </div>
        )}
        {error && (
          <div className="alert alert--error" role="alert">
            <Icon name="alert" size={16} />
            <span>{error}</span>
          </div>
        )}
        {info && (
          <div className="alert alert--success" role="status">
            <Icon name="check-circle" size={16} />
            <span>{info}</span>
          </div>
        )}

        <form onSubmit={onSubmit} noValidate>
          {mode === 'signup' && (
            <div className="form-group">
              <label htmlFor="au-name">Nom complet ou nom d'affichage</label>
              <input id="au-name" type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex. : Mariam N." autoComplete="name" />
            </div>
          )}
          <div className="form-group">
            <label htmlFor="au-email">Adresse email</label>
            <input id="au-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="vous@exemple.com" autoComplete="email" required />
          </div>
          {mode !== 'forgot' && (
            <>
              <div className="form-group">
                <label htmlFor="au-pass">Mot de passe</label>
                <input id="au-pass" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="6 caractères minimum" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required />
              </div>
              {mode === 'signup' && (
                <div className="form-group">
                  <label htmlFor="au-confirm">Confirmer le mot de passe</label>
                  <input id="au-confirm" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Répétez le mot de passe" autoComplete="new-password" required />
                </div>
              )}
            </>
          )}
          <button type="submit" className="btn btn--primary btn--lg btn--block" disabled={busy}>
            {busy ? 'Veuillez patienter…' : mode === 'login' ? 'Se connecter' : mode === 'signup' ? 'Créer mon compte' : 'Envoyer le lien'}
          </button>
        </form>

        <div className="auth-card__links">
          {mode === 'login' && (
            <>
              <Link to="/inscription">Pas encore de compte ? Inscrivez-vous</Link>
              <Link to="/mot-de-passe">Mot de passe oublié ?</Link>
            </>
          )}
          {mode === 'signup' && <Link to="/connexion">Déjà inscrit ? Connectez-vous</Link>}
          {mode === 'forgot' && <Link to="/connexion">Retour à la connexion</Link>}
        </div>
      </div>
    </div>
  );
}
