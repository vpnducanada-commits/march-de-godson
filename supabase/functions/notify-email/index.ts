/**
 * GODSON Marketplace — Edge function « notify-email »
 * ------------------------------------------------------------
 * Envoie les e-mails transactionnels (Brevo / ex-Sendinblue, plan gratuit
 * 300 e-mails/jour) :
 *   - annonce approuvée / refusée / archivée  → au vendeur
 *   - nouveau signalement                     → aux admins
 *
 * Sécurité :
 *   - la clé service_role reste CÔTÉ SERVEUR (jamais exposée au navigateur)
 *   - l'appelant doit présenter un JWT utilisateur valide (vérifié ici)
 *   - les destinataires sont toujours lus dans la base / les secrets,
 *     jamais fournis par le client
 *
 * Secrets requis (Dashboard Supabase → Edge Functions → Secrets) :
 *   BREVO_API_KEY   clé API Brevo (plan gratuit)
 *   MAIL_FROM       adresse expéditrice vérifiée dans Brevo (SPF)
 *   ADMIN_EMAIL     destinataire des signalements
 *   SITE_URL        (optionnel) https://godson-marketplace.vercel.app
 *
 * Tant que BREVO_API_KEY/MAIL_FROM sont absents : 503 « email_not_configured »
 * → l'application continue de fonctionner (dégradé gracieux côté client).
 */
import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const sb = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 1) L'appelant doit avoir une session utilisateur valide.
    const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    if (!token) return json({ error: 'unauthorized' }, 401);
    const { data: userData, error: authErr } = await sb.auth.getUser(token);
    if (authErr || !userData.user) return json({ error: 'unauthorized' }, 401);

    // 2) Brevo doit être configuré.
    const brevoKey = Deno.env.get('BREVO_API_KEY');
    const mailFrom = Deno.env.get('MAIL_FROM');
    if (!brevoKey || !mailFrom) return json({ error: 'email_not_configured' }, 503);

    const { kind, listingId, reportId, status } = await req.json() as {
      kind?: string;
      listingId?: string;
      reportId?: string;
      status?: string;
    };
    const SITE_URL = Deno.env.get('SITE_URL') || 'https://godson-marketplace.vercel.app';

    let toEmail: string | null = null;
    let toName = '';
    let subject = '';
    let html = '';

    if (kind === 'listing_status' && listingId) {
      const { data: l } = await sb
        .from('listings')
        .select('slug, title, seller_id')
        .eq('id', listingId)
        .maybeSingle();
      if (!l) return json({ error: 'not_found' }, 404);
      const listing = l as { slug: string; title: string; seller_id: string };
      const { data: sellerUser } = await sb.auth.admin.getUserById(listing.seller_id);
      toEmail = (sellerUser as { user?: { email?: string } } | null)?.user?.email ?? null;
      if (!toEmail) return json({ error: 'no_seller_email' }, 404);
      toName = 'Vendeur GODSON Marketplace';
      const title = listing.title;

      if (status === 'active') {
        subject = 'Votre annonce est en ligne sur GODSON Marketplace';
        html = `<p>Bonjour,</p>
          <p>Bonne nouvelle : votre annonce <strong>${title}</strong> est publiée et visible
          dans le catalogue.</p>
          <p>Elle reste visible pendant 90 jours. Ensuite, vous pourrez la reprendre
          gratuitement depuis votre espace vendeur.</p>
          <p><a href="${SITE_URL}/mon-espace">Voir mon espace vendeur</a></p>
          <p>— L'équipe GODSON Marketplace</p>`;
      } else if (status === 'refused') {
        subject = 'Votre annonce a été refusée par la modération';
        html = `<p>Bonjour,</p>
          <p>Après examen par notre équipe de modération, votre annonce
          <strong>${title}</strong> n'a pas pu être publiée : elle ne respecte pas nos
          conditions d'utilisation (produit interdit, contenu trompeur, doublon…).</p>
          <p><a href="${SITE_URL}/mon-espace">Voir mon espace vendeur</a></p>
          <p>— L'équipe GODSON Marketplace</p>`;
      } else {
        subject = 'Votre annonce a été archivée';
        html = `<p>Bonjour,</p>
          <p>Votre annonce <strong>${title}</strong> a été archivée et n'est plus visible
          dans le catalogue. Vous pouvez la republier à tout moment depuis votre espace.</p>
          <p><a href="${SITE_URL}/mon-espace">Republier depuis mon espace</a></p>
          <p>— L'équipe GODSON Marketplace</p>`;
      }
    } else if (kind === 'report_created' && reportId) {
      const adminEmail = Deno.env.get('ADMIN_EMAIL');
      if (!adminEmail) return json({ error: 'admin_email_not_configured' }, 503);
      const { data: r } = await sb
        .from('reports')
        .select('reason, details, listings(title, slug)')
        .eq('id', reportId)
        .maybeSingle();
      if (!r) return json({ error: 'not_found' }, 404);
      const report = r as {
        reason: string;
        details: string | null;
        listings?: { title: string; slug: string } | null;
      };
      toEmail = adminEmail;
      toName = 'Équipe de modération';
      subject = 'Nouveau signalement — GODSON Marketplace';
      html = `<p>Un utilisateur a signalé une annonce.</p>
        <p><strong>Annonce :</strong> ${report.listings?.title ?? '(annonce supprimée)'}<br/>
        <strong>Motif :</strong> ${report.reason}<br/>
        <strong>Détails :</strong> ${report.details || '—'}</p>
        <p><a href="${SITE_URL}/admin">Ouvrir le panneau de modération</a></p>`;
    } else {
      return json({ error: 'bad_payload' }, 400);
    }

    if (!toEmail) return json({ error: 'no_recipient' }, 404);

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
      return json({ error: 'mail_provider_error', status: res.status }, 502);
    }
    return json({ ok: true });
  } catch (e) {
    console.error(e);
    return json({ error: 'internal' }, 500);
  }
});
