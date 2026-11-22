import { type ReactNode } from 'react'
import { Outlet, createFileRoute } from '@tanstack/react-router'
import { AppShell } from '@/components/layouts'
import { Button } from '@/components/ui'
import { LoadingRows } from '@/components/admin-kit'
import { GateMessage } from '@/features/auth/WorkspaceGate'
import { useAuth } from '@/features/auth/AuthContext'
import { OrgProvider, useOrg } from '@/features/organization/core'

export const Route = createFileRoute('/organisation')({
  head: () => ({ meta: [{ title: 'Organisation · ALLNEEDS' }, { name: 'robots', content: 'noindex' }] }),
  component: OrganisationLayout,
})

function OrganisationLayout() {
  const auth = useAuth()
  if (auth.status === 'loading') return <GateMessage title="Vérification de votre session" detail="Nous vérifions votre accès avant d’ouvrir cet espace." />
  if (auth.status !== 'authenticated') return <GateMessage title="Connexion requise" detail="Cet espace est réservé à l’équipe ALLNEEDS." />
  if (!auth.user?.orgPosition) return <GateMessage title="Accès non autorisé" detail="Votre compte n’est rattaché à aucun service interne." />
  return (
    <OrgProvider>
      <AppShell variant="org">
        <OrgReady><Outlet /></OrgReady>
      </AppShell>
    </OrgProvider>
  )
}

function OrgReady({ children }: { children: ReactNode }) {
  const { me, loading, error, refresh } = useOrg()
  if (loading && !me) return <LoadingRows count={5} />
  if (!me) return <GateMessage title="Organisation indisponible" detail={error || 'Le service ne répond pas.'}><Button onClick={() => void refresh()}>Réessayer</Button></GateMessage>
  return <>{children}</>
}
