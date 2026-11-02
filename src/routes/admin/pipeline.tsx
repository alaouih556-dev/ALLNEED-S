import { createFileRoute } from '@tanstack/react-router'
import { PageHeader } from '@/components/layouts'
import { Card } from '@/components/ui'
import { useDemo } from '@/store/store'
export const Route=createFileRoute('/admin/pipeline')({component:PipelinePage})
function PipelinePage(){const {state}=useDemo();return <><PageHeader eyebrow="Commercial" title="Pipeline" description="Les opportunités réelles apparaîtront ici lorsqu’elles seront enregistrées."/><Card className="p-6">{state.leads.length?<div className="space-y-3">{state.leads.map(lead=><article key={lead.id} className="rounded-xl border border-ink-100 p-4"><h2 className="font-semibold text-ink-950">{lead.orgName}</h2><p className="mt-1 text-sm text-ink-600">{lead.contactName} · {lead.stage}</p><p className="mt-1 text-xs text-ink-500">{lead.nextAction}</p></article>)}</div>:<div className="text-center"><h2 className="font-semibold text-ink-950">Aucune opportunité enregistrée</h2><p className="mt-2 text-sm text-ink-500">Aucune donnée fictive n’est préchargée. Le pipeline démarre vide.</p></div>}</Card></>}
