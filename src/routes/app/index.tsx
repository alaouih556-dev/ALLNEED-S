import { Link, createFileRoute } from '@tanstack/react-router'
import { ArrowRight, Building2, CheckCircle2, ClipboardCheck, Lock, Receipt, Timer, UserRound, Edit2, Save, X } from 'lucide-react'
import { PageHeader } from '@/components/layouts'
import { Button, Card, Input, Textarea } from '@/components/ui'
import { useDemo } from '@/store/store'
import { useAuth } from '@/features/auth/AuthContext'
import { useOrgContext } from '@/features/parcours/useOrgContext'
import { useDiagnosticStatus } from '@/features/diagnostic/useDiagnosticStatus'
import { diagnosticStatusLabel, isDiagnosticSubmitted } from '@/lib/diagnostic-status'
import { readDiagnosticDraft } from '@/lib/diagnostic-draft'
import { toSector } from '@/lib/parcours'
import type { SectorKey } from '@/features/health360/packs'
import { DocumentsPanel } from '@/features/documents/DocumentsPanel'
import { longDate } from '@/lib/format'
import type { ReactNode } from 'react'
import { useCallback, useState } from 'react'

export const Route = createFileRoute('/app/')({
  component: ClientProfile,
  head: () => ({ meta: [{ title: 'Mon profil — ALLNEEDS' }] }),
})

