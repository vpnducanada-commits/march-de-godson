import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import {
  fetchLocalities,
  removeProfileAvatar,
  updateOwnProfile,
  uploadProfileAvatar,
} from '../lib/api';
import { processImage, validateImage } from '../lib/images';
import { safeMediaUrl, validateStrongPassword } from '../lib/security';
import { requestUserPosition } from '../lib/geolocation';
import { supabase } from '../lib/supabase';
import type { Locality } from '../lib/types';
import { ACCOUNT_TYPE_LABELS, shortUserId } from '../lib/types';
import { formatDate } from '../lib/format';
import { usePageMeta } from '../hooks/usePageMeta';

const USERNAME_RE = /^[a-z0-9_.-]{3,24}$/;
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export default function Settings() {
  usePageMeta('Paramètres du compte', 'Gérez votre photo de profil, votre nom d’utilisateur et la sécurité du compte.');
  const { session, profile, signOut, refreshProfile } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const avatarInputRef = useRef<HTMLInputElement | null>(null);

  const [localities, setLocalities] = useState<Locality[]>([]);
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [pseudonym, setPseudonym] = useState('');
  const [city, setCity] = useState('');
  const [accountType, setAccountType] = useState('particulier');
  const [busy, setBusy] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [shopLabel, setShopLabel] = useState(profile?.shop_label || '');
  const [shopLocating, setShopLocating] = useState(false);

  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [passBusy, setPassBusy] = useState(false);
  const [passError, setPassError] = useState<string | null>(null);

  useEffect(() => {
    fetchLocalities().then(setLocalities).catch(() => undefined);
    if (profile) {
      setName(profile.display_name || '');
      setUsername(profile.username || '');
      setPseudonym(profile.pseudonym || '');
      setCity(profile.city || '');
      setAccountType(profile.account_type);
      setShopLabel(profile.shop_label || '');
    }
  }, [profile]);

  const usernameLock = useMemo(() => {
    const raw = profile?.username_updated_at;
    if (!raw) return { locked: false, daysLeft: 0, unlockDate: null as string | null };
    const updatedMs = new Date(raw).getTime();
    if (Number.isNaN(updatedMs)) return { locked: false, daysLeft: 0, unlockDate: null };
    const unlockMs = updatedMs + THIRTY_DAYS_MS;
    const diff = unlockMs - Date.now();
    if (diff <= 0) return { locked: false, daysLeft: 0, unlockDate: null };
    return {
      locked: true,
      daysLeft: Math.max(1, Math.ceil(diff / (24 * 60 * 60 * 1000))),
      unlockDate: new Date(unlockMs).toISOString(),
    };
  }, [profile?.username_updated_at]);

  const onAvatarSelect = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (avatarInputRef.current) avatarInputRef.current.value = '';
    if (!file || !session?.user) return;
    const validationErr = validateImage(file);
    if (validationErr) {
      toast('error', validationErr);
      return;
    }
    setAvatarBusy(true);
    try {
      const blob = await processImage(file);
      await uploadProfileAvatar(session.user.id, blob);
      await refreshProfile();
      toast('success', 'Photo de profil enregistrée.');
    } catch (err) {
      toast('error', err instanceof Error ? err.message : 'Envoi de la photo impossible.');
    } finally {
      setAvatarBusy(false);
    }
  };

  const onRemoveAvatar = async () => {
    if (!session?.user || !profile?.avatar_url || avatarBusy) return;
    setAvatarBusy(true);
    try {
      await removeProfileAvatar(session.user.id);
      await refreshProfile();
      toast('info', 'Photo de profil retirée.');
    } catch (err) {
      toast('error', err instanceof Error ? err.message : 'Impossible de retirer la photo.');
    } finally {
      setAvatarBusy(false);
    }
  };

  const onSaveProfile = async (e: FormEvent) => {
    e.preventDefault();
    if (!session?.user || !profile) return;

    const cleanUsername = username.trim().replace(/^@+/, '').toLowerCase();
    const currentUsername = (profile.username || '').trim().toLowerCase();
    const usernameChanged = cleanUsername !== currentUsername;

    if (usernameChanged) {
      if (usernameLock.locked) {
        toast(
          'error',
          `Votre nom d’utilisateur pourra être modifié à nouveau dans ${usernameLock.daysLeft} jour(s).`,
        );
        return;
      }
      if (!USERNAME_RE.test(cleanUsername)) {
        toast(
          'error',
          'Nom d’utilisateur invalide : utilisez 3 à 24 caractères (lettres sans accent, chiffres, point, tiret ou underscore).',
        );
        return;
      }
    }

    setBusy(true);
    try {
      const patch: Record<string, unknown> = {
        display_name: name.trim() || null,
        pseudonym: pseudonym.trim() || null,
        city: city || null,
        account_type: accountType,
      };
      if (usernameChanged) {
        patch.username = cleanUsername;
      }
      await updateOwnProfile(session.user.id, patch);
      await refreshProfile();
      toast(
        'success',
        usernameChanged
          ? `Profil et nom d’utilisateur (@${cleanUsername}) mis à jour.`
          : 'Profil mis à jour.',
      );
    } catch (err) {
      toast('error', err instanceof Error ? err.message : 'Mise à jour impossible.');
    } finally {
      setBusy(false);
    }
  };

  const onLocateShop = async () => {
    if (!session?.user || shopLocating) return;
    setShopLocating(true);
    try {
      const coords = await requestUserPosition();
      await updateOwnProfile(session.user.id, {
        shop_lat: coords.latitude,
        shop_lng: coords.longitude,
      });
      await refreshProfile();
      toast('success', 'Position de votre boutique enregistrée.');
    } catch (err) {
      toast('error', err instanceof Error ? err.message : 'Localisation refusée ou indisponible.');
    } finally {
      setShopLocating(false);
    }
  };

  const onChangePassword = async (e: FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    setPassError(null);
    const pwErr = validateStrongPassword(newPass);
    if (pwErr) {
      setPassError(pwErr);
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

  const copyText = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast('success', `${label} copié.`);
    } catch {
      toast('error', 'Copie automatique impossible sur cet appareil.');
    }
  };

  if (!session || !profile) return null;

  const shortId = shortUserId(profile.id);
  const avatarInitial = (profile.display_name || profile.username || session.user.email || 'U')
    .slice(0, 1)
    .toUpperCase();

  return (
    <div className="container page-narrow">
      <div className="page-head">
        <div>
          <h1 className="page-title">Paramètres du compte</h1>
          <p className="page-sub">
            Photo de profil, nom d’utilisateur (@pseudo), identifiant unique et sécurité.
          </p>
        </div>
        <Link to={`/vendeur/${profile.username || profile.id}`} className="btn btn--ghost btn--sm">
          <Icon name="eye" size={15} /> Voir mon profil public
        </Link>
      </div>

      {/* PHOTO DE PROFIL & IDENTIFIANT UNIQUE */}
      <section className="form-section">
        <h2 className="form-section__title">
          <Icon name="camera" size={18} /> Photo de profil & Identifiant
        </h2>
        <div className="profile-avatar-editor">
          <div className="profile-avatar-editor__preview">
            {safeMediaUrl(profile.avatar_url) ? (
              <img src={safeMediaUrl(profile.avatar_url)!} alt="Votre photo de profil" />
            ) : (
              <span>{avatarInitial}</span>
            )}
          </div>
          <div className="profile-avatar-editor__body">
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={onAvatarSelect}
                hidden
              />
              <button
                type="button"
                className="btn btn--primary btn--sm"
                disabled={avatarBusy}
                onClick={() => avatarInputRef.current?.click()}
              >
                <Icon name="upload" size={15} />{' '}
                {avatarBusy
                  ? 'Envoi en cours…'
                  : profile.avatar_url
                    ? 'Changer la photo'
                    : 'Ajouter une photo'}
              </button>
              {profile.avatar_url && (
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  disabled={avatarBusy}
                  onClick={onRemoveAvatar}
                >
                  <Icon name="trash" size={14} /> Retirer
                </button>
              )}
            </div>
            <p className="form-hint" style={{ margin: '8px 0 0' }}>
              JPG, PNG ou WebP (optimisée automatiquement). Affichée sur vos annonces et votre boutique.
            </p>
            <div className="id-badges-row">
              {profile.username && (
                <button
                  type="button"
                  className="id-chip"
                  onClick={() => void copyText(`@${profile.username}`, 'Nom d’utilisateur')}
                  title="Copier votre @nom_d_utilisateur"
                >
                  <Icon name="at-sign" size={13} />
                  <span>@{profile.username}</span>
                  <Icon name="copy" size={12} />
                </button>
              )}
              <button
                type="button"
                className="id-chip"
                onClick={() => void copyText(shortId, 'ID court')}
                title="Copier votre ID court"
              >
                <span>ID #{shortId}</span>
                <Icon name="copy" size={12} />
              </button>
              <button
                type="button"
                className="id-chip id-chip--muted"
                onClick={() => void copyText(profile.id, 'Identifiant complet')}
                title="Copier votre UUID complet"
              >
                <span>Copier l’ID complet</span>
                <Icon name="copy" size={12} />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* PROFIL PUBLIC & @USERNAME (30 JOURS) */}
      <section className="form-section">
        <h2 className="form-section__title">
          <Icon name="user" size={18} /> Profil public & Nom d’utilisateur
        </h2>
        <p className="form-hint">
          Les autres membres peuvent vous trouver directement en tapant votre{' '}
          <strong>@nom_d_utilisateur</strong> ou votre <strong>ID (#{shortId})</strong> dans la recherche.
        </p>
        <form onSubmit={onSaveProfile} className="form">
          <div className="form-group">
            <label htmlFor="st-username">
              Nom d’utilisateur unique (@pseudo) — modifiable tous les 30 jours
            </label>
            <div className="username-input-wrap">
              <span className="username-input-wrap__prefix" aria-hidden="true">
                @
              </span>
              <input
                id="st-username"
                type="text"
                maxLength={24}
                value={username}
                disabled={usernameLock.locked}
                onChange={(e) =>
                  setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_.-]/g, ''))
                }
                placeholder="ex: gedeon_okana"
                autoComplete="off"
                spellCheck={false}
              />
            </div>
            {usernameLock.locked ? (
              <span className="username-status username-status--locked">
                <Icon name="lock" size={13} />
                Verrouillé pendant 30 jours — prochain changement possible le{' '}
                <strong>{formatDate(usernameLock.unlockDate!)}</strong> (dans{' '}
                {usernameLock.daysLeft} jour{usernameLock.daysLeft > 1 ? 's' : ''}).
              </span>
            ) : (
              <span className="username-status username-status--open">
                <Icon name="check-circle" size={13} />
                Changement disponible maintenant (sera ensuite verrouillé pendant 30 jours).
              </span>
            )}
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="st-name">Nom affiché</label>
              <input
                id="st-name"
                type="text"
                maxLength={60}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Votre nom ou nom commercial"
              />
            </div>
            <div className="form-group">
              <label htmlFor="st-pseudo">Surnom commercial (facultatif)</label>
              <input
                id="st-pseudo"
                type="text"
                maxLength={30}
                value={pseudonym}
                onChange={(e) => setPseudonym(e.target.value)}
                placeholder="Ex. : Boutique Akanda"
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="st-city">Ville</label>
              <select id="st-city" value={city} onChange={(e) => setCity(e.target.value)}>
                <option value="">Non précisée</option>
                {localities.map((l) => (
                  <option key={l.id} value={l.name}>
                    {l.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="st-type">Type de compte</label>
              <select
                id="st-type"
                value={accountType}
                onChange={(e) => setAccountType(e.target.value)}
              >
                {Object.entries(ACCOUNT_TYPE_LABELS).map(([v, label]) => (
                  <option key={v} value={v}>
                    {label}
                  </option>
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

      {/* BOUTIQUE & LOCALISATION */}
      <section className="form-section">
        <h2 className="form-section__title">
          <Icon name="store" size={18} /> Ma boutique / point de retrait
        </h2>
        <p className="form-hint">
          Aidez les acheteurs à vous situer. Au clic sur « Utiliser ma position », votre appareil vous demandera d’autoriser l’accès à la localisation.
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
          <button
            type="button"
            className="btn btn--ghost"
            disabled={shopLocating}
            onClick={onLocateShop}
          >
            <Icon name="map-pin" size={15} />{' '}
            {shopLocating ? 'Demande de localisation…' : 'Utiliser ma position'}
          </button>
          {profile.shop_lat && profile.shop_lng && (
            <button
              type="button"
              className="btn btn--ghost"
              onClick={async () => {
                try {
                  await updateOwnProfile(session.user.id, { shop_lat: null, shop_lng: null });
                  await refreshProfile();
                  toast('info', 'Coordonnées GPS retirées.');
                } catch (e) {
                  toast('error', e instanceof Error ? e.message : 'Erreur.');
                }
              }}
            >
              <Icon name="x" size={14} /> Retirer le point GPS
            </button>
          )}
        </div>
        <div className="form-group">
          <label htmlFor="st-shop-label">Libellé du lieu (quartier, marché, galerie…)</label>
          <input
            id="st-shop-label"
            value={shopLabel}
            onChange={(e) => setShopLabel(e.target.value)}
            placeholder="Ex. : Marché Mont-Bouët, allée 12"
          />
        </div>
        <div className="form-actions" style={{ marginTop: 10 }}>
          <button
            type="button"
            className="btn btn--primary"
            onClick={async () => {
              try {
                await updateOwnProfile(session.user.id, { shop_label: shopLabel.trim() || null });
                await refreshProfile();
                toast('success', 'Boutique mise à jour.');
              } catch (e) {
                toast('error', e instanceof Error ? e.message : 'Erreur.');
              }
            }}
          >
            Enregistrer la boutique
          </button>
        </div>
        {Number.isFinite(profile.shop_lat) && Number.isFinite(profile.shop_lng) && (
          <div
            style={{
              marginTop: 12,
              border: '1px solid var(--border)',
              borderRadius: 12,
              overflow: 'hidden',
            }}
          >
            <iframe
              title="Boutique"
              width="100%"
              height="180"
              loading="lazy"
              sandbox="allow-scripts allow-same-origin"
              referrerPolicy="no-referrer"
              style={{ border: 0 }}
              src={`https://www.openstreetmap.org/export/embed.html?bbox=${Number(profile.shop_lng) - 0.008}%2C${Number(profile.shop_lat) - 0.008}%2C${Number(profile.shop_lng) + 0.008}%2C${Number(profile.shop_lat) + 0.008}&layer=mapnik&marker=${Number(profile.shop_lat)}%2C${Number(profile.shop_lng)}`}
            />
          </div>
        )}
      </section>

      {/* SÉCURITÉ */}
      <section className="form-section">
        <h2 className="form-section__title">
          <Icon name="lock" size={18} /> Sécurité
        </h2>
        <p className="form-hint">
          Email de connexion : <strong>{session.user.email}</strong>
        </p>
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
              <input
                id="st-pass"
                type="password"
                value={newPass}
                onChange={(e) => setNewPass(e.target.value)}
                autoComplete="new-password"
                placeholder="8 caractères min. (lettres + chiffres)"
              />
            </div>
            <div className="form-group">
              <label htmlFor="st-pass2">Confirmer</label>
              <input
                id="st-pass2"
                type="password"
                value={confirmPass}
                onChange={(e) => setConfirmPass(e.target.value)}
                autoComplete="new-password"
              />
            </div>
          </div>
          <div className="form-actions">
            <button type="submit" className="btn btn--primary" disabled={passBusy || !newPass}>
              {passBusy ? 'Modification…' : 'Changer le mot de passe'}
            </button>
          </div>
        </form>
      </section>

      {/* SESSION */}
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
