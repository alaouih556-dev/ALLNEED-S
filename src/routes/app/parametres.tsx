import { useCallback, useState, type ReactNode } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Building2, Edit2, KeyRound, Save, ShieldCheck, UserRound, X } from 'lucide-react'
import { PageHeader } from '@/components/layouts'
import { Alert, Button, Input } from '@/components/ui'
import { Initial, Panel } from '@/components/admin-kit'
import { useAuth } from '@/features/auth/AuthContext'
import { toSector } from '@/lib/parcours'
import { SECTOR_LABEL } from '@/data/catalog'
import { longDate } from '@/lib/format'

export const Route = createFileRoute('/app/parametres')({
  component: ProfilePage,
  head: () => ({ meta: [{ title: 'Mon profil — ALLNEEDS' }] }),
})

const ROLE_LABEL: Record<string, string> = {
  dirigeant: 'Dirigeant',
  manager: 'Manager',
  collaborateur: 'Collaborateur',
}

type ProfileForm = { name: string; firstName: string; lastName: string; phone: string; jobTitle: string }

function ProfilePage() {
  const auth = useAuth()
  const user = auth.user
  const org = user?.organization ?? null

  const initial = useCallback((): ProfileForm => ({
    name: user?.name ?? '',
    firstName: user?.firstName ?? '',
    lastName: user?.lastName ?? '',
    phone: user?.phone ?? '',
    jobTitle: user?.jobTitle ?? '',
  }), [user])

  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<ProfileForm>(initial)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  function startEdit() {
    setForm(initial())
    setError('')
    setSaved(false)
    setEditing(true)
  }

  async function save() {
    setError('')
    if (!form.name.trim()) {
      setError('Le nom est obligatoire.')
      return
    }
    setSaving(true)
    try {
      const response = await fetch('/api/me/profile', {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          phone: form.phone.trim(),
          jobTitle: form.jobTitle.trim(),
        }),
      })
      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(body.error || 'Enregistrement impossible.')
      }
      await auth.refresh()
      setEditing(false)
      setSaved(true)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Enregistrement impossible.')
    } finally {
      setSaving(false)
    }
  }

  const sectorKey = toSector(org?.sector) as keyof typeof SECTOR_LABEL | null
  const sectorLabel = sectorKey ? SECTOR_LABEL[sectorKey] : org?.sector
  const lastLogin = (user as { lastLoginAt?: string } | null)?.lastLoginAt

  return (
    <div>
      <PageHeader
        eyebrow="Compte"
        title="Mon profil"
        description="Vos informations personnelles, celles de votre établissement et l’état de votre compte."
      />

      {saved ? <Alert tone="success" className="mb-5">Vos informations ont été enregistrées.</Alert> : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Panel
          title={<span className="flex items-center gap-2"><UserRound size={16} className="text-[var(--an-accent)]" />Informations personnelles</span>}
          description="Visibles par votre Account Manager ALLNEEDS."
          action={!editing ? <Button size="sm" variant="outline" onClick={startEdit}><Edit2 size={14} />Modifier</Button> : null}
        >
          {editing ? (
            <form className="grid gap-4 p-5 sm:grid-cols-2" onSubmit={(event) => { event.preventDefault(); void save() }}>
              <FormField label="Nom affiché" required><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoComplete="name" /></FormField>
              <FormField label="Fonction / poste"><Input value={form.jobTitle} onChange={(e) => setForm({ ...form, jobTitle: e.target.value })} autoComplete="organization-title" /></FormField>
              <FormField label="Prénom"><Input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} autoComplete="given-name" /></FormField>
              <FormField label="Nom de famille"><Input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} autoComplete="family-name" /></FormField>
              <FormField label="Téléphone"><Input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} autoComplete="tel" /></FormField>
              <FormField label="E-mail" hint="L’e-mail de connexion ne peut pas être modifié ici."><Input value={user?.email ?? ''} disabled /></FormField>
              {error ? <Alert tone="danger" className="sm:col-span-2">{error}</Alert> : null}
              <div className="flex flex-wrap gap-2 sm:col-span-2">
                <Button type="submit" size="sm" disabled={saving}><Save size={14} />{saving ? 'Enregistrement…' : 'Enregistrer'}</Button>
                <Button type="button" size="sm" variant="outline" onClick={() => setEditing(false)} disabled={saving}><X size={14} />Annuler</Button>
              </div>
            </form>
          ) : (
            <>
              <div className="flex items-center gap-3 px-5 pt-5">
                <Initial name={user?.name || user?.email || '?'} size="lg" />
                <div className="min-w-0">
                  <p className="truncate font-bold text-ink-950">{user?.name || 'Nom non renseigné'}</p>
                  <p className="truncate text-xs text-ink-500">{[user?.jobTitle, ROLE_LABEL[user?.role ?? ''] ?? user?.role].filter(Boolean).join(' · ')}</p>
                </div>
              </div>
              <Facts rows={[
                ['Prénom', user?.firstName],
                ['Nom de famille', user?.lastName],
                ['E-mail', user?.email],
                ['Téléphone', user?.phone || org?.contactPhone],
                ['Fonction / poste', user?.jobTitle],
              ]} />
            </>
          )}
        </Panel>

        <div className="grid content-start gap-5">
          <Panel
            title={<span className="flex items-center gap-2"><Building2 size={16} className="text-[var(--an-accent)]" />Mon établissement</span>}
            description="Pour modifier ces informations, contactez votre Account Manager."
          >
            <Facts rows={[
              ['Établissement', org?.name],
              ['Secteur', sectorLabel],
              ['Type de structure', org?.kind],
              ['Ville', org?.city],
              ['Taille', org?.size],
              ['Account Manager', org?.concierge?.name || org?.concierge?.email],
            ]} />
          </Panel>

          <Panel title={<span className="flex items-center gap-2"><ShieldCheck size={16} className="text-[var(--an-accent)]" />Compte et sécurité</span>}>
            <Facts rows={[
              ['Rôle', ROLE_LABEL[user?.role ?? ''] ?? user?.role],
              ['Statut', user?.active === false ? 'Désactivé' : 'Actif'],
              ['Dernière connexion', lastLogin ? longDate(lastLogin) : null],
            ]} />
            <p className="flex items-start gap-2 border-t border-[var(--an-line)] px-5 py-4 text-xs leading-5 text-ink-500">
              <KeyRound size={14} className="mt-0.5 shrink-0" />Pour changer de mot de passe, demandez un nouveau lien de configuration à votre Account Manager.
            </p>
          </Panel>
        </div>
      </div>
    </div>
  )
}

function FormField({ label, hint, required, children }: { label: string; hint?: string; required?: boolean; children: ReactNode }) {
  return (
    <label className="grid gap-1.5">
      <span className="text-xs font-semibold text-ink-600">{label}{required ? <span className="text-rose-500"> *</span> : null}</span>
      {children}
      {hint ? <span className="text-[0.7rem] text-ink-400">{hint}</span> : null}
    </label>
  )
}

function Facts({ rows }: { rows: Array<[string, string | null | undefined]> }) {
  return (
    <dl className="cl-facts">
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value || <span className="text-ink-400">Non renseigné</span>}</dd>
        </div>
      ))}
    </dl>
  )
}
