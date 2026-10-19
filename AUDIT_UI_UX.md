# Audit UI / UX / Performance — GODSON Marketplace

**Date :** 19 octobre 2026 · **Version audité :** v1.4 (prod) · **Version après corrections :** v1.5
**Méthode :** inspection systématique sur l'environnement **production** (https://godson-marketplace.vercel.app) avec Playwright sur 3 cibles — mobile 390×844, tablette 768×1024, desktop 1280×900 — : ~35 captures d'écran (pages publiques, pages compte, 5 onglets admin, profil vendeur), mesures de performance (Navigation Timing), mesures de géométrie DOM (positions réelles des éléments), et vérification des données (base de production).
Les corrections ont été re-vérifiées sur build local (captures « après ») avant déploiement.

---

## 1. Synthèse

L'application est **techniquement saine** : performances excellentes, navigation fluide, aucun
erreur JavaScript sur les 12 routes testées, onglets fonctionnels. Les défauts relevés sont
**visuels et compositionnels** — 11 corrections ont été identifiées puis **implémentées en v1.5**
(6 bugs, 5 améliorations de composition), dont 2 bugs structurels importants :

1. **Le tiroir de menu mobile ne couvrait pas l'écran** (rendu en hauteur de header seulement).
2. **Le hero de l'accueil n'affichait pas sa barre de recherche** avant le chargement des localités
   (spinner + saut de mise en page), en particulier visible sur tablette.

Aucune donnée n'a été modifiée. Les images de démonstration ont été régénérées (fichiers
`public/demo/*.svg`) : le statut « Démo » est désormais porté **uniquement** par le badge
de l'application, plus par le contenu de l'image.

---

## 2. Performances (mesurées sur prod, mobile 390×844)

| Métrique | 1er chargement | Navigation SPA |
|---|---|---|
| `load` | **262 ms** | 20–50 ms |
| First Contentful Paint | **316 ms** | 52–108 ms |
| Poids transféré | **642 KB** | — |
| Requêtes | 11 | — |

Tablette et desktop : 131–145 ms / FCP 196–236 ms. **Verdict : excellent.** Le point d'amélioration
n'était pas le temps de chargement brut, mais **l'ordre d'affichage** : le spinner « Préparation de
la recherche… » occupait le hero pendant ~1 s au 1er chargement (voir §3.2).

---

## 3. Constats et corrections

### P0 — bugs (l'interface paraissait cassée)

**3.1 Images de démo : double badge et titre dupliqué** — *corrigé*
- **Constat :** chaque image de démo contenait un ruban doré « ANNONCE DE DÉMONSTRATION »
  (codé dans le SVG) recouvert par le badge « Démo » de l'application, et le titre du produit en
  grand (dupliqué par le titre de la carte/fiche). Résultat : badges superposés coupés, titre
  redondant, filigrane GM en conflit avec le badge horaire des cartes.
- **Cause :** trois canaux d'information du même statut (ruban image, badge app, titre image).
- **Correction :** les 9 SVG régénérés ne conservent que le fond dégradé, l'icône produit et la
  légende discrète « Image d'exemple — <catégorie> ». Le badge « Démo » de l'application est
  devenu la **seule** source du statut démo (exigence « données démo clairement étiquetées »
  préservée, sans doublon).

**3.2 Hero sans recherche + layout shift (mobile ET tablette)** — *corrigé*
- **Constat :** le hero n'affichait sa barre de recherche qu'après le chargement des localités ;
  en attendant, un spinner avec un padding de 120 px gonflait le hero. Sur tablette, l'écran
  d'accueil montrait donc une grande zone sombre vide au 1er chargement.
- **Correction :** la barre de recherche est affichée **immédiatement** ; la liste des localités
  se remplit dans le select (état initial : « Tout le Gabon » — la recherche par mot-clé
  fonctionne dès le 1er rendu). Pas de spinner, pas de saut de mise en page.
- **Incident collatéral corrigé :** dans le tiroir mobile, la recherche ET la liste des catégories
  étaient conditionnées au chargement des localités (elles n'apparaissaient pas au 1er
  ouverture du menu) — déconditionné.

