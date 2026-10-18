-- GODSON MARKETPLACE — Migration 003 : DONNÉES DE DÉMONSTRATION
-- ⚠️ Données fictives, clairement identifiées (is_demo = true).
-- Retrait sans impact sur les données réelles :
--   delete from public.listings where is_demo = true;
--   update public.profiles set is_demo = false;
--   delete from auth.users where id = '9c1f6a7e-0000-4a11-8b2c-d3e4f5060d01';

-- Compte de démonstration (mot de passe : Demo1234!)
-- NB : GoTrue (Supabase Auth) exige que les colonnes « token » soient des
-- chaînes vides et non NULL (sinon : 500 « Database error querying schema »
-- au login), et que la ligne auth.identities corresponde à l'utilisateur.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, last_sign_in_at, is_sso_user, is_anonymous
) values (
  '00000000-0000-0000-0000-000000000000',
  '9c1f6a7e-0000-4a11-8b2c-d3e4f5060d01',
  'authenticated', 'authenticated', 'demo@godson-market.example',
  crypt('Demo1234!', gen_salt('bf', 10)),
  now(),
  '', '', '', '',
  '{"provider":"email","providers":["email"]}',
  '{"name":"Compte Démo GM"}',
  now() - interval '10 days', now(), now() - interval '2 days', false, false
) on conflict (id) do nothing;

-- Identité « email » requise par GoTrue pour le sign-in
insert into auth.identities (
  id, provider_id, user_id, identity_data, provider, created_at, updated_at
) values (
  '9c1f6a7e-0000-4a12-8b2c-d3e4f5060d02',
  '9c1f6a7e-0000-4a11-8b2c-d3e4f5060d01',
  '9c1f6a7e-0000-4a11-8b2c-d3e4f5060d01',
  '{"sub":"9c1f6a7e-0000-4a11-8b2c-d3e4f5060d01","name":"Commerçant Démo","email":"demo@godson-market.example","email_verified":true,"phone_verified":false}',
  'email', now(), now()
) on conflict (id) do nothing;

update public.profiles
set is_demo = true, city = 'Libreville', account_type = 'commercant',
    display_name = coalesce(nullif(display_name, ''), 'Compte Démo GM')
where id = '9c1f6a7e-0000-4a11-8b2c-d3e4f5060d01';

-- Annonces de démonstration
insert into public.listings (
  seller_id, category_id, title, slug, description, price, negotiable,
  city_id, condition, seller_type, contact_phone, contact_whatsapp, is_demo, status, created_at
)
select
  '9c1f6a7e-0000-4a11-8b2c-d3e4f5060d01'::uuid, c.id, v.title, v.slug, v.description, v.price, v.negotiable,
  l.id, v.condition, 'commercant', v.contact, v.contact, true, 'active', v.created
from (
  select * from (values
    ('smartphones',      'demo-iphone-13-pro',
      'iPhone 13 Pro 256 Go — Graphite',
      'iPhone 13 Pro 256 Go en graphite, acheté en boîte neuve à Libreville, jamais ouvert. Double SIM, complet avec sa boîte et son chargeur. Garantie commerciale 12 mois. Prix légèrement négociable pour un acheteur sérieux.',
      650000, true, 'libreville', 'neuf', '0601010101', now() - interval '2 hours'),
    ('ordinateurs',      'demo-dell-latitude-5420',
      'Dell Latitude 5420 — i5 11e gen / 16 Go',
      'Dell Latitude 5420, processeur i5 11e génération, 16 Go de RAM, SSD 512 Go, écran 14 pouces. Utilisé en environnement de bureau, état impeccable, aucun rayure. Prêt à l''emploi, chargeur d''origine fourni.',
      750000, true, 'libreville', 'bon_etat', '0601010101', now() - interval '5 hours'),
    ('voitures',         'demo-toyota-corolla-2016',
      'Toyota Corolla 2016 — 4 portes',
      'Toyota Corolla 2016, moteur 1.8, entretenez régulièrement, pneus neufs, climatisation performante. Papiers propres et à jour. Vente pour départ. Sérieux uniquement.',
      8500000, true, 'owendo', 'bon_etat', '0601010101', now() - interval '1 day'),
    ('motos',            'demo-yamaha-dt-125',
      'Yamaha DT 125 — 2021',
      'Yamaha DT 125, année 2021, 8 500 km au compteur. Très bon état, toujours garée, entretien régulier. Prête à rouler, papiers en règle.',
      1800000, false, 'port-gentil', 'bon_etat', '0601010101', now() - interval '2 days'),
    ('meubles',          'demo-canape-3-places',
      'Canapé 3 places + fauteuil assorti',
      'Canapé 3 places et fauteuil assorti, tissu beige, 2 ans d''utilisation. Maison non fumeuse. À retirer sur Ntoum, disponible immédiatement.',
      450000, true, 'ntoum', 'bon_etat', '0601010101', now() - interval '3 days'),
    ('mode-femme',       'demo-robe-wax',
      'Robe wax femme — taille M',
      'Robe en wax, taille M, jamais portée (c''est un cadeau). Couture soignée réalisée à Libreville. Très élégante et confortable, parfaite pour une cérémonie.',
      25000, false, 'libreville', 'neuf', '0601010101', now() - interval '4 days'),
    ('autres',           'demo-canon-eos-250d',
      'Canon EOS 250D — kit 18-55 mm',
      'Canon EOS 250D avec objectif 18-55 mm, compteur autour de 2 000 photos. Livré avec 2 batteries et carte mémoire 32 Go. Idéal pour se lancer en photographie.',
      950000, true, 'libreville', 'comme_neuf', '0601010101', now() - interval '5 days'),
    ('cours-particuliers','demo-cours-maths-physique',
      'Cours de Maths & Physique (collège / lycée)',
      'Cours particuliers de mathématiques et de physique-chimique pour le collège et le lycée, à domicile à Libreville ou en ligne. 15 000 FCFA la séance, première séance d''essai gratuite. Professeur expérimenté.',
      15000, true, 'libreville', null, '0601010101', now() - interval '6 days'),
    ('location',         'demo-appartement-2-chambres',
      'Appartement 2 chambres à louer — zone portuaire',
      'Appartement 2 chambres spacieux à Port-Gentil, meublé, électricité et eau stables. Loyer mensuel 600 000 FCFA, disponible immédiatement. Locataires sérieux uniquement, sans commission.',
      600000, true, 'port-gentil', null, '0601010101', now() - interval '7 days'),
    ('reparations',      'demo-reparation-informatique',
      'Réparation informatique à domicile',
      'Réparation de PC et ordinateurs portables : suppression de virus, installation de systèmes, remplacement de pièces, récupération de données. Déplacement possible dans Libreville. Devis gratuit, prix selon l''intervention.',
      null, true, 'libreville', null, '0601010101', now() - interval '8 days')
  ) as v(category_slug, slug, title, description, price, negotiable, city_slug, condition, contact, created)
) v
join public.categories c on c.slug = v.category_slug
join public.localities l on l.slug = v.city_slug
on conflict (slug) do nothing;
