import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { ArrowLeft, ArrowRight, CheckCircle2, Lock, Send, Stethoscope, Target } from 'lucide-react'
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  Field,
  Input,
  Modal,
  Textarea,
  useDisclosure,
} from '@/components/ui'
import {
  SANTE_QUESTIONS,
  SANTE_AXES,
  type SanteAnswer,
  computeSanteSynthese,
  santeAxeTitle,
} from '@/features/health360/diagnostic-sante'
import { useDiagnosticRecord } from '@/features/parcours/useDiagnosticRecord'
import { canClientViewRestitution } from '@/lib/diagnostic-status'
import { cn } from '@/lib/utils'

/* ------------------------------------------------------------------ */
/* Web Speech API (dictée vocale) — déclarations locales               */
/* Aucun type externe n’est requis.                                  */
/* ------------------------------------------------------------------ */

interface SpeechRecognitionAlternative {
  readonly transcript: string
  readonly confidence: number
}

interface SpeechRecognitionResult {
  readonly isFinal: boolean
  readonly length: number
  item(index: number): SpeechRecognitionAlternative
  [index: number]: SpeechRecognitionAlternative
}

interface SpeechRecognitionResultList {
  readonly length: number
  item(index: number): SpeechRecognitionResult
  [index: number]: SpeechRecognitionResult
}

interface SpeechRecognitionErrorEvent extends Event {
  readonly error: string
  readonly message?: string
}

interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number
  readonly results: SpeechRecognitionResultList
}

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean
  interimResults: boolean
  lang: string
  start(): void
  stop(): void
  abort(): void
  onresult: ((event: SpeechRecognitionEvent) => void) | null
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null
  onend: ((event: Event) => void) | null
}

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionInstance
    webkitSpeechRecognition?: new () => SpeechRecognitionInstance
  }
}

const TOTAL_QUESTIONS = 25
const STORAGE_PREFIX = 'allneeds.questionnaire-sante.'

/* ------------------------------------------------------------------ */
/* Entreprises affichées dans la colonne gauche.                      */
/* ------------------------------------------------------------------ */
const DEMO_ORGS: Record<string, { name: string; city: string }> = {
  'org-nour': { name: 'Clinique Nour', city: 'Rabat' },
}

type Phase = 'accueil' | 'saisie' | 'synthese' | 'termine'

type SynthesisDraft = {
  forces: string[]
  faiblesses: string[]
  opportunites: string[]
  menaces: string[]
  priorites: string[]
  recommandations: string[]
  planAction: string[]
  commentaireClient: string
  noteInterne: string
}

function emptySynthesis(): SynthesisDraft {
  return {
    forces: [],
    faiblesses: [],
    opportunites: [],
    menaces: [],
    priorites: [],
    recommandations: [],
    planAction: [],
    commentaireClient: '',
    noteInterne: '',
  }
}

function emptyAnswers(): Record<string, SanteAnswer> {
  const answers: Record<string, SanteAnswer> = {}
  for (const q of SANTE_QUESTIONS) answers[q.id] = { score: 0, comment: '' }
  return answers
}

function loadAnswers(orgId: string): Record<string, SanteAnswer> {
  if (typeof window === 'undefined') return emptyAnswers()
  try {
    const raw = window.localStorage.getItem(STORAGE_PREFIX + orgId)
    if (!raw) return emptyAnswers()
    const parsed = JSON.parse(raw) as Partial<Record<string, SanteAnswer>>
    const answers: Record<string, SanteAnswer> = {}
    for (const q of SANTE_QUESTIONS) {
      const entry = parsed[q.id]
      answers[q.id] = {
        score: entry?.score ?? 0,
        comment: typeof entry?.comment === 'string' ? entry.comment : '',
      }
    }
    return answers
  } catch {
    return emptyAnswers()
  }
}

function saveAnswers(orgId: string, answers: Record<string, SanteAnswer>) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_PREFIX + orgId, JSON.stringify(answers))
  } catch {
    /* stockage indisponible : le questionnaire reste utilisable en mémoire */
  }
}

