import { useCallback, useEffect, useState } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { RefreshCcw } from 'lucide-react'
import { Button } from '@/components/ui'
import { canAccessSalesPresentation, useAuth } from '@/features/auth/AuthContext'
import { GateMessage } from '@/features/auth/WorkspaceGate'
import { SalesPresentation, type PresentationContent } from '@/features/sales/SalesPresentation'

/*
 * Présentation commerciale — route protégée.
 * 1. Garde côté interface (session + rôle) pour un retour clair à l'utilisateur.
 * 2. Le contenu n'est pas embarqué dans l'application : il est chargé depuis
 *    /api/sales/presentation, qui applique la même règle côté serveur.
 */
export const Route = createFileRoute('/sales-presentation')({
  component: SalesPresentationRoute,
  head: () => ({ meta: [{ title: 'Présentation commerciale — ALLNEEDS' }, { name: 'robots', content: 'noindex, nofollow' }] }),
})

type LoadState = { status: 'loading' } | { status: 'ready'; content: PresentationContent } | { status: 'denied' } | { status: 'error'; message: string }

function SalesPresentationRoute() {
  const auth = useAuth()
  if (auth.status === 'loading') return <GateMessage title="Vérification de votre session" detail="Nous vérifions votre accès avant d’ouvrir la présentation." />
  if (auth.status !== 'authenticated') {
    return (
      <GateMessage title="Connexion requise" detail="La présentation commerciale est réservée à l’équipe ALLNEEDS. Connectez-vous avec un compte autorisé.">
        <Link to="/connexion"><Button>Se connecter</Button></Link>
      </GateMessage>
    )
  }
  if (!canAccessSalesPresentation(auth.user)) return <Denied />
  return <PresentationLoader />
}

function Denied() {
  return <GateMessage title="Accès non autorisé" detail="La présentation commerciale est réservée aux administrateurs et aux commerciaux ALLNEEDS." />
}

function PresentationLoader() {
  const [state, setState] = useState<LoadState>({ status: 'loading' })

  const load = useCallback(async () => {
    setState({ status: 'loading' })
    try {
      const response = await fetch('/api/sales/presentation', { credentials: 'same-origin', cache: 'no-store' })
      if (response.status === 401 || response.status === 403) return setState({ status: 'denied' })
      if (!response.ok) throw new Error('Le contenu de la présentation est indisponible.')
      setState({ status: 'ready', content: (await response.json()) as PresentationContent })
    } catch (error) {
      setState({ status: 'error', message: error instanceof Error ? error.message : 'Chargement impossible.' })
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  if (state.status === 'denied') return <Denied />
  if (state.status === 'error') {
    return (
      <GateMessage title="Présentation indisponible" detail={`${state.message} Vérifiez que le serveur ALLNEEDS est démarré puis réessayez.`}>
        <Button onClick={() => void load()}><RefreshCcw className="h-4 w-4" />Réessayer</Button>
      </GateMessage>
    )
  }
  if (state.status === 'loading') {
    return (
      <div className="sp-root sp-loading" aria-busy="true">
        <div className="sp-loader"><span /><span /><span /></div>
        <p>Préparation de la présentation…</p>
      </div>
    )
  }
  return <SalesPresentation content={state.content} />
}
