import { LanguageSwitch } from '@/i18n/LanguageSwitch'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import {
  ArrowLeft,
  ArrowRight,
  Briefcase,
  CalendarCheck,
  Check,
  ExternalLink,
  FolderOpen,
  Gauge,
  HeartPulse,
  Inbox,
  Landmark,
  LogOut,
  Maximize2,
  Minimize2,
  Receipt,
  ShieldCheck,
  Sparkles,
  Star,
  StickyNote,
  Target,
  UserRound,
  Users,
  UsersRound,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/features/auth/AuthContext'

/* ------------------------------------------------------------------ */
/* Types du contenu servi par /api/sales/presentation                  */
/* ------------------------------------------------------------------ */

type Item = { icon: string; title: string; detail: string; question?: string; benefit?: string }
type Base = { id: string; nav: string; eyebrow: string; title: string; lead?: string; talkingPoint?: string }
type Section =
  | (Base & { kind: 'intro'; highlight: string; chips: string[]; audience: string[] })
  | (Base & { kind: 'problem'; items: Item[]; footnote?: string })
  | (Base & { kind: 'solution'; pillars: Item[] })
  | (Base & { kind: 'features'; features: Item[] })
  | (Base & { kind: 'steps'; steps: Array<{ title: string; detail: string }> })
  | (Base & { kind: 'demo'; slides: Array<{ image: string; title: string; caption: string }> })
  | (Base & { kind: 'benefits'; stats: Array<{ value: string; label: string; detail: string }>; benefits: string[] })
  | (Base & {
      kind: 'cta'
      actions: Array<{ label: string; to: string; primary?: boolean }>
      offer?: { title: string; detail: string; condition?: string }
      contact?: { placeholder: boolean; label: string }
    })

export interface PresentationContent {
  version: number
  brand: string
  audience: string
  sections: Section[]
}

const ICONS: Record<string, ReactNode> = {
  calendar: <CalendarCheck />,
  star: <Star />,
  users: <Users />,
  receipt: <Receipt />,
  landmark: <Landmark />,
  heart: <HeartPulse />,
  shield: <ShieldCheck />,
  user: <UserRound />,
  gauge: <Gauge />,
  target: <Target />,
  inbox: <Inbox />,
  briefcase: <Briefcase />,
  folder: <FolderOpen />,
  team: <UsersRound />,
}
const icon = (name: string) => ICONS[name] ?? <Sparkles />

/* ------------------------------------------------------------------ */
/* Lecteur de présentation                                             */
/* ------------------------------------------------------------------ */

function indexFromHash(sections: Section[]) {
  const id = typeof window === 'undefined' ? '' : decodeURIComponent(window.location.hash.slice(1))
  const found = sections.findIndex((s) => s.id === id)
  return found >= 0 ? found : 0
}

export function SalesPresentation({ content }: { content: PresentationContent }) {
  const { sections } = content
  const auth = useAuth()
  const navigate = useNavigate()
  const rootRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const [index, setIndex] = useState(() => indexFromHash(sections))
  const [direction, setDirection] = useState<1 | -1>(1)
  const [notes, setNotes] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  const total = sections.length
  const section = sections[index]

  const go = useCallback(
    (next: number) => {
      const clamped = Math.max(0, Math.min(total - 1, next))
      setIndex((current) => {
        if (clamped !== current) setDirection(clamped > current ? 1 : -1)
        return clamped
      })
    },
    [total],
  )

  // Section courante dans l'URL : un rafraîchissement garde la même diapositive.
  useEffect(() => {
    const id = sections[index]?.id
    if (id && window.location.hash !== `#${id}`) window.history.replaceState(null, '', `#${id}`)
    stageRef.current?.scrollTo({ top: 0 })
  }, [index, sections])

  // Lien direct vers une section (#demo…) ou bouton Précédent du navigateur.
  useEffect(() => {
    const onHash = () => go(indexFromHash(sections))
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [go, sections])

  useEffect(() => {
    const onFs = () => setFullscreen(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', onFs)
    return () => document.removeEventListener('fullscreenchange', onFs)
  }, [])

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen?.()
    else void rootRef.current?.requestFullscreen?.().catch(() => undefined)
  }, [])

  // Clavier : flèches, espace, Début/Fin, chiffres, F (plein écran), N (notes).
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))) return
      if (event.metaKey || event.ctrlKey || event.altKey) return
      const key = event.key
      if (['ArrowRight', 'PageDown', ' '].includes(key)) { event.preventDefault(); go(index + 1) }
      else if (['ArrowLeft', 'PageUp'].includes(key)) { event.preventDefault(); go(index - 1) }
      else if (key === 'Home') go(0)
      else if (key === 'End') go(total - 1)
      else if (key.toLowerCase() === 'f') toggleFullscreen()
      else if (key.toLowerCase() === 'n') setNotes((v) => !v)
      else if (/^[1-9]$/.test(key) && Number(key) <= total) go(Number(key) - 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go, index, total, toggleFullscreen])

  // Balayage horizontal sur mobile et tablette.
  const touch = useRef<{ x: number; y: number } | null>(null)
  const onTouchStart = (e: React.TouchEvent) => { touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY } }
  const onTouchEnd = (e: React.TouchEvent) => {
    const start = touch.current
    touch.current = null
    if (!start) return
    const dx = e.changedTouches[0].clientX - start.x
    const dy = e.changedTouches[0].clientY - start.y
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.4) go(index + (dx < 0 ? 1 : -1))
  }

  const isSalesAccount = auth.user?.role === 'sales'
  const backTo = auth.user?.role === 'admin' ? '/admin' : auth.user?.role === 'concierge' ? '/account-manager' : auth.user?.role === 'crm' ? '/crm' : null
  async function quit() {
    if (document.fullscreenElement) await document.exitFullscreen?.().catch(() => undefined)
    await auth.logout()
    await navigate({ to: '/connexion' })
  }

  return (
    <div ref={rootRef} className="sp-root" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <div className="sp-glow" aria-hidden />

      <header className="sp-top">
        <div className="sp-brand">
          <span className="sp-brand-mark"><img src="/allneeds-icon.svg" alt="" /></span>
          <span className="sp-brand-text">
            <b>{content.brand}</b>
            <small>{content.audience}</small>
          </span>
        </div>
        <nav className="sp-chapters" aria-label="Sections de la présentation">
          {sections.map((s, i) => (
            <button key={s.id} type="button" onClick={() => go(i)} className={cn(i === index && 'is-on', i < index && 'is-done')} aria-current={i === index ? 'step' : undefined}>
              <i>{i + 1}</i>
              <span>{s.nav}</span>
            </button>
          ))}
        </nav>
        <div className="sp-tools">
          <LanguageSwitch tone="dark" className="sp-lang" />
          <button type="button" className={cn('sp-icon-btn', notes && 'is-on')} onClick={() => setNotes((v) => !v)} title="Notes du commercial (N)" aria-pressed={notes}>
            <StickyNote size={17} />
          </button>
          <button type="button" className="sp-icon-btn" onClick={toggleFullscreen} title={fullscreen ? 'Quitter le plein écran (F)' : 'Plein écran (F)'}>
            {fullscreen ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
          </button>
          {backTo ? (
            <Link to={backTo as any} className="sp-icon-btn" title="Retour à mon espace"><X size={18} /></Link>
          ) : isSalesAccount ? (
            <button type="button" className="sp-icon-btn" onClick={() => void quit()} title="Se déconnecter"><LogOut size={17} /></button>
          ) : null}
        </div>
        <div className="sp-progress" aria-hidden><i style={{ width: `${((index + 1) / total) * 100}%` }} /></div>
      </header>

      <main ref={stageRef} className="sp-stage">
        <article key={section.id} className={cn('sp-slide', direction === 1 ? 'from-right' : 'from-left')} aria-roledescription="diapositive" aria-label={`${index + 1} sur ${total} : ${section.nav}`}>
          <SlideBody section={section} onNext={() => go(index + 1)} />
        </article>
      </main>

      {notes && section.talkingPoint ? (
        <aside className="sp-notes" role="note">
          <StickyNote size={15} />
          <p><b>Note pour le commercial · </b>{section.talkingPoint}</p>
          <button type="button" onClick={() => setNotes(false)} aria-label="Masquer la note"><X size={15} /></button>
        </aside>
      ) : null}

      <footer className="sp-bottom">
        <button type="button" className="sp-nav-btn" onClick={() => go(index - 1)} disabled={index === 0}>
          <ArrowLeft size={17} /><span>Précédent</span>
        </button>
        <div className="sp-dots" role="tablist" aria-label="Aller à une section">
          {sections.map((s, i) => (
            <button key={s.id} type="button" role="tab" aria-selected={i === index} aria-label={s.nav} className={cn(i === index && 'is-on')} onClick={() => go(i)} />
          ))}
          <span className="sp-counter">{index + 1} / {total}</span>
        </div>
        <button type="button" className="sp-nav-btn is-primary" onClick={() => go(index + 1)} disabled={index === total - 1}>
          <span>{index === total - 1 ? 'Fin' : sections[index + 1]?.nav ?? 'Suivant'}</span><ArrowRight size={17} />
        </button>
      </footer>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Diapositives                                                        */
/* ------------------------------------------------------------------ */

function Heading({ section, center }: { section: Section; center?: boolean }) {
  return (
    <div className={cn('sp-heading', center && 'is-center')}>
      <span className="sp-eyebrow">{section.eyebrow}</span>
      <h2>{section.title}</h2>
      {section.lead ? <p className="sp-lead">{section.lead}</p> : null}
    </div>
  )
}

function SlideBody({ section, onNext }: { section: Section; onNext: () => void }) {
  switch (section.kind) {
    case 'intro':
      return (
        <div className="sp-intro">
          <span className="sp-eyebrow">{section.eyebrow}</span>
          <h1>
            {section.title}
            <em>{section.highlight}</em>
          </h1>
          <p className="sp-lead">{section.lead}</p>
          <ul className="sp-chips">
            {section.chips.map((c) => <li key={c}><Check size={14} />{c}</li>)}
          </ul>
          <div className="sp-audience">
            <small>Pour</small>
            {section.audience.map((a) => <span key={a}>{a}</span>)}
          </div>
          <button type="button" className="sp-start" onClick={onNext}>Commencer la présentation <ArrowRight size={17} /></button>
        </div>
      )

    case 'problem':
      return <ProblemSlide section={section} />

    case 'solution':
      return (
        <>
          <Heading section={section} />
          <div className="sp-grid sp-grid-3">
            {section.pillars.map((p, i) => (
              <div key={p.title} className="sp-card sp-pillar" style={{ animationDelay: `${120 + i * 90}ms` }}>
                <span className="sp-card-icon">{icon(p.icon)}</span>
                <h3>{p.title}</h3>
                <p>{p.detail}</p>
              </div>
            ))}
          </div>
        </>
      )

    case 'features':
      return <FeatureSlide section={section} />

    case 'steps':
      return (
        <>
          <Heading section={section} />
          <ol className="sp-steps">
            {section.steps.map((s, i) => (
              <li key={s.title} style={{ animationDelay: `${100 + i * 80}ms` }}>
                <span className="sp-step-num">{i + 1}</span>
                <div>
                  <h3>{s.title}</h3>
                  <p>{s.detail}</p>
                </div>
              </li>
            ))}
          </ol>
        </>
      )

    case 'demo':
      return <DemoSlide section={section} />

    case 'benefits':
      return (
        <>
          <Heading section={section} />
          <div className="sp-grid sp-grid-4">
            {section.stats.map((s, i) => (
              <div key={s.label} className="sp-card sp-stat" style={{ animationDelay: `${100 + i * 80}ms` }}>
                <b>{s.value}</b>
                <h3>{s.label}</h3>
                <p>{s.detail}</p>
              </div>
            ))}
          </div>
          <ul className="sp-benefits">
            {section.benefits.map((b) => <li key={b}><Check size={16} />{b}</li>)}
          </ul>
        </>
      )

    case 'cta':
      return <CtaSlide section={section} />
  }
}

function ProblemSlide({ section }: { section: Extract<Section, { kind: 'problem' }> }) {
  const [picked, setPicked] = useState<string[]>([])
  const toggle = (title: string) => setPicked((p) => (p.includes(title) ? p.filter((x) => x !== title) : [...p, title]))
  return (
    <>
      <Heading section={section} />
      <div className="sp-grid sp-grid-5">
        {section.items.map((item, i) => {
          const on = picked.includes(item.title)
          return (
            <button key={item.title} type="button" onClick={() => toggle(item.title)} aria-pressed={on} className={cn('sp-card sp-problem', on && 'is-on')} style={{ animationDelay: `${80 + i * 70}ms` }}>
              <span className="sp-card-icon">{icon(item.icon)}</span>
              <h3>{item.title}</h3>
              <p className="sp-question">{`«\u00a0${(item.question ?? '').replace(/ ([?!:;])/g, '\u00a0$1')}\u00a0»`}</p>
              <p>{item.detail}</p>
              <span className="sp-check">{on ? <><Check size={13} />Concerné</> : 'Toucher si concerné'}</span>
            </button>
          )
        })}
      </div>
      {section.footnote ? <p className="sp-footnote">{picked.length ? `${picked.length} sujet${picked.length > 1 ? 's' : ''} identifié${picked.length > 1 ? 's' : ''}. ` : ''}{section.footnote}</p> : null}
    </>
  )
}

function FeatureSlide({ section }: { section: Extract<Section, { kind: 'features' }> }) {
  const [active, setActive] = useState(0)
  const current = section.features[active]
  return (
    <>
      <Heading section={section} />
      <div className="sp-features">
        <div className="sp-feature-list" role="tablist">
          {section.features.map((f, i) => (
            <button key={f.title} type="button" role="tab" aria-selected={i === active} className={cn(i === active && 'is-on')} onClick={() => setActive(i)}>
              <span className="sp-card-icon">{icon(f.icon)}</span>
              <span>{f.title}</span>
              <ArrowRight size={15} className="sp-feature-arrow" />
            </button>
          ))}
        </div>
        <div key={current.title} className="sp-card sp-feature-detail" role="tabpanel">
          <span className="sp-card-icon is-lg">{icon(current.icon)}</span>
          <h3>{current.title}</h3>
          <p>{current.detail}</p>
          {current.benefit ? <p className="sp-benefit-tag"><Sparkles size={14} />{current.benefit}</p> : null}
        </div>
      </div>
    </>
  )
}

function DemoSlide({ section }: { section: Extract<Section, { kind: 'demo' }> }) {
  const [active, setActive] = useState(0)
  const [broken, setBroken] = useState<Record<string, boolean>>({})
  const slide = section.slides[active]
  return (
    <>
      <Heading section={section} />
      <div className="sp-demo">
        <figure className="sp-browser">
          <div className="sp-browser-bar" aria-hidden><i /><i /><i /><span>allneeds · {slide.title}</span></div>
          <div className="sp-browser-view">
            {broken[slide.image] ? (
              <div className="sp-browser-missing">Capture à ajouter : {slide.image}</div>
            ) : (
              <img key={slide.image} src={slide.image} alt={slide.title} onError={() => setBroken((b) => ({ ...b, [slide.image]: true }))} />
            )}
          </div>
          <figcaption><b>{slide.title}</b> — {slide.caption}</figcaption>
        </figure>
        <div className="sp-thumbs" role="tablist" aria-label="Captures">
          {section.slides.map((s, i) => (
            <button key={s.image} type="button" role="tab" aria-selected={i === active} className={cn(i === active && 'is-on')} onClick={() => setActive(i)}>
              <span className="sp-thumb-img">{broken[s.image] ? null : <img src={s.image} alt="" loading="lazy" onError={() => setBroken((b) => ({ ...b, [s.image]: true }))} />}</span>
              <span>{s.title}</span>
            </button>
          ))}
        </div>
      </div>
    </>
  )
}

const CONTACT_KEY = 'an-sales-contact'
type Contact = { name: string; phone: string; email: string }
function readContact(): Contact {
  try {
    return { name: '', phone: '', email: '', ...(JSON.parse(window.localStorage.getItem(CONTACT_KEY) || '{}') as Partial<Contact>) }
  } catch {
    return { name: '', phone: '', email: '' }
  }
}

function CtaSlide({ section }: { section: Extract<Section, { kind: 'cta' }> }) {
  const [contact, setContact] = useState<Contact>(readContact)
  const update = (key: keyof Contact, value: string) => {
    setContact((c) => {
      const next = { ...c, [key]: value.slice(0, 120) }
      try { window.localStorage.setItem(CONTACT_KEY, JSON.stringify(next)) } catch { /* stockage indisponible */ }
      return next
    })
  }
  const empty = !contact.name && !contact.phone && !contact.email
  return (
    <div className="sp-cta">
      <Heading section={section} center />
      <div className="sp-cta-actions">
        {section.actions.map((a) => (
          <a key={a.to} href={a.to} target="_blank" rel="noopener" className={cn('sp-cta-btn', a.primary && 'is-primary')}>
            {a.label}
            {a.primary ? <ArrowRight size={17} /> : <ExternalLink size={15} />}
          </a>
        ))}
      </div>
      <div className="sp-grid sp-grid-2 sp-cta-cards">
        {section.offer ? (
          <div className="sp-card sp-offer">
            <span className="sp-eyebrow">{section.offer.title}</span>
            <p>{section.offer.detail}</p>
            {section.offer.condition ? <small>{section.offer.condition}</small> : null}
          </div>
        ) : null}
        {section.contact ? (
          <div className={cn('sp-card sp-contact', empty && 'is-placeholder')}>
            <span className="sp-eyebrow">Votre interlocuteur</span>
            {empty ? <p className="sp-placeholder-tag">{section.contact.label}</p> : null}
            <input value={contact.name} onChange={(e) => update('name', e.target.value)} placeholder="Nom du commercial" aria-label="Nom du commercial" />
            <input value={contact.phone} onChange={(e) => update('phone', e.target.value)} placeholder="Téléphone" aria-label="Téléphone" inputMode="tel" />
            <input value={contact.email} onChange={(e) => update('email', e.target.value)} placeholder="E-mail" aria-label="E-mail" inputMode="email" />
            <small>Enregistré uniquement sur cet appareil.</small>
          </div>
        ) : null}
      </div>
    </div>
  )
}
