import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { fetchLocalities, updateOwnProfile } from '../lib/api';
import { supabase } from '../lib/supabase';
import type { Locality } from '../lib/types';
import { ACCOUNT_TYPE_LABELS } from '../lib/types';
import { usePageMeta } from '../hooks/usePageMeta';

export default function Settings() {
  usePageMeta('Paramètres du compte', 'Gérez votre profil, votre email et votre mot de passe.');
  const { session, profile, signOut, refreshProfile } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [localities, setLocalities] = useState<Locality[]>([]);
  const [name, setName] = useState('');
  const [pseudonym, setPseudonym] = useState('');
  const [city, setCity] = useState('');
  const [accountType, setAccountType] = useState('particulier');
  const [busy, setBusy] = useState(false);

  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [passBusy, setPassBusy] = useState(false);
  const [passError, setPassError] = useState<string | null>(null);

  useEffect(() => {
    fetchLocalities().then(setLocalities).catch(() => undefined);
    if (profile) {
      setName(profile.display_name || '');
      setPseudonym(profile.pseudonym || '');
      setCity(profile.city || '');
      setAccountType(profile.account_type);
    }
  }, [profile]);

  const onSaveProfile = async (e: FormEvent) => {
    e.preventDefault();
    if (!session?.user) return;
    setBusy(true);
    try {
      await updateOwnProfile(session.user.id, {
        display_name: name.trim() || null,
        pseudonym: pseudonym.trim() || null,
        city: city || null,
        account_type: accountType,
      });
      await refreshProfile();
      toast('success', 'Profil mis à jour.');
    } catch (err) {
      toast('error', err instanceof Error ? err.message : 'Mise à jour impossible.');
    } finally {
      setBusy(false);
    }
  };

  const onChangePassword = async (e: FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    setPassError(null);
    if (newPass.length < 6) {
      setPassError('Le nouveau mot de passe doit contenir au moins 6 caractères.');
      return;
    }
    if (newPass !== confirmPass) {
      setPassError('Les mots de passe ne correspondent pas.');
      return;
    }
    setPassBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPass });
      if (error) throw error;
      setNewPass('');
      setConfirmPass('');
      toast('success', 'Mot de passe modifié.');
    } catch (err) {
      setPassError(err instanceof Error ? err.message : 'Modification impossible.');
    } finally {
      setPassBusy(false);
    }
  };

  if (!session || !profile) return null;

  return (
    <div className="container page-narrow">
      <h1 className="page-title">Paramètres du compte</h1>
      <p className="page-sub">Vos informations de profil publiques et la sécurité du compte.</p>

      <section className="form-section">
        <h2 className="form-section__title">
          <Icon name="user" size={18} /> Profil public
        </h2>
        <p className="form-hint">
          Ces informations sont visibles par les acheteurs sur vos annonces. Votre email
          n'est jamais affiché publiquement.
        </p>
        <form onSubmit={onSaveProfile} className="form">
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="st-name">Nom affiché</label>
              <input id="st-name" type="text" maxLength={60} value={name} onChange={(e) => setName(e.target.value)} placeholder="Votre nom ou nom commercial" />
            </div>
            <div className="form-group">
              <label htmlFor="st-pseudo">Pseudonyme (facultatif)</label>
              <input id="st-pseudo" type="text" maxLength={30} value={pseudonym} onChange={(e) => setPseudonym(e.target.value)} placeholder="Ex. : vendeur-akanda" />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="st-city">Ville</label>
              <select id="st-city" value={city} onChange={(e) => setCity(e.target.value)}>
                <option value="">Non précisée</option>
                {localities.map((l) => (
                  <option key={l.id} value={l.name}>{l.name}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="st-type">Type de compte</label>
              <select id="st-type" value={accountType} onChange={(e) => setAccountType(e.target.value)}>
                {Object.entries(ACCOUNT_TYPE_LABELS).map(([v, label]) => (
                  <option key={v} value={v}>{label}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="form-actions">
            <button type="submit" className="btn btn--primary" disabled={busy}>
              {busy ? 'Enregistrement…' : 'Enregistrer le profil'}
            </button>
          </div>
        </form>
      </section>

      <section className="form-section">
        <h2 className="form-section__title">
          <Icon name="lock" size={18} /> Sécurité
        </h2>
        <p className="form-hint">Email de connexion : <strong>{session.user.email}</strong></p>
        {passError && (
          <div className="alert alert--error" role="alert">
            <Icon name="alert" size={16} />
            <span>{passError}</span>
          </div>
        )}
        <form onSubmit={onChangePassword} className="form">
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="st-pass">Nouveau mot de passe</label>
              <input id="st-pass" type="password" value={newPass} onChange={(e) => setNewPass(e.target.value)} autoComplete="new-password" placeholder="6 caractères minimum" />
            </div>
            <div className="form-group">
              <label htmlFor="st-pass2">Confirmer</label>
              <input id="st-pass2" type="password" value={confirmPass} onChange={(e) => setConfirmPass(e.target.value)} autoComplete="new-password" />
            </div>
          </div>
          <div className="form-actions">
            <button type="submit" className="btn btn--primary" disabled={passBusy || !newPass}>
              {passBusy ? 'Modification…' : 'Changer le mot de passe'}
            </button>
          </div>
        </form>
      </section>

      <section className="form-section">
        <h2 className="form-section__title">
          <Icon name="logout" size={18} /> Session
        </h2>
        <div className="form-actions">
          <button
            type="button"
            className="btn btn--danger"
            onClick={async () => {
              await signOut();
              navigate('/');
            }}
          >
            <Icon name="logout" size={16} /> Se déconnecter
          </button>
        </div>
      </section>
    </div>
  );
}
