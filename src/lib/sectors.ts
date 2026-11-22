import { Factory, GraduationCap, HardHat, HeartPulse, Hotel, Store, Wrench, type LucideIcon } from 'lucide-react'
import type { Sector } from '@/types'

/**
 * Source unique des secteurs ALLNEEDS.
 *
 * `slug` est l'identifiant public (URL, inscription). `key` est la valeur stockée en base :
 * les trois secteurs historiques gardent leur clé pour ne pas toucher aux données existantes.
 * `diagnostic` vaut null tant qu'aucun questionnaire n'existe pour le secteur.
 *
 * Le français reste la langue source affichée ; l'anglais est servi par `src/i18n/en.json`
 * (vérifié par `npm run test:sectors`).
 */
export type Bilingual = { fr: string; en: string }
export type SectorSlug =
  | 'sante'
  | 'commerce-distribution'
  | 'enseignement-prive'
  | 'tourisme-hotellerie-restauration'
  | 'industrie-production'
  | 'btp-immobilier'
  | 'services-artisanat'

export type EstablishmentType = { value: string; title: Bilingual; description: Bilingual }
export type SectorConfig = {
  slug: SectorSlug
  key: string
  diagnostic: Sector | null
  label: Bilingual
  icon: LucideIcon
  establishmentTypes: [EstablishmentType, EstablishmentType, EstablishmentType]
  placeholders: { name: Bilingual; type: Bilingual; city: Bilingual; headcount: Bilingual }
  privacy: Bilingual
}

const b = (fr: string, en: string): Bilingual => ({ fr, en })
const type = (value: string, titleFr: string, titleEn: string, descriptionFr: string, descriptionEn: string): EstablishmentType => ({
  value,
  title: b(titleFr, titleEn),
  description: b(descriptionFr, descriptionEn),
})
const CASABLANCA = b('Casablanca', 'Casablanca')

