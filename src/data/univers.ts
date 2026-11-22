import type { SectorSlug } from '@/lib/sectors'

export type UniversCompany = {
  id: string
  name: string
  /** Chemin public, par exemple /univers/nom-entreprise.svg */
  logo: string
  sector: SectorSlug
  city: string
  description_fr: string
  description_en: string
  url?: string
}

/**
 * PLACEHOLDERS À REMPLACER par les vraies entreprises et leurs logos.
 * Toute entrée dont l'id commence par « placeholder- » est visible en développement
 * uniquement : elle n'apparaît jamais sur le site en production.
 */
const LOGO = '/univers/placeholder-logo.svg'

export const UNIVERS_COMPANIES: UniversCompany[] = [
  { id: 'placeholder-sante-1', name: 'PLACEHOLDER Santé 1', logo: LOGO, sector: 'sante', city: 'Casablanca', description_fr: 'Exemple à remplacer : organisation de l’accueil et des rendez-vous.', description_en: 'Example to replace: reception and appointment organisation.' },
  { id: 'placeholder-sante-2', name: 'PLACEHOLDER Santé 2', logo: LOGO, sector: 'sante', city: 'Rabat', description_fr: 'Exemple à remplacer : diagnostic et priorités d’organisation.', description_en: 'Example to replace: diagnostic and organisational priorities.' },
  { id: 'placeholder-commerce-1', name: 'PLACEHOLDER Commerce 1', logo: LOGO, sector: 'commerce-distribution', city: 'Casablanca', description_fr: 'Exemple à remplacer : suivi du stock et des ventes.', description_en: 'Example to replace: stock and sales tracking.' },
  { id: 'placeholder-commerce-2', name: 'PLACEHOLDER Commerce 2', logo: LOGO, sector: 'commerce-distribution', city: 'Agadir', description_fr: 'Exemple à remplacer : structuration d’un réseau de vente.', description_en: 'Example to replace: structuring a sales network.' },
  { id: 'placeholder-enseignement-1', name: 'PLACEHOLDER Enseignement 1', logo: LOGO, sector: 'enseignement-prive', city: 'Rabat', description_fr: 'Exemple à remplacer : parcours d’inscription des familles.', description_en: 'Example to replace: family enrolment journey.' },
  { id: 'placeholder-enseignement-2', name: 'PLACEHOLDER Enseignement 2', logo: LOGO, sector: 'enseignement-prive', city: 'Fès', description_fr: 'Exemple à remplacer : organisation d’un centre de formation.', description_en: 'Example to replace: organising a training centre.' },
  { id: 'placeholder-tourisme-1', name: 'PLACEHOLDER Tourisme 1', logo: LOGO, sector: 'tourisme-hotellerie-restauration', city: 'Marrakech', description_fr: 'Exemple à remplacer : réservations directes et image.', description_en: 'Example to replace: direct bookings and image.' },
  { id: 'placeholder-tourisme-2', name: 'PLACEHOLDER Tourisme 2', logo: LOGO, sector: 'tourisme-hotellerie-restauration', city: 'Essaouira', description_fr: 'Exemple à remplacer : organisation de la saison.', description_en: 'Example to replace: seasonal organisation.' },
  { id: 'placeholder-industrie-1', name: 'PLACEHOLDER Industrie 1', logo: LOGO, sector: 'industrie-production', city: 'Tanger', description_fr: 'Exemple à remplacer : pilotage de la production.', description_en: 'Example to replace: production management.' },
  { id: 'placeholder-industrie-2', name: 'PLACEHOLDER Industrie 2', logo: LOGO, sector: 'industrie-production', city: 'Kénitra', description_fr: 'Exemple à remplacer : suivi des coûts et des délais.', description_en: 'Example to replace: cost and lead-time tracking.' },
  { id: 'placeholder-btp-1', name: 'PLACEHOLDER BTP 1', logo: LOGO, sector: 'btp-immobilier', city: 'Rabat', description_fr: 'Exemple à remplacer : suivi des chantiers et des devis.', description_en: 'Example to replace: site and quote tracking.' },
  { id: 'placeholder-btp-2', name: 'PLACEHOLDER BTP 2', logo: LOGO, sector: 'btp-immobilier', city: 'Casablanca', description_fr: 'Exemple à remplacer : organisation d’une agence immobilière.', description_en: 'Example to replace: organising an estate agency.' },
  { id: 'placeholder-services-1', name: 'PLACEHOLDER Services 1', logo: LOGO, sector: 'services-artisanat', city: 'Meknès', description_fr: 'Exemple à remplacer : structuration de l’offre de services.', description_en: 'Example to replace: structuring the service offer.' },
  { id: 'placeholder-services-2', name: 'PLACEHOLDER Services 2', logo: LOGO, sector: 'services-artisanat', city: 'Fès', description_fr: 'Exemple à remplacer : visibilité d’un atelier artisanal.', description_en: 'Example to replace: visibility for a craft workshop.' },
]

export const isPlaceholderCompany = (company: UniversCompany) => company.id.startsWith('placeholder-')
