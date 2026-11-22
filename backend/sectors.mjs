/**
 * Secteurs acceptés par l'API. `slug` = identifiant public, `key` = valeur stockée en base.
 * Doit rester aligné avec `src/lib/sectors.ts` (vérifié par `npm run test:sectors`).
 */
export const SECTOR_CATALOG = [
  { slug: 'sante', key: 'sante', label: 'Santé' },
  { slug: 'commerce-distribution', key: 'commerce-distribution', label: 'Commerce & distribution' },
  { slug: 'enseignement-prive', key: 'enseignement', label: 'Enseignement privé' },
  { slug: 'tourisme-hotellerie-restauration', key: 'tourisme', label: 'Tourisme / hôtellerie / restauration' },
  { slug: 'industrie-production', key: 'industrie-production', label: 'Industrie & production' },
  { slug: 'btp-immobilier', key: 'btp-immobilier', label: 'BTP & immobilier' },
  { slug: 'services-artisanat', key: 'services-artisanat', label: 'Services & artisanat' },
]

export const resolveSector = (value) => SECTOR_CATALOG.find((sector) => sector.slug === value || sector.key === value) || null
export const sectorLabel = (value) => resolveSector(value)?.label || value || ''
