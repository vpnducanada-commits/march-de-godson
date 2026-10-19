# Guide — Domaine de la marketplace (DNS → Vercel → HTTPS)

> **Contexte (vérifié le 19/10/2026) :** `godsonmarket.com` est **réservé** au site
> « Green Mask Stick | Bénin » (déjà configuré chez Namecheap, à ne pas toucher).
> La marketplace a besoin de **son propre domaine**.
> **Domaine recommandé : `godsonmarketplace.com`** (vérifié libre le 19/10/2026).
> Alternative : `marchegodson.com` (également libre).

## Étape 1 — Acheter le domaine (10–15 $/an)

1. Se connecter sur **namecheap.com** (compte déjà utilisé pour godsonmarket.com).
2. Rechercher **`godsonmarketplace.com`** → **Add to cart** → commande (~10–15 $/an).
3. Noter le reçu ; le domaine est actif immédiatement avec les name servers Namecheap.
   (WHOIS privacy offert — garder activé.)

> **Alternative gratuite** : `godsonmarket.fr.eu.org` (guide : `GUIDE_DOMAINE_EU_ORG.md`) —
> réponse humaine sous quelques jours, pas d'achat. Moins pro qu'un .com, mais 0 $.

## Étape 2 — Configurer le DNS chez Namecheap (5 min)

1. **Domain List** → `godsonmarketplace.com` → **Manage** → **Advanced DNS**.
2. Supprimer les enregistrements de « parking » existants s'il y en a.
3. Ajouter **exactement** ces deux enregistrements :

| Host | Type | Value | TTL |
|---|---|---|---|
| `@` | **A Record** | `76.76.21.21` | Auto |
| `www` | **CNAME Record** | `cname.vercel-dns.com` | Auto |

- `@` = le domaine racine (`godsonmarketplace.com`).
- `76.76.21.21` = l'IP d'entrée de Vercel (invariable).
- Enregistrer (**Save** en haut et en bas de page).
- Propagation : de quelques minutes à ~1 h (TTL court).

## Étape 3 — « C'est fait » → l'exploitant (Godson) finalise

Dès confirmation de l'étape 2, le développeur :

1. **Ajoute le domaine dans le projet Vercel** (API) — Vercel vérifie le DNS et émet
   le **certificat TLS (HTTPS) automatiquement** (quelques minutes).
2. **Met à jour la config du site** : `VITE_SITE_URL = https://godsonmarketplace.com`
   → rebuild + redéploiement (sitemap, QR code de la page /application, balises SEO,
   liens d'e-mails).
3. **Vérifie tout** : HTTPS sur les deux hôtes, 12 routes, PWA, QR code, analytics.
4. L'ancienne URL `godson-marketplace.vercel.app` **reste active en parallèle**
   (aucun contenu perdu, aucun redirect forcé).

## Après le passage en domaine (à faire plus tard)

- [ ] Mettre à jour les e-mails (Brevo `MAIL_FROM` avec le domaine, SPF/DKIM si Brevo).
- [ ] Google Search Console : valider le nouveau domaine + soumettre le sitemap.
- [ ] Partages sociaux / réseaux : utiliser l'URL `godsonmarketplace.com`.
