import { useEffect, useMemo, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { BriefcaseBusiness, Mail, Plus, ShieldCheck, Trash2, UserRound, UsersRound } from 'lucide-react'
import { PageHeader } from '@/components/layouts'
import { Alert, Badge, Button, Field, Input, Modal, Select, Checkbox } from '@/components/ui'
import { useDemo, type ClientTeamMember } from '@/store/store'
import { useAuth } from '@/features/auth/AuthContext'

export const Route = createFileRoute('/app/equipe')({ component: TeamPage })

const accessOptions = [
  { id: 'actions', label: 'Plan d’action', description: 'Consulter les actions et leurs échéances.' },
  { id: 'missions', label: 'Projets & missions', description: 'Suivre les étapes et livrables.' },
  { id: 'documents', label: 'Documents', description: 'Accéder aux pièces utiles au travail.' },
  { id: 'messages', label: 'Messages', description: 'Échanger avec ALLNEEDS.' },
  { id: 'results', label: 'Résultats', description: 'Voir les indicateurs de pilotage.' },
  { id: 'team', label: 'Gestion de l’équipe', description: 'Inviter et gérer les accès des autres salariés.' },
]

type ServerMember={id:string;name:string;email:string;role:'manager'|'collaborateur';active?:boolean;permissions?:string[]}
type PendingInvite={id:string;name:string;email:string;role:'manager'|'collaborateur';permissions?:string[];expiresAt:string;lastEmailStatus?:string;lastEmailAt?:string}

function TeamPage() {
  const auth=useAuth()
  const { state, orgId:demoOrgId, user:demoUser, dispatch } = useDemo()
  const real=auth.status==='authenticated' && ['dirigeant','manager','collaborateur'].includes(auth.user?.role||'')
  const orgId=auth.user?.organization?.id || demoOrgId
  const org = state.orgs.find((item) => item.id === orgId)
  const owners = Array.from(new Set([
    ...state.missions.filter((mission) => mission.orgId === orgId && mission.status !== 'terminee').map((mission) => mission.owner),
    ...state.needs.filter((need) => need.orgId === orgId && !['clos', 'signe'].includes(need.status)).map((need) => need.assignedTo),
  ])).filter(Boolean)
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [jobTitle, setJobTitle] = useState('')
  const [role, setRole] = useState<ClientTeamMember['role']>('collaborateur')
  const [access, setAccess] = useState<string[]>(['actions', 'missions', 'documents', 'messages'])
  const demoMembers = useMemo(() => state.teamMembers.filter((member) => member.orgId === orgId), [state.teamMembers, orgId])
  const [members,setMembers]=useState<ServerMember[]>([])
  const [pending,setPending]=useState<PendingInvite[]>([])
  const [error,setError]=useState('')
  const [info,setInfo]=useState('')
  const canManage = real && auth.user?.role==='dirigeant'

  async function loadTeam(){if(!real)return;setError('');try{const r=await fetch('/api/team',{credentials:'same-origin',cache:'no-store'});const b=await r.json();if(!r.ok)throw new Error(b.error||'Chargement impossible');setMembers(b.members||[]);setPending(b.pending||[])}catch(e){setError(e instanceof Error?e.message:'Chargement impossible')}}
  useEffect(()=>{void loadTeam()},[real,auth.user?.id])

  const selectRole = (nextRole: ClientTeamMember['role']) => { setRole(nextRole); setAccess(nextRole === 'manager' ? accessOptions.map((option) => option.id) : ['actions', 'missions', 'documents', 'messages']) }
  async function submit(){if(!name.trim()||!email.includes('@'))return;setError('');setInfo('');if(!real){setError('Connectez-vous avec le compte réel du dirigeant pour envoyer une invitation par e-mail. Le mode démonstration ne crée plus de faux accès.');return}try{const r=await fetch('/api/team/invitations',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify({name:name.trim(),email:email.trim(),role,permissions:access,jobTitle:jobTitle.trim()})});const b=await r.json();if(!r.ok)throw new Error(b.error||'Invitation impossible');if(!b.delivery?.sent)throw new Error(`Le compte a été préparé mais l’e-mail n’a pas pu être envoyé${b.delivery?.error?` : ${b.delivery.error}`:''}. Vérifiez la configuration SMTP.`);setInfo(`Invitation envoyée automatiquement à ${email.trim()}.`);await loadTeam()}catch(e){setError(e instanceof Error?e.message:'Invitation impossible');return}setOpen(false);setName('');setEmail('');setJobTitle('');setRole('collaborateur');setAccess(['actions','missions','documents','messages'])}
  async function updateMember(id:string,patch:Record<string,unknown>){if(!real)return;const r=await fetch(`/api/team/${id}`,{method:'PATCH',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify(patch)});const b=await r.json();if(!r.ok){setError(b.error||'Modification impossible');return}await loadTeam()}
  async function removeMember(id:string){if(!real){setError('Action disponible uniquement avec un compte réel.');return}const r=await fetch(`/api/team/${id}`,{method:'DELETE',credentials:'same-origin'});const b=await r.json();if(!r.ok){setError(b.error||'Suppression impossible');return}await loadTeam()}

  async function resendInvite(id:string){setError('');setInfo('');const r=await fetch(`/api/team/invitations/${id}`,{method:'POST',credentials:'same-origin'});const b=await r.json();if(!r.ok||!b.delivery?.sent){setError(b.error||b.delivery?.error||'Renvoi impossible');return}setInfo('Invitation renvoyée par e-mail.');await loadTeam()}
  async function cancelInvite(id:string){setError('');const r=await fetch(`/api/team/invitations/${id}`,{method:'DELETE',credentials:'same-origin'});const b=await r.json();if(!r.ok){setError(b.error||'Annulation impossible');return}await loadTeam()}

  const shownCount=real?members.length+pending.length:demoMembers.length
  const ownerName=auth.user?.name||demoUser.name; const ownerEmail=auth.user?.email||demoUser.email; const initials=ownerName.split(/\s+/).map(x=>x[0]).slice(0,2).join('').toUpperCase()
  return <>
    <PageHeader eyebrow="Équipe" title="Donnez à chacun l’accès utile à son rôle." description="Le dirigeant reste maître des comptes de son équipe et peut retirer un accès à tout moment." actions={canManage?<Button onClick={() => setOpen(true)}><Plus size={16}/> Ajouter un salarié</Button>:undefined} />
    {!real?<Alert tone="warning" className="mb-4">Connectez-vous avec le compte dirigeant pour gérer les accès de l’équipe.</Alert>:null}{error?<Alert tone="danger" className="mb-4">{error}</Alert>:null}{info?<Alert tone="success" className="mb-4">{info}</Alert>:null}
    <section className="team-access-intro"><div className="team-access-mark"><ShieldCheck size={21}/></div><div><strong>Le dirigeant garde la maîtrise</strong><p>Chaque salarié possède son propre e-mail et son propre mot de passe. La désactivation d’un salarié ne touche pas les autres comptes.</p></div><span>{shownCount} accès ajouté{shownCount > 1 ? 's' : ''}</span></section>
    <div className="team-access-layout">
      <section className="team-access-list"><div className="team-section-heading"><div><h2>Personnes de l’établissement</h2><p>Comptes séparés, rattachés uniquement à cette entreprise.</p></div></div>
        <article className="team-access-person is-director"><span className="team-person-avatar">{initials}</span><div className="team-person-main"><strong>{ownerName}</strong><span>{ownerEmail}</span><small>{org?.contactRole ?? 'Dirigeant'} · accès propriétaire</small></div><Badge tone="brand">Dirigeant</Badge></article>
        {real ? <>{members.map(member=><article className="team-access-person" key={member.id}><span className="team-person-avatar is-member"><UserRound size={19}/></span><div className="team-person-main"><strong>{member.name}</strong><span>{member.email}</span><small>{(member.permissions||[]).length} rubrique(s) autorisée(s)</small></div><div className="team-person-controls"><Badge tone={member.active===false?'danger':'success'}>{member.active===false?'Désactivé':'Actif'}</Badge>{canManage?<><Select value={member.role} onChange={e=>void updateMember(member.id,{role:e.target.value})}><option value="collaborateur">Collaborateur</option><option value="manager">Responsable</option></Select><Button variant="ghost" size="sm" onClick={()=>void updateMember(member.id,{active:member.active===false})}>{member.active===false?'Réactiver':'Désactiver'}</Button><Button variant="ghost" size="sm" onClick={()=>void removeMember(member.id)}><Trash2 size={15}/> Supprimer</Button></>:null}</div></article>)}{pending.map(inv=><article className="team-access-person" key={inv.id}><span className="team-person-avatar is-member"><Mail size={19}/></span><div className="team-person-main"><strong>{inv.name}</strong><span>{inv.email}</span><small>Invitation valable jusqu’au {new Date(inv.expiresAt).toLocaleString('fr-FR')} · e-mail {inv.lastEmailStatus==='sent'?'envoyé':inv.lastEmailStatus==='failed'?'en échec':'en attente'}</small></div><div className="team-person-controls"><Badge tone={inv.lastEmailStatus==='failed'?'danger':'warning'}>Invitation en attente</Badge>{canManage?<><Button variant="ghost" size="sm" onClick={()=>void resendInvite(inv.id)}>Renvoyer</Button><Button variant="ghost" size="sm" onClick={()=>void cancelInvite(inv.id)}><Trash2 size={15}/> Annuler</Button></>:null}</div></article>)}</> : demoMembers.map(member=><article className="team-access-person" key={member.id}><span className="team-person-avatar is-member"><UserRound size={19}/></span><div className="team-person-main"><strong>{member.name}</strong><span>{member.email}</span><small>{member.jobTitle||'Salarié'} · {member.access.length} rubrique(s)</small></div><div className="team-person-controls"><Badge tone={member.status==='actif'?'success':'warning'}>{member.status==='actif'?'Actif':'Invitation en attente'}</Badge><Select value={member.role} onChange={e=>dispatch({type:'TEAM_MEMBER_ROLE_SET',id:member.id,role:e.target.value as ClientTeamMember['role']})}><option value="collaborateur">Collaborateur</option><option value="manager">Responsable</option></Select><Button variant="ghost" size="sm" onClick={()=>void removeMember(member.id)}><Trash2 size={15}/> Retirer</Button></div></article>)}
        {!shownCount?<div className="team-access-empty"><UsersRound size={22}/><div><strong>Aucun salarié n’a encore accès à cet espace.</strong><p>Ajoutez une première personne sans partager le compte dirigeant.</p></div>{canManage?<Button size="sm" variant="outline" onClick={()=>setOpen(true)}><Plus size={15}/> Ajouter un salarié</Button>:null}</div>:null}
      </section>
      <aside className="team-access-side"><h2>Choisissez le bon niveau</h2><article><span className="role-icon"><UserRound size={19}/></span><div><strong>Dirigeant</strong><p>Vision globale et maîtrise des accès de l’établissement.</p></div></article><article><span className="role-icon secondary"><BriefcaseBusiness size={19}/></span><div><strong>Responsable</strong><p>Suit les actions, missions et indicateurs autorisés.</p></div></article><article><span className="role-icon secondary"><UsersRound size={19}/></span><div><strong>Collaborateur</strong><p>Accède uniquement aux rubriques nécessaires.</p></div></article><div className="team-access-note"><Mail size={16}/><p><strong>Invitation sécurisée</strong><br/>Le salarié reçoit un lien temporaire et crée lui-même son mot de passe. Le dirigeant ne connaît pas son mot de passe final.</p></div></aside>
    </div>
    {owners.length ? <details className="team-existing-owners"><summary>Responsables déjà affectés à des dossiers <span>{owners.length}</span></summary><div>{owners.map((owner) => <span key={owner}><BriefcaseBusiness size={15}/>{owner}</span>)}</div></details> : null}
    <Modal open={open} onClose={() => setOpen(false)} title="Ajouter un salarié" description="Créez son invitation et choisissez les rubriques qu’il pourra consulter." size="lg"><div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2"><Field label="Nom et prénom" required><Input autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex. Sara El Mansouri"/></Field><Field label="Adresse e-mail professionnelle" required><Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="sara@entreprise.ma"/></Field></div>
      <div className="grid gap-4 sm:grid-cols-2"><Field label="Fonction"><Input value={jobTitle} onChange={(event) => setJobTitle(event.target.value)} placeholder="Ex. Responsable administratif"/></Field><Field label="Rôle dans ALLNEEDS"><Select value={role} onChange={(event) => selectRole(event.target.value as ClientTeamMember['role'])}><option value="collaborateur">Collaborateur</option><option value="manager">Responsable</option></Select></Field></div>
      <fieldset className="space-y-3"><legend className="mb-1 text-sm font-semibold text-ink-900">Rubriques autorisées</legend>{accessOptions.map((option) => <Checkbox key={option.id} label={option.label} description={option.description} checked={access.includes(option.id)} onChange={(event) => setAccess((current) => event.target.checked ? [...new Set([...current, option.id])] : current.filter((item) => item !== option.id))}/>)}</fieldset>
      <p className="rounded-xl bg-ink-50 p-3 text-xs leading-relaxed text-ink-600">Après création, le salarié reçoit automatiquement un e-mail avec un lien personnel et temporaire pour définir son mot de passe.</p>
      <div className="flex justify-end gap-2 border-t border-ink-100 pt-4"><Button variant="ghost" onClick={() => setOpen(false)}>Annuler</Button><Button onClick={()=>void submit()} disabled={!name.trim() || !email.includes('@')}>Envoyer l’invitation</Button></div>
    </div></Modal>
  </>
}
