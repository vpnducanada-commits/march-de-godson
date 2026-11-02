-- Avis vendeurs réels avec RLS strict
create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.profiles(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  comment text not null default '' check (char_length(comment) <= 1000),
  created_at timestamptz not null default now(),
  constraint reviews_no_self_review check (seller_id <> author_id)
);

create index if not exists reviews_seller_idx on public.reviews (seller_id, created_at desc);

alter table public.reviews enable row level security;

drop policy if exists reviews_select on public.reviews;
create policy reviews_select on public.reviews for select using (true);

drop policy if exists reviews_insert on public.reviews;
create policy reviews_insert on public.reviews for insert
  with check (auth.uid() is not null and author_id = auth.uid() and seller_id <> auth.uid());

drop policy if exists reviews_delete on public.reviews;
create policy reviews_delete on public.reviews for delete
  using (author_id = auth.uid() or (select public.is_admin()));
