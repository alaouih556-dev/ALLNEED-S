-- =====================================================================
-- ALLNEEDS — CRM : rôle « agent », invitations CRM et tables v46_crm_*
--
-- À exécuter dans le SQL Editor Supabase AVANT de démarrer le backend
-- qui contient le CRM (backend/crm.mjs).
--
-- GARANTIES : idempotente, aucune donnée existante supprimée.
-- Les tables CRM suivent la convention des collections (id, organization_id,
-- payload jsonb). Le backend n'envoie que les lignes modifiées.
-- =====================================================================

begin;

-- 1. Nouveau rôle « agent » (CRM) et invitations de type « crm »
alter table public.v46_users drop constraint if exists v46_users_role_check;
alter table public.v46_users add constraint v46_users_role_check
  check (role in ('admin','concierge','dirigeant','manager','collaborateur','prestataire','commercial','sales','agent','crm'));

alter table public.v46_invitations drop constraint if exists v46_invitations_kind_check;
alter table public.v46_invitations add constraint v46_invitations_kind_check
  check (kind in ('owner','team','concierge','sales','crm'));

-- 2. Tables CRM
do $$
declare t text;
begin
  foreach t in array array[
    'v46_crm_databases','v46_crm_contacts','v46_crm_calls','v46_crm_appointments',
    'v46_crm_campaigns','v46_crm_zones','v46_crm_activity','v46_crm_imports','v46_crm_settings'
  ] loop
    execute format($ddl$
      create table if not exists public.%I (
        id text primary key,
        organization_id text references public.v46_organizations(id) on delete cascade,
        payload jsonb not null default '{}'::jsonb,
        created_at timestamptz not null default now()
      )
    $ddl$, t);
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from public, anon, authenticated', t);
    execute format('grant all on table public.%I to service_role', t);
  end loop;
end $$;

-- 3. Index utiles aux requêtes et exports directs depuis Supabase
create index if not exists v46_crm_contacts_database_idx on public.v46_crm_contacts ((payload->>'databaseId'));
create index if not exists v46_crm_contacts_agent_idx on public.v46_crm_contacts ((payload->>'agentId'));
create index if not exists v46_crm_contacts_phone_idx on public.v46_crm_contacts ((payload->>'phone'));
create index if not exists v46_crm_calls_contact_idx on public.v46_crm_calls ((payload->>'contactId'));
create index if not exists v46_crm_calls_agent_idx on public.v46_crm_calls ((payload->>'agentId'));
create index if not exists v46_crm_appointments_date_idx on public.v46_crm_appointments ((payload->>'date'));
create index if not exists v46_crm_appointments_agent_idx on public.v46_crm_appointments ((payload->>'agentId'));
create index if not exists v46_crm_activity_user_idx on public.v46_crm_activity ((payload->>'userId'));

commit;
