// Supabase Edge Function : verify-turnstile (v4)
// Vérifie côté serveur un jeton Cloudflare Turnstile auprès de l'API officielle
// https://challenges.cloudflare.com/turnstile/v0/siteverify
// Secret requis : TURNSTILE_SECRET_KEY (configuré via Supabase Secrets).

const ALLOWED_ORIGINS = [
  'https://godson-marketplace.vercel.app',
  'https://godson-market-place.vercel.app',
  'http://localhost:5173',
  'http://localhost:4173',
];

const ALLOWED_HOSTNAMES = new Set([
  'godson-marketplace.vercel.app',
  'godson-market-place.vercel.app',
  'localhost',
]);

function isAllowedVercelPreviewHostname(hostname: string): boolean {
  return /^godson-market(?:place|-place)-[a-z0-9-]+\.vercel\.app$/i.test(hostname);
}

function corsHeadersFor(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') || '';
  let allowOrigin = ALLOWED_ORIGINS[0];
  if (ALLOWED_ORIGINS.includes(origin) || /^https:\/\/[a-z0-9-]+\.e2b\.app$/.test(origin)) {
    allowOrigin = origin;
  } else {
    try {
      const u = new URL(origin);
      if (u.protocol === 'https:' && isAllowedVercelPreviewHostname(u.hostname)) {
        allowOrigin = origin;
      }
    } catch {
      // Origine absente ou invalide
    }
  }
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
}

Deno.serve(async (req) => {
  const corsHeaders = corsHeadersFor(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') {
    return json({ ok: false, error: 'method_not_allowed' }, 405, corsHeaders);
  }

  const secret = Deno.env.get('TURNSTILE_SECRET_KEY');
  if (!secret) {
    return json({ ok: false, error: 'not_configured' }, 503, corsHeaders);
  }

  let body: { token?: unknown; action?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: 'invalid_json' }, 400, corsHeaders);
  }

  const token = typeof body?.token === 'string' ? body.token.trim() : '';
  if (!token || token.length > 4096) {
    return json({ ok: false, error: 'missing_token' }, 400, corsHeaders);
  }

  const expectedAction =
    typeof body?.action === 'string' && /^[a-z0-9_-]{2,32}$/i.test(body.action)
      ? body.action
      : null;
  if (!expectedAction) {
    return json({ ok: false, error: 'missing_action' }, 400, corsHeaders);
  }

  const ip =
    req.headers.get('cf-connecting-ip') ||
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    '';

  const form = new URLSearchParams();
  form.set('secret', secret);
  form.set('response', token);
  if (ip) form.set('remoteip', ip);

  try {
    const verifyRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    });
    const outcome = (await verifyRes.json()) as {
      success?: boolean;
      hostname?: string;
      action?: string;
      'error-codes'?: string[];
    };

    if (!outcome.success) {
      return json(
        { ok: false, error: 'captcha_failed', codes: outcome['error-codes'] ?? [] },
        403,
        corsHeaders,
      );
    }

    if (
      !outcome.hostname ||
      (!ALLOWED_HOSTNAMES.has(outcome.hostname) && !isAllowedVercelPreviewHostname(outcome.hostname))
    ) {
      return json({ ok: false, error: 'invalid_hostname' }, 403, corsHeaders);
    }

    if (!outcome.action || outcome.action !== expectedAction) {
      return json({ ok: false, error: 'invalid_action' }, 403, corsHeaders);
    }

    return json({ ok: true }, 200, corsHeaders);
  } catch {
    return json({ ok: false, error: 'upstream_unreachable' }, 502, corsHeaders);
  }
});

function json(data: unknown, status: number, corsHeaders: Record<string, string>) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
