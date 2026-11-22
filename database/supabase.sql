-- =====================================================================
-- ALLNEEDS V46 — SCHÉMA SUPABASE CANONIQUE (fresh install)
-- Convention : préfixe v46_* — identique à backend/server.mjs (COLLECTION_TABLES).
--
-- MISE EN CONFORMITÉ (mismatch résolu) :
--   L'ancienne version de ce fichier créait des tables SANS préfixe
--   (organizations, users, ...), alors que le backend lit/écrit des tables
--   v46_* (v46_organizations, v46_users, ...). Le backend étant déjà adapté
--   à v46_* en production, ce fichier adopte désormais la convention v46_*.
--
-- Le frontend n'a aucun accès direct aux tables. Le backend utilise
-- exclusivement SUPABASE_SERVICE_ROLE_KEY.
--
-- Idempotent et non destructif : ré-exécutable, aucun DROP de table métier.
-- Pour une base EXISTANTE, préférez database/migrations/2026-10-10-01-parcours-v46.sql
-- =====================================================================

begin;
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Tables relationnelles "cœur"
-- ---------------------------------------------------------------------

create table if not exists public.v46_organizations (
  id text primary key,
  name text not null,
  slug text not null unique,
  sector text not null check (sector in ('sante','enseignement','tourisme')),
  active boolean not null default true,
  modules jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.v46_users (
  id text primary key,
  organization_id text references public.v46_organizations(id) on delete cascade,
  email text not null,
  name text not null default '',
  role text not null check (role in ('admin','concierge','dirigeant','manager','collaborateur','prestataire','commercial','sales','agent','crm','staff')),
  active boolean not null default true,
  password_hash text,
  password_configured boolean not null default false,
  permissions jsonb not null default '[]'::jsonb,
  sectors text[] not null default '{}',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists v46_users_email_ci_unique on public.v46_users(lower(email));
create index if not exists v46_users_org_idx on public.v46_users(organization_id);
create index if not exists v46_users_role_idx on public.v46_users(role);

create table if not exists public.v46_concierge_organizations (
  id text primary key,
  concierge_user_id text not null references public.v46_users(id) on delete cascade,
  organization_id text not null references public.v46_organizations(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(concierge_user_id, organization_id)
);
create index if not exists v46_concierge_org_user_idx on public.v46_concierge_organizations(concierge_user_id);
create index if not exists v46_concierge_org_org_idx on public.v46_concierge_organizations(organization_id);

create table if not exists public.v46_invitations (
  id text primary key,
  organization_id text references public.v46_organizations(id) on delete cascade,
  email text not null,
  name text not null default '',
  role text not null,
  permissions jsonb not null default '[]'::jsonb,
  kind text not null check (kind in ('owner','team','concierge','sales','crm','staff')),
  invitation_metadata jsonb not null default '{}'::jsonb,
  token_hash text not null unique,
  created_by text,
  created_at timestamptz not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  revoked_at timestamptz,
  last_email_at timestamptz,
  last_email_status text,
  last_email_error text,
  metadata jsonb not null default '{}'::jsonb
);
create index if not exists v46_invitations_org_idx on public.v46_invitations(organization_id);
create index if not exists v46_invitations_email_idx on public.v46_invitations(lower(email));
create index if not exists v46_invitations_token_idx on public.v46_invitations(token_hash);

-- ---------------------------------------------------------------------
-- Tables de collection génériques (id, organization_id, payload)
-- Dont les nouvelles tables du parcours 7 étapes.
-- ---------------------------------------------------------------------

do $$
declare t text;
begin
  foreach t in array array[
    'v46_registrations','v46_diagnostics','v46_diagnostic_consents','v46_needs',
    'v46_missions','v46_offers','v46_documents','v46_messages','v46_appointments','v46_quotes',
    'v46_notifications','v46_needs_subscriptions','v46_saas_subscriptions','v46_conversations',
    'v46_crm_databases','v46_crm_contacts','v46_crm_calls','v46_crm_appointments','v46_crm_campaigns','v46_crm_zones','v46_crm_activity','v46_crm_imports','v46_crm_settings'
  ] loop
    execute format($ddl$
      create table if not exists public.%I (
        id text primary key,
        organization_id text references public.v46_organizations(id) on delete cascade,
        payload jsonb not null default '{}'::jsonb,
        created_at timestamptz not null default now()
      )
    $ddl$, t);
    execute format('create index if not exists %I on public.%I(organization_id)', t || '_org_idx', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- CRM : Index utiles aux requêtes et exports directs depuis Supabase
create index if not exists v46_crm_contacts_database_idx on public.v46_crm_contacts ((payload->>'databaseId'));
create index if not exists v46_crm_contacts_agent_idx on public.v46_crm_contacts ((payload->>'agentId'));
create index if not exists v46_crm_contacts_phone_idx on public.v46_crm_contacts ((payload->>'phone'));
create index if not exists v46_crm_calls_contact_idx on public.v46_crm_calls ((payload->>'contactId'));
create index if not exists v46_crm_calls_agent_idx on public.v46_crm_calls ((payload->>'agentId'));
create index if not exists v46_crm_appointments_date_idx on public.v46_crm_appointments ((payload->>'date'));
create index if not exists v46_crm_appointments_agent_idx on public.v46_crm_appointments ((payload->>'agentId'));
create index if not exists v46_crm_activity_user_idx on public.v46_crm_activity ((payload->>'userId'));


-- ---------------------------------------------------------------------
-- Trigger updated_at
-- ---------------------------------------------------------------------

create or replace function public.allneeds_set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists v46_organizations_updated_at on public.v46_organizations;
create trigger v46_organizations_updated_at before update on public.v46_organizations for each row execute function public.allneeds_set_updated_at();

drop trigger if exists v46_users_updated_at on public.v46_users;
create trigger v46_users_updated_at before update on public.v46_users for each row execute function public.allneeds_set_updated_at();

-- ---------------------------------------------------------------------
-- Organisation interne : tâches, stratégies marketing, permissions
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['v46_org_tasks','v46_org_strategies','v46_org_settings'] loop
    execute format('create table if not exists public.%I (
      id text primary key,
      organization_id text,
      payload jsonb not null default ''{}''::jsonb,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )', t);
    execute format('drop trigger if exists %I on public.%I', t || '_updated_at', t);
    execute format('create trigger %I before update on public.%I for each row execute function public.allneeds_set_updated_at()', t || '_updated_at', t);
  end loop;
end $$;
create index if not exists v46_org_tasks_team_idx on public.v46_org_tasks ((payload->>'teamId'));
create index if not exists v46_org_tasks_assignee_idx on public.v46_org_tasks ((payload->>'assigneeId'));

-- ---------------------------------------------------------------------
-- RLS + service_role uniquement
-- ---------------------------------------------------------------------

do $$
declare t text;
begin
  foreach t in array array[
    'v46_organizations','v46_users','v46_concierge_organizations','v46_invitations',
    'v46_registrations','v46_diagnostics','v46_diagnostic_consents','v46_needs',
    'v46_missions','v46_offers','v46_documents','v46_messages','v46_appointments','v46_quotes',
    'v46_notifications','v46_needs_subscriptions','v46_saas_subscriptions','v46_conversations',
    'v46_org_tasks','v46_org_strategies','v46_org_settings',
    'v46_crm_databases','v46_crm_contacts','v46_crm_calls','v46_crm_appointments','v46_crm_campaigns','v46_crm_zones','v46_crm_activity','v46_crm_imports','v46_crm_settings'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from public, anon, authenticated', t);
    execute format('grant all on table public.%I to service_role', t);
  end loop;
end $$;

revoke execute on function public.allneeds_set_updated_at() from public, anon, authenticated;
grant execute on function public.allneeds_set_updated_at() to service_role;
revoke create on schema public from public;
grant usage on schema public to service_role;

commit;