export function QuestionnaireSante({ orgId: orgIdProp }: { orgId?: string }) {
  const navigate = useNavigate()
  const search = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null
  const orgId = orgIdProp || search?.get('orgId') || undefined

  const [orgPickerOpen, setOrgPickerOpen] = useState(!Boolean(orgId))
  const [orgs, setOrgs] = useState<Array<{ id: string; name: string; sector: string }>>([])
  const [orgsLoading, setOrgsLoading] = useState(false)

  const { records, primary, submit, patchRecord, loading } = useDiagnosticRecord(orgId || null)

  const [phase, setPhase] = useState<Phase>('accueil')
  const [axeIndex, setAxeIndex] = useState(0)
  const [questionIndex, setQuestionIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, SanteAnswer>>(emptyAnswers())
  const [staffNotes, setStaffNotes] = useState<Record<string, string>>({})
  const [synthese, setSynthese] = useState<SynthesisDraft>(emptySynthesis())
  const [busy, setBusy] = useState(false)
  const [localError, setLocalError] = useState('')
  const [localInfo, setLocalInfo] = useState('')
  const [diagnosticId, setDiagnosticId] = useState<string | null>(null)

  /* ------------------------------------------------------------------ */
  /* État dictée vocale                                                 */
  /* ------------------------------------------------------------------ */
  const [isListening, setIsListening] = useState(false)
  const [speechSupported, setSpeechSupported] = useState(false)
  const [interimTranscript, setInterimTranscript] = useState('')
  const [speechError, setSpeechError] = useState<string | null>(null)
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)
  const activeQuestionIdRef = useRef<string | null>(null)

  const confirmPublish = useDisclosure()

  const currentAxe = SANTE_AXES[axeIndex]
  const axeQuestions = SANTE_QUESTIONS.filter((q) => q.axe === currentAxe.id)
  const currentQuestion = axeQuestions[questionIndex] ?? null
  const globalIndex = axeIndex * 5 + questionIndex
  const isLastQuestion = globalIndex >= TOTAL_QUESTIONS - 1
  const isLastQuestionInAxe = questionIndex >= axeQuestions.length - 1
  const isLastAxe = axeIndex >= SANTE_AXES.length - 1

  const answeredCount = SANTE_QUESTIONS.reduce((n, q) => (answers[q.id]?.score ?? 0) > 0 ? n + 1 : n, 0)
  const progress = Math.round((answeredCount / TOTAL_QUESTIONS) * 100)
  const axeAnswered = axeQuestions.reduce((n, q) => (answers[q.id]?.score ?? 0) > 0 ? n + 1 : n, 0)

  function sumScores(): number {
    return SANTE_QUESTIONS.reduce((total, q) => total + (answers[q.id]?.score ?? 0), 0)
  }
  function axeSumScores(): number {
    return axeQuestions.reduce((total, q) => total + (answers[q.id]?.score ?? 0), 0)
  }

  // Un diagnostic existe déjà pour cette organisation : basculer sur l'analyse existante (une seule fois à l'ouverture).
  useEffect(() => {
    if (
      phase === 'accueil' &&
      orgId &&
      primary &&
      primary.status &&
      ['soumis', 'en_analyse', 'pret_a_valider', 'restitue'].includes(primary.status)
    ) {
      setPhase('termine')
      setDiagnosticId(primary.id)
    }
  }, [phase, orgId, primary])

  useEffect(() => {
    if (orgId) saveAnswers(orgId, answers)
  }, [orgId, answers])

  /* ------------------------------------------------------------------ */
  /* Initialisation de la reconnaissance vocale (navigateur uniquement) */
  /* ------------------------------------------------------------------ */
  useEffect(() => {
    if (typeof window === 'undefined') return
    const Ctor = window.SpeechRecognition ?? window.webkitSpeechRecognition
    if (!Ctor) {
      setSpeechSupported(false)
      return
    }
    setSpeechSupported(true)

    const rec = new Ctor()
    rec.continuous = true
    rec.interimResults = true
    rec.lang = 'fr-FR'

    rec.onresult = (event) => {
      let finalTranscript = ''
      let interim = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        const transcript = result.item(0).transcript
        if (result.isFinal) {
          finalTranscript += transcript
        } else {
          interim += transcript
        }
      }
      setInterimTranscript(interim)
      if (!finalTranscript.trim()) return
      const questionId = activeQuestionIdRef.current
      if (!questionId) return
      setAnswers((current) => {
        const prev = current[questionId]?.comment ?? ''
        const next = prev ? `${prev} ${finalTranscript.trim()}` : finalTranscript.trim()
        const entry: SanteAnswer = { ...current[questionId], comment: next }
        return { ...current, [questionId]: entry }
      })
      setSpeechError(null)
    }

    rec.onerror = (event) => {
      let msg = 'Erreur de reconnaissance vocale.'
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        msg = 'Accès au microphone refusé.'
      } else if (event.error === 'no-speech') {
        msg = 'Aucune voix détectée.'
      } else if (event.error === 'audio-capture' || event.error === 'not-allowed') {
        msg = 'Microphone indisponible.'
      }
      setSpeechError(msg)
      setIsListening(false)
    }

    rec.onend = () => {
      setIsListening(false)
    }

    recognitionRef.current = rec
    return () => {
      try {
        rec.stop()
      } catch {
        /* ignore */
      }
      recognitionRef.current = null
    }
  }, [])

  /* ------------------------------------------------------------------ */
  /* Changement de question : arrêter le micro et vider l'interim       */
  /* ------------------------------------------------------------------ */
  useEffect(() => {
    activeQuestionIdRef.current = currentQuestion?.id ?? null
    setInterimTranscript('')
    if (isListening) {
      const rec = recognitionRef.current
      if (rec) {
        try {
          rec.stop()
        } catch {
          /* ignore */
        }
      }
      setIsListening(false)
    }
  }, [currentQuestion?.id, isListening])

  /* ------------------------------------------------------------------ */
  /* Sélection de l’entreprise (concierge)                              */
  /* ------------------------------------------------------------------ */
  async function loadOrgs() {
    setOrgsLoading(true)
    setLocalError('')
    try {
      const response = await fetch('/api/concierge/orgs', { credentials: 'same-origin', cache: 'no-store' })
      if (!response.ok) throw new Error('Impossible de charger le portefeuille.')
      const rows = (await response.json()) as Array<{ id: string; name: string; sector: string }>
      setOrgs(rows.filter((row) => row.sector === 'sante'))
    } catch (cause) {
      setLocalError(cause instanceof Error ? cause.message : 'Impossible de charger le portefeuille.')
    } finally {
      setOrgsLoading(false)
    }
  }

  useEffect(() => {
    if (!orgId) loadOrgs()
  }, [orgId])

  function selectOrg(id: string) {
    setOrgPickerOpen(false)
    const url = new URL(window.location.href)
    url.searchParams.set('orgId', id)
    window.location.assign(url.toString())
  }

  /* ------------------------------------------------------------------ */
  /* Saisie — réponses                                                  */
  /* ------------------------------------------------------------------ */
  const setScore = useCallback((id: string, value: number) => {
    setAnswers((current) => {
      const entry: SanteAnswer = { ...current[id], score: value }
      return { ...current, [id]: entry }
    })
    setLocalError('')
  }, [])

  const setComment = useCallback((id: string, value: string) => {
    setAnswers((current) => {
      const entry: SanteAnswer = { ...current[id], comment: value }
      return { ...current, [id]: entry }
    })
    setLocalError('')
  }, [])

  /* ------------------------------------------------------------------ */
  /* Dictée vocale                                                      */
  /* ------------------------------------------------------------------ */
  const startListening = useCallback(() => {
    const rec = recognitionRef.current
    if (!rec || isListening) return
    setSpeechError(null)
    setInterimTranscript('')
    try {
      rec.start()
      setIsListening(true)
    } catch {
      setSpeechError('Impossible de démarrer la dictée vocale.')
    }
  }, [isListening])

  const stopListening = useCallback(() => {
    const rec = recognitionRef.current
    if (!rec) return
    try {
      rec.stop()
    } catch {
      /* ignore */
    }
    setIsListening(false)
  }, [])

  const setStaffNote = useCallback((id: string, value: string) => {
    setStaffNotes((current) => ({ ...current, [id]: value }))
    setLocalError('')
  }, [])

  const goPrevious = useCallback(() => {
    if (questionIndex > 0) {
      setQuestionIndex(questionIndex - 1)
    } else if (axeIndex > 0) {
      setAxeIndex(axeIndex - 1)
      setQuestionIndex(4)
    }
    setLocalError('')
  }, [axeIndex, questionIndex])

  const goNext = useCallback(() => {
    if (isLastQuestion) return
    if (isLastQuestionInAxe && !isLastAxe) {
      setAxeIndex(axeIndex + 1)
      setQuestionIndex(0)
    } else {
      setQuestionIndex(questionIndex + 1)
    }
    setLocalError('')
  }, [axeIndex, isLastQuestion, isLastQuestionInAxe, isLastAxe, questionIndex])

  const goToAxe = (axeId: number) => {
    setAxeIndex(SANTE_AXES.findIndex((a) => a.id === axeId))
    setQuestionIndex(0)
    setLocalError('')
  }

  const syntheseResult = useMemo(() => computeSanteSynthese(answers), [answers])

  /* ------------------------------------------------------------------ */
  /* Soumission du questionnaire (statut soumis)                         */
  /* ------------------------------------------------------------------ */
  async function submitDiagnostic() {
    if (!orgId) return
    setBusy(true)
    setLocalError('')
    setLocalInfo('')
    try {
      const record = await submit({ format: 'Complet', sector: 'sante', answers })
      // Conserver les notes privées staff par question en brouillon d'analyse.
      const questionNotes: Record<string, string> = {}
      for (const q of SANTE_QUESTIONS) {
        if (staffNotes[q.id]) questionNotes[q.id] = staffNotes[q.id]
      }
      if (Object.keys(questionNotes).length) {
        await patchRecord(record.id, { questionNotes })
      }
      setDiagnosticId(record.id)
      setPhase('synthese')
      setLocalInfo('Diagnostic transmis (statut : soumis). Rien n’est encore publié au client.')
    } catch (cause) {
      setLocalError(cause instanceof Error ? cause.message : 'Transmission impossible.')
    } finally {
      setBusy(false)
    }
  }

  /* ------------------------------------------------------------------ */
  /* Préparation et publication de la restitution                       */
  /* ------------------------------------------------------------------ */
  const analysisBody = () => ({
    analysis: {
      internalNotes: synthese.noteInterne,
      priorities: synthese.priorites.filter(Boolean),
      recommendations: synthese.recommandations.filter(Boolean),
      strengths: synthese.forces.filter(Boolean),
      weaknesses: synthese.faiblesses.filter(Boolean),
      risks: synthese.menaces.filter(Boolean),
      opportunities: synthese.opportunites.filter(Boolean),
      actionPlan: synthese.planAction.filter(Boolean),
      nextSteps: [],
    },
    notes: synthese.commentaireClient,
    synthesis: {
      confirmed: synthese.forces.filter(Boolean),
      priorities: synthese.priorites.filter(Boolean),
      watch: [],
      opportunities: synthese.opportunites.filter(Boolean),
      actions: synthese.planAction.filter(Boolean),
    },
  })

  const validation = [
    { label: 'Au moins 3 points forts', ok: synthese.forces.filter(Boolean).length >= 3 },
    { label: 'Au moins 3 points à améliorer', ok: synthese.faiblesses.filter(Boolean).length >= 3 },
    { label: 'Au moins 3 priorités retenues', ok: synthese.priorites.filter(Boolean).length >= 3 },
    { label: 'Au moins 1 opportunité', ok: synthese.opportunites.filter(Boolean).length >= 1 },
    { label: 'Au moins 1 risque / menace', ok: synthese.menaces.filter(Boolean).length >= 1 },
    { label: 'Au moins 1 étape de plan d’action', ok: synthese.planAction.filter(Boolean).length >= 1 },
    { label: 'Commentaire de restitution pour le client', ok: synthese.commentaireClient.trim().length > 0 },
  ]
  const readyToPublish = validation.every((item) => item.ok)

  async function saveDraft() {
    if (!diagnosticId) return
    setBusy(true)
    setLocalError('')
    try {
      await patchRecord(diagnosticId, { ...analysisBody(), status: 'en_analyse' })
      setLocalInfo('Brouillon enregistré. Rien n’a encore été publié au client.')
    } catch (cause) {
      setLocalError(cause instanceof Error ? cause.message : 'Enregistrement impossible.')
    } finally {
      setBusy(false)
    }
  }

  async function publish() {
    if (!diagnosticId) return
    setBusy(true)
    setLocalError('')
    try {
      await patchRecord(diagnosticId, {
        ...analysisBody(),
        publishRestitution: true,
        restitutionVisible: true,
        status: 'restitue',
      })
      setLocalInfo('Restitution validée et publiée au client.')
      setPhase('termine')
    } catch (cause) {
      setLocalError(cause instanceof Error ? cause.message : 'Publication impossible.')
    } finally {
      setBusy(false)
      confirmPublish.close()
    }
  }

  const published = Boolean(primary && canClientViewRestitution(primary))

  /* ------------------------------------------------------------------ */
  /* Rendu — accueil                                                    */
  /* ------------------------------------------------------------------ */
  if (phase === 'accueil') {
    return (
      <div className="mx-auto max-w-3xl px-6 py-10">
        <Card className="p-8 sm:p-10 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-700 mb-4">
            <Stethoscope className="h-7 w-7" />
          </div>
          <h2 className="font-display text-2xl font-bold text-ink-950 mb-3">Diagnostic Santé</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-ink-600 mb-6">
            Questionnaire de saisie en rendez-vous : le concierge recueille les réponses du dirigeant, une
            question à la fois. 25 questions réparties sur 5 axes.
          </p>
          {!orgId ? (
            <>
              {orgsLoading ? (
                <p className="text-sm text-ink-500">Chargement de votre portefeuille…</p>
              ) : (
                <>
                  {localError ? <Alert tone="danger" className="mb-4" title="Portefeuille">{localError}</Alert> : null}
                  <p className="mb-4 text-sm font-semibold text-ink-800">Choisissez l’entreprise à diagnostiquer</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {orgs.map((org) => (
                      <Button key={org.id} variant="outline" onClick={() => selectOrg(org.id)} className="w-full text-left">
                        {org.name} <span className="ml-auto text-xs text-ink-400">{org.sector}</span>
                      </Button>
                    ))}
                  </div>
                </>
              )}
            </>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-center gap-3 mb-6">
                <Badge tone="neutral">{DEMO_ORGS[orgId]?.name || orgId}</Badge>
                <Badge tone="brand">Secteur Santé</Badge>
                <Badge tone="neutral">25 questions · 5 axes</Badge>
              </div>
              <Button size="lg" onClick={() => setPhase('saisie')}>
                Commencer la saisie <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </>
          )}
        </Card>
      </div>
    )
  }

  /* ------------------------------------------------------------------ */
  /* Rendu — terminé                                                    */
  /* ------------------------------------------------------------------ */
  if (phase === 'termine') {
    return (
      <div className="mx-auto max-w-3xl px-6 py-10">
        <Card className="p-8 sm:p-10 text-center border-emerald-200">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 mb-4">
            <CheckCircle2 className="h-7 w-7" />
          </div>
          <h2 className="font-display text-2xl font-bold text-ink-950 mb-3">
            {published ? 'Restitution publiée' : 'Diagnostic transmis'}
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-ink-600 mb-6">
            {published
              ? 'La restitution est désormais visible dans l’espace client.'
              : 'Vos réponses ont été transmises. Préparez la synthèse (points forts, points faibles, priorités, plan d’action), puis publiez explicitement.'}
          </p>
          {diagnosticId ? (
            <div className="flex flex-wrap justify-center gap-3">
              <Link to="/concierge/diagnostics/$id" params={{ id: diagnosticId }}>
                <Button>Voir l’analyse <ArrowRight className="ml-2 h-4 w-4" /></Button>
              </Link>
              <Button
                variant="outline"
                onClick={() => {
                  const url = new URL(window.location.href)
                  url.searchParams.delete('orgId')
                  window.location.assign(url.toString())
                }}
              >
                Choisir une autre entreprise
              </Button>
            </div>
          ) : null}
        </Card>
      </div>
    )
  }

  const orgLabel = DEMO_ORGS[orgId ?? '']?.name || orgId || 'Entreprise'

  /* ------------------------------------------------------------------ */
  /* Rendu — saisie (une question à la fois)                            */
  /* ------------------------------------------------------------------ */
  if (phase === 'saisie') {
    return (
      <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-4rem)]">
        {/* Mobile header */}
        <div className="lg:hidden sticky top-0 z-20 flex flex-col gap-2 bg-white/90 border-b border-ink-100 px-4 py-3 backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[0.62rem] font-bold uppercase tracking-[0.14em] text-ink-400">{orgLabel}</p>
              <p className="text-xs font-semibold text-ink-900">Secteur Santé · Diagnostic en cours</p>
            </div>
            <Badge tone="neutral">{globalIndex + 1} / {TOTAL_QUESTIONS}</Badge>
          </div>
          <div className="h-1.5 bg-ink-100 rounded-full overflow-hidden">
            <div className="h-full bg-brand-600" style={{ width: `${progress}%` }}></div>
          </div>
          <div className="flex gap-2 overflow-x-auto">
            {SANTE_AXES.map((axe) => {
              const active = axe.id === currentAxe.id
              const answered = axeQuestions.filter((q) => (answers[q.id]?.score ?? 0) > 0).length
              return (
                <button
                  key={axe.id}
                  onClick={() => goToAxe(axe.id)}
                  className={`whitespace-nowrap px-3 py-1.5 rounded-lg text-xs font-medium border transition ${active ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-ink-700 border-ink-200'}`}
                >
                  Axe {axe.id} <span className="opacity-80">{answered}/5</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Desktop sidebar */}
        <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:gap-6 shrink-0">
          <div className="space-y-4">
            <Card className="p-4">
              <p className="text-[0.62rem] font-bold uppercase tracking-[0.14em] text-ink-400">Entreprise</p>
              <p className="mt-1 font-semibold text-ink-900">{orgLabel}</p>
              <p className="mt-1 text-xs text-ink-500">Secteur Santé</p>
            </Card>
            <Card className="p-4">
              <p className="text-[0.62rem] font-bold uppercase tracking-[0.14em] text-brand-700">Progression</p>
              <div className="mt-3">
                <p className="text-xs font-semibold text-ink-800">Question {globalIndex + 1} / {TOTAL_QUESTIONS}</p>
                <div className="mt-2 h-2 bg-ink-100 rounded-full overflow-hidden">
                  <div className="h-full bg-brand-600" style={{ width: `${progress}%` }}></div>
                </div>
                <p className="mt-1 text-[0.62rem] text-ink-500">{answeredCount} / {TOTAL_QUESTIONS} notées · {progress} %</p>
              </div>
            </Card>
            <Card className="p-4">
              <p className="text-[0.62rem] font-bold uppercase tracking-[0.14em] text-ink-400">Axes</p>
              <div className="mt-3 space-y-2">
                {SANTE_AXES.map((axe) => {
                  const active = axe.id === currentAxe.id
                  const answered = axeQuestions.filter((q) => (answers[q.id]?.score ?? 0) > 0).length
                  return (
                    <button
                      key={axe.id}
                      onClick={() => goToAxe(axe.id)}
                      className={cn(
                        'flex items-center justify-between px-3 py-2 rounded-lg text-sm transition border',
                        active
                          ? 'bg-brand-600 text-white border-brand-600'
                          : 'bg-white text-ink-700 border-ink-200 hover:border-brand-600 hover:bg-ink-50',
                      )}
                    >
                      <span>Axe {axe.id} · {santeAxeTitle(axe.id)}</span>
                      <span className="text-[0.62rem]">{answered}/5</span>
                    </button>
                  )
                })}
              </div>
            </Card>
          </div>
        </aside>

        {/* Zone principale */}
        <main className="flex-1 min-w-0 overflow-y-auto py-6 lg:py-8">
          {localError ? <Alert tone="danger" className="mb-4">{localError}</Alert> : null}
          {localInfo ? <Alert tone="success" className="mb-4">{localInfo}</Alert> : null}

          {/* Scores en haut de la zone principale */}
          <div className="mb-6 grid gap-3 sm:grid-cols-3">
            <Card className="p-4 sm:p-5">
              <p className="text-[0.62rem] font-bold uppercase tracking-[0.14em] text-ink-400">Score global</p>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="font-display text-3xl font-bold text-ink-950">{answeredCount ? Math.round((sumScores() / (answeredCount * 5)) * 100) : 0}</span>
                <span className="text-sm font-semibold text-ink-500">/ 100</span>
              </div>
              <p className="mt-1 text-[0.62rem] text-ink-500">{answeredCount} / {TOTAL_QUESTIONS} réponses notées</p>
            </Card>
            <Card className="p-4 sm:p-5">
              <p className="text-[0.62rem] font-bold uppercase tracking-[0.14em] text-brand-700">Score axe courant</p>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="font-display text-3xl font-bold text-ink-950">{axeAnswered ? Math.round((axeSumScores() / (axeAnswered * 5)) * 100) : 0}</span>
                <span className="text-sm font-semibold text-ink-500">/ 100</span>
              </div>
              <p className="mt-1 text-[0.62rem] text-ink-500">{axeAnswered} / {axeQuestions.length} notées dans cet axe</p>
            </Card>
            <Card className="p-4 sm:p-5 border-brand-100 bg-brand-50/40">
              <p className="text-[0.62rem] font-bold uppercase tracking-[0.14em] text-brand-700">Progression</p>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="font-display text-3xl font-bold text-brand-700">{progress}</span>
                <span className="text-sm font-semibold text-brand-600">%</span>
              </div>
              <p className="mt-1 text-[0.62rem] text-ink-500">Question {globalIndex + 1} / {TOTAL_QUESTIONS}</p>
            </Card>
          </div>

          <div className="mb-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[0.62rem] font-bold uppercase tracking-[0.14em] text-ink-400">
                  Axe {currentAxe.id} / {SANTE_AXES.length}
                </p>
                <h2 className="mt-1 font-display text-xl font-bold text-ink-950">
                  {santeAxeTitle(currentAxe.id)}
                </h2>
                <p className="mt-1 text-sm text-ink-500">{currentAxe.subtitle}</p>
              </div>
              <Badge tone="neutral">{globalIndex + 1} / {TOTAL_QUESTIONS}</Badge>
            </div>
            <div className="mt-4 h-1.5 bg-ink-100 rounded-full overflow-hidden">
              <div className="h-full bg-brand-600" style={{ width: `${((questionIndex + 1) / axeQuestions.length) * 100}%` }}></div>
            </div>
            <p className="mt-2 text-xs text-ink-500">{axeAnswered} / {axeQuestions.length} notées dans cet axe</p>
          </div>

          {currentQuestion && (
            <>
              <Card className="mb-8">
              <CardBody className="p-6 sm:p-8">
                <div className="flex items-start justify-between gap-4 mb-6">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-[0.14em] text-ink-400">
                      Question {globalIndex + 1} / {TOTAL_QUESTIONS}
                    </span>
                    <h3 className="mt-2 font-display text-lg font-bold text-ink-950">{currentQuestion.title}</h3>
                    <p className="mt-3 text-sm leading-relaxed text-ink-700">{currentQuestion.question}</p>
                    {currentQuestion.besoinAcces && (
                      <span className="mt-3 inline-flex items-center gap-1 rounded bg-brand-50 px-2 py-1 text-xs font-semibold text-brand-800">
                        <Target className="h-3 w-3" /> Besoin de prestataire
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-6">
                  {[1, 2, 3, 4, 5].map((n) => {
                    const active = answers[currentQuestion.id]?.score === n
                    return (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setScore(currentQuestion.id, n)}
                        className={cn(
                          'h-14 rounded-xl border text-base font-bold transition flex flex-col items-center justify-center',
                          active
                            ? 'border-brand-600 bg-brand-600 text-white'
                            : 'border-ink-200 text-ink-500 hover:border-ink-400 hover:text-ink-900',
                        )}
                      >
                        {n}
                        <span className="text-[0.6rem] opacity-70 mt-0.5">{currentQuestion.niveaux[n - 1].slice(0, 18)}…</span>
                      </button>
                    )
                  })}
                  <button
                    type="button"
                    onClick={() => setScore(currentQuestion.id, 0)}
                    className={cn(
                      'h-14 rounded-xl border text-base font-bold transition flex flex-col items-center justify-center',
                      answers[currentQuestion.id]?.score === 0
                        ? 'border-ink-950 bg-ink-950 text-white'
                        : 'border-ink-200 text-ink-500 hover:border-ink-400 hover:text-ink-900',
                    )}
                  >
                    —
                    <span className="text-[0.6rem] opacity-70 mt-0.5">Non renseigné</span>
                  </button>
                </div>

                <Field label="Réponse du client · observation concierge">
                  <Textarea
                    rows={4}
                    placeholder="Ce que le dirigeant a répondu oralement…"
                    value={answers[currentQuestion.id]?.comment ?? ''}
                    onChange={(event) => setComment(currentQuestion.id, event.target.value)}
                  />
                </Field>

                <div className="mt-3 flex flex-wrap items-start gap-3">
                  {!speechSupported ? (
                    <span className="text-xs text-ink-500 italic">
                      Dictée vocale non disponible sur ce navigateur.
                    </span>
                  ) : (
                    <>
                      {isListening ? (
                        <>
                          <span className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-ink-100 text-ink-700 text-xs font-semibold">
                            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-red-600 animate-pulse" />
                            Écoute en cours…
                          </span>
                          <Button size="sm" variant="outline" onClick={stopListening} disabled={busy}>
                            ⏹ Arrêter
                          </Button>
                        </>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={startListening}
                          disabled={busy || Boolean(speechError)}
                        >
                          🎙️ Répondre par voix
                        </Button>
                      )}
                      {speechError && (
                        <span className="text-xs text-red-600">{speechError}</span>
                      )}
                    </>
                  )}
                </div>

                {speechSupported && (
                  <p className="mt-1 text-[0.6rem] text-ink-400">
                    Le microphone est utilisé uniquement pendant votre réponse.
                  </p>
                )}

                {interimTranscript && (
                  <p className="mt-1 text-xs italic text-ink-500">Entendu : {interimTranscript}</p>
                )}

                <Field label="Note privée staff (concierge/admin seulement)">
                  <Textarea
                    rows={3}
                    placeholder="Constats privés, hypothèses, éléments à vérifier…"
                    value={staffNotes[currentQuestion.id] ?? ''}
                    onChange={(event) => setStaffNote(currentQuestion.id, event.target.value)}
                  />
                </Field>

                <details className="mt-6 rounded-xl border border-ink-100">
                  <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-ink-800">
                    Relance suggérée
                  </summary>
                  <div className="border-t border-ink-100 bg-ink-50/40 p-4">
                    <p className="text-sm italic text-ink-700">« {currentQuestion.relance} »</p>
                  </div>
                </details>

                <div className="border-t border-ink-100 pt-6 flex flex-wrap justify-between items-end gap-3">
                  <button
                    onClick={goPrevious}
                    disabled={globalIndex === 0}
                    className="px-4 py-2 rounded-lg border border-ink-300 text-sm font-medium text-ink-700 disabled:opacity-50 disabled:pointer-events-none"
                  >
                    <ArrowLeft size={14} className="mr-2" /> Précédent
                  </button>
                  <span className="text-xs text-ink-400">Enregistré automatiquement</span>
                  <button
                    onClick={goNext}
                    disabled={isLastQuestion}
                    className="px-4 py-2 rounded-lg bg-brand-600 text-white text-sm font-medium disabled:opacity-50 disabled:pointer-events-none"
                  >
                    {isLastQuestionInAxe && !isLastAxe ? 'Terminer l’axe' : 'Suivant'} <ArrowRight className="ml-2 h-4 w-4" />
                  </button>
                </div>
              </CardBody>
            </Card>

            {isLastQuestion && (
              <Card className="mt-6 p-5 sm:p-7">
                <CardHeader
                  title="Terminer le diagnostic"
                  description="Transmettez les 25 réponses au statut « soumis ». La synthèse et la publication interviendront ensuite."
                />
                <CardBody>
                  <p className="text-sm text-ink-600 mb-4">
                    {answeredCount} / {TOTAL_QUESTIONS} réponses notées. Les questions sans note seront exclues du calcul.
                  </p>
                  <Button
                    size="lg"
                    disabled={busy || answeredCount === 0}
                    onClick={submitDiagnostic}
                  >
                    {busy ? <Send className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                    Terminer le diagnostic et transmettre
                  </Button>
                </CardBody>
              </Card>
            )}
            </>
          )}
        </main>
      </div>
    )
  }

  /* ------------------------------------------------------------------ */
  /* Rendu — synthèse (préparation de la restitution, non publiée)      */
  /* ------------------------------------------------------------------ */
  return (
    <div className="mx-auto max-w-5xl px-6 py-6 lg:py-10">
      {localError ? <Alert tone="danger" className="mb-4">{localError}</Alert> : null}
      {localInfo ? <Alert tone="success" className="mb-4">{localInfo}</Alert> : null}

      <Card className="mb-6 p-5 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[0.62rem] font-bold uppercase tracking-[0.14em] text-brand-700">
              Synthèse de restitution
            </p>
            <h2 className="mt-2 font-display text-xl font-bold text-ink-950">Préparer la restitution — {orgLabel}</h2>
            <p className="mt-1 text-sm text-ink-500">
              Ce brouillon n’est pas visible du client. La publication est explicite et réservée à l’équipe.
            </p>
          </div>
          <Badge tone={published ? 'success' : 'neutral'}>{published ? 'Publié' : 'Brouillon'}</Badge>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <TextListField
            label="Forces"
            hint="Les points forts à conserver."
            value={synthese.forces}
            onChange={(value) => setSynthese((c) => ({ ...c, forces: value }))}
            prefill={syntheseResult.forces.map((x) => `${x.q.id} · ${x.q.title}`)}
          />
          <TextListField
            label="Faiblesses"
            hint="Les points à améliorer."
            value={synthese.faiblesses}
            onChange={(value) => setSynthese((c) => ({ ...c, faiblesses: value }))}
            prefill={syntheseResult.faiblesses.map((x) => `${x.q.id} · ${x.q.title}`)}
          />
          <TextListField
            label="Opportunités"
            hint="Ce qui peut être saisi."
            value={synthese.opportunites}
            onChange={(value) => setSynthese((c) => ({ ...c, opportunites: value }))}
            prefill={syntheseResult.opportunites.map((x) => `${x.q.id} · ${x.q.title}`)}
          />
          <TextListField
            label="Menaces"
            hint="Les risques à surveiller."
            value={synthese.menaces}
            onChange={(value) => setSynthese((c) => ({ ...c, menaces: value }))}
            prefill={syntheseResult.menaces.map((x) => `${x.q.id} · ${x.q.title}`)}
          />
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <TextListField
            label="3 priorités principales"
            hint="Une par ligne, par ordre de traitement."
            value={synthese.priorites}
            onChange={(value) => setSynthese((c) => ({ ...c, priorites: value }))}
            prefill={syntheseResult.priorites.map((x) => `${x.q.id} · ${x.q.title}`)}
          />
          <TextListField
            label="Recommandations"
            hint="Actions recommandées, une par ligne."
            value={synthese.recommandations}
            onChange={(value) => setSynthese((c) => ({ ...c, recommandations: value }))}
          />
        </div>

        <Field label="Plan d’action" hint="Une étape par ligne, dans l’ordre." className="mt-6">
          <Textarea
            rows={4}
            value={synthese.planAction.join('\n')}
            onChange={(event) => setSynthese((c) => ({ ...c, planAction: lines(event.target.value) }))}
          />
        </Field>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <Field label="Commentaire pour le client (visible après publication)">
            <Textarea
              rows={4}
              placeholder="Ce que vous voulez dire clairement au dirigeant…"
              value={synthese.commentaireClient}
              onChange={(event) => setSynthese((c) => ({ ...c, commentaireClient: event.target.value }))}
            />
          </Field>
          <Field label="Note interne staff (jamais visible du client)">
            <Textarea
              rows={4}
              placeholder="Constats privés, hypothèses, arbitrages internes…"
              value={synthese.noteInterne}
              onChange={(event) => setSynthese((c) => ({ ...c, noteInterne: event.target.value }))}
            />
          </Field>
        </div>

        <div className="mt-6 border-t border-ink-100 pt-5 flex flex-wrap justify-between items-center gap-3">
          <div className="text-sm text-ink-500">
            {validation.map((item) => (
              <div key={item.label} className="flex items-center gap-1.5 mb-1">
                {item.ok ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> : <Lock className="h-3.5 w-3.5 text-amber-500" />}
                <span className={cn(item.ok ? 'text-ink-700' : 'text-ink-500')}>{item.label}</span>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" disabled={busy || !diagnosticId} onClick={saveDraft}>
              {busy ? <Send className="mr-2 h-4 w-4 animate-spin" /> : null}
              Enregistrer le brouillon
            </Button>
            <Button disabled={busy || !diagnosticId || !readyToPublish} onClick={() => confirmPublish.openFn()}>
              {busy ? <Send className="mr-2 h-4 w-4 animate-spin" /> : null}
              Publier la restitution
            </Button>
          </div>
        </div>

        <ul className="mt-3 text-xs text-ink-400 space-y-1">
          <li>La note interne et les réponses par question ne sont jamais transmises au client.</li>
          <li>La publication est explicite : rien n’est envoyé automatiquement après la transmission du questionnaire.</li>
          <li>Le client accède à la restitution uniquement après cette validation.</li>
        </ul>
      </Card>

      <Modal
        open={confirmPublish.open}
        onClose={confirmPublish.close}
        title="Confirmer la publication de cette restitution au client ?"
        description="La restitution deviendra visible dans l’espace du client. La note interne et les réponses par question restent privées."
      >
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="ghost" onClick={confirmPublish.close}>
            Annuler
          </Button>
          <Button onClick={() => publish()} disabled={busy || !readyToPublish}>
            {busy ? <Send className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
            Publier
          </Button>
        </div>
      </Modal>
    </div>
  )
}

function lines(value: string): string[] {
  return value.split('\n').map((item) => item.trim()).filter(Boolean)
}

function TextListField({
  label,
  hint,
  value,
  onChange,
  prefill,
}: {
  label: string
  hint?: string
  value: string[]
  onChange: (value: string[]) => void
  prefill?: string[]
}) {
  const [showPrefill, setShowPrefill] = useState(false)
  const empty = value.length === 0
  return (
    <div className="rounded-xl border border-ink-100 p-4 sm:p-5">
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="text-[0.62rem] font-bold uppercase tracking-[0.14em] text-ink-400">{label}</p>
        {empty && prefill && prefill.length > 0 && showPrefill ? (
          <Button size="sm" variant="outline" onClick={() => setShowPrefill(false)}>
            Masquer la suggestion
          </Button>
        ) : empty && prefill && prefill.length > 0 ? (
          <Button size="sm" variant="outline" onClick={() => {
            onChange(prefill)
            setShowPrefill(false)
          }}>
            Appliquer la suggestion
          </Button>
        ) : null}
      </div>
      <p className="text-[0.62rem] text-ink-500 mb-2">{hint}</p>
      <div className="space-y-2">
        {value.map((item, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="flex shrink-0 items-center justify-center w-5 h-5 rounded-full border-ink-200 text-[0.62rem] font-bold text-ink-600">
              {i + 1}
            </span>
            <Input
              value={item}
              onChange={(event) => {
                const next = [...value]
                next[i] = event.target.value
                onChange(next)
              }}
              className="flex-1 text-sm"
            />
          </div>
        ))}
        {[0, 1, 2].map((i) => (
          <div key={`add-${i}`} className="flex items-center gap-2">
            <span className="flex shrink-0 items-center justify-center w-5 h-5 rounded-full border-ink-200 text-[0.62rem] font-bold text-ink-600">
              {value.length + i + 1}
            </span>
            <Input
              placeholder="+"
              onChange={(event) => {
                const next = [...value, event.target.value]
                onChange(next)
              }}
              className="flex-1 text-sm"
            />
          </div>
        ))}
      </div>
      {empty && prefill && prefill.length > 0 && !showPrefill ? (
        <p className="mt-2 text-[0.62rem] italic text-ink-400">Suggestion automatique depuis les notes : cliquez pour appliquer.</p>
      ) : null}
    </div>
  )
}