function ClientProfile() {
  const auth = useAuth()
  const { state, orgId: fallbackOrgId } = useDemo()
  const { orgId, orgName, sector } = useOrgContext()
  const effectiveOrgId = orgId || fallbackOrgId
  const org = auth.user?.organization ?? state.orgs.find((item) => item.id === effectiveOrgId) ?? null
  const { info, loading } = useDiagnosticStatus(effectiveOrgId)
  const submitted = isDiagnosticSubmitted(info)
  const published = Boolean(info.restitutionPublished && info.publishedAt)

  const user = auth.user
  const [editing, setEditing] = useState(false)
  const [profile, setProfile] = useState({
    name: user?.name ?? '',
    firstName: user?.firstName ?? '',
    lastName: user?.lastName ?? '',
    phone: user?.phone ?? '',
    jobTitle: user?.jobTitle ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  const resetProfile = useCallback(() => {
    setProfile({
      name: user?.name ?? '',
      firstName: user?.firstName ?? '',
      lastName: user?.lastName ?? '',
      phone: user?.phone ?? '',
      jobTitle: user?.jobTitle ?? '',
    })
    setSaveError('')
  }, [user])

  async function saveProfile() {
    setSaveError('')
    setSaving(true)
    try {
      const response = await fetch('/api/me/profile', {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: profile.name.trim(),
          firstName: profile.firstName.trim(),
          lastName: profile.lastName.trim(),
          phone: profile.phone.trim(),
          jobTitle: profile.jobTitle.trim(),
        }),
      })
      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(body.error || 'Enregistrement impossible.')
      }
      const result = await response.json()
      // Rafraîchir la session puis l'affichage immédiat.
      await auth.refresh()
      setEditing(false)
    } catch (cause) {
      setSaveError(cause instanceof Error ? cause.message : 'Enregistrement impossible.')
    } finally {
      setSaving(false)
    }
  }


  return (
    <div className="operational-cockpit">
      <PageHeader
        eyebrow="Profil client"
        title="Mon espace"
        description="Vos informations, votre diagnostic et, après son envoi, les éléments de votre accompagnement."
      />

      <section aria-labelledby="client-information-title">
        <h2 id="client-information-title" className="font-display text-xl font-bold text-ink-950">Mes informations</h2>
        <div className="mt-4 grid gap-5 lg:grid-cols-2">
          {editing ? (
            <Card className="p-5 sm:p-6">
              <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-brand-700">
                <UserRound size={18} /> Informations personnelles
              </p>
              <dl className="mt-4 grid gap-3">
                <EditableField label="Nom" value={profile.name} onChange={(v) => setProfile({ ...profile, name: v })} />
                <EditableField label="Prénom" value={profile.firstName} onChange={(v) => setProfile({ ...profile, firstName: v })} />
                <EditableField label="Téléphone" value={profile.phone} onChange={(v) => setProfile({ ...profile, phone: v })} />
                <EditableField label="Fonction / poste" value={profile.jobTitle} onChange={(v) => setProfile({ ...profile, jobTitle: v })} />
                <div className="col-span-2 border-b border-ink-50 pb-2 last:border-0 last:pb-0">
                  <dt className="text-sm text-ink-500">E-mail</dt>
                  <dd className="text-right text-sm font-semibold text-ink-900">{user?.email || 'Non renseigné'}</dd>
                  <p className="mt-1 text-[0.62rem] text-ink-400">L’e-mail ne peut pas être modifié depuis cette page.</p>
                </div>
              </dl>
              {saveError ? <p className="mt-3 text-xs text-red-700">{saveError}</p> : null}
              <div className="mt-5 flex gap-2">
                <Button onClick={saveProfile} disabled={saving} size="sm">
                  {saving ? <Save className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-2 h-3.5 w-3.5" />} Enregistrer
                </Button>
                <Button variant="outline" onClick={() => { resetProfile(); setEditing(false) }} size="sm">
                  <X className="mr-2 h-3.5 w-3.5" /> Annuler
                </Button>
              </div>
            </Card>
          ) : (
            <InformationCard
              icon={<UserRound size={18} />}
              title="Informations personnelles"
              rows={[
                ['Nom', user?.name],
                ['Prénom', user?.firstName],
                ['E-mail', user?.email],
                ['Téléphone', user?.phone || org?.contactPhone],
                ['Fonction / poste', user?.jobTitle || org?.contactRole],
              ]}
            />
          )}
          <InformationCard
            icon={<Building2 size={18} />}
            title="Informations entreprise"
            rows={[
              ['Entreprise', org?.name ?? orgName],
              ['Secteur', org?.sector ?? sector],
              ['Type de structure', org?.kind],
              ['Ville', org?.city],
              ['Taille', org?.size],
            ]}
          />
        </div>
        {!editing ? (
          <div className="mt-4 flex items-center gap-2">
            <Button size="sm" onClick={() => { resetProfile(); setEditing(true) }}>
              <Edit2 className="mr-2 h-4 w-4" /> Modifier mes informations
            </Button>
          </div>
        ) : null}
      </section>

      <section className="mt-8" aria-labelledby="client-diagnostic-title">
        <h2 id="client-diagnostic-title" className="font-display text-xl font-bold text-ink-950">Mon diagnostic</h2>
        <div className="mt-4">
          <DiagnosticCard info={info} loading={loading} submitted={submitted} sector={org?.sector ?? sector} />
        </div>
      </section>

      {submitted ? (
        <>
          <section className="mt-8" aria-labelledby="client-report-title">
            <h2 id="client-report-title" className="font-display text-xl font-bold text-ink-950">Rapport de diagnostic</h2>
            <Link to="/app/diagnostics" className="mt-4 block rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
              <Card className={`cursor-pointer p-5 transition hover:-translate-y-0.5 hover:shadow-md sm:p-6 ${published ? 'border-emerald-200' : 'border-amber-200'}`}>
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-brand-700">
                      {published ? <CheckCircle2 size={16} /> : <Timer size={16} />}
                      {published ? 'Rapport disponible' : 'En cours d’analyse'}
                    </p>
                    <p className="mt-3 text-sm text-ink-600">
                      {published ? `Publié le ${longDate(info.publishedAt!)}.` : 'Rapport en cours d’analyse par votre concierge.'}
                    </p>
                  </div>
                  <Button variant="outline">{published ? 'Voir mon rapport de diagnostic' : 'Suivre mon rapport'}<ArrowRight className="ml-2 h-4 w-4" /></Button>
                </div>
              </Card>
            </Link>
          </section>

          <section className="mt-8" aria-labelledby="client-offers-title">
            <h2 id="client-offers-title" className="font-display text-xl font-bold text-ink-950">Nos offres</h2>
            <Link to="/app/offres" className="mt-4 block rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
              <Card className="cursor-pointer p-5 transition hover:-translate-y-0.5 hover:shadow-md sm:p-6">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="flex items-center gap-2 text-sm font-bold text-ink-950">{published ? <Receipt size={17} className="text-brand-700" /> : <Lock size={17} className="text-ink-500" />}{published ? 'Offres d’accompagnement disponibles' : 'Offres en préparation'}</p>
                    <p className="mt-2 text-sm text-ink-500">{published ? 'Consultez les offres adaptées à votre restitution.' : 'Les offres seront accessibles selon les règles de publication existantes.'}</p>
                  </div>
                  <Button variant="outline">Voir nos offres<ArrowRight className="ml-2 h-4 w-4" /></Button>
                </div>
              </Card>
            </Link>
          </section>

          <section className="mt-8" aria-labelledby="client-documents-title">
            <h2 id="client-documents-title" className="font-display text-xl font-bold text-ink-950">Nos documents</h2>
            <div className="mt-4"><DocumentsPanel orgId={effectiveOrgId} variant="client" /></div>
          </section>
        </>
      ) : null}
    </div>
  )
}

