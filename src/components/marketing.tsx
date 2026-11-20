import { useState, type ReactNode } from 'react'
import { Link, type LinkProps } from '@tanstack/react-router'
import { useAuth, workspacePathForRole } from '@/features/auth/AuthContext'
import {
  AlertCircle,
  ArrowRight,
  Check,
  CheckCircle2,
  Info,
  GraduationCap,
  HeartPulse,
  Menu,
  Plane,
  Plus,
  X,
} from 'lucide-react'
import { LAUNCH_OFFER, SECTORS, SECTOR_LABEL, SECTOR_ORDER } from '@/data/catalog'
import { cn } from '@/lib/utils'
import { clearSelectedSector, useSelectedSector } from '@/lib/sector-filter'
import { DEFAULT_SECTOR, SINGLE_SECTOR } from '@/lib/active-sectors'
import { Badge, Button, Card } from '@/components/ui'
import type { FeatureRow, MissionCode, Sector } from '@/types'
import { LanguageSwitch } from '@/i18n/LanguageSwitch'

/* ------------------------------------------------------------------ */
/* Banner                                                              */
/* ------------------------------------------------------------------ */

export function LaunchBanner() {
  return (
    <div className="mk mk-announce">
      <div className="mk-wrap">
        <strong>Premier échange offert</strong>
        <span>2h15 pour clarifier vos priorités, sans engagement</span>
        <Link to="/inscription">
          Choisir un créneau <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Header                                                              */
/* ------------------------------------------------------------------ */

const BASE_PUBLIC_LINKS = [
  { label: SINGLE_SECTOR ? SECTOR_LABEL[DEFAULT_SECTOR] : 'Nos secteurs', to: '/secteurs' },
  { label: 'À propos', to: '/a-propos' },
  { label: 'FAQ', to: '/faq' },
] as const

export function PublicHeader() {
  const [open, setOpen] = useState(false)
  const selectedSector = useSelectedSector()
  const auth = useAuth()
  const accountPath = auth.status === 'authenticated' ? workspacePathForRole(auth.user?.role) : null
  const publicLinks = [
    { label: 'Accueil', to: '/' as const },
    ...BASE_PUBLIC_LINKS,
  ]

  return (
    <header className="mk mk-header public-sticky top-0 z-40">
      <div className="mk-wrap mk-header-row">
        <Link to="/" className="mk-header-logo" aria-label="ALLNEEDS — accueil">
          <img src="/allneeds-logo.svg" alt="allneeds — Find it. Get it. Fast." />
        </Link>

        <nav className="mk-nav" aria-label="Navigation principale">
          {publicLinks.map((link) => (
            <PublicNavigationLink
              key={link.to}
              to={link.to}
              sector={selectedSector}
              activeProps={{ className: 'active' }}
            >
              {link.label}
            </PublicNavigationLink>
          ))}
        </nav>

        <div className="mk-header-actions">
          <LanguageSwitch />
          <Link to={(accountPath ?? '/connexion') as any} className="mk-signin">
            {accountPath ? 'Mon espace' : 'Se connecter'}
          </Link>
          <Link to="/inscription" className="mk-btn mk-btn-dark mk-btn-sm">
            Faire le point gratuitement
            <ArrowRight />
          </Link>
        </div>

        <LanguageSwitch className="mk-lang-mobile" />
        <button
          type="button"
          className="mk-burger"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? 'Fermer le menu' : 'Ouvrir le menu'}
          aria-expanded={open}
        >
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {open ? (
        <div className="mk-mobile lg:hidden">
          <div className="mk-wrap">
            {publicLinks.map((link) => (
              <PublicNavigationLink
                key={link.to}
                to={link.to}
                sector={selectedSector}
                onClick={() => setOpen(false)}
                className="mk-mobile-link"
              >
                {link.label}
              </PublicNavigationLink>
            ))}
            <div className="mk-mobile-actions">
              <Link to="/inscription" onClick={() => setOpen(false)} className="mk-btn mk-btn-dark">
                Faire le point gratuitement <ArrowRight />
              </Link>
              <Link to={(accountPath ?? '/connexion') as any} onClick={() => setOpen(false)} className="mk-btn mk-btn-line">
                {accountPath ? 'Mon espace' : 'Se connecter'}
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </header>
  )
}

/* ------------------------------------------------------------------ */
/* Footer                                                              */
/* ------------------------------------------------------------------ */

export function PublicFooter() {
  const selectedSector = useSelectedSector()
  return (
    <footer className="mk mk-footer">
      <div className="mk-wrap">
        <div className="mk-footer-top">
          <h2>Un premier échange pour clarifier vos priorités et décider de la suite.</h2>
          <div className="mk-cta-row">
            <Link to="/inscription" className="mk-btn mk-btn-cyan">
              Faire le point gratuitement <ArrowRight />
            </Link>
            <Link to="/contact" className="mk-btn mk-btn-line-light">
              Contacter l’équipe
            </Link>
          </div>
        </div>

        <div className="mk-footer-cols">
          <div className="mk-footer-brand">
            <Link to="/" className="mk-footer-logo" aria-label="ALLNEEDS — accueil">
              <img src="/allneeds-logo-dark.svg" alt="allneeds — Find it. Get it. Fast." width={1030} height={320} />
            </Link>
            <p className="mk-small" style={{ marginTop: 20, maxWidth: 300, color: '#a9bbd2' }}>
              Votre réseau de solutions pour entreprises et établissements. Nous partons de votre situation, pas d’un
              catalogue.
            </p>
          </div>

          <div>
            <h3>Secteurs</h3>
            <ul>
              {(selectedSector ? [selectedSector] : SECTOR_ORDER).map((sector) => (
                <li key={sector}>
                  <Link to="/secteurs/$sector" params={{ sector }}>
                    {SECTOR_LABEL[sector]}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3>Diagnostic offert</h3>
            <ul>
              <li><Link to="/diagnostic">Comment ça se déroule</Link></li>
              <li><Link to="/inscription">Comprendre votre situation</Link></li>
              <li><Link to="/inscription">Définir les prochaines étapes</Link></li>
              <li><Link to="/inscription">Réserver un échange</Link></li>
            </ul>
          </div>

          <div>
            <h3>Ressources</h3>
            <ul>
              <li><Link to="/faq">FAQ</Link></li>
              <li><Link to="/conditions">Conditions de l’offre</Link></li>
              <li><Link to="/connexion">Se connecter</Link></li>
            </ul>
          </div>

          <div>
            <h3>ALLNEEDS</h3>
            <ul>
              <li><Link to="/a-propos">Qui sommes-nous</Link></li>
              <li><Link to="/contact">Contact</Link></li>
              <li><Link to="/inscription">Créer un compte</Link></li>
            </ul>
            <p className="mk-small" style={{ marginTop: 18, fontSize: '.78rem', color: '#8ea2bd' }}>
              Contact et informations légales disponibles avant toute souscription.
            </p>
          </div>
        </div>

        <div className="mk-footer-bottom">
          <p>© {new Date().getFullYear()} ALLNEEDS · {SECTOR_ORDER.map((s) => SECTOR_LABEL[s]).join(' · ')}</p>
          <p>
            ALLNEEDS ne fournit pas de conseil juridique, fiscal ou comptable et ne négocie pas pour le compte du
            membre.
          </p>
        </div>
      </div>
    </footer>
  )
}

/* ------------------------------------------------------------------ */
/* Sector switcher                                                     */
/* ------------------------------------------------------------------ */

const SECTOR_ICONS: Record<Sector, ReactNode> = {
  enseignement: <GraduationCap className="h-4 w-4" />,
  sante: <HeartPulse className="h-4 w-4" />,
  tourisme: <Plane className="h-4 w-4" />,
}

export function SectorTabs({ active }: { active?: Sector }) {
  return (
    <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      {SECTOR_ORDER.map((sector) => (
        <Link
          key={sector}
          to="/secteurs/$sector"
          params={{ sector }}
          className={cn(
            'flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition',
            active === sector
              ? 'border-ink-950 bg-ink-950 text-white'
              : 'border-ink-200 bg-white text-ink-600 hover:border-ink-400 hover:text-ink-950',
          )}
        >
          {SECTOR_ICONS[sector]}
          {SECTOR_LABEL[sector]}
        </Link>
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Mission tabs                                                        */
/* ------------------------------------------------------------------ */

export function MissionTabs({ active, sector }: { active?: MissionCode; sector?: Sector }) {
  const codes: MissionCode[] = ['STARTER', 'PRO', 'PERFORMANCE']
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {codes.map((code) => (
        <Link
          key={code}
          to="/inscription"
          className={cn(
            'rounded-xl border px-4 py-3 transition',
            active === code
              ? 'border-brand-600 bg-brand-50 shadow-sm'
              : 'border-ink-200 bg-white hover:border-ink-400',
          )}
        >
          <p className={cn('text-sm font-bold', active === code ? 'text-brand-800' : 'text-ink-900')}>{code}</p>
          <p className="mt-0.5 text-xs text-ink-500">
            {code === 'STARTER' ? 'Comprendre' : code === 'PRO' ? 'Structurer' : 'Agir'}
          </p>
        </Link>
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Comparison table                                                    */
/* ------------------------------------------------------------------ */

function Cell({ value }: { value: string | null }) {
  if (value === null) return <span className="text-ink-300">—</span>
  if (value === '✓') return <Check className="mx-auto h-4 w-4 text-emerald-600" />
  return <span className="text-ink-800">{value}</span>
}

export function ComparisonTable({ rows, caption }: { rows: FeatureRow[]; caption?: string }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-card">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="bg-ink-50">
              <th className="w-[38%] border-b border-ink-100 px-5 py-4 text-left text-[0.68rem] font-semibold uppercase tracking-wider text-ink-500">
                {caption ?? 'Comparatif des formules'}
              </th>
              {(['STARTER', 'PRO', 'PERFORMANCE'] as MissionCode[]).map((code) => (
                <th key={code} className="border-b border-ink-100 px-5 py-4 text-center text-xs font-bold text-ink-900">
                  {code}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.filter((row) => !/^prix/i.test(row.label)).map((row) => (
              <tr key={row.label} className="transition hover:bg-ink-50/60">
                <td className="border-b border-ink-50 px-5 py-3 text-ink-700">{row.label}</td>
                <td className="border-b border-ink-50 px-5 py-3 text-center">
                  <Cell value={row.values[0]} />
                </td>
                <td className="border-b border-ink-50 bg-brand-50/40 px-5 py-3 text-center">
                  <Cell value={row.values[1]} />
                </td>
                <td className="border-b border-ink-50 px-5 py-3 text-center">
                  <Cell value={row.values[2]} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* FAQ                                                                 */
/* ------------------------------------------------------------------ */

export function FaqList({
  items,
  className,
  defaultOpen = 0,
}: {
  items: { q: string; a: string }[]
  className?: string
  /** Index of the answer shown open on first render; null keeps them all closed. */
  defaultOpen?: number | null
}) {
  const [open, setOpen] = useState<number | null>(defaultOpen)

  return (
    <div className={cn('mk mk-faq', className)}>
      {items.map((item, i) => {
        const isOpen = open === i
        const id = `faq-${i}-${item.q.length}`
        return (
          <div key={item.q} className={cn('mk-faq-item', isOpen && 'open')}>
            <button type="button" onClick={() => setOpen(isOpen ? null : i)} aria-expanded={isOpen} aria-controls={id}>
              <span>{item.q}</span>
              <i className="pm" aria-hidden="true">
                <Plus />
              </i>
            </button>
            {isOpen ? (
              <p id={id} className="mk-fade">
                {item.a}
              </p>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Page hero (inner public pages)                                      */
/* ------------------------------------------------------------------ */

export function PageHero({
  eyebrow,
  title,
  highlight,
  lead,
  children,
}: {
  eyebrow: string
  title: string
  /** Optional ending of the title, shown in the accent colour. */
  highlight?: string
  lead: string
  children?: ReactNode
}) {
  return (
    <section className="mk mk-hero mk-bg-ink">
      <div className="mk-wrap mk-page-hero">
        <span className="mk-pill">{eyebrow}</span>
        <h1 className="mk-h1">
          {title}
          {highlight ? <> <span className="mk-hl">{highlight}</span></> : null}
        </h1>
        <p className="mk-lead">{lead}</p>
        {children}
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* Sections                                                            */
/* ------------------------------------------------------------------ */

export function ReasonCards({ reasons }: { reasons: { title: string; detail: string }[] }) {
  return (
    <div className="grid gap-5 md:grid-cols-3">
      {reasons.map((reason, i) => (
        <Card key={reason.title} className="p-6">
          <span className="font-display text-3xl text-sand-400">0{i + 1}</span>
          <h3 className="mt-3 text-base font-semibold text-ink-950">{reason.title}</h3>
          <p className="mt-2 text-sm leading-relaxed text-ink-600">{reason.detail}</p>
        </Card>
      ))}
    </div>
  )
}

export function LeverGrid({ levers }: { levers: { id: string; name: string; detail: string }[] }) {
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
      {levers.map((lever) => (
        <Card key={lever.id} className="group p-5 transition hover:-translate-y-0.5 hover:shadow-lift">
          <h3 className="text-sm font-semibold text-ink-950">{lever.name}</h3>
          <p className="mt-2 text-sm leading-relaxed text-ink-500">{lever.detail}</p>
        </Card>
      ))}
    </div>
  )
}

export function StepBlocks({ steps }: { steps: { code: MissionCode; title: string; detail: string }[] }) {
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {steps.map((step, i) => (
        <div key={step.code} className="relative">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-ink-950 font-display text-lg text-sand-300">
              {i + 1}
            </span>
            <div>
              <p className="text-[0.65rem] font-semibold uppercase tracking-wider text-brand-700">{step.code}</p>
              <p className="text-sm font-semibold text-ink-950">{step.title.split('(')[0].trim()}</p>
            </div>
          </div>
          <p className="mt-4 text-sm leading-relaxed text-ink-600">{step.detail}</p>
        </div>
      ))}
    </div>
  )
}

export function OneLiners({ lines, links }: { lines: Record<MissionCode, string>; links: Record<MissionCode, string> }) {
  const codes: MissionCode[] = ['STARTER', 'PRO', 'PERFORMANCE']
  return (
    <div className="grid gap-5 md:grid-cols-3">
      {codes.map((code) => (
        <Card key={code} className="flex flex-col p-6">
          <Badge tone="brand">{code}</Badge>
          <p className="mt-4 flex-1 font-display text-xl leading-snug text-ink-900">{lines[code]}</p>
          <Link
            to="/inscription"
            
            className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 transition hover:text-brand-900"
          >
            {links[code]}
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </Card>
      ))}
    </div>
  )
}

export function CtaBand({
  title,
  description,
  primary = { label: 'Commencer par le diagnostic', to: '/diagnostic' },
  secondary = { label: 'Contacter notre équipe', to: '/contact' },
  eyebrow,
  showOffer = true,
}: {
  title: string
  description: string
  primary?: { label: string; to: LinkProps['to'] }
  secondary?: { label: string; to: LinkProps['to'] } | null
  /** Replaces the default launch-offer label above the title. */
  eyebrow?: string
  /** Show the launch-offer fine print under the description. */
  showOffer?: boolean
}) {
  return (
    <section className="mk mk-wrap" style={{ padding: '56px 24px' }}>
      <div className="mk-cta">
        <div style={{ display: 'grid', gap: 18 }}>
          <p className="mk-eyebrow" style={{ color: 'var(--mk-cyan-l)' }}>
            {eyebrow ?? `${LAUNCH_OFFER.label} · ${LAUNCH_OFFER.deadline}`}
          </p>
          <h2 className="mk-h2">{title}</h2>
          <p className="mk-lead" style={{ color: '#c5d4e8', maxWidth: 620 }}>{description}</p>
          {showOffer ? (
            <p className="mk-small" style={{ color: '#8ea2bd', fontSize: '.8rem' }}>
              Offre de lancement jusqu’au {LAUNCH_OFFER.deadline} {LAUNCH_OFFER.condition}, selon la première échéance.
            </p>
          ) : null}
        </div>
        <div className="mk-cta-actions">
          <Link to={primary.to} className="mk-btn mk-btn-cyan">
            {primary.label}
            <ArrowRight />
          </Link>
          {secondary ? (
            <Link to={secondary.to} className="mk-btn mk-btn-line-light">
              {secondary.label}
            </Link>
          ) : null}
        </div>
      </div>
    </section>
  )
}

export function HighlightGrid({ items }: { items: { title: string; detail: string }[] }) {
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((item) => (
        <div key={item.title} className="border-l-2 border-sand-300 pl-4">
          <p className="text-sm font-semibold text-ink-950">{item.title}</p>
          <p className="mt-1.5 text-sm leading-relaxed text-ink-600">{item.detail}</p>
        </div>
      ))}
    </div>
  )
}

export function sectorName(sector: Sector) {
  return SECTORS[sector].name
}

function PublicNavigationLink({to,sector,children,className,onClick,activeProps}:{to:string;sector:Sector|null;children:ReactNode;className?:string;onClick?:()=>void;activeProps?:{className:string}}){
 const handleClick=()=>{
  if(to==='/') clearSelectedSector()
  onClick?.()
 }
 const props={children,className,onClick:handleClick,activeProps}
 return <Link to={to as LinkProps['to']} {...props}/>
}

/* ------------------------------------------------------------------ */
/* Inline notice                                                       */
/* ------------------------------------------------------------------ */

export function Note({ tone = 'info', title, children }: { tone?: 'info' | 'danger' | 'success' | 'warning'; title?: string; children: ReactNode }) {
  const Icon = tone === 'danger' || tone === 'warning' ? AlertCircle : tone === 'success' ? CheckCircle2 : Info
  return (
    <div className={cn('mk-note', tone !== 'info' && tone)} role={tone === 'danger' ? 'alert' : undefined}>
      <Icon />
      <div>{title ? <strong>{title}. </strong> : null}{children}</div>
    </div>
  )
}
