import { useEffect, useState } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { ArrowRight, Building2, MapPin, RefreshCcw } from 'lucide-react'
import { Badge, Button, Card, SectionHeading, Alert } from '@/components/ui'
import { useAuth } from '@/features/auth/AuthContext'
import { ValidationRequests } from '@/components/ValidationRequests'

export const Route = createFileRoute('/concierge/')({ component: ConciergeDashboard })

type Org={id:string;name:string;sector:string;city?:string;contactName?:string;active?:boolean}

function ConciergeDashboard() {
  const auth=useAuth()
  const [orgs,setOrgs]=useState<Org[]>([])
  const [error,setError]=useState('')
  const [loading,setLoading]=useState(true)
  async function load(){setLoading(true);setError('');try{const r=await fetch('/api/concierge/orgs',{credentials:'same-origin',cache:'no-store'});const b=await r.json();if(!r.ok)throw new Error(b.error||'Chargement impossible');setOrgs(b)}catch(e){setError(e instanceof Error?e.message:'Chargement impossible')}finally{setLoading(false)}}
  useEffect(()=>{if(auth.status==='authenticated'&&auth.user?.role==='concierge')void load()},[auth.status,auth.user?.id,auth.user?.role])
  return <div className="container-app py-8 concierge-portfolio-page">
    <div className="flex flex-wrap items-end justify-between gap-4"><SectionHeading eyebrow="Espace concierge" title="Vos entreprises attribuées" description="Votre portefeuille est défini par l’administrateur ALLNEEDS. Vous ne voyez que les entreprises qui vous sont affectées."/><Button variant="outline" size="sm" onClick={()=>void load()}><RefreshCcw size={15}/>Actualiser</Button></div>
    {error?<Alert tone="danger" className="mt-5">{error}</Alert>:null}
    {loading?<p className="mt-5 text-sm text-ink-500">Chargement du portefeuille…</p>:null}
    <div className="mt-6 grid gap-4 lg:grid-cols-2">{orgs.map(org=><Card key={org.id} className="p-5"><div className="flex items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><h2 className="font-semibold text-ink-950">{org.name}</h2><Badge>{org.sector}</Badge></div><p className="mt-2 flex items-center gap-1 text-xs text-ink-500"><MapPin size={13}/>{org.city||'Ville non renseignée'}{org.contactName?` · ${org.contactName}`:''}</p></div><Building2 className="text-brand-700" size={19}/></div><Link to={'/concierge/entreprises/$id' as any} params={{id:org.id} as any} className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-brand-700">Ouvrir le suivi <ArrowRight size={14}/></Link></Card>)}</div>
    {!loading&&!orgs.length?<Card className="mt-6 p-8 text-center"><Building2 className="mx-auto h-6 w-6 text-ink-400"/><p className="mt-3 font-semibold text-ink-900">Aucune entreprise attribuée</p><p className="mt-1 text-sm text-ink-500">L’administrateur ALLNEEDS doit vous attribuer au moins une entreprise depuis la gestion des Concierges.</p></Card>:null}
    <ValidationRequests />
  </div>
}
