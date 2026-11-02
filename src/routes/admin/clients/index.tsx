import { createFileRoute } from '@tanstack/react-router'
import { AdminRealClients } from '@/components/AdminRealClients'
export const Route=createFileRoute('/admin/clients/')({component:AdminRealClients,head:()=>({meta:[{title:'Clients — ALLNEEDS'}]})})
