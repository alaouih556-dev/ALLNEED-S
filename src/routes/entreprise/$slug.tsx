import { useEffect, useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { Building2, LockKeyhole } from 'lucide-react'
import { AuthLayout } from '@/components/AuthLayout'
import { Alert, Button, Card } from '@/components/ui'

export const Route=createFileRoute('/entreprise/$slug')({component:CompanyAccessPage})
function CompanyAccessPage(){
  const {slug}=Route.useParams(); const [org,setOrg]=useState<{name:string;sector:string;active:boolean}|null>(null); const [error,setError]=useState('')
  useEffect(()=>{void(async()=>{try{const r=await fetch(`/api/organizations/by-slug/${encodeURIComponent(slug)}`,{cache:'no-store'});const b=await r.json();if(!r.ok)throw new Error(b.error||'Entreprise introuvable');setOrg(b)}catch(e){setError(e instanceof Error?e.message:'Entreprise introuvable')}})()},[slug])
  return <AuthLayout title={org?`Accès ${org.name}`:'Accès entreprise'} subtitle="Utilisez votre compte personnel ALLNEEDS pour entrer dans l’espace de votre entreprise.">
    {error?<Alert tone="danger">{error}</Alert>:null}
    {org?<Card className="p-5"><div className="flex items-start gap-3"><span className="rounded-xl bg-brand-50 p-2 text-brand-700"><Building2 size={20}/></span><div><p className="font-semibold text-ink-950">{org.name}</p><p className="mt-1 text-sm text-ink-500">Secteur : {org.sector}</p></div></div>{org.active?<Link to="/connexion" className="mt-5 block"><Button fullWidth><LockKeyhole size={16}/>Se connecter</Button></Link>:<Alert tone="warning" className="mt-5">L’accès de cette entreprise est actuellement désactivé.</Alert>}<p className="mt-4 text-xs leading-relaxed text-ink-500">Ce lien identifie l’entreprise mais ne donne aucun accès à lui seul. L’e-mail, le mot de passe, le statut du compte et les permissions sont vérifiés côté serveur.</p></Card>:null}
  </AuthLayout>
}
