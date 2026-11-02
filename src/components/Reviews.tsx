import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { fetchReviews, addReview } from '../lib/api';
import type { Review } from '../lib/types';
import { Icon } from './Icon';

function Stars({ n, size = 16 }: { n: number; size?: number }) {
  return (
    <span style={{ display: 'inline-flex', gap: 2 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Icon
          key={i}
          name="star"
          size={size}
          style={{
            color: i <= n ? '#f5b82e' : 'var(--border)',
            fill: i <= n ? '#f5b82e' : 'none',
          }}
        />
      ))}
    </span>
  );
}

export function SellerReviews({ sellerId }: { sellerId: string }) {
  const { session } = useAuth();
  const { toast } = useToast();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    fetchReviews(sellerId)
      .then(setReviews)
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, [sellerId]);

  useEffect(() => {
    load();
  }, [load]);

  const avg = reviews.length
    ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
    : 0;
  const isSelf = session?.user.id === sellerId;

  const submit = async () => {
    if (!session) {
      toast('info', 'Connectez-vous pour laisser un avis.');
      return;
    }
    if (isSelf) {
      toast('error', 'Vous ne pouvez pas noter votre propre profil.');
      return;
    }
    if (!comment.trim() || comment.trim().length < 10) {
      toast('error', 'Votre avis doit contenir au moins 10 caractères.');
      return;
    }
    setBusy(true);
    try {
      await addReview(sellerId, session.user.id, rating, comment.trim());
      toast('success', 'Merci pour votre avis !');
      setComment('');
      setRating(5);
      load();
    } catch (e) {
      toast('error', e instanceof Error ? e.message : 'Impossible d’enregistrer l’avis.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section style={{ marginTop: 32 }}>
      <h2 className="section__title" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span>
          Avis acheteurs {reviews.length ? `· ${avg.toFixed(1)}/5 (${reviews.length})` : ''}
        </span>
        {avg > 0 && <Stars n={Math.round(avg)} />}
      </h2>

      {loading ? (
        <p className="form-hint">Chargement des avis…</p>
      ) : reviews.length === 0 ? (
        <p className="form-hint">Aucun avis enregistré pour ce vendeur pour le moment.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
          {reviews.map((r) => (
            <div
              key={r.id}
              style={{
                border: '1px solid var(--border)',
                borderRadius: 12,
                padding: 12,
                background: 'var(--surface)',
                color: 'var(--text)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Stars n={r.rating} size={14} />
                <span style={{ fontSize: 12, color: 'var(--text-2)' }}>
                  {new Date(r.created_at).toLocaleDateString('fr-FR')}
                </span>
              </div>
              <p style={{ margin: '8px 0 0', fontSize: 14, whiteSpace: 'pre-wrap' }}>{r.comment}</p>
            </div>
          ))}
        </div>
      )}

      {!isSelf && (
        <div
          style={{
            border: '1px solid var(--border)',
            borderRadius: 12,
            padding: 14,
            background: 'var(--surface)',
          }}
        >
          <h3 style={{ margin: '0 0 8px', fontSize: 14 }}>Partager votre expérience avec ce vendeur</h3>
          <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
            {[1, 2, 3, 4, 5].map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setRating(v)}
                aria-label={`${v} étoiles`}
                style={{
                  background: v <= rating ? '#0a1633' : 'var(--bg)',
                  color: v <= rating ? '#f5b82e' : 'var(--text-2)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  padding: '6px 10px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {v} ★
              </button>
            ))}
          </div>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
            maxLength={1000}
            placeholder="Décrivez votre échange réel (réactivité, conformité de l’article…)"
            style={{
              width: '100%',
              borderRadius: 8,
              border: '1px solid var(--border)',
              background: 'var(--bg)',
              color: 'var(--text)',
              padding: 10,
            }}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8, flexWrap: 'wrap' }}>
            <button type="button" className="btn btn--primary btn--sm" onClick={() => void submit()} disabled={busy || !session}>
              {busy ? 'Envoi…' : 'Publier mon avis'}
            </button>
            {!session && (
              <Link to="/connexion" className="form-hint" style={{ margin: 0, textDecoration: 'underline' }}>
                Connectez-vous pour publier un avis
              </Link>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