export const SECTORS_CONFIG: SectorConfig[] = [
  {
    slug: 'sante',
    key: 'sante',
    diagnostic: 'sante',
    label: b('Santé', 'Healthcare'),
    icon: HeartPulse,
    establishmentTypes: [
      type('cabinet', 'Cabinet', 'Practice', 'Patients, rendez-vous, praticiens, paiements et charges.', 'Patients, appointments, practitioners, payments and costs.'),
      type('centre', 'Centre de santé', 'Health centre', 'Accueil, planning multi-praticiens, équipe, paiements et suivi.', 'Reception, multi-practitioner scheduling, team, payments and follow-up.'),
      type('laboratoire', 'Laboratoire', 'Laboratory', 'Accueil, dossiers, équipe, encaissements et organisation.', 'Reception, files, team, payments and organisation.'),
    ],
    placeholders: { name: b('Cabinet Al Amal', 'Al Amal Practice'), type: b('Cabinet médical', 'Medical practice'), city: CASABLANCA, headcount: b('8 salariés', '8 employees') },
    privacy: b('Nous ne demandons aucune donnée nominative de patient pour ce premier échange.', 'We do not ask for any personal patient data for this first conversation.'),
  },
  {
    slug: 'commerce-distribution',
    key: 'commerce-distribution',
    diagnostic: null,
    label: b('Commerce & distribution', 'Retail & distribution'),
    icon: Store,
    establishmentTypes: [
      type('boutique', 'Boutique / magasin', 'Shop / store', 'Clientèle, ventes, stock, caisse et équipe.', 'Customers, sales, stock, tills and team.'),
      type('reseau', 'Réseau de points de vente / GMS', 'Retail network / supermarkets', 'Points de vente, assortiment, équipes et pilotage.', 'Outlets, product range, teams and management.'),
      type('grossiste', 'Grossiste / distributeur', 'Wholesaler / distributor', 'Commandes, tournées, stock, fournisseurs et encaissements.', 'Orders, delivery rounds, stock, suppliers and payments.'),
    ],
    placeholders: { name: b('Boutique Al Amal', 'Al Amal Store'), type: b('Magasin de détail', 'Retail store'), city: CASABLANCA, headcount: b('12 salariés', '12 employees') },
    privacy: b('Nous ne demandons aucune donnée nominative de client pour ce premier échange.', 'We do not ask for any personal customer data for this first conversation.'),
  },
  {
    slug: 'enseignement-prive',
    key: 'enseignement',
    diagnostic: 'enseignement',
    label: b('Enseignement privé', 'Private education'),
    icon: GraduationCap,
    establishmentTypes: [
      type('ecole', 'École (primaire, collège, lycée)', 'School (primary, middle, high)', 'Inscriptions, élèves, familles, équipe et paiements.', 'Enrolment, students, families, team and payments.'),
      type('formation', 'Centre de formation', 'Training centre', 'Inscriptions, sessions, apprenants, formateurs et règlements.', 'Enrolment, sessions, learners, trainers and payments.'),
      type('superieur', 'Établissement supérieur', 'Higher education institution', 'Admissions, filières, étudiants, enseignants et scolarité.', 'Admissions, programmes, students, faculty and tuition.'),
    ],
    placeholders: { name: b('École Al Amal', 'Al Amal School'), type: b('École privée', 'Private school'), city: CASABLANCA, headcount: b('18 salariés', '18 employees') },
    privacy: b('Nous ne demandons aucune donnée nominative d’élève ou de famille pour ce premier échange.', 'We do not ask for any personal student or family data for this first conversation.'),
  },
  {
    slug: 'tourisme-hotellerie-restauration',
    key: 'tourisme',
    diagnostic: 'tourisme',
    label: b('Tourisme / hôtellerie / restauration', 'Tourism / hospitality / food'),
    icon: Hotel,
    establishmentTypes: [
      type('hebergement', 'Hôtel / riad', 'Hotel / riad', 'Réservations, chambres, check-in/out, ménage et paiements.', 'Bookings, rooms, check-in/out, housekeeping and payments.'),
      type('restauration', 'Restaurant / café', 'Restaurant / café', 'Tables, menus, ingrédients, stock, commandes et caisse.', 'Tables, menus, ingredients, stock, orders and till.'),
      type('agence', 'Agence de voyage / transport touristique', 'Travel agency / tourist transport', 'Dossiers, voyageurs, trajets, réservations et marge.', 'Files, travellers, trips, bookings and margin.'),
    ],
    placeholders: { name: b('Riad Al Amal', 'Riad Al Amal'), type: b('Riad', 'Riad'), city: b('Marrakech', 'Marrakech'), headcount: b('15 salariés', '15 employees') },
    privacy: b('Nous ne demandons aucune donnée nominative de client ou de voyageur pour ce premier échange.', 'We do not ask for any personal customer or traveller data for this first conversation.'),
  },
  {
    slug: 'industrie-production',
    key: 'industrie-production',
    diagnostic: null,
    label: b('Industrie & production', 'Industry & manufacturing'),
    icon: Factory,
    establishmentTypes: [
      type('atelier-pme', 'Atelier / PME industrielle', 'Workshop / industrial SME', 'Commandes, production, équipe, achats et délais.', 'Orders, production, team, purchasing and lead times.'),
      type('usine', 'Usine / unité de production', 'Factory / production unit', 'Lignes, maintenance, qualité, sécurité et coûts.', 'Lines, maintenance, quality, safety and costs.'),
      type('agroalimentaire', 'Agroalimentaire', 'Food processing', 'Approvisionnement, production, hygiène, stock et expéditions.', 'Sourcing, production, hygiene, stock and shipping.'),
    ],
    placeholders: { name: b('Atelier Al Amal', 'Al Amal Workshop'), type: b('PME industrielle', 'Industrial SME'), city: b('Tanger', 'Tangier'), headcount: b('45 salariés', '45 employees') },
    privacy: b('Nous ne demandons aucune donnée nominative de salarié ou de client pour ce premier échange.', 'We do not ask for any personal employee or customer data for this first conversation.'),
  },
  {
    slug: 'btp-immobilier',
    key: 'btp-immobilier',
    diagnostic: null,
    label: b('BTP & immobilier', 'Construction & real estate'),
    icon: HardHat,
    establishmentTypes: [
      type('btp', 'Entreprise de BTP', 'Construction company', 'Chantiers, équipes, sous-traitants, devis et trésorerie.', 'Sites, crews, subcontractors, quotes and cash flow.'),
      type('promoteur', 'Promoteur immobilier', 'Property developer', 'Projets, commercialisation, partenaires et suivi financier.', 'Projects, sales, partners and financial tracking.'),
      type('agence-syndic', 'Agence immobilière / syndic', 'Estate agency / property management', 'Mandats, biens, relances, charges et copropriétés.', 'Mandates, properties, follow-ups, charges and co-ownership.'),
    ],
    placeholders: { name: b('Bâtiment Al Amal', 'Al Amal Construction'), type: b('Entreprise de BTP', 'Construction company'), city: b('Rabat', 'Rabat'), headcount: b('30 salariés', '30 employees') },
    privacy: b('Nous ne demandons aucune donnée nominative de client, de locataire ou de copropriétaire pour ce premier échange.', 'We do not ask for any personal customer, tenant or co-owner data for this first conversation.'),
  },
  {
    slug: 'services-artisanat',
    key: 'services-artisanat',
    diagnostic: null,
    label: b('Services & artisanat', 'Services & crafts'),
    icon: Wrench,
    establishmentTypes: [
      type('societe-services', 'Société de services', 'Service company', 'Clients, prestations, équipe, facturation et suivi.', 'Clients, services, team, invoicing and follow-up.'),
      type('artisan', 'Artisan / atelier', 'Craftsperson / workshop', 'Commandes, savoir-faire, matières, délais et paiements.', 'Orders, craft, materials, lead times and payments.'),
      type('liberale', 'Profession libérale', 'Independent profession', 'Clientèle, rendez-vous, dossiers, honoraires et charges.', 'Clients, appointments, files, fees and costs.'),
    ],
    placeholders: { name: b('Atelier Al Amal', 'Al Amal Workshop'), type: b('Société de services', 'Service company'), city: b('Fès', 'Fez'), headcount: b('6 salariés', '6 employees') },
    privacy: b('Nous ne demandons aucune donnée nominative de client pour ce premier échange.', 'We do not ask for any personal customer data for this first conversation.'),
  },
]

