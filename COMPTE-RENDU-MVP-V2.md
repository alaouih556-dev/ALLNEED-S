# Compte rendu — tranche MVP v2 (P0 : authentification et isolation)

**Date :** 2026-10-06 · **Dépôt :** `C:\Users\nitro\Downloads\ALLNEED-S-V3` · **Base :** V22 + tranche v1
**Documents associés :** `AUDIT-MVP-V1.md` · `COMPTE-RENDU-MVP-V1.md` · `ARCHITECTURE-BACKEND-MVP-V1.md`

---

## 1. Résumé en une phrase

L’interface ne dispose plus d’aucune décision d’identité ni d’habilitation : la session
est délivrée par l’API dans un cookie `HttpOnly`, chaque zone protégée revalide le profil
sur `GET /api/auth/me`, et l’API applique la matrice de permissions et l’isolation
multi-tenant sur **toutes** ses routes (nouvelles routes membres, comptes, invitations,
audit scopé, demandes d’inscription).

---

## 2. Ce qui a été fait

### 2.1 Session et garde de route (frontend)

| Fichier | Changement |
|---|---|
| `src/lib/session.ts` | **Réécrit.** `SESSION_KEY='allneeds.session.v1'`, `readSession/writeSession/clearSession` (compatibles `test-permissions`), `sessionFromServerUser`, `login()`, `logout()`, `verifySession()` : SSR → lecture du cache ; navigateur → `GET /api/auth/me` ; 401 → cache effacé et `null` ; erreur réseau → exception (expliquée par l’écran d’erreur). **Aucun import de valeur** (contrainte du transpilage `data:` URL). |
| `src/lib/auth-guard.ts` | **Créé.** `syncIdentity(session)` aligne le store local sur le profil serveur (`IDENTITY_SYNC`) — empêche un compte non provisionné de retomber sur les données d’une autre entreprise. |
| `src/routes/{app,admin,concierge,expert}.tsx` | `beforeLoad: async` → `verifySession()` → `canAccessPath(role, '<branche>')` → sinon `redirect('/connexion')` → `syncIdentity(session)`. Les quatre fichiers gardent les littéraux vérifiés par `test-permissions`. |
| `src/routes/connexion.tsx` | Connexion **réelle** via `login()` ; plus de mot de passe forgeable ni de navigation directe depuis les cartes (elles ne pré-remplissent que l’e-mail). États : en cours, 401, 429, réseau. Indice « demonstration » affiché **uniquement** si `GET /api/health` déclare `environment: 'demo'`. |
| `src/routes/inscription.tsx` | **Plus de session forgée.** La soumission crée une demande côté serveur (`POST /api/registrations`) et affiche une référence ; aucun compte ni mot de passe n’est créés. |
| `src/components/layouts.tsx` | Déconnexion = `logout()` (révocation serveur) puis `clearSession()`. Suppression du sélecteur de rôle local mort (`switchRole`) et correction du rappel « jeu de démonstration ». |
| `src/routes/__root.tsx` | `defaultErrorComponent` : distingue *service injoignable*, *session expirée*, *accès refusé* et erreur inattendue, avec relance et lien de reconnexion. |
| `src/store/store.tsx` | File d’attente `dispatchDemo` : les actions d’identité émises pendant `beforeLoad` (avant montage du provider) ne sont plus perdues. |
| `vite.config.ts` | Proxy `/api` → `VITE_API_PROXY` (défaut `http://127.0.0.1:8787`) : l’interface et l’API partagent l’origine en développement, donc le cookie fonctionne sans CORS. |

### 2.2 API : habilitations appliquées à chaque route

| Fichier | Changement |
|---|---|
| `server/policy.mjs` | Sous-rôles client (`dirigeant`/`manager`/`collaborateur`), rôles `admin`/`concierge`/`commercial`/`expert`, helpers `can`, `canAny`, `auditScope`, `accessibleOrgIds`, `canAccessOrg`. |
| `server/app.mjs` | Ordre systématique **authentification → portée organisation (404) → permission (403)** ; audit de `auth.login_failed`, `access.denied`, `access.not_found` ; nouvelles routes : `GET /api/companies/:id/members`, `PATCH /api/users/:id`, `GET|POST /api/invitations`, `POST /api/invitations/:token/accept`, `POST /api/auth/logout-all`, `POST /api/auth/password`, `GET|POST /api/registrations` ; `GET /api/audit` scopé (`all` pour l’admin, `assigned` pour le concierge, refus sinon). |
| `server/seed.mjs` | Comptes `commercial`, `manager`, `collaborateur` ajoutés ; `clientRole` posé sur les clients. |
| `server/store.mjs` | Schéma v2 : `invitations[]`, `registrations[]`, migration des bases existantes. |
| `server/index.mjs` | `APP_ENV` surcharge l’environnement déclaré par `GET /api/health` ; `COOKIE_SECURE` existant conservé. |
| `server/app.test.mjs` | **+8 tests** : matrice de permissions, périmètre du commercial, membres (portée puis habilitation), gestion des comptes, invitations (création → acceptation → anti-rejeu), audit scopé concierge, déconnexion globale, changement de mot de passe, demandes d’inscription, santé du service. |
| `.env.example`, `README.md` | Variables documentées (sans secret), démarrage API + interface, comptes de démonstration, limites corrigées. |

