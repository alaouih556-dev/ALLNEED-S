# Rapport de test V46

Tests exécutés dans l’environnement de préparation:

- `node --check backend/server.mjs`: OK
- `npm run test:backend`: OK
  - login admin
  - inscription entreprise
  - validation admin
  - création mot de passe dirigeant
  - login dirigeant
  - invitation salarié
  - création mot de passe salarié
  - liste équipe
  - invitation Concierge
  - création mot de passe Concierge
  - login Concierge
  - contrôle des entreprises attribuées
  - désactivation du module SaaS
  - désactivation du module Besoins appliquée côté serveur
  - désactivation entreprise bloque un nouveau login

Le build frontend complet n’a pas pu être certifié dans l’environnement de préparation car l’installation npm a été interrompue par le réseau. Les fichiers TSX modifiés ont néanmoins été vérifiés syntaxiquement avec TypeScript sans erreur de syntaxe. Exécutez `npm install` puis `npm run build` localement avant déploiement.
