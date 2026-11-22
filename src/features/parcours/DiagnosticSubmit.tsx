import { useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { ArrowRight, Check, CheckCircle2, Loader2, Send } from 'lucide-react'
import { Alert, Badge, Button, Card, Progress } from '@/components/ui'
import { PACKS, type SectorKey } from '@/features/health360/packs'
import { readDiagnosticDraft, answeredDraftQuestions, type DiagnosticDraft } from '@/lib/diagnostic-draft'
import { canClientViewRestitution } from '@/lib/diagnostic-status'
import { RestitutionStatusTimeline } from './DiagnosticTimeline'
import { useDiagnosticRecord } from './useDiagnosticRecord'

/**
 * Fin du questionnaire : le client relit une SYNTHÈSE DE SES RÉPONSES
 * (description factuelle, sans recommandation) puis transmet le diagnostic.
 * Après l'envoi, un écran « diagnostic transmis » ouvre le suivi d'analyse.
 */
export function DiagnosticSubmit({
  orgId,
  sector,
  companyName,
  onSubmitted,
}: {
  orgId: string
  sector: SectorKey
  companyName: string
  onSubmitted: (recordId: string) => void
}) {
  const { primary, ensure, error } = useDiagnosticRecord(orgId || null)
  const [draft, setDraft] = useState<DiagnosticDraft>(() => readDiagnosticDraft(sector))
  const [busy, setBusy] = useState(false)
  const [localError, setLocalError] = useState('')

  useEffect(() => {
    const tick = () => setDraft(readDiagnosticDraft(sector))
    tick()
    const id = window.setInterval(tick, 1500)
    return () => window.clearInterval(id)
  }, [sector])

  const submitted = Boolean(primary)
  const answered = draft.answered > 0
  const completed = draft.answered === draft.total
  const progress = draft.total > 0 ? Math.round((draft.answered / draft.total) * 100) : 0
  const published = Boolean(primary && canClientViewRestitution(primary))
  const pack = PACKS[sector]

  async function submit() {
    setBusy(true)
    setLocalError('')
    try {
      const record = await ensure({ sector, answers: draft.answers })
      onSubmitted(record.id)
    } catch (cause) {
      setLocalError(cause instanceof Error ? cause.message : 'Envoi impossible.')
    } finally {
      setBusy(false)
    }
  }

  if (submitted) {
    return (
      <Card className="mt-6 border-emerald-200 p-5 sm:p-7">
        <p className="flex items-center gap-2 text-sm font-bold text-emerald-900">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          Votre diagnostic a bien été transmis
        </p>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-600">
          Vos réponses sont enregistrées pour {companyName || 'votre établissement'}.
          {published ? (
            <> Votre restitution est disponible : votre Account Manager vous a préparé vos priorités.</>
          ) : (
            <> Votre Account Manager les analyse avant de vous recontacter.</>
          )}
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Badge tone={published ? 'success' : 'warning'}>
            {published ? 'Restitution disponible' : "En cours d'analyse"}
          </Badge>
          {published ? (
            <Link to="/app/diagnostics">
              <Button size="sm">
                Voir ma restitution
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          ) : null}
        </div>

        <div className="mt-6 rounded-2xl border border-ink-100 bg-white p-5">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-ink-500">Où en est mon diagnostic ?</p>
          <RestitutionStatusTimeline answered={completed || answered} submittedAt={primary?.createdAt} publishedAt={primary?.publishedAt} />
        </div>

        <div className="mt-5 flex flex-wrap gap-3 border-t border-ink-100 pt-5">
          <Link to="/app/documents">
            <Button size="sm">
              Préparer mes documents
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
          <Link to="/app/diagnostics">
            <Button size="sm" variant="outline">
              Suivre ma restitution
            </Button>
          </Link>
        </div>
      </Card>
    )
  }

  const rows = answeredDraftQuestions(sector, draft.answers)
  const byVolet = new Map<number, typeof rows>()
  for (const row of rows) {
    const id = Number(row.question.id[0])
    byVolet.set(id, [...(byVolet.get(id) ?? []), row])
  }

  return (
    <Card className="mt-6 p-5 sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow">Fin du questionnaire</p>
          <h2 className="mt-3 font-display text-xl font-bold text-ink-950">Synthèse de votre diagnostic</h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-600">
            Ce récapitulatif reprend vos réponses au diagnostic {pack.label}, volet par volet. Il ne contient ni
            note globale, ni priorité, ni plan d’action : l’analyse de votre situation est réalisée ensuite par
            votre Account Manager, puis confirmée avec vous.
          </p>
        </div>
        <Badge tone={completed ? 'success' : 'warning'}>
          {draft.answered} / {draft.total} répondues
        </Badge>
      </div>

      <div className="mt-5">
        <Progress value={progress} label="Questionnaire" tone={completed ? 'emerald' : 'brand'} />
      </div>

      {error || localError ? (
        <Alert tone="danger" className="mt-4" title="Envoi impossible">
          {error || localError}
        </Alert>
      ) : null}

      {!draft.started ? (
        <Alert tone="info" className="mt-4" title="Questionnaire non commencé">
          Ouvrez le questionnaire, validez le cadre puis répondez à la première question. Vos réponses sont
          enregistrées automatiquement dans ce navigateur.
        </Alert>
      ) : null}

      {draft.started && rows.length === 0 ? (
        <Alert tone="warning" className="mt-4" title="Aucune réponse à transmettre">
          Répondez au moins à une question pour pouvoir envoyer votre diagnostic.
        </Alert>
      ) : null}

      {rows.length > 0 ? (
        <div className="mt-6 space-y-5">
          {[...byVolet.entries()].map(([voletId, items]) => {
            const volet = pack.volets.find((item) => item.id === voletId)
            return (
              <section key={voletId} className="rounded-2xl border border-ink-100 p-5">
                <p className="text-[0.65rem] font-bold uppercase tracking-[0.14em] text-brand-700">
                  Volet {voletId} · {volet?.title ?? 'Sujet'}
                </p>
                <ul className="mt-3 space-y-4">
                  {items.map((row) => (
                    <li key={row.question.id} className="border-t border-ink-100 pt-4 first:border-t-0 first:pt-0">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <p className="text-sm font-semibold text-ink-900">{row.question.title}</p>
                        <span className="text-xs tabular-nums text-ink-500">Note {row.score}/5</span>
                      </div>
                      <p className="mt-1 text-sm leading-relaxed text-ink-700">{row.situation}</p>
                      {row.comment ? (
                        <p className="mt-1 text-xs italic text-ink-500">« {row.comment} »</p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </section>
            )
          })}
        </div>
      ) : null}

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-ink-100 pt-5">
        <p className="text-xs text-ink-500">
          En envoyant, vous transmettrez uniquement ces réponses à votre Account Manager ALLNEEDS.
        </p>
        <Button
          onClick={submit}
          disabled={busy || !draft.started || draft.answered === 0}
          size={rows.length ? 'lg' : undefined}
        >
          {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
          Envoyer mon diagnostic à ALLNEEDS
        </Button>
      </div>
    </Card>
  )
}