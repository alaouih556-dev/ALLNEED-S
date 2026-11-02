/* ------------------------------------------------------------------ */
/* Questionnaire Diagnostic Santé — 5 axes × 5 questions = 25 questions */
/* Contenu repris de la grille 360 Santé (questions validées, sens et   */
/* ordre conservés). Aucun contenu inventé : chaque question estissue   */
/* du référentiel santé existant.                                     */
/* ------------------------------------------------------------------ */

export type SanteAxe = {
  id: number
  title: string
  subtitle: string
}

export type SanteQuestionType = 'Interne' | 'Opportunité' | 'Menace'

export type SanteQuestion = {
  id: string            // 1A1 … 5A5
  axe: number           // 1 … 5
  title: string
  question: string
  relance: string
  niveaux: string[]     // 5 niveaux (1 = … 5 = …)
  type: SanteQuestionType
  weight?: number       // poids des internes (priorité)
  enjeu?: number        // enjeu des externes (écart pondéré)
  besoinAcces?: boolean // indique un besoin de prestataire ALLNEEDS Accès
}

export const SANTE_AXES: SanteAxe[] = [
  {
    id: 1,
    title: 'Patients et développement',
    subtitle: 'Comment vous trouvez, convertissez et gardez vos patients.',
  },
  {
    id: 2,
    title: 'Visibilité et confiance',
    subtitle: 'Comment vous êtes vus, choisis et recommandés.',
  },
  {
    id: 3,
    title: 'Équipe et organisation',
    subtitle: 'Comment l’équipe est organisée, outillée et fidélisée.',
  },
  {
    id: 4,
    title: 'Charges et équipements',
    subtitle: 'Ce que coûte l’activité et ce qu’elle rapporte.',
  },
  {
    id: 5,
    title: 'Accompagnement et financement',
    subtitle: 'Les aides, programmes de financement et pilotage financier.',
  },
]

const NIVEAUX = (labels: [string, string, string, string, string]): string[] => labels

function axeOf(id: string): number {
  return Number(id[0])
}

