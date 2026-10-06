# Architecture backend — tranche MVP v1

**Objectif :** rendre les règles d'habilitation et d'isolation **incontournables** (zone de confiance serveur), sans dépendance externe, en une tranche livrable et testable.
**Implémentation associée :** `server/` (0 dépendance externe, `node --test`). **Audit associé :** `AUDIT-MVP-V1.md`.

---

## 1. Principes directeurs

1. **Le navigateur n'est jamais une zone de confiance.** Tout ce qui concerne l'identité, le rôle, le périmètre d'accès, la validation et l'audit est décidé et appliqué côté serveur. Le front peut *afficher* ; il ne décide *rien*.
2. **Aucun secret côté client.** Aucune clé, aucun jeton longue durée, aucun mot de passe dans le bundle. `.env.example` reste volontairement vide : rien à mettre dans `VITE_*`.
3. **Refuser par défaut.** Route inconnue → 404. Non authentifié → 401. Authentifié hors périmètre → **404** (pas 403) sur les ressources nominatives, pour ne pas révéler leur existence. Rôles valides mais action interdite → 403.
4. **Une seule source de vérité pour les permissions**, dupliquée délibérément entre `src/lib/permissions.ts` (affichage) et `server/policy.mjs` (décision), avec un test qui les garde alignées conceptuellement.
5. **Dépendances nulles.** `node:http`, `node:crypto`, `node:fs` uniquement. Aucun framework, aucun ORM, aucune base à installer → le dépôt reste buildable sans réseau.

---

## 2. Composants implémentés (`server/`)

| Fichier | Rôle |
|---|---|
| `server/auth.mjs` | Hachage **scrypt** (N=16384, r=8, p=1, salt 16 octets, comparaison `timingSafeEqual`), génération de jeton de session (32 octets), hachage SHA-256 du jeton |
| `server/policy.mjs` | Matrice `ROLE_PERMISSIONS`, `can()`, `accessibleOrgIds()`, `canAccessOrg()` — miroir de `src/lib/permissions.ts` |
| `server/store.mjs` | Persistance JSON fichier avec écriture atomique (`.tmp` + `rename`), chargement paresseux |
| `server/app.mjs` | Handler HTTP : routage, CORS, cookies `HttpOnly`, corps limité, validation, journal d'audit, limitation de débit |
| `server/seed.mjs` | Données de démonstration idempotentes (mot de passe `demonstration`) |
| `server/index.mjs` | Point d'entrée (`PORT`, `HOST`, `DATA_DIR`, `CORS_ORIGIN`) |
| `server/app.test.mjs` | 10 tests `node:test` : hachage, session, révocation, débit, isolation, portefeuilles, audit, validation, routes |

### Endpoints de la tranche

| Méthode | Route | Droit |
|---|---|---|
| `GET` | `/api/health` | public |
| `POST` | `/api/auth/login` | public (limité à 10 tentatives / 5 min / IP+email) |
| `POST` | `/api/auth/logout` | authentifié |
| `GET` | `/api/auth/me` | authentifié |
| `GET` | `/api/companies` | authentifié — **liste filtrée par périmètre** |
| `GET` | `/api/companies/:id` | authentifié + accès au locataire (404 sinon) |
| `GET` | `/api/companies/:id/diagnostics` | idem |
| `POST` | `/api/companies/:id/diagnostics` | idem + `diagnostic:write:own` + validation complète |
| `GET` | `/api/audit` | `audit:read` (admin) — 403 sinon |

Toute autre route → 404. Toute requête sans session sur une route de données → 401.

---

## 3. Identité et sessions

- **Connexion :** `email + mot de passe` → vérification scrypt → émission d'un jeton aléatoire.
- **Stockage serveur :** seul le **hachage SHA-256** du jeton est persisté ; le jeton clair ne quitte que la réponse `Set-Cookie`.
- **Cookie :** `allneeds_session`, `HttpOnly`, `SameSite=Lax`, `Path=/`, `Max-Age=7 jours`. `HttpOnly` rend le jeton inaccessible au JavaScript → un XSS ne l'extrait pas.
- **Révocation :** logout = suppression de la ligne ; toute session expirée, orpheline ou appartenant à un utilisateur désactivé est rejetée.
- **Fuite de base de données :** les mots de passe sont scrypt+salt, les jetons hachés → une copie du fichier `db.json` n'accorde aucun accès.
- **Débit :** 10 tentatives / 5 min par couple IP+email, puis 429 — limite le spraying de mots de passe.

### Côté front (complément, pas substitut)

`src/lib/session.ts` gère une session locale `allneeds.session.v1` **uniquement** pour piloter les gardes de route et le rendu de l'interface. Elle n'est **pas** une preuve d'identité : c'est un cache d'affichage, remplacé à terme par le cookie de session serveur. `store.tsx` n'a pas été modifié (voir limites §7).

---

## 4. Modèle de données (tranche)

```
users        { id, email, name, role, orgId, assignedOrgIds[], passwordHash, active, createdAt }
orgs         { id, name, sector }
sessions     { id, tokenHash, userId, createdAt, expiresAt }
diagnostics  { id, companyId, format, status, consent{by,acceptedAt,version}, answers{}, createdBy, createdAt, updatedAt }
audit        { id, at, actorId, actorRole, action, target, orgId }
```

