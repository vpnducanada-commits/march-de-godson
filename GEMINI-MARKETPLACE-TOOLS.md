# Outils Gemini du marketplace

## État

Les cinq outils sont intégrés au code, mais **aucun Edge Function ni migration n’a été déployé**. La fonction est volontairement en mode fermé par défaut : elle répond `assistant_not_configured` tant que `GEMINI_MARKETPLACE_TOOLS_ENABLED=true` **et** `GEMINI_FREE_TIER_ONLY=true` ne sont pas tous les deux définis. La règle est strictement gratuite : ne pas configurer de basculement payant; si le quota gratuit est indisponible, la requête s’arrête.

Le repère de prix est un calcul local à partir des annonces Supabase actives, non démonstration, non expirées et de la catégorie choisie (et de la localité si sélectionnée). Il est masqué si moins de cinq prix comparables sont disponibles. Il n’appelle pas Gemini.

## Déploiement (après décision du propriétaire)

1. Vérifier que le projet Gemini et la clé utilisés sont limités à l’offre gratuite, et que les quotas gratuits sont disponibles. Le code ne bascule jamais vers une offre payante; en cas de quota indisponible, il s’arrête. Les deux variables sont seulement des garde-fous logiciels et ne peuvent pas, à elles seules, empêcher une facturation si le fournisseur a configuré la clé en mode payant.
2. Appliquer la migration `supabase/migrations/020_gemini_marketplace_tools.sql` au projet Supabase.
3. Configurer les secrets Edge Functions côté Supabase uniquement si le point 1 est vérifié : `GEMINI_API_KEY`, `GEMINI_MARKETPLACE_TOOLS_ENABLED=true` et `GEMINI_FREE_TIER_ONLY=true`. `SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY` sont fournis par l’environnement Edge Supabase.
4. Déployer `supabase/functions/gemini-marketplace-tools` puis vérifier les journaux et les quotas.

Les flags restent désactivés ici; le statut gratuit de la clé et des quotas n’a pas été vérifié, et aucun appel Gemini ni déploiement n’a été effectué. La fonction de modération Gemini déjà existante est également protégée par `GEMINI_FREE_TIER_ONLY=true` dans le code source; sans ce réglage elle échoue fermée au lieu d’appeler Gemini.

## Garde-fous implémentés

- Quotas journaliers par utilisateur (3 assistants d’annonce, 8 recherches, 2 tris admin/24 h); recherche anonyme limitée par adresse réseau hachée côté serveur. Les adresses IP brutes ne sont pas conservées par la table de quotas.
- Aucune clé Gemini dans le navigateur. Les appels sont lancés uniquement par action explicite de l’utilisateur, côté Edge Function.
- La recherche interprète des filtres puis laisse le catalogue interroger les annonces actives réelles; les résultats de démonstration et le cache hors ligne sont exclus pour ce parcours.
- L’assistant d’annonce propose du texte non appliqué automatiquement; le vendeur choisit de l’appliquer et doit le vérifier.
- Les signalements envoyés à Gemini sont limités aux annonces publiques actives, aux titres/descriptions publiques et aux motifs prédéfinis. Le champ `details`, les messages privés, les identités et les coordonnées ne sont pas transmis. Le tri est non décisionnel et accessible aux administrateurs uniquement.
- En cas de quota Gemini épuisé, de quota journalier atteint ou de configuration absente, l’outil échoue fermé; aucune alternative payante n’est appelée.
