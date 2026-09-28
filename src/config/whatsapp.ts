export const WHATSAPP_NUMBER = "212XXXXXXXXX";

export type WhatsAppPayload = {
  name: string;
  company: string;
  profile: string;
  country?: string;
  role?: string;
  phone: string;
  email: string;
  city: string;
  sector: string;
  needs: string[];
  details?: string[];
  message?: string;
};

export function buildWhatsAppMessage(payload: WhatsAppPayload): string {
  const needs =
    payload.needs.length > 0
      ? payload.needs.map((need) => `• ${need}`).join("\n")
      : "• Non précisé";

  const extra = payload.message?.trim()
    ? payload.message.trim()
    : "Non précisé";

  const role = payload.role?.trim();
  const country = payload.country?.trim();
  const details = payload.details?.length
    ? payload.details.map((item) => `• ${item}`).join("\n")
    : "• À préciser lors de l'échange";

  const lines = [
    "Bonjour ALLNEEDS,",
    "",
    "Je souhaite vous transmettre une demande.",
    "",
    `👤 Nom : ${payload.name}`,
    `🏢 Entreprise / projet : ${payload.company}`,
    `🎯 Situation : ${payload.profile}`,
    country ? `🌍 Pays d’origine : ${country}` : null,
    role ? `💼 Fonction : ${role}` : null,
    `📱 Téléphone : ${payload.phone}`,
    `✉️ Email : ${payload.email}`,
    `📍 Ville : ${payload.city}`,
    `🏭 Secteur : ${payload.sector}`,
    "",
    "Besoins sélectionnés :",
    needs,
    "",
    "Demandes cochées :",
    details,
    "",
    "Informations complémentaires :",
    extra,
    "",
    "Merci de me contacter afin d’échanger sur mon projet.",
  ];

  return lines.filter((line): line is string => line !== null).join("\n");
}

export function buildWhatsAppUrl(payload: WhatsAppPayload): string {
  const text = encodeURIComponent(buildWhatsAppMessage(payload));
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${text}`;
}
