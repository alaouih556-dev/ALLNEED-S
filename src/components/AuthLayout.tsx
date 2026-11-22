import { SECTORS_CONFIG, type SectorConfig } from '@/lib/sectors'
import type { ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { ArrowLeft, ClipboardCheck, Network, ShieldCheck } from 'lucide-react'
import { PublicHeader } from '@/components/marketing'
import { cn } from '@/lib/utils'

const ASIDE_STEPS = [
  { icon: ClipboardCheck, title: 'On écoute', detail: 'Votre activité, vos échéances, vos irritants.' },
  { icon: Network, title: 'On met à plat', detail: 'Les faits et les priorités à valider ensemble.' },
  { icon: ShieldCheck, title: 'Vous décidez', detail: 'Aucune mission sans votre accord.' },
]

export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
  wide = false,
  sector = null,
}: {
  title: string
  subtitle: string
  children: ReactNode
  footer?: ReactNode
  wide?: boolean
  /** Secteur choisi : remplace le rappel général dans le panneau sombre. */
  sector?: SectorConfig | null
}) {
  return (
    <>
      <PublicHeader />
      <div className="mk mk-auth">
        <div className="mk-auth-main">
          <div className={cn('mk-auth-inner', wide && 'wide')}>
            <p className="mk-eyebrow">ALLNEEDS · Espace client</p>
            <h1 className="mk-auth-title">{title}</h1>
            <p className="mk-auth-sub">{subtitle}</p>

            <div className="mk-auth-body">{children}</div>

            {footer ? <div className="mk-auth-foot">{footer}</div> : null}

            <Link to="/" className="mk-auth-back">
              <ArrowLeft />
              Retour au site
            </Link>
          </div>
        </div>

        <aside className="mk-auth-aside" aria-label="Le premier échange ALLNEEDS">
          <div className="mk-auth-aside-inner">
            <span className="mk-pill" style={{ justifySelf: 'start' }}>
              {sector ? <>ALLNEEDS · <span style={{ textTransform: 'uppercase' }}>{sector.label.fr}</span></> : 'Une plateforme · 7 secteurs'}
            </span>
            <h2>
              En 2h15, passons du trop-plein à <span className="mk-hl">un cap clair.</span>
            </h2>
            <p className="mk-lead" style={{ color: '#b9c8de' }}>
              Votre premier échange sert à comprendre votre quotidien, faire émerger trois priorités et vous laisser
              décider de la suite.
            </p>
            <ol className="mk-auth-steps">
              {ASIDE_STEPS.map(({ icon: Icon, title: stepTitle, detail }) => (
                <li key={stepTitle}>
                  <span className="ic">
                    <Icon />
                  </span>
                  <div>
                    <strong>{stepTitle}</strong>
                    <span>{detail}</span>
                  </div>
                </li>
              ))}
            </ol>
            <div className="mk-auth-tags">
              {(sector ? [sector] : SECTORS_CONFIG).map((item) => (
                <span key={item.slug}>{item.label.fr}</span>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </>
  )
}
