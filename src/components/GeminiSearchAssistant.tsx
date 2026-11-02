import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from './Icon';
import { interpretListingSearch } from '../lib/api';
import type { GeminiSearchIntent } from '../lib/api';
import type { Category, Locality } from '../lib/types';

export default function GeminiSearchAssistant({ categories, localities }: { categories: Category[]; localities: Locality[] }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [intent, setIntent] = useState<GeminiSearchIntent | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy || query.trim().length < 3) return;
    setBusy(true); setError(''); setIntent(null);
    try {
      setIntent(await interpretListingSearch(query.trim()));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Interprétation indisponible.');
    } finally {
      setBusy(false);
    }
  };

  const apply = () => {
    if (!intent) return;
    const params = new URLSearchParams();
    params.set('live', '1');
    if (intent.keywords) params.set('q', intent.keywords);
    if (intent.categorySlug) params.set('cat', intent.categorySlug);
    if (intent.citySlug) params.set('city', intent.citySlug);
    if (intent.minPrice !== null) params.set('min', String(intent.minPrice));
    if (intent.maxPrice !== null) params.set('max', String(intent.maxPrice));
    if (intent.condition) params.set('cond', intent.condition);
    navigate(`/annonces?${params.toString()}`);
    setOpen(false);
  };

  const categoryName = categories.find((item) => item.slug === intent?.categorySlug)?.name;
  const cityName = localities.find((item) => item.slug === intent?.citySlug)?.name;
  const budget = intent && (intent.minPrice !== null || intent.maxPrice !== null)
    ? `${intent.minPrice?.toLocaleString('fr-FR') || '0'}–${intent.maxPrice?.toLocaleString('fr-FR') || 'sans maximum'} FCFA`
    : null;

  return (
    <section className="gemini-search" aria-label="Recherche assistée">
      <button type="button" className="btn btn--ghost gemini-search__toggle" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
        <Icon name="sparkles" size={16} /> Recherche en langage naturel
      </button>
      {open && (
        <div className="gemini-search__panel">
          <div className="gemini-search__heading">
            <strong>Décris ce que tu cherches</strong>
            <span>Gemini transforme ta demande en filtres. Les résultats viennent uniquement des annonces publiques actives.</span>
          </div>
          <form className="gemini-search__form" onSubmit={submit}>
            <input value={query} maxLength={180} onChange={(e) => setQuery(e.target.value)} placeholder="Ex. : un téléphone à Libreville, moins de 200 000 FCFA" aria-label="Décrire la recherche" />
            <button type="submit" className="btn btn--primary" disabled={busy || query.trim().length < 3}>
              {busy ? 'Analyse…' : 'Interpréter'}
            </button>
          </form>
          {error && <p className="gemini-search__error" role="alert">{error}</p>}
          {intent && (
            <div className="gemini-search__result" aria-live="polite">
              <strong>Filtres proposés</strong>
              <div className="gemini-search__chips">
                {intent.keywords && <span>{intent.keywords}</span>}
                {categoryName && <span>{categoryName}</span>}
                {cityName && <span>{cityName}</span>}
                {budget && <span>{budget}</span>}
                {intent.condition && <span>{intent.condition.replace('_', ' ')}</span>}
              </div>
              <p>Gemini ne crée pas de résultats : tu verras seulement les annonces réellement disponibles.</p>
              <button type="button" className="btn btn--gold" onClick={apply}>Afficher les annonces</button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
