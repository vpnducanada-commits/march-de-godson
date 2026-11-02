import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from './Icon';

const QA = [
  {
    q: 'Comment trouver un vendeur par @pseudo ou ID ?',
    kw: 'pseudo username membre vendeur identifiant id chercher suivre',
    a: 'Ouvrez Chercher un membre (/utilisateurs) ou tapez directement @pseudo ou #ID dans la barre de recherche pour ouvrir sa boutique publique et cliquer sur Suivre.',
  },
  {
    q: 'Comment publier une annonce ?',
    kw: 'publier vendre annonce gratuit photo',
    a: 'Ouvrez Publier, choisissez le titre et la catégorie, ajoutez vos photos (et une vidéo optionnelle), indiquez le prix en FCFA et vos coordonnées, puis validez. Gratuit et illimité.',
  },
  {
    q: 'Puis-je ajouter une vidéo du produit ?',
    kw: 'video mp4 webm duree taille mo minute',
    a: 'Oui : 1 vidéo optionnelle par annonce (MP4, WebM ou MOV), durée maximale 3:00 et poids maximal 80 Mo.',
  },
  {
    q: 'Comment indiquer un lieu de rencontre ?',
    kw: 'localisation carte gps point rencontre autour distance',
    a: 'Dans le formulaire d’annonce ou vos paramètres boutique, renseignez un repère public ou utilisez votre position pour afficher la carte et l’itinéraire.',
  },
  {
    q: 'Comment contacter un vendeur et payer ?',
    kw: 'contacter whatsapp appeler paiement airtel money livraison',
    a: 'Sur la fiche annonce, utilisez Message, WhatsApp ou Appeler. Le paiement Airtel Money se convient directement entre acheteur et vendeur ; privilégiez le paiement à la livraison en cas de doute.',
  },
  {
    q: 'Mon annonce a expiré (90 jours) ?',
    kw: 'expiree renouveler reprendre 90 jours espace',
    a: 'Chaque annonce reste active 90 jours. Rendez-vous dans Mon espace puis cliquez sur Reprendre (90 j) gratuitement.',
  },
  {
    q: 'Installer l’application ou télécharger l’APK ?',
    kw: 'apk installer application android iphone telecharger',
    a: 'Ouvrez la page Application (/application) pour télécharger directement le fichier APK Android ou installer la version plein écran en un clic.',
  },
  {
    q: 'Comment signaler une arnaque ?',
    kw: 'signaler arnaque abus fraude modération',
    a: 'Ouvrez la fiche concernée, cliquez sur Signaler l’annonce et précisez le motif. L’équipe de modération examine chaque signalement.',
  },
];

export function HelpBot() {
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState<number | null>(0);
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return QA;
    return QA.filter(
      (item) =>
        item.q.toLowerCase().includes(q) ||
        item.a.toLowerCase().includes(q) ||
        item.kw.includes(q),
    );
  }, [query]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? 'Fermer l’aide' : 'Ouvrir l’aide'}
        aria-expanded={open}
        style={{
          position: 'fixed',
          right: 14,
          bottom: 78,
          width: 52,
          height: 52,
          borderRadius: '50%',
          background: '#0a1633',
          color: '#f5b82e',
          border: '1px solid rgba(245, 184, 46, 0.35)',
          boxShadow: '0 4px 14px rgba(0,0,0,0.32)',
          display: 'grid',
          placeItems: 'center',
          zIndex: 900,
        }}
      >
        <Icon name={open ? 'x' : 'help-circle'} size={24} />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Centre d’aide"
          style={{
            position: 'fixed',
            right: 14,
            bottom: 140,
            width: 332,
            maxWidth: 'calc(100vw - 28px)',
            background: 'var(--surface)',
            color: 'var(--text)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            boxShadow: 'var(--shadow-lg)',
            zIndex: 901,
            overflow: 'hidden',
          }}
        >
          <div style={{ padding: '12px 14px', background: '#0a1633', color: '#fff', fontWeight: 700, fontSize: 14 }}>
            Centre d’aide — réponses instantanées
          </div>

          <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)', background: 'var(--surface-2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Icon name="search" size={15} />
              <input
                type="search"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setSel(0);
                }}
                placeholder="Rechercher un sujet (APK, vidéo, paiement…)"
                aria-label="Rechercher dans l’aide"
                style={{
                  width: '100%',
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--text)',
                  fontSize: 13,
                  outline: 'none',
                }}
              />
            </div>
          </div>

          <div style={{ maxHeight: 300, overflowY: 'auto' }}>
            {filtered.length > 0 ? (
              filtered.map((x, i) => {
                const isOpen = sel === i || query.trim().length > 0;
                return (
                  <div key={x.q} style={{ borderBottom: '1px solid var(--border)' }}>
                    <button
                      type="button"
                      onClick={() => setSel(sel === i ? null : i)}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        background: 'none',
                        color: 'var(--text)',
                        border: 'none',
                        padding: '11px 14px',
                        fontWeight: 600,
                        fontSize: 13,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: 8,
                      }}
                    >
                      <span>{x.q}</span>
                      <Icon name={isOpen ? 'chevron-up' : 'chevron-down'} size={14} />
                    </button>
                    {isOpen && (
                      <div style={{ padding: '0 14px 12px', fontSize: 13, color: 'var(--text-2)', lineHeight: 1.5 }}>
                        {x.a}
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <div style={{ padding: '14px', fontSize: 13, color: 'var(--text-2)', lineHeight: 1.5 }}>
                Aucun sujet exact trouvé pour « {query.trim()} ». Consultez la{' '}
                <Link to="/faq" onClick={() => setOpen(false)} style={{ fontWeight: 600 }}>
                  FAQ complète
                </Link>{' '}
                ou écrivez directement à votre interlocuteur dans{' '}
                <Link to="/messages" onClick={() => setOpen(false)} style={{ fontWeight: 600 }}>
                  Messages
                </Link>
                .
              </div>
            )}
          </div>

          <div
            style={{
              padding: '9px 14px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: 12,
              background: 'var(--surface-2)',
              color: 'var(--text-2)',
            }}
          >
            <Link to="/faq" onClick={() => setOpen(false)} style={{ fontWeight: 600 }}>
              FAQ complète
            </Link>
            <Link to="/messages" onClick={() => setOpen(false)} style={{ fontWeight: 600 }}>
              Ouvrir Messages →
            </Link>
          </div>
        </div>
      )}
    </>
  );
}
