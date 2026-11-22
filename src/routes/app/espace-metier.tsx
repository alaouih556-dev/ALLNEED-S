import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Check, Clock3, ExternalLink, HeartPulse, LockKeyhole, Mail, Send, ShieldCheck, XCircle } from 'lucide-react'
import { useDemo } from '@/store/store'
import { useAuth } from '@/features/auth/AuthContext'
import { useOrgContext } from '@/features/parcours/useOrgContext'
import { PageHeader } from '@/components/layouts'
import { Alert, Badge, Button } from '@/components/ui'
import { Panel } from '@/components/admin-kit'
import { useApiResource } from '@/lib/useApiResource'
import { requestSaasSubscription, SAAS_MONTHLY_PRICE, type SaasSubscriptionPayload } from '@/lib/saas-subscription'

export const Route = createFileRoute('/app/espace-metier')({
  component: Metier,
  head: () => ({ meta: [{ title: 'Espace métier — ALLNEEDS' }] }),
})

type Stage = 'locked' | 'pending' | 'refused' | 'active'

const ROLE_LABEL: Record<string, string> = { directeur: 'Directeur', reception: 'Réception', comptabilite: 'Comptabilité' }

function Metier() {
  const { state, orgId } = useDemo()
  const auth = useAuth()
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
  const stage: Stage = enabled ? 'active' : pending ? 'pending' : refused ? 'refused' : 'locked'
  const concierge = auth.user?.organization?.concierge ?? null

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

  const status = {
    locked: { icon: <LockKeyhole size={22} />, tone: 'is-locked', badge: <Badge tone="neutral">Non demandé</Badge>, title: 'Votre espace métier est verrouillé', text: 'Demandez l’abonnement SaaS de votre secteur. Les outils et leur lien restent verrouillés jusqu’à la validation par ALLNEEDS.' },
    pending: { icon: <Clock3 size={22} />, tone: 'is-pending', badge: <Badge tone="warning">En attente de validation</Badge>, title: 'Votre demande est en cours de validation', text: 'ALLNEEDS vérifie votre demande. Le lien d’accès apparaîtra sur cette page dès qu’elle sera validée : aucune autre action n’est nécessaire.' },
    refused: { icon: <XCircle size={22} />, tone: 'is-refused', badge: <Badge tone="danger">Demande refusée</Badge>, title: 'Votre demande n’a pas été validée', text: refused?.reason || 'Vous pouvez envoyer une nouvelle demande ou contacter votre Account Manager.' },
    active: { icon: sector === 'sante' ? <HeartPulse size={22} /> : <ShieldCheck size={22} />, tone: 'is-active', badge: <Badge tone="success">Accès autorisé</Badge>, title: sector === 'sante' ? 'Votre espace métier Santé est disponible' : 'Votre espace métier est activé', text: sector === 'sante' ? 'Le portail ALLNEEDS conserve votre diagnostic, vos priorités et votre pilotage. La gestion métier Santé se fait dans son SaaS séparé.' : 'Votre accès métier a été validé par ALLNEEDS.' },
  }[stage]

  const steps = [
    { label: 'Demande envoyée', done: stage !== 'locked' },
    { label: 'Validation ALLNEEDS', done: stage === 'active', current: stage === 'pending' || stage === 'refused' },
    { label: 'Accès ouvert', done: stage === 'active' },
  ]

  return (
    <div>
      <PageHeader
        eyebrow="Réseau"
        title="Espace métier"
        description="Les outils de gestion de votre secteur, dans un SaaS dédié. L’accès est validé par ALLNEEDS."
      />

      {error ? <Alert tone="danger" className="mb-5" title="Abonnement SaaS indisponible">{error}</Alert> : null}
      {actionError ? <Alert tone="danger" className="mb-5">{actionError}</Alert> : null}
      {sent && stage === 'pending' ? <Alert tone="success" className="mb-5" title="Demande envoyée">Votre demande est en attente de validation par ALLNEEDS.</Alert> : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Panel title="Votre accès" action={status.badge}>
          <div className="p-5">
            <div className={`em-status ${status.tone}`}>
              <span className="em-status-icon">{status.icon}</span>
              <div className="min-w-0">
                <h2 className="font-display text-lg font-bold text-ink-950">{status.title}</h2>
                <p className="mt-1.5 text-sm leading-6 text-ink-600">{status.text}</p>
                {stage === 'active' && sector === 'sante' ? (
                  <p className="mt-2 text-xs text-ink-500">
                    Rôles autorisés : {roles.length ? roles.map((role) => ROLE_LABEL[role] ?? role).join(' · ') : 'aucun rôle sélectionné'}
                    {activatedAt ? <> · Activé le {new Date(activatedAt).toLocaleDateString('fr-FR')}</> : null}
                  </p>
                ) : null}
              </div>
            </div>

            <ol className="em-steps" aria-label="Étapes de l’accès">
              {steps.map((step, index) => (
                <li key={step.label} className={step.done ? 'is-done' : step.current ? 'is-current' : ''}>
                  <span className="em-step-dot">{step.done ? <Check size={13} strokeWidth={3} /> : index + 1}</span>
                  <span>{step.label}</span>
                </li>
              ))}
            </ol>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              {stage === 'active' ? (
                url ? (
                  <a href={url} target="_blank" rel="noreferrer"><Button>Ouvrir mon espace métier<ExternalLink size={15} /></Button></a>
                ) : (
                  <span className="text-sm font-semibold text-ink-500">SaaS métier à configurer par ALLNEEDS.</span>
                )
              ) : stage === 'pending' ? null : (
                <Button onClick={() => void requestAccess()} disabled={loading || submitting}>
                  <Send size={15} />{submitting ? 'Envoi…' : stage === 'refused' ? 'Envoyer une nouvelle demande' : 'Demander l’accès'}
                </Button>
              )}
              {concierge?.email && stage !== 'active' ? (
                <a href={`mailto:${concierge.email}`}><Button variant="outline"><Mail size={15} />Contacter mon Account Manager</Button></a>
              ) : null}
            </div>
          </div>
        </Panel>

        <Panel title="Abonnement">
          <div className="p-5">
            <p className="em-price"><strong>{SAAS_MONTHLY_PRICE}</strong><span>MAD / mois</span></p>
            <ul className="em-list">
              <li><Check size={15} />Abonnement mensuel, distinct de votre offre d’accompagnement.</li>
              <li><Check size={15} />Le lien d’accès s’affiche sur cette page après validation par ALLNEEDS.</li>
              <li><Check size={15} />Votre Account Manager répond à vos questions avant et après l’activation.</li>
            </ul>
          </div>
        </Panel>
      </div>
    </div>
  )
}
