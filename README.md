# ALLNEEDS — frontend + diagnostic + espaces métier

Projet complet reconstitué depuis le ZIP de code fourni, avec les corrections TypeScript précédentes et les extensions SaaS. Le site public, le client et l'administration sont conservés. Les configurations de démarrage absentes de ce ZIP ont été recréées.

## Démarrage

Node.js 22.12 minimum (ou 24). Dans le dossier extrait :

```powershell
npm install
npm run typecheck
npm run test:saas
npm run build
npm run dev
```

Ouvrir l'adresse affichée par Vite. Utiliser le sélecteur client/admin existant.

- `/app/espace-metier` : espaces Santé, Éducation et Tourisme (sélecteur de secteur dans la démo).
- `/app/diagnostic-auto` : questionnaire par secteur, 4 axes et 28 questions des grilles existantes, brouillon, scores, priorités, impression/PDF via navigateur et export JSON.
- `/admin/diagnostics-auto` : avis de relecture partagé dans le même navigateur, restitué au client à la prochaine ouverture de son bilan.

## Fonctions ajoutées

Santé : fiches patients fictives, références de dossiers, rendez-vous par praticien, suivi administratif des visites, index d'archives, factures et règlements partiels.

Éducation : inscriptions et statuts, responsables légaux, groupes et enseignants, séances, présence, index documentaire et échéances de scolarité.

Tourisme : voyageurs, unités et prix/nuit, réservations de séjour avec contrôle dates/capacité/conflits, activités et créneaux, réservations d'activités avec capacité, tables et réservations restaurant, fournisseurs, factures et règlements.

Restauration : ingrédients avec unité/coût/stock/seuil, réceptions fournisseur, création de recettes avec quantités par portion, modification du prix de vente, coût ingrédients et marge ingrédients, vente des portions, diminution du stock, refus si stock insuffisant, historique des ventes avec coût figé au moment de la vente. La marge affichée ne comprend pas les charges, taxes, main-d'œuvre et pertes.

Les modules disposent de formulaires, recherche, modification/suppression et export JSON de l'espace. Les créneaux d'une ressource ne peuvent pas se chevaucher. Les dates de départ sont exclusives : arrivée le jour du départ précédent autorisée.

## Diagnostic

Autoévaluation déclarative 1–5. Les questions originales sont conservées : elles sont affichées avec une échelle de maîtrise, sans interpréter automatiquement leurs réponses factuelles. Le score d'un axe n'est affiché qu'une fois toutes ses questions évaluées. Pas de score global incomplet ; question vide != zéro. Priorités : jusqu'à trois questions renseignées avec les scores les plus faibles (<=3). Recommandations organisationnelles générales explicables, sans score commercial client ni prescription clinique.

## Limites de cette livraison frontend

Données fictives dans localStorage, séparées par identifiant d'organisation de démonstration et secteur. Ceci ne remplace pas l'isolation serveur ni une base de données sécurisée. Le store existant utilise une organisation de démonstration fixe. Les rôles sont des simulations, pas une authentification de production.

Les archives sont un index de métadonnées : pas de dépôt de documents médicaux. Les factures sont des registres administratifs de démo, sans numérotation fiscale, TVA ou génération comptable certifiée. Les règlements sont saisis manuellement : pas de transactions bancaires réelles. Les portails séparés patient/parent/voyageur, le backend, l'envoi de mails, les intégrations OTA/POS, les notifications automatiques et les abonnements SaaS payants ne sont pas implémentés.

Une activité est une fiche de créneau ; utilisez un nom unique par créneau. Les réservations utilisent les noms exacts des ressources existantes. Le catalogue ne doit pas être renommé après réservation sans mettre à jour les références. Les commandes restaurant représentent les ventes de portions ; pas encore de workflow cuisine multi-lignes, retours, annulations de stock ou ticket de caisse.

## Validation effectuée

- Génération des routes et TypeScript : réussies.
- Build de production : réussi (avertissement de taille du bundle).
- 12 contrôles métier : coûts, décrément de stock, refus stock insuffisant/quantité invalide, dates et chevauchements de réservation, capacités, règlement supérieur au dû.
- Vérification navigateur non exécutée : navigateur Playwright absent de l'environnement. Aucune validation visuelle ou de bout en bout prétendue.

Dépendances actualisées aux versions disponibles pour cette vérification : React 19, Vite 8, Tailwind 4. La configuration Tailwind existante est chargée via `@config` et le plugin Vite Tailwind. Code splitting TanStack désactivé pour éviter le problème de chemin Windows contenant une apostrophe.