`environment: 'demo'` est stocké en tête de base : toute écriture de démonstration reste identifiable.

---

## 5. Habilitation et isolation multi-tenant

### Rôles et permissions (miroir `server/policy.mjs`)

| Rôle | Permissions |
|---|---|
| `admin` | `org:read:all`, `org:update`, `member:invite`, `member:revoke`, `concierge:manage`, `diagnostic:read:all`, `crm:read`, `crm:write`, `audit:read` |
| `concierge` | `org:read:assigned`, `diagnostic:read:assigned`, `crm:read`, `mission:read:assigned`, `mission:write:assigned` |
| `client` | `org:read:own`, `diagnostic:write:own`, `mission:read:assigned` |
| `expert` | `mission:read:assigned` |

### Isolation (règle V9 appliquée)

```
accessibleOrgIds(actor) =
  admin      → toutes les orgs
  concierge  → actor.assignedOrgIds
  client     → [actor.orgId]
  expert     → actor.assignedOrgIds
```

Toute ressource nominative est filtrée par `canAccessOrg()`. Le cas hors périmètre renvoie **404**, jamais une liste partielle. `GET /api/companies` intersecte la liste complète avec `accessibleOrgIds` — il est **impossible** de recevoir une entreprise qu'on ne devrait pas voir.

**Champ obligatoire à ajouter côté serveur :** chaque entité métier (`tickets`, `contacts`, `missions`, `deals`) doit porter `company_id` et être jointe à cette matrice. Aucune requête n'est autorisée sans `company_id` résolu.

---

## 6. Validation du Diagnostic 360 côté serveur

Sur `POST /api/companies/:id/diagnostics` :

1. **Format** ∈ `Complet` | `Express ★` (422 `invalid_format` sinon).
2. **Consentement** obligatoire : `by` (identité, ≥ 2 caractères), `acceptedAt` (horodatage), `version` (version du texte) → 422 `consent_required`.
3. **Notes** : entier 0-5 → 422 `invalid_score`.
4. **Commentaires** : obligatoire dès que `score > 0` → 422 `comment_required`, avec la **liste des identifiants fautifs** dans `error.details`.
5. **Au moins une réponse** → 422 `empty_answers`.

### Limite assumée

Le serveur valide la **forme**, pas encore l'**appartenance des identifiants à la grille** (`q1…q40`), parce que la grille vit dans `src/features/health360/diagnosticData.ts` (TypeScript, front). Corriger dans la tranche suivante par **duplication de la grille en source partagée** (`grids/sante-v5.1.json`, généré une fois, importé par le front *et* le serveur), puis :
- rejet 422 si un identifiant est inconnu du format ;
- rejet 422 si un commentaire manque **sur une question du périmètre du format** ;
- recalcul **serveur** de l'indice, de la couverture et de la conclusivité, et **refus** d'enregistrer une synthèse non concluante.

Le score affiché par le front doit alors être un affichage du calcul serveur, jamais la source.

---

## 7. Limites connues (à ne pas masquer)

| # | Limite | Impact | Suite |
|---|---|---|---|
| 1 | `src/store/store.tsx` non modifié : rôle d'interface ≠ rôle de session | Divergence possible affichage/contrôle | Supprimer le rôle du store, le lire depuis la session serveur |
| 2 | Session front locale pilotée par `localStorage` | Cache consultable, forgeable | Remplacer par l'aller-retour cookie `HttpOnly` |
| 3 | Persistance JSON fichier | Non conciliable multi-instances | Migration Postgres + transactions |
| 4 | Identifiants de grille non validés côté serveur | Réponses hors grille acceptées | §6 |
| 5 | Aucune rotation de session, pas de `Secure`, pas de `HttpOnly` sur un domaine réel | Dette de production | `Secure` + `__Host-` prefix derrière HTTPS |
| 6 | Aucune protection CSRF dédiée | Cookies `SameSite=Lax` uniquement | Jeton CSRF en double soumission |
| 7 | Aucun chiffrement au repos | Données sensibles en clair dans `db.json` | Chiffrement ou base managée |
| 8 | Shell indisponible pendant le développement | **Aucune commande exécutée, aucun test lancé** | Voir `COMPTE-RENDU-MVP-V1.md` §4 |
| 9 | Compte `expert` présent côté serveur, absent des comptes de démo front | Écart volontaire pour tester le rôle | À retirer ou à ajouter à l'interface |

---

## 8. Déploiement cible

```
Front (SPA)  ──►  API (node:server/index.mjs)  ──►  stockage (db.json → Postgres)
   Vite/Vercel         HTTPS + CORS strict            migrations + chiffrement
```

- `CORS_ORIGIN` en liste blanche stricte (pas de `*`), `credentials: true` uniquement sur ces origines.
- Variables serveur : `PORT`, `HOST`, `DATA_DIR`, `CORS_ORIGIN`. **Aucune** variable `VITE_*` n'est requise.
- Migration Postgres de la tranche suivante : tables `users`, `orgs`, `org_members` (portefeuille concierge), `sessions`, `diagnostics`, `audit`, avec contrainte `FOREIGN KEY (company_id) REFERENCES orgs(id)` et index sur `(company_id)`.
