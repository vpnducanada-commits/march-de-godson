/**
 * GODSON Marketplace — Edge function « notify-email » (durcie)
 * ------------------------------------------------------------
 * Envoie les e-mails transactionnels (Brevo, plan gratuit 300 e-mails/jour) :
 *   - annonce approuvée / refusée / archivée  → au vendeur (RÉSERVÉ AUX ADMINS)
 *   - nouveau signalement                     → aux admins (RÉSERVÉ À L'AUTEUR DU SIGNALEMENT)
 *
 * Sécurité :
 *   - clé service_role strictement côté serveur
 *   - JWT utilisateur vérifié via sb.auth.getUser(token)
 *   - contrôle d'autorisation métier (rôle admin ou auteur du signalement)
 *   - échappement HTML systématique contre l'injection HTML/phishing dans les e-mails
 *   - CORS restreint aux origines autorisées
 */
import { createClient } from 'npm:@supabase/supabase-js@2';

const ALLOWED_ORIGINS = new Set([
  'https://godson-marketplace.vercel.app',
  'https://godson-market-place.vercel.app',
  'http://localhost:5173',
  'http://localhost:4173',
]);

function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') || '';
  const allowOrigin = ALLOWED_ORIGINS.has(origin)
    ? origin
    : 'https://godson-marketplace.vercel.app';
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
}

