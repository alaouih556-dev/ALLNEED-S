# Compte rendu — tranche MVP v1

**Date :** 2026-10-06 · **Dépôt :** `C:\Users\nitro\Downloads\ALLNEED-S-V3` · **Base :** V22
**Documents associés :** `AUDIT-MVP-V1.md` · `ARCHITECTURE-BACKEND-MVP-V1.md`

---

## 1. Résumé en une phrase

La tranche livrée sécurise ce qui pouvait l'être sans réseau ni base de données : **gardes de route + matrice d'habilitation côté front**, **règles du Diagnostic 360 v5.1 corrigées dans la logique de calcul**, et **un squelette backend zéro-dépendance qui applique réellement l'isolation multi-tenant et la validation du diagnostic**, avec 10 tests `node:test`.

---

## 2. Ce qui a été fait

### 2.1 Habilitation et gardes de route (P0)

| Fichier | Changement |
|---|---|
| `src/lib/permissions.ts` | **Créé.** `Role` (client/admin/concierge/expert), `Permission`, `ROLE_PERMISSIONS`, `can()`, `requiredRoleFor()`, `canAccessPath()`, `GUARDED_PATHS` |
| `src/lib/session.ts` | **Créé.** Session `allneeds.session.v1` : `readSession()` / `writeSession()` / `clearSession()`, validation stricte des champs, tolérant `localStorage` absent (SSR) |
| `src/routes/admin.tsx` | `beforeLoad` → `canAccessPath(role, '/admin')` sinon `redirect('/connexion')` |
| `src/routes/concierge.tsx` | idem pour `/concierge` |
| `src/routes/expert.tsx` | idem pour `/expert` |
| `src/routes/app.tsx` | idem pour `/app` |
| `src/routes/connexion.tsx` | `openRole()` écrit la session **avant** la navigation (3 call sites : soumission + boutons démo) |
| `src/routes/inscription.tsx` | Ouvre une session client (`usr-amina`/`org-amal`) pour que `onboarding → /app` franchisse la garde |
| `src/components/layouts.tsx` | Bouton déconnexion = `clearSession()` + retour à `/`, libellé « Se déconnecter » |

Aucun fichier de route n'a été **ajouté** (le générateur `routes:generate` n'a donc pas été touché).

### 2.2 Diagnostic 360 — grilles v5.1 (P0)

| Fichier | Changement |
|---|---|
| `src/features/health360/scoring.ts` | **Créé.** Logique pure : `questionsForFormat()`, `isTouched()`, `isNoted()`, `needsComment()`, `buildStats()`, `buildConsent()`, `formatConsent()`, `GRID_VERSION='v5.1'` |
| `src/features/health360/Diagnostic360.tsx` | Câblage sur `buildStats()` ; le calcul manuel a été supprimé |
| `scripts/test-diagnostic360.mjs` | **Créé.** 20+ assertions sur les 8 règles (voir §3) |