export const SANTE_QUESTIONS: SanteQuestion[] = [
  /* --------------------- AXE 1 — Patients et développement --------------------- */
  {
    id: '1A1',
    axe: 1,
    title: 'Objectif de nouveaux patients',
    question: 'Quel objectif mensuel de nouveaux patients avez-vous fixé par prestation, et quel est le taux d’occupation de votre agenda ?',
    relance: 'Qui le connaît dans l’équipe ? Quand l’avez-vous ajusté pour la dernière fois ?',
    niveaux: NIVEAUX([
      'Aucun objectif, aucun chiffre en tête',
      'Objectif oral, jamais comparé au réel',
      'Objectif écrit, comparé au réel de temps en temps',
      'Objectif écrit, comparé au réel chaque mois, équipe informée',
      'Objectif par prestation, suivi chaque semaine, écart analysé, action corrective datée',
    ]),
    type: 'Interne',
    weight: 3,
  },
  {
    id: '1A2',
    axe: 1,
    title: 'Délai de réponse',
    question: 'Quelle part des appels de prise de rendez-vous est décrochée, et en combien de temps rappelez-vous un appel manqué ?',
    relance: 'Combien d’appels manqués hier ? Que dit votre répondeur ?',
    niveaux: NIVEAUX([
      'Plus de 3 appels sur 10 manqués, aucun rappel',
      'Appels manqués fréquents, rappel dans les 24 h quand c’est possible',
      'Peu d’appels manqués, rappel dans la journée',
      'Moins de 1 appel sur 10 manqué, rappel sous 2 h, messagerie claire',
      'Appels manqués comptés, rappel sous 30 min, prise de rendez-vous en ligne 24 h/24',
    ]),
    type: 'Interne',
    weight: 3,
  },
  {
    id: '1A3',
    axe: 1,
    title: 'Transformation',
    question: 'Sur 10 demandes de rendez-vous, combien se transforment en rendez-vous ? Pour les autres, savez-vous pourquoi ?',
    relance: 'Qui rappelle les demandes restées sans suite, et sous quel délai ?',
    niveaux: NIVEAUX([
      'Jamais compté, demandes perdues sans suite',
      'Estimation vague, causes des pertes inconnues',
      'Taux connu à peu près, causes devinées',
      'Taux mesuré chaque mois, causes des pertes notées',
      'Taux mesuré par prestation, objectif fixé, causes traitées, taux en hausse sur 6 mois',
    ]),
    type: 'Interne',
    weight: 3,
  },
  {
    id: '1A4',
    axe: 1,
    title: 'Relance et fidélisation',
    question: 'Rappelez-vous les rendez-vous à vos patients (SMS, appel), et quel est votre taux de rendez-vous non honorés ?',
    relance: 'Combien de créneaux perdus la semaine dernière ? Avez-vous une liste d’attente ?',
    niveaux: NIVEAUX([
      'Aucun rappel, rendez-vous non honorés jamais comptés',
      'Rappel occasionnel, taux inconnu',
      'Rappel pour certains patients, taux estimé',
      'Rappel systématique, taux mesuré chaque mois',
      'Rappel systématique, taux en baisse constante, liste d’attente active',
    ]),
    type: 'Interne',
    weight: 2,
  },
  {
    id: '1A5',
    axe: 1,
    title: 'Demande non servie',
    question: 'Quelle prestation, quel horaire ou quelle spécialité vos patients demandent-ils régulièrement sans que vous les proposiez ?',
    relance: 'Quelle demande revient le plus souvent ? Que faudrait-il pour la servir ?',
    niveaux: NIVEAUX([
      'Aucune idée',
      'Soupçon, sans chiffre',
      'Demande identifiée et chiffrée, rien de lancé',
      'Demande identifiée, test lancé avec objectif',
      'Demande exploitée, résultats mesurés',
    ]),
    type: 'Opportunité',
    enjeu: 3,
  },
  /* --------------------- AXE 2 — Visibilité et confiance --------------------- */
  {
    id: '2A1',
    axe: 2,
    title: 'Fiche Google',
    question: 'Ouvrons votre fiche Google : est-elle revendiquée, complète (horaires, téléphone, catégorie, photos, lien de prise de rendez-vous) et à jour ?',
    relance: 'Les horaires des jours fériés sont-ils justes ? Qui gère la fiche ?',
    niveaux: NIVEAUX([
      'Absente, non revendiquée, ou informations fausses',
      'Revendiquée, informations incomplètes',
      'Complète : horaires, téléphone, catégorie, photos',
      'Complète, photos de moins de 6 mois, lien d’action actif',
      'Complète, publication au moins mensuelle, questions et avis traités sous 48 h',
    ]),
    type: 'Interne',
    weight: 3,
  },
  {
    id: '2A2',
    axe: 2,
    title: 'Site internet',
    question: 'Depuis un téléphone, combien de clics et de minutes faut-il à un visiteur pour prendre rendez-vous sur votre site ?',
    relance: 'Faisons le test en séance. Combien de visites par mois, et combien de demandes en ligne ?',
    niveaux: NIVEAUX([
      'Pas de site',
      'Site ancien ou illisible sur mobile',
      'Site à jour et lisible sur mobile, aucune action en ligne',
      'Action en ligne possible en moins de 5 clics',
      'Action en ligne complète, visites et conversions suivies chaque mois',
    ]),
    type: 'Interne',
    weight: 3,
  },
  {
    id: '2A3',
    axe: 2,
    title: 'Avis en ligne',
    question: 'Combien d’avis en ligne avez-vous, avec quelle note, et à quel pourcentage répondez-vous ? Comment en obtenez-vous de nouveaux ?',
    relance: 'Comment gérez-vous les avis, dans le respect des règles de votre profession ?',
    niveaux: NIVEAUX([
      'Moins de 10 avis, ou note sous 3,5',
      '10 à 30 avis, aucune réponse',
      '30 à 60 avis, note de 4 ou plus, réponses rares',
      'Plus de 60 avis, note de 4,3 ou plus, réponse à la plupart',
      'Plus de 100 avis, note de 4,5 ou plus, réponse à tous, demande d’avis systématique',
    ]),
    type: 'Interne',
    weight: 3,
  },
  {
    id: '2A4',
    axe: 2,
    title: 'Message clé',
    question: 'En une phrase, pourquoi vous choisit-on plutôt qu’un concurrent proche ? Qu’en diraient 3 de vos patients ?',
    relance: 'Cette phrase figure-t-elle sur votre site et sur votre fiche Google ?',
    niveaux: NIVEAUX([
      'Aucun message clair',
      'Message générique (qualité, sérieux, proximité)',
      'Message clair, non repris partout',
      'Message clair, repris sur le site, la fiche Google et les supports',
      'Message différenciant, vérifié auprès d’au moins 5 patients, repris partout',
    ]),
    type: 'Interne',
    weight: 2,
  },
  {
    id: '2A5',
    axe: 2,
    title: 'Visibilité concurrente',
    question: 'Pour la même recherche Google, votre concurrent le plus proche apparaît-il avant vous, et avec combien d’avis de plus ou de moins ?',
    relance: 'Quel concurrent a récemment refait son site ou ses photos ?',
    niveaux: NIVEAUX([
      'Très largement plus visible',
      'Nettement plus visible',
      'À peu près égal',
      'Vous êtes devant',
      'Vous êtes la référence locale',
    ]),
    type: 'Menace',
    enjeu: 3,
  },
  /* --------------------- AXE 3 — Équipe et organisation --------------------- */
  {
    id: '3A1',
    axe: 3,
    title: 'Rôles',
    question: 'Si vous êtes absent une semaine, qui décide quoi ? Chacun sait-il de quoi il est responsable ?',
    relance: 'Dernière absence du dirigeant : qu’est-ce qui a bloqué ?',
    niveaux: NIVEAUX([
      'Tout remonte au dirigeant',
      'Rôles flous, doublons fréquents',
      'Rôles connus oralement',
      'Rôles écrits, remplaçant identifié pour les postes clés',
      'Rôles écrits, remplaçants formés, une semaine d’absence du dirigeant sans blocage',
    ]),
    type: 'Interne',
    weight: 2,
  },
  {
    id: '3A2',
    axe: 3,
    title: 'Fiches de poste',
    question: 'Pour quels postes existe-t-il une fiche de poste écrite, et quand a-t-elle été mise à jour ?',
    relance: 'Le titulaire du poste l’a-t-elle lue ? Contient-elle des objectifs ?',
    niveaux: NIVEAUX([
      'Aucune',
      'Pour un ou deux postes',
      'Pour tous, mais anciennes',
      'Pour tous, à jour (moins d’un an)',
      'À jour, avec objectifs et indicateurs, signées',
    ]),
    type: 'Interne',
    weight: 2,
  },
  {
    id: '3A3',
    axe: 3,
    title: 'Procédures',
    question: 'Parmi vos procédures clés (accueil, prise de rendez-vous, encaissement), lesquelles sont écrites, et sont-elles appliquées ?',
    relance: 'Montrez-moi la dernière version. Quand a-t-elle été relue ?',
    niveaux: NIVEAUX([
      'Aucune',
      'Quelques notes',
      'Principales écrites, peu appliquées',
      'Écrites et appliquées',
      'Écrites, appliquées, vérifiées et mises à jour',
    ]),
    type: 'Interne',
    weight: 3,
  },
  {
    id: '3A4',
    axe: 3,
    title: 'Outils de travail',
    question: 'Pour traiter un rendez-vous, de la demande à l’encaissement, combien de fois la même information est-elle saisie ou recopiée ?',
    relance: 'Quel outil vous fait perdre le plus de temps ? Que paye-t-on sans l’utiliser ?',
    niveaux: NIVEAUX([
      'Papier ou tableurs dispersés',
      'Outils présents, information ressaisie à chaque étape',
      'Outils présents, ressaisie sur 1 ou 2 étapes',
      'Outils utilisés par tous, ressaisie rare',
      'Outils intégrés, aucune ressaisie, coût maîtrisé, équipe formée',
    ]),
    type: 'Interne',
    weight: 3,
    besoinAcces: true,
  },
  {
    id: '3A5',
    axe: 3,
    title: 'Stabilité de l’équipe',
    question: 'Combien de collaborateurs sont partis ces 24 derniers mois, et savez-vous pourquoi ?',
    relance: 'Faites-vous un entretien annuel ? Existe-t-il un plan de formation ?',
    niveaux: NIVEAUX([
      'Plus d’un tiers de l’équipe est parti en 2 ans',
      'Environ un quart est parti',
      'Un salarié sur dix est parti',
      'Aucun départ en 2 ans',
      'Aucun départ, entretien annuel et plan de formation',
    ]),
    type: 'Interne',
    weight: 2,
  },
  /* --------------------- AXE 4 — Charges et équipements --------------------- */
  {
    id: '4A1',
    axe: 4,
    title: 'Plus grosses charges',
    question: 'Citez vos 5 plus grosses charges hors salaires, avec leur montant annuel.',
    relance: 'Quelle charge a le plus augmenté en 2 ans ? Avez-vous les factures sous la main ?',
    niveaux: NIVEAUX([
      'Non',
      'Vaguement',
      'Oui, montants approximatifs',
      'Oui, montants annuels exacts',
      'Oui, suivies chaque mois avec un budget',
    ]),
    type: 'Interne',
    weight: 3,
    besoinAcces: true,
  },
  {
    id: '4A2',
    axe: 4,
    title: 'Échéances des contrats',
    question: 'Pour chacun de vos contrats principaux, connaissez-vous la date de renouvellement et la date limite de préavis ?',
    relance: 'Quel contrat se renouvelle dans les 12 prochains mois ?',
    niveaux: NIVEAUX([
      'Aucune',
      'Quelques-unes',
      'La plupart, non suivies',
      'Toutes, listées',
      'Calendrier avec rappel 3 mois avant le préavis',
    ]),
    type: 'Interne',
    weight: 3,
    besoinAcces: true,
  },
  {
    id: '4A3',
    axe: 4,
    title: 'Dernière comparaison',
    question: 'Quand avez-vous mis en concurrence au moins 2 fournisseurs pour la dernière fois, et quelle économie en est sortie ?',
    relance: 'Sur quel poste n’avez-vous jamais comparé ?',
    niveaux: NIVEAUX([
      'Jamais',
      'Il y a plus de 3 ans',
      'Il y a 2 à 3 ans',
      'Il y a 1 à 2 ans',
      'Il y a moins d’un an, économie chiffrée',
    ]),
    type: 'Interne',
    weight: 3,
    besoinAcces: true,
  },
  {
    id: '4A4',
    axe: 4,
    title: 'Trésorerie',
    question: 'Quel est votre solde de trésorerie prévu dans 3 mois, et comment le savez-vous ?',
    relance: 'Quel mois est le plus tendu ? Quel est votre seuil de rentabilité mensuel ?',
    niveaux: NIVEAUX([
      'Non, je regarde le solde de la banque',
      'Bilan annuel seulement',
      'Suivi irrégulier',
      'Tableau mensuel',
      'Tableau mensuel, prévision à 3-6 mois, seuil de rentabilité connu',
    ]),
    type: 'Interne',
    weight: 3,
  },
  {
    id: '4A5',
    axe: 4,
    title: 'Matériel et maintenance',
    question: 'Avez-vous un plan d’entretien et d’investissement budgété sur 12 mois ? La dernière panne coûteuse était-elle prévisible ?',
    relance: 'Quel équipement vous inquiète le plus ?',
    niveaux: NIVEAUX([
      'Aucun, pannes subies',
      'Besoins connus, aucun budget',
      'Liste des besoins, budget partiel',
      'Plan budgété',
      'Plan budgété, maintenance préventive planifiée',
    ]),
    type: 'Interne',
    weight: 2,
  },
  /* --------------------- AXE 5 — Accompagnement et financement --------------------- */
  {
    id: '5A1',
    axe: 5,
    title: 'Marge par prestation',
    question: 'Quels sont le coût et la marge par prestation, et quelle activité vous coûte plus qu’elle ne rapporte ?',
    relance: 'Quelle prestation rapporte le plus de marge ? Laquelle est déficitaire ?',
    niveaux: NIVEAUX([
      'Non',
      'Marge globale seulement',
      'Marge connue pour l’activité principale',
      'Marge connue pour la plupart',
      'Marge par prestation suivie chaque trimestre',
    ]),
    type: 'Interne',
    weight: 3,
  },
  {
    id: '5A2',
    axe: 5,
    title: 'Seuil de rentabilité',
    question: 'Connaissez-vous votre seuil de rentabilité mensuel, et votre solde de trésorerie prévu dans 3 mois ?',
    relance: 'Quel mois est le plus tendu ?',
    niveaux: NIVEAUX([
      'Non',
      'Bilan annuel seulement',
      'Suivi irrégulier',
      'Tableau mensuel',
      'Tableau mensuel, prévision à 3-6 mois, seuil de rentabilité connu',
    ]),
    type: 'Interne',
    weight: 3,
  },
  {
    id: '5A3',
    axe: 5,
    title: 'Plan d’investissement',
    question: 'Avez-vous un plan d’entretien et d’investissement budgété sur 12 mois pour votre matériel et vos équipements ?',
    relance: 'Quel équipement vous inquiète le plus ?',
    niveaux: NIVEAUX([
      'Aucun, pannes subies',
      'Besoins connus, aucun budget',
      'Liste des besoins, budget partiel',
      'Plan budgété',
      'Plan budgété, maintenance préventive planifiée',
    ]),
    type: 'Interne',
    weight: 2,
    besoinAcces: true,
  },
  {
    id: '5A4',
    axe: 5,
    title: 'Partenaires financiers',
    question: 'Avec quels partenaires financiers (banque, expert-comptable, centrales d’achat) travaillez-vous, et quelles conditions avez-vous négociées, quand ?',
    relance: 'Quand avez-vous revu vos conditions bancaires pour la dernière fois ?',
    niveaux: NIVEAUX([
      'Conditions subies',
      'Conditions correctes, jamais négociées',
      'Comparées une fois',
      'Négociées',
      'Négociées chaque année, avec conseils de pilotage',
    ]),
    type: 'Interne',
    weight: 2,
  },
  {
    id: '5A5',
    axe: 5,
    title: 'Accompagnement et financement',
    question: 'Avez-vous identifié des aides ou programmes de financement pour vos projets d’équipement ou de développement dans les 12 mois ?',
    relance: 'Quel projet nécessiterait un financement ? Avez-vous déjà sollicité un partenaire ?',
    niveaux: NIVEAUX([
      'Aucune idée',
      'Un projet identifié, aucun financement',
      'Quelques pistes, non démarchées',
      'Un ou plusieurs dossiers instruits',
      'Financement obtenu ou en cours, suivi assuré',
    ]),
    type: 'Opportunité',
    enjeu: 2,
  },
]

