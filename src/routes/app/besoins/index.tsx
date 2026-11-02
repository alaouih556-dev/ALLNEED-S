import { useState } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { ArrowRight, Inbox, LockKeyhole, Plus } from 'lucide-react'
import { useDemo, makeNeed } from '@/store/store'
import { useAuth } from '@/features/auth/AuthContext'
import { useOperationalNeeds } from '@/features/operations/useOperationalNeeds'
import { useApiResource } from '@/lib/useApiResource'
import { PageHeader } from '@/components/layouts'
import {
  Badge,
  Alert,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  Modal,
  Select,
  Tabs,
  Textarea,
} from '@/components/ui'
import { NEED_FLOW, NEED_STATUS, URGENCY, normalizeNeedStatus } from '@/lib/status'
import { formatNeedsPrice, type NeedsSubscriptionPayload } from '@/lib/besoins'
import { longDate, money, relative } from '@/lib/format'
import type { Need } from '@/types'

export const Route = createFileRoute('/app/besoins/')({
  component: BesoinsPage,
  head: () => ({ meta: [{ title: 'Mes besoins — ALLNEEDS' }] }),
})

const CATEGORIES = [
  { value: 'logiciel', label: 'Logiciel de gestion, site ou espace en ligne' },
  { value: 'creation', label: 'Logo, identité visuelle, photo, vidéo, impression' },
  { value: 'rh', label: 'Recrutement, paie, formation, organisation' },
  { value: 'logistique', label: 'Transport, restauration, assurance, fournitures' },
  { value: 'energie', label: 'Énergie, fluides, télécom' },
  { value: 'maintenance', label: 'Maintenance informatique, réseaux, équipements' },
]

function categoryLabel(value: string) {
  return CATEGORIES.find((c) => c.value === value)?.label ?? value
}

const CLOSED = ['cloture', 'valide', 'annule']

