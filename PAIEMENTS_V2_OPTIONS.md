# Étude — Paiements en ligne v2 (Airtel Money / Moov Money)

> **DÉCISION (19 octobre 2026, validée par l'exploitant) : le paiement est confirmé sur
> Airtel Money — Option A (Airtel Money en direct, API officielle developers.airtel.africa).**
>
> Conséquences et suite :
> 1. **Côté exploitant (Phase 0, maintenant)** : préparer le dossier KYB (RCCM, NIF, RIB,
>    statuts, description de l'activité) et ouvrir le compte marchand Airtel Money (délai
>    constaté : 3–6 semaines). C'est l'action qui conditionne tout le reste.
> 2. **Côté développement (dès réception des identifiants API)** : table `payments` +
>    edge functions `payment-initiate` / `payment-webhook` (HMAC, idempotence, jamais de
>    secret côté navigateur) + bouton « Payer par Airtel Money » sur la fiche annonce —
>    bouton **masqué tant que les identifiants ne sont pas branchés** (pas de bouton
>    décoratif, principe d'honnêteté produit).
> 3. **Immédiatement en ligne (v1.6)** : le site reste en négociation directe et affiche le
>    **NB d'avertissement acheteur** — « ne payez que si vous avez confiance au vendeur ;
>    en cas de doute, ou si vous ne connaissez pas son identité, payez à la livraison » —
>    sur la fiche annonce, la FAQ et la page Conseils de sécurité.

> **Statut : ÉTUDE + DÉCISION PRISE (aucun code de paiement écrit, aucun prix officiel inventé).**
> Date : 19 octobre 2026. Devise : FCFA (XAF, zone CEMAC — BEAC/COBAC).
> Toute intégration réelle commencera uniquement après signature d'un compte marchand
> et obtention de vrais identifiants API.

## 1. Contexte et objectif

GODSON Marketplace est une marketplace C2C : l'acheteur et le vendeur négocient, puis
la transaction se conclue en dehors du site (règlement à la remise). L'objectif v2 est
de permettre aux **vendeurs** d'encaisser en ligne (dépot ou paiement à la livraison
vérifié), sans que GODSON devienne un établissement de paiement : GODSON resterait
un simple technicien de paiement, les fonds passant directement du portefeuille
mobile de l'acheteur au compte marchand du vendeur (ou au compte marchand GODSON
en mode « marketplaces » si l'opérateur l'exige pour les plateformes).

Principes de budget maintenus :
- **Aucun abonnement** : les seules récurrentes seraient des commissions par
  transaction répercutées ou absorbées.
- **Aucun frais d'intégration caché** : les montants cités ci-dessous sont des
  **ordres de grandeur issus de sources publiques** (liens en fin de document), à
  faire confirmer par l'opérateur lors du KYB.

## 2. Ce que dit le marché gabonais (constats)

1. **Le client paie un marchand sans frais** : la commission est prélevée sur le
   marchand, jamais sur l'acheteur (sources [2], [5], [7], [16]).
2. **Seul un compte marchand donne accès aux API d'encaissement** (web payment,
   webhooks, remboursements) ; un compte particulier est plafonné et non conçu
   pour l'e-commerce (source [2]). L'ouverture d'un compte marchand est **gratuite**,
   le coût réel est la commission sur encaissement (source [2]).