/* ------------------------------------------------------------------ */
/* Aides utiles au questionnaire                                      */
/* ------------------------------------------------------------------ */

export function santeQuestionsByAxe(axeId: number): SanteQuestion[] {
  return SANTE_QUESTIONS.filter((q) => q.axe === axeId)
}

export function santeAxeTitle(axeId: number): string {
  return SANTE_AXES.find((a) => a.id === axeId)?.title || `Axe ${axeId}`
}

export type SanteAnswer = { score: number; comment: string } // 0 = non renseigné / non évalué
export type SanteAnswers = Record<string, SanteAnswer>

export interface SanteScoreResult {
  q: SanteQuestion
  score: number
}

/* Synthèse automatique proposée au concierge (à compléter/valider avant publication). */
export function computeSanteSynthese(answers: SanteAnswers) {
  const scored = SANTE_QUESTIONS.map((q) => {
    const score = answers[q.id]?.score ?? 0
    return { q, score }
  }).filter((x) => x.score > 0)

  const internes = scored.filter((x) => x.q.type === 'Interne')
  const externes = scored.filter((x) => x.q.type !== 'Interne')

  const forces = [...internes]
    .filter((x) => x.score >= 4)
    .sort((a, b) => b.score - a.score || ((b.q.weight ?? 0) - (a.q.weight ?? 0)))
    .slice(0, 3)

  const faiblesses = [...internes]
    .filter((x) => x.score <= 2)
    .sort((a, b) => a.score - b.score || ((b.q.weight ?? 0) - (a.q.weight ?? 0)))
    .slice(0, 3)

  const priorites = [...internes]
    .map((x) => ({ ...x, priority: (5 - x.score) * (x.q.weight ?? 0) }))
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 3)

  const opportunites = [...externes]
    .filter((x) => x.q.type === 'Opportunité' && x.score <= 3)
    .map((x) => ({ ...x, gap: (5 - x.score) * (x.q.enjeu ?? 0) }))
    .sort((a, b) => b.gap - a.gap)
    .slice(0, 3)

  const menaces = [...externes]
    .filter((x) => x.q.type === 'Menace' && x.score <= 3)
    .map((x) => ({ ...x, gap: (5 - x.score) * (x.q.enjeu ?? 0) }))
    .sort((a, b) => b.gap - a.gap)
    .slice(0, 3)

  const total = scored.length
  const moyenne = total ? Math.round((scored.reduce((s, x) => s + x.score, 0) / (total * 5)) * 100) : 0

  return { forces, faiblesses, priorites, opportunites, menaces, total, moyenne }
}

export function santeLabel(score: number | null): string {
  if (score === null || score === 0) return 'Non renseignée'
  return `${score} / 5`
}
