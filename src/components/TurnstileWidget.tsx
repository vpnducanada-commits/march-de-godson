import { useEffect, useRef } from 'react';
import { isSupabaseConfigured, publishableKey, supabaseUrl } from '../lib/supabase';

declare global {
  interface Window {
    Capacitor?: {
      isNativePlatform?: () => boolean;
    };
    turnstile?: {
      render: (
        container: HTMLElement,
        options: {
          sitekey: string;
          action?: string;
          language?: string;
          theme?: 'light' | 'dark' | 'auto';
          appearance?: 'always' | 'execute' | 'interaction-only';
          size?: 'normal' | 'flexible' | 'compact';
          callback?: (token: string) => void;
          'expired-callback'?: () => void;
          'error-callback'?: (errorCode?: string) => boolean | void;
        },
      ) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId?: string) => void;
    };
  }
}

const SCRIPT_ID = 'cf-turnstile-script';
const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

let scriptPromise: Promise<void> | null = null;

function ensureTurnstileScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.turnstile) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('turnstile_load_failed')), {
        once: true,
      });
      return;
    }
    const script = document.createElement('script');
    script.id = SCRIPT_ID;
    script.src = SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => {
      scriptPromise = null;
      reject(new Error('turnstile_load_failed'));
    };
    document.head.appendChild(script);
  });

  return scriptPromise;
}

const RAW_SITE_KEY = (
  (import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined) || ''
).trim();

/**
 * Active Turnstile sur le web public (désactivé dans le bac à sable .e2b.app
 * et dans la WebView native Capacitor où l'hôte est https://localhost).
 */
export function isTurnstileActive(): boolean {
  if (!RAW_SITE_KEY || typeof window === 'undefined') return false;
  if (window.Capacitor?.isNativePlatform?.()) return false;
  const host = window.location.hostname;
  if (host.endsWith('.e2b.app')) return false;
  return true;
}

export const TURNSTILE_NATIVE_SUPABASE =
  String(import.meta.env.VITE_TURNSTILE_NATIVE_SUPABASE || '').toLowerCase() === 'true';

/**
 * Vérifie côté serveur un jeton anti-robot Cloudflare Turnstile via l'Edge Function `verify-turnstile`.
 */
export async function verifyTurnstileToken(token: string, action: string): Promise<boolean> {
  if (!isSupabaseConfigured || !supabaseUrl) return true;
  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/verify-turnstile`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: publishableKey ?? '',
      },
      body: JSON.stringify({ token, action }),
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { ok?: boolean };
    return Boolean(data?.ok);
  } catch {
    return false;
  }
}

interface TurnstileWidgetProps {
  action: 'login' | 'signup' | 'forgot_password';
  resetKey: number;
  onToken: (token: string | null) => void;
  onError?: (code?: string) => void;
}

/**
 * Bouclier anti-robots Cloudflare Turnstile (mode Géré sans puzzle pénible).
 */
export function TurnstileWidget({ action, resetKey, onToken, onError }: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);
  const onTokenRef = useRef(onToken);
  const onErrorRef = useRef(onError);
  onTokenRef.current = onToken;
  onErrorRef.current = onError;

  const active = isTurnstileActive();

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    onTokenRef.current(null);

    ensureTurnstileScript()
      .then(() => {
        if (cancelled || !containerRef.current || !window.turnstile) return;
        if (widgetIdRef.current) {
          try {
            window.turnstile.remove(widgetIdRef.current);
          } catch {}
          widgetIdRef.current = null;
        }
        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: RAW_SITE_KEY,
          action,
          language: 'fr',
          theme: 'auto',
          size: 'flexible',
          appearance: 'always',
          callback: (token: string) => {
            if (!cancelled) onTokenRef.current(token);
          },
          'expired-callback': () => {
            if (!cancelled) onTokenRef.current(null);
          },
          'error-callback': (code?: string) => {
            if (!cancelled) {
              onTokenRef.current(null);
              onErrorRef.current?.(code);
            }
          },
        });
      })
      .catch(() => {
        if (!cancelled) {
          onTokenRef.current(null);
          onErrorRef.current?.('load_failed');
        }
      });

    return () => {
      cancelled = true;
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {}
        widgetIdRef.current = null;
      }
    };
  }, [active, action, resetKey]);

  if (!active) return null;

  return (
    <div
      ref={containerRef}
      style={{
        minHeight: 65,
        margin: '10px 0 14px',
        display: 'flex',
        justifyContent: 'center',
      }}
    />
  );
}
