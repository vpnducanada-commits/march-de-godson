# Guide — Domaine gratuit eu.org pour le GODSON Marketplace

> Objectif : obtenir un domaine **gratuit et permanent** (aucun renouvellement, aucun abonnement)
> et le brancher sur le site déjà en ligne sur Vercel.
> Temps de travail : **~15 minutes** pour toi. Temps d'attente : **quelques jours** (validation humaine).

---

## TL;DR

| | |
|---|---|
| Ce que tu obtiens | `godsonmarket.fr.eu.org` (ou `godsonmarket.eu.org`) |
| Coût | **0 F** pour toujours |
| SSL | Gratuit, automatique (Vercel / Let's Encrypt) |
| Renouvellement | Aucun — le domaine est permanent tant que le contact reste valide |
| Temps d'attente | Quelques jours → quelques semaines (validé par un bénévole) |
| Risque | Refus possible si jugé « trop commercial » (plan B : `.ga` à ~20 €/an, ou rester sur `.vercel.app`) |

---

## Les noms à demander (par ordre de priorité)

1. **`godsonmarket.fr.eu.org`** ← **recommandé** (l'eu.org conseille explicitement d'éviter l'enregistrement direct dans eu.org ; `fr.eu.org` = sous-domaine francophone, ouvert ✓)
2. **`godsonmarket.eu.org`** — URL plus courte, mais chemin « direct » plus strict (4 caractères min. ✓, contrôle plus serré)
3. **`marchegodson.fr.eu.org`** — variante en français
4. **`godsonmarket.int.eu.org`** — secours (`int.eu.org` = domaine international)

> Le site est 100 % en français et s'adresse à des utilisateurs francophones : `fr.eu.org` est parfaitement justifié.
> Les sites **non-européens sont explicitement bienvenus** par la politique eu.org (le Gabon n'est pas un problème).

---

## Étape 0 — Préparer le matériel (5 min)

- [ ] Un **vrai e-mail** qui marche (c'est là qu'arrive la validation — pense à vérifier le **spam**)
- [ ] Ton **nom complet** (pour le formulaire de contact)
- [ ] Un compte **Cloudflare** (gratuit) → https://dash.cloudflare.com/sign-up
  - Pourquoi ? eu.org exige que le domaine demandé ait **déjà des nameservers configurés**
    avant la demande. Cloudflare gratuit en fournit 2.

---

## Étape 1 — Cloudflare : créer la zone et récupérer les nameservers (5 min)

1. Connecte-toi à Cloudflare → **« Ajouter un site »** (*Add a site*)
2. Entre le nom complet : **`godsonmarket.fr.eu.org`** (le nom que tu vas demander)
3. Choisis le plan **Free** → continuer
4. Cloudflare te dira que le DNS n'est pas vérifié / que le domaine n'existe pas encore → **c'est NORMAL**
   (le domaine ne sera délégué qu'après l'approbation eu.org). Continue.
5. **Copie les 2 nameservers** qui s'affichent, par exemple :
   - `alice.ns.cloudflare.com`
   - `bob.ns.cloudflare.com`

⚠️ Garde la zone Cloudflare telle quelle — on y ajoutera 1 enregistrement après l'approbation.

---

## Étape 2 — Créer ton compte « contact » eu.org (5 min)

1. Va sur **https://nic.eu.org/arf/**
2. Clique sur **Sign up / register** (formulaire de contact)
3. Renseigne :
   - Type : **individual** (personne)
   - Ton nom, ton **vrai e-mail**, un mot de passe
   - **Privacy : « Private »** (tes infos ne seront pas publiques dans le WHOIS)
4. **Valide ton compte par e-mail** (bouton de confirmation — regarde le spam)
5. **Copie ton « handle »** : un identifiant de la forme `XXXX-FREE`
   - ⚠️ **Précieux : c'est ton identifiant de compte.** Si tu le perds, l'accès au domaine est perdu.
     Range-le dans un mot de passe manager ou un fichier sûr.

---

## Étape 3 — Demander le domaine (5 min)

1. Toujours sur https://nic.eu.org/ → connecte-toi
2. **« New Domain »**
3. Remplis :
   - **Domain name :** `godsonmarket.fr.eu.org` (nom complet, avec le suffixe)
   - **Administrative contact :** ton handle
   - **Technical contact :** ton handle
   - **Nameservers :** les 2 Cloudflare de l'étape 1
     - `ns1 = alice.ns.cloudflare.com`
     - `ns2 = bob.ns.cloudflare.com`
4. **Submit**
   - Si le nom est déjà pris → le formulaire te le dit immédiatement → passe au nom suivant de la liste

> ⚠️ Le formulaire n'a pas de « pré-vérification de disponibilité » en ligne : la disponibilité
> est confirmée par la validation humaine. C'est normal.

---

## Étape 4 — L'attente (plusieurs jours)

- La validation est **humaine, bénévole** : officiellement « quelques jours », en pratique
  de quelques jours à quelques semaines.
- **Vérifie boîte de réception + spam** régulièrement.
- Pas de nouvelle après **3–4 semaines** : réponds à l'e-mail de confirmation que tu as reçu
  (il vient du serveur eu.org), ou passe par la liste d'utilisateurs :
  `subscribe freedns-users` envoyé à `majordomo@lists.eu.org`
- **Ne recommence PAS la demande** pendant l'attente (ça ne fait pas accélérer).

---

## Étape 5 — Une fois l'approbation reçue : je m'occupe du reste

Écris-moi simplement **« eu.org approuvé : godsonmarket.fr.eu.org »**. Je fais ensuite :

1. ✅ Ajout du domaine au projet Vercel `godson-marketplace` (de mon côté, token à jour)
2. ✅ Dans ta zone Cloudflare (déjà ouverte), j'indiquerai exactement 2 enregistrements à ajouter :
   - `A` — host `@` — valeur `76.76.21.21` (Vercel)
   - `CNAME` — host `www` — valeur `godsonmarket.fr.eu.org` (optionnel, pour www)
3. ✅ Vercel émet le **certificat SSL gratuit** automatiquement (10–30 min)
4. ✅ Je vérifie le site en production (HTTP/2, SSL, routes SPA)
5. ✅ Petite mise à jour de config : `VITE_SITE_URL`, `site_url` Supabase (URL de confirmation
   des e-mails d'inscription), URLs canoniques SEO — puis redéploiement
6. ✅ (Optionnel) bascule complète : le domaine remplace `godsonmarket.com` chez name.com
   si tu décides qu'on abandonne l'ancien site

**Coût total de la phase 5 : 0 F.**

---

## Règles eu.org à connaître (résumé de la politique officielle)

| Règle | Détail |
|---|---|
| **Usage commercial** | « Les petits sites commerciaux sont acceptés, mais il est **très fortement demandé** de n'y recourir qu'en dernier recours » — un marché local gratuit sans paiement entre dans la case « petit ». Si refus : plan B `.ga` ou `.vercel.app` |
| **Non-européen** | Explicitement accepté ✓ |
| **Interdit** | Spam, phishing, malware, usurpation de noms |
| **Nommage** | ≥ 4 caractères pour l'enregistrement automatique ; 2–3 caractères réservés |
| **Données** | Le contact doit rester réel et joignable (e-mail valide) — c'est ce qui fait vivre le domaine |
| **Support** | Aucun support ; liste `freedns-users` |
| **Stabilité** | Service bénévole en place depuis 1996 — très stable historiquement, mais **aucun SLA** (pas de garantie contractuelle). Pour un v1 : acceptable ; pour un futur service à fort trafic : le `.ga` reste le plan solide |

---

## Ce qu'il ne faut PAS faire

- ❌ Acheter un domaine payant avant d'avoir essuyé le refus (attendre la réponse)
- ❌ Utiliser un e-mail de jetable (le contact doit rester valide)
- ❌ Supprimer la zone Cloudflare « inactive » entre-temps (elle attend l'approbation)
- ❌ Créer plusieurs demandes en parallèle sur le même nom

---

## Questions fréquentes

**« C'est vraiment un "vrai" domaine ? »**
C'est techniquement un sous-domaine d'`eu.org` (comme `.vercel.app`), mais avec **délégation DNS
complète** (tes propres nameservers) : tu contrôles tout, SSL inclus, et l'URL ressemble à un
domaine. C'est la même famille que `tonsite.github.io`.

**« Et si l'approbation arrive alors que j'ai déjà lancé la campagne marketing ? »**
L'attente est le seul vrai bouchon. Si le calendrier presse, `godsonmarketplace.vercel.app`
demeure l'URL officielle en attendant (gratuite, déjà en ligne).

**« Puis-je utiliser le même compte eu.org pour d'autres domaines ? »**
Oui, un contact peut détenir plusieurs domaines.

**« Le site doit être en ligne avant la demande ? »**
Non, pas nécessaire — les nameservers (Cloudflare) suffisent.
