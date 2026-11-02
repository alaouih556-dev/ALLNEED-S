# ALLNEEDS V45 — démarrage propre

## 1. Base de données Supabase
Dans Supabase > SQL Editor, exécuter `database/supabase.sql`.

Puis récupérer :
- Project URL -> `SUPABASE_URL`
- Service Role Key -> `SUPABASE_SERVICE_ROLE_KEY`

Ne jamais mettre la Service Role Key dans une variable `VITE_*`.

## 2. `.env`
Copier `.env.example` vers `.env` et renseigner les valeurs réelles.

Pour le premier démarrage seulement, remplir :
- `ALLNEEDS_ADMIN_EMAIL`
- `ALLNEEDS_ADMIN_NAME`
- `ALLNEEDS_ADMIN_PASSWORD` (12 caractères minimum)

Après le premier démarrage réussi, supprimer `ALLNEEDS_ADMIN_PASSWORD` du `.env`.

## 3. Gmail SMTP
Utiliser un App Password Google, pas le mot de passe Gmail normal.

## 4. Lancer
```powershell
npm install
npm run build
npm run backend:start
```
Dans un deuxième terminal :
```powershell
npm run dev
```

## 5. Flux réels
- Inscription entreprise -> `/api/registrations`
- Validation Admin -> invitation e-mail automatique
- Création du mot de passe via lien 48h
- Connexion par session HttpOnly
- Invitation salarié par dirigeant -> e-mail automatique
- Création Concierge par Admin -> e-mail automatique
- Activation/désactivation entreprise et modules séparément
- Activation/désactivation/suppression salarié
- Suppression de données client module par module par Admin
- Suppression définitive entreprise avec cascade applicative

## 6. Persistance
Si Supabase est configuré, il est la source de persistance serveur. Un fichier local `backend/data/db.json` est aussi maintenu comme copie de travail locale.
