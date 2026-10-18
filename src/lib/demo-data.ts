import type { Category, Listing, Locality, Profile } from './types';

/**
 * Données de démonstration — EXACTEMENT les mêmes que les annonces
 * insérées avec `is_demo = true` dans Supabase (migration 003).
 * Utilisées uniquement en « mode démo » (sans variables Supabase)
 * et pour les images locales des annonces démo. Jamais mélangées
 * aux annonces réelles : tout affichage démo est badgé « Démo ».
 */

export const DEMO_SELLER_ID = '9c1f6a7e-0000-4a11-8b2c-d3e4f5060d01';

export const demoSeller: Profile = {
  id: DEMO_SELLER_ID,
  display_name: 'Compte Démo GM',
  pseudonym: 'demo',
  avatar_url: null,
  city: 'Libreville',
  account_type: 'commercant',
  role: 'user',
  is_banned: false,
  is_demo: true,
  created_at: new Date(Date.now() - 10 * 864e5).toISOString(),
  updated_at: new Date().toISOString(),
};

export const demoCategories: Category[] = [
  { id: 1, parent_id: null, slug: 'telephones', name: 'Téléphones & accessoires', icon: 'smartphone', sort_order: 1, status: 'active' },
  { id: 2, parent_id: null, slug: 'informatique', name: 'Informatique & électronique', icon: 'monitor', sort_order: 2, status: 'active' },
  { id: 3, parent_id: null, slug: 'vehicules', name: 'Véhicules & automobile', icon: 'car', sort_order: 3, status: 'active' },
  { id: 4, parent_id: null, slug: 'immobilier', name: 'Immobilier', icon: 'home', sort_order: 4, status: 'active' },
  { id: 5, parent_id: null, slug: 'maison', name: 'Maison, meubles & décoration', icon: 'sofa', sort_order: 5, status: 'active' },
  { id: 6, parent_id: null, slug: 'mode', name: 'Mode, vêtements & chaussures', icon: 'shirt', sort_order: 6, status: 'active' },
  { id: 7, parent_id: null, slug: 'beaute', name: 'Beauté & soins', icon: 'sparkles', sort_order: 7, status: 'active' },
  { id: 8, parent_id: null, slug: 'electro', name: 'Électroménager', icon: 'zap', sort_order: 8, status: 'active' },
  { id: 9, parent_id: null, slug: 'emploi', name: 'Emploi & recrutement', icon: 'briefcase', sort_order: 9, status: 'active' },
  { id: 10, parent_id: null, slug: 'services', name: 'Services professionnels', icon: 'wrench', sort_order: 10, status: 'active' },
  { id: 11, parent_id: null, slug: 'travaux', name: 'Travaux & artisanat', icon: 'hammer', sort_order: 11, status: 'active' },
  { id: 12, parent_id: null, slug: 'education', name: 'Éducation & formation', icon: 'book', sort_order: 12, status: 'active' },
  { id: 13, parent_id: null, slug: 'loisirs', name: 'Loisirs, sport & divertissement', icon: 'gamepad', sort_order: 13, status: 'active' },
  { id: 14, parent_id: null, slug: 'agriculture', name: 'Agriculture & élevage', icon: 'leaf', sort_order: 14, status: 'active' },
  { id: 15, parent_id: null, slug: 'pro', name: 'Commerce & équipements pro', icon: 'package', sort_order: 15, status: 'active' },
  { id: 16, parent_id: null, slug: 'autres', name: 'Autres', icon: 'grid', sort_order: 16, status: 'active' },
];

