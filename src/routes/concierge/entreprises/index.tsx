import { useEffect, useState } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { ArrowRight, Building2, MapPin, Plus, RefreshCcw } from 'lucide-react'
import { ConciergeGuard } from '@/features/concierge/ScopedSection'
import { Alert, Badge, Button, Card } from '@/components/ui'
import { useAuth } from '@/features/auth/AuthContext'

export const Route = createFileRoute('/concierge/entreprises/')({ component: ConciergeCompanies })
type Org={id:string;name:string;sector:string;city?:string;contactName?:string;contactRole?:string;diagnosticStatus?:string|null;restitutionPublished?:boolean;offerStatus?:string|null;missionsCount?:number;needsCount?:number}

function ConciergeCompanies() {
  const auth=useAuth(); const [orgs,setOrgs]=useState<Org[]>([]); const [error,setError]=useState(''); const [loading,setLoading]=useState(true)
  async function load(){setLoading(true);setError('');try{const r=await fetch('/api/concierge/orgs',{credentials:'same-origin',cache:'no-store'});const b=await r.json();if(!r.ok)throw new Error(b.error||'Chargement impossible');setOrgs(b)}catch(e){setError(e instanceof Error?e.message:'Chargement impossible')}finally{setLoading(false)}}
  useEffect(()=>{if(auth.status==='authenticated')void load()},[auth.status,auth.user?.id])
  return <ConciergeGuard><div className="container-app py-8 concierge-company-list-page">
    <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="eyebrow">Portefeuille attribué</p><h1 className="mt-2 font-display text-3xl font-bold text-ink-950">Entreprises que vous accompagnez</h1><p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-600">Vous accédez uniquement aux entreprises rattachées à votre compte.</p></div><div className="flex gap-2"><Link to="/concierge/entreprises/nouvelle"><Button size="sm"><Plus size={15}/>Ajouter une entreprise</Button></Link><Button variant="outline" size="sm" onClick={()=>void load()}><RefreshCcw size={15}/>Actualiser</Button></div></div>
    {error?<Alert tone="danger" className="mt-5">{error}</Alert>:null}{loading?<p className="mt-5 text-sm text-ink-500">Chargement…</p>:null}
    <div className="concierge-company-roster">{orgs.map(org=><Link key={org.id} to={'/concierge/entreprises/$id' as any} params={{id:org.id} as any} className="block rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"><Card className="concierge-roster-card cursor-pointer transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-md"><div className="concierge-roster-icon"><Building2 size={19}/></div><div className="concierge-roster-main"><div className="concierge-roster-title"><h2>{org.name}</h2><Badge>{org.sector}</Badge>{org.diagnosticStatus?<Badge tone="info">Diagnostic : {org.diagnosticStatus}</Badge>:<Badge tone="neutral">Diagnostic non envoyé</Badge>}{org.restitutionPublished?<Badge tone="success">Rapport publié</Badge>:null}</div><p><MapPin size={13}/>{org.city||'Ville non renseignée'}{org.contactName?` · ${org.contactName}`:''}{org.contactRole?` · ${org.contactRole}`:''}</p><p className="mt-1 text-xs text-ink-500">{org.missionsCount||0} mission(s) · {org.needsCount||0} besoin(s){org.offerStatus?` · offre ${org.offerStatus}`:''}</p></div><span className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700">Ouvrir le suivi <ArrowRight size={15}/></span></Card></Link>)}{!loading&&!orgs.length?<Card className="p-8 text-center"><Building2 className="mx-auto h-7 w-7 text-ink-400"/><h2 className="mt-3 font-semibold text-ink-900">Aucune entreprise dans votre portefeuille</h2><p className="mt-1 text-sm text-ink-500">Ajoutez une entreprise ou demandez une affectation à l’administrateur ALLNEEDS.</p></Card>:null}</div>
  </div></ConciergeGuard>
}
