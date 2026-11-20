import { useEffect, useState } from 'react'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { ArrowRight, Eye, EyeOff } from 'lucide-react'
import { AuthLayout } from '@/components/AuthLayout'
import { Alert, Button, Field, Input } from '@/components/ui'
import { useAuth, workspacePathForRole } from '@/features/auth/AuthContext'
import { useDemo } from '@/store/store'

export const Route = createFileRoute('/connexion')({ component: ConnexionPage, head: () => ({ meta: [{ title: 'Connexion — ALLNEEDS' }] }) })

function ConnexionPage() {
  const navigate = useNavigate(); const auth = useAuth(); const { setRole, dispatch } = useDemo()
  const [email,setEmail]=useState(''); const [password,setPassword]=useState(''); const [show,setShow]=useState(false); const [error,setError]=useState(''); const [busy,setBusy]=useState(false)
  // Déjà connecté (session valide après un rafraîchissement) : on rouvre directement l’espace.
  const sessionDestination = auth.status==='authenticated' ? workspacePathForRole(auth.user?.role) : null
  useEffect(()=>{ if(sessionDestination&&!busy) void navigate({to:sessionDestination,replace:true}) },[sessionDestination,busy,navigate])
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setError(''); setBusy(true)
    try {
      const account=await auth.login(email,password)
      const destination=workspacePathForRole(account.role)
      if(!destination) throw new Error('Ce rôle ne dispose pas encore d’un espace autorisé.')
      if(account.role==='sales'||account.role==='agent'||account.role==='crm'){ await navigate({to:destination as any}); return }
      const appRole=account.role==='admin'?'admin':account.role==='concierge'?'concierge':'client'
      dispatch({type:'RESET'}); setRole(appRole); dispatch({type:'SWITCH_USER',userId:account.id})
      if(appRole==='client') dispatch({type:'CLIENT_WORKSPACE_ROLE_SET',role:account.role==='manager'?'manager':account.role==='collaborateur'?'collaborateur':'dirigeant'})
      await navigate({to:destination})
    } catch(cause){setError(cause instanceof Error?cause.message:'La connexion a échoué.')} finally{setBusy(false)}
  }
  return <AuthLayout title="Entrez dans l’espace ALLNEEDS" subtitle="Connectez-vous avec le compte activé par ALLNEEDS ou par le dirigeant de votre entreprise." footer={<>Pas encore de compte client ? <Link to="/inscription" className="font-semibold text-brand-700">Faire une demande</Link></>}>
    <form onSubmit={submit} className="space-y-5">
      <Field label="Adresse e-mail" required><Input type="email" autoComplete="username" value={email} onChange={e=>setEmail(e.target.value)} placeholder="vous@entreprise.ma" required/></Field>
      <Field label="Mot de passe" required><div className="relative"><Input type={show?'text':'password'} autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} className="pr-10" required/><button type="button" onClick={()=>setShow(v=>!v)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-ink-400 hover:bg-ink-100" aria-label={show?'Masquer':'Afficher'}>{show?<EyeOff className="h-4 w-4"/>:<Eye className="h-4 w-4"/>}</button></div></Field>
      {error?<Alert tone="danger">{error}</Alert>:null}
      <Button type="submit" size="lg" fullWidth disabled={busy}>{busy?'Vérification…':'Se connecter'} <ArrowRight className="h-4 w-4"/></Button>
    </form>
  </AuthLayout>
}