export const demoLocalities: Locality[] = [
  { id: 1, slug: 'libreville', name: 'Libreville', province: 'Estuaire', sort_order: 1 },
  { id: 2, slug: 'owendo', name: 'Owendo', province: 'Estuaire', sort_order: 2 },
  { id: 3, slug: 'ntoum', name: 'Ntoum', province: 'Estuaire', sort_order: 3 },
  { id: 4, slug: 'akanda', name: 'Akanda', province: 'Estuaire', sort_order: 4 },
  { id: 10, slug: 'port-gentil', name: 'Port-Gentil', province: 'Ogooué-Ivindo', sort_order: 10 },
  { id: 11, slug: 'moebete', name: 'Moebété', province: 'Ogooué-Ivindo', sort_order: 11 },
  { id: 20, slug: 'franceville', name: 'Franceville', province: 'Haut-Ogooué', sort_order: 20 },
  { id: 21, slug: 'moanda', name: 'Moanda', province: 'Haut-Ogooué', sort_order: 21 },
  { id: 30, slug: 'lambarene', name: 'Lambaréné', province: 'Moyen-Ogooué', sort_order: 30 },
  { id: 40, slug: 'tchibanga', name: 'Tchibanga', province: 'Ngounié', sort_order: 40 },
  { id: 50, slug: 'mouila', name: 'Mouila', province: 'Nyanga', sort_order: 50 },
  { id: 60, slug: 'kango', name: 'Kango', province: 'Ogooué-Maritime', sort_order: 60 },
  { id: 70, slug: 'oyem', name: 'Oyem', province: 'Woleu-Ntem', sort_order: 70 },
];

const h = (n: number) => new Date(Date.now() - n * 36e5).toISOString();
const d = (n: number) => new Date(Date.now() - n * 864e5).toISOString();

const base = {
  seller_id: DEMO_SELLER_ID,
  currency: 'XAF',
  seller_type: 'commercant',
  contact_phone: '0601010101',
  contact_whatsapp: '0601010101',
  is_demo: true,
  is_sponsored: false,
  status: 'active' as const,
  updated_at: d(1),
};

