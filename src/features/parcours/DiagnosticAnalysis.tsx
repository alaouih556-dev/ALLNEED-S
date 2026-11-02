import { useEffect, useMemo, useState } from 'react'
import { Link } from '@tanstack/react-router'
import {
  AlertTriangle,
  Building2,
  Check,
  ExternalLink,
  FileText,
  Loader2,
  Lock,
  MessageSquare,
  Paperclip,
  Save,
  Send,
  ShieldCheck,
  Target,
  Upload,
} from 'lucide-react'
import { Alert, Badge, Button, Card, Field, Input, Modal, Select, Textarea, useDisclosure } from '@/components/ui'
import { PACKS, type SectorKey } from '@/features/health360/packs'
import type { DiagnosticQuestion } from '@/features/health360/diagnosticData'
import {
  documentOpenUrl,
  documentStatus,
  documentTypeLabel,
  useDocuments,
} from '@/lib/documents'
import { diagnosticStaffStatusLabel } from '@/lib/diagnostic-status'
import type {
  DiagnosticAnalysis as DiagnosticAnalysisShape,
  DiagnosticRecord,
  DiagnosticRecordStatus,
  DiagnosticSynthesis,
} from './useDiagnosticRecord'
import { fetchDiagnosticRecord, patchDiagnosticRecord } from './useDiagnosticRecord'

const STATUS_TONE: Record<DiagnosticRecordStatus, 'info' | 'warning' | 'success'> = {
  soumis: 'info',
  analyse: 'warning',
  en_analyse: 'warning',
  pret_a_valider: 'warning',
  restitue: 'success',
}

const EMPTY_SYNTHESIS: DiagnosticSynthesis = {
  confirmed: [],
  priorities: [],
  watch: [],
  opportunities: [],
  actions: [],
}

const PRIORITY_LEVELS = ['', 'Élevée', 'Importante', 'À traiter']

function lines(value: string) {
  return value
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean)
}

function join(value: string[] | undefined) {
  return (value ?? []).join('\n')
}

function nonEmpty(value: string[] | undefined) {
  return (value ?? []).filter((item) => item.trim().length > 0)
}

function apiErrorMessage(cause: unknown, fallback: string): string {
  const err = cause as Error & { status?: number }
  switch (err?.status) {
    case 403: return 'Vous n’avez pas accès à cette entreprise.'
    case 404: return 'Diagnostic introuvable.'
    default: return err?.message ?? fallback
  }
}

interface AxeGroup {
  id: number
  title: string
  subtitle: string
  pending?: boolean
  questions: DiagnosticQuestion[]
}

function groupByAxe(pack: (typeof PACKS)[SectorKey]): AxeGroup[] {
  return pack.volets.map((volet) => ({
    id: volet.id,
    title: volet.title,
    subtitle: volet.subtitle,
    pending: volet.pending,
    questions: pack.questions.filter((question) => Number(question.id[0]) === volet.id),
  }))
}

/**
 * Espace d'analyse d'un diagnostic pour l'équipe (concierge + admin).
 * Colonne gauche : le client, les documents liés, puis TOUTES les questions des
 * axes (répondues ou non) avec relance, commentaire concierge et note interne.
 * Colonne droite : l'analyse (note interne vs commentaire client clairement
 * séparés), la synthèse de restitution, le plan d'action et la validation.
 * Les deux champs par question (commentaire concierge, note interne) sont privés.
 */
