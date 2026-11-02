import { createClient } from 'npm:@supabase/supabase-js@2';

const MODEL = Deno.env.get('GEMINI_MODEL') || 'gemini-3.8-flash';
const MAX_VIDEO_BYTES = 40 * 1024 * 1024;
const VIOLATION_THRESHOLD = 0.90;
const EVIDENCE_THRESHOLD = 0.78;
const ALLOWED_ORIGINS = new Set([
  'https://godson-marketplace.vercel.app',
  'https://godson-market-place.vercel.app',
  'http://localhost:4173',
  'http://localhost:5173',
]);

function cors(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') || '';
  let allowed = ALLOWED_ORIGINS.has(origin) ? origin : 'https://godson-marketplace.vercel.app';
  if (/^https:\/\/[a-z0-9-]+\.e2b\.app$/i.test(origin)) allowed = origin;
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
}
function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors(req), 'Content-Type': 'application/json' },
  });
}
function base64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, Math.min(i + chunk, bytes.length)));
  }
  return btoa(binary);
}
function parseModelJson(raw: string): Record<string, unknown> {
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  const parsed = JSON.parse(cleaned);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('invalid_model_json');
  return parsed as Record<string, unknown>;
}
async function uploadGeminiVideo(key: string, bytes: Uint8Array, mimeType: string, displayName: string) {
  const start = await fetch('https://generativelanguage.googleapis.com/upload/v1beta/files', {
    method: 'POST',
    headers: {
      'x-goog-api-key': key,
      'X-Goog-Upload-Protocol': 'resumable',
      'X-Goog-Upload-Command': 'start',
      'X-Goog-Upload-Header-Content-Length': String(bytes.length),
      'X-Goog-Upload-Header-Content-Type': mimeType,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ file: { display_name: displayName } }),
  });
  if (!start.ok) throw new Error(`gemini_video_start_${start.status}`);
  const uploadUrl = start.headers.get('x-goog-upload-url');
  if (!uploadUrl) throw new Error('gemini_video_upload_url_missing');
  const uploaded = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      'x-goog-api-key': key,
      'X-Goog-Upload-Offset': '0',
      'X-Goog-Upload-Command': 'upload, finalize',
      'Content-Type': mimeType,
    },
    body: bytes,
  });
  if (!uploaded.ok) throw new Error(`gemini_video_upload_${uploaded.status}`);
  const file = (await uploaded.json()).file;
  if (!file?.name || !file?.uri) throw new Error('gemini_video_file_invalid');
  const deadline = Date.now() + 75_000;
  let state = file.state;
  while (state !== 'ACTIVE' && Date.now() < deadline) {
    if (state === 'FAILED') throw new Error('gemini_video_processing_failed');
    await new Promise((resolve) => setTimeout(resolve, 2500));
    const status = await fetch(`https://generativelanguage.googleapis.com/v1beta/${file.name}`, {
      headers: { 'x-goog-api-key': key },
    });
    if (!status.ok) throw new Error(`gemini_video_status_${status.status}`);
    state = (await status.json()).state;
  }
  if (state !== 'ACTIVE') throw new Error('gemini_video_processing_timeout');
  return { name: file.name as string, uri: file.uri as string, mimeType };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors(req) });
  if (req.method !== 'POST') return json(req, { error: 'method_not_allowed' }, 405);

  const geminiKey = Deno.env.get('GEMINI_API_KEY');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  // Free-only fail-closed: never invoke Gemini unless the operator explicitly confirms free-tier-only setup.
  const freeTierOnly = Deno.env.get('GEMINI_FREE_TIER_ONLY') === 'true';
  if (!freeTierOnly || !geminiKey || !supabaseUrl || !serviceKey) return json(req, { error: 'moderation_not_configured' }, 503);

  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) return json(req, { error: 'unauthorized' }, 401);
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: authData, error: authError } = await admin.auth.getUser(token);
  if (authError || !authData.user) return json(req, { error: 'unauthorized' }, 401);
  const userId = authData.user.id;

  let body: { listingId?: unknown };
  try { body = await req.json(); } catch { return json(req, { error: 'invalid_json' }, 400); }
  const listingId = typeof body.listingId === 'string' ? body.listingId : '';
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(listingId)) {
    return json(req, { error: 'invalid_listing_id' }, 400);
  }

  const { data: profile, error: profileError } = await admin.from('profiles')
    .select('is_banned, moderation_suspended_until')
    .eq('id', userId).maybeSingle();
  if (profileError || !profile || profile.is_banned || (profile.moderation_suspended_until && new Date(profile.moderation_suspended_until).getTime() > Date.now())) {
    return json(req, { error: 'account_suspended' }, 403);
  }

  const { data: listing, error: listingError } = await admin.from('listings')
    .select('id, seller_id, title, description, status, category_id, video_path')
    .eq('id', listingId).maybeSingle();
  if (listingError || !listing || listing.seller_id !== userId) return json(req, { error: 'listing_not_found' }, 404);
  if (listing.status !== 'pending') return json(req, { error: 'listing_not_pending' }, 409);

  const [{ data: category }, { data: imageRows, error: imageError }] = await Promise.all([
    admin.from('categories').select('id, name, slug, parent_id').eq('id', listing.category_id).maybeSingle(),
    admin.from('listing_images').select('storage_path, position').eq('listing_id', listingId).order('position'),
  ]);
  if (imageError) return json(req, { error: 'listing_media_unavailable' }, 502);
  const parent = category?.parent_id
    ? (await admin.from('categories').select('name, slug').eq('id', category.parent_id).maybeSingle()).data
    : null;
  const categorySlugs = [category?.slug, parent?.slug].filter(Boolean).map((s) => String(s).toLowerCase());
  const nonPhysical = categorySlugs.some((s) => ['services', 'emploi', 'education', 'travaux'].includes(s));

  const imageParts: Array<{ inline_data: { mime_type: string; data: string } }> = [];
  for (const row of imageRows || []) {
    if (!row.storage_path) continue;
    const { data: file, error } = await admin.storage.from('listing-images').download(row.storage_path);
    if (error || !file) return json(req, { error: 'listing_media_unavailable' }, 502);
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (bytes.length > 8 * 1024 * 1024) return json(req, { error: 'image_too_large' }, 413);
    imageParts.push({ inline_data: { mime_type: file.type || 'image/jpeg', data: base64(bytes) } });
  }

  let video: { name: string; uri: string; mimeType: string } | null = null;
  if (listing.video_path) {
    const { data: videoBlob, error } = await admin.storage.from('listing-videos').download(listing.video_path);
    if (error || !videoBlob) return json(req, { error: 'listing_video_unavailable' }, 502);
    const bytes = new Uint8Array(await videoBlob.arrayBuffer());
    if (bytes.length > MAX_VIDEO_BYTES) {
      const result = await admin.rpc('apply_gemini_listing_moderation', {
        p_listing_id: listingId, p_user_id: userId, p_outcome: 'retake',
        p_violation_type: 'video_too_large', p_confidence: 0,
        p_model: MODEL, p_message: 'Vidéo trop lourde pour le contrôle automatique. Réduisez sa taille ou ajoutez une photo claire du produit.',
      });
      if (result.error) return json(req, { error: 'moderation_save_failed' }, 500);
      return json(req, { outcome: 'retake', action: 'retake_requested', message: result.data?.message }, 200);
    }
    const mime = videoBlob.type && /^video\/(mp4|webm|quicktime)$/.test(videoBlob.type) ? videoBlob.type : 'video/mp4';
    video = await uploadGeminiVideo(geminiKey, bytes, mime, `godson-${listingId}`);
  }

  if (!imageParts.length && !video) {
    const result = await admin.rpc('apply_gemini_listing_moderation', {
      p_listing_id: listingId, p_user_id: userId, p_outcome: 'retake',
      p_violation_type: 'missing_product_media', p_confidence: 0,
      p_model: MODEL, p_message: 'Ajoutez une photo ou une vidéo nette et récente du bien ou de l’activité proposée, puis réessayez.',
    });
    if (result.error) return json(req, { error: 'moderation_save_failed' }, 500);
    return json(req, { outcome: 'retake', action: 'retake_requested', message: result.data?.message }, 200);
  }

  const prompt = `Tu es le système automatique de modération des annonces publiques de GODSON Marketplace, au Gabon. Analyse le titre, la description, la catégorie et tous les médias joints. Réponds uniquement en JSON valide avec les clés: gross_violation (boolean), violation_type (string), violation_confidence (number de 0 à 1), evidence_matches_listing (boolean), evidence_confidence (number de 0 à 1), physical_product_detected (boolean), short_reason (string, français, 1 phrase).

Détecte les grossièretés, insultes, harcèlement, menaces, contenu sexuel explicite, haine, fraude évidente ou spam. Ne confonds pas une expression neutre, une marque ou un mot isolé avec une infraction. Pour un bien matériel, vérifie qu’un bien réel est visible et correspond au titre/la catégorie (ex.: téléphone, voiture, console PlayStation, vêtement, mobilier, appareil). Pour une catégorie de service/emploi/éducation/travaux, n’exige pas un objet physique : vérifie plutôt que le visuel correspond clairement à l’activité annoncée. Les images de catalogue, logos seuls, captures d’écran sans preuve du bien, images floues ou sans rapport ne constituent pas une preuve suffisante. N’invente pas ce qui n’est pas visible. Si doute, indique une faible confiance. Texte de l’annonce: ${String(listing.title).slice(0, 120)} — ${String(listing.description).slice(0, 1500)}. Catégorie: ${String(parent?.name ? `${parent.name} / ` : '')}${String(category?.name || 'inconnue')}. Catégorie non physique: ${nonPhysical ? 'oui' : 'non'}.`;
  const parts: Array<Record<string, unknown>> = [{ text: prompt }, ...imageParts];
  if (video) parts.push({ file_data: { mime_type: video.mimeType, file_uri: video.uri } });

  let modelResponse: Response;
  try {
    modelResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
      method: 'POST',
      headers: { 'x-goog-api-key': geminiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.1 },
      }),
    });
  } catch {
    return json(req, { error: 'gemini_unreachable' }, 502);
  }
  if (!modelResponse.ok) return json(req, { error: 'gemini_request_failed', upstream_status: modelResponse.status }, 502);

  let resultJson: Record<string, unknown>;
  try {
    const response = await modelResponse.json();
    const raw = response?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text || '').join('') || '';
    resultJson = parseModelJson(raw);
  } catch {
    return json(req, { error: 'gemini_invalid_response' }, 502);
  } finally {
    if (video?.name) {
      void fetch(`https://generativelanguage.googleapis.com/v1beta/${video.name}`, {
        method: 'DELETE', headers: { 'x-goog-api-key': geminiKey },
      }).catch(() => undefined);
    }
  }

  const violationConfidenceRaw = Number(resultJson.violation_confidence);
  const evidenceConfidenceRaw = Number(resultJson.evidence_confidence);
  const violationConfidence = Number.isFinite(violationConfidenceRaw) ? Math.max(0, Math.min(1, violationConfidenceRaw)) : 0;
  const evidenceConfidence = Number.isFinite(evidenceConfidenceRaw) ? Math.max(0, Math.min(1, evidenceConfidenceRaw)) : 0;
  const violationFlag = resultJson.gross_violation === true;
  const grossViolation = violationFlag && violationConfidence >= VIOLATION_THRESHOLD;
  const uncertainViolation = violationFlag && !grossViolation;
  const evidenceOk = resultJson.evidence_matches_listing === true
    && evidenceConfidence >= EVIDENCE_THRESHOLD
    && (nonPhysical || resultJson.physical_product_detected === true);
  const outcome = grossViolation ? 'violation' : uncertainViolation ? 'retake' : evidenceOk ? 'approved' : 'retake';
  const message = grossViolation
    ? 'Publication bloquée : le contenu semble enfreindre les règles de la plateforme.'
    : uncertainViolation
      ? 'Publication bloquée : le contrôle a repéré un contenu possiblement inadapté, sans confiance suffisante pour sanctionner. Modifiez le texte ou les médias et réessayez.'
      : evidenceOk
        ? null
        : 'Publication bloquée : Gemini ne reconnaît pas clairement le bien ou l’activité. Ajoutez une photo ou une vidéo nette et récente, puis réessayez.';

  const { data: applied, error: applyError } = await admin.rpc('apply_gemini_listing_moderation', {
    p_listing_id: listingId,
    p_user_id: userId,
    p_outcome: outcome,
    p_violation_type: grossViolation ? String(resultJson.violation_type || 'abuse').slice(0, 80) : outcome === 'retake' ? 'insufficient_evidence' : null,
    p_confidence: grossViolation ? violationConfidence : evidenceConfidence,
    p_model: MODEL,
    p_message: message,
  });
  if (applyError) return json(req, { error: 'moderation_save_failed' }, 500);
  return json(req, { ...applied, model: MODEL }, 200);
});
