export type NeedId =
  | "assurance"
  | "fournisseurs"
  | "digital"
  | "formation"
  | "recrutement"
  | "financement"
  | "commercial"
  | "comptabilite";

export type Service = {
  id: NeedId;
  number: string;
  title: string;
  shortTitle: string;
  label?: string;
  headline: string;
  description: string;
  tags: string[];
  situations: string[];
  relatedPartners: string[];
  cta: string;
  formLabel: string;
};

export const SERVICES: Service[] = [
  {
    id: "assurance",
    number: "01",
    title: "Assurance",
    shortTitle: "Assurance",
    label: "Protection de l'entreprise",
    headline: "Protégez ce qui fait avancer votre entreprise.",
    description:
      "Identifiez les solutions de protection adaptées à votre activité, vos équipements, vos véhicules, vos équipes et vos risques professionnels.",
    tags: [
      "Assurance professionnelle",
      "Véhicules",
      "Locaux & équipements",
      "Responsabilité professionnelle",
    ],
    situations: [
      "Je souhaite assurer les véhicules de mon entreprise.",
      "Je veux protéger mes locaux ou mes équipements.",
      "Je souhaite étudier une couverture professionnelle.",
      "Je ne sais pas encore quelle couverture correspond à mon activité.",
    ],
    relatedPartners: ["rma", "fnacam"],
    cta: "Ajouter Assurance à mes besoins",
    formLabel: "Assurance",
  },
  {
    id: "fournisseurs",
    number: "02",
    title: "Fournisseurs",
    shortTitle: "Fournisseurs",
    headline: "Trouvez les fournisseurs adaptés à votre activité.",
    description:
      "Vous recherchez une matière première, un produit, un équipement ou une nouvelle alternative d'approvisionnement ? Présentez-nous votre besoin.",
    tags: [
      "Matières premières",
      "Produits",
      "Équipements",
      "Alternatives d'approvisionnement",
    ],
    situations: [
      "Je cherche un nouveau fournisseur.",
      "Je souhaite comparer des alternatives.",
      "Mon fournisseur actuel ne répond plus à mes besoins.",
      "Je recherche un produit ou une matière précise.",
    ],
    relatedPartners: [],
    cta: "Ajouter Fournisseurs à mes besoins",
    formLabel: "Fournisseurs",
  },
  {
    id: "digital",
    number: "03",
    title: "Communication & Digital",
    shortTitle: "Digital",
    headline: "Développez votre visibilité et vos outils digitaux.",
    description:
      "Renforcez l'image, la présence digitale et les outils professionnels de votre entreprise.",
    tags: [
      "Site internet",
      "Communication digitale",
      "Réseaux sociaux",
      "Solutions professionnelles",
    ],
    situations: [
      "Mon entreprise n'a pas de site.",
      "Je veux améliorer ma visibilité.",
      "Je souhaite moderniser mon image.",
      "J'ai besoin de solutions digitales ou télécom.",
    ],
    relatedPartners: ["orange"],
    cta: "Ajouter Digital à mes besoins",
    formLabel: "Communication & Digital",
  },
  {
    id: "formation",
    number: "04",
    title: "Formation",
    shortTitle: "Formation",
    headline: "Faites évoluer les compétences de vos équipes.",
    description:
      "Identifiez les formations et dispositifs adaptés aux objectifs de développement de votre entreprise.",
    tags: ["Commercial", "Management", "Digital", "Compétences professionnelles"],
    situations: [
      "Je souhaite former mon équipe.",
      "Mes collaborateurs ont besoin de nouvelles compétences.",
      "Je cherche une formation technique.",
      "Je souhaite comprendre les dispositifs disponibles.",
    ],
    relatedPartners: ["ofppt", "ain-chock", "ain-sebaa", "aref"],
    cta: "Ajouter Formation à mes besoins",
    formLabel: "Formation",
  },
  {
    id: "recrutement",
    number: "05",
    title: "Recrutement",
    shortTitle: "Recrutement",
    headline: "Renforcez votre équipe avec les bons profils.",
    description:
      "Structurez votre besoin et avancez vers les solutions adaptées pour renforcer votre équipe.",
    tags: ["Commercial", "Administratif", "Technique", "Compétences spécifiques"],
    situations: [
      "J'ai besoin de recruter.",
      "Mon activité se développe.",
      "Je recherche un profil spécifique.",
      "Je veux structurer mon besoin en recrutement.",
    ],
    relatedPartners: ["anapec"],
    cta: "Ajouter Recrutement à mes besoins",
    formLabel: "Recrutement",
  },
  {
    id: "financement",
    number: "06",
    title: "Financement & Aides",
    shortTitle: "Financement",
    headline: "Explorez les dispositifs adaptés à votre projet.",
    description:
      "Selon votre situation, différents programmes, accompagnements ou solutions financières peuvent être étudiés.",
    tags: ["Investissement", "Accompagnement", "Programmes", "Développement"],
    situations: [
      "Je cherche un accompagnement pour mon projet.",
      "Je souhaite explorer des dispositifs de soutien.",
      "Mon entreprise a un projet d'investissement.",
      "Je veux comprendre ce qui peut correspondre à ma situation.",
    ],
    relatedPartners: [
      "maroc-pme",
      "cri-casa",
      "bank-of-africa",
      "go-siyaha",
      "dar-al-moukawil",
      "fce-gbp",
    ],
    cta: "Ajouter Financement & Aides à mes besoins",
    formLabel: "Financement & Aides",
  },
  {
    id: "commercial",
    number: "07",
    title: "Accompagnement commercial",
    shortTitle: "Commercial",
    label: "Prospection & suivi des ventes",
    headline: "Transformez vos opportunités en clients.",
    description:
      "Structurez votre démarche commerciale, développez votre prospection et améliorez le traitement de vos opportunités jusqu’à la vente.",
    tags: [
      "Génération de leads",
      "Prospection",
      "Qualification des prospects",
      "Traitement des prospects",
      "Suivi commercial",
      "Relances",
      "Pipeline commercial",
      "Closing des ventes",
    ],
    situations: [
      "Je veux structurer ma prospection.",
      "Je dois organiser le suivi de mes opportunités.",
      "Je cherche à améliorer mes relances.",
      "Je mets en place un pipeline commercial.",
    ],
    relatedPartners: [],
    cta: "Ajouter à mes besoins",
    formLabel: "Accompagnement commercial",
  },
  {
    id: "comptabilite",
    number: "08",
    title: "Comptabilité & Gestion fiscale",
    shortTitle: "Comptabilité",
    label: "Tenue comptable & fiscalité",
    headline: "Structurez la gestion financière de votre activité.",
    description:
      "Identifiez l’accompagnement adapté pour organiser votre comptabilité, vos obligations déclaratives et la gestion fiscale de votre activité.",
    tags: [
      "Tenue comptable",
      "Organisation comptable",
      "Déclarations",
      "Obligations fiscales",
      "Suivi administratif",
      "Gestion fiscale",
      "Accompagnement comptable",
    ],
    situations: [
      "Je dois organiser la tenue comptable de mon activité.",
      "Je cherche à identifier mes obligations déclaratives.",
      "Je veux comprendre ma gestion fiscale.",
      "Je cherche un accompagnement comptable régulier.",
    ],
    relatedPartners: [],
    cta: "Ajouter à mes besoins",
    formLabel: "Comptabilité & Gestion fiscale",
  },
];

