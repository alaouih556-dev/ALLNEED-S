import type { SectorSlug } from "@/lib/sectors"

/** Textes des pages secteur. Le français est la source ; l'anglais est dans `src/i18n/en.json`. */
export type SectorPageCopy = {
  subtitle: string
  description: string
  question: string
  signal: string
  headline: string
  tension: string
  symptoms: string[]
  guardrail: string
  faq: { q: string; a: string }[]
}

/** Paires FR/EN des secteurs ajoutés, contrôlées par `npm run test:sectors`. */
export const SECTOR_PAGE_TRANSLATIONS: [string, string][] = []
const tr = (fr: string, en: string) => {
  SECTOR_PAGE_TRANSLATIONS.push([fr, en])
  return fr
}

const EXISTING_PAGES: Record<'sante' | 'enseignement-prive' | 'tourisme-hotellerie-restauration', SectorPageCopy> = {
  "sante": {
    "subtitle": "Cabinets, centres de santé et laboratoires",
    "description": "Parcours patient, visibilité informative, équipe et charges : diagnostic, structuration et accompagnement 30 jours pour les cabinets, centres de santé et laboratoires.",
    "question": "Comment libérer du temps et rendre le parcours plus lisible ?",
    "signal": "L’accueil jongle entre appels, rendez-vous, annulations et demandes de patients.",
    "headline": "Quand l’accueil et l’organisation prennent le temps du soin.",
    "tension": "Appels, rendez-vous, annulations et imprévus sollicitent l’équipe toute la journée. Un regard extérieur aide à distinguer les irritants quotidiens des vrais leviers d’organisation.",
    "symptoms": [
      "Des créneaux qui restent vides malgré les demandes.",
      "Des annulations et relances difficiles à suivre.",
      "Des rôles d’accueil et d’administration qui se chevauchent."
    ],
    "guardrail": "Le diagnostic porte sur l’organisation et l’administratif. Il ne concerne pas l’acte médical et ne nécessite aucun dossier patient nominatif.",
    "faq": [
      {
        "q": "Avez-vous besoin des dossiers patients ?",
        "a": "Non. Nous travaillons à partir d’éléments d’organisation et de volumes, sans donnée patient nominative."
      },
      {
        "q": "Intervenez-vous sur les soins ?",
        "a": "Non. Le diagnostic concerne l’organisation, l’accueil et les besoins opérationnels."
      },
      {
        "q": "Que vais-je obtenir ?",
        "a": "Une synthèse des constats et trois priorités recommandées pour votre structure."
      }
    ]
  },
  "enseignement-prive": {
    "subtitle": "Écoles privées, crèches et centres de formation",
    "description": "Inscriptions, image, équipe et charges : diagnostic, structuration et accompagnement 30 jours pour les écoles privées, crèches et centres de formation.",
    "question": "Comment mieux suivre chaque famille jusqu’à sa décision ?",
    "signal": "Les demandes d’inscription se perdent entre les appels, les messages et les visites.",
    "headline": "Quand les familles attendent une réponse et que tout remonte à la direction.",
    "tension": "Admissions, relances, rentrée : les sujets s’enchaînent et reposent souvent sur les mêmes personnes. Il devient difficile de savoir quelle action débloquera vraiment la situation.",
    "symptoms": [
      "Des demandes d’information suivies dans plusieurs outils.",
      "Des relances faites au dernier moment.",
      "Des rôles et consignes qui manquent de clarté pour l’équipe."
    ],
    "guardrail": "Nous parlons d’organisation, d’admissions et d’échanges avec les familles, pas de pédagogie. Les données nominatives d’élèves restent dans votre établissement.",
    "faq": [
      {
        "q": "Le diagnostic porte-t-il sur la pédagogie ?",
        "a": "Non. Il concerne l’organisation, les admissions, les échanges avec les familles, les outils et les besoins opérationnels."
      },
      {
        "q": "Faut-il transmettre des données d’élèves ?",
        "a": "Non. Les processus peuvent être examinés sans recevoir de données nominatives."
      },
      {
        "q": "Que vais-je obtenir ?",
        "a": "Une synthèse de la situation, les points d’appui et de blocage, puis trois priorités recommandées."
      }
    ]
  },
  "tourisme-hotellerie-restauration": {
    "subtitle": "Riads, maisons d’hôtes, hôtels et restaurants",
    "description": "Réservations directes, image, équipe et charges : diagnostic, structuration et accompagnement 30 jours pour les riads, maisons d’hôtes, hôtels et restaurants.",
    "question": "Comment mieux organiser les réservations et préparer la saison ?",
    "signal": "Les demandes arrivent par plusieurs canaux, avec des pics d’activité difficiles à absorber.",
    "headline": "Quand les réservations et les messages se croisent au cœur de la saison.",
    "tension": "Les demandes arrivent sur plusieurs canaux, les réponses s’accumulent et les périodes fortes approchent. Avant d’ajouter un outil, il faut voir où les occasions se perdent.",
    "symptoms": [
      "Des demandes dispersées entre plusieurs canaux.",
      "Des réponses et relances difficiles à coordonner.",
      "Une haute saison qui approche sans plan partagé."
    ],
    "guardrail": "Le diagnostic part de vos canaux, de votre saisonnalité et de vos outils actuels. Il n’impose pas le remplacement de votre système de réservation.",
    "faq": [
      {
        "q": "Devez-vous changer mon outil de réservation ?",
        "a": "Non. Le premier échange commence par vos outils et vos habitudes actuels."
      },
      {
        "q": "Cela concerne-t-il la restauration et les expériences ?",
        "a": "Oui. Les questions sont adaptées à votre activité touristique."
      },
      {
        "q": "Que vais-je obtenir ?",
        "a": "Une synthèse des points de friction et trois priorités recommandées."
      }
    ]
  }
}

