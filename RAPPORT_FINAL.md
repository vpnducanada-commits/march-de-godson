# GODSON Marketplace — Rapport final de livraison

**Date** : 18 octobre 2026 — **mise à jour v1.4 le 19 octobre 2026**
**Production** : https://godson-marketplace.vercel.app (en ligne depuis le 18/10, v1.4 le 19/10)
**Projet Supabase** : `uzzxtwaaqliwqjzudqjz` (`https://uzzxtwaaqliwqjzudqjz.supabase.co`)
**Légende** : ✅ Fait et testé · ✔️ Fait (vérifié par build/inspection, pas de test d'usage) · 🔧 Preparé (prêt, en attente d'un acte extérieur : domaine, compte, import…)

---

## 1. Identité visuelle & logo — ✅ Fait et testé

- **Logo officiel (fourni, 18/10)** intégré partout : header, footer, page 404, favicon, icônes PWA et image de partage. Assets : `public/logo.png` (complet), `public/logo-symbol.png` (symbole, fond clair `#FDFDFD`), `public/og-image.png` (1200×630). Les icônes (192/512/masquable/apple, favicon 64) sont dérivées du symbole via `npm run brand-icons` (ImageMagick).
- Palette extraite du logo : navy `#102948`, bleu `#0B5AB7`, or `#F5B82E` (image OG) ; le reste de l'app conserve bleu nuit `#0A1633`, bleu `#2563EB`, jaune `#F5B82E`. Typographies Inter (texte) + Manrope (titres).
- Style éditorial premium minimaliste, pas d'emoji (bibliothèque `Icon` SVG interne), pas de boutons décoratifs.
- Testé : logo affiché en header (mobile 390 px + desktop 1280 px), footer, 404 ; icônes vérifiées visuellement ; 0 erreur JS.

## 2. Schéma de données & migrations versionnées — ✅ Fait et testé

- 5 migrations dans `supabase/migrations/` (001→005), toutes **appliquées** sur le projet `uzzxtwaaqliwqjzudqjz`.
- Tables : `profiles`, `categories` (16 top + 46 sous), `localities` (21), `listings` (slug unique, `search_text` générée + index `gin_trgm`), `listing_images`, `favorites`, `reports`, `admin_audit_logs`.
- Déclencheurs : création automatique du profil à l'inscription, `updated_at`.
- Testé : migrations appliquées sans erreur ; données vérifiées par requête (62 catégories, 21 localités, 10 annonces démo).

## 3. Sécurité & RLS — ✅ Fait et testé

Batterie de tests REST exécutée ce jour (résultats) :

| Test | Résultat |
|---|---|
| Insertion annonce par anonyme | ✅ 401 refusé |
| PATCH d'une annonce par un autre utilisateur | ✅ 0 ligne touchée, donnée intacte |
| Favoris : lecture des favoris d'un autre | ✅ vide |
| Favoris : usurpation de `user_id` à l'insertion | ✅ 42501 refusé |
| `admin_list_users()` par non-admin | ✅ liste vide (aucune fuite) |
| `admin_list_users()` par admin | ✅ liste complète |
| Modération (status) par admin sur annonce d'un tiers | ✅ 204 |
| Annonce `pending` masquée du public | ✅ confirmée |
| Audit admin : écriture non-admin / lecture non-admin | ✅ refusé / vide |
| Storage : upload croisé dans le dossier d'un tiers | ✅ refusé |
| Storage : suppression par non-propriétaire (non-admin) | ✅ refusé |
| Storage : suppression par propriétaire **et** par admin | ✅ autorisé |
| URL publiques des images (`/object/public/`) | ✅ 200 (bucket public) |

- Zéro clé `service_role` dans le code applicatif ; autorisation admin **en base** (RLS + RPC `SECURITY DEFINER`), jamais un flag modifiable côté navigateur.
- **Bug corrigé en cours de route** : le bucket images était privé alors que l'app affiche les images par URL publique → toutes les images téléversées seraient invisibles. Corrigé par la migration 005 (bucket public + purge admin des images d'une annonce refusée).

## 4. Authentification réelle (Supabase Auth) — ✅ Fait et testé

