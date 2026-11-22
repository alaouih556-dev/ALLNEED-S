import {useEffect,useMemo,useState} from 'react';
import {ArrowRight,Building2,CheckCircle2,ClipboardCheck,FileText,Send,ShieldAlert,Stethoscope,Target,TrendingUp,UsersRound} from 'lucide-react';
import {computeDiagnostic} from '@/lib/diagnostic360';
import type { DiagnosticQuestion } from './diagnosticData';
import { PACKS, type SectorKey, type SectorPack } from './packs';

type Answer={score:number;comment:string;completed:boolean};
type Charge={supplier:string;annual:string;renewal:string;notice:string;compared:string;saving:string};
type Follow={deadline:string;action:string;indicator:string;owner:string;status:string;date:string};
type Adequation={score:number;comment:string};
type DiagnosticState={
 meta:{structure:string;date:string;contact:string;animator:string;decider:string;citySize:string;accepted:boolean;started:boolean;format:'Complet'|'Express ★';consentAt:string;consentBy:string;consentVersion:string};
 answers:Record<string,Answer>;
 charges:Record<string,Charge>;
 roots:string[]; solutions:string[]; checks:string[]; decisions:string; reportDate:string; nextMeeting:string;
 follow:Follow[]; recheck:{initial:string;j90:string;gain:string}[];
 adequation:Record<string,Adequation>; adequationNext:string; satisfaction:string;
};

const PLACEHOLDER_STRUCTURE='Centre Atlas Santé';
const empty=(sectorKey: SectorKey,defaults:{structure?:string;contact?:string}={}):DiagnosticState=>({
 meta:{structure:defaults.structure||'',date:new Date().toISOString().slice(0,10),contact:defaults.contact||'',animator:'',decider:'',citySize:'Casablanca · ',accepted:false,started:false,format:'Complet',consentAt:'',consentBy:'',consentVersion:''},
 answers:Object.fromEntries(PACKS[sectorKey].questions.map(q=>[q.id,{score:0,comment:'',completed:false}])),
 charges:Object.fromEntries(PACKS[sectorKey].chargesPostes.map(x=>[x,{supplier:'',annual:'',renewal:'',notice:'',compared:'',saving:''}])),
 roots:['','',''],solutions:['','',''],checks:['','',''],decisions:'',reportDate:'',nextMeeting:'',
 follow:['J+30','J+30','J+60','J+60','J+90','J+90'].map(deadline=>({deadline,action:'',indicator:'',owner:'',status:'',date:''})),
 recheck:[0,1,2].map(()=>({initial:'',j90:'',gain:''})),
 adequation:Object.fromEntries(PACKS[sectorKey].adequationCriteria.map(x=>[x,{score:0,comment:''}])),adequationNext:'',satisfaction:''
});
function load(sectorKey: SectorKey,defaults:{structure?:string;contact?:string}={}){try{const v=JSON.parse(localStorage.getItem('allneeds.diagnostic360.v51.'+sectorKey)||'null');if(!v||!v.meta||!v.answers)return empty(sectorKey,defaults);const base=empty(sectorKey,defaults);const answers=Object.fromEntries(PACKS[sectorKey].questions.map(q=>{const old=v.answers[q.id]||base.answers[q.id];return[q.id,{...base.answers[q.id],...old,completed:old.completed??old.score>0}]}));const structure=!v.meta.structure||v.meta.structure===PLACEHOLDER_STRUCTURE?base.meta.structure:v.meta.structure;const contact=v.meta.contact||base.meta.contact;return{...base,...v,meta:{...base.meta,...v.meta,structure,contact,format:'Complet'},answers}}catch{return empty(sectorKey,defaults)}}
const fmt=(n:number)=>Number.isFinite(n)?Math.round(n*10)/10:0;

