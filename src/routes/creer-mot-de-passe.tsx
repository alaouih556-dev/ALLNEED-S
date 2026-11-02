import { useEffect, useState } from 'react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { CheckCircle2, Eye, EyeOff, KeyRound } from 'lucide-react'
import { AuthLayout } from '@/components/AuthLayout'
import { Alert, Button, Field, Input } from '@/components/ui'

export const Route=createFileRoute('/creer-mot-de-passe')({
  validateSearch:(search:Record<string,unknown>)=>({token:typeof search.token==='string'?search.token:''}),
  component:CreatePasswordPage,
  head:()=>({meta:[{title:'Créer votre mot de passe — ALLNEEDS'}]}),
})
function CreatePasswordPage(){
  const {token}=Route.useSearch(); const navigate=useNavigate(); const [info,setInfo]=useState<{email:string;name:string;organization:string;expiresAt:string}|null>(null); const [password,setPassword]=useState(''); const [confirm,setConfirm]=useState(''); const [show,setShow]=useState(false); const [error,setError]=useState(''); const [done,setDone]=useState(false); const [busy,setBusy]=useState(false)
  useEffect(()=>{if(!token){setError('Lien incomplet.');return}void(async()=>{try{const r=await fetch(`/api/auth/invitation?token=${encodeURIComponent(token)}`,{cache:'no-store'});const b=await r.json();if(!r.ok)throw new Error(b.error||'Lien invalide');setInfo(b)}catch(e){setError(e instanceof Error?e.message:'Lien invalide') }})()},[token])
  async function submit(e:React.FormEvent){e.preventDefault();setError('');if(password.length<12){setError('Le mot de passe doit contenir au moins 12 caractères.');return}if(password!==confirm){setError('Les deux mots de passe ne correspondent pas.');return}setBusy(true);try{const r=await fetch('/api/auth/setup-password',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify({token,password})});const b=await r.json();if(!r.ok)throw new Error(b.error||'Création impossible');setDone(true)}catch(e){setError(e instanceof Error?e.message:'Création impossible')}finally{setBusy(false)}}
  if(done)return <AuthLayout title="Votre accès est prêt" subtitle="Votre mot de passe a été créé. Vous pouvez maintenant vous connecter avec votre adresse e-mail."><Alert tone="success" title="Compte activé"><CheckCircle2 className="h-4 w-4"/> Votre mot de passe est enregistré.</Alert><Button className="mt-5" fullWidth onClick={()=>void navigate({to:'/connexion'})}>Se connecter</Button></AuthLayout>
  return <AuthLayout title="Créez votre mot de passe" subtitle={info?`${info.organization} · ${info.email}`:'Vérification de votre invitation…'} footer={<Link to="/connexion" className="font-semibold text-brand-700">Retour à la connexion</Link>}>
    {error?<Alert tone="danger">{error}</Alert>:null}
    {info?<form onSubmit={submit} className="space-y-5"><div className="rounded-xl bg-ink-50 p-4 text-sm text-ink-600"><KeyRound className="mb-2 h-5 w-5 text-brand-700"/>Invitation pour <strong>{info.name}</strong>. Ce lien est personnel, temporaire et utilisable une seule fois.</div><Field label="Nouveau mot de passe" required><div className="relative"><Input type={show?'text':'password'} autoComplete="new-password" value={password} onChange={e=>setPassword(e.target.value)} minLength={12} required className="pr-10"/><button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 p-1" onClick={()=>setShow(v=>!v)}>{show?<EyeOff size={17}/>:<Eye size={17}/>}</button></div></Field><Field label="Confirmer le mot de passe" required><Input type={show?'text':'password'} autoComplete="new-password" value={confirm} onChange={e=>setConfirm(e.target.value)} minLength={12} required/></Field><Button type="submit" fullWidth size="lg" disabled={busy}>{busy?'Création…':'Créer mon mot de passe'}</Button></form>:null}
  </AuthLayout>
}