- Inscription / connexion / mot de passe oublié / déconnexion via `supabase-js` (aucune simulation locale).
- **Bug critique corrigé** : le compte créé par SQL échouait au login (500 GoTrue « Database error querying schema »). Cause : hachage bcrypt tronqué dans la seed + colonnes `auth.users` NULL (`confirmation_token`, `recovery_token`, `email_change_token_new`, `email_change`) + absence de ligne `auth.identities`. Tout corrigé, migration 003 réécrite pour les déploiements neufs, login ré-testé avec succès.
- **Bug corrigé** : `AuthContext` restait en état de chargement après authentification (écran bloqué sur spinner) → refonte avec séquenceur anti-course. Testé par login réel dans le navigateur.
- Comptes en place : démo (`demo@godson-market.example` / `Demo1234!`) et administration (compte créé, identifiants transmis en direct — cf. §15).

## 5. Catalogue, recherche, filtres, tri, pagination — ✅ Fait et testé

- Recherche plein texte insensible à la casse **et aux accents** (colonne générée normalisée + `gin_trgm` ; testé : « iphone » trouve « iPhone 13 Pro »).
- Filtres : catégorie (+ sous-catégorie), localité, prix min/max, état, tri (récence, prix croissant `nullsfirst`, prix décroissant `nullslast` — tris validés contre l'API), pagination 12/page.
- Testé : recherche UI (résultat + état vide soigné), tris via REST, rendu mobile/desktop.

## 6. Fiche annonce (détail) — ✅ Fait et testé

- Galerie (image principale + miniatures), prix FCFA formaté, état, localité, catégorie/sous-catégorie, vendeur, temps relatif.
- Contact direct : boutons **Appeler** (`tel:+241…`, normalisation des numéros gabonais) et **WhatsApp** (`wa.me/241…` avec message pré-rempli) — testés (hrefs vérifiés dans le DOM).
- Pas de faux badges « vendeur vérifié », pas de faux statistiques de popularité ; états vides soignés à la place.
- **Correction (18/10)** : le fil d'Ariane affichait le nom dupliqué pour une sous-catégorie (« Voitures > Voitures ») ; il affiche désormais la catégorie parente (« Véhicules & automobile > Voitures »), le maillon parent pointant vers la page de la catégorie parente.

## 7. Publication & modification d'annonce — ✅ Fait et testé (E2E complet)

- Formulaire complet : catégorie/sous-catégorie, titre, description, prix + négociable, localité, état, type de vendeur, téléphone/WhatsApp (validation Gabon), jusqu'à 6 images (validation type/taille, compression navigateur 1400 px, upload Storage, rollback intégral en cas d'erreur).
- **Flux E2E validé dans le navigateur** (18/10) : remplissage du formulaire + upload d'une image réelle → redirection vers la fiche publiée → image servie depuis le Storage Supabase (URL publique réelle) → annonce trouvable à la recherche → suppression propre (annonce + fichier Stockage). Aucune donnée de test résiduelle.
- Testé : upload/suppression Storage, insertion RLS, redirection anonyme→connexion, build.

## 8. Espace utilisateur (compte, favoris, paramètres) — ✅ Fait et testé

- Dashboard (mes annonces, actions modifier/supprimer), favoris (dual-mode : localStorage anonyme / base quand connecté), paramètres (profil, compte).
- Testé : session démo → `/compte` et `/compte/favoris` rendus, RLS favoris validé en REST, déconnexion propre.

## 9. Administration — ✅ Fait et testé

- Onglets : Annonces (modérer : pending/refused/archived + purge des images si refusée), Signalements, Utilisateurs (suspendre/réactiver, promouvoir admin), Catalogue (catégories + localités, ajout/désactivation), Journal d'audit.
- Chaque action admin est journalisée dans `admin_audit_logs` (écrites côté API avec `admin_id`).
- Testé : connexion admin, liste des utilisateurs (RPC), section annonces, modération + audit en REST, page bloquée pour un non-admin (UI + données).

## 10. Données de démonstration — ✅ Fait et testé

