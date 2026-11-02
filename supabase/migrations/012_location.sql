-- Localisation vendeur / produit : retrouve + proximité (opt-in, RGPD léger)
alter table public.listings add column if not exists latitude double precision;
alter table public.listings add column if not exists longitude double precision;
alter table public.listings add column if not exists location_label text;

alter table public.profiles add column if not exists shop_lat double precision;
alter table public.profiles add column if not exists shop_lng double precision;
alter table public.profiles add column if not exists shop_label text;

create index if not exists listings_location_idx on public.listings (latitude, longitude) where latitude is not null and longitude is not null;
