# Mise en ligne des fonctionnalités Gemini gratuites — GODSON Marketplace

## Fichiers à intégrer

Décompresser l’archive à la racine du dépôt `godson-marketplace` en conservant les chemins. Elle ne contient aucun secret ni clé API.

1. Vérifier les modifications puis committer/pousser vers la branche de production reliée à Vercel (actuellement `main`). Vercel relancera `npm run build` automatiquement.
2. Le build local TypeScript/Vite a réussi.
3. Côté Supabase, la migration de quotas et la fonction `gemini-marketplace-tools` ont déjà été créées. Les paramètres `GEMINI_MARKETPLACE_TOOLS_ENABLED=true` et `GEMINI_FREE_TIER_ONLY=true` sont configurés dans les secrets Supabase; la clé Gemini n’est pas dans cette archive.
4. Aucun appel Gemini n’a été lancé pendant la préparation. L’application s’arrête si la limite gratuite est atteinte; elle ne bascule pas vers une offre payante.

## Chemins inclus

- `src/components/GeminiSearchAssistant.tsx`
- `src/components/ListingForm.tsx`
- `src/lib/api.ts`
- `src/lib/types.ts`
- `src/pages/Admin.tsx`
- `src/pages/Catalog.tsx`
- `src/styles/global.css`
- `supabase/functions/gemini-marketplace-tools/index.ts`
- `supabase/functions/gemini-moderate-listing/index.ts`
- `supabase/migrations/020_gemini_marketplace_tools.sql`
- `GEMINI-MARKETPLACE-TOOLS.md`

Le repère de prix, calculé à partir d’annonces réelles, ne fait aucun appel Gemini. Le tri des signalements ne traite ni les messages privés ni le champ libre « détails » des signalements.
