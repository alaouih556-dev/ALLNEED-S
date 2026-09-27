export type ProfileId = "existing" | "creation" | "investor";

export type Profile = {
  id: ProfileId;
  /** Title used in the profile selector section. */
  title: string;
  /** Label used in the form and in the WhatsApp message. */
  optionLabel: string;
  description: string;
  cta: string;
  icon: "building" | "rocket" | "globe";
};

export const PROFILES: Profile[] = [
  {
    id: "existing",
    title: "J’ai déjà une entreprise",
    optionLabel: "J’ai déjà une entreprise",
    description:
      "Vous souhaitez développer, structurer ou renforcer votre activité.",
    cta: "Identifier mes besoins",
    icon: "building",
  },
  {
    id: "creation",
    title: "Je crée mon entreprise",
    optionLabel: "Je crée mon entreprise",
    description:
      "De l’idée aux premières démarches, identifiez les interlocuteurs et solutions utiles pour structurer votre projet.",
    cta: "Accompagner ma création",
    icon: "rocket",
  },
  {
    id: "investor",
    title: "Je souhaite m’implanter au Maroc",
    optionLabel: "Je souhaite investir / m’implanter au Maroc",
    description:
      "ALLNEEDS facilite votre orientation vers les acteurs et solutions utiles pour préparer votre implantation et votre activité au Maroc.",
    cta: "Préparer mon implantation",
    icon: "globe",
  },
];

export const PROFILE_BY_ID = Object.fromEntries(
  PROFILES.map((profile) => [profile.id, profile]),
) as Record<ProfileId, Profile>;

export function profileLabel(id: ProfileId | null | undefined): string {
  return id ? PROFILE_BY_ID[id].optionLabel : "Non précisé";
}

/** Country of origin is only meaningful for a foreign investor. */
export function profileNeedsCountry(id: ProfileId | null | undefined): boolean {
  return id === "investor";
}

export const PROFILE_COMPANY_FIELD: Record<
  ProfileId,
  { label: string; required: boolean; placeholder: string }
> = {
  existing: {
    label: "Nom de l’entreprise",
    required: true,
    placeholder: "Nom de votre entreprise",
  },
  creation: {
    label: "Nom du projet / future entreprise",
    required: false,
    placeholder: "Nom de votre projet (facultatif)",
  },
  investor: {
    label: "Entreprise / groupe",
    required: true,
    placeholder: "Entreprise ou groupe à l’origine du projet",
  },
};
