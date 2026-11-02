import { useEffect, useState } from 'react'
import { Building2, RefreshCcw, UsersRound } from 'lucide-react'
import { AdminClientAccess } from '@/components/AdminClientAccess'
import { AdminClientDataControl } from '@/components/AdminClientDataControl'
import { AdminClientDocuments } from '@/components/AdminClientDocuments'
import { Alert, Badge, Button, Card, CardBody, CardHeader } from '@/components/ui'

type User={id:string;name:string;email:string;role:string;active?:boolean;passwordConfigured?:boolean}
type Org={id:string;name:string;sector:string;slug:string;active:boolean;modules:Record<string,boolean>;users:User[]}

export function AdminRealClients(){
  const [items,setItems]=useState<Org[]>([]); const [error,setError]=useState(''); const [loading,setLoading]=useState(true)
  async function load(){setLoading(true);setError('');try{const r=await fetch('/api/admin/orgs',{credentials:'same-origin',cache:'no-store'});const b=await r.json();if(!r.ok)throw new Error(b.error||'Chargement impossible');setItems(b)}catch(e){setError(e instanceof Error?e.message:'Chargement impossible')}finally{setLoading(false)}}
  useEffect(()=>{void load()},[])
  return <div className="container-app space-y-6 py-7">
    <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.14em] text-brand-700">Administration · comptes réels</p><h1 className="mt-1 text-2xl font-bold text-ink-950">Clients & accès</h1><p className="mt-1 text-sm text-ink-600">Chaque entreprise est isolée. Activez le compte global ou chaque module séparément.</p></div><Button variant="outline" size="sm" onClick={()=>void load()}><RefreshCcw size={15}/>Actualiser</Button></div>
    {error?<Alert tone="danger">{error}</Alert>:null}{loading?<p className="text-sm text-ink-500">Chargement…</p>:null}
    <div className="grid gap-5 xl:grid-cols-2">{items.map(org=><Card key={org.id} className="overflow-hidden"><CardHeader title={org.name} description={`${org.sector} · /${org.slug}`} action={<Badge tone={org.active?'success':'danger'}>{org.active?'Compte actif':'Compte désactivé'}</Badge>}/><CardBody className="space-y-4"><div className="flex items-center gap-2 text-sm text-ink-700"><Building2 size={16}/><strong>{org.name}</strong></div><div className="rounded-xl bg-ink-50 p-3"><div className="mb-2 flex items-center gap-2 text-xs font-semibold text-ink-700"><UsersRound size={14}/>Utilisateurs liés</div>{org.users.length?org.users.map(u=><div key={u.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-ink-100 py-2 first:border-t-0"><div><p className="text-sm font-medium text-ink-900">{u.name}</p><p className="text-xs text-ink-500">{u.email} · {u.role}</p></div><div className="flex gap-1"><Badge tone={u.active===false?'danger':'success'}>{u.active===false?'Désactivé':'Actif'}</Badge><Badge tone={u.passwordConfigured?'success':'warning'}>{u.passwordConfigured?'Mot de passe créé':'Activation en attente'}</Badge></div></div>):<p className="text-xs text-ink-500">Aucun utilisateur actif pour cette entreprise.</p>}</div><AdminClientAccess orgId={org.id}/><AdminClientDataControl orgId={org.id} onDeleted={()=>void load()}/><AdminClientDocuments orgId={org.id}/></CardBody></Card>)}</div>
    {!loading&&!items.length?<Card className="p-8 text-center text-sm text-ink-500">Aucune entreprise réelle enregistrée.</Card>:null}
  </div>
}
