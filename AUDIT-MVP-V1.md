# Audit du dépôt ALLNEEDS — tranche MVP v1

**Date :** 2026-10-06 · **Base :** ALLNEED-S-V3 (V22) · **Périmètre :** dépôt racine `C:\Users\nitro\Downloads\ALLNEED-S-V3`
**Nature :** lecture seule du dépôt existant, puis constats. Les correctifs réalisés sont décrits dans `COMPTE-RENDU-MVP-V1.md`.

---

## 1. Méthode

- Inventaire du dépôt racine uniquement (les copies imbriquées `ALLNEED-S-V3\ALLNEED-S-V3\…`, `ALLNEED-S-Sante\…` et autres doublons sont ignorés : code mort, pas de source de vérité).
- Lecture ciblée : routage, authentification, persistance, matrice de rôles, module Diagnostic 360, scripts de test, configuration d'environnement.
- Référence normative : `reference/Sante_grille_360_ALLNEEDS_v5_1.docx` (grille Santé v5.1), `reference/ALLNEEDS_Reflexion_Strategique_UX_UI.pdf`.
- Le code V22 est traité comme **base à améliorer**, jamais comme preuve que la sécurité ou l'isolation sont assurées.

---

## 2. Constats critiques (P0 — sécurité et fondations)

### 2.1 Il n'y a pas de backend

| Signal | Évidence |
|---|---|
| Aucun serveur, aucune route API | `package.json` ne contient que des scripts `vite` / `tsc` / tests de scripts |
| Variable d'environnement vide | `.env.example` → `VITE_HEALTH_URL=` (une seule ligne, aucune URL de service) |
| Déploiement = SPA statique | `vercel.json` : rewrite unique `/(…) → /index.html`, aucune fonction serveur |
| Aucune dépendance serveur | `dependencies` : react, tanstack router, clsx, lucide, tailwind-merge uniquement |

**Conséquence :** toutes les règles d'habilitation, d'isolation multi-tenant et de validation sont absentes de toute zone de confiance. Aucune donnée ne peut être protégée tant que la logique vit dans le navigateur.

### 2.2 L'authentification est une démonstration purement côté client

- `src/routes/connexion.tsx:22` — `const DEMO_PASSWORD = 'demonstration'` : mot de passe en dur, comparé en clair (`connexion.tsx:54`).
- `connexion.tsx:58-63` : le « compte » est choisi dans un tableau statique `DEMO_ACCOUNTS`, sans vérification d'identité.
- `connexion.tsx:37-43` : `openRole()` écrit la session **côté navigateur** puis navigue — le rôle est une déclaration du client.
- Aucun hachage, aucun jeton, aucune session serveur, aucune expiration, aucune révocation.

**Conséquence :** n'importe qui peut écrire `{"role":"admin"}` dans le stockage local et se déclarer administrateur. Toute règle « admin vs concierge vs client » est indicative, pas effective.

### 2.3 Les données ne sont pas isolées entre locataires

- `src/store/store.tsx:657` — `const STORAGE_KEY = 'allneeds.demo.v2'` ; `store.tsx:673` lecture, `store.tsx:687` écriture à **chaque mutation**.
- Toutes les entreprises, diagnostics, tickets CRM et parcours cohabitent dans **une seule structure partagée** sur le poste.
- Il n'existe aucun filtre `company_id` : l'isolation repose sur l'affichage (« le client ne voit que son secteur »), pas sur l'accès.

**Conséquence :** l'isolation annoncée (règle V9) est un choix d'interface, pas une garantie. Une requête, un composant ou une URL détournée lit les données des autres.

### 2.4 Aucune garde de route

Avant correctif, `src/routes/{admin,concierge,expert,app}.tsx` n'appelait **aucun** `beforeLoad` : `/admin` s'ouvrait directement depuis l'URL pour un visiteur anonyme. Les deux seuls `beforeLoad` du routage redirigeaient des pages publiques (`/missions` → `/tarifs`).

### 2.5 Pas d'horodatage ni de preuve de consentement

- Le consentement du Diagnostic 360 vivait dans le flux local de `Diagnostic360.tsx` : case à cocher + identité facultative, sans horodatage ni version de texte conservée avec la réponse.
- Aucun journal d'audit, aucune trace d'ouverture/lecture/export.

---

## 3. Écarts fonctionnels (règles du Diagnostic 360 v5.1)

Règles appliquées : 4 volets / 40 questions (28 internes + 12 externes), Complet et Express ★, **0 = non évalué**, couverture et conclusivité affichées, Express conclusif sur ★, commentaire obligatoire par note évaluée, consentement horodaté + version + identité.

| # | Règle | État avant | État après correctif |
|---|---|---|---|
| 1 | 40 questions Complet / sous-ensemble ★ Express | Grille présente dans `diagnosticData.ts`, mais le périmètre Express n'était pas isolé comme périmètre de calcul | `questionsForFormat()` : le périmètre Express est celui des questions ★ |
| 2 | **0 = non évalué** (exclu de la moyenne et du tri) | Un `0` entrait dans l'indice et pouvait se classer « priorité n°1 » | `buildStats()` exclut les 0 de l'indice, des moyennes et du classement |
| 3 | Couverture et conclusivité affichées | Affichage partiel, volets comptés globalement | Couverture + traitées affichées en tête ; table synthèse « — » et mention explicite si volet non conclusif |
| 4 | Express conclusif sur les questions ★ | Non appliqué | `buildStats('Express ★', …)` : total, couverture et règle des 2 zéros calculés sur le périmètre ★ |
| 5 | Volet non conclusif au-delà de 2 internes à 0 | Non appliqué | `conclusive = zeros internes ≤ 2`, exclu des forces/priorités |
| 6 | Commentaire obligatoire par note évaluée | Non bloquant | `ready` exige `missingComments.length === 0` ; marqueur « obligatoire » sur les commentaires manquants |
| 7 | Consentement : horodatage + version + identité | Case à cocher seule | `buildConsent()` refuse sans identité ; bouton « Commencer » conditionné par `accepted && consent` ; récapitulatif `formatConsent()` |
| 8 | Synthèse fermée tant que non complet | Non appliqué | `stats.ready` conditionne l'ouverture de la synthèse |