3. **Plafonds** : grille CEMAC (soldes 200 000 / 1 000 000 / 5 000 000 FCFA
   selon le niveau de KYC) ; un compte marchand négocié peut monter bien plus
   haut (jusqu'à ~100 000 000 FCFA/mois selon les volumes, source [2]) ; les
   paiements en ligne sont plafonnés par transaction (≈ 1 000 000 FCFA, sources
   [3] et [1] — à confirmer au contrat).
4. **Interopérabilité GIMACPAY** : les wallets gabonais sont interopérables
   (Airtel ↔ Moov ↔ banques), donc accepter Airtel seul n'exclut pas les détenteurs
   de Moov pour un paiement interopérable, mais l'expérience « payer avec son
   wallet propre » reste plus fluide si l'opérateur du client est directement
   supporté (source [14]).
5. **KYB obligatoire** : RCCM, NIF, justificatif, compte bancaire de règlement
   (sources [9], [23]) — la société devra exister (ou le dirigeant se rapprocher
   des opérateurs en personne morale/entreprise individuelle).

## 3. Option A — Airtel Money en direct (API officielle)

- **Portail développeur officiel** : developers.airtel.africa (applications,
  client_id/client_secret, API Collection + Disbursement, **sandbox UAT** :
  openapiuat.airtel.africa, production : openapi.airtel.africa) (sources [6], [17]).
- **Mécanique** : OAuth2 client credentials → requête de collection (numéro du
  client, montant, référence unique) → **push USSD** sur le téléphone du client →
  validation **PIN** → **webhook** de confirmation (+ polling de statut possible)
  (sources [6], [16], [17]).
- **Frais constatés (ordres de grandeur 2026, à confirmer au contrat)** :
  commission **marchand 1,2 % à 1,8 %** selon le secteur (source [2]) ; une autre
  source indique 1,5–2 % (source [1]). L'Airtel Developer Portal ne prélèverait
  **aucun frais supplémentaire** au-delà de la commission (source [11]).
  Le client acheteur : **0 FCFA**.
- **Onboarding** : ouverture du compte marchand gratuite, **3 à 6 semaines**
  observées (source [2]) ; KYC entreprise requis (source [1]).
- **Settlement** : versement sur le compte bancaire de la société selon la
  périodicité du contrat, chaque encaissement tracé (référence + webhook)
  (source [2]).
- **Verdict** : l'API la plus documentée et la plus « propre » pour le marché
  gabonais ; c'est le candidat n°1 si l'on veut une intégration directe.
  Contre : délai d'onboarding, et couverture Airtel seulement
  (~0,58 M de comptes actifs fin 2025, soit ~24 % du mobile money gabonais,
  source [2]).

## 4. Option B — Moov Money (Gabon Télécom)

- **Pas de portail marchand self-service public** : Moov Africa Gabon n'expose pas
  d'API marchand simple à l'auto-inscription ; les intégrations se font via
  **contrat de marchand partenaire** (« intégration basique » ou « intégration
  complète ») ou via un agrégateur qui détient le contrat opérateur
  (sources [2], [19], [23]).
- **Produit « Moov Money Online »** : paiement en ligne pour marchands — compte
  marchand créé **en moins de 48 h**, paiement par push + PIN, **plafond
  1 000 000 FCFA/jour par client** (source [3]). C'est la porte d'entrée la plus
  simple chez Moov.
- **Mécanique client** : choix « Moov Money » au checkout → saisie du numéro →
  notification push → validation PIN (source [7]).
- **Frais** : **aucune grille publique marchande** trouvée ; les comparatifs régionaux
  donnent 1,5–2,2 % pour une API directe Moov (Bénin/Togo, source [17]) — à
  négocier localement. Le client acheteur : 0 FCFA (source [7]).
- **Verdict** : indispensable pour couvrir ~76 % du mobile money gabonais
  (Moov ~1,45 M de comptes fin 2025, source [2]), mais sans self-service :
  prévoir un commercial + un délai de contrat (comptez 2 à 6 semaines, à chiffrer).

## 5. Option C — Agrégateur local (mise en ligne la plus rapide)

Un agrégateur détient déjà les contrats opérateurs et propose **une seule API**
(checkout, webhooks normalisés, réconciliation) :

| Agrégateur (Gabon) | Frais publiés | Couverture |
| --- | --- | --- |
| **PVit** (mypvit.pro) | Airtel Money : **PAY-IN 2–2,5 %** (min. 150 FCFA, max. 500 000 FCFA) ; PAY-OUT 0,5–1 % (source [12]) | Airtel (+ autres opérateurs selon contrat) |
| **SingPay** | **0 % jusqu'à 25 M FCFA** de volume, puis 2,5 % (retour d'expérience, source [11]) | multi-opérateurs |
| **Genius API** (pay.genius.ci) | non publié ici ; au Gabon, seul l'opérateur `AIRTEL_GAB` est listé (source [16]) | Airtel au Gabon |

- **Verdict** : le plus court chemin (jours, pas semaines) pour mettre un vrai
  bouton « Payer avec Airtel Money » en production ; la commission est un peu plus
  haute que le direct (~2 % vs ~1,2–1,8 %), mais sans onboarding opérateur.
  Bon candidat pour **v1.5 (MVP paiement)** ; migration direct Airtel (+Moov) en v2
  une fois les volumes justifiés.

## 6. Comparatif synthétique

