import { createFileRoute } from '@tanstack/react-router'
import { PageHeader } from '@/components/layouts'
import { useDemo } from '@/store/store'
import { buildNextActions, buildObjectives, resolveSituation, situationLabel } from '@/lib/operational'

export const Route = createFileRoute('/app/parametres')({ component: SettingsPage })

function SettingsPage(){
  const {state,orgId,user,dispatch}=useDemo()
  const org=state.orgs.find(o=>o.id===orgId)
  const objectives=buildObjectives(state,orgId)
  const actions=buildNextActions(state,orgId)
  const needs=state.needs.filter(n=>n.orgId===orgId)
  const missions=state.missions.filter(m=>m.orgId===orgId)
  const diagnostics=state.diagnostics.filter(d=>d.orgId===orgId)
  const documents=state.documents.filter(d=>d.orgId===orgId)
  const threads=state.threads.filter(t=>t.orgId===orgId)
  const candidateIds=new Set(needs.flatMap(n=>n.candidateIds))
  const experts=state.providers.filter(p=>candidateIds.has(p.id))
  const activeMissions=missions.filter(m=>m.status!=='terminee')
  const activeNeeds=needs.filter(n=>!['clos','signe'].includes(n.status))
  const published=diagnostics.filter(d=>d.status==='publie')
  const alerts=state.notifications.filter(n=>!n.read&&n.tone==='warning')
  return <>
    <PageHeader eyebrow="Profil entreprise" title="Votre cockpit d’entreprise." description="Le profil regroupe le contexte, les objectifs, les priorités, les actions, les projets, les preuves et l’historique utiles au pilotage."/>
    <div className="company-cockpit-grid">
      <section><small>IDENTITÉ</small><h2>{org?.name}</h2><p>{org?.kind} · {org?.sector} · {org?.city} · {org?.size}</p></section>
      <section><small>CONTEXTE</small><h2>{situationLabel(resolveSituation(state))}</h2><p>Le contexte adapte la lecture sans créer un parcours rigide séparé.</p></section>
      <section><small>UTILISATEUR</small><h2>{user.name}</h2><p>{user.roleLabel} · vue {state.clientWorkspaceRole}</p></section>
      <section><small>PRIORITÉ</small><h2>{actions[0]?.title ?? 'Aucune action prioritaire'}</h2><p>{actions[0]?.why ?? 'Aucun élément ne nécessite une décision immédiate.'}</p></section>
      <section><small>OBJECTIFS</small><h2>{objectives.length}</h2><p>{objectives.map(o=>o.title).join(' · ')}</p></section>
      <section><small>BESOINS</small><h2>{activeNeeds.length} actifs</h2><p>{needs.length} enregistrés au total</p></section>
      <section><small>PROJETS / MISSIONS</small><h2>{activeMissions.length} actifs</h2><p>{missions.filter(m=>m.status==='terminee').length} terminés</p></section>
      <section><small>DIAGNOSTICS</small><h2>{published.length} publiés</h2><p>{diagnostics.length} diagnostics présents</p></section>
      <section><small>ÉCOSYSTÈME</small><h2>{experts.length} ressources liées</h2><p>Uniquement les experts déjà reliés à vos besoins.</p></section>
      <section><small>DOCUMENTS</small><h2>{documents.filter(d=>d.status==='valide').length}/{documents.length} validés</h2><p>Les pièces restent rattachées aux dossiers concernés.</p></section>
      <section><small>ALERTES</small><h2>{alerts.length}</h2><p>Alertes non lues nécessitant une vérification.</p></section>
      <section><small>HISTORIQUE</small><h2>{threads.length} conversations</h2><p>{state.meetings.filter(m=>m.orgId===orgId).length} rendez-vous enregistrés</p></section>
    </div>
    <section className="workspace-role-selector"><small>EXPÉRIENCE PAR RÔLE · DÉMONSTRATION</small><h2>Afficher uniquement ce qui est utile.</h2><p>Le rôle filtre la navigation et la densité d’information, sans dupliquer tout le produit.</p><div>{(['dirigeant','manager','collaborateur'] as const).map((role)=><button key={role} className={state.clientWorkspaceRole===role?'active':''} onClick={()=>dispatch({type:'CLIENT_WORKSPACE_ROLE_SET',role})}>{role==='dirigeant'?'Dirigeant':role==='manager'?'Manager / responsable':'Collaborateur'}</button>)}</div></section>
  </>
}
