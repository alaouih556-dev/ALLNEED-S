import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawn } from 'node:child_process'
import { randomBytes, scrypt as scryptCb } from 'node:crypto'
import { promisify } from 'node:util'
const scrypt=promisify(scryptCb)
const dir=mkdtempSync(join(tmpdir(),'allneeds-backend-'))
const origin='http://127.0.0.1:5176'; const port=8799; const base=`http://127.0.0.1:${port}`
async function passwordHash(password){const salt=randomBytes(16).toString('hex');const hash=await scrypt(password,salt,64);return `scrypt$${salt}$${hash.toString('hex')}`}
const adminPassword='AdminPassword!2026'
const db={users:[{id:'admin',email:'admin@test.ma',role:'admin',orgIds:['*'],name:'Admin',active:true,passwordConfigured:true,passwordHash:await passwordHash(adminPassword),permissions:[]}],orgs:[],diagnostics:[],needs:[],consents:[],registrations:[],invitations:[]}
writeFileSync(join(dir,'db.json'),JSON.stringify(db,null,2))
const child=spawn(process.execPath,['backend/server.mjs'],{cwd:process.cwd(),env:{...process.env,PORT:String(port),ALLNEEDS_DATA_DIR:dir,ALLNEEDS_FRONTEND_ORIGIN:origin,ALLNEEDS_PUBLIC_URL:origin,ALLNEEDS_SESSION_SECRET:'0123456789abcdefghijklmnopqrstuvwxyz-TEST-secret'},stdio:['ignore','pipe','pipe']})
let stderr=''; child.stderr.on('data',d=>stderr+=d)
const sleep=(ms)=>new Promise(r=>setTimeout(r,ms))
async function wait(){for(let i=0;i<50;i++){try{const r=await fetch(`${base}/api/health`);if(r.ok)return}catch{}await sleep(100)}throw new Error(`backend indisponible: ${stderr}`)}
function assert(x,msg){if(!x)throw new Error(msg)}
async function req(path,{method='GET',body,cookie}={}){const r=await fetch(base+path,{method,headers:{Origin:origin,...(body?{'content-type':'application/json'}:{}),...(cookie?{Cookie:cookie}:{})},body:body?JSON.stringify(body):undefined});let data={};try{data=await r.json()}catch{}return {r,data,cookie:r.headers.get('set-cookie')?.split(';')[0]}}
try{
 await wait()
 let x=await req('/api/auth/login',{method:'POST',body:{email:'admin@test.ma',password:adminPassword}});assert(x.r.status===200,'admin login');const adminCookie=x.cookie
 x=await req('/api/registrations',{method:'POST',body:{orgName:'Riad Test',name:'Salma Test',email:'owner@riad.test',sector:'tourisme',city:'Marrakech',workspaceProfile:'hebergement',appointmentDate:'2026-11-02',appointmentSlot:'10:00 – 11:30'}});assert(x.r.status===201,'registration create');const regId=x.data.id
 x=await req(`/api/admin/registrations/${regId}/approve`,{method:'POST',cookie:adminCookie});assert(x.r.status===200,'registration approve');assert(x.data.delivery?.setupUrl,'owner setup link');const orgId=x.data.organization.id
 const ownerToken=new URL(x.data.delivery.setupUrl).searchParams.get('token');x=await req('/api/auth/setup-password',{method:'POST',body:{token:ownerToken,password:'OwnerPassword!2026'}});assert(x.r.status===200,'owner password setup')
 x=await req('/api/auth/login',{method:'POST',body:{email:'owner@riad.test',password:'OwnerPassword!2026'}});assert(x.r.status===200,'owner login');const ownerCookie=x.cookie
 x=await req('/api/team/invitations',{method:'POST',cookie:ownerCookie,body:{name:'Manager Test',email:'manager@riad.test',role:'manager',permissions:['actions','missions','team']}});assert(x.r.status===201,'team invitation');const teamToken=new URL(x.data.delivery.setupUrl).searchParams.get('token')
 x=await req('/api/auth/setup-password',{method:'POST',body:{token:teamToken,password:'ManagerPassword!2026'}});assert(x.r.status===200,'team password setup')
 x=await req(`/api/admin/orgs/${orgId}/access`,{method:'PATCH',cookie:adminCookie,body:{modules:{equipe:true}}});assert(x.r.status===200&&x.data.modules.equipe===true,'equipe module enable')
 x=await req('/api/team',{cookie:ownerCookie});assert(x.r.status===200&&x.data.members.length===1,'team list')
 x=await req('/api/admin/account-managers',{method:'POST',cookie:adminCookie,body:{name:'Concierge Test',email:'concierge@test.ma',sectors:['tourisme'],assignedOrgIds:[orgId]}});assert(x.r.status===201,'concierge invite');const conciergeToken=new URL(x.data.delivery.setupUrl).searchParams.get('token')
 x=await req('/api/auth/setup-password',{method:'POST',body:{token:conciergeToken,password:'ConciergePassword!2026'}});assert(x.r.status===200,'concierge password setup')
 x=await req('/api/auth/login',{method:'POST',body:{email:'concierge@test.ma',password:'ConciergePassword!2026'}});assert(x.r.status===200,'concierge login');const conciergeCookie=x.cookie
 x=await req('/api/account-manager/orgs',{cookie:conciergeCookie});assert(x.r.status===200&&x.data.length===1&&x.data[0].id===orgId,'concierge assigned org access')
 x=await req(`/api/admin/orgs/${orgId}/access`,{method:'PATCH',cookie:adminCookie,body:{saas:{enabled:true,subscriptionActive:true}}});assert(x.r.status===200&&x.data.saas.subscriptionActive===true&&x.data.saas.enabled===true,'saas subscription toggle')
 x=await req(`/api/admin/orgs/${orgId}/access`,{method:'PATCH',cookie:adminCookie,body:{modules:{besoins:false}}});assert(x.r.status===200&&x.data.modules.besoins===false,'module disable')
 x=await req('/api/needs',{cookie:ownerCookie});assert(x.r.status===403&&x.data.code==='ACCESS_DISABLED','module enforced server side')
 x=await req(`/api/admin/orgs/${orgId}/access`,{method:'PATCH',cookie:adminCookie,body:{active:false}});assert(x.r.status===200,'org disable')
 x=await req('/api/auth/login',{method:'POST',body:{email:'owner@riad.test',password:'OwnerPassword!2026'}});assert(x.r.status===403&&x.data.code==='ACCOUNT_DISABLED','disabled org cannot login')
 console.log('OK backend: inscription -> validation -> mot de passe -> équipe -> concierge -> SaaS/modules -> désactivation')
} finally { child.kill('SIGTERM'); rmSync(dir,{recursive:true,force:true}) }
