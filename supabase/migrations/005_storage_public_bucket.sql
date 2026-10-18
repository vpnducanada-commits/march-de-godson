-- GODSON MARKETPLACE — Migration 005 : stockage des images d'annonces
--
-- Contexte : le bucket `listing-images` était privé, mais l'application
-- affiche les images via des URLs publiques (<img src=".../object/public/...">).
-- Un bucket privé rendait donc toutes les images téléversées invisibles (400).
--
-- Choix v1 (documenté) : les images d'annonces sont du contenu public par
-- nature (annonces gratuites, contact direct vendeur/acheteur, pas de paiement).
--  1. Le bucket passe en public : les URLs /object/public/ fonctionnent.
--  2. L'écriture reste strictement propriétaire (dossier {userId}/...),
--     sauf suppression par un admin :
--  3. Suppression admin : permet de purger les images d'une annonce refusée
--     lors de la modération (voir adminModerateListing dans le frontend).
--
-- L'accès direct par URL d'un fichier dont l'annonce n'est plus « active »
-- reste théoriquement possible ; la purge à la modération « refused » et la
-- non-liste des annonces refusées couvrent le cas sensible en v1.

update storage.buckets
set public = true
where id = 'listing-images';

drop policy if exists listing_images_owner_delete on storage.objects;
create policy listing_images_owner_delete on storage.objects for delete
  using (
    bucket_id = 'listing-images'
    and auth.role() = 'authenticated'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or (select public.is_admin())
    )
  );
