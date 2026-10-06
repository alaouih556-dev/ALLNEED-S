import assert from 'node:assert/strict'
import { createServer } from 'vite'
import React from 'react'
import { renderToString } from 'react-dom/server'
import { RouterContextProvider, createMemoryHistory } from '@tanstack/react-router'
const server=await createServer({server:{middlewareMode:true},appType:'custom'})
const memory=new Map([['allneeds.session.v1',JSON.stringify({role:'client',userId:'usr-amina',orgId:'org-amal',email:'a.bennani@al-amal.ma',createdAt:new Date().toISOString()})]])
Object.defineProperty(globalThis,'localStorage',{configurable:true,writable:true,value:{getItem:(key)=>memory.has(key)?memory.get(key):null,setItem:(key,value)=>{memory.set(key,String(value))},removeItem:(key)=>{memory.delete(key)},clear:()=>{memory.clear()},key:()=>null,length:0}})
try{
 const {router}=await server.ssrLoadModule('/src/router.tsx');router.update({history:createMemoryHistory({initialEntries:['/app/tourisme/agence']})});await router.load()
 const {DemoStoreProvider}=await server.ssrLoadModule('/src/store/store.tsx')
 const {Tourism}=await server.ssrLoadModule('/src/features/saas/Tourism.tsx')
 for(const branch of ['hebergement','restauration','activites','transport','agence']){
 const html=renderToString(React.createElement(RouterContextProvider,{router},React.createElement(DemoStoreProvider,null,React.createElement(Tourism,{branch}))))
 assert.ok(html.length>4000);assert.ok(html.includes('Planning central'));assert.ok(html.includes('Tableau de bord'))
 console.log('Rendu React réussi : '+branch)
 }
 const {initialTourism}=await server.ssrLoadModule('/src/features/saas/tourism-model.ts');const data=initialTourism();
 const {RestaurantOperations,AgencyBuilder,SupplierRequests}=await server.ssrLoadModule('/src/features/saas/TourismOperations.tsx');
 for(const props of [{tab:'orders',data:data.restauration,update:()=>{},notify:()=>{}},{tab:'inventory',data:data.restauration,update:()=>{},notify:()=>{}}])assert.ok(renderToString(React.createElement(RestaurantOperations,props)).length>500);
 assert.ok(renderToString(React.createElement(AgencyBuilder,{all:data,setAll:()=>{},notify:()=>{},clientView:false,setClientView:()=>{}})).includes('Ajouter au voyage'));
 assert.ok(renderToString(React.createElement(SupplierRequests,{branch:'hebergement',all:data,setAll:()=>{},notify:()=>{}})).includes('Demandes de l’agence'));
 console.log('Rendu React réussi : commandes, inventaire, constructeur agence et demandes fournisseur.')
}finally{await server.close()}