- 10 annonces + 1 compte, **clairement identifiées** : badge « Démo » dans l'interface, champ `is_demo = true`, images SVG marquées « ANNONCE DE DÉMONSTRATION », contact fictif unique (06 01 01 01 01).
- Séparables à la demande par 3 lignes SQL (documentées dans le README) sans impact sur les données réelles.
- Testé : affichées sur l'accueil/catalogue/fiches, comptage DB vérifié (10/10 démo, 0 résidu de tests).

## 11. PWA & mobile-first — ✅ Fait et testé

- Manifest FR, icônes 192/512 + masquable, `theme-color`, installable.
- Workbox (generateSW) : 26 entrées en pré-cache, cache runtime des `/demo/` ; les données restent en ligne.
- Testé : parcours complet à 390 px (mobile) et 1280 px (desktop), aucun débordement signalé, navigation complète (21 liens header). **Reste** : test sur appareil physique réel (iOS/Android) avant mise en production.
- **Correction mobile (18/10)** : les rangées d'onglets (Administration 5 onglets, Compte 4 statuts) débordaient de l'écran à 390 px sans affordance de défilement — certains onglets étaient intouchables. Elles s'empilent maintenant sur deux lignes (`flex-wrap`), tous les onglets sont visibles et cliquables. Vérifié par clics réels (non forcés) dans un viewport 390 px.

## 12. SEO — ✔️ Fait, partiellement preparé

- `index.html` : title/description FR, Open Graph, `lang="fr"`, preconnects, fonts.
- `robots.txt` (exclusions admin/compte) + **sitemap dynamique généré à chaque build** (`scripts/generate-sitemap.mjs`, hook `prebuild`) : interroge l'API publique, inclut les pages principales et toutes les annonces actives avec `lastmod` ; hors-ligne il se dégrade proprement (pages principales uniquement, jamais d'échec de build). Testé : 18 URLs générées depuis la BDD réelle.
- **Fait** : balises meta dynamiques par page (title + description + Open Graph) via `usePageMeta`, appliquées aux 13 pages (accueil, catalogue, fiche annonce, compte, admin, pages statiques, 404, …).
- **Fait (18/10)** : image de partage social **Open Graph / Twitter card** (1200×630, identité GM : monogramme, bleu nuit #0A1633, or #F5B82E, Manrope/Inter) — par défaut sur les 13 pages, et **l'image de l'annonce elle-même** sur les fiches (partage WhatsApp). Domaine injecté via `VITE_SITE_URL` (placeholder `https://vorte-domaine.com` jusqu'au domaine final).
- **Fait (18/10)** : URL canonique + og:url par page (13 pages, via usePageMeta) — domaine injecté via VITE_SITE_URL, s'ajustera automatiquement au domaine final.

## 13. Pages statiques & 404 — ✅ Fait et testé

- FAQ, À propos, Sécurité, Conditions, Confidentialité (contenus rédigés, cohérents avec v1 sans paiement), page 404 soignée.
- **À propos (18/10)** : mention « Créé par **Gédéon OKANA** (alias **Godson**) » en encart doré dans la section « La marque ».
- Testé : 404 déclenchée et rendue proprement ; navigation depuis le footer ; mention vérifiée en rendu.

## 14. Build, performance & préview — ✅ Fait et testé

- `npm run build` (TypeScript strict + Vite + PWA) : **réussite** sans avertissement. Découpe de bundle faite (18/10) : le client Supabase est isolé dans son propre chunk — JS principal **298 kB / gzip 91 kB** + chunk `supabase` 214 kB / gzip 55 kB, CSS 34,7 kB.
- Préview de développement accessible (hôte autorisé, HTTP 200) et **smoke test navigateur headless : 21/21 assertions réussies** (accueil, recherche, connexion démo, favoris, gating admin, admin, desktop, 404, fiche annonce, redirection publication).
- **Preparé (prêt à déployer)** : configs **zéro-config** fournies pour les 3 hébergeurs gratuits — `netlify.toml`, `vercel.json`, `public/_headers` (build, fallback SPA, en-têtes de sécurité `nosniff`/`X-Frame-Options`/`Permissions-Policy`, cache des assets, `sw.js` non caché). Il ne reste que le choix de l'hébergeur + le domaine (aucun compte tiers n'a été créé).