export const SECTOR_SLUGS: SectorSlug[] = SECTORS_CONFIG.map((sector) => sector.slug)
/** Valeurs stockées en base pour `organization.sector`. */
export const SECTOR_KEYS: string[] = SECTORS_CONFIG.map((sector) => sector.key)
/** Secteurs disposant d'un questionnaire, de plans et d'un espace métier. */
export const DIAGNOSTIC_SECTORS: Sector[] = SECTORS_CONFIG.flatMap((sector) => (sector.diagnostic ? [sector.diagnostic] : []))
export const SECTOR_LABEL_BY_KEY: Record<string, string> = Object.fromEntries(SECTORS_CONFIG.map((sector) => [sector.key, sector.label.fr]))

/** Retrouve un secteur à partir de son slug public ou de sa clé stockée (anciennes URL comprises). */
export function getSector(value: unknown): SectorConfig | null {
  if (typeof value !== 'string') return null
  return SECTORS_CONFIG.find((sector) => sector.slug === value || sector.key === value) ?? null
}
export const getSectorLabel = (value: unknown): string => getSector(value)?.label.fr ?? (typeof value === 'string' ? value : '')
/** Un secteur connu sans questionnaire : le client voit « questionnaire en préparation ». */
export const isDiagnosticPending = (value: unknown): boolean => {
  const sector = getSector(value)
  return Boolean(sector && !sector.diagnostic)
}
