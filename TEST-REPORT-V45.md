# ALLNEEDS V45 — rapport de test

Tests exécutés dans l’environnement de travail :

- `node --check backend/server.mjs` : OK
- Démarrage backend avec base locale vide : OK
- Bootstrap du premier administrateur via variables d’environnement : OK
- `GET /api/health` : 200 OK
- Login administrateur : 200 OK + cookie HttpOnly
- `GET /api/me` après login : 200 OK
- Création inscription entreprise : 201 Created
- Liste inscriptions Admin : 200 OK
- Validation inscription et création entreprise : OK
- Génération invitation propriétaire : OK
- Lecture invitation : OK
- Création mot de passe par token : OK
- Login du dirigeant : OK
- Invitation salarié par dirigeant : OK
- Création mot de passe salarié : OK
- Liste équipe : OK
- Contrôles activation/désactivation modules présents côté backend
- Suppression ciblée de données client et suppression entreprise ajoutées côté Admin

SMTP n’a pas été envoyé pendant le test automatisé car aucune clé Gmail réelle n’a été utilisée dans l’environnement de test. Le code SMTP renvoie explicitement une erreur de configuration au lieu de prétendre que l’e-mail a été envoyé.

La compilation frontend complète n’a pas pu être certifiée dans l’environnement de génération car l’installation npm a été interrompue par le transport réseau avant de télécharger complètement les dépendances. `npm run build` doit donc être exécuté après `npm install` sur la machine cible avant déploiement.