export const demoListings: Listing[] = [
  {
    ...base,
    id: 'demo-1',
    category_id: 1,
    title: 'iPhone 13 Pro 256 Go — Graphite',
    slug: 'demo-iphone-13-pro',
    description:
      'iPhone 13 Pro 256 Go en graphite, acheté en boîte neuve à Libreville, jamais ouvert. Double SIM, complet avec sa boîte et son chargeur. Garantie commerciale 12 mois. Prix légèrement négociable pour un acheteur sérieux.',
    price: 650000,
    negotiable: true,
    city_id: 1,
    area: null,
    condition: 'neuf',
    created_at: h(2),
  },
  {
    ...base,
    id: 'demo-2',
    category_id: 2,
    title: 'Dell Latitude 5420 — i5 11e gen / 16 Go',
    slug: 'demo-dell-latitude-5420',
    description:
      'Dell Latitude 5420, processeur i5 11e génération, 16 Go de RAM, SSD 512 Go, écran 14 pouces. Utilisé en environnement de bureau, état impeccable, aucun rayure. Prêt à l\u2019emploi, chargeur d\u2019origine fourni.',
    price: 750000,
    negotiable: true,
    city_id: 1,
    area: null,
    condition: 'bon_etat',
    created_at: h(5),
  },
  {
    ...base,
    id: 'demo-3',
    category_id: 3,
    title: 'Toyota Corolla 2016 — 4 portes',
    slug: 'demo-toyota-corolla-2016',
    description:
      'Toyota Corolla 2016, moteur 1.8, entretien régulier, pneus neufs, climatisation performante. Papiers propres et à jour. Vente pour départ. Sérieux uniquement.',
    price: 8500000,
    negotiable: true,
    city_id: 2,
    area: null,
    condition: 'bon_etat',
    created_at: d(1),
  },
  {
    ...base,
    id: 'demo-4',
    category_id: 3,
    title: 'Yamaha DT 125 — 2021',
    slug: 'demo-yamaha-dt-125',
    description:
      'Yamaha DT 125, année 2021, 8 500 km au compteur. Très bon état, toujours garée, entretien régulier. Prête à rouler, papiers en règle.',
    price: 1800000,
    negotiable: false,
    city_id: 10,
    area: null,
    condition: 'bon_etat',
    created_at: d(2),
  },
  {
    ...base,
    id: 'demo-5',
    category_id: 5,
    title: 'Canapé 3 places + fauteuil assorti',
    slug: 'demo-canape-3-places',
    description:
      'Canapé 3 places et fauteuil assorti, tissu beige, 2 ans d\u2019utilisation. Maison non fumeuse. À retirer sur Ntoum, disponible immédiatement.',
    price: 450000,
    negotiable: true,
    city_id: 3,
    area: null,
    condition: 'bon_etat',
    created_at: d(3),
  },
  {
    ...base,
    id: 'demo-6',
    category_id: 6,
    title: 'Robe wax femme — taille M',
    slug: 'demo-robe-wax',
    description:
      'Robe en wax, taille M, jamais portée (c\u2019est un cadeau). Couture soignée réalisée à Libreville. Très élégante et confortable, parfaite pour une cérémonie.',
    price: 25000,
    negotiable: false,
    city_id: 1,
    area: null,
    condition: 'neuf',
    created_at: d(4),
  },
  {
    ...base,
    id: 'demo-7',
    category_id: 16,
    title: 'Canon EOS 250D — kit 18-55 mm',
    slug: 'demo-canon-eos-250d',
    description:
      'Canon EOS 250D avec objectif 18-55 mm, compteur autour de 2 000 photos. Livré avec 2 batteries et carte mémoire 32 Go. Idéal pour se lancer en photographie.',
    price: 950000,
    negotiable: true,
    city_id: 1,
    area: null,
    condition: 'comme_neuf',
    created_at: d(5),
  },
  {
    ...base,
    id: 'demo-8',
    category_id: 12,
    title: 'Cours de Maths & Physique (collège / lycée)',
    slug: 'demo-cours-maths-physique',
    description:
      'Cours particuliers de mathématiques et de physique-chimique pour le collège et le lycée, à domicile à Libreville ou en ligne. 15 000 FCFA la séance, première séance d\u2019essai gratuite. Professeur expérimenté.',
    price: 15000,
    negotiable: true,
    city_id: 1,
    area: null,
    condition: null,
    created_at: d(6),
  },
  {
    ...base,
    id: 'demo-9',
    category_id: 4,
    title: 'Appartement 2 chambres à louer — zone portuaire',
    slug: 'demo-appartement-2-chambres',
    description:
      'Appartement 2 chambres spacieux à Port-Gentil, meublé, électricité et eau stables. Loyer mensuel 600 000 FCFA, disponible immédiatement. Locataires sérieux uniquement, sans commission.',
    price: 600000,
    negotiable: true,
    city_id: 10,
    area: null,
    condition: null,
    created_at: d(7),
  },
  {
    ...base,
    id: 'demo-10',
    category_id: 11,
    title: 'Réparation informatique à domicile',
    slug: 'demo-reparation-informatique',
    description:
      'Réparation de PC et ordinateurs portables : suppression de virus, installation de systèmes, remplacement de pièces, récupération de données. Déplacement possible dans Libreville. Devis gratuit, prix selon l\u2019intervention.',
    price: null,
    negotiable: true,
    city_id: 1,
    area: null,
    condition: null,
    created_at: d(8),
  },
];

/** Image locale (SVG) pour chaque annonce démo. */
export const demoImagesBySlug: Record<string, string> = {
  'demo-iphone-13-pro': '/demo/iphone.svg',
  'demo-dell-latitude-5420': '/demo/dell.svg',
  'demo-toyota-corolla-2016': '/demo/corolla.svg',
  'demo-yamaha-dt-125': '/demo/yamaha.svg',
  'demo-canape-3-places': '/demo/canape.svg',
  'demo-robe-wax': '/demo/robe.svg',
  'demo-canon-eos-250d': '/demo/canon.svg',
  'demo-cours-maths-physique': '/demo/cours.svg',
  'demo-appartement-2-chambres': '/demo/appartement.svg',
  'demo-reparation-informatique': '/demo/reparation.svg',
};