## 15. Documentation, comptes & limites connues — ✅ Fait

- `README.md` complet (démarrage, migrations, retrait des données démo, comptes, choix documentés), ce rapport.
- **Comptes** :
  - Démo : `demo@godson-market.example` / `Demo1234!` (badge Démo, retirable en 3 lignes SQL).
  - Administration : `admin@godson-market.example` / `Admin1234!` (créé aujourd'hui, rôle `admin` en base). **À changer impérativement** après la première connexion.
- **GitHub** : le repo est **initialisé localement avec un commit initial sur `main`** (91 fichiers, `.env`/`node_modules`/`dist` exclus). Le connecteur GitHub n'étant pas disponible dans cette session, le push reste à faire : `git remote add origin https://github.com/<vous>/godson-marketplace.git && git push -u origin main` (voir README « Déploiement GitHub »).
- **Limites v1 assumées** :
  1. Pas de paiement en ligne (contact direct — par décision de v1).
  2. Pas d'IA de classement (les annonces sont triées par recence/prix uniquement — aucun « boost » simulé).
  3. E-mails transactionnels **prêts mais non actifs** : edge function déployée et testée
     (401/503 propres), en attente d'une clé Brevo gratuite (item 20). L'auto-confirmation
     Supabase reste activée, donc aucun e-mail bloquant ; les liens de mot de passe oublié
     dépendront du domaine final.
  4. Libre tier Supabase : 500 Mo de base, 1 Go de stockage, pause après 1 an d'inactivité — suffisant pour la v1 ; au-delà, un plan payant sera nécessaire (signalé, aucun prix inventé).
  5. ~~Tests~~ → **Fait (18/10), étendu (19/10)** : `npm run test:api` (**41 assertions** API/RLS/sécurité/expiration, zéro dépendance) et `npm run test:e2e` (**25 assertions** navigateur Playwright, dont JSON-LD, visibilité/clics réels des onglets). Les deux suites passent vert et tournent en CI quand les secrets GitHub sont renseignés. Seuls des tests unitaires purement front (Vitest) restent à ajouter en v1.1.

---

## 16. Déploiement production Vercel — ✅ Fait et testé (18/10)

- Projet Vercel `godson-marketplace` (compte `vpnducanada-5697`) : déploiement de la source
  (build Vite côté Vercel), variables d'environnement Supabase configurées sur le projet,
  protection SSO désactivée, alias production **`https://godson-marketplace.vercel.app`**.
- Vérifié en navigateur réel sur l'URL publique : titre FR, 16 annonces réelles depuis Supabase,
  routage SPA, fiche annonce FCFA, logo, 0 erreur JS.
- `godsonmarket.com` (déjà présent dans le compte Vercel, relié au projet le 18/10) : en attente
  des enregistrements DNS chez name.com (A `76.76.21.21` + CNAME `www → cname.vercel-dns.com`)
  — l'ancien site qui l'occupe n'a pas été modifié.

## 17. v1.3 — Expiration & reprise des annonces — ✅ Fait et testé (19/10)

- Migration **006** : `listings.expires_at` (défaut `now() + 90 jours`, index partielle),
  politique RLS publique resserrée (`active` **et** non expirée ; propriétaire/admin inchangés),
  RPC `renew_listing` (`security definer`, propriétaire ou admin, annonce active uniquement,
  `revoke` sur `public`/`anon`).
- Interface : badge « Expirée » + date d'échéance dans l'espace vendeur (+ alerte à J-14),
  bouton « Reprendre (90 j) » ; fiche annonce : panneau dédié « Annonce expirée » avec reprise.
- **Tests** : 7 assertions API ajoutées (échéance ≈ 90 j, forçage admin, refus croisé, masquage
  public, visibilité propriétaire, reprise RPC, refus tiers) — **41/41 API**.

## 18. v1.3 — Données structurées SEO (JSON-LD) — ✅ Fait et testé (19/10)

- Fiche annonce : `Product` (nom, description, photos absolues, offre XAF, état, vendeur
  Person/Organization selon le type) + `BreadcrumbList` (Accueil → Catalogue → Catégorie → Titre).
- Site : `Organization` statique dans `<head>`.
- Bonus : l'URL canonique est désormais calculée sur le domaine réel de consultation
  (`window.location.origin`) — correcte sur `.vercel.app` comme sur le futur domaine personnalisé,
  sans re-build.
- **Tests** : 2 assertions E2E ajoutées (présence des 3 blocs, prix XAF dans le schema) — **25/25 E2E**.

## 19. v1.3 — Observabilité & CI — ✅ Fait / 🔧 partiellement en attente (19/10)

- **Vercel Analytics** (gratuit, sans cookie) : actif et vérifié en production (SDK v2, mode
  production, chargement du script insights).
- **Sentry** : intégration prête (`@sentry/react`, initialisation conditionnelle, chunk dynamique
  → 0 Ko tant qu'inactif). 🔧 En attente : création d'un compte Sentry gratuit + `VITE_SENTRY_DSN`
  sur Vercel (1 variable, sans re-codage).
- **CI GitHub Actions** (`.github/workflows/ci.yml`) : build (tsc strict + Vite) à chaque
  push/PR — **exécution verte vérifiée le 19/10**. Tests API + E2E en CI 🔧 en attente des 3
  secrets GitHub (`GM_ADMIN_EMAIL`, `GM_ADMIN_PASSWORD`, `VITE_SUPABASE_PUBLISHABLE_KEY`) —
  le workflow les détecte et saute proprement les tests avec un avertissement tant qu'absents.

## 20. v1.3 — E-mails transactionnels (Brevo) — 🔧 Preparé, en attente d'une clé gratuite (19/10)

- Edge function Supabase **`notify-email`** (ACTIVE) : annonce publiée / refusée / archivée
  → e-mail au vendeur ; nouveau signalement → e-mail à l'admin (`ADMIN_EMAIL` configuré).
- Sécurité : service_role **uniquement côté serveur**, JWT de l'appelant vérifié, destinataires
  toujours lus en base ou dans les secrets (jamais fournis par le client), 401 sans session.
- **Vérifié** : 401 sans auth ; 503 `email_not_configured` sans clé Brevo (le site et la
  modération fonctionnent normalement dans cet état — dégradé gracieux, aucun e-mail faux).
- 🔧 Restant (5 min, gratuit, documenté dans le README « Activer les e-mails ») : compte Brevo
  (300 e-mails/jour sans carte) → adresse expéditrice + SPF → clé API → secrets
  `BREVO_API_KEY` + `MAIL_FROM` sur la fonction.

## 21. v1.4 — Messagerie acheteur ↔ vendeur temps réel — ✅ Fait et testé (19/10)

- **Migrations 007 + 008** (appliquées) : tables `conversations` (unique `listing_id`+`buyer_id`)
  et `messages` (check 1–2000 caractères) ; RLS : lecture/écriture **participants uniquement** ;
  insertion de conversation **acheteur non banni uniquement, jamais avec soi-même** ;
  **anti-usurpation** : `sender_id` doit être `auth.uid()` ; publication Realtime
  `supabase_realtime` → `messages` ; RPC `unread_count()`. Migration 009 : fermeture de la
  conversation par l'acheteur (messages en cascade).
- **Interface** : bouton « Message le vendeur » sur la fiche annonce (session requise) →
  page `/messages` (liste) + `/messages/:id` (fil) ; mobile : liste ↔ fil avec retour ;
  bureau ≥ 900 px : deux volets ; temps réel sans rechargement ; auto-scroll ; marquage « lu »
  automatique ; compteur de non-lus + badge dans le header (temps réel global).
- **Temps réel robuste** : un seul canal Realtime partagé (header + page) avec **registre de
  listeners et refcounting** — corrige un crash réel détecté en test (`cannot add
  postgres_changes callbacks after subscribe()`), le canal n'étant supprimé que quand plus
  personne ne l'écoute.
- **Testé** : ouverture par l'acheteur, unicité (2e tentative → 409), invisibilité par anonyme
  ET par un tiers admin, refus de conversation avec soi-même, message envoyé/lus, message vide
  refusé (contrainte), **usurpation de `sender_id` refusée (RLS 403)**, réponse du vendeur,
  compteur de non-lus 1 → 0 après marquage lu, le vendeur ne peut pas supprimer la conversation
  de l'acheteur, fermeture par l'acheteur (cascade vérifiée), E2E : bouton visible en session,
  clic, redirection, conversation listée. Données de test nettoyées en fin de run.

## 22. v1.4 — Badge « E-mail vérifié » (réel) — ✅ Fait et testé (19/10)

- RPC `profile_email_confirmed(uuid)` (SECURITY DEFINER) : renvoie si `is_email_confirmed`
  dans `auth.users` — la **confirmation réelle de l'adresse** par Supabase Auth, pas un statut
  marketing.
- Badge « E-mail vérifié » sur la fiche annonce (section vendeur) et sur le profil vendeur ;
  masqué pour le compte démo. N'apparaît que si l'adresse est effectivement confirmée.

## 23. v1.4 — Quota anti-spam 20 annonces — ✅ Fait et testé (19/10)

- **Trigger en base** `listings_quota` : tout INSERT de listing est bloqué (erreur
  `QUOTA_DEPASSE`) si le vendeur a déjà ≥ 20 annonces `active`/`pending`. Impossibilité de
  contourner par le navigateur (blocage côté serveur). Message UX clair à la publication.
- **Testé** : 20 annonces acceptées, la 21e refusée avec `QUOTA_DEPASSE` (400), annonces de
  test supprimées en fin de run.

## 24. v1.4 — Export CSV admin + étude paiements v2 — ✅ Fait (19/10)

- **Export CSV** (onglet Annonces de l'admin) : toutes les annonces, pagination 50/page
  (cap 40 pages), BOM UTF-8 + séparateur `;` (compatible Excel FR), échappement des guillemets.
- **Étude paiements** `PAIEMENTS_V2_OPTIONS.md` : Airtel Money (API officielle
  developers.airtel.africa + sandbox, commission marchand ~1,2–1,8 % selon source, onboarding
  3–6 sem.), Moov Money (pas d'API self-service publique ; « Moov Money Online », compte
  marchand < 48 h, plafond 1 M FCFA/jour, contrat partenaire), agrégateurs locaux (PVit
  2–2,5 % ; SingPay 0 % ≤ 25 M FCFA). **Aucun code payant écrit, aucun prix officiel inventé** —
  ordres de grandeur datés avec 16 sources citées ; feuille de route en 3 phases.

## 25. Préparation au lancement — audit complet (19/10)

Audit de lancement effectué en production, avec corrections et re-vérifications :

| Vérification | Résultat |
|---|---|
| **Inscription → login → publication → visible** (parcours utilisateur réel) | ✅ Testé de bout en bout (autoconfirm : connexion immédiate sans e-mail) |
| **Réinitialisation de mot de passe** | 🔧→✅ Corrigé : `site_url` était `http://localhost:3000` (liens cassés) ; `redirectTo` pointait sur le formulaire même page ; maintenant `/auth/callback` (route dédiée) → `/compte/parametres` ; `uri_allow_list` production. Le lien de l'e-mail pointe sur la bonne origine (l'envoi lui-même dépend du fournisseur d'e-mails Supabase — à confirmer avec une boîte réelle, voir §26) |
| **Messagerie temps réel 2 navigateurs** | ✅ Conversation visible chez le vendeur dès son ouverture (migration 010 : `conversations` dans la publication Realtime) ; messages bidirectionnels sans rechargement ; badge non-lus temps réel |
| **Toutes les routes** (annonces, catégories, fiche, vendeur, compte, favoris, admin, messages, légales, 404) | ✅ Parcours Playwright en production : 0 erreur JS |
| **PWA** | ✅ Manifeste + icônes 192/512/masquable/apple/`favicon.ico` (généré) ; service worker enregistré ; **app shell affichée hors ligne** (précache testé) |
| **SEO** | ✅ `robots.txt` (exclut /admin, /compte, /modifier), `sitemap.xml` dynamique à la build, JSON-LD vérifié |
| **Sécurité** | ✅ En-têtes prod : HSTS preload, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy` (caméra/mic/géo désactivés) ; RLS testé (62 assertions) |
| **Performance** | ✅ Accueil < 1 s (réseau sandbox→prod), transfert ≈ 0,6 Mo ; assets immuables (max-age 1 an) |
| **Données** | ✅ 10 annonces démo labellisées (expiration ~90 j, aucune en péril) ; comptes de test purgés (5 comptes réels) ; messagerie : zéro conversation résiduelle |
| **CI** | ✅ Verte à chaque push (build) ; les suites de tests sont exécutées manuellement et via les scripts du repo — l'activation en CI attend les 3 secrets GitHub (§26) |

**Écart mineur documenté** : les comptes à domaine réservé `.example` (démo, admin technique)
ne peuvent pas utiliser « Mot de passe oublié » (GoTrue /recover rejette les TLD réservés) —
sans aucun impact pour les vrais utilisateurs.

## 26. Actions restantes (toutes côté exploitant)

| Action | Où | Temps |
|---|---|---|
| **3 secrets CI** : `GM_ADMIN_EMAIL`, `GM_ADMIN_PASSWORD`, `VITE_SUPABASE_PUBLISHABLE_KEY` | GitHub → repo → Settings → Secrets → Actions (l'API sandbox ne permet pas de les pousser) | 2 min |
| **E-mails transactionnels** : compte Brevo gratuit (300/j, sans carte) → SPF → clé API → secrets `BREVO_API_KEY` + `MAIL_FROM` sur la fonction `notify-email` | Brevo + Supabase Edge Functions | 10 min |
| **Confirmer l'e-mail de réinitialisation** : demander un « mot de passe oublié » depuis une boîte réelle et vérifier la réception (fournisseur e-mails par défaut de Supabase) | — | 1 min |
| **Sentry** : `VITE_SENTRY_DSN` (compte gratuit) sur Vercel → les erreurs JS remontent automatiquement | Vercel → Environment variables | 5 min |
| **Domaine** : DNS `godsonmarket.com` (A → 76.76.21.21) et/ou `godsonmarket.fr.eu.org` (guide fourni) | Registrar / eu.org | variable |
| **Mot de passe admin** : changement du mot de passe technique initial | Compte | 1 min |
| **PWA appareil réel** : installer l'app sur un téléphone (iOS/Android) et tester le parcours complet | — | 10 min |
| **Anti-spam inscriptions** (conseillé après le lancement) : activer un captcha gratuit (hCaptcha/Cloudflare Turnstile) dans Supabase → Auth → Settings, si le volume de comptes fantômes l'exige (le quota 20 annonces/compte + la modération limitent déjà l'impact) | Supabase Dashboard | 10 min |
| **✅ Décision paiements v2** (19/10, exploitant) : **paiement confirmé sur Airtel Money** (Option A — direct). Reste la Phase 0 : dossier KYB (RCCM, NIF, RIB, statuts) + ouverture du compte marchand Airtel (onboarding constaté 3–6 semaines) ; le bouton « Payer par Airtel Money » sera branché dès réception des identifiants API | Airtel Money Gabon / developers.airtel.africa | variable |

---

### Ce qui est immédiatement utilisable
- **Site en production** : https://godson-marketplace.vercel.app — **v1.6 en ligne**, PWA
  installable (service worker vérifié), analytics actif, données structurées SEO sur chaque
  fiche, messagerie temps réel, badge e-mail vérifié, quota 20 annonces, export CSV admin.
- Base saine : 10 annonces démo labellisées, comptes démo + admin fonctionnels.
- **Qualité** : build propre (tsc strict, sans avertissement), **90 assertions de tests vertes
  (62 API + 28 E2E)**, CI GitHub Actions verte à chaque push, sitemap dynamique à la build.
- Il ne reste que des actions **externes** (secrets CI GitHub, clé Brevo, DSN Sentry, DNS
  godsonmarket.com, changement du mot de passe admin, décision paiements v2) — aucune tâche
  de développement ouverte.
