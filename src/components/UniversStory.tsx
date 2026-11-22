import { useEffect, useId, useRef, useState, type SyntheticEvent } from 'react'
import { Link } from '@tanstack/react-router'
import { ArrowDown } from 'lucide-react'
import type { UniversCompany } from '@/data/univers'
import { SECTORS_CONFIG, type SectorSlug } from '@/lib/sectors'

const MAX_NETWORK_NODES = 24
/** Sur téléphone, le réseau reste lisible et chaque logo garde une zone de 44 px ; toutes les entreprises restent listées dessous. */
const MAX_COMPACT_NODES = 14
const MAX_SMALL_PHONE_NODES = 10
const COMPACT_QUERY = '(max-width: 899px)'
const SMALL_PHONE_QUERY = '(max-width: 359px), (max-width: 899px) and (max-height: 600px)'
const headerHeight = () => document.querySelector<HTMLElement>('.mk-header')?.offsetHeight ?? 65

const clamp = (value: number) => Math.min(1, Math.max(0, value))
const smooth = (t: number) => t * t * (3 - 2 * t)
const segment = (p: number, from: number, to: number) => smooth(clamp((p - from) / (to - from)))

/** Trajectoire du « A » : [progression, y en % de la hauteur de scène, échelle, rotation]. */
const OBJECT_PATH: Array<[number, number, number, number]> = [
  [0, 0, 0.9, -6],
  [0.2, 0, 0.96, 3],
  [0.36, -25, 0.56, 15],
  [0.5, -27, 0.52, 12],
  [0.6, -33, 0.38, 0],
  [0.74, -33, 0.38, 0],
  [0.86, 0, 0.32, 0],
  [1, 0, 0.32, 0],
]

/** Format portrait : le « A » reste entre les titres du haut et du bas. */
const COMPACT_OBJECT_PATH: typeof OBJECT_PATH = [
  [0, 0, 0.9, -6],
  [0.2, 0, 0.96, 3],
  [0.36, -13, 0.56, 15],
  [0.5, -14, 0.52, 12],
  [0.6, -17, 0.4, 0],
  [0.74, -17, 0.4, 0],
  [0.86, 0, 0.3, 0],
  [1, 0, 0.3, 0],
]

function objectAt(p: number, path: typeof OBJECT_PATH) {
  for (let i = 1; i < path.length; i++) {
    const [end, y2, s2, r2] = path[i]
    const [start, y1, s1, r1] = path[i - 1]
    if (p <= end) {
      const t = smooth(clamp((p - start) / (end - start)))
      return { y: y1 + (y2 - y1) * t, scale: s1 + (s2 - s1) * t, rotate: r1 + (r2 - r1) * t }
    }
  }
  const [, y, scale, rotate] = path[path.length - 1]
  return { y, scale, rotate }
}

function networkPositions(count: number, compact: boolean) {
  const inner = compact ? (count <= 10 ? count : 5) : count <= 8 ? count : Math.min(8, Math.round(count * 0.4))
  const place = (n: number, rx: number, ry: number, offset: number) =>
    Array.from({ length: n }, (_, i) => {
      const angle = (i / n) * Math.PI * 2 - Math.PI / 2 + offset
      return { x: 50 + rx * Math.cos(angle), y: 50 + ry * Math.sin(angle) }
    })
  if (compact) return count <= 10 ? place(count, 41, 42, 0) : [...place(inner, 26, 20, 0.63), ...place(count - inner, 42, 44, 0)]
  if (count <= 8) return place(count, 33, 38, 0)
  return [...place(inner, 22, 26, 0.2), ...place(count - inner, 43, 43, 0)]
}

function AllneedsMark({ gradientId, white = false }: { gradientId: string; white?: boolean }) {
  const paint = white ? '#fff' : `url(#${gradientId})`
  return (
    <svg viewBox="62 58 332 322" aria-hidden="true">
      {white ? null : (
        <defs>
          <linearGradient id={gradientId} x1="0" y1="1" x2="1" y2="0">
            <stop offset="0" stopColor="#123FC4" />
            <stop offset="0.55" stopColor="#0878F9" />
            <stop offset="1" stopColor="#13C4E8" />
          </linearGradient>
        </defs>
      )}
      <path transform="translate(64 34)" d="M26 302 112 84c12-31 50-31 62 0l88 218" fill="none" stroke={paint} strokeWidth="42" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M92 231c51-12 104-36 164-68l86-47c24-13 48 9 35 31-3 6-9 11-17 15L190 269c-40 23-75 41-99 29-20-10-20-55 1-67Z" fill={paint} />
    </svg>
  )
}

