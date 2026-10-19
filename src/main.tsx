import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Analytics } from '@vercel/analytics/react';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { APP_VERSION } from './lib/version';
import './styles/global.css';

// Observabilité : Sentry (production uniquement, et seulement si un DSN est
// fourni via VITE_SENTRY_DSN). Chargé dynamiquement pour ne pas alourdir le
// bundle de base ; sans DSN, aucun code Sentry n'est émis à l'exécution.
const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN as string | undefined;
if (import.meta.env.PROD && SENTRY_DSN) {
  import('@sentry/react')
    .then(({ init }) =>
      init({
        dsn: SENTRY_DSN,
        environment: 'production',
        release: `godson-marketplace@${APP_VERSION}`,
        tracesSampleRate: 0.2,
        replaysSessionSampleRate: 0.1,
      }),
    )
    .catch(() => undefined);
}

// PWA : enregistrement du service worker (build de production uniquement)
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  import('virtual:pwa-register').then(({ registerSW }) => {
    registerSW({ immediate: true });
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          {/* Vercel Analytics : mesure de performance + erreurs (RGPD-friendly,
              sans cookie), actif sur Vercel production uniquement. */}
          <Analytics />
          <App />
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