Règles désormais appliquées : **0 = non évalué** (exclu de l'indice, des moyennes et du tri) · couverture et traitées affichées · volet **non conclusif au-delà de 2 internes à 0**, exclu des forces/priorités et affiché « — » · **Express conclusif sur les questions ★ uniquement** · **commentaire obligatoire** sur chaque note évaluée · **consentement refusé sans identité**, horodaté et versionné, conditionnant l'accès aux questions.

### 2.3 Backend (P0) — `server/`, zéro dépendance

`auth.mjs` (scrypt N=16384, jeton haché SHA-256, `timingSafeEqual`) · `policy.mjs` (miroir de `src/lib/permissions.ts`, `accessibleOrgIds`) · `store.mjs` (JSON atomique) · `app.mjs` (routing, cookie `HttpOnly`, corps limité, 429 sur débit, 401/403/404, audit) · `seed.mjs` · `index.mjs` · `app.test.mjs`.

Fonctionne : `POST /api/auth/login|logout`, `GET /api/auth/me`, `GET|POST /api/companies[/:id][/diagnostics]`, `GET /api/audit`, `GET /api/health`. Fiches détaillées dans `ARCHITECTURE-BACKEND-MVP-V1.md` §2.

### 2.4 Scripts et configuration

- `package.json` : ajout de `test:permissions`, `test:diag360`, `test:server`, `test:mvp`, `server`, plus les scripts manquants `test:v19`, `test:v22`, `test:offers`.
- `.gitignore` : `server/data/` (base de démo non versionnée).
- `scripts/test-render.mjs` : seed de `localStorage` avec une session client valide **avant** `router.load()` — requis désormais que `/app` est gardé.
- `scripts/test-permissions.mjs` : **créé** — matrice, chemins, aller-retour session (avec shim `localStorage`), sessions corrompues rejetées, et vérification que les 4 routes contiennent bien `beforeLoad`/`canAccessPath`.

---

## 3. Ce qui n'a PAS été fait

1. **Aucune commande n'a été exécutée.** Shell Windows indisponible en permanence : `EPERM: operation not permitted, uv_spawn '…\powershell.EXE'`. Pas de `npm install`, `tsc`, `vite build`, `node --test`. **Rien de ce qui suit n'est vérifié par exécution.**
2. **Risque principal :** les fichiers modifiés (`Diagnostic360.tsx`, `scoring.ts`, les 4 routes, `connexion.tsx`) n'ont jamais subi `tsc --noEmit`. Une erreur de typage est probable et se corrige en 1 passe (§4).
3. **`store.tsx` non modifié** — le rôle d'interface reste celui du store démo. La session est l'autorité des gardes. Divergence assumée.
4. **Pas d'intégration front ↔ API.** L'UI n'appelle pas `server/` : les deux coexistent sans être câblées (le branchement nécessite des variables d'environnement et un arbitrage sur le flux de démo).
5. **Pas de lint** (aucun ESLint/Biome dans le dépôt).
6. **Grille serveur :** identifiants non validés contre la grille, score non recalculé côté serveur — voir `ARCHITECTURE-BACKEND-MVP-V1.md` §6.
7. **Pas de migration Postgres, pas de chiffrement, pas de CSRF dédié, pas de `Secure`** — dette explicitement listée (§7 du document d'architecture).
8. **Expertise `/expert` côté front** : le rôle existe dans la session mais aucun compte de démo front ne l'utilise. Le serveur, lui, expose `expert.sante@allneeds.ma` (écart volontaire, à arbitrer).

---

## 4. Vérification — À EXÉCUTER MANUELLEMENT

Dans l'ordre, depuis la racine du dépôt :

```bash
npm install            # si node_modules absent
npm run typecheck      # 1. bloque d'abord ici : corrige les erreurs TS signalées
npm run test:diag360   # 2. règles Diagnostic 360 v5.1
npm run test:permissions  # 3. matrice + gardes de route + session
npm run test:render    # 4. rendu SSR existant (doit rester vert après le seed ajouté)
npm run test:server    # 5. backend : isolation, sessions, validation
npm run build          # 6. build Vite
npm run server         # 7. http://127.0.0.1:8787/api/health
```

Ou d'un bloc : `npm run test:mvp` (3 + 5 + 4 après 2).

**Reçu attendu :**

- `test:diag360` → `OK — Diagnostic 360 v5.1 : 40 questions Complet, … 0 exclu des moyennes, conclusivité par volet, commentaires obligatoires, consentement horodaté.`
- `test:permissions` → `OK — habilitations : 4 espaces protégés par beforeLoad, …`
- `test:render` → `Rendu React réussi : hebergement … agence`
- `test:server` → `tests 10 … pass 10` (ni `fail`, ni `skip`)
- `typecheck` / `build` → **0 erreur** — si ≠ 0, corriger avant tout le reste.

Vérification manuelle de l'isolation :

```bash
npm run server
curl -X POST http://127.0.0.1:8787/api/auth/login -H "content-type: application/json" -d "{\"email\":\"a.bennani@al-amal.ma\",\"password\":\"demonstration\"}" -i   # → Set-Cookie HttpOnly
curl http://127.0.0.1:8787/api/companies/org-nour -H "cookie: allneeds_session=<jeton>"   # → 404 (locataire étranger masqué)
curl http://127.0.0.1:8787/api/companies                                                     # → 401 sans session
```

**Si un test échoue :** ne pas corriger en aveugle, renvoyer la sortie brute + fichier concerné.

---

## 5. Conflits et absences de sources (non tranchés silencieusement)

| Sujet | Traitement |
|---|---|
| Plaquettes commerciales | **Absentes.** Seule trace : `UX-UI-ENSEIGNEMENT-V2.md:52` (CONNECT/PLUS/PRIORITÉ = 6/15/30 besoins, 5 j / 3 j / 48 h). Non appliqué. |
| Grilles 360 Enseignement / Tourisme | **Absentes** (`reference/` ne contient que la grille Santé). **Non inventées.** Le Diagnostic 360 livré est celui de la Santé v5.1. |
| Grille Santé `.docx` vs `diagnosticData.ts` | Contrôle automatique impossible → revue question par question requise avant production. |
| Texte juridique du consentement | À faire valider par un conseil juridique (mention déjà présente dans le composant). |
| Doublons de dépôt imbriqués | Ignorés. |
| `Role` store (`'client'\|'admin'\|'concierge'`) vs session (`+ 'expert'`) | Non réconcilié — signalé P1. |

---

## 6. Prochaine tranche recommandée

1. `tsc --noEmit` + `vite build` verts (blocage immédiat).
2. Grille partagée `grids/sante-v5.1.json` → validation serveur des identifiants + recalcul serveur de l'indice.
3. Brancher l'UI sur `/api/*` : remplacer la session `localStorage` par le cookie `HttpOnly`, retirer le rôle du `store.tsx`.
4. Postgres : `company_id` en clé étrangère sur **toutes** les entités métier (tickets, contacts, missions, deals).
5. Sources manquantes : plaquettes commerciales, grilles Enseignement/Tourisme.
