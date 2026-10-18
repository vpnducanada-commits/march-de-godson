# GODSON Marketplace

Petites annonces et marketplace pour le Gabon — français, FCFA (XAF), localités gabonaises,
contact direct vendeur/acheteur (pas de paiement en ligne en v1).

## Stack

- **Frontend** : React 18 + TypeScript + Vite, React Router 6, PWA (vite-plugin-pwa, Workbox)
- **Backend** : Supabase (Postgres + RLS, Auth, Storage, PostgREST)
- **Identité** : bleu nuit `#0A1633`, bleu `#2563EB`, jaune `#F5B82E`, Inter/Manrope, monogramme GM

## Démarrage

```bash
npm install
cp .env.example .env   # renseigner VITE_SUPABASE_URL et VITE_SUPABASE_PUBLISHABLE_KEY
npm run dev            # http://localhost:5173
npm run build          # vérif TS + build prod (dist/)
```

Scripts utilitaires :

```bash
npm run icons          # régénère les icônes PWA (PNG sans dépendance)
npm run demo-images    # régénère les visuels d'annonces de démonstration (SVG)
```

## Logo & assets de marque

Le logo officiel (fourni) est intégré partout :

| Asset | Fichier | Usage |
|---|---|---|
| Symbole (tuile) | `public/logo-symbol.png` | Header, footer, page 404, favicon, icônes PWA |
| Logo complet | `public/logo.png` | Partage, documentation, image OG |
| Image de partage | `public/og-image.png` | Balises `og:image` / `twitter:image` |
| Favicon + icônes | `public/favicon.png`, `public/icons/*` | Onglet, PWA (192/512/masquable/apple) |

Les icônes PWA et le favicon sont dérivés du symbole (fond clair `#FDFDFD`).
Pour remplacer le logo, il suffit de remplacer `logo.png` et `logo-symbol.png`
(même ratio ~1:1) puis de régénérer les icônes — le composant `Logo` n'a pas
à être modifié. La mention du créateur (« Créé par Gédéon OKANA (alias Godson) »)
figure sur la page **À propos** (`src/pages/StaticPage.tsx`).

## Tests

Deux suites, toutes deux branchées sur l'environnement Supabase de `.env` :

```bash
npm run test:api       # 34 assertions API / RLS / sécurité (Node, zéro dépendance)
npm run test:e2e:install   # une fois : télécharge Chromium
npm run test:e2e       # 23 assertions navigateur (Playwright) — nécessite `npm run dev`
```

- `tests/api.test.mjs` — auth (login démo/admin, refus de mauvais mot de passe), données,
  recherche insensible à la casse, tri prix avec nulls, joins FK, RLS (insertion anonyme,
  modification croisée d'annonces, usurpation de `user_id` dans les favoris, journal d'audit,
  droits Storage par dossier), et nettoyage intégral en fin de run.
- `tests/e2e/smoke.mjs` — accueil mobile/desktop, recherche + état vide, connexion réelle,
  favoris, gating admin, **visibilité et clics réels des onglets** (compte + admin), 404,
  fiche annonce (prix FCFA, boutons Appeler/WhatsApp, image), redirection publication.
- Les deux suites créent/consomment des données réelles : elles suppriment tout ce qu'elles
  créent (sauf l'utilisateur temporaire de la suite API, affiché en fin de run — sa
  suppression requiert du SQL : `delete from auth.users where id = '<id>';`).
- Le **mot de passe admin** de l'environnement de test se définit dans `.env`
  (`GM_ADMIN_EMAIL`, `GM_ADMIN_PASSWORD`) — jamais dans le code commité.

## Mise en production

Le repo est **zéro-config** pour les trois hébergeurs statiques gratuits (build, SPA,
en-têtes de sécurité et cache définis dans `netlify.toml`, `vercel.json`, `public/_headers`) :

1. Pousser le repo sur GitHub (voir « Déploiement » ci-dessous).
2. Importer le repo dans Netlify / Vercel / Cloudflare Pages → le build tourne tout seul
   (le sitemap est régénéré à chaque build depuis la BDD Supabase, annonces actives incluses).

Une fois le **domaine final** connu, il reste 3 réglages (5 minutes) :

| Où | Quoi |
|---|---|
| Hébergeur | Pointer le domaine vers le site |
| Hôte CI (optionnel) | Variable `VITE_SITE_URL=https://votre-domaine` → le sitemap et les images de partage (og:/twitter:) utilisent le vrai domaine ; sans elle, `https://votre-domaine.com` reste en placeholder |
| Supabase | `site_url` = votre domaine (Auth → URL du site) pour les e-mails de mot de passe oublié ; ajouter le domaine dans `uri_allow_list` si besoin |

## Déploiement GitHub

Le repo est initialisé localement avec un commit initial sur `main`. Pousser :

```bash
git remote add origin https://github.com/<votre-compte>/godson-marketplace.git
git push -u origin main
```

## Base de données

Migrations versionnées dans `supabase/migrations/` (à appliquer dans l'ordre, ex. via
`supabase db push` ou l'éditeur SQL) :

| Fichier | Rôle |
|---|---|
| `001_schema.sql` | Tables, RLS, fonctions, bucket stockage |
| `002_seed_categories_localities.sql` | 16 catégories (46 sous-catégories) + 21 localités |
| `003_demo_data.sql` | Compte démo + 10 annonces de démonstration (`is_demo = true`) |
| `004_admin_rpc.sql` | RPC `admin_list_users()` (SECURITY DEFINER, autorisation en base) |
| `005_storage_public_bucket.sql` | Bucket images public + purge admin des fichiers |

Retrait des données de démonstration (sans toucher aux données réelles) :

```sql
delete from public.listings where is_demo = true;
update public.profiles set is_demo = false;
delete from auth.users where id = '9c1f6a7e-0000-4a11-8b2c-d3e4f5060d01';
```

## Comptes

| Rôle | E-mail | Mot de passe |
|---|---|---|
| Démonstration (visuel uniquement) | `demo@godson-market.example` | `Demo1234!` |
| Administration | voir note de déploiement | — |

Le compte de démonstration est clairement identifié dans l'interface (badge « Démo ») et ses
données sont séparables (champ `is_demo`).

## Choix de conception documentés

- **Images d'annonces** : bucket `listing-images` public (contenu public par nature en petites
  annonces), écriture strictement propriétaire (`{userId}/...`), suppression possible par un
  admin (purge des images d'une annonce refusée, cf. `adminModerateListing`).
- **Administration** : jamais de clé `service_role` dans le navigateur ; le rôle `admin` est
  vérifié en base (RLS + RPC SECURITY DEFINER). Toute action d'administration est journalisée
  dans `admin_audit_logs`.
- **Recherche** : colonne générée `search_text` (normalisation casse + accents) + index
  `gin_trgm` ; la normalisation côté client (`normalizeText`) reflète celle du SQL.
- **PWA** : manifest FR, icônes 192/512/masquable, appui offline sur les statiques et les
  visuels `/demo/` ; les données restent requises en ligne.

## Sécurité

- RLS sur toutes les tables publiques ; lecture publique limitée aux annonces `active`.
- Mots de passe : bcrypt côté Auth (jamais en clair) ; session JWT supabase-js.
- Validation des images côté client (type, taille, compression) + politiques Storage.
- `service_role` absente du code applicatif.
