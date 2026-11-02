import type { DiagnosticQuestion } from './diagnosticData';

/*
 * CINQUIÈME AXE — STRUCTURE TECHNIQUE, CONTENU À VALIDER.
 *
 * La grille 360 v5.1 fournit 4 axes (10 questions chacun, 7 internes + 3 externes).
 * Le parcours client cible 5 axes × 10 questions = 50 questions par secteur.
 * Le contenu métier du 5e axe n'étant pas encore validé, ce fichier ne contient
 * QUE des emplacements clairement marqués « Contenu à valider » :
 *   - aucune question n'est présentée comme validée ;
 *   - chaque question porte `pending: true` ;
 *   - les libellés restent neutres pour ne rien affirmer sur le métier.
 *
 * Pour activer l'axe 5 : remplacer ces emplacements par le contenu validé
 * (7 questions internes `5A*`, 3 questions externes `5B*`) puis retirer `pending`.
 */

export const AXE5_VOLET = {
  id: 5,
  title: 'AXE 5 · À DÉFINIR',
  subtitle: 'Cinquième axe du diagnostic — contenu à valider avec la grille métier.',
  pending: true,
} as const;

const LEVELS = [
  '[À valider] Niveau 1',
  '[À valider] Niveau 2',
  '[À valider] Niveau 3',
  '[À valider] Niveau 4',
  '[À valider] Niveau 5',
] as const;

function internalQuestion(n: number, title: string): DiagnosticQuestion {
  return {
    id: `5A${n}`,
    starred: false,
    internal: true,
    title: `Contenu à valider · ${title}`,
    question: `[Contenu à valider] Question interne ${n} du cinquième axe. À rédiger puis à valider avec la grille métier avant utilisation.`,
    relance: '[Contenu à valider] Relance de creusement à définir.',
    besoinAcces: false,
    levels: [...LEVELS],
    weight: 2,
    type: 'Interne',
    pending: true,
  };
}

function externalQuestion(n: number, title: string, type: 'Opportunité' | 'Menace'): DiagnosticQuestion {
  return {
    id: `5B${n}`,
    starred: false,
    internal: false,
    title: `Contenu à valider · ${title}`,
    question: `[Contenu à valider] Question externe ${n} du cinquième axe. À rédiger puis à valider avec la grille métier avant utilisation.`,
    relance: '[Contenu à valider] Relance de creusement à définir.',
    besoinAcces: false,
    levels: [...LEVELS],
    enjeu: 2,
    type,
    pending: true,
  };
}

export const AXE5_QUESTIONS: DiagnosticQuestion[] = [
  internalQuestion(1, 'Pilotage · thème 1'),
  internalQuestion(2, 'Pilotage · thème 2'),
  internalQuestion(3, 'Pilotage · thème 3'),
  internalQuestion(4, 'Pilotage · thème 4'),
  internalQuestion(5, 'Pilotage · thème 5'),
  internalQuestion(6, 'Pilotage · thème 6'),
  internalQuestion(7, 'Pilotage · thème 7'),
  externalQuestion(1, 'Environnement · opportunité', 'Opportunité'),
  externalQuestion(2, 'Environnement · menace 1', 'Menace'),
  externalQuestion(3, 'Environnement · menace 2', 'Menace'),
];
