import { useEffect, useState } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { ArrowLeft, Check, CircleAlert, Clock, FileText, Flag, MessageSquare } from 'lucide-react'
import { PageHeader } from '@/components/layouts'
import { Alert, Badge, Button, Card, CardBody, CardHeader, Field, Textarea } from '@/components/ui'
import { useApiResource } from '@/lib/useApiResource'
import { MISSION_STATUS_META, MISSION_PRIORITY_LABELS, patchMission, type Mission } from '@/lib/accompagnement'
import { longDate } from '@/lib/format'

export const Route = createFileRoute('/app/missions/$id')({
  component: MissionDetail,
  head: ({ params }) => ({ meta: [{ title: `Mission ${params.id ?? ''} — ALLNEEDS` }] }),
})

function MissionDetail() {
  const { id } = Route.useParams()
  const { data: mission, loading, error, code, refresh } = useApiResource<Mission>(`/api/missions/${encodeURIComponent(id)}`)
  const [feedback, setFeedback] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState('')

  useEffect(() => {
    if (mission) {
      setFeedback(mission.clientFeedback ?? '')
    }
  }, [mission])

  if (loading) return <PageHeader eyebrow="Mission" title="Chargement de la mission…" />

  if (code === 'OFFER_REQUIRED') {
    return (
      <>
        <PageHeader eyebrow="Mission" title="Accès aux missions verrouillé" />
        <Alert tone="warning" title="Acceptez d’abord une offre d’accompagnement">
          Vos missions sont accessibles après l’acceptation d’une offre.{' '}
          <Link to="/app/offres" className="font-semibold underline">Voir les offres</Link>.
        </Alert>
      </>
    )
  }

  if (code === 'AXIS_NOT_INCLUDED') {
    return (
      <>
        <PageHeader eyebrow="Missions" title="Axe non inclus dans votre offre" />
        <Alert tone="warning" title="          Cette mission n’est pas accessible avec l’offre acceptée par votre entreprise.">
          <Link to="/app/missions" className="font-semibold underline">Retour à mes missions</Link>
        </Alert>
      </>
    )
  }

  if (error || !mission) {
    return (
      <>
        <PageHeader eyebrow="Missions" title="Mission introuvable" />
        <Alert tone="warning" title="Cette mission n’existe pas ou n’est pas rattachée à votre entreprise.">
          <Link to="/app/missions" className="font-semibold underline">Retour à mes missions</Link>
        </Alert>
      </>
    )
  }

  const status = MISSION_STATUS_META[mission.status]

  async function decide(clientDecision: 'validate' | 'request_correction') {
    setSaving(true)
    setSaved(false)
    setSaveError('')
    try {
      await patchMission(id, { clientDecision, clientFeedback: feedback.trim() || undefined })
      await refresh()
      setSaved(true)
    } catch (cause) {
      setSaveError(cause instanceof Error ? cause.message : 'Décision non enregistrée.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Link to="/app/missions" className="mb-4 inline-flex items-center gap-1.5 text-xs font-semibold text-ink-500 hover:text-ink-900">
        <ArrowLeft className="h-3.5 w-3.5" />
        Toutes mes missions
      </Link>

      <PageHeader
        eyebrow={`Mission · ${mission.offerCode}`}
        title={mission.title}
        description={mission.description}
        actions={<Badge tone={status.tone}>{status.label}</Badge>}
      />

      {mission.contentStatus === 'a_valider' ? (
        <Alert tone="warning" className="mb-5" title="Contenu à valider">
          Le détail de cette mission sera précisé et confirmé par votre Account Manager.
        </Alert>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1.4fr_0.6fr]">
        <div className="space-y-6">
          {mission.instructions ? (
            <Card>
              <CardHeader title="Instructions de votre Account Manager" />
              <CardBody>
                <p className="whitespace-pre-line text-sm leading-relaxed text-ink-700">{mission.instructions}</p>
              </CardBody>
            </Card>
          ) : null}

          {mission.instructionsResponse ? (
            <Card>
              <CardHeader title="Votre réponse" description="Votre retour à l’Account Manager sur les instructions." />
              <CardBody>
                <p className="whitespace-pre-line text-sm leading-relaxed text-ink-700">{mission.instructionsResponse}</p>
              </CardBody>
            </Card>
          ) : null}

          {mission.actions?.length ? (
            <Card>
              <CardHeader title="Actions associées" description={`${mission.actions.length} action(s) existante(s)`} />
              <CardBody>
                <ul className="space-y-3">
                  {mission.actions.map((action) => (
                    <li key={action.id} className="rounded-xl border border-ink-100 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <strong className="text-sm text-ink-900">{action.title}</strong>
                        <Badge tone={MISSION_STATUS_META[action.status]?.tone ?? 'neutral'}>{MISSION_STATUS_META[action.status]?.label ?? action.status}</Badge>
                      </div>
                      {action.description ? <p className="mt-1 text-xs leading-relaxed text-ink-600">{action.description}</p> : null}
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          ) : null}

          <Card>
            <CardHeader title="Livrables attendus" description={`${mission.deliverables.length} élément(s)`} />
            <CardBody>
              {mission.deliverables.length === 0 ? (
                <p className="text-sm text-ink-500">Les livrables seront précisés par votre Account Manager.</p>
              ) : (
                <ul className="space-y-2">
                  {mission.deliverables.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm text-ink-700">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-700" />
                      {item}
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>

          {mission.status === 'a_valider_client' ? (
            <Card>
              <CardHeader title="Votre décision" description="Cette validation appartient uniquement au client." />
              <CardBody className="space-y-4">
                <Field label="Commentaire ou correction demandée">
                  <Textarea rows={3} value={feedback} onChange={(event) => setFeedback(event.target.value)} placeholder="Précisez les ajustements attendus si nécessaire…" />
                </Field>
                {saveError ? <Alert tone="danger">{saveError}</Alert> : null}
                {saved ? <Alert tone="success">Votre décision a été enregistrée.</Alert> : null}
                <div className="flex flex-wrap justify-end gap-2"><Button variant="outline" onClick={() => void decide('request_correction')} disabled={saving || !feedback.trim()}>Demander une correction</Button><Button onClick={() => void decide('validate')} disabled={saving}>Valider</Button></div>
              </CardBody>
            </Card>
          ) : null}

        </div>

        <aside className="space-y-6">
          <Card>
            <CardHeader title="Repères" />
            <CardBody className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs text-ink-500">Offre</span>
                <span className="font-medium text-ink-900">{mission.offerCode}</span>
              </div>
              {mission.assignedConciergeId ? (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-ink-500">Account Manager assigné</span>
                  <span className="font-medium text-ink-900">{mission.assignedConciergeId}</span>
                </div>
              ) : null}
              <div className="flex items-center justify-between">
                <span className="text-xs text-ink-500">Statut</span>
                <Badge tone={status.tone}>{status.label}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-ink-500">Priorité</span>
                <span className="font-medium text-ink-900">{MISSION_PRIORITY_LABELS[mission.priority] ?? mission.priority}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-ink-500">Échéance</span>
                <span className="font-medium text-ink-900">{mission.dueDate ? longDate(mission.dueDate) : 'À définir'}</span>
              </div>
              {mission.completedAt ? (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-ink-500">Terminée le</span>
                  <span className="font-medium text-ink-900">{longDate(mission.completedAt)}</span>
                </div>
              ) : null}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Documents" />
            <CardBody>
              {mission.documents.length === 0 ? (
                <p className="text-sm text-ink-500">Aucun document n’est encore rattaché à cette mission.</p>
              ) : (
                <ul className="space-y-2">
                  {mission.documents.map((doc) => (
                    <li key={doc} className="flex items-center gap-2 text-sm text-ink-700">
                      <FileText className="h-4 w-4 text-ink-400" /> {doc}
                    </li>
                  ))}
                </ul>
              )}
              <Link to="/app/documents" className="mt-3 inline-block text-xs font-semibold text-brand-700">
                Gérer mes documents
              </Link>
            </CardBody>
          </Card>

          <Alert tone="warning" title="Hors périmètre" icon={<CircleAlert className="h-4 w-4" />}>
            Toute demande hors périmètre est chiffrée et validée avant exécution.
          </Alert>

          <Card className="p-4">
            <p className="flex items-center gap-1.5 text-xs text-ink-500">
              <Clock size={12} /> Dernière mise à jour {longDate(mission.updatedAt)}
            </p>
            <Link to="/app/messages" className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-brand-700">
              <MessageSquare className="h-3.5 w-3.5" /> Contacter mon Account Manager
            </Link>
            <p className="mt-3 flex items-center gap-1.5 text-xs text-ink-400">
               <Flag size={12} /> Axe {mission.id}
            </p>
          </Card>
        </aside>
      </div>
    </>
  )
}
