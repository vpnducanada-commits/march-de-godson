# Guide — Domaine gratuit eu.org pour la marketplace (procédure 2026)

> **Objectif** : un domaine **gratuit et permanent** pour la marketplace, branché sur Vercel.
> **Nom demandé : `godsonmarketplace.fr.eu.org`** (déjà enregistré sur Vercel ✓ —
> plus besoin de toucher au DNS manuellement : les name servers sont prêts).
> Coût : **0 F** pour toujours · SSL : automatique · Renouvellement : aucun.
> Attente : **quelques jours** (validation humaine par un bénévole eu.org).

---

## ⚠️ À SAVOIR AVANT DE COMMENCER (2 points bloquants)

1. **GMAIL EST BLOQUÉ PAR EU.ORG** : la page de création de compte le dit explicitement —
   *gmail.com refuse les e-mails de validation d'EU.org comme spam*. **Il faut donc un
   e-mail non-Gmail** pour créer le compte (Outlook, Proton, Yahoo — gratuits, 2 min :
   outlook.com / proton.me). Le e-mail de validation arrivera dans CETTE boîte.
2. **Un domaine « fictif » (non enregistré) ne peut pas servir un site** : c'est le DNS
   du domaine qui doit exister et être contrôlé. eu.org est la seule option
   **gratuite ET réellement fonctionnelle** (Freenom — .tk/.ga gratuits — est mort le 31/07/2026).
   Plan B si refus : `.com` à ~12 $/an, ou rester sur le sous-domaine
   `godson-marketplace.vercel.app` (déjà gratuit et actif).

---

## Ce qui est déjà fait (côté technique)

- ✅ `godsonmarketplace.fr.eu.org` **ajouté au projet Vercel** (19/10/2026) :
  Vercel attend que le domaine pointe vers ses name servers, puis émettra le
  certificat HTTPS automatiquement.
- ✅ Name servers à déclarer dans la demande eu.org :
  **`ns1.vercel-dns.com`** et **`ns2.vercel-dns.com`**
- ✅ FR.eu.org ouvert à l'enregistrement (vérifié 19/10/2026) ; les sites
  non-européens sont explicitement bienvenus par la politique eu.org.

## Étape 1 — Un e-mail non-Gmail (si besoin)

Créer une adresse gratuite : **outlook.com** ou **proton.me** (2 min, sans carte).
Exemple : `godson.marketplace@outlook.com`.

## Étape 2 — Créer le compte eu.org (~5 min)

1. Ouvrir **https://nic.eu.org/arf/en/contact/create/**
2. Remplir :
   | Champ | Valeur |
   |---|---|
   | Name | Gédéon OKANA |
   | E-mail | **l'e-mail non-Gmail** de l'étape 1 |
   | Address | Libreville, Gabon (rue/avenue au choix, en 1 ligne suffit) |
   | Country | **Gabon** |
   | Phone | (optionnel) |
   | Private (not shown in the public Whois) | ☑ cocher |
   | Politique | ☑ acceptée |
   | Password / Confirm | choisir un mot de passe (le noter) |
   | Security | **Altcha** — petite preuve de calcul, se résout toute seule dans le navigateur |
3. Soumettre → **recevoir l'e-mail de validation** dans la boîte non-Gmail → cliquer
   sur le lien de confirmation.

## Étape 3 — Demander le domaine (~3 min)

1. Se connecter sur **https://nic.eu.org/arf/** (handle + mot de passe).
2. Demander le domaine **`godsonmarketplace.fr.eu.org`**.
3. Nameservers : **`ns1.vercel-dns.com`** / **`ns2.vercel-dns.com`** (déjà configurés chez Vercel).
4. Description du site (honnête et concise, exemple) :

   > « Petit site de petites annonces en ligne pour le Gabon (francophone) :
   > particuliers et commerçants publient des annonces de produits et services ;
   > la mise en relation acheteur/vendeur est directe, le site ne collecte
   > aucun paiement. Projet personnel, hébergé sur Vercel. »

   (Si la demande est jugée « trop commerciale » par le validateur — risque réel,
   minoritaire — replanifier : `marchegodson.fr.eu.org` ou le plan B `.com`.)

## Étape 4 — Attente + fin de branchement (moi)

- **Quelques jours** : validation humaine. Un e-mail confirme l'approbation (ou le refus,
  avec raison).
- Dès l'approbation, **prévenir le développeur** → il :
  1. vérifie le pointage DNS (`dig godsonmarketplace.fr.eu.org NS` → ns1/ns2.vercel-dns.com),
  2. laisse Vercel émettre le certificat TLS (quelques minutes),
  3. met à jour `VITE_SITE_URL = https://godsonmarketplace.fr.eu.org`
     (sitemap, QR code de la page /application, SEO, e-mails) → rebuild + redéploiement,
  4. vérifie de bout en bout et confirme le nouveau lien final.
- `godson-marketplace.vercel.app` et `godsonmarket.com` (Green Mask Stick) restent
  actifs, rien n'est cassé.

---

## Si on renonce à eu.org (plans B)

| Option | Coût | Délai |
|---|---|---|
| `godsonmarketplace.com` (Namecheap) | ~12 $/an | immédiat (guide : `GUIDE_DOMAINE.md`) |
| `godsonmarketplace.vercel.app` (actuel) | 0 $ | déjà en ligne |
| `godsonmarket.ga` (ANINF, présence Gabon requise) | ~25 $/an | quelques jours/semaines |