**3.3 Tiroir de menu mobile tronqué à la hauteur du header** — *corrigé*
- **Constat :** à l'ouverture du menu burger, le panneau ne couvrait que la bande du header ;
  le contenu de la page restait visible derrière (le tiroir n'avait pas ~540 px de hauteur).
- **Cause :** le `backdrop-filter: blur()` du header crée un *containing block* pour les
  éléments `position: fixed` ; le tiroir (child du header) était donc positionné relativement
  au header, pas à la fenêtre.
- **Correction :** le tiroir et son overlay sont rendus **en dehors** de `<header>`
  (fragment JSX). Le tiroir couvre désormais toute la hauteur de l'écran.

**3.4 Header mobile déconnecté : débordement 2 lignes** — *corrigé*
- **Constat :** déconnecté sur mobile, le header affichait « Connexion » (texte) empilé au-dessus
  du bouton « S'inscrire », qui débordait de la barre.
- **Correction :** le lien « Connexion » du header est masqué sous 768 px — il reste
  immédiatement accessible dans le tiroir (bouton plein « Connexion »), et « S'inscrire »
  reste le CTA visible. Une seule ligne, sans débordement.

**3.5 Point doré orphelin après le prix (« 650 000 FCFA · »)** — *corrigé*
- **Constat :** sur les cartes, le « · négociable » passait sur la ligne suivante, laissant un
  point doré isolé après « FCFA ».
- **Correction :** `white-space: nowrap` sur l'unité « · négociable » — elle reste collée au prix
  ou passe entière sur la ligne suivante.

**3.6 Notice « vendeur non vérifié » mal découpée** — *corrigé*
- **Constat :** sur le profil vendeur (mobile), la phrase se lisait en morceaux :
  « …consultez nos / conseils / . / de sécurité ».
- **Cause :** le paragraphe est un conteneur `display: flex` ; chaque nœud de texte brut et le
  lien deviennent des *items de flex* distincts (et le lien est blockifié), la phrase est
  fragmentée visuellement.
- **Correction :** la phrase est regroupée dans un `<span>` unique (l'icône reste l'item flex),
  le lien revient au flux inline normal.

### P1 — composition et lisibilité

**3.7 Header desktop : recherche tronquée (« Tout le Ga▾ »)** — *corrigé*
- **Constat :** à 1280 px, le select de localité était tronqué en « Tout le Ga▾ » — visuellement
  cassé.
- **Correction :** la zone de recherche passe de `max-width: 460 px` à `flex: 1` / `max-width:
  640 px` : le select « Tout le Gabon » est entier de 1024 px à 1280 px+ ; le placeholder du
  champ (élément secondaire) est le seul à pouvoir s'élider.

**3.8 Bandeau CTA « Vous avez quelque chose à vendre ? » déséquilibré** — *corrigé*
- **Constat :** en desktop, la moitié droite du bandeau était vide (bouton sous le texte).
- **Correction :** à partir de 900 px, grille 2 colonnes — texte à gauche, action (bouton doré +
  « Comment ça marche ? ») à droite, centrée verticalement. Mobile inchangé (boutons pleine
  largeur).

**3.9 Tableaux admin sur mobile : colonnes disparates** — *corrigé*
- **Constat :** le tableau (min-width 640 px, scroll horizontal) montrait la colonne « STATUT »
  coupée net au bord, sans indication de contenu à droite.
- **Correction :** à partir de 767 px, la **première colonne est épinglée** (sticky) avec une
  ombre discrète qui signale le défilement ; le nom de l'annonce/utilisateur reste toujours lisible.

**3.10 Fil d'Ariane : flash « Smartphones > Smartphones »** — *corrigé*
- **Constat :** au chargement de la fiche, le fil d'Ariane affichait transitoirement la
  sous-catégorie en double, avant que la catégorie parente ne se charge.
- **Correction :** le maillon « catégorie » n'est rendu (visuel **et** JSON-LD) que lorsque la
  hiérarchie est connue.

**3.11 Footer : promesse de fonctionnalité en attente visible publiquement** — *corrigé*
- **Constat :** « Le formulaire de contact général sera disponible à la prochaine étape » —
  une promesse de retard visible par tous les visiteurs.
- **Correction :** texte remplacé par une formulation définitive sans promesse :
  « Un problème avec une annonce ? Signalez-le directement depuis sa page (bouton « Signaler »).
  Notre équipe de modération examine chaque signalement. »

### P2 — polish

**3.12 Bouton « Filtres · » : point inexpliqué** — *corrigé*
- **Constat :** un point isolé suivait « Filtres » quand un filtre était actif, sans signification
  claire.
- **Correction :** le point devient un **compteur** — « Filtres (1) », « Filtres (2) »…

**3.13 Recherche mobile : champ trop étroit** — *corrigé*
- **Constat :** sous 480 px, champ et bouton partageaient la même ligne ; le champ ne faisait
  ~195 px (placeholder tronqué à « Rechercher un pr… »). La règle `width: 100%` du bouton était
  neutralisée par `flex: 1` (`flex-basis: 0%`), d'où l'absence de mise en 2 lignes.
- **Correction :** pattern mobile standard — champ pleine largeur sur la 1re rangée, bouton
  pleine largeur sur la 2e (hero **et** tiroir).

---

## 4. Vérifié et conservé tel quel

| Élément | Verdict |
|---|---|
| Ouvrures d'onglets (Compte : 4, Admin : 5) | Fonctionnel, état actif correct (`tab--active`), temps de clic→rendu ≈ 700 ms (borné par les requêtes API, non le rendu) |
| Géométrie des badges des cartes | Mesurée au DOM : correctement insérés (8 px des bords) — le « badge coupé » perçu était le ruban de l'image (voir 3.1) |
| Centrage vertical de la page de connexion | Correct (calcul min-height + align-items center) |
| États vides (messages, favoris, catalogue, profils) | Soignés et cohérents (icône, titre, message, action) |
| Gestion d'erreur catalogue (catégorie inconnue) | Correcte et honnête (« Recherche impossible — Catégorie inconnue ») |
| Accessibilité | Rôles ARIA présents (menu, recherche, fil d'Ariane, `aria-live` sur les compteurs) |
| PWA / service worker | Fonctionnel (manifest, icônes, SW v0.20) |

---

## 5. Avant / après (captures)

| Écran | Avant (v1.4) | Après (v1.5) |
|---|---|---|
| Accueil mobile | `docs/audit-ui-ux/before-accueil-mobile.png` | `docs/audit-ui-ux/after-accueil-mobile.png` |
| Fiche annonce mobile | `docs/audit-ui-ux/before-fiche-mobile.png` | `docs/audit-ui-ux/after-fiche-mobile.png` |
| Profil vendeur mobile | `docs/audit-ui-ux/before-vendeur-mobile.png` | `docs/audit-ui-ux/after-vendeur-mobile.png` |
| Accueil desktop (page complète) | `docs/audit-ui-ux/before-accueil-desktop.png` | `docs/audit-ui-ux/after-accueil-desktop.png` |
| Fiche annonce desktop | `docs/audit-ui-ux/before-fiche-desktop.png` | `docs/audit-ui-ux/after-fiche-desktop.png` |

---

## 6. Déploiement et validation production

- **Commit :** `018fdee` (main, repo `vpnducanada-commits/march-de-godson`) · **Version : v1.5**
- **Déployé sur https://godson-marketplace.vercel.app** le 19/10/2026 (Vercel, build ~20 s).
- **Re-vérification prod après déploiement :**
  - Version v1.5 confirmée en pied de page ;
  - 12 routes principales : **0 erreur JavaScript** ;
  - test-final : **6/6** (auth, e-mail reset, PWA hors-ligne, perf < 8 s / < 3 Mo) ;
  - test-launch : **parcours complet OK** (signup → publication → catalogue → cleanup) ;
  - captures de confirmation dans `audit-shots/prod-final/` (workspace).

## 7. Recommandations (non implémentées, pour la suite)

1. **Skeletons** pour « Annonces récentes » et « Catégories » au lieu du spinner centré
   (perception de chargement encore meilleure ; le spinner actuel est honnête mais neutre).
2. **Formulaire de contact** (page /contact) : la section « Contact » du footer pointe vers le
   bouton « Signaler » ; un vrai formulaire + e-mail Brevo (§26) complèterait le parcours.
3. **Fiche annonce** : la galerie mono-image pourrait afficher un placeholder « aucune photo »
   plus explicite pour les annonces sans image.
4. **PWA sur appareil réel** (§26) : reste à tester l'installation sur un téléphone Gabon (data).

---

*Audit mené avec Playwright (Chromium) — captures et scripts conservés dans le workspace
(`audit-capture.mjs`, `audit-capture2.mjs`, `audit-after*.mjs`, `route-check.mjs`).
Toutes les corrections sont couvertes par le build TypeScript strict + vérification
12 routes sans erreur JavaScript.*
