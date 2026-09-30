# ALLNEEDS — Frontend de démonstration

Application React + Vite + TypeScript + Tailwind + TanStack Router en mode **frontend uniquement**. L’état est partagé entre l’espace client (`/app/*`) et l’espace administration (`/admin/*`) via un **store React Context + reducer + persistance `localStorage`** (`allneeds.demo.v2`). Toutes les données affichées sont fictives.

## Stack

- [React 18](https://react.dev/) + [Vite 6](https://vitejs.dev/)
- [TypeScript strict](https://www.typescriptlang.org/)
- [Tailwind CSS 3.4](https://tailwindcss.com/)
- [TanStack Router 1.95](https://tanstack.com/router/latest) (avec génération automatique de routes)

## Installation

```bash
npm install
```

## Développement

```bash
npm run dev
```

L’application est disponible sur [http://localhost:5173](http://localhost:5173).

## Build & vérification de types

```bash
npm run build
npm run typecheck
```

## Identité, contenu et démonstration

- Langue : **français uniquement**.
- Les mentions légales, coordonnées et références restent volontairement entre crochets `[à compléter]`.
- Jeu de données de démonstration complet et cohérent entre client et admin (`src/data/demo.ts`).
- Bascule de rôle : en haut à droite de l’application, passer de `Client` à `Admin` pour voir les deux espaces. Les actions effectuées dans l’un sont immédiatement visibles dans l’autre.
- Réinitialisation : dans le menu latéral (espace client ou admin), le bouton « Réinitialiser » remet le jeu de démonstration à son état initial (dans `localStorage`).

## Structure des routes

- Site public : `/`, `/secteurs`, `/secteurs/$sector` (enseignement/santé/tourisme), `/missions`, `/missions/$code`, `/acces`, `/tarifs`, `/demande`, `/diagnostic`, `/faq`, `/contact`, `/a-propos`, `/conditions`
- Authentification : `/connexion`, `/inscription`, `/onboarding`
- Espace client : `/app` (tableau de bord, besoins, prestataires, devis, diagnostics, missions, livrables, rendez-vous, messages, documents, abonnement)
- Administration : `/admin` (vue d’ensemble, pipeline, clients, qualification, diagnostics internes, besoins, prestataires, missions, quotas & abonnements, relances)

## Partage des données (principe)

Le store (`src/store/store.tsx`) contient l’ensemble de l’état (besoins, prestataires, devis, diagnostics, missions, jalons, livrables, rendez-vous, messages, documents, leads, demandes entrantes, réservations). Toute action admin (proposer un prestataire, saisir un devis, publier un diagnostic, avancer un jalon…) modifie le **même état** que celui consulté par le client. Cela garantit la cohérence de la démonstration.

## Points d’attention

- Les liens dynamiques vers les secteurs utilisent le paramètre `$sector` (`/secteurs/$sector`) avec route dédiée.
- Le typage TanStack Router est strict (liens typés via `LinkProps['to']`).
- Pas de backend : tout est persistant uniquement dans le navigateur pour la démo.
- Aucune donnée sensible n’est utilisée (données fictives).

## Licence & usage

Ce dépôt est fourni à titre de maquette de démonstration. Les contenus sont adaptables selon vos besoins.
