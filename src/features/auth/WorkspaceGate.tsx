import { type ReactNode } from 'react'
import { Link, Navigate, useRouterState } from '@tanstack/react-router'
import { ArrowRight, ClipboardCheck, Lock, LockKeyhole, ShieldCheck } from 'lucide-react'
import { AppShell } from '@/components/layouts'
import { ExpertShell } from '@/components/ExpertWorkspace'
import { Button, Card } from '@/components/ui'
import { useAuth, type AuthUser } from '@/features/auth/AuthContext'
import { blockedModuleForPath, clientModules, isDiagnosticGuardedPath, isSaasRoute, orgSaasActive } from '@/lib/access'
import { useDiagnosticStatus } from '@/features/diagnostic/useDiagnosticStatus'

type Workspace='client'|'admin'|'concierge'|'expert'

export function WorkspaceGate({workspace,children}:{workspace:Workspace;children:ReactNode}){
  const auth=useAuth()
  const realRole=auth.user?.role
  const roleMatches=workspace==='admin'
    ? realRole==='admin'
    : workspace==='concierge'
      ? realRole==='concierge'
      : workspace==='expert'
        ? realRole==='prestataire'
        : ['dirigeant','manager','collaborateur'].includes(realRole||'')

  if(auth.status==='loading') return <GateMessage title="Vérification de votre session" detail="Nous vérifions votre accès avant d’ouvrir cet espace."/>
  if(auth.status!=='authenticated') return <GateMessage title="Connexion requise" detail="Cet espace est protégé et nécessite un compte ALLNEEDS actif."><Link to="/connexion"><Button>Se connecter</Button></Link></GateMessage>
  if(!roleMatches) return <GateMessage title="Accès non autorisé" detail="Votre compte ne possède pas le rôle nécessaire pour cet espace."/>

  if(workspace==='client') return <ClientWorkspaceGate auth={auth}>{children}</ClientWorkspaceGate>

  return workspace==='expert'?<ExpertShell>{children}</ExpertShell>:<AppShell variant={workspace}>{children}</AppShell>
}

function ClientWorkspaceGate({auth,children}:{auth:ReturnType<typeof useAuth>;children:ReactNode}){
  const path=useRouterState({ select: (s) => s.location.pathname })
  const org=auth.user?.organization
  if(!org) return <GateMessage title="Entreprise introuvable" detail="Votre compte n’est rattaché à aucune entreprise active."/>
  if(org.active===false) return <GateMessage title="Compte désactivé" detail="L’accès de votre entreprise a été désactivé par l’administration ALLNEEDS."/>
  if(isSaasRoute(path) && path !== '/app/espace-metier' && !orgSaasActive(org)) return <Navigate to="/app/espace-metier" replace />

  return <AppShell variant="client"><ClientAccessGate org={org} path={path}>{children}</ClientAccessGate></AppShell>
}

/**
 * Garde du parcours : tant que le diagnostic n'est pas terminé, les pages
 * fonctionnelles affichent un écran simple (jamais une déconnexion, jamais un
 * 403 brut, jamais « fonctionnalité désactivée »). Accueil, Diagnostic et
 * Profil restent accessibles.
 */
function ClientAccessGate({org,path,children}:{org:AuthUser['organization'] & {id:string};path:string;children:ReactNode}){
  const { completed, loading, error } = useDiagnosticStatus(org.id)
  const guarded = isDiagnosticGuardedPath(path)

  if(guarded && !completed){
    if(loading) return <GateMessage title="Vérification de votre parcours" detail="Nous vérifions votre diagnostic avant d’ouvrir cette page."/>
    if(error) return <>{children}</>
    return <DiagnosticRequiredGate/>
  }

  const blocked=blockedModuleForPath(path, clientModules(org))
  if(blocked) return <Navigate to="/app" replace />
  return <>{children}</>
}

function DiagnosticRequiredGate(){
  const steps=[
    {title:'Répondez au diagnostic 360°',text:'Une question à la fois, vos réponses sont enregistrées.'},
    {title:'Votre Account Manager l’analyse',text:'Rapport, priorités et recommandations.'},
    {title:'Cet espace s’ouvre',text:'Rapport, offres puis modules de votre accompagnement.'},
  ]
  return (
    <div className="mx-auto max-w-2xl py-8">
      <Card className="overflow-hidden p-0">
        <div className="p-7 text-center sm:p-9">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-700"><Lock className="h-6 w-6"/></span>
          <h1 className="mt-5 font-display text-2xl font-bold text-ink-950">Cet espace s’ouvrira après votre diagnostic</h1>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-ink-600">
            Votre diagnostic permet à ALLNEEDS de configurer un accompagnement adapté à votre établissement. Il ne prend que quelques minutes.
          </p>
        </div>
        <ol className="cl-gate-steps">
          {steps.map((step,index)=>(
            <li key={step.title}>
              <span className="cl-gate-num">{index+1}</span>
              <span><strong>{step.title}</strong><small>{step.text}</small></span>
            </li>
          ))}
        </ol>
        <div className="flex flex-wrap justify-center gap-2 p-6">
          <Link to="/app/diagnostic-auto"><Button size="lg"><ClipboardCheck className="h-4 w-4"/>Faire mon diagnostic <ArrowRight className="h-4 w-4"/></Button></Link>
          <Link to="/app"><Button size="lg" variant="outline">Retour à l’accueil</Button></Link>
        </div>
      </Card>
    </div>
  )
}

export function GateMessage({title,detail,children}:{title:string;detail:string;children?:ReactNode}){
  return <div className="flex min-h-screen items-center justify-center bg-[#f6f9fd] p-5"><Card className="max-w-xl p-8 text-center"><div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-700"><ShieldCheck className="h-6 w-6"/></div><LockKeyhole className="mx-auto mt-4 h-5 w-5 text-ink-400"/><h1 className="mt-3 font-display text-2xl text-ink-950">{title}</h1><p className="mt-3 text-sm leading-relaxed text-ink-600">{detail}</p><div className="mt-6 flex justify-center">{children??<Link to="/"><Button variant="outline">Retour à l’accueil</Button></Link>}</div></Card></div>
}
