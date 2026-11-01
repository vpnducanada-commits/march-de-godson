# Publication du frontend GODSON Marketplace v2.15

Ce paquet contient les fichiers modifiés du frontend et les sources locales de migration/fonction de modération. Il n'inclut ni `.env`, ni clé API, ni `node_modules`.

## Étapes

1. Clonez ou ouvrez votre checkout propre du dépôt GitHub relié à Vercel : `vpnducanada-commits/march-de-godson`, branche `main`.
2. Décompressez le paquet à la racine du checkout, en conservant les chemins de fichiers.
3. Dans ce checkout, exécutez `npm ci` puis `npm run build`.
4. Si le build réussit, committez les fichiers et poussez-les sur `main` :

```bash
git add src public vite.config.ts vercel.json index.html supabase
 git commit -m "Deploy Gemini moderation v2.15"
git push origin main
```

5. Attendez que le déploiement Vercel passe à `READY` et dites-moi quand c'est fait. Je vérifierai les routes et le cache PWA, puis j'appliquerai la migration `019_gemini_enforcement_after_frontend.sql` pour que la base impose le passage par Gemini.

## Important

- Ne copiez jamais de clé API dans le dépôt ou dans le navigateur.
- Les migrations `017_gemini_moderation` et `018_gemini_rollout_compatibility_restore` ont déjà été exécutées sur Supabase production; ne les exécutez pas une deuxième fois manuellement.
- Tant que le frontend n'est pas publié et que les politiques strictes ne sont pas réactivées, la modération n'est pas garantie contre les appels directs à l'API.
