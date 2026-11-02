# ALLNEEDS V44 — Backend comptes, accès et invitations

## Ce qui a été ajouté

- Demande d'inscription réelle via `POST /api/registrations`.
- Validation par l'administrateur dans `/admin/inscriptions`.
- Création d'une entreprise isolée avec `orgId`, `slug`, statut global et permissions par module.
- Invitation du dirigeant avec lien temporaire 48 h, utilisable une fois.
- Page `/creer-mot-de-passe?token=...` : le dirigeant crée lui-même son mot de passe.
- Même compte utilisable partout où le backend ALLNEEDS est partagé.
- Désactivation globale d'une entreprise : bloque tous ses utilisateurs côté serveur.
- Activation/désactivation séparée des modules : diagnostic, besoins, missions, rendez-vous, documents, messages, devis, prestataires, abonnement, notifications, espace métier.
- Contrôle admin intégré à la fiche `/admin/clients/$id`.
- Gestion d'équipe côté client : invitation, rôle, permissions, désactivation/réactivation, suppression.
- Chaque membre d'équipe possède son propre compte et crée son propre mot de passe.
- Lien entreprise `/entreprise/$slug` : point d'entrée pratique, sans contourner l'authentification.
- Journal d'audit backend des opérations sensibles.
- Endpoint de suppression administrateur scindé par entreprise pour les collections backend raccordées.
- Protection de session HttpOnly + signature HMAC + expiration + throttling de connexion.
- Contrôle serveur des modules `besoins` et `diagnostic` déjà raccordés.
- Envoi e-mail automatique possible via Resend. Sans configuration e-mail, le backend renvoie le lien d'activation afin de pouvoir le transmettre manuellement.

## Test automatisé

`npm run test:backend`

Le scénario testé couvre :

1. connexion administrateur ;
2. inscription entreprise ;
3. validation par admin ;
4. génération du lien dirigeant ;
5. création du mot de passe ;
6. connexion dirigeant ;
7. invitation d'un membre d'équipe ;
8. création de son mot de passe ;
9. désactivation d'un module ;
10. refus serveur du module désactivé ;
11. désactivation globale de l'entreprise ;
12. refus de connexion après désactivation.

## Production

Le stockage `backend/data/db.json` convient au développement ou à un serveur Node avec disque persistant. Il ne faut pas l'utiliser comme stockage durable sur une fonction Vercel éphémère. Pour production multi-instance, raccorder la même logique à une base persistante (PostgreSQL/Supabase, etc.) ou héberger le backend Node sur un service avec volume persistant.

Variables importantes :

- `ALLNEEDS_SESSION_SECRET`
- `ALLNEEDS_FRONTEND_ORIGIN`
- `ALLNEEDS_PUBLIC_URL`
- `ALLNEEDS_DATA_DIR`
- `RESEND_API_KEY` (si envoi réel)
- `ALLNEEDS_EMAIL_FROM` (si envoi réel)