export function BesoinsPage() {
  const { state, dispatch, orgId } = useDemo()
  const auth = useAuth()
  const currentOrgId = auth.user?.organization?.id || orgId
  const subscription = useApiResource<NeedsSubscriptionPayload>('/api/needs/subscription')
  const operations = useOperationalNeeds(state.needs)
  const [filter, setFilter] = useState<'actifs' | 'tous' | 'clos'>('actifs')
  const [open, setOpen] = useState(false)
  const [limitOpen, setLimitOpen] = useState(false)
  const [form, setForm] = useState({
    title: '',
    category: 'logiciel',
    description: '',
    location: '',
    budgetMax: '',
    urgency: 'normale' as Need['urgency'],
    deadline: '',
    volume: '',
  })

  const live = operations.live
  const needs = operations.needs.filter((n) => !live || n.orgId === currentOrgId)
  const currentSubscription = subscription.data?.current ?? null
  const plan = currentSubscription?.status === 'active' ? currentSubscription : null
  const remaining = plan ? plan.remaining : null

  const filtered = needs.filter((n) => {
    const status = normalizeNeedStatus(n.status)
    if (filter === 'tous') return true
    if (filter === 'clos') return status ? CLOSED.includes(status) : false
    return status ? !CLOSED.includes(status) : true
  })

  function openNeedForm() {
    if (live && !plan) { dispatch({ type: 'TOAST_ADD', toast: { title: 'Abonnement requis', description: 'Souscrivez à une formule Besoins pour déposer une demande.', tone: 'warning' } }); return }
    if (live && remaining !== null && remaining <= 0) { setLimitOpen(true); return }
    setOpen(true)
  }

  async function submit() {
    if (!form.title.trim()) return
    const input = {
        orgId: currentOrgId,
        title: form.title,
        category: form.category as Need['category'],
        categoryLabel: categoryLabel(form.category),
        description: form.description,
        location: form.location || 'Casablanca',
        budgetMax: form.budgetMax ? Number(form.budgetMax) : null,
        urgency: form.urgency,
        deadline: form.deadline || null,
        volume: form.volume || null,
      }
    try {
      if (live) await operations.create(input)
      else dispatch({ type: 'NEED_CREATE', need: makeNeed(input) })
      setOpen(false)
      setForm({ title: '', category: 'logiciel', description: '', location: '', budgetMax: '', urgency: 'normale', deadline: '', volume: '' })
      if (live) void subscription.refresh()
    } catch (cause) {
      const code = (cause as { code?: string })?.code
      if (code === 'NEEDS_LIMIT_REACHED') { setOpen(false); setLimitOpen(true); return }
      if (code === 'NEEDS_SUBSCRIPTION_REQUIRED') { setOpen(false); void subscription.refresh(); return }
      dispatch({ type: 'TOAST_ADD', toast: { title: 'Demande non enregistrée', description: cause instanceof Error ? cause.message : 'Impossible d’enregistrer ce besoin.', tone: 'warning' } })
    }
  }

  const counts = {
    actifs: needs.filter((n) => { const s = normalizeNeedStatus(n.status); return s ? !CLOSED.includes(s) : true }).length,
    clos: needs.filter((n) => { const s = normalizeNeedStatus(n.status); return s ? CLOSED.includes(s) : false }).length,
    tous: needs.length,
  }

  return (
    <>
      <PageHeader
        eyebrow="Espace client"
        title="Mes besoins"
        description="Déposez vos besoins : nous recherchons, vérifions les prestataires et vous transmettons des propositions."
        actions={
          <Button size="sm" onClick={openNeedForm}>
            <Plus className="h-3.5 w-3.5" />
            Déposer un besoin
          </Button>
        }
      />

      {operations.error ? <Alert tone="danger" className="mb-5" title="Chargement des demandes impossible">{operations.error}</Alert> : null}

      {live && subscription.data && !plan ? (
        <Card className="mb-5 p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <span className="rounded-xl bg-ink-100 p-2 text-ink-600"><LockKeyhole size={18} /></span>
              <div>
                <h2 className="font-display text-lg font-bold text-ink-950">Un abonnement Besoins est requis</h2>
                <p className="mt-1 max-w-xl text-sm text-ink-600">Souscrivez à une formule pour déposer vos besoins et recevoir des propositions vérifiées par ALLNEEDS.</p>
              </div>
            </div>
            <Link to="/app/mon-abonnement-besoins"><Button>Souscrire un abonnement <ArrowRight className="ml-2 h-4 w-4" /></Button></Link>
          </div>
        </Card>
      ) : null}

      {live && plan ? (
        <div className="mb-5 rounded-xl border border-ink-100 bg-white p-4 text-sm text-ink-600">
          Formule <strong>{plan.planName}</strong> · {formatNeedsPrice(plan.price)}/mois · {plan.usedThisMonth}/{plan.monthlyLimit} besoins ce mois
          {plan.remaining > 0 ? ` · ${plan.remaining} restant(s)` : ' · quota mensuel atteint'} · période jusqu’au {longDate(plan.periodEnd)}.{' '}
          <Link to="/app/mon-abonnement-besoins" className="font-semibold text-brand-700">Gérer mon abonnement</Link>
        </div>
      ) : null}

      <div className="mb-5">
        <Tabs
          value={filter}
          onChange={(v) => setFilter(v as typeof filter)}
          tabs={[
            { value: 'actifs', label: 'En cours', count: counts.actifs },
            { value: 'clos', label: 'Clos et validés', count: counts.clos },
            { value: 'tous', label: 'Tous', count: counts.tous },
          ]}
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Inbox className="h-5 w-5" />}
          title="Aucun besoin dans cette vue"
          description="Déposez un besoin : nous recherchons, vérifions les prestataires et comparons les devis."
          action={<Button size="sm" onClick={openNeedForm}>Déposer un besoin</Button>}
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {filtered.map((need) => {
            const normalized = normalizeNeedStatus(need.status) ?? need.status
            const status = NEED_STATUS[normalized] ?? NEED_STATUS.nouveau
            const step = Math.max(0, NEED_FLOW.indexOf(normalized))
            const depositedAt = need.submittedAt || need.createdAt
            return (
              <Card key={need.id} className="flex flex-col p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-ink-950">{need.title}</p>
                    <p className="mt-1 text-xs text-ink-500">{need.categoryLabel}</p>
                  </div>
                  <Badge tone={status.tone}>{status.label}</Badge>
                </div>

                <p className="mt-4 line-clamp-2 text-sm leading-relaxed text-ink-600">{need.description}</p>

                <div className="mt-5 flex items-center justify-between text-xs text-ink-500">
                  <span>
                    {depositedAt ? `Déposé ${relative(depositedAt)}` : 'Date de dépôt non disponible'}
                    {need.deadline ? ` · échéance ${longDate(need.deadline)}` : ''}
                  </span>
                  <Badge tone={(URGENCY[need.urgency] ?? URGENCY.normale).tone}>{(URGENCY[need.urgency] ?? URGENCY.normale).label}</Badge>
                </div>

                <div className="mt-3 text-xs text-ink-500">Étape {Math.min(step + 1, NEED_FLOW.length)} / {NEED_FLOW.length}</div>

                <Link to="/app/besoins/$id" params={{ id: need.id }} className="mt-4">
                  <Button size="sm" fullWidth variant="outline">
                    Suivre ce besoin
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </Link>
              </Card>
            )
          })}
        </div>
      )}

      <Modal
        open={limitOpen}
        onClose={() => setLimitOpen(false)}
        title="Quota mensuel atteint"
        description={plan ? `Votre formule ${plan.planName} prévoit ${plan.monthlyLimit} besoins par mois.` : undefined}
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-xl bg-ink-50 p-4">
            <LockKeyhole className="mt-0.5 h-5 w-5 text-brand-700" />
            <p className="text-sm leading-relaxed text-ink-600">Vous avez atteint la limite mensuelle de votre abonnement. Votre quota sera remis à zéro au début de la prochaine période, ou vous pouvez changer de formule.</p>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="ghost" onClick={() => setLimitOpen(false)}>Fermer</Button>
            <Link to="/app/mon-abonnement-besoins"><Button>Voir les formules</Button></Link>
          </div>
        </div>
      </Modal>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Déposer un besoin"
        description="Ce besoin consomme 1 unité de votre quota mensuel."
      >
        <div className="space-y-5">
          <Field label="Intitulé" required>
            <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="Logiciel de gestion avec espace parents" />
          </Field>
          <Field label="Catégorie de prestation" required>
            <Select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}>
              {CATEGORIES.map((c) => (<option key={c.value} value={c.value}>{c.label}</option>))}
            </Select>
          </Field>
          <Field label="Description" required>
            <Textarea rows={5} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Contexte, contraintes, échéances…" />
          </Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Ville">
              <Input value={form.location} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} placeholder="Casablanca" />
            </Field>
            <Field label="Budget max (DH)">
              <Input type="number" value={form.budgetMax} onChange={(e) => setForm((f) => ({ ...f, budgetMax: e.target.value }))} placeholder="20000" />
            </Field>
            <Field label="Urgence">
              <Select value={form.urgency} onChange={(e) => setForm((f) => ({ ...f, urgency: e.target.value as Need['urgency'] }))}>
                <option value="faible">Faible</option>
                <option value="normale">Normale</option>
                <option value="haute">Haute</option>
              </Select>
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Volume / quantité">
              <Input value={form.volume} onChange={(e) => setForm((f) => ({ ...f, volume: e.target.value }))} placeholder="Ex. 1 site, 50 exemplaires" />
            </Field>
            <Field label="Échéance souhaitée">
              <Input type="date" value={form.deadline} onChange={(e) => setForm((f) => ({ ...f, deadline: e.target.value }))} />
            </Field>
          </div>
          <div className="flex justify-end gap-3 border-t border-ink-100 pt-5">
            <Button variant="ghost" onClick={() => setOpen(false)}>Annuler</Button>
            <Button onClick={() => void submit()} disabled={operations.loading || !form.title.trim() || !form.description.trim()}>Envoyer la demande</Button>
          </div>
        </div>
      </Modal>
    </>
  )
}
