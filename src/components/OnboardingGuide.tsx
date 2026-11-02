import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from './Icon';
import { useAuth } from '../context/AuthContext';

const HIDE_KEY = 'gm:guide_hidden_v28';

interface StepItem {
  num: string;
  icon: string;
  title: string;
  desc: string;
  ctaLabel: string;
  to: string;
}

export function OnboardingGuide() {
  const { session } = useAuth();
  const [mode, setMode] = useState<'buy' | 'sell'>('buy');
  const [hidden, setHidden] = useState<boolean>(() => {
    try {
      return window.localStorage.getItem(HIDE_KEY) === '1';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const onShow = () => {
      try {
        window.localStorage.removeItem(HIDE_KEY);
      } catch {
        // ignore
      }
      setHidden(false);
    };
    window.addEventListener('gm:show-guide', onShow);
    return () => window.removeEventListener('gm:show-guide', onShow);
  }, []);

  const toggleHide = (next: boolean) => {
    try {
      if (next) window.localStorage.setItem(HIDE_KEY, '1');
      else window.localStorage.removeItem(HIDE_KEY);
    } catch {
      // ignore
    }
    setHidden(next);
  };

  const buySteps: StepItem[] = [
    {
      num: '01',
      icon: 'search',
      title: 'Trouvez près de chez vous',
      desc: 'Filtrez par ville (Libreville, Port-Gentil, Franceville…) ou activez « Autour de moi » pour trier par proximité.',
      ctaLabel: 'Ouvrir le catalogue',
      to: '/annonces',
    },
    {
      num: '02',
      icon: 'at-sign',
      title: 'Vérifiez l’annonce et le vendeur',
      desc: 'Consultez les photos ou la vidéo, le point de rencontre sur carte, les avis et le profil @pseudo du vendeur.',
      ctaLabel: 'Chercher un @membre',
      to: '/utilisateurs',
    },
    {
      num: '03',
      icon: 'shield',
      title: 'Contactez et payez prudemment',
      desc: 'Discutez par messagerie ou WhatsApp. Privilégiez la vérification en lieu public et le paiement à la livraison.',
      ctaLabel: 'Conseils sécurité',
      to: '/securite',
    },
  ];

  const sellSteps: StepItem[] = [
    {
      num: '01',
      icon: 'user-plus',
      title: session ? 'Personnalisez votre @pseudo' : 'Créez un compte gratuit',
      desc: session
        ? 'Ajoutez une photo de profil, un @nom_d’utilisateur unique et l’adresse de votre boutique.'
        : 'Inscription gratuite en moins d’une minute pour déposer vos annonces et recevoir vos messages.',
      ctaLabel: session ? 'Profil & @pseudo' : 'Créer un compte',
      to: session ? '/compte/parametres' : '/inscription',
    },
    {
      num: '02',
      icon: 'camera',
      title: 'Déposez l’annonce gratuitement',
      desc: 'Ajoutez jusqu’à 6 photos, 1 vidéo produit (max 3 min), le prix en FCFA et votre position GPS.',
      ctaLabel: 'Publier une annonce',
      to: '/publier',
    },
    {
      num: '03',
      icon: 'bell',
      title: 'Suivez vos messages et alertes',
      desc: 'Répondez aux acheteurs en temps réel et gérez vos annonces actives pendant 90 jours renouvelables.',
      ctaLabel: session ? 'Mon espace' : 'Télécharger l’APK',
      to: session ? '/compte' : '/application',
    },
  ];

  if (hidden) {
    return (
      <div className="container" style={{ marginTop: 14 }}>
        <button
          type="button"
          className="onboarding-restore"
          onClick={() => toggleHide(false)}
        >
          <Icon name="book" size={15} />
          <span>Nouveau sur GODSON ? Afficher le guide pas à pas</span>
          <Icon name="chevron-right" size={15} />
        </button>
      </div>
    );
  }

  const steps = mode === 'buy' ? buySteps : sellSteps;

  return (
    <section className="section onboarding-sec" aria-label="Guide pour bien débuter">
      <div className="container">
        <div className="onboarding-card">
          <div className="onboarding-card__top">
            <div>
              <span className="onboarding-badge">
                <Icon name="sparkles" size={14} /> Bien débuter sur GODSON
              </span>
              <h2 className="onboarding-card__title">Comment utiliser la plateforme en 3 étapes</h2>
            </div>

            <div className="onboarding-card__controls">
              <div className="onboarding-tabs" role="tablist" aria-label="Choisir votre parcours">
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === 'buy'}
                  className={`onboarding-tab${mode === 'buy' ? ' onboarding-tab--active' : ''}`}
                  onClick={() => setMode('buy')}
                >
                  Je veux acheter
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === 'sell'}
                  className={`onboarding-tab${mode === 'sell' ? ' onboarding-tab--active' : ''}`}
                  onClick={() => setMode('sell')}
                >
                  Je veux vendre
                </button>
              </div>
              <button
                type="button"
                className="icon-btn onboarding-close"
                aria-label="Masquer le guide débutant"
                title="Masquer ce guide"
                onClick={() => toggleHide(true)}
              >
                <Icon name="x" size={18} />
              </button>
            </div>
          </div>

          <div className="onboarding-grid">
            {steps.map((st) => (
              <div key={st.num + mode} className="onboarding-step">
                <div className="onboarding-step__head">
                  <span className="onboarding-step__icon">
                    <Icon name={st.icon} size={18} />
                  </span>
                  <span className="onboarding-step__num">Étape {st.num}</span>
                </div>
                <h3 className="onboarding-step__title">{st.title}</h3>
                <p className="onboarding-step__desc">{st.desc}</p>
                <Link to={st.to} className="onboarding-step__link">
                  <span>{st.ctaLabel}</span>
                  <Icon name="chevron-right" size={15} />
                </Link>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
