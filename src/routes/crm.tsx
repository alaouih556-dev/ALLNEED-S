import { type ReactNode } from 'react'
import { Link, Outlet, createFileRoute } from '@tanstack/react-router'
import { AppShell } from '@/components/layouts'
import { Button } from '@/components/ui'
import { GateMessage } from '@/features/auth/WorkspaceGate'
import { useAuth } from '@/features/auth/AuthContext'
import { CrmProvider, useCrm } from '@/features/crm/core'
import { LoadingRows } from '@/components/admin-kit'

export const Route = createFileRoute('/crm')({
  head: () => ({ meta: [{ title: 'CRM · ALLNEEDS' }, { name: 'robots', content: 'noindex' }] }),
  component: CrmLayout,
})

/** Espace CRM : réservé aux administrateurs et aux agents. Chaque page et chaque API vérifient en plus les permissions. */
function CrmLayout() {
  const auth = useAuth()
  if (auth.status === 'loading') return <GateMessage title="Vérification de votre session" detail="Nous vérifions votre accès avant d’ouvrir le CRM." />
  if (auth.status !== 'authenticated') return <GateMessage title="Connexion requise" detail="Le CRM est réservé à l’équipe ALLNEEDS."><Link to="/connexion"><Button>Se connecter</Button></Link></GateMessage>
  if (!auth.user?.crmAccess) return <GateMessage title="Accès non autorisé" detail="Le CRM est réservé aux administrateurs, aux agents et aux comptes CRM." />
  return (
    <CrmProvider>
      <AppShell variant="crm">
        <CrmReady>
          <Outlet />
        </CrmReady>
      </AppShell>
    </CrmProvider>
  )
}

function CrmReady({ children }: { children: ReactNode }) {
  const { me, error, loading, refresh } = useCrm()
  if (loading && !me) return <LoadingRows count={5} />
  if (!me) return <GateMessage title="CRM indisponible" detail={error || 'Le service CRM ne répond pas.'}><Button onClick={() => void refresh()}>Réessayer</Button></GateMessage>
  return <>{children}</>
}