export function Diagnostic360({sector='sante', audience='client', readOnly=false, onCompleted, organizationName, contactName}: {sector?: SectorKey; audience?: 'client'|'staff'; readOnly?: boolean; onCompleted?: () => void; organizationName?: string; contactName?: string}){
 const pack = PACKS[sector] as SectorPack;
 const STAFF = audience==='staff';
 const STORAGE_KEY = 'allneeds.diagnostic360.v51.'+sector;
 const [data,setData]=useState<DiagnosticState>(()=>load(sector as SectorKey,{structure:organizationName,contact:contactName})),[tab,setTab]=useState<'cadre'|'questions'|'synthese'|'suivi'|'adequation'>('cadre'),[questionIndex,setQuestionIndex]=useState<number|null>(null);
 const [saveError,setSaveError]=useState('');
 const persist=(next:DiagnosticState)=>{setData(next);if(!readOnly)localStorage.setItem(STORAGE_KEY,JSON.stringify(next))};
 const updateMeta=(k:keyof DiagnosticState['meta'],v:any)=>{if(readOnly)return;persist({...data,meta:{...data.meta,[k]:v}})};
 const setAnswer=(id:string,k:'score'|'comment',v:string|number)=>{if(readOnly)return;const answer=data.answers[id];const updated:Answer=k==='score'?{...answer,score:Number(v)}:{...answer,comment:String(v)};persist({...data,answers:{...data.answers,[id]:updated}})};
 const visibleQuestions=pack.questions;
 const answeredCount=visibleQuestions.filter(q=>(data.answers[q.id]?.score||0)>0).length;
 const questionsTotal=visibleQuestions.length;
 const treatedCount=visibleQuestions.filter(q=>data.answers[q.id]?.completed).length;
 const currentQuestionIndex=questionIndex??Math.max(0,visibleQuestions.findIndex(q=>!data.answers[q.id]?.completed));
 const currentQuestion=visibleQuestions[currentQuestionIndex];
 const questionsComplete=questionsTotal>0&&treatedCount===questionsTotal;
 const currentVoletId=currentQuestion?Number(currentQuestion.id[0]):1;
 const axeQuestions=visibleQuestions.filter(q=>Number(q.id[0])===currentVoletId);
 const axeTreated=axeQuestions.filter(q=>data.answers[q.id]?.completed).length;
 const axeTotal=axeQuestions.length;
 const revealQuestion=()=>document.querySelector('.question-flow')?.scrollIntoView({behavior:'smooth',block:'start'});
 const continueQuestion=()=>{if(readOnly||!currentQuestion)return;const next={...data,answers:{...data.answers,[currentQuestion.id]:{...data.answers[currentQuestion.id],completed:true}}};try{persist(next)}catch{setSaveError('Enregistrement impossible pour le moment. Vérifiez votre navigateur puis réessayez.');return}setSaveError('');if(currentQuestionIndex<questionsTotal-1){setQuestionIndex(currentQuestionIndex+1);revealQuestion()}else if(STAFF)setTab('synthese');else onCompleted?.()};
 const previousQuestion=()=>{setQuestionIndex(Math.max(0,currentQuestionIndex-1));revealQuestion()};
 const startDiagnostic=()=>{if(readOnly||!data.meta.accepted||!data.meta.consentAt)return;persist({...data,meta:{...data.meta,started:true}});setTab('questions')};
 useEffect(()=>{
  if(!data.meta.started&&tab!=='cadre') setTab('cadre');
  if(!STAFF&&['synthese','suivi','adequation'].includes(tab)) setTab(data.meta.started?'questions':'cadre');
  if(STAFF&&data.meta.started&&!questionsComplete&&['synthese','suivi','adequation'].includes(tab)) setTab('questions');
 },[data.meta.started,questionsComplete,tab,STAFF]);
 const stats=useMemo(()=>computeDiagnostic(data.answers,data.meta.format.startsWith('Express')?'Express':'Complet'),[data.answers,data.meta.format]);
 const adequationScore=pack.adequationCriteria.reduce((a,c)=>a+(data.adequation[c]?.score||0),0);
 const recommendation=adequationScore>=9?'PERFORMANCE ou PRO.':adequationScore>=6?'PRO, ou PRO puis Accès.':adequationScore>=3?'Accès CONNECT ou PLUS pour les besoins détectés.':'Restituer le diagnostic, garder le contact, aucune offre proposée.';
 const allTabs=[['cadre','Cadre lu'],['questions',`${questionsTotal} questions`],['synthese','Synthèse'],['suivi','Suivi J+30 / 60 / 90'],['adequation','Adéquation ALLNEEDS']] as const;
 const availableTabs=STAFF?allTabs:allTabs.filter(([id])=>id==='cadre'||id==='questions');
 const visibleTabs=!data.meta.started?availableTabs.filter(([id])=>id==='cadre'):questionsComplete?availableTabs:availableTabs.filter(([id])=>id==='cadre'||id==='questions');
 return <section className="diag360">
  <div className="diag-hero"><div><span className="eyebrow">DIAGNOSTIC 360° · {pack.labelUpper}</span><h2>Repérons ensemble vos priorités.</h2><p>Un premier échange ciblé pour comprendre votre situation et décider de la suite avec votre Account Manager.</p>{data.meta.structure?<span className="dg-hero-chip"><Building2 size={14}/>{data.meta.structure}</span>:null}</div>{data.meta.started?<div className="diag-summary"><strong>{treatedCount}/{questionsTotal}</strong><span>questions parcourues</span><small>Enregistré automatiquement</small></div>:<div className="dg-hero-facts"><span><b>{questionsTotal}</b>questions</span><span><b>{pack.volets.length}</b>axes</span><span><b>≈ 2 h 15</b>au total</span></div>}</div>
  {data.meta.started?<><div className="diag-progress-head"><strong>{questionsComplete?'Diagnostic prêt pour la synthèse':`Diagnostic en cours · ${treatedCount}/${questionsTotal} questions parcourues`}</strong><span>{questionsComplete?'Vous pouvez désormais relire vos réponses et transmettre votre diagnostic.':'Vous pouvez revenir à une question précédente. Votre progression est enregistrée automatiquement.'}</span></div><div className="diag-tabs">{visibleTabs.map(([id,label])=><button key={id} disabled={readOnly} className={tab===id?'active':''} onClick={()=>setTab(id)}>{id==='questions'?`${treatedCount}/${questionsTotal} · Questions`:label}</button>)}</div></>:null}

  {tab==='cadre'&&<div className="dg-intro">
   <div className="dg-col">
    <section className="dg-card">
     <header className="dg-card-head"><span className="dg-step">1</span><div><h3>Qui participe ?</h3><p>Ces informations préparent l’échange avec votre Account Manager.</p></div></header>
     <div className="dg-fields">
      <label><span>Votre établissement</span><input disabled={readOnly} value={data.meta.structure} placeholder="Nom de l’établissement" onChange={e=>updateMeta('structure',e.target.value)}/></label>
      <label><span>Votre nom et fonction</span><input disabled={readOnly} value={data.meta.contact} placeholder="Ex. : Prénom Nom, direction" onChange={e=>updateMeta('contact',e.target.value)}/></label>
     </div>
    </section>
    <section className="dg-card">
     <header className="dg-card-head"><span className="dg-step">2</span><div><h3>À préparer <em>(facultatif)</em></h3><p>Quelques documents non nominatifs peuvent faciliter l’échange. Vous pouvez aussi commencer sans eux.</p></div></header>
     <ul className="dg-docs">{pack.documents.map(x=><li key={x}><FileText size={14}/>{x}</li>)}</ul>
     <p className="dg-note"><ShieldAlert size={14}/>Aucune donnée nominative de patient, d’élève ou de voyageur n’est nécessaire. Le diagnostic ne remplace pas un avis professionnel spécialisé.</p>
    </section>
    <section className="dg-card dg-start">
     <header className="dg-card-head"><span className="dg-step">3</span><div><h3>{data.meta.started?'Reprendre le questionnaire':'Confirmer et commencer'}</h3><p>Répondez à votre rythme, une question après l’autre. Vos réponses sont enregistrées dans ce navigateur.</p></div></header>
     <label className={`dg-consent ${data.meta.accepted?'is-checked':''}`}><input type="checkbox" disabled={readOnly} checked={data.meta.accepted} onChange={e=>{const on=e.target.checked;persist({...data,meta:{...data.meta,accepted:on,consentAt:on?new Date().toISOString():'',consentBy:on?(data.meta.decider||data.meta.contact||'décideur'):'',consentVersion:on?'grille-360-v5.1':''}})}}/><span>J’ai compris le cadre de cet échange et je confirme pouvoir commencer le diagnostic.</span></label>
     <div className="dg-start-row">
      <button type="button" className="dg-primary" disabled={!(data.meta.accepted&&Boolean(data.meta.consentAt)&&!readOnly)} onClick={startDiagnostic}>{data.meta.started?'Reprendre le questionnaire':'Commencer le diagnostic'}<ArrowRight size={16}/></button>
      {!data.meta.accepted&&!readOnly?<span className="dg-hint">Cochez la case ci-dessus pour commencer.</span>:null}
     </div>
    </section>
   </div>
   <aside className="dg-col">
    <section className="dg-card">
     <h3 className="dg-aside-title">Comment ça se passe</h3>
     <ol className="dg-flow">
      <li><span><ClipboardCheck size={16}/></span><div><strong>Vous répondez</strong><small>{questionsTotal} questions réparties en {pack.volets.length} axes. Vous pouvez faire des pauses.</small></div></li>
      <li><span><Send size={16}/></span><div><strong>Vous envoyez</strong><small>Relisez la synthèse puis transmettez-la à ALLNEEDS.</small></div></li>
      <li><span><Stethoscope size={16}/></span><div><strong>Votre Account Manager analyse</strong><small>Rapport, priorités et recommandations publiés dans votre espace.</small></div></li>
     </ol>
     <ul className="dg-axes">{pack.volets.map(v=><li key={v.id}><b>{v.id}</b>{v.title}</li>)}</ul>
    </section>
    <section className="dg-card dg-card-soft">
     <small className="dg-kicker">SI UN APPROFONDISSEMENT EST UTILE</small>
     <p className="dg-soft-title">Le diagnostic complet sera proposé par votre Account Manager après cet échange.</p>
     <p className="dg-soft-text">Il représente environ 6 h 45 sur plusieurs séances. Vous recevrez d’abord le périmètre, le calendrier et le tarif. Rien ne commence sans votre accord.</p>
    </section>
   </aside>
  </div>}

   {tab==='questions'&&currentQuestion&&<div className="question-flow">
     <div className="question-flow-progress"><div><span>Axe {currentVoletId}/{pack.volets.length} · Question {currentQuestionIndex+1} sur {questionsTotal}</span><strong>{treatedCount} parcourue{treatedCount>1?'s':''} · {answeredCount} notée{answeredCount>1?'s':''}</strong></div><div className="question-progress-track" role="progressbar" aria-label="Progression globale du questionnaire" aria-valuemin={0} aria-valuemax={questionsTotal} aria-valuenow={treatedCount}><span style={{width:`${questionsTotal?treatedCount/questionsTotal*100:0}%`}}/></div><div className="question-progress-track" role="progressbar" aria-label="Progression de l’axe en cours" aria-valuemin={0} aria-valuemax={axeTotal} aria-valuenow={axeTreated}><span style={{width:`${axeTotal?axeTreated/axeTotal*100:0}%`}}/></div><small>Axe {currentVoletId} · {pack.volets.find(v=>v.id===currentVoletId)?.title} — {axeTreated}/{axeTotal} répondues dans cet axe</small></div>
     <QuestionCard q={currentQuestion} a={data.answers[currentQuestion.id]} onChange={setAnswer} readOnly={readOnly} staff={STAFF}/>
     {questionsComplete&&<div className="question-flow-complete"><CheckCircle2 size={18}/> Toutes les questions ont été parcourues. {answeredCount<questionsTotal?`${questionsTotal-answeredCount} point${questionsTotal-answeredCount>1?'s':''} sans note ${questionsTotal-answeredCount>1?'seront exclus':'sera exclu'} du calcul.`:'Vous pouvez passer à la synthèse.'}</div>}
     <div className="question-flow-footer">
       {saveError?<p className="question-flow-error" role="alert">{saveError}</p>:null}
       <div className="question-flow-controls"><button className="question-back" onClick={previousQuestion} disabled={currentQuestionIndex===0}>← Précédent</button><span>Enregistré automatiquement</span><button className="question-next" onClick={continueQuestion} disabled={readOnly}>{currentQuestionIndex===questionsTotal-1?'Terminer':'Suivant'} <span aria-hidden="true">→</span></button></div>
     </div>
   </div>}

  {tab==='synthese'&&<div className="diag-stack">
   <section className="diag-card"><div className="diag-card-title"><TrendingUp/><div><h3>Report global des notes</h3><p>Reporter ici les {questionsTotal} notes pour classer : meilleures notes internes (forces), plus hauts scores de priorité (difficultés), écarts pondérés externes les plus élevés (opportunités, menaces).</p></div></div><div className="diag-table-wrap"><table className="diag-table"><thead><tr><th>Volet</th><th>Interne /35</th><th>Externe /15</th><th>Indice de maîtrise</th><th>Couverture</th><th>N° notés 0</th><th>Conclusif ?</th></tr></thead><tbody>{stats.byVolet.map(s=><tr key={s.id}><td>{s.id} · {pack.volets.find(v=>v.id===s.id)?.title||''}</td><td>{s.internal.total} / 35</td><td>{s.external.total} / 15</td><td>{fmt((s.internal.total+s.external.total)/(5*(s.internal.coverage+s.external.coverage||1))*100)} %</td><td>{s.internal.coverage+s.external.coverage} / {s.internal.pool+s.external.pool}</td><td>{s.internal.zeros+s.external.zeros}</td><td>{s.conclusive?'oui':'non'}</td></tr>)}<tr className="total-row"><td><b>Total</b></td><td><b>{stats.byVolet.reduce((a,s)=>a+s.internal.total,0)} / {stats.byVolet.reduce((a,s)=>a+s.internal.max,0)}</b></td><td><b>{stats.byVolet.reduce((a,s)=>a+s.external.total,0)} / {stats.byVolet.reduce((a,s)=>a+s.external.max,0)}</b></td><td>—</td><td>{stats.byVolet.reduce((a,s)=>a+s.internal.coverage+s.external.coverage,0)} / {questionsTotal}</td><td>{stats.byVolet.reduce((a,s)=>a+s.internal.zeros+s.external.zeros,0)}</td><td>—</td></tr></tbody></table></div></section>
   <section className="diag-card"><div className="diag-card-title"><CheckCircle2/><div><h3>Synthèse du diagnostic</h3><p>À remplir en séance de synthèse globale, à partir du report des {questionsTotal} notes.</p></div></div><SynthesisBlock title="Forces (3)" help="Les 3 questions internes les mieux notées (4 ou 5), avec un exemple ou un chiffre cité. À note égale, retenir le poids le plus élevé. Si moins de 3, compléter avec les atouts externes notés 4 ou 5." items={stats.forces.map(x=>`${x.q.id} · ${x.q.title} — ${x.s}/5`)}/><SynthesisBlock title="Faiblesses (3)" help="Les 3 questions internes les moins bien notées (1 ou 2). À note égale, retenir le poids le plus élevé." items={stats.weaknesses.map(x=>`${x.q.id} · ${x.q.title} — ${x.s}/5`)}/><SynthesisBlock title="Opportunités (3)" help="Parmi les questions externes à type « Opportunité » notées 1 à 3, les 3 qui ont le plus fort écart pondéré (5 − note) × enjeu." items={stats.opportunities.map(x=>`${x.q.id} · ${x.q.title} — écart ${x.gap}`)}/><SynthesisBlock title="Menaces (3)" help="Parmi les questions externes à type « Menace » notées 1 à 3, les 3 qui ont le plus fort écart pondéré (5 − note) × enjeu. Note 1–2 : exposition forte. Note 3 : à surveiller." items={stats.threats.map(x=>`${x.q.id} · ${x.q.title} — écart ${x.gap}`)}/>
    <div className="synthesis-edit"><h4>Difficultés prioritaires (3) et causes racines</h4><p>Les 3 plus hauts scores de priorité parmi les questions internes : (5 − note) × poids. Pour chacune, poser 5 « pourquoi » en s’aidant de l’observation terrain et noter la cause racine avant toute solution.</p>{stats.priorities.map((x,i)=><label key={x.q.id}><b>{i+1}. Difficulté : {x.q.id} · {x.q.title} — score {x.priority}</b><textarea placeholder="Cause racine" value={data.roots[i]||''} onChange={e=>{const a=[...data.roots];a[i]=e.target.value;persist({...data,roots:a})}}/></label>)}</div>
    <div className="synthesis-edit"><h4>Points à vérifier</h4><p>Notes dont le commentaire signale un doute, un chiffre non vu ou un document manquant. Pour chacune : élément à fournir et date limite (15 jours).</p>{data.checks.map((x,i)=><textarea key={i} placeholder={`${i+1}. Élément à fournir + date limite`} value={x} onChange={e=>{const a=[...data.checks];a[i]=e.target.value;persist({...data,checks:a})}}/>)}</div>
    <div className="synthesis-edit"><h4>Solutions recommandées (3)</h4><p>Une solution par cause racine, appuyée si possible sur une force ou une opportunité. Pour chacune : action, responsable, délai, offre ALLNEEDS (STARTER, PRO, PERFORMANCE, Accès) ou « aucune offre nécessaire ». Les besoins d’achat (questions Accès notées 1 à 3, échéances &lt; 12 mois) alimentent l’offre Accès.</p>{data.solutions.map((x,i)=><textarea key={i} placeholder={`${i+1}. Action · Resp. · Délai · Offre`} value={x} onChange={e=>{const a=[...data.solutions];a[i]=e.target.value;persist({...data,solutions:a})}}/>)}</div>
    <div className="diag-form-grid"><label>Décisions et suites convenues<textarea value={data.decisions} onChange={e=>persist({...data,decisions:e.target.value})}/></label><label>Compte-rendu sous 48 h le<input type="date" value={data.reportDate} onChange={e=>persist({...data,reportDate:e.target.value})}/></label><label>Prochain rendez-vous le<input type="date" value={data.nextMeeting} onChange={e=>persist({...data,nextMeeting:e.target.value})}/></label></div>
   </section>
   <section className="diag-card"><div className="diag-card-title"><FileText/><div><h3>Charges récurrentes : relevé</h3><p>À remplir avec les factures. Chaque échéance de renouvellement dans les 12 mois est un besoin potentiel pour ALLNEEDS Accès. Le client reste libre de comparer ailleurs.</p></div></div><div className="diag-table-wrap"><table className="diag-table editable"><thead><tr><th>Poste</th><th>Fournisseur actuel</th><th>Coût annuel HT</th><th>Échéance</th><th>Date limite de préavis</th><th>Comparé ?</th><th>Économie visée</th></tr></thead><tbody>{pack.chargesPostes.map((p:string)=><tr key={p}><td>{p}</td>{(['supplier','annual','renewal','notice','compared','saving'] as const).map(k=><td key={k}><input value={data.charges[p][k]} onChange={e=>persist({...data,charges:{...data.charges,[p]:{...data.charges[p],[k]:e.target.value}}})}/></td>)}</tr>)}</tbody></table></div></section>
  </div>}

  {tab==='suivi'&&<div className="diag-stack"><section className="diag-card"><div className="diag-card-title"><UsersRound/><div><h3>Plan de suivi : J+30 · J+60 · J+90</h3><p>Le diagnostic ne s’arrête pas à la restitution. Chaque action retenue est suivie avec un indicateur « avant → après ». À J+90, les 3 difficultés prioritaires sont re-notées avec les mêmes repères.</p></div></div><div className="follow-grid">{data.follow.map((f,i)=><div className="follow-row" key={i}><b>{f.deadline}</b><input placeholder="Action suivie" value={f.action} onChange={e=>{const a=[...data.follow];a[i]={...f,action:e.target.value};persist({...data,follow:a})}}/><input placeholder="Indicateur (avant → après)" value={f.indicator} onChange={e=>{const a=[...data.follow];a[i]={...f,indicator:e.target.value};persist({...data,follow:a})}}/><input placeholder="Responsable" value={f.owner} onChange={e=>{const a=[...data.follow];a[i]={...f,owner:e.target.value};persist({...data,follow:a})}}/><select value={f.status} onChange={e=>{const a=[...data.follow];a[i]={...f,status:e.target.value};persist({...data,follow:a})}}><option value="">Statut</option><option>fait</option><option>en cours</option><option>bloqué</option></select><input type="date" value={f.date} onChange={e=>{const a=[...data.follow];a[i]={...f,date:e.target.value};persist({...data,follow:a})}}/></div>)}</div><h4>Re-notation à J+90</h4>{data.recheck.map((r,i)=><div className="recheck" key={i}><b>Difficulté {i+1}</b><input placeholder="Note initiale" value={r.initial} onChange={e=>{const a=[...data.recheck];a[i]={...r,initial:e.target.value};persist({...data,recheck:a})}}/><input placeholder="Note à J+90" value={r.j90} onChange={e=>{const a=[...data.recheck];a[i]={...r,j90:e.target.value};persist({...data,recheck:a})}}/><input placeholder="Économie ou gain chiffré" value={r.gain} onChange={e=>{const a=[...data.recheck];a[i]={...r,gain:e.target.value};persist({...data,recheck:a})}}/></div>)}</section></div>}

  {tab==='adequation'&&<div className="diag-stack">
   <section className="diag-card">
    <div className="diag-card-title"><Target/><div><h3>Fiche d’adéquation avec l’accompagnement ALLNEEDS</h3><p>Partagée avec le client. Notez chaque critère : 0 = non, 1 = partiellement, 2 = oui. Cette fiche explique pourquoi une formule est recommandée, ou pourquoi aucune ne l’est.</p></div></div>
    <div className="adequation-list">{pack.adequationCriteria.map((c:any)=>{
      const a=data.adequation[c];
      return <div key={c}>
       <strong>{c}</strong>
       <select value={a.score} onChange={e=>persist({...data,adequation:{...data.adequation,[c]:{...a,score:Number(e.target.value)}}})}>
        <option value={0}>0 · non</option><option value={1}>1 · partiellement</option><option value={2}>2 · oui</option>
       </select>
       <input placeholder="Commentaire" value={a.comment} onChange={e=>persist({...data,adequation:{...data.adequation,[c]:{...a,comment:e.target.value}}})}/>
      </div>
    })}</div>
    <div className="score-matrix"><div><b>9 à 12</b><span>PERFORMANCE ou PRO.</span></div><div><b>6 à 8</b><span>PRO, ou PRO puis Accès.</span></div><div><b>3 à 5</b><span>Accès CONNECT ou PLUS pour les besoins détectés.</span></div><div><b>0 à 2</b><span>Restituer le diagnostic, garder le contact, aucune offre proposée.</span></div></div><p className="adequation-options">Recommandation : STARTER seul · PRO · PERFORMANCE · Accès (niveau) · aucune</p><div className="recommendation"><span>Score total</span><strong>{adequationScore} / 12</strong><p>{recommendation}</p><small>Repères à ajuster après les 10 premiers diagnostics. Une recommandation « aucune offre » est un résultat valide du diagnostic.</small></div>
    <div className="diag-form-grid"><label>Recommandation<input value={recommendation} readOnly/></label><label>Prochain rendez-vous / relance (date)<input type="date" value={data.adequationNext} onChange={e=>persist({...data,adequationNext:e.target.value})}/></label><label>Note de satisfaction du client (0 à 10)<input type="number" min="0" max="10" value={data.satisfaction} onChange={e=>persist({...data,satisfaction:e.target.value})}/></label></div>
   </section>
   <section className="diag-card"><div className="diag-card-title"><FileText/><div><h3>Journal des versions</h3><p>Référentiel de travail intégré sans modification de contenu.</p></div></div><div className="diag-table-wrap"><table className="diag-table"><thead><tr><th>Version</th><th>Date</th><th>Changements</th><th>Responsable</th></tr></thead><tbody>{pack.versions.map(r=><tr key={r[0]}>{(r as any).map((c:any)=><td key={c}>{c}</td>)}</tr>)}</tbody></table></div></section>
  </div>}
 </section>
}

