export interface Category {
  id: number;
  parent_id: number | null;
  slug: string;
  name: string;
  icon: string | null;
  sort_order: number;
  status: 'active' | 'disabled';
}

export interface Locality {
  id: number;
  slug: string;
  name: string;
  province: string | null;
  sort_order: number;
}

export interface Profile {
  id: string;
  display_name: string | null;
  pseudonym: string | null;
  avatar_url: string | null;
  city: string | null;
  account_type: 'particulier' | 'commercant' | 'professionnel' | 'entreprise';
  role: 'user' | 'admin';
  is_banned: boolean;
  is_demo: boolean;
  created_at: string;
  updated_at: string;
}

export type ListingStatus = 'draft' | 'pending' | 'active' | 'refused' | 'archived';
export type ListingCondition = 'neuf' | 'comme_neuf' | 'bon_etat' | 'a_renover';

export interface Listing {
  id: string;
  seller_id: string;
  category_id: number;
  title: string;
  slug: string;
  description: string;
  price: number | null;
  negotiable: boolean;
  currency: string;
  city_id: number | null;
  area: string | null;
  condition: ListingCondition | null;
  seller_type: string;
  contact_phone: string | null;
  contact_whatsapp: string | null;
  is_demo: boolean;
  is_sponsored: boolean;
  status: ListingStatus;
  created_at: string;
  updated_at: string;
}

export interface ListingImage {
  id: string;
  listing_id: string;
  storage_path: string | null;
  position: number;
}

export interface ListingFull {
  listing: Listing;
  category: Category | null;
  subcategory: Category | null;
  city: Locality | null;
  images: string[];
  seller: Profile | null;
}

export interface Report {
  id: string;
  reporter_id: string | null;
  listing_id: string | null;
  target_user_id: string | null;
  reason: string;
  details: string | null;
  status: 'open' | 'in_review' | 'resolved' | 'dismissed';
  created_at: string;
  listing_title?: string | null;
}

export interface AdminUser {
  id: string;
  email: string | null;
  display_name: string | null;
  account_type: string;
  role: string;
  is_banned: boolean;
  is_demo: boolean;
  created_at: string;
  listings_count: number | null;
}

export interface ListingQuery {
  q?: string;
  category?: string; // slug (catégorie ou sous-catégorie)
  city?: string; // slug de localité
  minPrice?: number;
  maxPrice?: number;
  condition?: ListingCondition;
  sort?: 'newest' | 'price_asc' | 'price_desc';
  page?: number;
  pageSize?: number;
}

export interface PageResult {
  items: ListingFull[];
  total: number;
  page: number;
  pageSize: number;
}

export const CONDITION_LABELS: Record<ListingCondition, string> = {
  neuf: 'Neuf',
  comme_neuf: 'Comme neuf',
  bon_etat: 'Bon état',
  a_renover: 'À rénover',
};

export const STATUS_LABELS: Record<ListingStatus, string> = {
  draft: 'Brouillon',
  pending: 'En attente',
  active: 'Publiée',
  refused: 'Refusée',
  archived: 'Archivée',
};

export const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  particulier: 'Particulier',
  commercant: 'Commerçant',
  professionnel: 'Professionnel',
  entreprise: 'Entreprise',
};