/** Comparaison exacte de l'URL : sans cela, « Tous » resterait actif sur chaque filtre. */
const EXACT_FILTER = { exact: true, includeSearch: true, explicitUndefined: true }

function SectorFilter({ secteur }: { secteur?: SectorSlug }) {
  return (
    <nav className="sx-filter" aria-label="Filtrer par secteur">
      <Link to="/univers" search={{}} resetScroll={false} className="sx-chip" data-selected={!secteur} activeOptions={EXACT_FILTER}>Tous</Link>
      {SECTORS_CONFIG.map((sector) => {
        const Icon = sector.icon
        return (
          <Link key={sector.slug} to="/univers" search={{ secteur: sector.slug }} resetScroll={false} className="sx-chip" data-selected={secteur === sector.slug} activeOptions={EXACT_FILTER}>
            <Icon /> {sector.label.fr}
          </Link>
        )
      })}
    </nav>
  )
}

export function UniversStory({ companies, secteur, onLogoError }: {
  companies: UniversCompany[]
  secteur?: SectorSlug
  onLogoError: (event: SyntheticEvent<HTMLImageElement>) => void
}) {
  const storyRef = useRef<HTMLElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const gradientId = useId().replace(/:/g, '')
  const [compact, setCompact] = useState(() => typeof window !== 'undefined' && window.matchMedia(COMPACT_QUERY).matches)
  const [smallPhone, setSmallPhone] = useState(() => typeof window !== 'undefined' && window.matchMedia(SMALL_PHONE_QUERY).matches)
  const nodes = companies.slice(0, smallPhone ? MAX_SMALL_PHONE_NODES : compact ? MAX_COMPACT_NODES : MAX_NETWORK_NODES)
  const positions = networkPositions(nodes.length, compact)

  useEffect(() => {
    const query = window.matchMedia(COMPACT_QUERY)
    const small = window.matchMedia(SMALL_PHONE_QUERY)
    const sync = () => { setCompact(query.matches); setSmallPhone(small.matches) }
    sync()
    query.addEventListener('change', sync)
    small.addEventListener('change', sync)
    return () => { query.removeEventListener('change', sync); small.removeEventListener('change', sync) }
  }, [])

  useEffect(() => {
    const story = storyRef.current
    const stage = stageRef.current
    if (!story || !stage) return
    let frame = 0
    const update = () => {
      frame = 0
      const rect = story.getBoundingClientRect()
      const travel = rect.height - stage.offsetHeight
      if (travel <= 0) return
      const head = headerHeight()
      stage.style.setProperty('--sx-head', `${head}px`)
      const p = clamp((head - rect.top) / travel)
      const object = objectAt(p, compact ? COMPACT_OBJECT_PATH : OBJECT_PATH)
      const chapters = [
        1 - segment(p, 0.17, 0.25),
        segment(p, 0.27, 0.34) * (1 - segment(p, 0.46, 0.52)),
        segment(p, 0.54, 0.6) * (1 - segment(p, 0.71, 0.77)),
        segment(p, 0.8, 0.87),
      ]
      chapters.forEach((value, index) => stage.style.setProperty(`--c${index}`, value.toFixed(3)))
      stage.style.setProperty('--panel-a', segment(p, 0.22, 0.33).toFixed(3))
      stage.style.setProperty('--panel-b', segment(p, 0.47, 0.58).toFixed(3))
      stage.style.setProperty('--panel-c', segment(p, 0.72, 0.83).toFixed(3))
      stage.style.setProperty('--object-y', `${object.y.toFixed(2)}cqh`)
      stage.style.setProperty('--object-scale', object.scale.toFixed(3))
      stage.style.setProperty('--object-rotate', `${object.rotate.toFixed(2)}deg`)
      stage.style.setProperty('--object-opacity', (1 - segment(p, 0.8, 0.85)).toFixed(3))
      stage.style.setProperty('--object-white', segment(p, 0.49, 0.56).toFixed(3))
      stage.style.setProperty('--ribbon', (1 - segment(p, 0.56, 0.72)).toFixed(4))
      stage.style.setProperty('--ribbon-opacity', (segment(p, 0.54, 0.57) * (1 - segment(p, 0.73, 0.78))).toFixed(3))
      stage.style.setProperty('--lines', (1 - segment(p, 0.84, 0.95)).toFixed(4))
      stage.dataset.final = p > 0.82 ? 'true' : 'false'
      stage.querySelectorAll<HTMLElement>('.sx-pour-icon').forEach((icon, index) => {
        const q = clamp((p - 0.3 - index * 0.016) / 0.2)
        const drift = Math.sin(q * 4 + index * 1.7) * (34 + index * 7) * (compact ? 0.95 : 1)
        icon.style.opacity = (q <= 0 || q >= 1 ? 0 : Math.min(1, q * 6) * Math.min(1, (1 - q) * 5)).toFixed(3)
        icon.style.transform = `translate(calc(-50% + ${drift.toFixed(1)}px), ${(q * (compact ? 31 : 58) - (compact ? 7 : 9)).toFixed(2)}cqh) rotate(${(q * 150 - 40 + index * 18).toFixed(1)}deg) scale(${(0.72 + q * 0.42).toFixed(3)})`
      })
      stage.querySelectorAll<HTMLElement>('.sx-story-net .sx-node').forEach((node, index) => {
        node.style.setProperty('--n', smooth(clamp((p - 0.84 - index * 0.004) / 0.07)).toFixed(3))
      })
    }
    const request = () => { if (!frame) frame = requestAnimationFrame(update) }
    update()
    window.addEventListener('scroll', request, { passive: true })
    window.addEventListener('resize', request)
    return () => {
      if (frame) cancelAnimationFrame(frame)
      window.removeEventListener('scroll', request)
      window.removeEventListener('resize', request)
    }
  }, [nodes.length, compact])

  // Un lien filtré partagé ouvre directement le réseau plutôt que le début de l'histoire.
  const openedFiltered = useRef(false)
  useEffect(() => {
    if (!secteur || openedFiltered.current) return
    openedFiltered.current = true
    const story = storyRef.current
    const stage = stageRef.current
    if (!story || !stage || !stage.offsetHeight) return
    const top = window.scrollY + story.getBoundingClientRect().top - headerHeight() + (story.offsetHeight - stage.offsetHeight)
    requestAnimationFrame(() => window.scrollTo({ top, behavior: 'auto' }))
  }, [secteur])

  // Sur téléphone, la rangée de filtres défile : le secteur choisi reste visible.
  useEffect(() => {
    const active = stageRef.current?.querySelector<HTMLElement>('.sx-final-head .sx-chip[data-selected="true"]')
    const row = active?.parentElement
    if (active && row) row.scrollLeft = active.offsetLeft - row.offsetLeft - (row.clientWidth - active.offsetWidth) / 2
  }, [secteur, compact])

  return (
    <>
      <section ref={storyRef} className="sx-story mk-bg-ink" aria-label="L’univers ALLNEEDS">
        <div ref={stageRef} className="sx-stage" data-final="false">
          <i className="sx-panel a" /><i className="sx-panel b" /><i className="sx-panel c" />

          <div className="sx-chapter c0">
            <span className="sx-num">01</span>
            <h1 className="sx-giant"><span className="left">L’UNIVERS</span><span className="right">ALLNEEDS</span></h1>
            <p className="sx-story-text">Les entreprises et les partenaires avec lesquels ALLNEEDS a travaillé, dans tous ses secteurs.</p>
            <span className="sx-scroll"><ArrowDown /> Faites défiler</span>
          </div>
          <div className="sx-chapter c1 on-light">
            <span className="sx-num">02</span>
            <h2 className="sx-giant"><span className="left">SEPT<br />SECTEURS</span><span className="right">UN MÊME<br />CAP</span></h2>
            <p className="sx-story-text">Santé, commerce, enseignement, tourisme, industrie, BTP et services.</p>
          </div>
          <div className="sx-chapter c2">
            <span className="sx-num">03</span>
            <h2 className="sx-giant"><span className="left">CHAQUE<br />BESOIN</span><span className="right">TROUVE<br />SON LIEN</span></h2>
            <p className="sx-story-text">ALLNEEDS relie les besoins réels aux compétences capables de les faire avancer.</p>
          </div>

          <svg className="sx-ribbon" viewBox="0 0 1000 800" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
            <path pathLength={1} d="M500 205C500 285 695 285 645 370C595 452 350 420 365 515C380 602 665 580 622 675C592 742 450 725 500 840" />
            <path pathLength={1} className="thin" d="M500 205C500 285 695 285 645 370C595 452 350 420 365 515C380 602 665 580 622 675C592 742 450 725 500 840" />
          </svg>

          <div className="sx-pour" aria-hidden="true">
            {SECTORS_CONFIG.map((sector) => {
              const Icon = sector.icon
              return <span key={sector.slug} className="sx-pour-icon"><Icon /></span>
            })}
          </div>

          <div className="sx-object">
            <AllneedsMark gradientId={gradientId} />
            <span className="white"><AllneedsMark gradientId={gradientId} white /></span>
          </div>

          <div className="sx-chapter c3">
            <div className="sx-final-head">
              <h2>Ils font partie de l’univers.</h2>
              <SectorFilter secteur={secteur} />
            </div>
            {nodes.length ? (
              <div className="sx-network sx-story-net" role="group" aria-label="Réseau des entreprises ALLNEEDS">
                <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                  {positions.map((position, index) => (
                    <line key={nodes[index].id} x1="50" y1="50" x2={position.x} y2={position.y} vectorEffect="non-scaling-stroke" />
                  ))}
                </svg>
                <span className="sx-network-center"><img src="/allneeds-logo-dark.svg" alt="ALLNEEDS" width={1030} height={320} /></span>
                {nodes.map((company, index) => (
                  <a key={company.id} href={`#entreprise-${company.id}`} className="sx-node" style={{ left: `${positions[index].x}%`, top: `${positions[index].y}%` }} aria-label={company.name}>
                    <img src={company.logo} alt="" width={56} height={56} loading="lazy" onError={onLogoError} />
                    <span>{company.name}</span>
                  </a>
                ))}
              </div>
            ) : (
              <div className="sx-story-soon">
                <span className="sx-network-center"><img src="/allneeds-logo-dark.svg" alt="ALLNEEDS" width={1030} height={320} /></span>
                <p>Bientôt dans l’univers ALLNEEDS</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* « Réduire les animations » ou écran très bas : même contenu, sans défilement piloté. */}
      <section className="sx-story-static mk-bg-ink" aria-label="L’univers ALLNEEDS">
        <div className="mk-wrap">
          <span className="sx-static-mark"><AllneedsMark gradientId={`${gradientId}-static`} /></span>
          <h1 className="mk-h1">L’univers <span className="mk-hl">ALLNEEDS</span></h1>
          <p className="mk-lead">Les entreprises et les partenaires avec lesquels ALLNEEDS a travaillé, dans tous ses secteurs.</p>
          <ol className="sx-static-steps">
            <li><b>02</b><span><strong>Sept secteurs, un même cap</strong>Santé, commerce, enseignement, tourisme, industrie, BTP et services.</span></li>
            <li><b>03</b><span><strong>Chaque besoin trouve son lien</strong>ALLNEEDS relie les besoins réels aux compétences capables de les faire avancer.</span></li>
          </ol>
          <SectorFilter secteur={secteur} />
          {companies.length ? (
            <div className="sx-logo-grid" role="group" aria-label="Logos des entreprises">
              {companies.map((company) => (
                <a key={company.id} href={`#entreprise-${company.id}`} aria-label={company.name}>
                  <img src={company.logo} alt="" width={56} height={56} loading="lazy" onError={onLogoError} />
                </a>
              ))}
            </div>
          ) : null}
        </div>
      </section>
    </>
  )
}
