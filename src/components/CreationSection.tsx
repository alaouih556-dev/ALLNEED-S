import { PathwaySection, type PathwayStep } from "@/components/PathwaySection";

const STEPS: PathwayStep[] = [
  {
    n: "01",
    title: "Projet",
    text: "Clarifier votre activité et vos besoins.",
  },
  {
    n: "02",
    title: "Structuration",
    text: "Identifier les démarches et interlocuteurs utiles.",
  },
  {
    n: "03",
    title: "Création",
    text: "Avancer dans la mise en place de votre entreprise.",
  },
  {
    n: "04",
    title: "Lancement",
    text: "Mettre en place les solutions nécessaires au démarrage.",
  },
];

const AREAS = [
  "Financement",
  "Comptabilité",
  "Fiscalité",
  "Banque",
  "Assurance",
  "Digital",
  "Commercial",
  "Recrutement",
];

export function CreationSection() {
  return (
    <PathwaySection
      id="creation-entreprise"
      className="bg-paper"
      eyebrow="Création d’entreprise"
      headline="De l’idée à l’entreprise, commencez avec les bons interlocuteurs."
      copy="Créer une entreprise implique plusieurs décisions et démarches. ALLNEEDS vous aide à structurer votre parcours et à identifier les acteurs et solutions pertinents selon votre projet."
      steps={STEPS}
      areas={AREAS}
      areasLabel="Domaines concernés"
      cta="Je souhaite créer mon entreprise"
      profile="creation"
      suggestedNeeds={["financement", "comptabilite"]}
    />
  );
}
