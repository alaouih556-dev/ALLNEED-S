import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { ExternalLink, HeartPulse, LockKeyhole, ShieldCheck } from 'lucide-react'
import { useDemo } from '@/store/store'
import { useOrgContext } from '@/features/parcours/useOrgContext'
import { Alert, Badge, Button } from '@/components/ui'
import { useApiResource } from '@/lib/useApiResource'
import { requestSaasSubscription, SAAS_MONTHLY_PRICE, type SaasSubscriptionPayload } from '@/lib/saas-subscription'

export const Route = createFileRoute('/app/espace-metier')({ component: Metier })

function Metier() {
  const { state, orgId } = useDemo()
  const { sector: realSector } = useOrgContext()
  const { data, loading, error, refresh } = useApiResource<SaasSubscriptionPayload>('/api/saas/subscription')
  const [submitting, setSubmitting] = useState(false)
  const [actionError, setActionError] = useState('')
  const [sent, setSent] = useState(false)
  const org = state.orgs.find((item) => item.id === orgId)
  const sector = realSector ?? org?.sector ?? 'enseignement'
  const roles = org ? (state.saasRolesByOrg[org.id] ?? []) : []
  const activatedAt = org ? state.saasActivatedAtByOrg[org.id] : null
  const records = [data?.pending, data?.current, data?.subscription, data, ...(data?.history ?? [])].filter(Boolean)
  const pending = records.find((record) => record && ['pending', 'en_attente', 'en_attente_validation'].includes(record.status ?? ''))
  const refused = records.find((record) => record && ['refused', 'refusee', 'rejected'].includes(record.status ?? ''))
  const enabled = Boolean(data?.active || data?.enabled || records.some((record) => ['active', 'actif'].includes(record?.status ?? '')))
  const url = enabled ? (data?.url ?? (sector === 'sante' ? 'https://allneed-s-sante.vercel.app' : null)) : null

  async function requestAccess() {
    setSubmitting(true)
    setActionError('')
    try {
      await requestSaasSubscription()
      setSent(true)
      await refresh()
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : 'Demande non enregistrée.')
    } finally {
      setSubmitting(false)
    }
  }

  if (!enabled) return (
    <section className="container-page py-10">
      {error ? <Alert tone="danger" className="mb-5" title="Abonnement SaaS indisponible">{error}</Alert> : null}
      {actionError ? <Alert tone="danger" className="mb-5">{actionError}</Alert> : null}
      {sent ? <Alert tone="success" className="mb-5" title="Demande envoyée">Votre demande est en attente de validation par ALLNEEDS.</Alert> : null}
      <div className="health-external-card">
        <div className="health-external-icon"><LockKeyhole size={26}/></div>
        <div>
          <span className="eyebrow">ESPACE MÉTIER · ACCÈS CONTRÔLÉ</span>
          <h1>Votre espace métier est encore verrouillé.</h1>
           <p>Demandez l’abonnement SaaS de votre secteur. Les outils et leur lien restent verrouillés jusqu’à validation par ALLNEEDS.</p>
           <p className="mt-3 text-lg font-bold text-ink-950">{SAAS_MONTHLY_PRICE} MAD / mois</p>
           {pending ? <Badge tone="warning" className="mt-3">EN ATTENTE DE VALIDATION</Badge> : null}
           {refused && !pending ? <Alert tone="warning" className="mt-4" title="Demande refusée">{refused.reason || 'Vous pouvez envoyer une nouvelle demande ou contacter votre concierge.'}</Alert> : null}
        </div>
        {pending ? <div className="health-external-action disabled">Demande envoyée</div> : <Button onClick={() => void requestAccess()} disabled={loading || submitting}>{submitting ? 'Envoi…' : `Demander l’accès · ${SAAS_MONTHLY_PRICE} MAD/mois`}</Button>}
      </div>
    </section>
  )

  return (
    <section className="container-page py-10">
      <div className="health-external-card">
        <div className="health-external-icon">{sector === 'sante' ? <HeartPulse size={28}/> : <ShieldCheck size={28}/>}</div>
        <div>
          <span className="eyebrow">ESPACE MÉTIER · ACCÈS AUTORISÉ</span>
          <h1>{sector === 'sante' ? 'ALLNEEDS Santé est disponible.' : 'Votre espace métier est activé.'}</h1>
           <p>{sector === 'sante' ? 'Le portail principal conserve votre diagnostic, vos priorités et votre pilotage. La gestion métier Santé reste dans son SaaS séparé.' : 'Votre accès métier a été validé par ALLNEEDS.'} Abonnement : {SAAS_MONTHLY_PRICE} MAD / mois.</p>
          {sector === 'sante' ? <p className="mt-2 text-xs text-ink-500">Rôles autorisés : {roles.length ? roles.map((role) => role === 'directeur' ? 'Directeur' : role === 'reception' ? 'Réception' : 'Comptabilité').join(' · ') : 'Aucun rôle sélectionné'}{activatedAt ? ` · Activé le ${new Date(activatedAt).toLocaleDateString('fr-FR')}` : ''}</p> : null}
        </div>
        {url ? <a href={url} target="_blank" rel="noreferrer" className="health-external-action">Accéder à ALLNEEDS Santé <ExternalLink size={16}/></a> : <div className="health-external-action disabled">SaaS métier à configurer</div>}
      </div>
    </section>
  )
}