**Point restant côté serveur :** le backend valide la **forme** des réponses (note 0-5 entière, commentaire non vide sur note > 0, format, consentement) mais **pas encore l'appartenance des identifiants à la grille** — la grille vit dans un fichier TypeScript front. Voir `ARCHITECTURE-BACKEND-MVP-V1.md` §6.

---

## 4. Constats majeurs (P1)

1. **Rôles incohérents entre deux sources.** `store.tsx:90` déclare `Role = 'client'|'admin'|'concierge'` (pas `expert`), alors que `/expert` existe comme espace. La session ajoutée introduit `expert` côté lib, le store reste inchangé : deux vérités à réconcilier.
2. **Inscription → onboarding → /app.** `inscription.tsx` n'écrivait aucune session : après un parcours d'inscription, `onboarding` vers `/app` tombait sur une garde et redirigeait. Correctif minimal : l'inscription de démonstration ouvre la session `usr-amina`/`org-amal` (documenté, à remplacer par un vrai flux).
3. **`store.tsx` n'est pas modifié.** Le rôle d'interface reste porté par le store démo ; c'est la session (`allneeds.session.v1`) qui décide des gardes. C'est volontaire : toucher au store démo aurait cassé les scripts de test existants. **Limite assumée** : les deux peuvent diverger.
4. **Le Rester connecté / Mot de passe oublié sont morts.** `connexion.tsx:100-102`, boutons sans `onClick`.
5. **Pas de `npm test` global.** 12 scripts de test coexistent (`test:saas`, `test:access`, `test:v16`, …) sans agrégateur ; `test:v19`, `test:v22`, `test:offers` n'étaient pas déclarés dans `package.json`.
6. **Pas de lint.** Aucun ESLint/Biome configuré : seule la passe `tsc --noEmit` fait foi.

---

## 5. Conflits et absences de sources

À trancher avec le commanditaire, **sans inventer de contenu** :

| Sujet | Constat | Traitement |
|---|---|---|
| Plaquettes commerciales | Absentes du dépôt ; seule trace : `UX-UI-ENSEIGNEMENT-V2.md:52` (CONNECT/PLUS/PRIORITÉ = 6/15/30 besoins, délais 5 j / 3 j / 48 h) | Non appliqué, non recopié. À fournir. |
| Grilles 360 Enseignement / Tourisme | Absentes. `reference/` ne contient que `Sante_grille_360_ALLNEEDS_v5_1.docx` | **Non inventé.** Le Diagnostic 360 implémenté est celui de la grille Santé v5.1. |
| Grille Santé v5.1 vs code V22 | La grille de référence et `diagnosticData.ts` doivent être réconciliées question par question | Contrôle automatique non réalisable (source `.docx`) — revue manuelle requise avant production |
| Texte juridique du consentement | Mention explicite dans `Diagnostic360.tsx` : « à faire valider par un conseil juridique » | Aucun texte rédigé ici. |
| Doublons de dépôt | Copies imbriquées et `ALLNEED-S-Sante\` | Ignorés ; racine seule source de vérité |

---

## 6. État de l'environnement (limites de vérification)

- **Shell Windows indisponible pendant toute la session** : `EPERM: operation not permitted, uv_spawn '…\powershell.EXE'` à chaque tentative (y compris `node -v`).
- Conséquence directe : **aucune commande n'a été exécutée** — pas de `npm install`, pas de `tsc --noEmit`, pas de `vite build`, pas de `node --test`, pas des scripts de test.
- Toute la vérification revient à l'utilisateur. Les commandes exactes sont listées dans `COMPTE-RENDU-MVP-V1.md` §4.
- Les conclusions de cet audit reposent sur la **lecture du code**, pas sur son exécution.

---

## 7. Synthèse des priorités

| Priorité | Sujet | Statut |
|---|---|---|
| P0 | Backend d'autorisation + isolation + sessions | Architecture livrée (`ARCHITECTURE-BACKEND-MVP-V1.md`) + squelette implémenté et testé (`server/`) |
| P0 | Gardes de route + matrice de permissions | **Fait** (`src/lib/permissions.ts`, `src/lib/session.ts`, 4 routes gardées) |
| P0 | Règles Diagnostic 360 v5.1 | **Fait** (`src/features/health360/scoring.ts` + `Diagnostic360.tsx`) |
| P1 | Réconcilier `Role` store/session (expert) | Non fait — signalé |
| P1 | Grille serveur : appartenance des identifiants à la grille | Non fait — signalé |
| P1 | Agrégateur de tests + lint | Scripts ajoutés, lint absent |
| P2 | Plaquettes commerciales, grilles Enseignement/Tourisme | Bloqué : sources absentes |