---

## 3. Décisions de conception

1. **La session locale est un cache, jamais une source de vérité.** Elle sert à afficher
   l’identité entre deux requêtes ; toute zone protégée revalide via `/api/auth/me`.
2. **Aucun mode démo hors-ligne.** Si l’API est injoignable, l’utilisateur reçoit
   l’explicite « démarrez `npm run server` ou définissez `VITE_API_BASE` » — jamais de
   profil de secours (l’ancien repli `DEMO_CLIENT_PROFILES['usr-amina']` est supprimé).
3. **L’inscription n’ouvre pas de compte.** Elle crée une demande (`pending`) consultable
   par l’admin (`GET /api/registrations`), tracée à l’audit ; l’ouverture de compte passe
   par l’invitation, qui est le seul chemin qui crée un utilisateur.
4. **Portée avant permission.** Une entreprise hors périmètre renvoie 404 (pas 403) pour
   ne pas révéler son existence ; dans le périmètre, une permission manquante renvoie 403.
5. **`audit:read` = portée admin globale, `audit:read:assigned` = concierge.** Pas d’alias.
6. **Indice de démonstration conditionnel.** Le mot de passe commun n’apparaît dans
   l’interface que si le serveur déclare `environment: 'demo'`.

---

## 4. Ce qui n’est pas fait (et pourquoi)

| Sujet | État |
|---|---|
| Renvois secteur **Enseignement** et **Tourisme v5.1** | Absents du dépôt (`reference/` ne contient que la grille Santé et un PDF) — P1/P2 bloqués, aucune valeur inventée. |
| **Plaquettes commerciales / tarifs** | Absentes ; source conservée : `src/data/catalog.ts`. |
| **Réinitialisation de mot de passe par e-mail** | Aucun canal d’envoi : le bouton « Mot de passe oublié ? » affiche la marche à suivre (concierge/admin) au lieu d’afficher une fonction qui n’existe pas. |
| **Formulaire public `/demande` et `/contact`** | Toujours locaux (jeu de démonstration) — à câbler sur `POST /api/registrations` en P1. |
| **`/onboarding`** | Plus atteint depuis l’inscription ; à réattacher à l’activation du compte (P1.1). |
| **Mise en production de l’API** | `vercel.json` reste une SPA : il faut héberger `server/` et renseigner `VITE_API_BASE`. |
| **Espace CRM du commercial** | Permissions et comptes créés côté serveur, **aucune page** côté interface (message explicite à la connexion). |
| Navigation mobile | Non traitée (reste du P1). |

---

## 5. Vérifications — **aucune exécutée**

L’environnement de travail a un shell inutilisable
(`EPERM: operation not permitted, uv_spawn … powershell.EXE`) : **ni `npm`, ni `node`,
ni `tsc` n’ont pu être lancés.** Toutes les modifications ont été relues manuellement,
mais rien n’est validé automatiquement. À exécuter dès qu’un shell est disponible, dans
cet ordre :

```powershell
npm install
npm run test:mvp        # test-diagnostic360 + test-permissions + node --test server/ + test-render
npm run typecheck
npm run test:v10 ; npm run test:v16 ; npm run test:v19 ; npm run test:v22 ; npm run test:access
npm run test:saas ; npm run test:tourisme ; npm run test:offers ; npm run test:questionnaires
npm run build
npm run server          # puis npm run dev dans une seconde fenêtre
```

Points de vigilance à contrôler en priorité :

- `test-permissions` : `readSession()` sans import de valeur, littéraux des 4 gardes,
  `writeSession` dans `connexion.tsx`, `clearSession` dans `layouts.tsx`.
- `test-render` : rendu SSR de `/app/tourisme/agence` avec la session en cache (aucun
  appel réseau pendant `beforeLoad` en SSR).
- `server/app.test.mjs` : ordre des tests, quota de débit (10 tentatives / 5 min par
  couple IP+identifiant), `PATCH /api/users` sur soi-même → 403.
- `tsc --noEmit` : contrôle des types des nouvelles actions `IDENTITY_SYNC` et du
  `defaultErrorComponent`.

---

## 6. Risques résiduels

- **Le mot de passe commun de démonstration est une fonctionnalité, pas un défaut** :
  elle doit être supprimée (`seedDemo` + indice UI) avant toute mise en production.
- `GET /api/registrations` est réservé à `user:manage` (admin) ; aucun écran ne l’affiche
  encore — les demandes sont visibles uniquement via l’API.
- La persistance JSON (`server/data/`) n’est ni transactionnelle ni concurrente : acceptable
  pour un MVP local, à remplacer par une vraie base avant ouverture à plusieurs utilisateurs.
- Aucune couverture automatique du comportement navigateur (aucun test e2e dans le dépôt).