| Critère | A. Airtel direct | B. Moov direct | C. Agrégateur |
| --- | --- | --- | --- |
| Délai avant production | 3–6 semaines (onboarding) | contrat partenaire (2–6 sem. est.) | **3–7 jours** |
| Commission estimée (marchand) | 1,2–1,8 % [2] (1,5–2 % [1]) | non publiée (est. 1,5–2,2 % [17]) | 2–2,5 % [12] / 0 % ≤ 25 M [11] |
| Coûts fixes | 0 (compte marchand gratuit) | 0 (compte marchand gratuit) | 0 (selon contrat) |
| Sandbox | oui (openapiuat.airtel.africa) | via contrat | oui (fournie par l'agrégateur) |
| Couverture wallets | Airtel (~24 % du MM gabon) | Moov (~76 % du MM gabon) | selon contrat (souvent multi) |
| Webhooks | oui | oui | oui (normalisés) |
| API self-service | **oui** (portal officiel) | **non** | **oui** |

## 7. Feuille de route proposée (décision à valider)

1. **Phase 0 (désormais, 1–2 jours de dossier)** : préparer le KYB — RCCM, NIF,
   RIB, statuts, description de l'activité — et contacter :
   - Airtel Money Gabon (commercial marchands / developers.airtel.africa) ;
   - Moov Money Gabon (moovmoney.ga, offre « Moov Money Online ») ;
   - 1–2 agrégateurs (PVit, SingPay) pour un devis formel.
2. **Phase 1 — MVP (v1.5, cible : agrégateur)** : bouton « Payer avec Mobile Money »
   sur la fiche annonce + dans la messagerie (option de paiement proposée par le
   vendeur), table `payments` (status `pending/confirmed/expired/refunded`),
   **edge function** `payment-initiate` (crée la transaction côté agrégateur) et
   `payment-webhook` (valide la signature, met à jour le statut, notifie par
   e-mail + notification). AUCUN paiement simulé : sans identifiants agrégateur,
   le bouton reste masqué (flag serveur, pas un flag navigateur).
3. **Phase 2 — v2 (Airtel direct + Moov)** : bascule sur les API directes une fois
   les comptes marchands obtenus ; ajout du remboursement (disbursement) géré par
   le marchand ; dashboard « Encaissements » pour les vendeurs.

## 8. Impact technique sur GODSON (préparations à zéro coût)

- **Base** : table `payments` (id, listing_id, buyer_id, seller_id, amount_xaf,
  provider, provider_ref, status, created_at, confirmed_at) + RLS strict
  (lecteur : acheteur/vendeur/admin ; écriture : **uniquement** l'edge function
  service-role, jamais le navigateur).
- **Sécurité** : les secrets agrégateur/opérateur ne vivent que dans les secrets
  Vercel/Supabase Edge ; validation **HMAC du webhook** ; idempotence par
  `provider_ref` ; jamais de `service_role` côté client (règle maison).
- **PWA/budget** : aucune ligne de coût fixe ; les commissions sont du
  transactionnel (répercutable au vendeur ou absorbées par GODSON — décision
  commerciale ultérieure, à documenter dans les CGU si répercutée).
- **Honnêteté produit** : tant que le fournisseur n'est pas branché, pas de
  bouton de paiement affiché (pas de bouton décoratif) ; l'état « Paiement
  en ligne à venir » est signalé dans l'À propos.

## 9. Ce qui n'est PAS fait (volontairement)

- Aucun code d'intégration payante écrit (pas de checkout inventé).
- Aucun taux officiel « garanti » : les pourcentages cités sont des ordres de
  grandeur de sources tierces, datées, à revalider au contrat.
- Aucune promesse de délai d'onboarding : fourchettes observées par des tiers.

## 10. Sources (consultées le 19/10/2026)

1. Kolonell — « Intégrer Airtel Money site web Gabon — Guide 2026 » — https://kolonell.com/fr/blog/integrer-airtel-money-site-web-gabon-libreville-2026
2. Simiz — « Plafonds Mobile Money Gabon : limites KYC 2026 » — https://simiz.io/blog/plafonds-kyc-mobile-money-gabon-2026
3. Moov Money (officiel) — « Moov Money Online » — https://moovmoney.ga/marchand/moov-money-online-marchand/
4. Moov Money (officiel) — « Marchands standards et partenaires » — https://moovmoney.ga/marchand/standards-et-partenaires/
5. Digablo POS — « Logiciel de caisse gratuit au Gabon 2026 » — https://digablopos.fr/fr/blog/free-pos-software-gabon
6. Airtel Money API (référence technique) — https://developers.airtel.africa/ (sandbox : openapiuat.airtel.africa)
7. Moov Money (officiel) — « Moov Money Online — client » — https://moovmoney.ga/moov-money-online-client/
8. Airtel Money Gabon — Conditions générales (frais de transaction) — https://cdn-webportal.airtelstream.net/website/airtel-money/gabon/assets/pdf/CONDITIONS-GENERALES-AM-FINAL-2025-Gabon.pdf
9. Simiz — « API Paiement Mobile Congo-Brazzaville : Guide 2026 » (contexte CEMAC) — https://simiz.io/blog/api-paiement-mobile-congo-orchestrateur
10. Moundziegou Nguembi — « Les Agrégateurs de Paiement Mobile au Gabon : retour d'expérience » — https://gabinsteeven.site/les-agregateurs-de-paiement-mobile-au-gabon-mon-retour-dexperience/
11. PVit (officiel) — tarifs PAY-IN/PAY-OUT — https://mypvit.pro/
12. Genius API — documentation (opérateurs disponibles par pays) — https://pay.genius.ci/doc
13. Atekbot — « Mobile Money Gabon 2026 : Comparatif Airtel vs Moov » — https://www.atekbot.space/blog/gabon-mobile-money-gabon-guide-2026
14. Atekbot — « Transfert Airtel Money ↔ Moov Money (GIMACPAY) » — https://www.atekbot.space/blog/transfert-argent-airtel-money-moov-money-mobicash-gabon
15. Boldrails — « Moov Money API Integration » (absence d'API self-service) — https://boldrails.com/payments/moov-money-api
16. Kolonell — « Intégrer Moov Money Bénin & Togo » (fourchettes API directe) — https://kolonell.com/fr/blog/integrer-moov-money-benin-togo-site-web-2026
