import { useEffect, useState } from 'react'
import { Alert, Button, Card, CardBody, CardHeader, Checkbox, Field, Input } from '@/components/ui'
import { useAuth } from '@/features/auth/AuthContext'
import { ACCESS_PLANS, ACCESS_PLAN_KEYS, modulesFromPlan, type AccessPlan } from '@/lib/access'

type SaasState = { subscriptionActive:boolean; enabled:boolean; startDate:string|null; endDate:string|null; plan:string|null }
type AccessState = { id:string; name:string; slug:string; active:boolean; plan:string|null; modules:Record<string,boolean>; saas:SaasState }
const EMPTY_SAAS: SaasState = { subscriptionActive:false, enabled:false, startDate:null, endDate:null, plan:null }
const MODULES: Array<[string,string]> = [
  ['diagnostic','Diagnostic'],['besoins','Besoins'],['missions','Missions'],['rendezVous','Rendez-vous'],['documents','Documents'],['messages','Messages'],['equipe','Équipe'],['results','Résultats'],['notifications','Notifications'],['devis','Devis'],['prestataires','Prestataires'],['abonnement','Abonnement'],
]

export function AdminClientAccess({ orgId }: { orgId:string }) {
  const auth = useAuth()
  const [data,setData]=useState<AccessState|null>(null)
  const [error,setError]=useState('')
  const [busy,setBusy]=useState(false)
  useEffect(()=>{ if(auth.status!=='authenticated'||auth.user?.role!=='admin') return; void (async()=>{try{const r=await fetch(`/api/admin/orgs/${encodeURIComponent(orgId)}/access`,{credentials:'same-origin',cache:'no-store'});if(!r.ok)throw new Error((await r.json().catch(()=>({}))).error||'Accès indisponible');const json=await r.json();setData({...json,saas:{...EMPTY_SAAS,...(json.saas||{})}})}catch(e){setError(e instanceof Error?e.message:'Accès indisponible')}})() },[auth.status,auth.user?.role,orgId])
  async function save(next:AccessState){setBusy(true);setError('');try{const r=await fetch(`/api/admin/orgs/${encodeURIComponent(orgId)}/access`,{method:'PATCH',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify({active:next.active,plan:next.plan,modules:next.modules,saas:next.saas})});if(!r.ok)throw new Error((await r.json().catch(()=>({}))).error||'Modification refusée');const result=await r.json();setData({...next,...result,saas:{...EMPTY_SAAS,...(result.saas||next.saas||{})}})}catch(e){setError(e instanceof Error?e.message:'Modification refusée')}finally{setBusy(false)}}
  if(auth.status!=='authenticated'||auth.user?.role!=='admin') return null
  const plan = (data?.plan ?? null) as AccessPlan | null
  return <div className="space-y-5">
    <Card>
      <CardHeader title="Accès & fonctionnalités" description="Contrôle séparé du compte et de chaque module pour cette entreprise."/>
      <CardBody className="space-y-4">
        {error?<Alert tone="warning">{error}</Alert>:null}
        {!data&&!error?<p className="text-sm text-ink-500">Chargement des accès…</p>:null}
        {data?<>
          <div className="rounded-xl border border-ink-100 p-4"><Checkbox label="Compte client actif" description="Si désactivé, tous les utilisateurs de cette entreprise sont bloqués, même avec un mot de passe valide." checked={data.active} onChange={(e)=>void save({...data,active:e.target.checked})}/></div>
          <div className="rounded-xl border border-ink-100 p-4">
            <p className="text-sm font-semibold text-ink-900">Plan d'accompagnement</p>
            <p className="mt-0.5 text-xs text-ink-500">Le plan préremplit les modules métier. Le SaaS n'est jamais inclus dans un plan. Vous restez libre d'activer ou désactiver chaque module ci-dessous.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {ACCESS_PLAN_KEYS.map((key)=><Button key={key} size="sm" variant={plan===key?'primary':'outline'} disabled={busy} onClick={()=>void save({...data,plan:key,modules:modulesFromPlan(key)})}>{ACCESS_PLANS[key].label}</Button>)}
            </div>
            <p className="mt-2 text-xs text-ink-500">{plan?ACCESS_PLANS[plan].description:'Aucun plan défini — configuration libre.'}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">{MODULES.map(([key,label])=><div key={key} className="rounded-xl border border-ink-100 p-3"><Checkbox label={label} checked={data.modules[key]!==false} onChange={(e)=>void save({...data,modules:{...data.modules,[key]:e.target.checked}})}/></div>)}</div>
          <p className="text-xs text-ink-500">Lien entreprise : <strong>/{data.slug}</strong>. Le lien ne remplace pas l’authentification : e-mail, mot de passe, statut et permissions restent vérifiés côté serveur.</p>
          <Button size="sm" variant="outline" disabled={busy} onClick={()=>void save(data)}>{busy?'Enregistrement…':'Enregistrer les accès'}</Button>
        </>:null}
      </CardBody>
    </Card>

    {data?<Card className="border-amber-200">
      <CardHeader title="SaaS — abonnement & activation" description="Le SaaS a son propre abonnement et sa propre activation. Il reste séparé du compte, du plan et des modules."/>
      <CardBody className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-ink-100 p-3"><Checkbox label="Abonnement SaaS actif" checked={data.saas.subscriptionActive} onChange={(e)=>void save({...data,saas:{...data.saas,subscriptionActive:e.target.checked}})}/></div>
          <div className="rounded-xl border border-ink-100 p-3"><Checkbox label="Activation SaaS (ON/OFF)" checked={data.saas.enabled} onChange={(e)=>void save({...data,saas:{...data.saas,enabled:e.target.checked}})}/></div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Date de début"><Input type="date" value={data.saas.startDate??''} onChange={(e)=>void save({...data,saas:{...data.saas,startDate:e.target.value||null}})}/></Field>
          <Field label="Date de fin (si applicable)"><Input type="date" value={data.saas.endDate??''} onChange={(e)=>void save({...data,saas:{...data.saas,endDate:e.target.value||null}})}/></Field>
        </div>
        <Field label="Type / formule SaaS" hint="Ex. Santé, Tourisme, Enseignement, formules spécifiques."><Input value={data.saas.plan??''} placeholder="Formule SaaS" onChange={(e)=>void save({...data,saas:{...data.saas,plan:e.target.value||null}})}/></Field>
        <Alert tone={data.saas.subscriptionActive&&data.saas.enabled?'success':'info'}>{data.saas.subscriptionActive&&data.saas.enabled?'SaaS visible côté client (abonnement actif + activation ON).':'SaaS invisible côté client tant que l’abonnement et l’activation ne sont pas tous deux validés.'}</Alert>
        <p className="text-xs text-ink-500">Désactiver le SaaS ne désactive ni le compte, ni les modules, ni la session du client.</p>
      </CardBody>
    </Card>:null}
  </div>
}
