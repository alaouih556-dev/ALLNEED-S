import { useState } from 'react'
import { CheckCircle2, ClipboardCheck, FileQuestion, MessageSquareText } from 'lucide-react'
import { DIAGNOSTIC_GRIDS } from '@/data/grid'
import { PageHeader } from '@/components/layouts'
import { Alert, Badge, Button, Field, Input, Select } from '@/components/ui'
import { EmptyBox, Initial, MiniStat, Panel, Rows, StatGrid } from '@/components/admin-kit'
import { isSectorActive } from '@/lib/active-sectors'
import { titles, type Industry } from './model'

type Review = { status?: string; note?: string; date?: string }

function readJson<T>(key: string, fallback: T): T {
  try {
    return JSON.parse(window.localStorage.getItem(key) || '') as T
  } catch {
    return fallback
  }
}

/** Relecture des autoévaluations enregistrées dans ce navigateur (outil de démonstration). */
export function DiagnosticReview() {
  const [refresh, setRefresh] = useState(0)
  let keys: string[] = []
  try {
    keys = Object.keys(window.localStorage)
  } catch {
    keys = []
  }
  const entries = keys
    .filter((k) => k.startsWith('allneeds.auto-diagnostic.v1.') && !k.endsWith('.review'))
    .map((key) => {
      const sector = key.split('.').at(-1) as Industry
      const answers = readJson<Record<string, number>>(key, {})
      const grid = DIAGNOSTIC_GRIDS[sector]
      const review = readJson<Review>(`${key}.review`, {})
      return { key, sector, answers, grid, review }
    })
    .filter((e) => e.grid && isSectorActive(e.sector))

  const reviewed = entries.filter((e) => e.review.status === 'Revu par ALLNEEDS').length
  const more = entries.filter((e) => e.review.status === 'Compléments demandés').length

  return (
    <div key={refresh}>
      <PageHeader eyebrow="Revue interne" title="Autoévaluations" description="Relecture des autoévaluations enregistrées dans ce navigateur. L’avis reste interne : aucun score commercial n’est transmis au client." />

      <StatGrid>
        <MiniStat icon={<ClipboardCheck size={18} />} tone="indigo" label="Autoévaluations" value={entries.length} />
        <MiniStat icon={<FileQuestion size={18} />} tone="amber" label="À examiner" value={entries.length - reviewed - more} />
        <MiniStat icon={<MessageSquareText size={18} />} tone="sky" label="Compléments demandés" value={more} />
        <MiniStat icon={<CheckCircle2 size={18} />} tone="emerald" label="Revues" value={reviewed} />
      </StatGrid>

      <Alert tone="info" className="mb-5">La validation est un avis organisationnel, sans vérification documentaire ni portée médicale.</Alert>

      <Panel title="Autoévaluations reçues" description="Donnez un avis puis publiez-le.">
        {!entries.length ? <EmptyBox icon={<ClipboardCheck size={20} />} title="Aucune autoévaluation dans ce navigateur" text="Remplissez le diagnostic côté client pour tester la revue." /> : null}
        <Rows>
          {entries.map((e) => {
            const questions = e.grid.levers.flatMap((l) => l.questions)
            const count = questions.filter((q) => e.answers[q.id] >= 1 && e.answers[q.id] <= 5).length
            const status = e.review.status || 'À examiner'
            return (
              <li key={e.key} className="px-5 py-4">
                <div className="flex flex-wrap items-center gap-3">
                  <Initial name={titles[e.sector]} tone={status === 'Revu par ALLNEEDS' ? 'emerald' : 'amber'} />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-ink-950">{titles[e.sector]}</p>
                    <p className="text-sm text-ink-500">{count} / {questions.length} réponses</p>
                  </div>
                  <Badge tone={status === 'Revu par ALLNEEDS' ? 'success' : status === 'Compléments demandés' ? 'info' : 'warning'}>{status}</Badge>
                </div>
                <form
                  className="mt-4 grid gap-3 md:grid-cols-[220px_minmax(0,1fr)_auto] md:items-end"
                  onSubmit={(event) => {
                    event.preventDefault()
                    const data = new FormData(event.currentTarget)
                    try {
                      window.localStorage.setItem(`${e.key}.review`, JSON.stringify({ status: data.get('status'), note: data.get('note'), date: new Date().toISOString() }))
                    } catch {
                      /* stockage indisponible */
                    }
                    setRefresh((r) => r + 1)
                  }}
                >
                  <Field label="Avis de relecture">
                    <Select name="status" defaultValue={status}>
                      <option>À examiner</option>
                      <option>Compléments demandés</option>
                      <option>Revu par ALLNEEDS</option>
                    </Select>
                  </Field>
                  <Field label="Commentaire de restitution"><Input name="note" required defaultValue={e.review.note || ''} /></Field>
                  <Button type="submit">Publier l’avis</Button>
                </form>
              </li>
            )
          })}
        </Rows>
      </Panel>
    </div>
  )
}