const NEW_PAGES: Record<'commerce-distribution' | 'industrie-production' | 'btp-immobilier' | 'services-artisanat', SectorPageCopy> = {
  'commerce-distribution': {
    subtitle: tr('Boutiques, réseaux de vente et distributeurs', 'Stores, retail networks and distributors'),
    description: tr('Clientèle, stock, équipe et charges : un diagnostic offert et un accompagnement pour les boutiques, réseaux de points de vente, grossistes et distributeurs.', 'Customers, stock, team and costs: a free diagnostic and support for stores, retail networks, wholesalers and distributors.'),
    question: tr('Comment vendre mieux sans perdre le contrôle du stock et des marges ?', 'How can you sell better without losing control of stock and margins?'),
    signal: tr('Les ventes, le stock et les commandes se suivent dans des outils différents.', 'Sales, stock and orders are tracked in different tools.'),
    headline: tr('Quand le stock, la caisse et les clients réclament tous votre attention.', 'When stock, tills and customers all demand your attention.'),
    tension: tr('Réassorts, promotions, équipes et encaissements se croisent chaque jour. Un regard extérieur aide à voir ce qui pèse vraiment sur vos ventes et vos marges.', 'Restocking, promotions, teams and payments collide every day. An outside view helps you see what really weighs on your sales and margins.'),
    symptoms: [
      tr('Des ruptures ou des surstocks repérés trop tard.', 'Stock-outs or overstock spotted too late.'),
      tr('Des marges difficiles à lire par produit ou par point de vente.', 'Margins that are hard to read by product or outlet.'),
      tr('Des clients qui reviennent moins, sans savoir pourquoi.', 'Customers returning less often, without knowing why.'),
    ],
    guardrail: tr('Le diagnostic part de vos ventes, de vos outils et de votre organisation. Il n’impose pas de changer de caisse ou de logiciel et ne nécessite aucune donnée nominative de client.', 'The diagnostic starts from your sales, tools and organisation. It does not require changing your till or software and needs no personal customer data.'),
    faq: [
      { q: tr('Devons-nous changer de logiciel de caisse ?', 'Do we need to change our till software?'), a: tr('Non. Le premier échange part de vos outils et de vos habitudes actuels.', 'No. The first conversation starts from your current tools and habits.') },
      { q: tr('Avez-vous besoin de notre fichier clients ?', 'Do you need our customer file?'), a: tr('Non. Nous travaillons à partir d’éléments d’organisation et de chiffres globaux.', 'No. We work from organisational information and overall figures.') },
    ],
  },
  'industrie-production': {
    subtitle: tr('Ateliers, usines et agroalimentaire', 'Workshops, factories and food processing'),
    description: tr('Production, délais, équipe et charges : un diagnostic offert et un accompagnement pour les ateliers, PME industrielles, usines et entreprises agroalimentaires.', 'Production, lead times, team and costs: a free diagnostic and support for workshops, industrial SMEs, factories and food processors.'),
    question: tr('Comment tenir vos délais sans multiplier les urgences en production ?', 'How can you meet lead times without constant production emergencies?'),
    signal: tr('Les commandes, la production et les achats avancent sans vision commune.', 'Orders, production and purchasing move forward without a shared view.'),
    headline: tr('Quand les urgences de production prennent le pas sur le pilotage.', 'When production emergencies take over from management.'),
    tension: tr('Commandes, pannes, approvisionnements et plannings changent vite. Prendre du recul aide à distinguer ce qui ralentit vraiment votre activité.', 'Orders, breakdowns, supplies and schedules change quickly. Stepping back helps you identify what is really slowing your business.'),
    symptoms: [
      tr('Des retards découverts au dernier moment.', 'Delays discovered at the last minute.'),
      tr('Des coûts de production difficiles à suivre.', 'Production costs that are hard to track.'),
      tr('Des décisions qui remontent toujours aux mêmes personnes.', 'Decisions that always land on the same people.'),
    ],
    guardrail: tr('Nous parlons d’organisation, de flux et de pilotage. Le diagnostic ne remplace ni un audit réglementaire, ni une expertise technique, sécurité ou qualité.', 'We focus on organisation, flows and management. The diagnostic does not replace a regulatory audit or technical, safety or quality expertise.'),
    faq: [
      { q: tr('Le diagnostic remplace-t-il un audit qualité ou sécurité ?', 'Does the diagnostic replace a quality or safety audit?'), a: tr('Non. Il porte sur l’organisation et les priorités de l’entreprise, pas sur la conformité technique.', 'No. It covers the company’s organisation and priorities, not technical compliance.') },
      { q: tr('Faut-il arrêter la production pendant l’échange ?', 'Do we need to stop production during the conversation?'), a: tr('Non. Le rendez-vous est planifié avec vous pour ne pas perturber l’activité.', 'No. The meeting is scheduled with you so it does not disrupt operations.') },
    ],
  },
  'btp-immobilier': {
    subtitle: tr('Entreprises de BTP, promoteurs, agences et syndics', 'Construction firms, developers, agencies and property managers'),
    description: tr('Chantiers, projets, équipe et trésorerie : un diagnostic offert et un accompagnement pour les entreprises de BTP, promoteurs, agences immobilières et syndics.', 'Sites, projects, team and cash flow: a free diagnostic and support for construction firms, developers, estate agencies and property managers.'),
    question: tr('Comment garder la maîtrise de vos projets, de vos délais et de votre trésorerie ?', 'How can you stay in control of your projects, deadlines and cash flow?'),
    signal: tr('Les chantiers, les relances et le suivi financier reposent sur quelques personnes.', 'Sites, follow-ups and financial tracking rest on a few people.'),
    headline: tr('Quand chaque projet avance, mais que la vue d’ensemble vous échappe.', 'When every project moves forward, but the big picture escapes you.'),
    tension: tr('Devis, sous-traitants, clients et échéances se superposent. Un regard extérieur aide à remettre de l’ordre dans ce qui compte pour vos marges et vos délais.', 'Quotes, subcontractors, clients and deadlines pile up. An outside view helps bring order to what matters for your margins and timelines.'),
    symptoms: [
      tr('Des devis et des relances suivis dans plusieurs outils.', 'Quotes and follow-ups tracked in several tools.'),
      tr('Une trésorerie difficile à anticiper d’un projet à l’autre.', 'Cash flow that is hard to anticipate from one project to the next.'),
      tr('Des informations qui se perdent entre le terrain et le bureau.', 'Information lost between the field and the office.'),
    ],
    guardrail: tr('Le diagnostic porte sur l’organisation, le suivi et la relation client. Il ne remplace ni un bureau d’études, ni un conseil juridique ou technique.', 'The diagnostic covers organisation, tracking and client relationships. It does not replace an engineering firm or legal or technical advice.'),
    faq: [
      { q: tr('Intervenez-vous sur les aspects techniques des chantiers ?', 'Do you work on the technical side of construction sites?'), a: tr('Non. Nous travaillons sur l’organisation, le suivi et les priorités de l’entreprise.', 'No. We work on the company’s organisation, tracking and priorities.') },
      { q: tr('Avez-vous besoin des données de nos locataires ou copropriétaires ?', 'Do you need our tenants’ or co-owners’ data?'), a: tr('Non. Aucune donnée nominative n’est nécessaire pour ce premier échange.', 'No. No personal data is needed for this first conversation.') },
    ],
  },
  'services-artisanat': {
    subtitle: tr('Sociétés de services, artisans et professions libérales', 'Service companies, craftspeople and independent professionals'),
    description: tr('Clients, organisation, équipe et charges : un diagnostic offert et un accompagnement pour les sociétés de services, artisans, ateliers et professions libérales.', 'Clients, organisation, team and costs: a free diagnostic and support for service companies, craftspeople, workshops and independent professionals.'),
    question: tr('Comment développer votre activité sans y passer toutes vos soirées ?', 'How can you grow your business without giving up all your evenings?'),
    signal: tr('La production, les clients et l’administratif reposent souvent sur le dirigeant.', 'Delivery, clients and admin often all rest on the owner.'),
    headline: tr('Quand vous faites tourner l’activité et tout le reste en même temps.', 'When you run the business and everything else at the same time.'),
    tension: tr('Prestations, devis, facturation et relances s’ajoutent à votre métier. Prendre du recul aide à choisir ce qui mérite votre temps en premier.', 'Services, quotes, invoicing and follow-ups come on top of your craft. Stepping back helps you choose what deserves your time first.'),
    symptoms: [
      tr('Des devis ou des relances envoyés trop tard.', 'Quotes or follow-ups sent too late.'),
      tr('Une activité qui dépend surtout du bouche-à-oreille.', 'A business that relies mostly on word of mouth.'),
      tr('Un temps administratif qui empiète sur votre métier.', 'Admin time that eats into your core work.'),
    ],
    guardrail: tr('Le diagnostic respecte votre savoir-faire et vos règles professionnelles. Il porte sur l’organisation et ne remplace pas un conseil juridique, fiscal ou comptable.', 'The diagnostic respects your expertise and professional rules. It covers organisation and does not replace legal, tax or accounting advice.'),
    faq: [
      { q: tr('Mon activité est petite : le diagnostic est-il utile ?', 'My business is small: is the diagnostic useful?'), a: tr('Oui. Il aide à choisir quelques priorités réalistes, adaptées à votre taille.', 'Yes. It helps you choose a few realistic priorities suited to your size.') },
      { q: tr('Avez-vous besoin de mes dossiers clients ?', 'Do you need my client files?'), a: tr('Non. Nous travaillons à partir d’éléments d’organisation, sans donnée nominative.', 'No. We work from organisational information, with no personal data.') },
    ],
  },
}

export const SECTOR_PAGES: Record<SectorSlug, SectorPageCopy> = { ...EXISTING_PAGES, ...NEW_PAGES }