function escapeHtml(raw: string | null | undefined): string {
  return String(raw ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function json(req: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) });
  if (req.method !== 'POST') return json(req, { error: 'method_not_allowed' }, 405);

  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const sb = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 1) L'appelant doit présenter un JWT utilisateur valide et non suspendu.
    const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    if (!token) return json(req, { error: 'unauthorized' }, 401);
    const { data: userData, error: authErr } = await sb.auth.getUser(token);
    if (authErr || !userData.user) return json(req, { error: 'unauthorized' }, 401);
    const callerId = userData.user.id;

    const { data: callerProfile } = await sb
      .from('profiles')
      .select('role, is_banned')
      .eq('id', callerId)
      .maybeSingle();
    if (!callerProfile || (callerProfile as { is_banned?: boolean }).is_banned) {
      return json(req, { error: 'forbidden' }, 403);
    }
    const callerIsAdmin = (callerProfile as { role?: string }).role === 'admin';

    // 2) Brevo doit être configuré.
    const brevoKey = Deno.env.get('BREVO_API_KEY');
    const mailFrom = Deno.env.get('MAIL_FROM');
    if (!brevoKey || !mailFrom) return json(req, { error: 'email_not_configured' }, 503);

    const { kind, listingId, reportId, status } = (await req.json()) as {
      kind?: string;
      listingId?: string;
      reportId?: string;
      status?: string;
    };
    const SITE_URL = 'https://godson-marketplace.vercel.app';

    let toEmail: string | null = null;
    let toName = '';
    let subject = '';
    let html = '';

    if (kind === 'listing_status' && listingId && UUID_RE.test(listingId)) {
      // Seul un administrateur peut déclencher un e-mail de décision de modération
      if (!callerIsAdmin) {
        return json(req, { error: 'forbidden_admin_only' }, 403);
      }
      if (status !== 'active' && status !== 'refused' && status !== 'archived') {
        return json(req, { error: 'bad_status' }, 400);
      }

      const { data: l } = await sb
        .from('listings')
        .select('slug, title, seller_id')
        .eq('id', listingId)
        .maybeSingle();
      if (!l) return json(req, { error: 'not_found' }, 404);
      const listing = l as { slug: string; title: string; seller_id: string };
      const { data: sellerUser } = await sb.auth.admin.getUserById(listing.seller_id);
      toEmail = (sellerUser as { user?: { email?: string } } | null)?.user?.email ?? null;
      if (!toEmail) return json(req, { error: 'no_seller_email' }, 404);
      toName = 'Vendeur GODSON Marketplace';
      const safeTitle = escapeHtml(listing.title);

      if (status === 'active') {
        subject = 'Votre annonce est en ligne sur GODSON Marketplace';
        html = `<p>Bonjour,</p>
          <p>Bonne nouvelle : votre annonce <strong>${safeTitle}</strong> est publiée et visible
          dans le catalogue.</p>
          <p>Elle reste visible pendant 90 jours. Ensuite, vous pourrez la reprendre
          gratuitement depuis votre espace vendeur.</p>
          <p><a href="${SITE_URL}/compte">Voir mon espace vendeur</a></p>
          <p>— L'équipe GODSON Marketplace</p>`;
      } else if (status === 'refused') {
        subject = 'Votre annonce a été refusée par la modération';
        html = `<p>Bonjour,</p>
          <p>Après examen par notre équipe de modération, votre annonce
          <strong>${safeTitle}</strong> n'a pas pu être publiée : elle ne respecte pas nos
          conditions d'utilisation (produit interdit, contenu trompeur, doublon…).</p>
          <p><a href="${SITE_URL}/compte">Voir mon espace vendeur</a></p>
          <p>— L'équipe GODSON Marketplace</p>`;
      } else {
        subject = 'Votre annonce a été archivée';
        html = `<p>Bonjour,</p>
          <p>Votre annonce <strong>${safeTitle}</strong> a été archivée et n'est plus visible
          dans le catalogue. Vous pouvez la republier à tout moment depuis votre espace.</p>
          <p><a href="${SITE_URL}/compte">Republier depuis mon espace</a></p>
          <p>— L'équipe GODSON Marketplace</p>`;
      }
    } else if (kind === 'report_created' && reportId && UUID_RE.test(reportId)) {
      const adminEmail = Deno.env.get('ADMIN_EMAIL');
      if (!adminEmail) return json(req, { error: 'admin_email_not_configured' }, 503);
      const { data: r } = await sb
        .from('reports')
        .select('reporter_id, status, reason, details, listings(title, slug)')
        .eq('id', reportId)
        .maybeSingle();
      if (!r) return json(req, { error: 'not_found' }, 404);
      const report = r as {
        reporter_id: string | null;
        status: string;
        reason: string;
        details: string | null;
        listings?: { title: string; slug: string } | null;
      };
      // Seul l'auteur du signalement ouvert (ou un admin) peut déclencher la notification
      if (report.reporter_id !== callerId && !callerIsAdmin) {
        return json(req, { error: 'forbidden' }, 403);
      }
      if (report.status !== 'open') {
        return json(req, { error: 'already_processed' }, 409);
      }

      const safeListingTitle = escapeHtml(report.listings?.title ?? '(annonce supprimée)');
      const safeReason = escapeHtml(report.reason);
      const safeDetails = escapeHtml(report.details || '—');

      toEmail = adminEmail;
      toName = 'Équipe de modération';
      subject = 'Nouveau signalement — GODSON Marketplace';
      html = `<p>Un utilisateur a signalé une annonce.</p>
        <p><strong>Annonce :</strong> ${safeListingTitle}<br/>
        <strong>Motif :</strong> ${safeReason}<br/>
        <strong>Détails :</strong> ${safeDetails}</p>
        <p><a href="${SITE_URL}/admin">Ouvrir le panneau de modération</a></p>`;
    } else {
      return json(req, { error: 'bad_payload' }, 400);
    }

    if (!toEmail) return json(req, { error: 'no_recipient' }, 404);

    // 3) Envoi Brevo (API v3).
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        apikey: brevoKey,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        sender: { name: 'GODSON Marketplace', email: mailFrom },
        to: [{ email: toEmail, name: toName }],
        subject,
        htmlContent: html,
      }),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.error('Brevo error', res.status, errText.slice(0, 300));
      return json(req, { error: 'mail_provider_error', status: res.status }, 502);
    }
    return json(req, { ok: true });
  } catch (e) {
    console.error(e);
    return json(req, { error: 'internal' }, 500);
  }
});
