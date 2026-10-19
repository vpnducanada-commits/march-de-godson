import { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import { Link } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { APP_VERSION } from '../lib/version';
import { usePageMeta } from '../hooks/usePageMeta';
import { usePwaInstall } from '../hooks/usePwaInstall';

const SITE_URL = import.meta.env.VITE_SITE_URL || 'https://godson-marketplace.vercel.app';

type Step = { icon: Parameters<typeof Icon>[0]['name']; title: string; body: React.ReactNode };

export default function DownloadApp() {
  usePageMeta(
    'application',
    'Téléchargez l’application GODSON Marketplace : le marché gabonais en plein écran, rapide et gratuit, sur votre téléphone.',
  );
  const { canInstall, installed, isStandalone, promptInstall } = usePwaInstall();
  const [busy, setBusy] = useState(false);
  const [qrUrl, setQrUrl] = useState<string | null>(null);

  useEffect(() => {
    QRCode.toDataURL(SITE_URL, {
      width: 240,
      margin: 1,
      color: { dark: '#0a1633', light: '#ffffff' },
      errorCorrectionLevel: 'M',
    })
      .then(setQrUrl)
      .catch((e) => console.warn('QR : génération impossible', e));
  }, []);

  const onInstall = async () => {
    setBusy(true);
    try {
      await promptInstall();
    } finally {
      setBusy(false);
    }
  };

  const platforms = useMemo<Step[]>(
    () => [
      {
        icon: 'smartphone',
        title: 'Android (Chrome)',
        body: (
          <>
            Ouvrez le site, menu <strong>⋮</strong> puis <strong>« Installer l’application »</strong>
            (ou « Ajouter à l’écran d’accueil »).
          </>
        ),
      },
      {
        icon: 'download',
        title: 'iPhone / iPad (Safari)',
        body: (
          <>
            Touche <strong>Partager</strong> <Icon name="share" size={14} /> puis <strong>
            « Sur l’écran d’accueil »</strong>.
          </>
        ),
      },
      {
        icon: 'monitor',
        title: 'Ordinateur (Chrome / Edge)',
        body: <>Icône d’installation dans la barre d’adresse, ou bouton ci-dessus.</>,
      },
    ],
    [],
  );

  return (
    <div className="container download">
      <div className="page-head">
        <div>
          <h1 className="page-title">L’application GODSON Marketplace</h1>
          <p className="page-sub">
            Le même marché, en plein écran et sans la barre du navigateur. Gratuit, rapide,
            fonctionne même avec une connexion limitée.
          </p>
        </div>
      </div>

      <div className="download__grid">
        {/* Carte principale */}
        <section className="card download__main">
          <div className="download__brand">
            <img src="/icons/icon-192.png" alt="" width={72} height={72} />
            <div>
              <p className="download__name">GODSON Marketplace</p>
              <p className="download__meta">
                {APP_VERSION} · Gratuit · PWA installable
              </p>
            </div>
          </div>

          {installed || isStandalone ? (
            <div className="download__state download__state--ok">
              <Icon name="check" size={22} />
              <div>
                <p className="download__state-title">Application déjà installée</p>
                <p className="download__state-body">
                  Elle est sur votre écran d’accueil. Merci !
                </p>
              </div>
            </div>
          ) : canInstall ? (
            <button type="button" className="btn btn--gold btn--lg btn--block" onClick={onInstall} disabled={busy}>
              <Icon name="download" size={18} />
              {busy ? 'Installation…' : 'Installer l’application'}
            </button>
          ) : (
            <p className="download__hint">
              <Icon name="info" size={16} />
              Suivez les étapes pour votre appareil ci-contre — l’installation prend quelques
              secondes et ne passe par aucun magasin d’applications.
            </p>
          )}

          <ul className="download__points">
            <li><Icon name="zap" size={16} /> Ouverture rapide, interface pensée mobile</li>
            <li><Icon name="globe" size={16} /> App shell consultable hors-ligne</li>
            <li><Icon name="shield" size={16} /> Même sécurité et mêmes données que le site</li>
            <li><Icon name="check" size={16} /> 100 % gratuit, sans pub</li>
          </ul>
        </section>

        {/* QR code */}
        <section className="card download__qr" aria-label="QR code du site">
          <p className="download__qr-title">Depuis votre téléphone</p>
          <div className="download__qr-frame">
            {qrUrl ? (
              <img className="download__qr-img" src={qrUrl} alt={`QR code vers ${SITE_URL}`} width={240} height={240} />
            ) : (
              <span className="download__qr-fallback">QR indisponible</span>
            )}
          </div>
          <p className="download__qr-body">
            Scannez ce QR code avec l’appareil photo, puis suivez les étapes ci-dessous pour
            placer l’application sur votre écran d’accueil.
          </p>
        </section>
      </div>

      {/* Étapes par plateforme */}
      <h2 className="section__title download__steps-title">Comment installer</h2>
      <div className="download__platforms">
        {platforms.map((p) => (
          <div key={p.title} className="card download__platform">
            <span className="download__platform-icon">
              <Icon name={p.icon} size={22} />
            </span>
            <p className="download__platform-title">{p.title}</p>
            <p className="download__platform-body">{p.body}</p>
          </div>
        ))}
      </div>

      <p className="download__note">
        Ce n’est pas une application de magasin : c’est une <strong>PWA</strong> (Progressive Web
        App). Elle se met à jour automatiquement avec le site et ne consomme que l’espace d’un
        raccourci. <Link to="/faq">Comment ça marche ?</Link>
      </p>
    </div>
  );
}
