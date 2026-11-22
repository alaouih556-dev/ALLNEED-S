import { useEffect, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Save } from 'lucide-react'
import { PageHeader } from '@/components/layouts'
import { Alert, Button } from '@/components/ui'
import { LoadingRows, Panel } from '@/components/admin-kit'
import { orgApi, useOrg, useOrgResource } from '@/features/organization/core'
import { ORG_PERMISSION_LABELS } from '@/features/organization/labels'

export const Route = createFileRoute('/organisation/permissions')({ component: PermissionsPage })

type Settings = { levelPermissions: Record<string, string[]>; permissions: string[]; levels: Array<{ id: string; label: string }> }

const LABELS = ORG_PERMISSION_LABELS

function PermissionsPage() {
  const { can, refresh } = useOrg()
  const { data, loading, error } = useOrgResource<Settings>(can('settings.manage') ? '/settings' : null)
  const [matrix, setMatrix] = useState<Record<string, string[]>>({})
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null)
  useEffect(() => { if (data) setMatrix(data.levelPermissions) }, [data])

  if (!can('settings.manage')) return <Alert tone="warning">Cette page est réservée au PDG.</Alert>
  const toggle = (level: string, permission: string) => setMatrix((current) => {
    const list = current[level] ?? []
    return { ...current, [level]: list.includes(permission) ? list.filter((p) => p !== permission) : [...list, permission] }
  })
  async function save() {
    setSaving(true)
    setMessage(null)
    try {
      await orgApi('/settings', { method: 'PATCH', body: { levelPermissions: matrix } })
      await refresh()
      setMessage({ tone: 'success', text: 'Permissions enregistrées.' })
    } catch (cause) {
      setMessage({ tone: 'danger', text: cause instanceof Error ? cause.message : 'Enregistrement impossible.' })
    } finally {
      setSaving(false)
    }
  }
  return (
    <div>
      <PageHeader eyebrow="Direction générale" title="Permissions par niveau" description="Choisissez ce que chaque niveau peut faire. Le périmètre reste limité au service ou à l’équipe de chacun." actions={<Button size="sm" onClick={() => void save()} disabled={saving || !data}><Save size={14} />{saving ? 'Enregistrement…' : 'Enregistrer'}</Button>} />
      {error ? <Alert tone="danger" className="mb-5">{error}</Alert> : null}
      {message ? <Alert tone={message.tone} className="mb-5">{message.text}</Alert> : null}
      <Panel>
        {loading && !data ? <LoadingRows /> : null}
        {data ? (
          <div className="overflow-x-auto">
            <table className="og-matrix">
              <thead><tr><th scope="col">Permission</th>{data.levels.map((level) => <th key={level.id} scope="col">{level.label}</th>)}</tr></thead>
              <tbody>
                {data.permissions.map((permission) => (
                  <tr key={permission}>
                    <th scope="row"><strong>{LABELS[permission]?.label ?? permission}</strong><small>{LABELS[permission]?.text}</small></th>
                    {data.levels.map((level) => (
                      <td key={level.id}><input type="checkbox" aria-label={`${LABELS[permission]?.label} — ${level.label}`} checked={(matrix[level.id] ?? []).includes(permission)} onChange={() => toggle(level.id, permission)} /></td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </Panel>
    </div>
  )
}
