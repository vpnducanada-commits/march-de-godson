import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from './Icon';
import type { Locality } from '../lib/types';

/**
 * Barre de recherche (mot-clé + localité) — utilisée dans l'en-tête
 * (desktop), la zone mobile et le hero de l'accueil.
 */
export function SearchBar({
  localities,
  initialQ,
  size = 'md',
  onDone,
}: {
  localities: Locality[];
  initialQ?: string;
  size?: 'md' | 'lg';
  onDone?: () => void;
}) {
  const [q, setQ] = useState(initialQ ?? '');
  const [city, setCity] = useState('');
  const navigate = useNavigate();

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (q.trim()) params.set('q', q.trim());
    if (city) params.set('city', city);
    navigate(`/annonces${params.toString() ? `?${params.toString()}` : ''}`);
    onDone?.();
  };

  return (
    <form className={`searchbar searchbar--${size}`} role="search" onSubmit={submit}>
      <div className="searchbar__field">
        <Icon name="search" size={size === 'lg' ? 20 : 17} className="searchbar__icon" />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Rechercher un produit, service, ville…"
          aria-label="Mot-clé de recherche"
          name="q"
        />
      </div>
      <div className="searchbar__city">
        <Icon name="map-pin" size={16} className="searchbar__icon" />
        <select
          value={city}
          onChange={(e) => setCity(e.target.value)}
          aria-label="Localité"
          name="city"
        >
          <option value="">Tout le Gabon</option>
          {localities.map((l) => (
            <option key={l.id} value={l.slug}>
              {l.name}
            </option>
          ))}
        </select>
      </div>
      <button type="submit" className={`btn btn--primary${size === 'lg' ? ' btn--lg' : ''}`}>
        Rechercher
      </button>
    </form>
  );
}
