import { createContext, useCallback, useContext, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { CalendarClock, Pencil, Plus, Trash2, UserRound } from 'lucide-react'
import { Alert, Badge, Button, Field, Input, Modal, Select, Textarea, type Tone } from '@/components/ui'
import { EmptyBox, LoadingRows } from '@/components/admin-kit'
import { useAuth } from '@/features/auth/AuthContext'

export type OrgTeam = { id: string; name: string }
export type OrgDepartment = { id: string; name: string; teams: OrgTeam[] }
export type OrgMe = {
  position: { level: 'pdg' | 'department_manager' | 'team_manager' | 'member'; levelLabel: string; departmentId: string | null; teamId: string | null; strategyManager: boolean }
  permissions: string[]
  departments: OrgDepartment[]
  structure: OrgDepartment[]
}
export type TaskStats = { total: number; open: number; done: number; overdue: number; blocked: number; completion: number }
export type OrgTask = {
  id: string; title: string; description: string; departmentId: string; teamId: string | null; assigneeId: string | null; assigneeName: string | null
  status: TaskStatus; priority: TaskPriority; dueDate: string | null; strategyId: string | null; strategyTitle: string | null; objectiveId: string | null; overdue: boolean; createdBy: string
}
export type TaskStatus = 'todo' | 'in_progress' | 'review' | 'blocked' | 'done'
export type TaskPriority = 'low' | 'normal' | 'high' | 'urgent'

export const TASK_STATUS: Array<{ id: TaskStatus; label: string; tone: Tone }> = [
  { id: 'todo', label: 'À faire', tone: 'neutral' },
  { id: 'in_progress', label: 'En cours', tone: 'info' },
  { id: 'review', label: 'À valider', tone: 'violet' },
  { id: 'blocked', label: 'Bloquée', tone: 'danger' },
  { id: 'done', label: 'Terminée', tone: 'success' },
]
export const TASK_PRIORITY: Record<TaskPriority, { label: string; tone: Tone }> = {
  low: { label: 'Basse', tone: 'neutral' },
  normal: { label: 'Normale', tone: 'info' },
  high: { label: 'Haute', tone: 'warning' },
  urgent: { label: 'Urgente', tone: 'danger' },
}

export async function orgApi<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const response = await fetch(`/api/org${path}`, {
    method: init?.method ?? 'GET',
    credentials: 'same-origin',
    cache: 'no-store',
    headers: init?.body !== undefined ? { 'content-type': 'application/json' } : undefined,
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error((data as { error?: string }).error || 'Action impossible pour le moment.')
  return data as T
}

const OrgContext = createContext<{ me: OrgMe | null; loading: boolean; error: string; refresh: () => Promise<void>; can: (perm: string) => boolean } | null>(null)

export function OrgProvider({ children }: { children: ReactNode }) {
  const auth = useAuth()
  const [me, setMe] = useState<OrgMe | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const refresh = useCallback(async () => {
    setLoading(true)
    setError('')
    try { setMe(await orgApi<OrgMe>('/me')) } catch (cause) { setError(cause instanceof Error ? cause.message : 'Chargement impossible.') } finally { setLoading(false) }
  }, [])
  useEffect(() => { if (auth.status === 'authenticated') void refresh() }, [auth.status, auth.user?.id, refresh])
  const value = useMemo(() => ({ me, loading, error, refresh, can: (perm: string) => Boolean(me?.permissions.includes(perm)) }), [me, loading, error, refresh])
  return <OrgContext.Provider value={value}>{children}</OrgContext.Provider>
}
export const useOrgOptional = () => useContext(OrgContext)
export function useOrg() {
  const value = useContext(OrgContext)
  if (!value) throw new Error('useOrg doit être utilisé dans OrgProvider')
  return value
}

/** Charge une ressource de l'organisation, avec rechargement. */
export function useOrgResource<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(Boolean(path))
  const [error, setError] = useState('')
  const reload = useCallback(async () => {
    if (!path) return
    setLoading(true)
    setError('')
    try { setData(await orgApi<T>(path)) } catch (cause) { setError(cause instanceof Error ? cause.message : 'Chargement impossible.') } finally { setLoading(false) }
  }, [path])
  useEffect(() => { void reload() }, [reload])
  return { data, loading, error, reload }
}

export const teamNameOf = (structure: OrgDepartment[] | undefined, teamId: string | null) => structure?.flatMap((d) => d.teams).find((t) => t.id === teamId)?.name ?? null
export const shortDate = (value: string) => new Date(`${value}T12:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })

export function ProgressBar({ value }: { value: number }) {
  return <div className="og-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={value}><i style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /></div>
}

/* ------------------------------------------------------------------ */
/* Tableau de tâches réutilisé par chaque espace                        */
/* ------------------------------------------------------------------ */

export function TaskBoard({ departmentId, teamId, strategyId, objectives, mine, canCreate, onChanged }: {
  departmentId?: string
  teamId?: string
  strategyId?: string
  objectives?: Array<{ id: string; title: string }>
  mine?: boolean
  canCreate?: boolean
  onChanged?: () => void
}) {
  const { me, can } = useOrg()
  const auth = useAuth()
  const query = new URLSearchParams()
  if (mine) query.set('mine', '1')
  if (departmentId) query.set('departmentId', departmentId)
  if (teamId) query.set('teamId', teamId)
  if (strategyId) query.set('strategyId', strategyId)
  const { data, loading, error, reload } = useOrgResource<{ tasks: OrgTask[]; stats: TaskStats }>(`/tasks?${query}`)
  const [editing, setEditing] = useState<OrgTask | 'new' | null>(null)
  const [actionError, setActionError] = useState('')
  const refresh = async () => { await reload(); onChanged?.() }
  const manager = can('tasks.manage')

  async function setStatus(task: OrgTask, status: TaskStatus) {
    setActionError('')
    try { await orgApi(`/tasks/${task.id}`, { method: 'PATCH', body: { status } }); await refresh() } catch (cause) { setActionError(cause instanceof Error ? cause.message : 'Action impossible.') }
  }
  async function remove(task: OrgTask) {
    if (!window.confirm('Supprimer définitivement cette tâche ?')) return
    setActionError('')
    try { await orgApi(`/tasks/${task.id}`, { method: 'DELETE' }); await refresh() } catch (cause) { setActionError(cause instanceof Error ? cause.message : 'Action impossible.') }
  }

  return (
    <div>
      {canCreate ? <div className="flex justify-end px-4 pt-4"><Button size="sm" onClick={() => setEditing('new')}><Plus size={14} />Nouvelle tâche</Button></div> : null}
      {error || actionError ? <div className="px-4 pt-4"><Alert tone="danger">{error || actionError}</Alert></div> : null}
      {loading && !data ? <LoadingRows /> : null}
      {data && !data.tasks.length ? <EmptyBox icon={<CalendarClock size={20} />} title="Aucune tâche" text={canCreate ? 'Créez la première tâche et assignez-la à un membre.' : 'Les tâches qui vous sont assignées apparaîtront ici.'} /> : null}
      {data?.tasks.length ? (
        <div className="og-board">
          {TASK_STATUS.map((column) => {
            const tasks = data.tasks.filter((task) => task.status === column.id)
            return (
              <section key={column.id} className="og-column" aria-label={column.label}>
                <header><Badge tone={column.tone}>{column.label}</Badge><span>{tasks.length}</span></header>
                {tasks.map((task) => {
                  const canEdit = manager && (me?.position.level === 'pdg' || task.createdBy === auth.user?.id || me?.position.level !== 'member')
                  const canStatus = canEdit || task.assigneeId === auth.user?.id
                  return (
                    <article key={task.id} className="og-task">
                      <div className="flex items-start justify-between gap-2">
                        <h3>{task.title}</h3>
                        <Badge tone={TASK_PRIORITY[task.priority].tone}>{TASK_PRIORITY[task.priority].label}</Badge>
                      </div>
                      {task.description ? <p>{task.description}</p> : null}
                      {task.strategyTitle && !strategyId ? <small className="og-link-tag">{task.strategyTitle}</small> : null}
                      <dl>
                        <div><UserRound size={12} /><dd>{task.assigneeName || 'Non assignée'}</dd></div>
                        {task.dueDate ? <div className={task.overdue ? 'is-late' : ''}><CalendarClock size={12} /><dd>{shortDate(task.dueDate)}</dd></div> : null}
                      </dl>
                      <div className="og-task-actions">
                        <Select aria-label={`Statut de ${task.title}`} value={task.status} disabled={!canStatus} onChange={(event) => void setStatus(task, event.target.value as TaskStatus)}>
                          {TASK_STATUS.map((status) => <option key={status.id} value={status.id}>{status.label}</option>)}
                        </Select>
                        {canEdit ? <button type="button" className="og-icon" aria-label={`Modifier ${task.title}`} onClick={() => setEditing(task)}><Pencil size={14} /></button> : null}
                        {canEdit ? <button type="button" className="og-icon is-danger" aria-label={`Supprimer ${task.title}`} onClick={() => void remove(task)}><Trash2 size={14} /></button> : null}
                      </div>
                    </article>
                  )
                })}
              </section>
            )
          })}
        </div>
      ) : null}
      {editing ? <TaskModal task={editing === 'new' ? null : editing} departmentId={departmentId} teamId={teamId} strategyId={strategyId} objectives={objectives} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); void refresh() }} /> : null}
    </div>
  )
}

function TaskModal({ task, departmentId, teamId, strategyId, objectives, onClose, onSaved }: {
  task: OrgTask | null
  departmentId?: string
  teamId?: string
  strategyId?: string
  objectives?: Array<{ id: string; title: string }>
  onClose: () => void
  onSaved: () => void
}) {
  const { me } = useOrg()
  const options = me?.departments ?? []
  const initialDepartment = task?.departmentId ?? departmentId ?? me?.position.departmentId ?? options[0]?.id ?? ''
  const [form, setForm] = useState({
    title: task?.title ?? '', description: task?.description ?? '', departmentId: initialDepartment,
    teamId: task?.teamId ?? teamId ?? me?.position.teamId ?? '', assigneeId: task?.assigneeId ?? '', priority: task?.priority ?? 'normal', dueDate: task?.dueDate ?? '', objectiveId: task?.objectiveId ?? '',
  })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const teams = options.find((d) => d.id === form.departmentId)?.teams ?? []
  const assigneesPath = form.departmentId ? `/assignees?departmentId=${form.departmentId}${form.teamId ? `&teamId=${form.teamId}` : ''}` : null
  const assignees = useOrgResource<Array<{ id: string; name: string }>>(assigneesPath)
  const locked = Boolean(task || teamId)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      const shared = { title: form.title, description: form.description, assigneeId: form.assigneeId || null, priority: form.priority, dueDate: form.dueDate || null }
      if (task) await orgApi(`/tasks/${task.id}`, { method: 'PATCH', body: shared })
      else await orgApi('/tasks', { method: 'POST', body: { ...shared, departmentId: form.departmentId, teamId: form.teamId || null, strategyId: strategyId || undefined, objectiveId: form.objectiveId || undefined } })
      onSaved()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Enregistrement impossible.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open onClose={onClose} title={task ? 'Modifier la tâche' : 'Nouvelle tâche'}>
      <form className="grid gap-4 p-6 sm:grid-cols-2" onSubmit={submit}>
        <Field label="Titre" required className="sm:col-span-2"><Input value={form.title} maxLength={200} required onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
        <Field label="Description" className="sm:col-span-2"><Textarea rows={3} value={form.description} maxLength={4000} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
        <Field label="Service">
          <Select value={form.departmentId} disabled={locked || Boolean(strategyId)} onChange={(e) => setForm({ ...form, departmentId: e.target.value, teamId: '', assigneeId: '' })}>
            {options.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </Select>
        </Field>
        <Field label="Équipe">
          <Select value={form.teamId} disabled={locked} onChange={(e) => setForm({ ...form, teamId: e.target.value, assigneeId: '' })}>
            <option value="">Tout le service</option>
            {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </Select>
        </Field>
        <Field label="Assignée à">
          <Select value={form.assigneeId} onChange={(e) => setForm({ ...form, assigneeId: e.target.value })}>
            <option value="">Non assignée</option>
            {(assignees.data ?? []).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </Select>
        </Field>
        <Field label="Priorité">
          <Select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value as TaskPriority })}>
            {Object.entries(TASK_PRIORITY).map(([id, p]) => <option key={id} value={id}>{p.label}</option>)}
          </Select>
        </Field>
        <Field label="Échéance"><Input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} /></Field>
        {objectives?.length && !task ? (
          <Field label="Objectif lié">
            <Select value={form.objectiveId} onChange={(e) => setForm({ ...form, objectiveId: e.target.value })}>
              <option value="">Aucun</option>
              {objectives.map((o) => <option key={o.id} value={o.id}>{o.title}</option>)}
            </Select>
          </Field>
        ) : null}
        {error ? <Alert tone="danger" className="sm:col-span-2">{error}</Alert> : null}
        <div className="flex justify-end gap-2 sm:col-span-2">
          <Button type="button" variant="outline" onClick={onClose}>Annuler</Button>
          <Button type="submit" disabled={saving}>{saving ? 'Enregistrement…' : 'Enregistrer'}</Button>
        </div>
      </form>
    </Modal>
  )
}
