-- Vidéo produit : 1 vidéo max par annonce, durée ≤ 180s, bucket public
alter table public.listings add column if not exists video_url text;
alter table public.listings add column if not exists video_path text;

-- Bucket public pour les vidéos
insert into storage.buckets (id, name, public)
values ('listing-videos', 'listing-videos', true)
on conflict (id) do update set public = true;

-- Politiques stockage listing-videos
drop policy if exists listing_videos_public_read on storage.objects;
create policy listing_videos_public_read on storage.objects for select
  using (bucket_id = 'listing-videos');

drop policy if exists listing_videos_owner_insert on storage.objects;
create policy listing_videos_owner_insert on storage.objects for insert
  with check (
    bucket_id = 'listing-videos'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists listing_videos_owner_delete on storage.objects;
create policy listing_videos_owner_delete on storage.objects for delete
  using (
    bucket_id = 'listing-videos'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists listing_videos_owner_update on storage.objects;
create policy listing_videos_owner_update on storage.objects for update
  using (
    bucket_id = 'listing-videos'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
