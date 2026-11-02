import type { ReactNode } from 'react'
import { Building2, LockKeyhole } from 'lucide-react'
import { Link } from '@tanstack/react-router'
import { Badge, Card, SectionHeading } from '@/components/ui'
import { useAuth } from '@/features/auth/AuthContext'

export function ConciergeGuard({ children }: { children: ReactNode }) {
  const auth=useAuth()
  if(auth.status==='loading') return <Card className="p-8 text-center"><p className="text-sm text-ink-500">Vérification de votre accès…</p></Card>
  if(auth.status!=='authenticated'||auth.user?.role!=='concierge') return <Card className="p-8 text-center"><LockKeyhole className="mx-auto h-6 w-6 text-ink-400"/><p className="mt-3 font-semibold text-ink-950">Accès Concierge requis</p><p className="mt-1 text-sm text-ink-500">Connectez-vous avec un compte Concierge actif.</p></Card>
  if(auth.user.active===false) return <Card className="p-8 text-center"><LockKeyhole className="mx-auto h-6 w-6 text-ink-400"/><p className="mt-3 font-semibold text-ink-950">Compte Concierge désactivé</p><p className="mt-1 text-sm text-ink-500">L’administrateur ALLNEEDS doit réactiver ce compte.</p></Card>
  return <>{children}</>
}

export function ScopedEmpty({ title = 'Aucune donnée dans votre portefeuille', description = 'Seules les données des entreprises qui vous sont attribuées sont affichées.' }: { title?: string; description?: string }) {
  return <Card className="p-8 text-center"><Building2 className="mx-auto h-6 w-6 text-ink-400"/><p className="mt-3 font-semibold text-ink-950">{title}</p><p className="mt-1 text-sm text-ink-500">{description}</p></Card>
}

export function OrgIdentity({ orgId }: { orgId:string }) {
  return <Link to={'/concierge/entreprises/$id' as any} params={{id:orgId} as any} className="inline-flex items-center gap-2 font-semibold text-ink-950 hover:text-brand-700"><span>Entreprise</span><Badge tone="neutral">{orgId.slice(0,8)}</Badge></Link>
}

export function ConciergeHeading({ eyebrow, title, description }: { eyebrow:string; title:string; description:string }) {
  return <SectionHeading eyebrow={eyebrow} title={title} description={description}/>
}
