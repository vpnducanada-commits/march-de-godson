# Dossier KYB — Compte marchand Airtel Money (Gabon)

> **Objectif :** ouvrir le compte marchand Airtel Money qui débloque l'encaissement
> en ligne « Payer par Airtel Money » sur GODSON Marketplace (décision du 19/10/2026,
> voir `PAIEMENTS_V2_OPTIONS.md`).
> **Coût : compte marchand gratuit** — la seule récurrente sera la commission par
> encaissement (ordres de grandeur constatés : 1,2–1,8 % selon secteur, à confirmer
> au contrat). L'acheteur paie **0 FCFA** de frais.
> **Délai constaté : 3 à 6 semaines** (onboarding). Le document ci-dessous est à
> compléter puis à soumettre au commercial marchands Airtel Money Gabon.

---

## 1. Checklist des pièces (à réunir)

| # | Pièce | Détail | Statut |
|---|---|---|---|
| 1 | **RCCM** | Registre de commerce et de crédit mobilier — certificat **valide** (ou dépôt en cours : l'accepter ou non dépend du commercial) | ☐ |
| 2 | **NIF** | Numéro d'identification fiscale | ☐ |
| 3 | **RIB** | Compte bancaire de **règlement** (les encaissements Airtel sont versés sur ce compte) | ☐ |
| 4 | **Statuts / acte de constitution** | Si société (SARL, SA…) ; si personne physique / entreprise individuelle : pièce d'identité + certificat de résidence | ☐ |
| 5 | **Pièce d'identité du représentant légal** | CNI ou passeport, en cours de validité | ☐ |
| 6 | **Justificatif de domicile / siège** | Facture récente (électricité, eau) ou contrat de bail du siège | ☐ |
| 7 | **Site web** | URL : https://godson-marketplace.vercel.app (le compte marchand Airtel attend une présence web cohérente avec la raison sociale) | ✅ |
| 8 | **Description de l'activité** | Modèle fourni ci-dessous (§ 3) | ✅ (à personnaliser) |

> ⚠️ Les exigences exactes varient selon le commercial Airtel : demandez dès le
> premier contact la **liste officielle du dossier KYB** et ajustez ce qui manque.
> Un numéro de téléphone **au nom de la société** facilite l'onboarding (le wallet
> marchand y sera rattaché).

## 2. Canaux de demande

| Canal | Usage |
|---|---|
| **Portail développeur officiel** : developers.airtel.africa | Créer l'application, obtenir `client_id` / `client_secret` (OAuth2 client credentials), accéder à la **sandbox UAT** (openapiuat.airtel.africa) puis à la production (openapi.airtel.africa) |
| **Commercial marchands Airtel Money Gabon** | Soumission du dossier KYB, contrat, grille de commission, settlement bancaire |

**Démarche conseillée** : 1) ouvrir un compte sur developers.airtel.africa (immédiat,
gratuit) → 2) demander le dossier marchand complet au commercial (c'est la phase à
3–6 semaines) → 3) en parallèle, préparer la liste des annonces/volumes attendus
(pour la négociation du plafond marchand).

## 3. Modèle de description d'activité (à coller dans le formulaire)

> **GODSON Marketplace** est une plateforme en ligne de petites annonces et de
> mise en relation (marketplace) opérée au Gabon, accessible à
> https://godson-marketplace.vercel.app. Elle permet aux particuliers et
> commerçants de publier gratuitement des annonces de produits et services
> (téléphones et électronique, véhicules, immobilier, mode, services
> professionnels, etc.) et aux acheteurs de les contacter directement.
>
> Les transactions sont conclues et réglées **entre l'acheteur et le vendeur** ;
> le moyen de paiement usuel est **Airtel Money**. GODSON Marketplace ne détient
> pas de fonds et n'agit pas en qualité d'établissement de paiement.
>
> Nous sollicitons un **compte marchand Airtel Money** afin d'activer
> l'encaissement en ligne sur la fiche annonce via l'API officielle
> (produit **Collection** du portail developers.airtel.africa) : l'acheteur
> déclenche le paiement depuis le site, valide par PIN sur son téléphone, et la
> confirmation est retournée au site par webhook. Volume initial attendu :
> quelques centaines de transactions/mois, montant moyen estimé 100 000–500 000
> FCFA. *(à ajuster avec vos chiffres réels)*

## 4. Ce qu'il faudra transmettre (une fois le compte obtenu)

Envoyer **seulement** ces éléments (valeur des clés jamais écrite dans le repo) :

| Élément | Où il sera stocké (jamais dans le navigateur) |
|---|---|
| `client_id` / `client_secret` (production + UAT) | Secrets des Edge Functions Supabase (service `notify-email`-style) ou variables d'environnement Vercel |
| URL de callback webhook attendue | Je la fournirai (Edge Function `payment-webhook`) |
| Commission confirmée au contrat | Documentée dans `PAIEMENTS_V2_OPTIONS.md` + mention dans les CGU si répercutée |
| Plafond par transaction / par mois | Documenté (plafond constaté ≈ 1 000 000 FCFA/transaction, à confirmer) |

**Puis, côté développement (moi) :**
1. Migration `payments` (id, listing_id, buyer_id, seller_id, amount_xaf,
   provider, provider_ref, status `pending/confirmed/expired/refunded`, horodatages)
   + RLS strict (écriture uniquement par l'Edge Function service-role).
2. Edge Functions `payment-initiate` (requête de collection, référence unique,
   idempotence par `provider_ref`) et `payment-webhook` (validation HMAC, mise à
   jour du statut, e-mail + notification aux deux parties).
3. Bouton **« Payer par Airtel Money »** sur la fiche annonce + dans la messagerie,
   **masqué par un flag serveur tant que la production n'est pas branchée**
   (pas de bouton décoratif, pas de paiement simulé).
4. Tests : sandbox UAT en priorité (aucun argent réel pendant l'intégration).

## 5. Points de vigilance (rappel de l'étude)

- **Ne signer aucun montant « garanti »** : les pourcentages cités (1,2–1,8 %) sont
  des ordres de grandeur de sources publiques datées — seul le contrat fait foi.
- **Settlement** : vérifier la périodicité (quotidienne ? hebdomadaire ?) et le
  compte bancaire de versement — c'est ce qui règle votre trésorerie.
- **Interopérabilité GIMACPAY** : un acheteur Moov peut payer depuis Airtel via
  l'interopérabilité, mais l'expérience « wallet propre » reste plus fluide ;
  Moov restera le candidat v2.5 (contrat partenaire, pas d'API self-service).
- **Honnêteté produit** : tant que la production n'est pas branchée, le site
  n'affiche aucun bouton de paiement — le NB d'avertissement acheteur (fiche,
  FAQ, /securite) reste en place.
