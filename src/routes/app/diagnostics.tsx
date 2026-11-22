import { Link, createFileRoute } from '@tanstack/react-router'
import { FileText, Loader2, Lock } from 'lucide-react'
import { useEffect, useState } from 'react'
import { PageHeader } from '@/components/layouts'
import { Alert, Badge, Button, Card, EmptyState } from '@/components/ui'
import { canClientViewRestitution, diagnosticStatusLabel } from '@/lib/diagnostic-status'
import {
  getRestitution,
  useDiagnosticRecord,
  type DiagnosticRestitution,
} from '@/features/parcours/useDiagnosticRecord'
import { RestitutionStatusTimeline } from '@/features/parcours/DiagnosticTimeline'
import { RestitutionPanel } from '@/features/parcours/RestitutionPanel'
import { useOrgContext } from '@/features/parcours/useOrgContext'

export const Route = createFileRoute('/app/diagnostics')({
  component: DiagnosticsPage,
  head: () => ({ meta: [{ title: 'Ma restitution — ALLNEEDS' }] }),
})

function DiagnosticsPage() {
  const { orgId } = useOrgContext()
  const { primary, patchRecord, loading, error: recordError } = useDiagnosticRecord(orgId || null)
  const [restitution, setRestitution] = useState<DiagnosticRestitution | null>(null)
  const [loadingRestitution, setLoadingRestitution] = useState(false)
  const [busy, setBusy] = useState(false)
  const [localError, setLocalError] = useState('')

  const published = Boolean(primary && canClientViewRestitution(primary))

  useEffect(() => {
    if (!published || !primary) {
      setRestitution(null)
      return
    }
    let cancelled = false
    setLoadingRestitution(true)
    setLocalError('')
    getRestitution(primary.id)
      .then((payload) => {
        if (!cancelled) setRestitution(payload)
      })
      .catch((cause) => {
        if (!cancelled) setLocalError(cause instanceof Error ? cause.message : 'Impossible de charger votre restitution.')
      })
      .finally(() => {
        if (!cancelled) setLoadingRestitution(false)
      })
    return () => {
      cancelled = true
    }
  }, [primary, published])

  async function acknowledge() {
    if (!primary) return
    setBusy(true)
    setLocalError('')
    try {
      const saved = await patchRecord(primary.id, { restoreAck: true })
      setRestitution((current) => (current ? { ...current, restoredAt: saved.restoredAt ?? null } : current))
    } catch (cause) {
      setLocalError(cause instanceof Error ? cause.message : 'Validation impossible.')
    } finally {
      setBusy(false)
    }
  }

  const statusText = primary
    ? primary.status === 'restitue'
      ? "Votre restitution est en cours de préparation finale."
      : 'Votre Account Manager lit vos réponses et prépare votre restitution.'
    : 'Rien à afficher pour l’instant.'

  return (
    <>
      <PageHeader
        eyebrow="Restitution"
        title="Ma restitution"
        description="Votre restitution n’est affichée qu’une fois validée et publiée par votre Account Manager, jamais automatiquement après l’envoi du questionnaire."
      />

      {(recordError || localError) && !restitution ? (
        <Alert tone="danger" className="mb-5" title="Chargement impossible">
          {recordError || localError}
        </Alert>
      ) : null}

      {loading ? (
        <Card className="p-7">
          <p className="flex items-center gap-2 text-sm text-ink-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Vérification de votre parcours…
          </p>
        </Card>
      ) : !primary ? (
        <Card className="p-5 sm:p-7">
          <EmptyState
            icon={<FileText className="h-5 w-5" />}
            title="Votre restitution apparaîtra ici"
            description="Répondez d’abord à votre questionnaire, puis transmettez-le. Votre Account Manager vous prépare ensuite une restitution, validée avec vous avant publication."
            action={
              <Link to="/app/diagnostic-auto">
                <Button>Ouvrir mon diagnostic</Button>
              </Link>
            }
          />
        </Card>
      ) : published && restitution ? (
        <RestitutionPanel
          restitution={restitution}
          restoredAt={restitution.restoredAt ?? primary.restoredAt}
          canAcknowledge={Boolean(primary && !primary.restoredAt && restitution && !restitution.restoredAt)}
          onRestore={() => void acknowledge()}
          busy={busy}
          error={localError || undefined}
        />
      ) : published && loadingRestitution ? (
        <Card className="p-7">
          <p className="flex items-center gap-2 text-sm text-ink-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Chargement de votre restitution…
          </p>
        </Card>
      ) : (
        <Card className="border-amber-200 p-5 sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-2xl">
              <div className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-amber-600" />
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-700">Restitution en cours</p>
              </div>
              <h1 className="mt-3 font-display text-2xl font-bold text-ink-950">
                {primary.status === 'restitue' ? 'Restitution en préparation finale' : 'En cours d’analyse'}
              </h1>
              <p className="mt-2 text-sm leading-relaxed text-ink-600">
                {statusText}
                <br />
                Votre restitution sera disponible ici une fois validée par votre Account Manager — rien n’est affiché
                automatiquement après l’envoi du questionnaire.
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <Badge tone={primary.status === 'restitue' ? 'success' : 'warning'}>
                  {diagnosticStatusLabel(primary.status ?? 'analyse')}
                </Badge>
                {primary.createdAt ? (
                  <span className="text-xs text-ink-500">
                    Transmis le {new Date(primary.createdAt).toLocaleDateString('fr-FR')}
                  </span>
                ) : null}
              </div>
            </div>
            <Link to="/app/documents">
              <Button variant="outline">Préparer mes documents</Button>
            </Link>
          </div>

          <div className="mt-6 rounded-2xl border border-ink-100 bg-white p-5">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-ink-500">Où en est mon diagnostic ?</p>
            <RestitutionStatusTimeline
              answered
              submittedAt={primary?.createdAt}
              publishedAt={primary?.publishedAt}
            />
          </div>
        </Card>
      )}
    </>
  )
}