function QuestionCard({q,a,onChange,readOnly=false,staff=false}:{q:DiagnosticQuestion;a:Answer;onChange:(id:string,k:'score'|'comment',v:string|number)=>void;readOnly?:boolean;staff?:boolean}){
 const score=a?.score||0;
 return <article className={`question-card question-card-guided ${q.besoinAcces?'access-need':''}`}>
  <div className="question-top question-top-guided">
   <span className="qid">{q.id}</span>
   <div><div className="question-title-row"><h3>{q.title}</h3>{q.pending&&<span className="question-express">Contenu à valider</span>}{q.besoinAcces&&<b className="access-chip">Besoin de prestataire</b>}</div><p>{q.question}</p></div>
  </div>
  <fieldset className="answer-options" disabled={readOnly}><legend>Quelle situation décrit le mieux votre établissement ?</legend>
   <div className="answer-options-grid">
    <button type="button" disabled={readOnly} aria-pressed={score===0} className={score===0?'selected':''} onClick={()=>onChange(q.id,'score',0)}><span className="answer-number">—</span><span><strong>Je ne sais pas encore</strong><small>À vérifier plus tard, sans note</small></span>{score===0&&<span className="answer-check">✓</span>}</button>
    {q.levels.map((label,i)=><button type="button" disabled={readOnly} aria-pressed={score===i+1} className={score===i+1?'selected':''} key={i} onClick={()=>onChange(q.id,'score',i+1)}><span className="answer-number">{i+1}</span><span><strong>{label}</strong></span>{score===i+1&&<span className="answer-check">✓</span>}</button>)}
   </div>
  </fieldset>
  <details className="question-extra"><summary>Ajouter un exemple ou voir l’aide à la discussion <span>(facultatif)</span></summary>
   <label className="question-comment">Un exemple concret, un chiffre ou un document observé<textarea disabled={readOnly} placeholder="Ex. : nombre de demandes reçues, facture consultée, situation vécue…" value={a?.comment||''} onChange={e=>onChange(q.id,'comment',e.target.value)}/></label>
   <p className="question-relance"><strong>Pour approfondir :</strong> {q.relance}</p>
   {staff?<details className="question-scoring"><summary>Repère de notation interne</summary><p>{q.internal?`Poids ${q.weight} · écart de priorité ${(5-score)*(q.weight||0)}`:`${q.type} · enjeu ${q.enjeu} · écart pondéré ${(5-score)*(q.enjeu||0)}`}. Cette indication sert à préparer la synthèse.</p></details>:null}
  </details>
 </article>
}
function SynthesisBlock({title,help,items}:{title:string;help:string;items:string[]}){return <div className="synthesis-block"><div><h4>{title}</h4><p>{help}</p></div><ol>{[0,1,2].map(i=><li key={i}>{items[i]||'—'}</li>)}</ol></div>}
