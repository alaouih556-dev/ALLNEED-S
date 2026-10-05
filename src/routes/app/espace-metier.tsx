import { createFileRoute } from '@tanstack/react-router'
import { Workspace } from '@/features/saas/Workspace'
export const Route = createFileRoute('/app/espace-metier')({ component: Metier })
function Metier() {
  const url = (import.meta as ImportMeta & { env: { VITE_HEALTH_URL?: string } }).env.VITE_HEALTH_URL || 'https://allneed-s-sante.vercel.app'
  return <><section className="container-page pt-8"><div className="rounded-3xl bg-ink-950 p-8 text-white"><p className="text-xs uppercase tracking-widest text-brand-200">ALLNEEDS SANTÉ · PLATEFORME INDÉPENDANTE</p><h2 className="mt-3 text-2xl font-bold">Votre équipe. Votre espace de gestion.</h2><p className="mt-3 max-w-2xl text-sm text-ink-200">La démo Santé dispose d’une connexion séparée pour la direction, la réception et la comptabilité.</p>{url ? <a href={url} target="_blank" rel="noreferrer" className="mt-5 inline-flex rounded-xl bg-brand-600 px-5 py-3 text-sm font-semibold">Ouvrir ALLNEEDS Santé ↗</a> : <p className="mt-5 text-xs text-brand-200">Le lien sera disponible après publication de la plateforme Santé.</p>}</div></section><Workspace /></>
}
