import { PathwaySection, type PathwayStep } from "@/components/PathwaySection";

const STEPS: PathwayStep[] = [
  {
    n: "01",
    title: "Comprendre",
    text: "Identifier le contexte et les besoins du projet.",
  },
  {
    n: "02",
    title: "S’orienter",
    text: "Identifier les institutions et interlocuteurs pertinents.",
  },
  {
    n: "03",
    title: "S’implanter",
    text: "Structurer les besoins liés à l’implantation.",
  },
  {
    n: "04",
    title: "Développer",
    text: "Mettre en place les solutions nécessaires au fonctionnement et au développement de l’activité.",
  },
];

const AREAS = [
  "implantation",
  "création d’entreprise",
  "accompagnement institutionnel",
  "banque",
  "financement",
  "comptabilité",
  "fiscalité",
  "assurance",
  "recrutement",
  "fournisseurs",
  "digital / télécom",
  "développement commercial",
];

export function InvestorSection() {
  return (
    <PathwaySection
      id="implantation"
      className="bg-ice"
      eyebrow="Implantation au Maroc"
      headline="Vous souhaitez développer une activité au Maroc ?"
      copy="ALLNEEDS facilite votre orientation vers les acteurs et solutions utiles pour préparer votre implantation et structurer votre projet."
      steps={STEPS}
      areas={AREAS}
      areasLabel="Domaines concernés"
      cta="Préparer mon implantation au Maroc"
      profile="investor"
      suggestedNeeds={["financement", "comptabilite", "fournisseurs"]}
    />
  );
}
