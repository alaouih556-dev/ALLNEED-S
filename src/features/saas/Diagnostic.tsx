import { useEffect, useRef, useState } from 'react'
import { useAuth } from '@/features/auth/AuthContext'
import { DiagnosticPending } from '@/features/parcours/DiagnosticPending'
import { isDiagnosticPending } from '@/lib/sectors'
import { titles } from './model'
import './workspace.css'
import { Diagnostic360 } from '@/features/health360/Diagnostic360'
import { SectorChoice } from '@/features/parcours/SectorChoice'
import { DiagnosticSubmit } from '@/features/parcours/DiagnosticSubmit'
import { useOrgContext } from '@/features/parcours/useOrgContext'
import { useParcours, readParcours, writeParcours } from '@/lib/parcours'
import { readDiagnosticDraft } from '@/lib/diagnostic-draft'
import { JourneyProgress } from '@/components/JourneyProgress'
import type { SectorKey } from '@/features/health360/packs'

/**
 * Parcours diagnostic : un seul secteur, un seul questionnaire.
 * Le secteur vient du compte ; à défaut, le client le choisit une fois.
 */
export function Diagnostic() {
  const { orgId, orgName, sector: accountSector } = useOrgContext()
  const auth = useAuth()
  const { parcours, patch } = useParcours(orgId)
  const [pending, setPending] = useState<SectorKey | null>(null)

  const sector: SectorKey | null = (accountSector ?? parcours.sector ?? null) as SectorKey | null

  useEffect(() => {
    if (accountSector && accountSector !== parcours.sector) {
      patch({ sector: accountSector })
    }
  }, [accountSector, parcours.sector, patch])

  useEffect(() => {
    if (!sector || !orgId) return
    const current = readParcours(orgId)
    if (current.sector !== sector) writeParcours(orgId, { ...current, sector })
  }, [sector, orgId])

  const [questionnaireCompleted, setQuestionnaireCompleted] = useState(false)
  const synthesisRef = useRef<HTMLDivElement | null>(null)
  const justCompletedRef = useRef(false)
  const showSynthesis = questionnaireCompleted || Boolean(parcours.submittedAt)

  useEffect(() => {
    if (!sector) return
    const draft = readDiagnosticDraft(sector)
    setQuestionnaireCompleted(draft.total > 0 && draft.completed >= draft.total)
  }, [sector])

  useEffect(() => {
    // Ne remonte au début de la synthèse que lorsqu'on vient de cliquer « Terminer ».
    if (!showSynthesis || !justCompletedRef.current) return
    justCompletedRef.current = false
    synthesisRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [showSynthesis])

  if (isDiagnosticPending(auth.user?.organization?.sector)) return <DiagnosticPending />

  if (!sector) {
    return (
      <div className="space-y-6">
        <JourneyProgress current={0} />
        <SectorChoice
          onPick={(value) => {
            setPending(value)
            patch({ sector: value })
          }}
        />
        {pending ? (
          <p className="text-center text-sm text-ink-500">
            Secteur enregistré : <strong className="text-ink-800">{titles[pending]}</strong>
          </p>
        ) : null}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {showSynthesis ? (
        <div ref={synthesisRef}>
          <DiagnosticSubmit
            orgId={orgId}
            sector={sector}
            companyName={orgName}
            onSubmitted={(recordId) => patch({ diagnosticId: recordId, submittedAt: new Date().toISOString() })}
          />
        </div>
      ) : (
        <Diagnostic360
            sector={sector}
            readOnly={false}
            organizationName={auth.user?.organization?.name || orgName || ''}
            contactName={[auth.user?.name, auth.user?.jobTitle].filter(Boolean).join(', ')}
            onCompleted={() => {
              setQuestionnaireCompleted(true)
              justCompletedRef.current = true
            }}
          />
      )}
    </div>
  )
}
