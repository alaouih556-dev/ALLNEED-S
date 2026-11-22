import { useEffect, useMemo, type SyntheticEvent } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { ArrowRight, ExternalLink, MapPin, Orbit } from 'lucide-react'
import { CtaBand } from '@/components/marketing'
import { UniversStory } from '@/components/UniversStory'
import { UNIVERS_COMPANIES, isPlaceholderCompany, type UniversCompany } from '@/data/univers'
import { t, useLang } from '@/i18n'
import { getSector, getSectorLabel, type SectorSlug } from '@/lib/sectors'

const PAGE_TITLE = 'L’univers ALLNEEDS — Entreprises et partenaires'
const PAGE_DESCRIPTION = 'Découvrez les entreprises et partenaires avec lesquels ALLNEEDS a travaillé, dans ses 7 secteurs d’activité.'
const PLACEHOLDER_LOGO = '/univers/placeholder-logo.svg'

export const Route = createFileRoute('/_public/univers')({
  validateSearch: (search: Record<string, unknown>): { secteur?: SectorSlug } => {
    const sector = getSector(search.secteur)
    return sector ? { secteur: sector.slug } : {}
  },
  component: UniversPage,
  head: () => ({ meta: [{ title: PAGE_TITLE }, { name: 'description', content: PAGE_DESCRIPTION }] }),
})

/** Les entrées d'exemple ne doivent jamais passer pour de vraies références en production. */
const COMPANIES = UNIVERS_COMPANIES.filter((company) => import.meta.env.DEV || !isPlaceholderCompany(company))

const useLogoFallback = () => (event: SyntheticEvent<HTMLImageElement>) => {
  if (!event.currentTarget.src.endsWith(PLACEHOLDER_LOGO)) event.currentTarget.src = PLACEHOLDER_LOGO
}

function UniversPage() {
  const { secteur } = Route.useSearch()
  const lang = useLang()
  const onLogoError = useLogoFallback()
  const companies = useMemo(() => COMPANIES.filter((company) => !secteur || company.sector === secteur), [secteur])

  useEffect(() => {
    document.title = t(PAGE_TITLE)
    document.querySelector('meta[name="description"]')?.setAttribute('content', t(PAGE_DESCRIPTION))
  }, [lang])

  const inscriptionSearch = secteur ? { secteur } : {}

  return (
    <div className="mk">
      <UniversStory companies={companies} secteur={secteur} onLogoError={onLogoError} />

      <section className="mk-sec mk-bg-white">
        <div className="mk-wrap">
          {companies.length ? (
            <>
              <div className="mk-head" style={{ marginBottom: 36 }}>
                <p className="mk-eyebrow">{secteur ? getSectorLabel(secteur) : 'Tous les secteurs'}</p>
                <h2 className="mk-h2">Ils font partie de l’univers ALLNEEDS.</h2>
              </div>
              <div className="sx-company-grid">
                {companies.map((company) => <CompanyCard key={company.id} company={company} lang={lang} onLogoError={onLogoError} />)}
              </div>
            </>
          ) : (
            <div className="sx-empty">
              <span className="mk-sector-icon"><Orbit /></span>
              <h2 className="mk-h2">Bientôt dans l’univers ALLNEEDS</h2>
              <p className="mk-body">{secteur ? 'Les entreprises de ce secteur apparaîtront ici. La vôtre pourrait être la première.' : 'Les entreprises et partenaires apparaîtront ici très prochainement.'}</p>
              <Link to="/inscription" search={inscriptionSearch} className="mk-btn mk-btn-dark">Faire le point gratuitement <ArrowRight /></Link>
            </div>
          )}
        </div>
      </section>

      {companies.length ? (
        <CtaBand
          eyebrow="Rejoindre l’univers"
          title="Votre entreprise a sa place ici."
          description="Commencez par un diagnostic offert, sans engagement."
          primary={{ label: 'Faire le point gratuitement', to: '/inscription', search: inscriptionSearch }}
          secondary={{ label: 'Nous contacter', to: '/contact' }}
          showOffer={false}
        />
      ) : null}
    </div>
  )
}

function CompanyCard({ company, lang, onLogoError }: { company: UniversCompany; lang: 'fr' | 'en'; onLogoError: (event: SyntheticEvent<HTMLImageElement>) => void }) {
  return (
    <article id={`entreprise-${company.id}`} className="sx-company">
      <div className="sx-company-top">
        <img src={company.logo} alt={`Logo ${company.name}`} width={56} height={56} loading="lazy" onError={onLogoError} />
        <div className="min-w-0">
          <h3 className="mk-h4">{company.name}</h3>
          <p className="sx-city"><MapPin /> {company.city}</p>
        </div>
      </div>
      <span className="sx-sector-badge">{getSectorLabel(company.sector)}</span>
      {isPlaceholderCompany(company) ? <span className="sx-placeholder">Exemple à remplacer</span> : null}
      <p className="mk-small">{lang === 'en' ? company.description_en : company.description_fr}</p>
      {company.url ? <a href={company.url} target="_blank" rel="noopener noreferrer" className="sx-company-link">Voir le site <ExternalLink /></a> : null}
    </article>
  )
}
