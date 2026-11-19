import { useEffect, useState } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { ArrowRight, BadgeCheck, Briefcase, Building2, ClipboardCheck, MapPin, Plus, RefreshCcw } from 'lucide-react'
import { EmptyBox, Initial, LoadingRows, MiniStat, Panel, Rows, SearchBox, StatGrid, matches } from '@/components/admin-kit'
import { ConciergeGuard, ConciergeHeading } from '@/features/concierge/ScopedSection'
import { Alert, Badge, Button } from '@/components/ui'
import { useAuth } from '@/features/auth/AuthContext'

export const Route = createFileRoute('/concierge/entreprises/')({ component: ConciergeCompanies })
type Org={id:string;name:string;sector:string;city?:string;contactName?:string;contactRole?:string;diagnosticStatus?:string|null;restitutionPublished?:boolean;offerStatus?:string|null;missionsCount?:number;needsCount?:number}

function ConciergeCompanies() {
  const auth=useAuth(); const [orgs,setOrgs]=useState<Org[]>([]); const [error,setError]=useState(''); const [loading,setLoading]=useState(true)
  async function load(){setLoading(true);setError('');try{const r=await fetch('/api/concierge/orgs',{credentials:'same-origin',cache:'no-store'});const b=await r.json();if(!r.ok)throw new Error(b.error||'Chargement impossible');setOrgs(b)}catch(e){setError(e instanceof Error?e.message:'Chargement impossible')}finally{setLoading(false)}}
  useEffect(()=>{if(auth.status==='authenticated')void load()},[auth.status,auth.user?.id])
  const [query, setQuery] = useState('')
  const visible = orgs.filter((o) => matches(query, o.name, o.city, o.contactName))
  const withDiagnostic = orgs.filter((o) => o.diagnosticStatus).length
  const published = orgs.filter((o) => o.restitutionPublished).length
  const missions = orgs.reduce((n, o) => n + (o.missionsCount || 0), 0)
  return <ConciergeGuard><div>
    <ConciergeHeading eyebrow="Portefeuille" title="Entreprises suivies" description="Les entreprises rattachées à votre compte. Ouvrez une fiche pour suivre son diagnostic, ses besoins et ses missions." actions={<><Link to="/concierge/entreprises/nouvelle"><Button size="sm"><Plus size={14}/>Ajouter une entreprise</Button></Link><Button variant="outline" size="sm" onClick={()=>void load()}><RefreshCcw size={14}/>Actualiser</Button></>}/>
    <StatGrid>
      <MiniStat icon={<Building2 size={18}/>} tone="indigo" label="Entreprises" value={loading?'–':orgs.length}/>
      <MiniStat icon={<ClipboardCheck size={18}/>} tone="amber" label="Diagnostic envoyé" value={loading?'–':withDiagnostic} hint={`sur ${orgs.length}`} ratio={orgs.length?withDiagnostic/orgs.length:0}/>
      <MiniStat icon={<BadgeCheck size={18}/>} tone="emerald" label="Restitution publiée" value={loading?'–':published} ratio={orgs.length?published/orgs.length:0}/>
      <MiniStat icon={<Briefcase size={18}/>} tone="sky" label="Missions" value={loading?'–':missions}/>
    </StatGrid>
    {error?<Alert tone="danger" className="mb-5">{error}</Alert>:null}
    <Panel title="Votre portefeuille" description={`${visible.length} entreprise(s)`} action={<SearchBox value={query} onChange={setQuery} placeholder="Nom, ville, contact…"/>}>
      {loading?<LoadingRows/>:null}
      {!loading&&!orgs.length?<EmptyBox icon={<Building2 size={20}/>} title="Aucune entreprise dans votre portefeuille" text="Ajoutez une entreprise ou demandez une affectation à l’administrateur ALLNEEDS." action={<Link to="/concierge/entreprises/nouvelle"><Button size="sm"><Plus size={14}/>Ajouter une entreprise</Button></Link>}/>:null}
      {!loading&&orgs.length>0&&!visible.length?<EmptyBox icon={<Building2 size={20}/>} title="Aucun résultat" text="Essayez un autre nom, une autre ville ou un autre contact."/>:null}
      <Rows>{visible.map(org=><li key={org.id}><Link to={'/concierge/entreprises/$id' as any} params={{id:org.id} as any} className="cg-org-row">
        <Initial name={org.name} tone="indigo"/>
        <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-ink-950">{org.name}</span><span className="flex items-center gap-1 truncate text-xs text-ink-500"><MapPin size={12}/>{org.city||'Ville non renseignée'}{org.contactName?` · ${org.contactName}`:''}{org.contactRole?` · ${org.contactRole}`:''}</span></span>
        <span className="hidden text-xs text-ink-500 lg:block">{org.needsCount||0} besoin(s) · {org.missionsCount||0} mission(s)</span>
        {org.restitutionPublished?<Badge tone="success">Rapport publié</Badge>:org.diagnosticStatus?<Badge tone="info">Diagnostic : {org.diagnosticStatus}</Badge>:<Badge tone="neutral">Diagnostic non envoyé</Badge>}
        <ArrowRight size={15} className="text-ink-300"/>
      </Link></li>)}</Rows>
    </Panel>
  </div></ConciergeGuard>
}
