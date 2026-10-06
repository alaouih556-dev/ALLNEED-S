import { Outlet, createRootRoute } from '@tanstack/react-router'
import { Toaster } from '@/components/layouts'
import { isApiError } from '@/lib/api'

export const Route = createRootRoute({
  component: RootLayout,
  notFoundComponent: NotFound,
  defaultErrorComponent: RouteError,
})

function RootLayout() {
  return (
    <div className="flex min-h-screen flex-col">
      <Outlet />
      <Toaster />
    </div>
  )
}

function RouteError({ error, reset }: { error: unknown; reset: () => void }) {
  const api = isApiError(error) ? error : null
  const offline = api?.status === 0
  const unauthenticated = api?.status === 401
  const forbidden = api?.status === 403

  const title = offline
    ? 'Service injoignable'
    : unauthenticated
      ? 'Session expirée'
      : forbidden
        ? 'Accès refusé'
        : 'Une erreur est survenue'

  const message = offline
    ? "L’API ALLNEEDS ne répond pas. Démarrez le serveur local (npm run server) ou vérifiez la variable d’environnement VITE_API_BASE."
    : unauthenticated
      ? 'Votre session n’est plus valide. Reconnectez-vous pour continuer.'
      : forbidden
        ? 'Votre profil ne dispose pas des habilitations nécessaires à cette page.'
        : (error instanceof Error && error.message) || 'Réessayez dans un instant.'

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center">
      <div>
        <h1 className="display-2">{title}</h1>
        <p className="lede mx-auto mt-3 max-w-md">{message}</p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="inline-flex h-11 items-center rounded-lg bg-brand-700 px-5 text-sm font-semibold text-white transition hover:bg-brand-800"
        >
          Réessayer
        </button>
        <a
          href={unauthenticated ? '/connexion' : '/'}
          className="inline-flex h-11 items-center rounded-lg border border-ink-200 px-5 text-sm font-semibold text-ink-700 transition hover:border-ink-400"
        >
          {unauthenticated ? 'Se reconnecter' : "Retour à l’accueil"}
        </a>
      </div>
    </div>
  )
}

function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center">
      <p className="font-display text-7xl text-sand-400">404</p>
      <div>
        <h1 className="display-2">Page introuvable</h1>
        <p className="lede mx-auto mt-3 max-w-md">
          Cette page n’existe pas ou a été déplacée. Reprenons depuis l’accueil.
        </p>
      </div>
      <a
        href="/"
        className="inline-flex h-11 items-center rounded-lg bg-brand-700 px-5 text-sm font-semibold text-white transition hover:bg-brand-800"
      >
        Retour à l’accueil
      </a>
    </div>
  )
}
