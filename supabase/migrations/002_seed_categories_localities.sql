-- GODSON MARKETPLACE — Migration 002 : catégories et localités de démarrage
-- Idempotent (on conflict do nothing). Extensible via le panneau d'administration.

-- Catégories principales
insert into public.categories (slug, name, icon, sort_order) values
  ('telephones',    'Téléphones & accessoires',        'smartphone', 1),
  ('informatique',  'Informatique & électronique',    'monitor',    2),
  ('vehicules',     'Véhicules & automobile',         'car',        3),
  ('immobilier',    'Immobilier',                      'home',       4),
  ('maison',        'Maison, meubles & décoration',   'sofa',       5),
  ('mode',          'Mode, vêtements & chaussures',   'shirt',      6),
  ('beaute',        'Beauté & soins',                 'sparkles',   7),
  ('electro',       'Électroménager',                 'zap',        8),
  ('emploi',        'Emploi & recrutement',           'briefcase',  9),
  ('services',      'Services professionnels',        'wrench',    10),
  ('travaux',       'Travaux & artisanat',            'hammer',    11),
  ('education',     'Éducation & formation',          'book',      12),
  ('loisirs',       'Loisirs, sport & divertissement','gamepad',   13),
  ('agriculture',   'Agriculture & élevage',          'leaf',      14),
  ('pro',           'Commerce & équipements pro',     'package',   15),
  ('autres',        'Autres',                         'grid',      16)
on conflict (slug) do nothing;

-- Sous-catégories (rattachées par slug de la catégorie parente)
insert into public.categories (parent_id, slug, name, sort_order)
select p.id, v.slug, v.name, v.sort
from public.categories p
join (
  select * from (values
    ('telephones',    'smartphones',        'Smartphones',              1),
    ('telephones',    'tablettes',          'Tablettes',                2),
    ('telephones',    'accessoires-tel',    'Accessoires',              3),
    ('informatique',  'ordinateurs',        'Ordinateurs',              1),
    ('informatique',  'peripheriques',      'Périphériques',            2),
    ('informatique',  'imprimantes',        'Imprimantes',              3),
    ('vehicules',     'voitures',           'Voitures',                 1),
    ('vehicules',     'motos',              'Motos & quad',             2),
    ('vehicules',     'pieces-auto',        'Pièces & accessoires',     3),
    ('immobilier',    'vente-immobilier',   'Vente',                    1),
    ('immobilier',    'location',           'Location',                 2),
    ('immobilier',    'terrains',           'Terrains & concessions',   3),
    ('maison',        'meubles',            'Meubles',                  1),
    ('maison',        'decoration',         'Décoration',               2),
    ('maison',        'bricolage',          'Bricolage',                3),
    ('mode',          'mode-homme',         'Homme',                    1),
    ('mode',          'mode-femme',         'Femme',                    2),
    ('mode',          'mode-enfants',       'Enfants',                  3),
    ('mode',          'chaussures',         'Chaussures',               4),
    ('beaute',        'cosmetiques',        'Cosmétiques',              1),
    ('beaute',        'parfums',            'Parfums',                  2),
    ('beaute',        'soins',              'Soins',                    3),
    ('electro',       'cuisine',            'Cuisine',                  1),
    ('electro',       'linge',              'Linge',                    2),
    ('electro',       'climatisation',      'Climatisation',            3),
    ('emploi',        'offres-emploi',      'Offres d''emploi',         1),
    ('emploi',        'stages',             'Stages & contrats courts', 2),
    ('services',      'comptabilite',       'Comptabilité & finance',   1),
    ('services',      'traduction',         'Traduction & rédaction',   2),
    ('services',      'evenements',         'Événementiel',             3),
    ('services',      'location-materiel',  'Location de matériel',     4),
    ('travaux',       'construction',       'Construction',             1),
    ('travaux',       'reparations',        'Réparations',              2),
    ('travaux',       'artisanat',          'Artisanat',                3),
    ('education',     'cours-particuliers', 'Cours particuliers',       1),
    ('education',     'formations',         'Formations',               2),
    ('education',     'materiel-scolaire',  'Matériel scolaire',        3),
    ('loisirs',       'sport',              'Sport',                    1),
    ('loisirs',       'musique',            'Musique',                  2),
    ('loisirs',       'jeux',               'Jeux & jouets',            3),
    ('agriculture',   'betail',             'Bétail',                   1),
    ('agriculture',   'intrants',           'Intrants & équipements',   2),
    ('agriculture',   'produits-agricoles', 'Produits agricoles',       3),
    ('pro',           'equipements',        'Équipements',              1),
    ('pro',           'fournitures',        'Fournitures',              2),
    ('pro',           'materiaux',          'Matériaux',                3)
  ) as v(parent_slug, slug, name, sort)
) as v
on p.slug = v.parent_slug
on conflict (slug) do nothing;

-- Localités du Gabon (catalogue de départ, extensible)
insert into public.localities (slug, name, province, sort_order) values
  ('libreville',   'Libreville',   'Estuaire',        1),
  ('owendo',       'Owendo',       'Estuaire',        2),
  ('ntoum',        'Ntoum',        'Estuaire',        3),
  ('akanda',       'Akanda',       'Estuaire',        4),
  ('kotto',        'Kotto',        'Estuaire',        5),
  ('komo',         'Komo',         'Estuaire',        6),
  ('cap-esterias', 'Cap Estérias', 'Estuaire',        7),
  ('port-gentil',  'Port-Gentil',  'Ogooué-Ivindo',   10),
  ('moebete',      'Moebété',      'Ogooué-Ivindo',   11),
  ('makokou',      'Makokou',      'Ogooué-Ivindo',   12),
  ('franceville',  'Franceville',  'Haut-Ogooué',     20),
  ('moanda',       'Moanda',       'Haut-Ogooué',     21),
  ('mvengue',      'Mvengue',      'Haut-Ogooué',     22),
  ('bitanda',      'Bitanda',      'Haut-Ogooué',     23),
  ('lambarene',    'Lambaréné',    'Moyen-Ogooué',    30),
  ('tchibanga',    'Tchibanga',    'Ngounié',         40),
  ('mouila',       'Mouila',       'Nyanga',          50),
  ('kango',        'Kango',        'Ogooué-Maritime', 60),
  ('port-louis',   'Port-Louis',   'Ogooué-Maritime', 61),
  ('oyem',         'Oyem',         'Woleu-Ntem',      70),
  ('djambala',     'Djambala',     'Woleu-Ntem',      71)
on conflict (slug) do nothing;
