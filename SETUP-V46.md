# ALLNEEDS V46 — installation

1. Créez un nouveau projet Supabase vide.
2. Exécutez `database/supabase.sql` dans SQL Editor avec RLS activé.
   (Base existante : exécutez plutôt `database/migrations/2026-10-10-01-parcours-v46.sql` puis `database/migrations/2026-10-10-02-offres-missions-v46.sql`, idempotents et sans DROP.)
3. Copiez `.env.example` vers `.env` et renseignez les secrets. Ne commitez jamais `.env`.
4. `npm install`
5. `npm run build`
6. `npm run backend:start`
7. Dans un second terminal: `npm run dev`

## Convention de persistance (schéma)
- Le backend (`backend/server.mjs`, `COLLECTION_TABLES`) utilise la convention **`v46_*`**.
- `database/supabase.sql` a été aligné sur `v46_*` (l'ancienne version utilisait des noms sans préfixe : mismatch résolu).
- Tables de collection génériques : `(id, organization_id, payload jsonb, created_at)`.
- Nouvelles tables du parcours 7 étapes : `v46_needs_subscriptions`, `v46_saas_subscriptions`, `v46_conversations`.
- Toute évolution de schéma passe par un fichier dans `database/migrations/`. Jamais de `DROP` automatique.

## Corrections V46
- accès Concierge attribué par l’admin dès la création
- activation/désactivation du compte Concierge
- entreprises attribuées visibles dans l’espace Concierge
- route détail entreprise Concierge ajoutée
- activation SaaS séparée par entreprise
- module Équipe séparé
- désactivation d’un module ne détruit plus la session
- page Besoins utilise l’organisation du compte authentifié
- suppression du rechargement automatique répétitif de Besoins au focus
- persistance Supabase relationnelle: tables séparées, pas `allneeds_state`
- RLS activé et accès direct `anon/authenticated` révoqué

## Phase 6 — Abonnements Besoins
- Formules (MAD/mois) : **ESSENTIEL 149** (2 besoins/mois, 2 propositions, 72 h) · **AVANCÉ 349** (5, 3 dont 1 recommandée, 48 h) · **PREMIUM 549** (10, 3 dont 1 négociée/recommandée, 36 h).
- Compatibilité anciens noms : `CONNECT → ESSENTIEL`, `PLUS → AVANCÉ`, `PRIORITE → PREMIUM` (jamais affichés au client).
- Le module Besoins reste **masqué** tant qu'aucun abonnement actif n'existe ; l'accès direct est refusé (backend **403 `NEEDS_SUBSCRIPTION_REQUIRED`**). L'activation réactive `org.modules.besoins` automatiquement.
- Une seule souscription active par entreprise ; l'historique est conservé (`v46_needs_subscriptions`).
- Quota appliqué **côté backend** à la création de besoin : dépassement → **403 `NEEDS_LIMIT_REACHED`** avec `{used, limit, remaining, periodEnd}`.
- Propositions : réutilise `v46_quotes` (`kind: 'proposition'` + `needId`) ; limites et options (recommandée/négociée) selon la formule.
- **Aucune migration Phase 6 nécessaire** : `v46_needs_subscriptions` et `v46_quotes` existent depuis la migration `2026-10-10-01-parcours-v46.sql`.
- Séparations maintenues : offres d'accompagnement (BASIQUE/PRO/PERFORMANCE) et SaaS (445 MAD/mois) ne sont **pas** modifiés par l'abonnement Besoins.
- Paiement réel non branché : activation fonctionnelle démo/backend — **intégration paiement à connecter en production**.
- Validation : `npm run test:backend`, `npm run test:phase4`, `npm run test:phase5`, **`npm run test:phase6`**, `npm run typecheck`, `npm run build`.
