# GODSON Marketplace

[![CI](https://github.com/vpnducanada-commits/march-de-godson/actions/workflows/ci.yml/badge.svg)](https://github.com/vpnducanada-commits/march-de-godson/actions/workflows/ci.yml)

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
npm run test:api       # 62 assertions API / RLS / sécurité (Node, zéro dépendance)
npm run test:e2e:install   # une fois : télécharge Chromium
npm run test:e2e       # 28 assertions navigateur (Playwright) — nécessite `npm run dev`
```

- `tests/api.test.mjs` — auth (login démo/admin, refus de mauvais mot de passe), données,
  recherche insensible à la casse, tri prix avec nulls, joins FK, RLS (insertion anonyme,
  modification croisée d'annonces, usurpation de `user_id` dans les favoris, journal d'audit,
  droits Storage par dossier), **messagerie** (ouverture par l'acheteur, unicité,
  invisibilité par les tiers, anti-usurpation de `sender_id`, réponse du vendeur,
  compteur de non-lus, marquage « lu », fermeture par l'acheteur) et **quota 20 annonces**
  (21e refusée), et nettoyage intégral en fin de run.
- `tests/e2e/smoke.mjs` — accueil mobile/desktop, recherche + état vide, connexion réelle,
  favoris, gating admin, **visibilité et clics réels des onglets** (compte + admin), 404,
  fiche annonce (prix FCFA, boutons Appeler/WhatsApp, image), **messagerie** (bouton
  « Message le vendeur », redirection vers la conversation, titre listé), redirection
  publication.
- Les deux suites créent/consomment des données réelles : elles suppriment tout ce qu'elles
  créent (sauf l'utilisateur temporaire de la suite API, affiché en fin de run — sa
  suppression requiert du SQL : `delete from auth.users where id = '<id>';`).
- Le **mot de passe admin** de l'environnement de test se définit dans `.env`
  (`GM_ADMIN_EMAIL`, `GM_ADMIN_PASSWORD`) — jamais dans le code commité.

## En ligne

Production (Vercel) : **https://godson-marketplace.vercel.app**

Guide domaine gratuit (eu.org) : voir [`GUIDE_DOMAINE_EU_ORG.md`](GUIDE_DOMAINE_EU_ORG.md).

## v1.4 — Messagerie, confiance, admin (19/10/2026)

| Fonctionnalité | Détail |
|---|---|
| **Messagerie acheteur ↔ vendeur** | Bouton « Message le vendeur » sur la fiche annonce → conversation 1:1 liée à l'annonce (une seule par annonce/acheteur). Temps réel **Supabase Realtime** (nouveaux messages instantanés, sans rechargement), mobile (liste ↔ fil) et bureau (2 volets), compteur de non-lus + badge dans le header, marquage « lu », l'acheteur peut fermer sa conversation |
| **Sécurité messagerie (en base)** | RLS : seuls les participants lisent/écrivent ; **impossible de forger l'expéditeur** (`sender_id = auth.uid()`, migration 008) ; un non-participant ne voit rien ni n'écrit ; message vide interdit (1–2000 caractères) |
| **Badge « E-mail vérifié »** | Indicateur honnête sur la fiche annonce et le profil vendeur : basé sur la **confirmation réelle de l'adresse** dans Supabase Auth (RPC `profile_email_confirmed`), jamais un badge marketing. Masqué pour le compte démo |
| **Quota anti-spam (20 annonces)** | Trigger en base : un compte ne peut pas avoir plus de 20 annonces `active`/`pending` ; la 21e est refusée avec un message clair à l'utilisateur. Le contournement par le navigateur est impossible (blocage côté serveur) |
| **Export CSV (admin)** | Bouton « Exporter CSV » dans l'onglet Anonces : toutes les annonces (pagination 50/page, BOM UTF-8, séparateur `;`) téléchargeables en un clic — reporting sans SQL |
| **Étude paiements v2** | `PAIEMENTS_V2_OPTIONS.md` : Airtel Money (API officielle, sandbox, onboarding 3–6 sem.), Moov Money (Moov Money Online, ~48 h, contrat partenaire), agrégateurs locaux (PVit, SingPay) — frais réels cités avec sources, **aucun code payant inventé** |

**Architecture messagerie** : tables `conversations` (unique `listing_id`+`buyer_id`) et
`messages` (publication Realtime `supabase_realtime`) ; les abonnements côté client partagent
un canal unique avec registre de listeners (refcounting) — un composant peut s'abonner sans
jamais ré-ouvrir un canal déjà actif (exigence Supabase Realtime).

## v1.3 — Améliorations (19/10/2026)

| Fonctionnalité | Détail |
|---|---|
| **Expiration des annonces (90 j)** | Migration 006 : colonne `expires_at` ; annonce expirée masquée du catalogue public (RLS) mais visible par son vendeur ; **reprise gratuite de 90 jours** via la RPC `renew_listing` (badge « Expirée » + échéance dans l'espace vendeur, panneau dédié sur la fiche) |
| **SEO — données structurées** | JSON-LD `Product` (prix XAF, photos, vendeur, état) + `BreadcrumbList` sur chaque fiche, `Organization` en tête de site → éligible aux résultats enrichis Google |
| **Mesures** | **Vercel Analytics** (performances + erreurs, sans cookie, gratuit) actif en production ; **Sentry** prêt à l'emploi — ajouter un `VITE_SENTRY_DSN` (compte gratuit) sur Vercel et les erreurs JS remontent (chunk dynamique : 0 Ko tant que non configuré) |
| **E-mails transactionnels** | Edge function `notify-email` (Brevo, plan gratuit 300/j) : annonce publiée/refusée/archivée → e-mail au vendeur ; nouveau signalement → e-mail à l'admin. JWT vérifié, service_role côté serveur, destinataires lus en base (jamais fournis par le client). Sans clé Brevo : 503 silencieux, le site fonctionne normalement |
| **CI GitHub Actions** | `.github/workflows/ci.yml` : build (tsc strict + Vite) à chaque push/PR, puis tests API + E2E quand les secrets sont configurés (voir ci-dessous) |

**Activer les tests en CI** — GitHub → repo → *Settings → Secrets and variables → Actions* :

| Secret | Valeur |
|---|---|
| `GM_ADMIN_EMAIL` | compte admin de test (voir section Comptes) |
| `GM_ADMIN_PASSWORD` | son mot de passe |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | clé publishable du projet Supabase (publique) |

**Activer les e-mails** — 5 minutes, gratuit :
1. Créer un compte sur [brevo.com](https://www.brevo.com) (plan Starter, 300 e-mails/jour, sans carte)
2. Dans Brevo : *Senders & Domaines* → ajouter l'adresse expéditrice (ex. `contact@votre-domaine`) + vérifier le SPF
3. *SMTP & API* → créer une clé API
4. Sur Supabase : *Edge Functions → notify-email → Secrets* → ajouter `BREVO_API_KEY` et `MAIL_FROM`
5. C'est tout — la fonction passe de 503 à actif, les e-mails partent automatiquement

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
| `006_listing_expiration.sql` | Expiration 90 j : `expires_at` + RPC `renew_listing` + forçage admin |
| `007_messaging_quota.sql` | **Messagerie** : tables `conversations`/`messages` + RLS participants + temps réel ; **quota 20 annonces actives/compte** (trigger) ; RPC `profile_email_confirmed` |
| `008_messaging_hardening.sql` | Anti-usurpation : `sender_id = auth.uid()` ; RPC `unread_count()` |
| `009_conversation_delete.sql` | L'acheteur peut fermer sa conversation (messages en cascade) |

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
| Administration | comptes `admin` de l'exploitant (rôle `admin` dans `profiles`) | jamais stocké ici |

Le rôle `admin` est accordé en base : `update public.profiles set role='admin' where id='<user_id>';`
(les mots de passe d'administration ne sont volontairement documentés nulle part dans le repo).

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
