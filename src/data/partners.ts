import type { NeedId } from "@/data/services";

export type PartnerCategory =
  | "institutions"
  | "entrepreneuriat"
  | "emploi"
  | "finance"
  | "assurance"
  | "digital"
  | "enseignement"
  | "reseaux";

export type Partner = {
  id: string;
  name: string;
  shortName: string;
  category: PartnerCategory;
  summary: string;
  intro: string;
  role: string;
  howHelps: string[];
  situations: string[];
  allneedsRole: string;
  relatedNeeds: NeedId[];
  logo?: string;
};

export const PARTNER_FILTERS: { id: "tous" | PartnerCategory; label: string }[] =
  [
    { id: "tous", label: "Tous" },
    { id: "institutions", label: "Institutions & Territoire" },
    { id: "entrepreneuriat", label: "Entrepreneuriat & Accompagnement" },
    { id: "emploi", label: "Emploi & Formation" },
    { id: "finance", label: "Finance & Services financiers" },
    { id: "assurance", label: "Assurance" },
    { id: "digital", label: "Digital & Télécom" },
    { id: "enseignement", label: "Enseignement & Compétences" },
    { id: "reseaux", label: "Réseaux professionnels" },
  ];

export const CATEGORY_LABEL: Record<PartnerCategory, string> = {
  institutions: "Institutions & Territoire",
  entrepreneuriat: "Entrepreneuriat & Accompagnement",
  emploi: "Emploi & Formation",
  finance: "Finance & Services financiers",
  assurance: "Assurance",
  digital: "Digital & Télécom",
  enseignement: "Enseignement & Compétences",
  reseaux: "Réseaux professionnels",
};