export const SERVICE_BY_ID = Object.fromEntries(
  SERVICES.map((service) => [service.id, service]),
) as Record<NeedId, Service>;

export const MAX_NEEDS = 8;

export const COMMON_NEEDS: Record<NeedId, string[]> = {
  assurance: ["Assurer les véhicules", "Protéger les locaux et équipements", "Responsabilité civile professionnelle", "Assurer les salariés"],
  fournisseurs: ["Trouver un fournisseur", "Comparer des devis", "Acheter des équipements", "Chercher des matières premières"],
  digital: ["Créer ou améliorer un site web", "Réseaux sociaux et publicité", "Identité visuelle", "Solutions télécom et outils digitaux"],
  formation: ["Former les salariés", "Formation commerciale", "Formation technique", "Management et digital"],
  recrutement: ["Recruter un commercial", "Recruter un profil administratif", "Recruter un profil technique", "Définir le profil recherché"],
  financement: ["Financer un investissement", "Trouver une aide ou un programme", "Préparer un dossier de financement", "Développer mon activité"],
  commercial: ["Trouver de nouveaux clients", "Qualifier et suivre les prospects", "Conclure davantage de ventes", "Structurer la prospection"],
  comptabilite: ["Tenue comptable", "Déclarations fiscales", "Facturation et suivi des paiements", "Tableaux de bord financiers"],
};
