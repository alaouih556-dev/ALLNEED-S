import { useEffect, useState, type ReactNode } from 'react'
import { Building2, LockKeyhole } from 'lucide-react'
import { Link } from '@tanstack/react-router'
import { PageHeader } from '@/components/layouts'
import { EmptyBox, Panel } from '@/components/admin-kit'
import { useAuth } from '@/features/auth/AuthContext'

export function ConciergeGuard({ children }: { children: ReactNode }) {
  const auth = useAuth()
  if (auth.status === 'loading') return <Panel><EmptyBox icon={<LockKeyhole size={20} />} title="Vérification de votre accès…" /></Panel>
  if (auth.status !== 'authenticated' || auth.user?.role !== 'concierge') return <Panel><EmptyBox icon={<LockKeyhole size={20} />} title="Accès Concierge requis" text="Connectez-vous avec un compte Concierge actif." /></Panel>
  if (auth.user.active === false) return <Panel><EmptyBox icon={<LockKeyhole size={20} />} title="Compte Concierge désactivé" text="L’administrateur ALLNEEDS doit réactiver ce compte." /></Panel>
  return <>{children}</>
}

export function ScopedEmpty({ title = 'Aucune donnée dans votre portefeuille', description = 'Seules les données des entreprises qui vous sont attribuées sont affichées.', icon, action }: { title?: string; description?: string; icon?: ReactNode; action?: ReactNode }) {
  return <Panel><EmptyBox icon={icon ?? <Building2 size={20} />} title={title} text={description} action={action} /></Panel>
}

/* Noms des entreprises du portefeuille, chargés une seule fois pour toute la session. */
let orgNamesPromise: Promise<Record<string, string>> | null = null
function loadOrgNames() {
  orgNamesPromise ??= fetch('/api/concierge/orgs', { credentials: 'same-origin', cache: 'no-store' })
    .then((r) => (r.ok ? r.json() : []))
    .then((rows: { id: string; name: string }[]) => Object.fromEntries(rows.map((o) => [o.id, o.name])))
    .catch(() => {
      orgNamesPromise = null
      return {}
    })
  return orgNamesPromise
}

export function useOrgName(orgId: string) {
  const [name, setName] = useState<string | null>(null)
  useEffect(() => {
    let alive = true
    void loadOrgNames().then((names) => alive && setName(names[orgId] ?? null))
    return () => {
      alive = false
    }
  }, [orgId])
  return name
}

export function OrgIdentity({ orgId }: { orgId: string }) {
  const name = useOrgName(orgId)
  return (
    <Link to={'/concierge/entreprises/$id' as any} params={{ id: orgId } as any} className="inline-flex items-center gap-2 text-sm font-semibold text-ink-950 hover:text-brand-700">
      <span className="grid h-6 w-6 place-items-center rounded-lg bg-indigo-50 text-indigo-600"><Building2 size={13} /></span>
      <span className="truncate">{name ?? 'Entreprise'}</span>
    </Link>
  )
}

export function ConciergeHeading({ eyebrow, title, description, actions }: { eyebrow: string; title: string; description: string; actions?: ReactNode }) {
  return <PageHeader eyebrow={eyebrow} title={title} description={description} actions={actions} />
}
