import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from './Icon';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import {
  fetchCategories,
  fetchLocalities,
  fetchListingBySlug,
  publishListing,
  updateListing,
  ListingModerationError,
  suggestListingDraft,
  fetchPublicPriceGuide,
} from '../lib/api';
import type { GeminiListingSuggestion, PublicPriceGuide } from '../lib/api';
import {
  processImage,
  validateImage,
  objectUrlFor,
  revokeUrl,
  MAX_IMAGES,
} from '../lib/images';
import { isValidPhoneInput } from '../lib/phone';
import { verifyMagicBytes } from '../lib/security';
import { requestUserPosition } from '../lib/geolocation';
import type { Category, Locality } from '../lib/types';

interface ImageDraft {
  preview: string;
  blob: Blob;
}

interface ExistingImage {
  url: string;
  storagePath: string | null;
}

interface Props {
  mode: 'create' | 'edit';
  slug?: string;
  onSuccess?: ()=>void;
}

export default function ListingForm({ mode, slug, onSuccess }: Props) {
  const { session, profile } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [categories, setCategories] = useState<Category[]>([]);
  const [localities, setLocalities] = useState<Locality[]>([]);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [subcategory, setSubcategory] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [noPrice, setNoPrice] = useState(false);
  const [negotiable, setNegotiable] = useState(false);
  const [city, setCity] = useState('');
  const [area, setArea] = useState('');
  const [condition, setCondition] = useState('');
  const [phone, setPhone] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [agree, setAgree] = useState(false);
  const [meetLat, setMeetLat] = useState<number|null>(null);
  const [meetLng, setMeetLng] = useState<number|null>(null);
  const [meetLabel, setMeetLabel] = useState("");
  const [locating, setLocating] = useState(false);
  const [images, setImages] = useState<ImageDraft[]>([]);
  const [existingImages, setExistingImages] = useState<ExistingImage[]>([]);
  const [removedImagePaths, setRemovedImagePaths] = useState<string[]>([]);
  const [videoFile, setVideoFile] = useState<File|null>(null);
  const [videoPreview, setVideoPreview] = useState<string|null>(null);
  const [videoDuration, setVideoDuration] = useState<number>(0);
  const [existingVideo, setExistingVideo] = useState<string|null>(null);
  const videoRef = useRef<HTMLInputElement>(null);
  const videoElRef = useRef<HTMLVideoElement>(null);
  const [prefilled, setPrefilled] = useState(mode === 'create');
  const [submitting, setSubmitting] = useState(false);
  const [publishStep, setPublishStep] = useState(0);
  const [formError, setFormError] = useState<string | null>(null);
  const [assistantLoading, setAssistantLoading] = useState(false);
  const [assistantDraft, setAssistantDraft] = useState<GeminiListingSuggestion | null>(null);
  const [assistantError, setAssistantError] = useState('');
  const [priceGuideLoading, setPriceGuideLoading] = useState(false);
  const [priceGuide, setPriceGuide] = useState<PublicPriceGuide | null>(null);
  const [priceGuideError, setPriceGuideError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchCategories().then(setCategories).catch(() => toast('error', 'Catégories indisponibles.'));
    fetchLocalities().then(setLocalities).catch(() => undefined);
  }, [toast]);

  // Pré-remplissage en mode édition (après chargement des référentiels)
  useEffect(() => {
    if (mode !== 'edit' || !slug || prefilled || !categories.length || !localities.length) return;
    fetchListingBySlug(slug).then((item) => {
      setPrefilled(true);
      if (!item) {
        toast('error', 'Annonce introuvable.');
        navigate('/compte');
        return;
      }
      const l = item.listing;
      setTitle(l.title);
      if (item.subcategory) {
        const parent = categories.find((c) => c.id === item.subcategory!.parent_id);
        if (parent) setCategory(String(parent.id));
        setSubcategory(String(item.subcategory.id));
      } else {
        const cat = item.category;
        if (cat) {
          if (cat.parent_id === null) {
            setCategory(String(cat.id));
          } else {
            const parentId = cat.parent_id;
            const parent = categories.find((c) => c.id === parentId);
            if (parent) setCategory(String(parent.id));
            setSubcategory(String(cat.id));
          }
        }
      }
      setDescription(l.description);
      setPrice(l.price !== null ? String(l.price) : '');
      setNoPrice(l.price === null);
      setNegotiable(l.negotiable);
      const loc = localities.find((x) => x.id === l.city_id);
      if (loc) setCity(String(loc.id));
      setArea(l.area || '');
      setCondition(l.condition || '');
      setPhone(l.contact_phone || '');
      setWhatsapp(l.contact_whatsapp || '');
      setMeetLat(l.latitude ?? null);
      setMeetLng(l.longitude ?? null);
      setMeetLabel(l.location_label || '');
      const paths = item.imagePaths || [];
      const realExisting: ExistingImage[] = [];
      item.images.forEach((url, idx) => {
        const sp = paths[idx] ?? null;
        if (sp || (l.is_demo && url !== '/demo/placeholder.svg')) {
          realExisting.push({ url, storagePath: sp });
        }
      });
      setExistingImages(realExisting);
      if (l.video_url || item.videoUrl) setExistingVideo(l.video_url || item.videoUrl || null);
      setAgree(true);
    });
  }, [mode, slug, prefilled, categories, localities, navigate, toast]);

  const subcategories = useMemo(() => {
    if (!category) return [];
    return categories.filter((c) => c.parent_id === Number(category));
  }, [categories, category]);

  // Catégories « services » : l'état du produit n'a pas de sens
  const isService = useMemo(() => {
    const cat = categories.find((c) => c.id === Number(subcategory || category));
    return ['services', 'emploi', 'education', 'travaux'].includes(cat?.slug || '');
  }, [categories, category, subcategory]);

  const runListingAssistant = async () => {
    if (assistantLoading) return;
    const categoryId = Number(subcategory || category);
    if (!categoryId) { setAssistantError('Choisis d’abord une catégorie.'); return; }
    setAssistantLoading(true); setAssistantError(''); setAssistantDraft(null);
    try {
      setAssistantDraft(await suggestListingDraft({ title, description, categoryId, price: noPrice ? '' : price }));
    } catch (err) {
      setAssistantError(err instanceof Error ? err.message : 'Aide indisponible.');
    } finally { setAssistantLoading(false); }
  };

  const applySuggestedCategory = () => {
    const target = categories.find((item) => item.slug === assistantDraft?.suggestedCategorySlug);
    if (!target) return;
    if (target.parent_id === null) { setCategory(String(target.id)); setSubcategory(''); return; }
    const parent = categories.find((item) => item.id === target.parent_id);
    if (parent) { setCategory(String(parent.id)); setSubcategory(String(target.id)); }
  };

  const loadPriceGuide = async () => {
    const categoryId = Number(subcategory || category);
    if (!categoryId || priceGuideLoading) return;
    setPriceGuideLoading(true); setPriceGuideError(''); setPriceGuide(null);
    try { setPriceGuide(await fetchPublicPriceGuide(categoryId, city ? Number(city) : null)); }
    catch (err) { setPriceGuideError(err instanceof Error ? err.message : 'Comparaison indisponible.'); }
    finally { setPriceGuideLoading(false); }
  };

  const formatGuidePrice = (value: number) => `${new Intl.NumberFormat('fr-FR').format(value)} FCFA`;

  const addFiles = async (files: FileList | null) => {
    if (!files) return;
    for (const file of Array.from(files)) {
      if (images.length + existingImages.length >= MAX_IMAGES) {
        toast('error', `Maximum ${MAX_IMAGES} images par annonce.`);
        break;
      }
      const err = validateImage(file);
      if (err) {
        toast('error', err);
        continue;
      }
      try {
        const blob = await processImage(file);
        setImages((prev) => [...prev, { preview: objectUrlFor(blob), blob }]);
      } catch (e) {
        toast('error', e instanceof Error ? e.message : 'Image illisible.');
      }
    }
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleVideoFiles = async (files: FileList | null) => {
    if (!files || !files[0]) return;
    const file = files[0];
    if (!['video/mp4', 'video/webm', 'video/quicktime'].includes(file.type)) {
      toast('error', 'Format vidéo non supporté. Utilisez MP4, WebM ou MOV.');
      return;
    }
    if (file.size > 80 * 1024 * 1024) {
      toast('error', 'Vidéo trop lourde (max 80 Mo).');
      return;
    }
    if (!(await verifyMagicBytes(file, 'video'))) {
      toast('error', 'Fichier vidéo invalide ou corrompu.');
      return;
    }
    // Durée ≤180s via metadata
    const url = URL.createObjectURL(file);
    const v = document.createElement('video');
    v.preload='metadata'; v.src=url;
    await new Promise<void>((res)=>{ v.onloadedmetadata=()=>res(); v.onerror=()=>res(); });
    const dur = v.duration || 0;
    URL.revokeObjectURL(url);
    if (dur > 180) { toast('error', `Vidéo trop longue (${Math.round(dur)}s) — maximum 3:00.`); return; }
    // OK
    if (videoPreview) URL.revokeObjectURL(videoPreview);
    const preview = URL.createObjectURL(file);
    setVideoFile(file); setVideoPreview(preview); setVideoDuration(dur);
    if (videoRef.current) videoRef.current.value='';
  };
  const removeVideo = () => {
    if (videoPreview) URL.revokeObjectURL(videoPreview);
    setVideoFile(null); setVideoPreview(null); setVideoDuration(0);
    if (existingVideo) setExistingVideo(null);
  };

  const removeExistingImage = (i: number) => {
    setExistingImages((prev) => {
      const target = prev[i];
      if (target?.storagePath) {
        setRemovedImagePaths((paths) =>
          paths.includes(target.storagePath!) ? paths : [...paths, target.storagePath!],
        );
      }
      return prev.filter((_, idx) => idx !== i);
    });
  };

  const removeImage = (i: number) => {
    setImages((prev) => {
      revokeUrl(prev[i].preview);
      return prev.filter((_, idx) => idx !== i);
    });
  };

  const validate = (): string | null => {
    if (title.trim().length < 5) return 'Le titre doit contenir au moins 5 caractères.';
    if (title.trim().length > 120) return 'Le titre ne doit pas dépasser 120 caractères.';
    const chosenCat = subcategory || category;
    if (!chosenCat) return 'Choisissez une catégorie.';
    if (description.trim().length < 10) return 'La description doit contenir au moins 10 caractères.';
    if (!noPrice) {
      const p = Number(price);
      if (price === '' || Number.isNaN(p)) return 'Indiquez un prix, ou cochez « Prix à discuter ».';
      if (p < 0) return 'Le prix ne peut pas être négatif.';
      if (!Number.isFinite(p) || p > 1e12) return 'Le prix saisi est invalide.';
    }
    if (!city) return 'Choisissez une localité.';
    const hasPhone = phone.trim() && isValidPhoneInput(phone.trim());
    const hasWa = whatsapp.trim() && isValidPhoneInput(whatsapp.trim());
    if (!hasPhone && !hasWa)
      return 'Fournissez au moins un contact valide (téléphone ou WhatsApp). C\u2019est ainsi que les acheteurs vous joindront.';
    if (phone.trim() && !isValidPhoneInput(phone.trim())) return 'Le numéro de téléphone semble invalide.';
    if (whatsapp.trim() && !isValidPhoneInput(whatsapp.trim())) return 'Le numéro WhatsApp semble invalide.';
    if (!agree) return 'Vous devez accepter les règles de publication.';
    return null;
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!session?.user) return;
    const err = validate();
    if (err) {
      setFormError(err);
      return;
    }
    setFormError(null);
    setSubmitting(true);
    setPublishStep(1);
    try {
      const payload = {
        title,
        category_id: Number(subcategory || category),
        description,
        price: noPrice ? null : Number(price),
        negotiable,
        city_id: Number(city),
        area: area.trim() || null,
        condition: isService ? null : condition || null,
        seller_type: profile?.account_type || 'particulier',
        contact_phone: phone.trim() || null,
        contact_whatsapp: whatsapp.trim() || phone.trim() || null,
      };
      if (mode === 'create') {
        setPublishStep(2);
        const newSlug = await publishListing(session.user.id, {
          ...payload,
          imageFiles: images.map((i) => i.blob),
          latitude: meetLat,
          longitude: meetLng,
          location_label: meetLabel || null,
          videoFile: videoFile || null,
        });
        setPublishStep(3);
        toast('success', 'Annonce publiée avec succès !');
        onSuccess?.();
        navigate(`/annonce/${newSlug}`);
      } else if (slug) {
        setPublishStep(2);
        await updateListing(session.user.id, slug, {
          ...payload,
          latitude: meetLat,
          longitude: meetLng,
          location_label: meetLabel.trim() || null,
          newImages: images.map((i) => i.blob),
          removeImagePaths: removedImagePaths,
          ...(videoFile ? { videoFile } : {}),
          ...(!videoFile && !videoPreview && existingVideo === null ? { removeVideo: true } : {}),
        });
        setPublishStep(3);
        toast('success', 'Annonce mise à jour.');
        onSuccess?.();
        navigate(`/annonce/${slug}`);
      }
    } catch (error) {
      if (error instanceof ListingModerationError) {
        toast('error', error.message);
        navigate(`/modifier/${error.slug}`);
      } else {
        setFormError(error instanceof Error ? error.message : 'La sauvegarde a échoué.');
      }
    } finally {
      setSubmitting(false);
      setPublishStep(0);
    }
  };

  if (!session) return null;
  if (mode === 'edit' && !prefilled) return null;

  return (
    <form className="form listing-form" onSubmit={onSubmit} noValidate>
      {formError && (
        <div className="alert alert--error" role="alert">
          <Icon name="alert" size={17} />
          <span>{formError}</span>
        </div>
      )}

      <div className="alert alert--info" role="note">
        <Icon name="shield" size={17} />
        <span>Avant sa mise en ligne, le texte, les photos et la vidéo de votre annonce sont contrôlés automatiquement par Gemini. Les messages privés ne sont pas analysés.</span>
      </div>

      {/* Photos */}
      <section className="form-section">
        <h2 className="form-section__title">
          <Icon name="camera" size={18} /> Photos
          <span className="form-section__count">({images.length + existingImages.length}/{MAX_IMAGES})</span>
        </h2>
        <p className="form-hint">
          Ajoutez jusqu'à {MAX_IMAGES} photos claires (JPG, PNG ou WebP, 4 Mo max).
          Les images sont compressées automatiquement pour un chargement rapide.
        </p>
        <div className="image-grid">
          {existingImages.map((img, i) => (
            <div key={img.storagePath || img.url} className="image-tile">
              <img src={img.url} alt={`Photo ${i + 1}`} />
              <button
                type="button"
                className="image-tile__remove"
                onClick={() => removeExistingImage(i)}
                aria-label="Retirer cette photo"
              >
                <Icon name="x" size={13} />
              </button>
            </div>
          ))}
          {images.map((img, i) => (
            <div key={img.preview} className="image-tile">
              <img src={img.preview} alt={`Aperçu ${i + 1}`} />
              <button type="button" className="image-tile__remove" onClick={() => removeImage(i)} aria-label="Retirer cette photo">
                <Icon name="x" size={13} />
              </button>
            </div>
          ))}
          {images.length + existingImages.length < MAX_IMAGES && (
            <button type="button" className="image-add" onClick={() => fileRef.current?.click()}>
              <Icon name="plus" size={22} />
              <span>Ajouter</span>
            </button>
          )}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          hidden
          onChange={(e) => addFiles(e.target.files)}
          aria-label="Choisir des images"
        />
      </section>


      {/* Vidéo */}
      <section className="form-section">
        <h2 className="form-section__title">
          <Icon name="video" size={18} /> Vidéo du produit <span style={{fontWeight:400, fontSize:12, color:'var(--text-2)'}}>(optionnel, max 3:00)</span>
        </h2>
        <p className="form-hint">Ajoutez une courte vidéo (MP4/WebM, 80 Mo max, 3 min max) pour montrer le produit en action. Elle s'affichera sur votre annonce.</p>
        {existingVideo && !videoPreview ? (
          <div className="video-preview" style={{position:'relative', borderRadius:12, overflow:'hidden', background:'#000', maxWidth:480}}>
            <video src={existingVideo} controls playsInline style={{width:'100%', display:'block'}} />
            <button type="button" className="image-tile__remove" onClick={removeVideo} aria-label="Retirer la vidéo" style={{position:'absolute', top:8, right:8}}><Icon name="x" size={13} /></button>
          </div>
        ) : videoPreview ? (
          <div className="video-preview" style={{position:'relative', borderRadius:12, overflow:'hidden', background:'#000', maxWidth:480}}>
            <video ref={videoElRef} src={videoPreview} controls playsInline style={{width:'100%', display:'block'}} onLoadedMetadata={(e)=>setVideoDuration((e.target as HTMLVideoElement).duration)} />
            <button type="button" className="image-tile__remove" onClick={removeVideo} aria-label="Retirer la vidéo" style={{position:'absolute', top:8, right:8}}><Icon name="x" size={13} /></button>
            <span style={{position:'absolute', bottom:8, left:8, background:'rgba(0,0,0,0.65)', color:'#fff', fontSize:12, padding:'3px 8px', borderRadius:999}}>{Math.floor(videoDuration/60)}:{String(Math.floor(videoDuration%60)).padStart(2,'0')} / 3:00</span>
          </div>
        ) : (
          <button type="button" className="image-add" onClick={()=>videoRef.current?.click()} style={{minHeight:80, width:'100%', maxWidth:480, borderStyle:'dashed', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:6}}>
            <Icon name="video" size={22} />
            <span>Ajouter une vidéo (max 3:00)</span>
          </button>
        )}
        <input ref={videoRef} type="file" accept="video/mp4,video/webm,video/quicktime" hidden onChange={(e)=>handleVideoFiles(e.target.files)} aria-label="Choisir une vidéo" />
      </section>

      {/* Informations */}
      <section className="form-section">
        <h2 className="form-section__title">
          <Icon name="tag" size={18} /> Informations
        </h2>
        <div className="form-group">
          <label htmlFor="lf-title">Titre de l'annonce *</label>
          <input
            id="lf-title"
            type="text"
            value={title}
            maxLength={120}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex. : iPhone 13 128 Go en bon état"
          />
          <span className="form-count">{title.length}/120</span>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="lf-cat">Catégorie *</label>
            <select
              id="lf-cat"
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setSubcategory('');
              }}
            >
              <option value="">Choisir…</option>
              {categories
                .filter((c) => c.parent_id === null && c.status === 'active')
                .map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
            </select>
          </div>
          {subcategories.length > 0 && (
            <div className="form-group">
              <label htmlFor="lf-sub">Sous-catégorie</label>
              <select id="lf-sub" value={subcategory} onChange={(e) => setSubcategory(e.target.value)}>
                <option value="">Toutes</option>
                {subcategories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="form-group">
          <label htmlFor="lf-desc">Description *</label>
          <textarea
            id="lf-desc"
            rows={6}
            maxLength={5000}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Décrivez votre produit ou service : état, caractéristiques, raison de la vente, modalités de remise…"
          />
          <span className="form-count">{description.length}/5000</span>
        </div>
      </section>

      {/* Aide de rédaction facultative : rien n'est appliqué ni publié automatiquement. */}
      <section className="form-section ai-helper">
        <div className="ai-helper__head">
          <div>
            <h2 className="form-section__title"><Icon name="sparkles" size={18} /> Aide Gemini à la rédaction</h2>
            <p className="form-hint">Propose un titre et une description à partir de tes champs. Gemini ne reçoit ni tes coordonnées ni tes messages; vérifie la proposition avant de l’appliquer.</p>
          </div>
          <button type="button" className="btn btn--ghost" onClick={() => void runListingAssistant()} disabled={assistantLoading || !session?.user}>
            {assistantLoading ? 'Rédaction…' : 'Proposer un texte'}
          </button>
        </div>
        {assistantError && <p className="ai-helper__error" role="alert">{assistantError}</p>}
        {assistantDraft && (
          <div className="ai-helper__draft" aria-live="polite">
            <p><strong>Titre proposé :</strong> {assistantDraft.suggestedTitle}</p>
            <p><strong>Description proposée :</strong> {assistantDraft.suggestedDescription}</p>
            {assistantDraft.missingFacts.length > 0 && <p><strong>À préciser :</strong> {assistantDraft.missingFacts.join(' · ')}</p>}
            <div className="ai-helper__actions">
              <button type="button" className="btn btn--primary btn--sm" onClick={() => { setTitle(assistantDraft.suggestedTitle); setDescription(assistantDraft.suggestedDescription); }}>
                Appliquer titre et description
              </button>
              {assistantDraft.suggestedCategorySlug && categories.find((item) => item.slug === assistantDraft.suggestedCategorySlug) && (
                <button type="button" className="btn btn--ghost btn--sm" onClick={applySuggestedCategory}>Utiliser la catégorie proposée</button>
              )}
            </div>
          </div>
        )}
      </section>

      {/* Prix */}
      <section className="form-section">
        <h2 className="form-section__title">
          <Icon name="tag" size={18} /> Prix
        </h2>
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="lf-price">Prix (FCFA)</label>
            <input
              id="lf-price"
              type="number"
              inputMode="numeric"
              min={0}
              value={price}
              disabled={noPrice}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="Ex. : 150000"
            />
          </div>
          <div className="form-group form-group--check">
            <label className="check">
              <input
                type="checkbox"
                checked={noPrice}
                onChange={(e) => {
                  setNoPrice(e.target.checked);
                  if (e.target.checked) setPrice('');
                }}
              />
              <span>Prix à discuter</span>
            </label>
          </div>
        </div>
        <div className="form-group form-group--check">
          <label className="check">
            <input type="checkbox" checked={negotiable} onChange={(e) => setNegotiable(e.target.checked)} />
            <span>Le prix est négociable</span>
          </label>
        </div>
        <div className="price-guide">
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => void loadPriceGuide()} disabled={!category || priceGuideLoading}>
            <Icon name="tag" size={15} /> {priceGuideLoading ? 'Comparaison…' : 'Comparer les prix observés'}
          </button>
          {priceGuideError && <p className="ai-helper__error" role="alert">{priceGuideError}</p>}
          {priceGuide && (priceGuide.sampleCount < 5 ? (
            <p className="form-hint">Données réelles insuffisantes : moins de 5 annonces actives comparables. Aucune estimation affichée.</p>
          ) : (
            <div className="price-guide__result" aria-live="polite">
              <strong>Repère observé sur {priceGuide.sampleCount} annonces publiques actives{city ? ` à ${localities.find((item) => item.id === Number(city))?.name || 'la localité choisie'}` : ' au Gabon'}</strong>
              <span>{formatGuidePrice(priceGuide.low!)} – {formatGuidePrice(priceGuide.high!)} · médiane {formatGuidePrice(priceGuide.median!)}</span>
              <small>Repère statistique uniquement, pas une promesse de vente. Les annonces de démonstration sont exclues.</small>
            </div>
          ))}
        </div>
      </section>

      {/* Localisation */}
      <section className="form-section">
        <h2 className="form-section__title">
          <Icon name="map-pin" size={18} /> Localisation
        </h2>
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="lf-city">Ville / localité *</label>
            <select id="lf-city" value={city} onChange={(e) => setCity(e.target.value)}>
              <option value="">Choisir…</option>
              {localities.map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="lf-area">Quartier / lieu précis (facultatif)</label>
            <input
              id="lf-area"
              type="text"
              maxLength={120}
              value={area}
              onChange={(e) => setArea(e.target.value)}
              placeholder="Ex. : Centre-ville, Akanda Nord…"
            />
          </div>
        </div>
      </section>

      
      {/* Point de rencontre */}
      <section className="form-section">
        <h2 className="form-section__title">
          <Icon name="map-pin" size={18} /> Point de rencontre <span style={{fontWeight:400, fontSize:12, color:'var(--text-2)'}}>(optionnel)</span>
        </h2>
        <p className="form-hint">Partagez un point approximatif (quartier, marché, carrefour). Au clic, votre appareil vous invitera à autoriser l’accès à votre position.</p>
        <div style={{display:'flex', gap:8, flexWrap:'wrap', marginBottom:10}}>
          <button type="button" className="btn btn--ghost" onClick={async()=>{
            setLocating(true);
            try {
              const coords = await requestUserPosition();
              setMeetLat(coords.latitude);
              setMeetLng(coords.longitude);
              if (!meetLabel.trim()) {
                setMeetLabel(`${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}`);
              }
              toast('success', 'Position GPS activée et ajoutée à l’annonce.');
            } catch (err) {
              toast('error', err instanceof Error ? err.message : 'Position refusée ou indisponible.');
            } finally {
              setLocating(false);
            }
          }} disabled={locating}>
            <Icon name="map-pin" size={16} /> {locating ? 'Demande d’autorisation…' : 'Utiliser ma position'}
          </button>
          {(meetLat!==null || meetLabel) && <button type="button" className="btn btn--ghost" onClick={()=>{setMeetLat(null); setMeetLng(null); setMeetLabel('');}}><Icon name="x" size={14}/> Retirer</button>}
        </div>
        <div className="form-group">
          <label htmlFor="lf-meetlabel">Libelle du lieu (Marche, Carrefour...)</label>
          <input id="lf-meetlabel" type="text" maxLength={80} value={meetLabel} onChange={(e)=>setMeetLabel(e.target.value)} placeholder="Ex: Marche Mont-Bouet" />
        </div>
      </section>

      {/* Caractéristiques */}
      {!isService && (
        <section className="form-section">
          <h2 className="form-section__title">
            <Icon name="check" size={18} /> Caractéristiques
          </h2>
          <div className="form-group">
            <label htmlFor="lf-cond">État du produit</label>
            <select id="lf-cond" value={condition} onChange={(e) => setCondition(e.target.value)}>
              <option value="">Non précisé</option>
              <option value="neuf">Neuf</option>
              <option value="comme_neuf">Comme neuf</option>
              <option value="bon_etat">Bon état</option>
              <option value="a_renover">À rénover</option>
            </select>
          </div>
        </section>
      )}

      {/* Contact */}
      <section className="form-section">
        <h2 className="form-section__title">
          <Icon name="phone" size={18} /> Coordonnées de contact *
        </h2>
        <p className="form-hint">
          Au moins un moyen de contact est requis : c'est ainsi que les acheteurs vous
          joindront. Formats gabonais acceptés : 066 12 34 56 ou +241 66 12 34 56.
        </p>
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="lf-phone">Téléphone</label>
            <input
              id="lf-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="066 12 34 56"
              autoComplete="tel"
            />
          </div>
          <div className="form-group">
            <label htmlFor="lf-wa">WhatsApp (facultatif)</label>
            <input
              id="lf-wa"
              type="tel"
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              placeholder="Sinon le numéro téléphone est utilisé"
              autoComplete="tel"
            />
          </div>
        </div>
      </section>

      <label className="check check--terms">
        <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
        <span>
          J'accepte les règles de publication : annonce honnête, aucun produit interdit,
          coordonnées valides, pas de contenu trompeur.
        </span>
      </label>

      {submitting && <div className="publish-progress" role="progressbar" aria-valuenow={publishStep*33} aria-valuemin={0} aria-valuemax={100}><div className="publish-progress__bar" style={{width: `${publishStep*33}%`}} /><span className="publish-progress__label">{publishStep===1?"Préparation…":publishStep===2?"Envoi des images…":"Finalisation…"}</span></div>}
      <div className="form-actions">
        <button type="button" className="btn btn--ghost" onClick={() => navigate(-1)} disabled={submitting}>
          Annuler
        </button>
        <button type="submit" className="btn btn--gold btn--lg" disabled={submitting}>
          {submitting ? (
            <>
              <span className="spinner spinner--sm" aria-hidden="true" />
              {mode === 'create' ? 'Publication en cours…' : 'Enregistrement…'}
            </>
          ) : (
            <>
              <Icon name="check" size={17} />
              {mode === 'create' ? 'Publier mon annonce' : 'Enregistrer les modifications'}
            </>
          )}
        </button>
      </div>
    </form>
  );
}