export function DiagnosticAnalysis({
  record,
  org,
  sector,
  onSave,
}: {
  record: DiagnosticRecord
  org?: { name?: string; contactName?: string; contactEmail?: string; contactPhone?: string; city?: string } | null
  sector: SectorKey
  onSave: (id: string, body: Record<string, unknown>) => Promise<unknown>
}) {
  const pack = PACKS[sector]
  const [analysis, setAnalysis] = useState<DiagnosticAnalysisShape>(record.analysis ?? {})
  const [notes, setNotes] = useState(record.notes ?? '')
  const [questionNotes, setQuestionNotes] = useState<Record<string, string>>(record.questionNotes ?? {})
  const [questionComments, setQuestionComments] = useState<Record<string, string>>(record.questionComments ?? {})
  const [synthesis, setSynthesis] = useState<DiagnosticSynthesis>(record.synthesis ?? EMPTY_SYNTHESIS)
  const [rendezVous, setRendezVous] = useState(record.rendezVousAt ?? '')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const confirm = useDisclosure()
  const { documents } = useDocuments(record.orgId)

  const status: DiagnosticRecordStatus = record.status ?? 'soumis'
  const published = record.status === 'restitue' && Boolean(record.publishedAt) && record.restitutionVisible !== false
  const request = record.conciergeRequest
  const company = org?.name || request?.company || record.orgName || 'Entreprise'
  const contact = request?.contact || org?.contactName || ''
  const contactLine = [request?.phone || org?.contactPhone, request?.city || org?.city]
    .filter(Boolean)
    .join(' · ')

  useEffect(() => {
    setAnalysis(record.analysis ?? {})
    setNotes(record.notes ?? '')
    setQuestionNotes(record.questionNotes ?? {})
    setQuestionComments(record.questionComments ?? {})
    setSynthesis(record.synthesis ?? EMPTY_SYNTHESIS)
    setRendezVous(record.rendezVousAt ?? '')
  }, [record.id, record.updatedAt])

  const axes = useMemo(() => groupByAxe(pack), [pack])
  const allQuestions = useMemo(() => axes.flatMap((axe) => axe.questions), [axes])
  const scoreOf = (id: string) => record.answers?.[id]?.score ?? 0
  const commentOf = (id: string) => record.answers?.[id]?.comment ?? ''
  const answeredCount = allQuestions.filter((question) => scoreOf(question.id) > 0).length
  const missingDocs = documents.filter((doc) => doc.status === 'demande')

  const [activeAxeId, setActiveAxeId] = useState<number>(1)
  const [questionIndexWithinAxe, setQuestionIndexWithinAxe] = useState<number>(0)

  const currentAxeIndex = axes.findIndex((axe) => axe.id === activeAxeId)
  const currentAxe = axes[currentAxeIndex] ?? axes[0]
  const axeQuestions = currentAxe.questions
  const currentQuestion = axeQuestions[questionIndexWithinAxe] ?? null
  const isLastQuestion = questionIndexWithinAxe >= axeQuestions.length - 1
  const isLastAxe = currentAxeIndex === axes.length - 1

  const goToNext = () => {
    if (isLastQuestion) {
      const nextIndex = currentAxeIndex + 1
      if (nextIndex < axes.length) {
        setActiveAxeId(axes[nextIndex].id)
        setQuestionIndexWithinAxe(0)
      }
    } else {
      setQuestionIndexWithinAxe(questionIndexWithinAxe + 1)
    }
  }

  const goToPrevious = () => {
    if (questionIndexWithinAxe > 0) {
      setQuestionIndexWithinAxe(questionIndexWithinAxe - 1)
    } else {
      const prevIndex = currentAxeIndex - 1
      if (prevIndex >= 0) {
        const prevAxe = axes[prevIndex]
        setActiveAxeId(prevAxe.id)
        setQuestionIndexWithinAxe(prevAxe.questions.length - 1)
      }
    }
  }

  const analysisBody = () => ({
    analysis: {
      priorityLevel: analysis.priorityLevel ?? '',
      internalNotes: analysis.internalNotes ?? '',
      priorities: nonEmpty(analysis.priorities),
      recommendations: nonEmpty(analysis.recommendations),
      strengths: nonEmpty(analysis.strengths),
      weaknesses: nonEmpty(analysis.weaknesses),
      risks: nonEmpty(analysis.risks),
      opportunities: nonEmpty(analysis.opportunities),
      needsPrioritaires: nonEmpty(analysis.needsPrioritaires),
      actionPlan: nonEmpty(analysis.actionPlan),
      nextSteps: nonEmpty(analysis.nextSteps),
    },
    notes,
    synthesis,
    questionNotes,
    questionComments,
    rendezVousAt: rendezVous ? rendezVous : null,
  })

  const validation = [
    { label: 'Au moins 3 points forts', ok: nonEmpty(analysis.strengths).length >= 3 },
    { label: 'Au moins 3 points à améliorer', ok: nonEmpty(analysis.weaknesses).length >= 3 },
    { label: 'Au moins 3 priorités retenues', ok: nonEmpty(analysis.priorities).length >= 3 },
    { label: 'Au moins 1 opportunité', ok: nonEmpty(analysis.opportunities).length >= 1 },
    { label: 'Au moins 1 risque / menace', ok: nonEmpty(analysis.risks).length >= 1 },
    { label: 'Au moins 1 étape de plan d’action', ok: nonEmpty(analysis.actionPlan).length >= 1 },
    { label: 'Commentaire de restitution pour le client', ok: notes.trim().length > 0 },
  ]
  const readyToPublish = validation.every((item) => item.ok)

  async function save(nextStatus?: DiagnosticRecordStatus) {
    if (!record) return
    setBusy(nextStatus === 'pret_a_valider' ? 'ready' : 'draft')
    setError('')
    setInfo('')
    try {
      const target = nextStatus ?? (status === 'soumis' ? 'en_analyse' : status)
      await onSave(record.id, { ...analysisBody(), status: target })
      setInfo(
        target === 'pret_a_valider'
          ? 'Diagnostic marqué « prêt à valider ». Rien n’est encore publié au client.'
          : 'Brouillon enregistré. Rien n’a encore été publié au client.',
      )
    } catch (cause) {
      setError(apiErrorMessage(cause, 'Enregistrement impossible.'))
    } finally {
      setBusy(null)
    }
  }

  async function publish(toggle?: 'mask' | 'republish') {
    if (!record) return
    setBusy(toggle ?? 'publish')
    setError('')
    setInfo('')
    try {
      if (toggle === 'mask') {
        await onSave(record.id, { restitutionVisible: false })
        setInfo('Restitution masquée : le client ne la voit plus.')
      } else {
        await onSave(record.id, { ...analysisBody(), publishRestitution: true, restitutionVisible: true })
        setInfo('Restitution validée et publiée au client.')
      }
    } catch (cause) {
      setError(apiErrorMessage(cause, 'Publication impossible.'))
    } finally {
      setBusy(null)
      confirm.close()
    }
  }

  return (
    <div className="space-y-6">
      {error ? (
        <Alert tone="danger" title="Action impossible">
          {error}
        </Alert>
      ) : null}
      {info ? <Alert tone="success">{info}</Alert> : null}

      <Card className="p-5 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="eyebrow">Diagnostic à analyser</p>
            <h1 className="mt-3 font-display text-2xl font-bold text-ink-950">{company}</h1>
            <p className="mt-2 text-sm leading-relaxed text-ink-600">
              {contact ? `${contact} · ` : ''}
              {contactLine ? `${contactLine} · ` : ''}
              {pack.label} · envoyé le {new Date(record.createdAt).toLocaleDateString('fr-FR')}
            </p>
          </div>
          <Badge tone={STATUS_TONE[status]}>{published ? 'Restitué / publié' : diagnosticStaffStatusLabel(status)}</Badge>
        </div>

        {request ? (
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl bg-ink-50 p-4">
              <p className="text-[0.65rem] font-bold uppercase tracking-[0.14em] text-ink-400">Objectif</p>
              <p className="mt-2 text-sm leading-relaxed text-ink-700">{request.objective || '—'}</p>
            </div>
            <div className="rounded-xl bg-ink-50 p-4">
              <p className="text-[0.65rem] font-bold uppercase tracking-[0.14em] text-ink-400">Point le plus urgent</p>
              <p className="mt-2 text-sm leading-relaxed text-ink-700">{request.priority || '—'}</p>
            </div>
          </div>
        ) : null}

        {published ? (
          <p className="mt-5 flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            <Check className="h-4 w-4" strokeWidth={3} />
            Restitution publiée au client{record.publishedAt ? ` le ${new Date(record.publishedAt).toLocaleDateString('fr-FR')}` : ''}.
          </p>
        ) : record.restitutionVisible === false ? (
          <p className="mt-5 flex items-center gap-2 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <Lock className="h-4 w-4" />
            Restitution masquée : le client n’y a pas accès actuellement.
          </p>
        ) : null}
      </Card>

      <div className="grid gap-6 xl:gap-8 xl:grid-cols-[40%_60%]">
        {/* ---- Colonne gauche : client, documents, axes et question courante ---- */}
        <div className="space-y-6">
          <Card className="p-5 sm:p-6">
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-brand-700">
              <Building2 className="h-4 w-4" />
              Le client
            </p>
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs text-ink-400">Secteur</dt>
                <dd className="mt-0.5 font-semibold text-ink-800">{pack.label}</dd>
              </div>
              <div>
                <dt className="text-xs text-ink-400">Format</dt>
                <dd className="mt-0.5 font-semibold text-ink-800">{record.format}</dd>
              </div>
              <div>
                <dt className="text-xs text-ink-400">Date d’envoi</dt>
                <dd className="mt-0.5 font-semibold text-ink-800">{new Date(record.createdAt).toLocaleDateString('fr-FR')}</dd>
              </div>
              <div>
                <dt className="text-xs text-ink-400">Réponses</dt>
                <dd className="mt-0.5 font-semibold text-ink-800">
                  {answeredCount} / {allQuestions.length} question{allQuestions.length > 1 ? 's' : ''} notée{answeredCount > 1 ? 's' : ''}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs text-ink-400">Score global</dt>
                <dd className="mt-0.5 font-semibold text-ink-800">
                  {answeredCount ? Math.round((allQuestions.reduce((sum, question) => sum + scoreOf(question.id), 0) / (answeredCount * 5)) * 100) : 0} / 100
                </dd>
              </div>
            </dl>
          </Card>

          <Card className="p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-brand-700">
                <Paperclip className="h-4 w-4" />
                Documents liés
              </p>
              <Badge tone="neutral">{documents.length} document{documents.length > 1 ? 's' : ''}</Badge>
            </div>

            {documents.length === 0 ? (
              <Alert tone="info" className="mt-4" title="Aucun document">
                Le client n’a pas encore déposé de document pour ce diagnostic.
              </Alert>
            ) : (
              <>
                {missingDocs.length > 0 ? (
                  <p className="mt-3 flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    {missingDocs.length} document{missingDocs.length > 1 ? 's' : ''} encore attendu{missingDocs.length > 1 ? 's' : ''}.
                  </p>
                ) : null}
                <ul className="mt-4 space-y-2">
                  {documents.map((doc) => {
                    const meta = documentStatus(doc.status)
                    return (
                      <li key={doc.id} className="flex items-center justify-between gap-3 rounded-xl border border-ink-100 p-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-ink-900">{doc.title || doc.fileName || 'Document'}</p>
                          <p className="mt-0.5 text-xs text-ink-500">
                            {documentTypeLabel(doc.type)}
                            {doc.sizeLabel ? ` · ${doc.sizeLabel}` : ''}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <Badge tone={meta.tone}>{meta.label}</Badge>
                          <a
                            href={documentOpenUrl(doc.id)}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:underline"
                          >
                            Ouvrir <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </>
            )}
          </Card>

          {/* Sélecteur d’axe (tabs compactes) */}
          <Card className="p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-brand-700">
                <Target className="h-4 w-4" />
                Axes du diagnostic
              </p>
              <span className="text-xs text-ink-500">Sélectionner un axe</span>
            </div>
            <div className="mt-4 flex gap-2 overflow-x-auto flex-nowrap">
              {axes.map((axe) => {
                const active = axe.id === activeAxeId
                const answered = axe.questions.filter((question) => scoreOf(question.id) > 0).length
                return (
                  <button
                    key={axe.id}
                    onClick={() => {
                      setActiveAxeId(axe.id)
                      setQuestionIndexWithinAxe(0)
                    }}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition-colors whitespace-nowrap ${
                      active
                        ? 'bg-brand-600 text-white border-brand-600'
                        : 'bg-white text-ink-700 border-ink-200 hover:border-brand-600 hover:bg-ink-50'
                    }`}
                  >
                    <span>Axe {axe.id}</span>
                    <span className="text-xs opacity-80">{answered}/{axe.questions.length}</span>
                  </button>
                )
              })}
            </div>
          </Card>

          {/* Question courante (une à la fois, comme le questionnaire client) */}
          {currentQuestion && (
            <Card className="p-5 sm:p-6">
              <div className="mb-4">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-xs font-bold uppercase tracking-[0.14em] text-ink-400">
                    Axe {currentAxe.id} / {axes.length}
                  </span>
                  <span className="text-xs font-bold uppercase tracking-[0.14em] text-ink-400">
                    Question {questionIndexWithinAxe + 1} / {axeQuestions.length}
                  </span>
                </div>
                <div className="h-1.5 w-full bg-ink-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-brand-600"
                    style={{ width: `${axeQuestions.length ? ((questionIndexWithinAxe + 1) / axeQuestions.length) * 100 : 0}%` }}
                  />
                </div>
                <p className="mt-2 text-xs text-ink-500">
                  {currentAxe.title}{currentAxe.pending ? ' · contenu à valider' : ''}
                </p>
              </div>

              <div className="mb-4">
                <h3 className="text-lg font-bold text-ink-950">{currentQuestion.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-700">{currentQuestion.question}</p>
                {currentQuestion.pending && <span className="mt-2 inline-block px-2 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-900">Contenu à valider</span>}
                {currentQuestion.besoinAcces && <span className="ml-2 inline-block px-2 py-0.5 rounded text-xs font-semibold bg-brand-100 text-brand-900">Besoin de prestataire</span>}
              </div>

              <div className="grid gap-3 sm:grid-cols-2 mb-4">
                <div className="rounded-lg border border-ink-100 bg-white p-3">
                  <p className="text-[0.65rem] font-bold uppercase tracking-[0.14em] text-ink-400">Réponse client</p>
                  <p className="mt-1 text-sm text-ink-700">
                    {scoreOf(currentQuestion.id) === 0 ? 'Non renseignée' : `${scoreOf(currentQuestion.id)}/5`}
                  </p>
                </div>
                <div className="rounded-lg border border-ink-100 bg-white p-3">
                  <p className="text-[0.65rem] font-bold uppercase tracking-[0.14em] text-ink-400">Score</p>
                  <p className="mt-1 text-sm font-semibold text-ink-950">
                    {scoreOf(currentQuestion.id) === 0 ? '—' : `${scoreOf(currentQuestion.id)} / 5`}
                  </p>
                </div>
              </div>

              {commentOf(currentQuestion.id) && (
                <div className="mb-4 rounded-lg bg-ink-50 p-3">
                  <p className="text-[0.65rem] font-bold uppercase tracking-[0.14em] text-ink-400">Commentaire client</p>
                  <p className="mt-1 text-sm italic text-ink-600">« {commentOf(currentQuestion.id)} »</p>
                </div>
              )}

              <div className="mb-4 rounded-lg border border-ink-100 bg-white p-3">
                <p className="text-[0.65rem] font-bold uppercase tracking-[0.14em] text-ink-400">Relance</p>
                <p className="mt-1 text-sm text-ink-700">{currentQuestion.relance}</p>
              </div>

              {/* Champs staff (privés) — uniquement pour la question active */}
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Note interne concierge (privée)">
                  <Textarea
                    rows={2}
                    value={questionNotes[currentQuestion.id] ?? ''}
                    onChange={(event) =>
                      setQuestionNotes((current) => ({ ...current, [currentQuestion.id]: event.target.value }))
                    }
                    placeholder="Constats et éléments à vérifier…"
                  />
                </Field>
                <Field label="Commentaire concierge (privée)">
                  <Textarea
                    rows={2}
                    value={questionComments[currentQuestion.id] ?? ''}
                    onChange={(event) =>
                      setQuestionComments((current) => ({ ...current, [currentQuestion.id]: event.target.value }))
                    }
                    placeholder="Ce qu’il faut creuser avec le client…"
                  />
                </Field>
              </div>

              <div className="mt-6 flex flex-wrap justify-between items-center gap-2">
                <button
                  onClick={goToPrevious}
                  disabled={questionIndexWithinAxe === 0}
                  className="px-4 py-2 rounded-lg border border-ink-300 text-sm font-medium text-ink-700 disabled:opacity-50 disabled:pointer-events-none"
                >
                  ← Précédent
                </button>
                <span className="text-xs text-ink-400">Enregistré automatiquement</span>
                <button
                  onClick={goToNext}
                  disabled={isLastQuestion && isLastAxe}
                  className="px-4 py-2 rounded-lg bg-brand-600 text-white text-sm font-medium disabled:opacity-50 disabled:pointer-events-none"
                >
                  {isLastQuestion && !isLastAxe ? 'Terminer l’axe' : isLastAxe ? 'Terminer' : 'Suivant →'}
                </button>
              </div>
            </Card>
          )}

          {!currentQuestion && (
            <Card className="p-5 sm:p-6 text-center">
              <p className="text-sm text-ink-500">Aucune question dans cet axe.</p>
            </Card>
          )}
        </div>

        {/* ---- Colonne droite : analyse et restitution ---- */}
        <div className="space-y-6">
          <Card className="border-amber-200 p-5 sm:p-6">
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-amber-800">
              <Lock className="h-4 w-4" />
              A. Note interne — équipe ALLNEEDS uniquement
            </p>
            <p className="mt-1 text-xs text-ink-500">
              Jamais transmise au client. Libre expression, hypothèses, doutes, décisions internes.
            </p>
            <div className="mt-4">
              <Field label="Note interne">
                <Textarea
                  rows={4}
                  value={analysis.internalNotes ?? ''}
                  onChange={(event) => setAnalysis((current) => ({ ...current, internalNotes: event.target.value }))}
                  placeholder="Vérifications à faire, contexte, arbitrages internes…"
                />
              </Field>
            </div>
          </Card>

          <Card className="border-emerald-200 p-5 sm:p-6">
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-emerald-800">
              <MessageSquare className="h-4 w-4" />
              B. Commentaire pour le client — visible dans la restitution
            </p>
            <p className="mt-1 text-xs text-ink-500">
              Relu et éventuellement corrigé avec le client. Il apparaît tel quel dans la restitution publiée.
            </p>
            <div className="mt-4">
              <Field label="Commentaire pour le client">
                <Textarea
                  rows={4}
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Ce que vous voulez dire clairement au dirigeant."
                />
              </Field>
            </div>
          </Card>

          <Card className="p-5 sm:p-6">
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-brand-700">
              <Target className="h-4 w-4" />
              Synthèse de restitution
            </p>
            <p className="mt-1 text-xs text-ink-500">Cinq chapitres, listes courtes, en langage clair. Un élément par ligne.</p>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <TextListField
                label="Ce qui est confirmé"
                hint="Ce qui fonctionne déjà et ne doit pas être défait."
                value={synthesis.confirmed}
                onChange={(value) => setSynthesis((current) => ({ ...current, confirmed: value }))}
              />
              <TextListField
                label="Priorités retenues"
                hint="Trois à cinq priorités, dans l’ordre de traitement."
                value={synthesis.priorities}
                onChange={(value) => setSynthesis((current) => ({ ...current, priorities: value }))}
              />
              <TextListField
                label="À surveiller"
                hint="Risques et signaux faibles à vérifier régulièrement."
                value={synthesis.watch}
                onChange={(value) => setSynthesis((current) => ({ ...current, watch: value }))}
              />
              <TextListField
                label="Opportunités"
                hint="Ce qui pourrait être saisi sans attendre."
                value={synthesis.opportunities}
                onChange={(value) => setSynthesis((current) => ({ ...current, opportunities: value }))}
              />
              <TextListField
                label="Premières actions"
                hint="Gestes concrets pour les dix prochains jours."
                value={synthesis.actions}
                onChange={(value) => setSynthesis((current) => ({ ...current, actions: value }))}
              />
            </div>
          </Card>

          <Card className="p-5 sm:p-6">
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-ink-500">
              <Target className="h-4 w-4" />
              Analyse détaillée de la restitution
            </p>
            <p className="mt-1 text-xs text-ink-500">
              Priorités, recommandations, points forts et faibles, risques et opportunités, besoins prioritaires,
              plan d’action et prochaines étapes.
            </p>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div>
                <Field label="Niveau de priorité">
                  <Select
                    value={analysis.priorityLevel ?? ''}
                    onChange={(event) => setAnalysis((current) => ({ ...current, priorityLevel: event.target.value }))}
                  >
                    {PRIORITY_LEVELS.map((level) => (
                      <option key={level} value={level}>
                        {level || 'À définir'}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
              <div>
                <Field label="Rendez-vous de restitution">
                  <Input
                    type="datetime-local"
                    value={rendezVous.slice(0, 16)}
                    onChange={(event) => setRendezVous(event.target.value)}
                  />
                </Field>
              </div>
              <TextListField
                label="Priorités retenues"
                hint="Liste finale des priorités."
                value={analysis.priorities ?? []}
                onChange={(value) => setAnalysis((current) => ({ ...current, priorities: value }))}
              />
              <TextListField
                label="Recommandations"
                hint="Actions recommandées, une par ligne."
                value={analysis.recommendations ?? []}
                onChange={(value) => setAnalysis((current) => ({ ...current, recommendations: value }))}
              />
              <TextListField
                label="Points forts"
                value={analysis.strengths ?? []}
                onChange={(value) => setAnalysis((current) => ({ ...current, strengths: value }))}
              />
              <TextListField
                label="Points faibles"
                value={analysis.weaknesses ?? []}
                onChange={(value) => setAnalysis((current) => ({ ...current, weaknesses: value }))}
              />
              <TextListField
                label="Risques"
                value={analysis.risks ?? []}
                onChange={(value) => setAnalysis((current) => ({ ...current, risks: value }))}
              />
              <TextListField
                label="Opportunités"
                value={analysis.opportunities ?? []}
                onChange={(value) => setAnalysis((current) => ({ ...current, opportunities: value }))}
              />
              <TextListField
                label="Besoins prioritaires"
                value={analysis.needsPrioritaires ?? []}
                onChange={(value) => setAnalysis((current) => ({ ...current, needsPrioritaires: value }))}
              />
              <TextListField
                label="Plan d’action"
                hint="Une étape par ligne, dans l’ordre."
                value={analysis.actionPlan ?? []}
                onChange={(value) => setAnalysis((current) => ({ ...current, actionPlan: value }))}
              />
              <TextListField
                label="Prochaines étapes"
                value={analysis.nextSteps ?? []}
                onChange={(value) => setAnalysis((current) => ({ ...current, nextSteps: value }))}
              />
            </div>
          </Card>

          <Card className="border-ink-200 p-5 sm:p-6">
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-ink-500">
              <ShieldCheck className="h-4 w-4" />
              Checklist avant publication
            </p>
            <ul className="mt-4 grid gap-2 sm:grid-cols-2">
              {validation.map((item) => (
                <li key={item.label} className="flex items-center gap-2 text-sm">
                  {item.ok ? (
                    <Check className="h-4 w-4 shrink-0 text-emerald-600" strokeWidth={3} />
                  ) : (
                    <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
                  )}
                  <span className={item.ok ? 'text-ink-700' : 'text-ink-500'}>{item.label}</span>
                </li>
              ))}
            </ul>
            {!readyToPublish ? (
              <p className="mt-4 flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900">
                <AlertTriangle className="h-3.5 w-3.5" />
                La restitution ne peut pas être publiée tant que ces éléments ne sont pas complétés.
              </p>
            ) : null}
          </Card>

          <Card className="p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ink-100 pt-4">
              <p className="text-xs text-ink-500">
                {published
                  ? 'La restitution est publiée. Vous pouvez la masquer ou la republier après modification.'
                  : 'Enregistrez votre brouillon autant que nécessaire, puis validez la restitution une fois prête.'}
              </p>
              <div className="flex flex-wrap gap-2">
                {published ? (
                  <>
                    <Button
                      variant="outline"
                      className="text-red-700"
                      disabled={busy !== null}
                      onClick={() => void publish('mask')}
                    >
                      {busy === 'mask' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Lock className="mr-2 h-4 w-4" />}
                      Masquer la restitution au client
                    </Button>
                    <Button
                      disabled={busy !== null || !readyToPublish}
                      onClick={() => {
                        confirm.openFn()
                      }}
                    >
                      <Send className="mr-2 h-4 w-4" />
                      Republier la restitution
                    </Button>
                  </>
                ) : (
                  <>
                    <Button variant="outline" disabled={busy !== null} onClick={() => void save()}>
                      {busy === 'draft' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                      Enregistrer le brouillon
                    </Button>
                    <Button
                      variant="outline"
                      disabled={busy !== null || status === 'pret_a_valider'}
                      onClick={() => void save('pret_a_valider')}
                    >
                      {busy === 'ready' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
                      Marquer prêt à valider
                    </Button>
                    <Button
                      disabled={busy !== null || !readyToPublish}
                      onClick={() => {
                        confirm.openFn()
                      }}
                    >
                      {busy === 'publish' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                      Valider la restitution
                    </Button>
                  </>
                )}
              </div>
            </div>
          </Card>
        </div>
      </div>

      <Modal
        open={confirm.open}
        onClose={confirm.close}
        title="Confirmer la publication de cette restitution au client ?"
        description="La restitution deviendra visible dans l’espace du client. La note interne, le commentaire concierge et les notes par question ne seront jamais transmis ; seuls la synthèse, le commentaire pour le client et les chapitres validés seront visibles."
      >
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="ghost" onClick={confirm.close}>
            Annuler
          </Button>
          <Button onClick={() => void publish()} disabled={busy !== null}>
            {busy === 'publish' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
            {published ? 'Republier' : 'Publier la restitution'}
          </Button>
        </div>
      </Modal>

      <Card className="mt-6 p-4 sm:p-5">
        <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-brand-700">
          <FileText className="h-4 w-4" />
          Confidentialité
        </p>
        <p className="mt-2 text-sm leading-relaxed text-ink-600">
          Le client ne voit jamais la note interne, le commentaire concierge, ni les notes par question. La restitution
          n’est visible qu’après cette validation explicite, jamais automatiquement à l’envoi du questionnaire.
        </p>
      </Card>
    </div>
  )
}

function TextListField({
  label,
  hint,
  value,
  onChange,
}: {
  label: string
  hint?: string
  value: string[]
  onChange: (value: string[]) => void
}) {
  return (
    <div>
      <Field label={label} hint={hint ? `${hint} Un élément par ligne.` : 'Un élément par ligne.'}>
        <Textarea rows={4} value={join(value)} onChange={(event) => onChange(lines(event.target.value))} />
      </Field>
    </div>
  )
}

/**
 * Charge un diagnostic (équipe) puis affiche l'espace d'analyse.
 * `orgsUrl` : endpoint qui renvoie la liste des organisations visibles du rôle
 * (ex. /api/concierge/orgs ou /api/admin/orgs).
 */
export function DiagnosticRecordWorkspace({
  id,
  orgsUrl,
  backTo,
}: {
  id: string
  orgsUrl: string
  backTo: string
}) {
  const [record, setRecord] = useState<DiagnosticRecord | null>(null)
  const [org, setOrg] = useState<{ name?: string; contactName?: string; contactEmail?: string; contactPhone?: string; city?: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError('')
      try {
        const [fetched, orgs] = await Promise.all([
          fetchDiagnosticRecord(id),
          fetch(orgsUrl, { credentials: 'same-origin', cache: 'no-store' }).then(async (response) => {
            if (!response.ok) return []
            return (await response.json()) as Array<{ id: string; name?: string; contactName?: string; contactEmail?: string; contactPhone?: string; city?: string }>
          }),
        ])
        if (cancelled) return
        if (!fetched) {
          setError('introuvable')
          return
        }
        setRecord(fetched)
        setOrg(orgs.find((item: { id: string }) => item.id === fetched.orgId) ?? null)
      } catch (cause) {
        if (!cancelled) setError(apiErrorMessage(cause, 'Impossible de charger le diagnostic.'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [id, orgsUrl])

  if (loading) {
    return (
      <Card className="p-6">
        <p className="flex items-center gap-2 text-sm text-ink-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Chargement du diagnostic…
        </p>
      </Card>
    )
  }

  if (error === 'introuvable') {
    return (
      <Card className="p-6 text-center">
        <p className="font-display text-lg font-bold text-ink-950">Diagnostic introuvable</p>
        <p className="mt-1 text-sm text-ink-500">Il n’existe pas ou n’est plus accessible pour votre compte.</p>
        <Link to={backTo} className="mt-4 inline-block">
          Retour à la liste
        </Link>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="p-6">
        <Alert tone="danger" title="Impossible de charger le diagnostic">
          {error}
        </Alert>
        <Link to={backTo} className="mt-4 inline-block text-sm font-semibold text-brand-700">
          Retour à la liste
        </Link>
      </Card>
    )
  }

  if (!record) return null

  const rawSector = record.sector
  const sector: SectorKey =
    rawSector === 'sante' || rawSector === 'enseignement' || rawSector === 'tourisme' ? rawSector : 'sante'

  return (
    <DiagnosticAnalysis
      key={record.id}
      record={record}
      org={org}
      sector={sector}
      onSave={async (recordId, body) => {
        const updated = await patchDiagnosticRecord(recordId, body)
        setRecord(updated)
        return updated
      }}
    />
  )
}
