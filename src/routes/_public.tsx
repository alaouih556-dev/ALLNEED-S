import { Link, Outlet, createFileRoute, useRouterState } from '@tanstack/react-router'
import { LaunchBanner, PublicFooter, PublicHeader } from '@/components/marketing'

export const Route = createFileRoute('/_public')({
  component: PublicLayout,
})

const SEGMENT_LABELS: Record<string, string> = {
  '': 'Accueil',
  secteurs: 'Secteurs',
  sante: 'Santé',
  enseignement: 'Enseignement',
  tourisme: 'Tourisme',
  diagnostic: 'Diagnostic offert',
  tarifs: 'Tarifs',
  faq: 'FAQ',
  'a-propos': 'À propos',
  conditions: 'Conditions',
  contact: 'Contact',
  inscription: 'Créer mon compte',
  connexion: 'Connexion',
  missions: 'Missions',
}

function useBreadcrumb() {
  const path = useRouterState({ select: (s) => s.location.pathname })
  const parts = path.split('/').filter(Boolean)
  const crumbs = [{ label: 'Accueil', to: '/' }]
  let acc = ''
  for (const p of parts) {
    acc += '/' + p
    crumbs.push({ label: SEGMENT_LABELS[p] ?? p.charAt(0).toUpperCase() + p.slice(1), to: acc })
  }
  return crumbs
}

function PublicLayout() {
  const crumbs = useBreadcrumb()
  return (
    <>
      <LaunchBanner />
      <PublicHeader />
      {crumbs.length > 1 ? (
        <div className="mk mk-crumbs">
          <nav className="mk-wrap" aria-label="Fil d'Ariane">
            {crumbs.map((c, i) => (
              <span key={c.to} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                {i > 0 ? <span aria-hidden="true">/</span> : null}
                {i === crumbs.length - 1 ? (
                  <span className="current" aria-current="page">{c.label}</span>
                ) : (
                  <Link to={c.to as any}>{c.label}</Link>
                )}
              </span>
            ))}
          </nav>
        </div>
      ) : null}
      <main className="flex-1">
        <Outlet />
      </main>
      <PublicFooter />
    </>
  )
}