function InformationCard({ icon, title, rows }: { icon: ReactNode; title: string; rows: Array<[string, string | null | undefined]> }) {
  return (
    <Card className="p-5 sm:p-6">
      <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-brand-700">{icon}{title}</p>
      <dl className="mt-4 grid gap-3">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-start justify-between gap-4 border-b border-ink-50 pb-2 last:border-0 last:pb-0">
            <dt className="text-sm text-ink-500">{label}</dt><dd className="text-right text-sm font-semibold text-ink-900">{value || 'Non renseigné'}</dd>
          </div>
        ))}
      </dl>
    </Card>
  )
}

function EditableField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div key={label} className="flex items-start justify-between gap-4 border-b border-ink-50 pb-2 last:border-0 last:pb-0">
      <dt className="text-sm text-ink-500">{label}</dt>
      <Input
        className="w-full text-sm font-semibold text-ink-900 text-right sm:text-left"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  )
}


function DiagnosticCard({ info, loading, submitted, sector }: { info: ReturnType<typeof useDiagnosticStatus>['info']; loading: boolean; submitted: boolean; sector?: string | null }) {
  const sectorKey = toSector(sector) as SectorKey | null
  const draft = sectorKey ? readDiagnosticDraft(sectorKey) : null
  const started = Boolean(draft?.started && draft.answered > 0)
  const questionsCompleted = Boolean(draft?.total && draft.completed === draft.total)
  const label = submitted ? 'Diagnostic envoyé' : questionsCompleted ? 'Finaliser et envoyer mon diagnostic' : started ? 'Continuer mon diagnostic' : 'Commencer mon diagnostic'

  return (
    <Link to={submitted ? '/app/diagnostics' : '/app/diagnostic-auto'} className="block rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
      <Card className="cursor-pointer border-brand-200 p-5 transition hover:-translate-y-0.5 hover:shadow-md sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-brand-700"><ClipboardCheck size={16} />{submitted ? diagnosticStatusLabel(info.status) : questionsCompleted ? 'Questions terminées' : started ? 'Diagnostic commencé' : 'Diagnostic non commencé'}</p>
            <p className="mt-3 text-sm text-ink-600">{submitted ? <>Diagnostic envoyé{info.submittedAt ? ` le ${longDate(info.submittedAt)}` : ''}.</> : questionsCompleted ? 'Votre synthèse est prête. Ouvrez-la pour envoyer réellement le diagnostic à ALLNEEDS.' : started ? `${draft?.answered ?? 0}/${draft?.total ?? 0} questions renseignées.` : 'Répondez au questionnaire une question à la fois.'}</p>
            {loading ? <p className="mt-2 text-xs text-ink-400">Vérification du statut serveur…</p> : null}
          </div>
          <Button variant={submitted ? 'outline' : 'primary'}>{label}<ArrowRight className="ml-2 h-4 w-4" /></Button>
        </div>
      </Card>
    </Link>
  )
}