export const PARTNERS: Partner[] = [
  {
    id: "min-jeunesse",
    logo: "/partners/min-jeunesse.webp",
    name: "Ministère de la Jeunesse, de la Culture et de la Communication",
    shortName: "MJCC",
    category: "institutions",
    summary:
      "Département ministériel en charge de la jeunesse, de la culture et de la communication.",
    intro:
      "Le ministère conduit les politiques publiques relatives à la jeunesse, à la culture et à la communication au Maroc. Il intervient dans un champ institutionnel large, distinct des opérateurs privés.",
    role:
      "En tant qu'institution publique, ce ministère définit et met en œuvre des orientations nationales dans ses domaines de tutelle. Il n'agit pas comme un prestataire commercial : son rôle est public, réglementaire et programmatique.",
    howHelps: [
      "Cadre public lié à la jeunesse, à la culture et à la communication",
      "Orientation vers les dispositifs relevant de son périmètre, lorsqu'ils existent",
      "Lecture institutionnelle d'un projet à dimension culturelle, jeunesse ou communication",
    ],
    situations: [
      "Mon projet a une dimension culturelle, jeunesse ou communication.",
      "Je cherche à comprendre le cadre public de mon activité.",
      "J'ai besoin d'une orientation institutionnelle, pas d'un prestataire privé.",
    ],
    allneedsRole:
      "ALLNEEDS n'est pas le ministère. Nous aidons à clarifier votre besoin et, le cas échéant, à vous orienter vers le bon niveau d'information institutionnelle.",
    relatedNeeds: ["digital", "formation"],
  },
  {
    id: "min-inclusion",
    logo: "/partners/min-inclusion.jpg",
    name: "Ministère de l'Inclusion économique, de la Petite Entreprise, de l'Emploi et des Compétences",
    shortName: "MIEPEEC",
    category: "institutions",
    summary:
      "Département ministériel de l'inclusion économique, de la petite entreprise, de l'emploi et des compétences.",
    intro:
      "Ce ministère porte les politiques publiques liées à l'inclusion économique, à la petite entreprise, à l'emploi et au développement des compétences. Plusieurs opérateurs publics de l'emploi et de la formation s'inscrivent dans cet écosystème.",
    role:
      "Il fixe le cadre national de plusieurs sujets qui concernent directement les entreprises : emploi, compétences, petite entreprise et inclusion économique. L'accès à un dispositif précis dépend de l'opérateur, du programme et de ses conditions.",
    howHelps: [
      "Cadre public de l'emploi, des compétences et de la petite entreprise",
      "Orientation vers les opérateurs concernés (emploi, formation, accompagnement)",
      "Lecture d'un besoin d'entreprise sous l'angle des politiques publiques",
    ],
    situations: [
      "Je veux recruter ou faire évoluer les compétences de mon équipe.",
      "Je cherche à comprendre les acteurs publics de l'emploi et de la formation.",
      "Mon projet relève de la petite entreprise ou de l'inclusion économique.",
    ],
    allneedsRole:
      "ALLNEEDS centralise votre besoin (emploi, formation, accompagnement) et vous aide à identifier le bon point d'entrée parmi les acteurs publics concernés.",
    relatedNeeds: ["recrutement", "formation", "financement"],
  },
  {
    id: "dar-al-moukawil",
    logo: "/partners/dar-al-moukawil.png",
    name: "Dar Al Moukawil",
    shortName: "Dar Al Moukawil",
    category: "entrepreneuriat",
    summary:
      "Dispositif d'accompagnement à l'entrepreneuriat porté par BANK OF AFRICA.",
    intro:
      "Dar Al Moukawil est un programme d'accompagnement des entrepreneurs et des TPE/PME, développé par BANK OF AFRICA. Il propose un cadre d'information, de formation et d'appui à la création et au développement d'activité.",
    role:
      "Le dispositif vise à aider les porteurs de projets et les entreprises à structurer leur démarche entrepreneuriale. Les services, formats et conditions sont définis par BANK OF AFRICA et peuvent évoluer.",
    howHelps: [
      "Accompagnement à la création et au développement d'entreprise",
      "Accès à de l'information et à des ressources pour les entrepreneurs",
      "Appui à la structuration d'un projet, selon l'offre du moment",
    ],
    situations: [
      "Je crée ou développe une activité et j'ai besoin d'un cadre d'accompagnement.",
      "Je cherche un espace d'orientation entrepreneuriale.",
      "Je veux mieux structurer mon projet avant d'avancer.",
    ],
    allneedsRole:
      "ALLNEEDS n'est pas Dar Al Moukawil. Nous vous aidons à formuler votre besoin entrepreneurial et, si cela correspond à votre situation, à vous orienter vers cet écosystème.",
    relatedNeeds: ["financement", "formation"],
    logo: "/partners/dar-al-moukawil.png",
  },
  {
    id: "anapec",
    name: "ANAPEC",
    shortName: "ANAPEC",
    category: "emploi",
    summary:
      "Agence nationale de promotion de l'emploi et des compétences.",
    intro:
      "L'ANAPEC est l'opérateur public de référence pour l'intermédiation entre offre et demande d'emploi au Maroc. Elle accompagne les entreprises dans leurs recrutements et les demandeurs d'emploi dans leur insertion professionnelle.",
    role:
      "L'agence met en relation les employeurs et les compétences disponibles, et propose des services d'appui à l'emploi. Les dispositifs, publics cibles et modalités relèvent de l'ANAPEC et de ses conditions.",
    howHelps: [
      "Structuration d'un besoin de recrutement",
      "Mise en relation avec des profils, selon les services de l'agence",
      "Orientation vers les dispositifs publics d'emploi et d'insertion",
    ],
    situations: [
      "J'ai besoin de recruter.",
      "Mon activité se développe et je cherche des profils.",
      "Je veux m'appuyer sur l'opérateur public de l'emploi.",
    ],
    allneedsRole:
      "Lorsque le recrutement est l'un de vos besoins, ALLNEEDS vous aide à le cadrer et peut vous orienter vers l'ANAPEC — sans se substituer à l'agence.",
    relatedNeeds: ["recrutement"],
    logo: "/partners/anapec.png",
  },
  {
    id: "cri-casa",
    logo: "/partners/cri-casa.svg",
    name: "CRI Casablanca-Settat",
    shortName: "CRI C-S",
    category: "institutions",
    summary:
      "Centre régional d'investissement de Casablanca-Settat.",
    intro:
      "Le Centre Régional d'Investissement de Casablanca-Settat est le guichet régional de l'investissement et de la création d'entreprise. Il accompagne les porteurs de projets et les investisseurs sur le territoire.",
    role:
      "Le CRI facilite les démarches liées à la création d'entreprise et à l'investissement régional. Il oriente vers les procédures et interlocuteurs concernés. Les délais, pièces et conditions sont ceux de l'administration et du CRI.",
    howHelps: [
      "Création d'entreprise et formalités d'investissement",
      "Orientation territoriale pour un projet à Casablanca-Settat",
      "Lecture d'un besoin d'implantation ou de développement régional",
    ],
    situations: [
      "Je veux créer une entreprise dans la région.",
      "J'ai un projet d'investissement à Casablanca-Settat.",
      "Je cherche le bon interlocuteur institutionnel régional.",
    ],
    allneedsRole:
      "ALLNEEDS clarifie votre besoin (création, investissement, développement) et peut vous orienter vers le CRI lorsque le sujet est territorial ou administratif.",
    relatedNeeds: ["financement"],
    logo: "/partners/cri-casa.svg",
  },
  {
    id: "ofppt",
    name: "OFPPT",
    shortName: "OFPPT",
    category: "emploi",
    summary:
      "Office de la formation professionnelle et de la promotion du travail.",
    intro:
      "L'OFPPT est l'opérateur public majeur de la formation professionnelle au Maroc. Il prépare aux métiers à travers un réseau d'établissements et de filières techniques, tertiaires et industrielles.",
    role:
      "L'office conçoit et délivre des formations professionnelles. L'offre, les conditions d'accès, les niveaux et les calendriers relèvent de l'OFPPT et peuvent évoluer.",
    howHelps: [
      "Identification de filières de formation professionnelle",
      "Montée en compétences techniques et métiers",
      "Orientation vers l'écosystème public de la formation",
    ],
    situations: [
      "Je souhaite former mon équipe.",
      "Je cherche une formation technique ou professionnelle.",
      "Je veux comprendre les dispositifs de formation disponibles.",
    ],
    allneedsRole:
      "ALLNEEDS n'organise pas les formations de l'OFPPT. Nous vous aidons à exprimer le besoin de compétences, puis à vous orienter vers l'écosystème de formation pertinent.",
    relatedNeeds: ["formation"],
    logo: "/partners/ofppt.png",
  },
  {
    id: "region-cs",
    logo: "/partners/region-cs.jpg",
    name: "Région Casablanca-Settat",
    shortName: "Région C-S",
    category: "institutions",
    summary:
      "Conseil régional de Casablanca-Settat, collectivité territoriale.",
    intro:
      "La Région Casablanca-Settat est la collectivité territoriale du premier pôle économique du Royaume. Elle conduit des politiques de développement régional dans les domaines de ses compétences.",
    role:
      "Le conseil régional intervient sur l'aménagement, le développement économique territorial et certains programmes régionaux. Il n'est pas un prestataire privé. Les dispositifs régionaux, lorsqu'ils existent, ont leurs propres critères.",
    howHelps: [
      "Cadre territorial du développement économique régional",
      "Orientation vers les programmes relevant de la région, le cas échéant",
      "Lecture d'un projet sous l'angle du territoire Casablanca-Settat",
    ],
    situations: [
      "Mon projet s'ancre dans la région Casablanca-Settat.",
      "Je cherche à comprendre les acteurs territoriaux.",
      "J'ai besoin d'une orientation institutionnelle régionale.",
    ],
    allneedsRole:
      "ALLNEEDS positionne votre besoin dans le paysage régional et peut vous orienter vers le bon niveau territorial, sans parler au nom de la Région.",
    relatedNeeds: ["financement"],
  },
  {
    id: "maroc-pme",
    name: "Maroc PME",
    shortName: "Maroc PME",
    category: "entrepreneuriat",
    summary:
      "Agence nationale de promotion de la petite et moyenne entreprise.",
    intro:
      "Maroc PME est l'agence publique dédiée à l'appui des très petites, petites et moyennes entreprises. Elle porte des programmes de compétitivité, d'investissement et d'accompagnement, selon les dispositifs en vigueur.",
    role:
      "L'agence conçoit et déploie des programmes d'appui aux TPE/PME. L'accès à un programme dépend des conditions, des critères et du calendrier du dispositif concerné. Les dispositifs et conditions peuvent évoluer. ALLNEEDS ne garantit ni éligibilité ni financement.",
    howHelps: [
      "Orientation vers des programmes d'appui aux TPE/PME",
      "Lecture d'un projet d'investissement ou de développement",
      "Mise en perspective des dispositifs publics d'accompagnement",
    ],
    situations: [
      "Je cherche un accompagnement pour développer mon entreprise.",
      "J'ai un projet d'investissement à étudier.",
      "Je veux comprendre les dispositifs publics destinés aux PME.",
    ],
    allneedsRole:
      "ALLNEEDS vous aide à formuler le besoin. L'étude d'un programme Maroc PME se fait ensuite selon les conditions et critères du dispositif concerné.",
    relatedNeeds: ["financement"],
    logo: "/partners/maroc-pme.jpg",
  },
  {
    id: "go-siyaha",
    name: "GO SIYAHA",
    shortName: "GO SIYAHA",
    category: "entrepreneuriat",
    summary:
      "Programme d'appui à l'entrepreneuriat et à l'animation touristiques.",
    intro:
      "GO SIYAHA est un programme public d'appui aux projets d'animation et d'entrepreneuriat touristiques, inscrit dans la feuille de route du tourisme. Il vise à soutenir des initiatives qui enrichissent l'offre touristique.",
    role:
      "Le programme peut combiner accompagnement technique et appui à l'investissement, selon les conditions du moment. L'accès dépend du projet, de son ancrage touristique et des critères du dispositif. Les dispositifs et conditions peuvent évoluer.",
    howHelps: [
      "Orientation des projets d'animation ou d'entrepreneuriat touristiques",
      "Lecture d'un besoin sous l'angle de l'offre touristique",
      "Mise en relation avec le cadre programmatique concerné",
    ],
    situations: [
      "Je porte un projet touristique ou d'animation.",
      "Je veux développer une offre liée au tourisme.",
      "Je cherche à comprendre les dispositifs d'appui du secteur.",
    ],
    allneedsRole:
      "ALLNEEDS n'instruit pas les dossiers GO SIYAHA. Nous vous aidons à clarifier le besoin et à vous orienter vers le programme, selon votre situation et les conditions du dispositif.",
    relatedNeeds: ["financement"],
  },
  {
    id: "ccis-cs",
    name: "Chambre de Commerce, d'Industrie et de Services de Casablanca-Settat",
    shortName: "CCIS C-S",
    category: "reseaux",
    summary:
      "Chambre consulaire représentant les entreprises de Casablanca-Settat.",
    intro:
      "La CCIS de Casablanca-Settat est l'institution consulaire des entreprises de commerce, d'industrie et de services du territoire. Elle représente ses ressortissants et propose des services d'appui à la vie des affaires.",
    role:
      "La chambre agit comme relais entre les entreprises et les institutions, et peut offrir de l'information, de la formation ou de l'accompagnement selon son offre. Les services précis relèvent de la chambre.",
    howHelps: [
      "Ancrage dans le réseau économique régional",
      "Information et orientation des entreprises ressortissantes",
      "Lecture d'un besoin dans l'écosystème consulaire",
    ],
    situations: [
      "Je veux m'inscrire dans le tissu économique régional.",
      "Je cherche un relais consulaire pour mon entreprise.",
      "J'ai besoin d'information sur la vie des affaires à Casablanca-Settat.",
    ],
    allneedsRole:
      "ALLNEEDS peut vous orienter vers la chambre lorsque votre besoin relève du réseau professionnel, de l'information économique ou de l'accompagnement consulaire.",
    relatedNeeds: ["financement", "formation"],
  },
  {
    id: "fce-gbp",
    name: "Fondation Création d'Entreprises — Groupe Banque Populaire",
    shortName: "FCE",
    category: "entrepreneuriat",
    summary:
      "Fondation du Groupe Banque Populaire dédiée à la création d'entreprises.",
    intro:
      "La Fondation Création d'Entreprises du Groupe Banque Populaire accompagne les porteurs de projets et les créateurs d'entreprise. Elle s'inscrit dans l'engagement du groupe en faveur de l'entrepreneuriat.",
    role:
      "La fondation propose un cadre d'accompagnement à la création d'activité. Les formats, publics et conditions sont définis par la fondation et le groupe, et peuvent évoluer.",
    howHelps: [
      "Accompagnement à la création d'entreprise",
      "Appui à la structuration d'un projet entrepreneurial",
      "Orientation vers l'écosystème Banque Populaire dédié aux créateurs",
    ],
    situations: [
      "Je crée une entreprise et j'ai besoin d'un accompagnement.",
      "Je veux structurer mon projet avant de le lancer.",
      "Je cherche un cadre fondation / groupe bancaire pour l'entrepreneuriat.",
    ],
    allneedsRole:
      "ALLNEEDS clarifie votre besoin de création ou d'accompagnement, puis peut vous orienter vers cet écosystème — sans préjuger d'une décision de la fondation.",
    relatedNeeds: ["financement", "formation"],
  },
  {
    id: "rma",
    logo: "/partners/rma.png",
    name: "RMA",
    shortName: "RMA",
    category: "assurance",
    summary:
      "Compagnie d'assurance marocaine, solutions pour particuliers et entreprises.",
    intro:
      "RMA est un acteur majeur de l'assurance au Maroc. Elle propose des couvertures destinées aux particuliers et aux entreprises, dans le cadre de son offre et de la réglementation du secteur.",
    role:
      "La compagnie étudie, propose et gère des contrats d'assurance. Le choix d'une couverture, les garanties et les tarifs relèvent de RMA, de ses intermédiaires et de votre profil de risque. ALLNEEDS ne vend pas d'assurance et ne garantit aucune souscription.",
    howHelps: [
      "Assurance professionnelle et des risques d'entreprise",
      "Couverture des véhicules, locaux et équipements, selon l'offre",
      "Orientation vers un interlocuteur assurance du réseau",
    ],
    situations: [
      "Je souhaite assurer les véhicules de mon entreprise.",
      "Je veux protéger mes locaux ou mes équipements.",
      "Je cherche une couverture professionnelle adaptée à mon activité.",
    ],
    allneedsRole:
      "ALLNEEDS vous aide à formuler le besoin de protection. L'étude d'une couverture se fait ensuite avec l'assureur ou l'intermédiaire concerné, selon leurs conditions.",
    relatedNeeds: ["assurance"],
    logo: "/partners/rma.png",
  },
  {
    id: "orange",
    logo: "/partners/orange.svg",
    name: "Orange",
    shortName: "Orange",
    category: "digital",
    summary:
      "Opérateur télécoms : connectivité, digital et solutions professionnelles.",
    intro:
      "Orange est un opérateur de télécommunications présent au Maroc. Il propose des offres de connectivité, de communication et de solutions numériques destinées aux particuliers et aux entreprises.",
    role:
      "L'opérateur fournit des services télécoms et digitaux. Les offres, disponibilités et conditions commerciales relèvent d'Orange. ALLNEEDS n'est pas un revendeur et ne s'engage sur aucun tarif ou délai.",
    howHelps: [
      "Connectivité et solutions télécoms pour l'entreprise",
      "Outils de communication professionnelle",
      "Orientation vers des solutions digitales d'opérateur",
    ],
    situations: [
      "J'ai besoin de solutions digitales ou télécom.",
      "Je veux améliorer les outils de communication de mon entreprise.",
      "Je cherche un opérateur pour accompagner ma digitalisation.",
    ],
    allneedsRole:
      "Lorsque le besoin est digital ou télécom, ALLNEEDS vous aide à le préciser et peut vous orienter vers Orange, parmi d'autres pistes pertinentes.",
    relatedNeeds: ["digital"],
    logo: "/partners/orange.svg",
  },
  {
    id: "bank-of-africa",
    logo: "/partners/bank-of-africa.png",
    name: "BANK OF AFRICA / BMCE",
    shortName: "BANK OF AFRICA",
    category: "finance",
    summary:
      "Groupe bancaire : financement, services bancaires et accompagnement des entreprises.",
    intro:
      "BANK OF AFRICA (ex-BMCE Bank) est un groupe bancaire marocain qui accompagne les particuliers, les entreprises et les institutionnels. Il propose des services bancaires et de financement dans le cadre de sa politique commerciale et réglementaire.",
    role:
      "La banque étudie les besoins de financement et de services selon ses critères. Aucun crédit, aucune ouverture de compte et aucune décision bancaire n'est garantie par ALLNEEDS. L'accès dépend de la banque, de votre situation et des conditions en vigueur.",
    howHelps: [
      "Services bancaires aux entreprises",
      "Étude de besoins de financement, selon les critères de la banque",
      "Lien avec l'écosystème d'accompagnement du groupe (dont Dar Al Moukawil)",
    ],
    situations: [
      "Je cherche un interlocuteur bancaire pour mon entreprise.",
      "J'ai un projet qui peut nécessiter un financement.",
      "Je veux relier un besoin d'accompagnement et un cadre bancaire.",
    ],
    allneedsRole:
      "ALLNEEDS oriente ; la banque décide. Nous vous aidons à présenter un besoin clair, sans préjuger d'une réponse financière.",
    relatedNeeds: ["financement"],
    logo: "/partners/bank-of-africa.png",
  },
  {
    id: "cash-plus",
    name: "Cash Plus",
    shortName: "Cash Plus",
    category: "finance",
    summary:
      "Établissement de paiement : transfert d'argent et services de proximité.",
    intro:
      "Cash Plus est un établissement de paiement marocain, connu pour le transfert d'argent et des services financiers de proximité. Il opère à travers un réseau de points de vente.",
    role:
      "L'établissement propose des services de paiement et de transfert dans le cadre de son agrément. Les conditions, plafonds et disponibilités relèvent de Cash Plus et de la réglementation des paiements.",
    howHelps: [
      "Services de paiement et de transfert",
      "Solutions de proximité pour les flux financiers du quotidien",
      "Orientation vers un acteur de l'inclusion financière de proximité",
    ],
    situations: [
      "J'ai besoin de solutions de paiement ou de transfert.",
      "Mon activité s'appuie sur des flux de proximité.",
      "Je cherche un service financier simple, hors offre bancaire classique.",
    ],
    allneedsRole:
      "ALLNEEDS peut intégrer ce type de besoin dans votre demande et vous orienter vers l'acteur de paiement adapté, selon votre situation.",
    relatedNeeds: ["financement"],
    logo: "/partners/cash-plus.png",
  },
  {
    id: "barid-cash",
    name: "Barid Cash",
    shortName: "Barid Cash",
    category: "finance",
    summary:
      "Établissement de paiement du Groupe Poste Maroc (Barid Al-Maghrib).",
    intro:
      "Barid Cash est l'établissement de paiement du Groupe Poste Maroc. Il propose des services de transfert d'argent et de paiement de proximité, en s'appuyant sur le maillage postal.",
    role:
      "Barid Cash opère des services de paiement agréés. Les offres, conditions et points de service relèvent de l'établissement et du groupe postal.",
    howHelps: [
      "Transfert d'argent et paiements de proximité",
      "Accès à un réseau s'appuyant sur la poste",
      "Orientation vers des services financiers de proximité",
    ],
    situations: [
      "Je cherche un service de paiement de proximité.",
      "Mon activité a besoin de solutions de transfert.",
      "Je veux un interlocuteur du groupe postal pour les paiements.",
    ],
    allneedsRole:
      "ALLNEEDS relie votre besoin financier de proximité à l'acteur concerné, sans se substituer à Barid Cash.",
    relatedNeeds: ["financement"],
    logo: "/partners/barid-cash.png",
  },
  {
    id: "damane-cash",
    logo: "/partners/damane-cash.jpg",
    name: "Damane Cash",
    shortName: "Damane Cash",
    category: "finance",
    summary:
      "Établissement de paiement : services de transfert et de paiement.",
    intro:
      "Damane Cash est un établissement de paiement marocain actif dans le transfert d'argent et les services de paiement. Il s'adresse aux particuliers et, selon son offre, aux besoins de proximité des professionnels.",
    role:
      "L'établissement fournit des services de paiement dans le cadre de son agrément. Les conditions commerciales et opérationnelles relèvent de Damane Cash.",
    howHelps: [
      "Services de transfert et de paiement",
      "Solutions de proximité pour les flux financiers",
      "Orientation vers un établissement de paiement agréé",
    ],
    situations: [
      "J'ai besoin d'un service de paiement ou de transfert.",
      "Je cherche une alternative de proximité pour mes flux.",
      "Mon activité nécessite un interlocuteur paiement, pas uniquement une banque.",
    ],
    allneedsRole:
      "ALLNEEDS intègre ce besoin dans une demande unique et vous oriente vers l'acteur de paiement pertinent.",
    relatedNeeds: ["financement"],
  },
  {
    id: "mlr-groupe",
    name: "MLR GROUPE",
    shortName: "MLR GROUPE",
    category: "reseaux",
    summary:
      "Partenaire privé du réseau ALLNEEDS.",
    intro:
      "MLR GROUPE figure parmi les partenaires privés du réseau ALLNEEDS. Les informations détaillées sur son offre sont à confirmer directement avec l'organisation, afin d'éviter toute description inexacte.",
    role:
      "ALLNEEDS n'invente pas les expertises, programmes ou conditions d'un partenaire. Lorsque votre besoin peut correspondre à cet acteur, nous facilitons la mise en relation pour un échange de premier niveau.",
    howHelps: [
      "Mise en relation avec un partenaire privé du réseau",
      "Clarification de votre besoin avant l'échange",
      "Orientation selon la nature réelle de la demande",
    ],
    situations: [
      "Je souhaite être orienté vers les partenaires privés du réseau.",
      "Mon besoin n'est pas encore entièrement cadré.",
      "Je veux un premier contact, sans m'engager sur une offre précise.",
    ],
    allneedsRole:
      "ALLNEEDS reste le point de départ : nous transmettons un besoin clair au partenaire, qui présente ensuite son propre cadre d'intervention.",
    relatedNeeds: [],
  },
  {
    id: "fnacam",
    logo: "/partners/fnacam.svg",
    name: "FNACAM",
    shortName: "FNACAM",
    category: "assurance",
    summary:
      "Fédération nationale des agents et courtiers d'assurance au Maroc.",
    intro:
      "La FNACAM représente les intermédiaires d'assurance — agents et courtiers — au Maroc. Elle structure une profession qui conseille les entreprises et les particuliers dans le choix et la gestion de leurs couvertures.",
    role:
      "La fédération n'est pas un assureur : elle représente un écosystème d'intermédiaires. L'étude d'un contrat se fait avec un agent ou un courtier, puis avec la compagnie. ALLNEEDS ne prescrit aucun contrat.",
    howHelps: [
      "Accès à l'écosystème des intermédiaires d'assurance",
      "Orientation d'un besoin de protection vers un conseil intermédié",
      "Lecture professionnelle d'un risque d'entreprise",
    ],
    situations: [
      "Je veux être conseillé par un intermédiaire d'assurance.",
      "Je ne sais pas encore quelle couverture correspond à mon activité.",
      "Je cherche un relais dans l'écosystème agents / courtiers.",
    ],
    allneedsRole:
      "Pour un besoin d'assurance, ALLNEEDS peut vous orienter vers l'écosystème FNACAM, en complément d'une compagnie comme RMA, sans exclusivité.",
    relatedNeeds: ["assurance"],
  },
  {
    id: "ain-chock",
    logo: "/partners/ain-chock.png",
    name: "Faculté Ain Chock",
    shortName: "Ain Chock",
    category: "enseignement",
    summary:
      "Établissement universitaire de l'Université Hassan II de Casablanca.",
    intro:
      "La Faculté Ain Chock, composante de l'Université Hassan II de Casablanca, forme des étudiants dans plusieurs disciplines académiques. Elle contribue à l'écosystème de compétences de la métropole.",
    role:
      "L'établissement délivre des formations universitaires et développe des activités académiques. Les filières, conditions d'accès et partenariats relèvent de la faculté et de l'université.",
    howHelps: [
      "Lien avec l'enseignement supérieur casablancais",
      "Orientation vers des compétences et profils académiques",
      "Lecture d'un besoin de formation dans l'écosystème universitaire",
    ],
    situations: [
      "Je cherche un relais académique à Casablanca.",
      "Mon besoin de compétences peut s'appuyer sur l'université.",
      "Je veux relier mon entreprise à l'écosystème Ain Chock.",
    ],
    allneedsRole:
      "ALLNEEDS relie un besoin de formation ou de compétences à l'écosystème académique, sans s'exprimer au nom de la faculté.",
    relatedNeeds: ["formation", "recrutement"],
  },
  {
    id: "ain-sebaa",
    logo: "/partners/ain-sebaa.png",
    name: "Faculté Ain Sebaâ",
    shortName: "Ain Sebaâ",
    category: "enseignement",
    summary:
      "Établissement universitaire de l'Université Hassan II, campus Ain Sebaâ.",
    intro:
      "La Faculté Ain Sebaâ appartient à l'Université Hassan II de Casablanca. Elle forme des étudiants sur le campus d'Ain Sebaâ et participe au vivier de compétences de la région.",
    role:
      "Comme tout établissement public d'enseignement supérieur, la faculté organise des formations et des activités académiques selon ses maquettes et ses règles d'accès.",
    howHelps: [
      "Accès à un pôle universitaire de Casablanca",
      "Orientation formation / compétences",
      "Lien potentiel entre entreprises et profils académiques",
    ],
    situations: [
      "Je cherche un partenaire académique à Ain Sebaâ / Casablanca.",
      "J'ai un besoin de formation ou de profils issus de l'université.",
      "Je veux inscrire mon projet dans l'écosystème d'enseignement local.",
    ],
    allneedsRole:
      "ALLNEEDS oriente vers l'écosystème universitaire lorsque cela éclaire un besoin de formation ou de recrutement.",
    relatedNeeds: ["formation", "recrutement"],
  },
  {
    id: "aref",
    logo: "/partners/aref.jpg",
    name: "Académie Régionale d'Éducation et de Formation de Casablanca-Settat",
    shortName: "AREF C-S",
    category: "enseignement",
    summary:
      "Académie régionale en charge de l'éducation et de la formation sur le territoire.",
    intro:
      "L'AREF Casablanca-Settat est l'instance déconcentrée du département de l'Éducation nationale. Elle pilote l'éducation et certains volets de formation à l'échelle régionale.",
    role:
      "L'académie met en œuvre les politiques éducatives régionales. Elle n'est pas un organisme de formation privée. Les dispositifs, lorsqu'ils concernent les entreprises, relèvent de son cadre public.",
    howHelps: [
      "Cadre public de l'éducation et de la formation régionale",
      "Orientation institutionnelle liée aux compétences de base et à l'éducation",
      "Lecture d'un projet éducatif ou de formation sur le territoire",
    ],
    situations: [
      "Mon projet a une dimension éducative régionale.",
      "Je cherche l'interlocuteur public de l'éducation à Casablanca-Settat.",
      "Je veux relier un besoin de compétences au cadre académique régional.",
    ],
    allneedsRole:
      "ALLNEEDS distingue le besoin (formation professionnelle, recrutement, éducation) et oriente vers l'acteur public compétent, dont l'AREF le cas échéant.",
    relatedNeeds: ["formation"],
  },
  {
    id: "am2t",
    name: "AM2T",
    shortName: "AM2T",
    category: "reseaux",
    summary:
      "Partenaire du réseau ALLNEEDS.",
    intro:
      "AM2T figure parmi les partenaires du réseau ALLNEEDS. En l'absence d'une description institutionnelle suffisamment détaillée et vérifiée, nous restons factuels : l'organisation peut être mobilisée selon la nature réelle de votre besoin.",
    role:
      "Nous n'attribuons pas à AM2T de programmes, de labels ou de conditions qui n'auraient pas été confirmés. L'échange de premier niveau permet de préciser le rôle utile de ce partenaire.",
    howHelps: [
      "Mise en relation au sein du réseau ALLNEEDS",
      "Cadrage préalable de votre besoin",
      "Orientation vers l'interlocuteur le plus pertinent",
    ],
    situations: [
      "Je veux m'appuyer sur le réseau de partenaires ALLNEEDS.",
      "Mon besoin peut nécessiter un acteur complémentaire.",
      "Je cherche une première orientation, pas une offre packagée.",
    ],
    allneedsRole:
      "ALLNEEDS centralise la demande et n'engage AM2T que si le besoin le justifie, après un échange de clarification.",
    relatedNeeds: [],
  },
  {
    id: "cafj",
    name: "CAFJ",
    shortName: "CAFJ",
    category: "entrepreneuriat",
    summary:
      "Acteur d'accompagnement des organisations, selon son objet social déclaré.",
    intro:
      "CAFJ est identifié, dans les informations publiques d'entreprise à Casablanca, comme un acteur d'accompagnement : conseil, organisation, management, ressources humaines, formation et coaching, au service d'entreprises et d'organisations.",
    role:
      "L'intervention de CAFJ dépend de ses missions et de ses conditions. ALLNEEDS ne garantit ni prestation, ni tarif, ni résultat. Le premier échange sert à vérifier l'adéquation avec votre besoin.",
    howHelps: [
      "Accompagnement et conseil aux organisations, selon son offre",
      "Appui possible en structuration, management ou formation",
      "Relais complémentaire au sein du réseau ALLNEEDS",
    ],
    situations: [
      "Je cherche un accompagnement pour structurer mon organisation.",
      "J'ai un besoin de conseil, de formation ou de coaching d'équipe.",
      "Je veux un partenaire d'appui, en plus des institutions publiques.",
    ],
    allneedsRole:
      "ALLNEEDS formule le besoin et peut pré-orienter vers CAFJ lorsque l'accompagnement organisationnel est pertinent — sans exclusivité.",
    relatedNeeds: ["formation", "recrutement"],
  },
];

export const PARTNER_BY_ID = Object.fromEntries(
  PARTNERS.map((partner) => [partner.id, partner]),
) as Record<string, Partner>;




