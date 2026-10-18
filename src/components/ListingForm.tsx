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
} from '../lib/api';
import {
  processImage,
  validateImage,
  objectUrlFor,
  revokeUrl,
  MAX_IMAGES,
} from '../lib/images';
import { isValidPhoneInput } from '../lib/phone';
import type { Category, Locality } from '../lib/types';

interface ImageDraft {
  preview: string;
  blob: Blob;
}

interface ExistingImage {
  url: string;
}

interface Props {
  mode: 'create' | 'edit';
  slug?: string;
}

export default function ListingForm({ mode, slug }: Props) {
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
  const [images, setImages] = useState<ImageDraft[]>([]);
  const [existingImages, setExistingImages] = useState<ExistingImage[]>([]);
  const [prefilled, setPrefilled] = useState(mode === 'create');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
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
      setExistingImages(item.images.map((url) => ({ url })));
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
        const newSlug = await publishListing(session.user.id, {
          ...payload,
          imageFiles: images.map((i) => i.blob),
        });
        toast('success', 'Annonce publiée avec succès !');
        navigate(`/annonce/${newSlug}`);
      } else if (slug) {
        await updateListing(session.user.id, slug, {
          ...payload,
          newImages: images.map((i) => i.blob),
          removeImagePaths: [],
        });
        toast('success', 'Annonce mise à jour.');
        navigate(`/annonce/${slug}`);
      }
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'La sauvegarde a échoué.');
    } finally {
      setSubmitting(false);
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
            <div key={i} className="image-tile">
              <img src={img.url} alt={`Photo ${i + 1}`} />
              {mode === 'create' && (
                <button type="button" className="image-tile__remove" aria-label="Retirer cette photo">
                  <Icon name="x" size={13} />
                </button>
              )}
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
          joindront. Formats acceptés : 06 01 23 45 67 ou +241 06 01 23 45 67.
        </p>
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="lf-phone">Téléphone</label>
            <input
              id="lf-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="06 01 23 45 67"
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
