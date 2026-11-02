-- =====================================================================
-- ALLNEEDS — PHASE 1 : Schéma de persistance du parcours 7 étapes
-- Convention de nommage : préfixe v46_ (celle réellement utilisée par
-- backend/server.mjs via COLLECTION_TABLES).
--
-- Cette migration résout l'incohérence historique entre :
--   - backend/server.mjs  -> tables v46_*
--   - database/supabase.sql (ancien) -> tables sans préfixe
-- en retenant la convention v46_* (backend déjà adapté en production).
--
-- GARANTIES :
--   * Idempotente : ré-exécutable sans effet de bord.
--   * AUCUN DROP. AUCUNE donnée existante n'est supprimée.
--   * Les tables v46_* existantes ne sont jamais modifiées.
--
-- À exécuter dans le SQL Editor Supabase AVANT de déployer le backend
-- qui référence les nouvelles collections.
-- =====================================================================

begin;
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- 1. Tables relationnelles "cœur"
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
  role text not null check (role in ('admin','concierge','dirigeant','manager','collaborateur','prestataire','commercial')),
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
  kind text not null check (kind in ('owner','team','concierge')),
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
-- 2. Tables de collection génériques (id, organization_id, payload)
--    Dont les NOUVELLES tables du parcours :
--      v46_needs_subscriptions  -> abonnement Besoins (ESSENTIEL/AVANCÉ/PREMIUM)
--      v46_saas_subscriptions   -> abonnement SaaS "Gérer mon quotidien" (445 MAD)
--      v46_conversations        -> messagerie (Client <-> Concierge assigné)
-- ---------------------------------------------------------------------

do $$
declare t text;
begin
  foreach t in array array[
    'v46_registrations','v46_diagnostics','v46_diagnostic_consents','v46_needs',
    'v46_missions','v46_documents','v46_messages','v46_appointments','v46_quotes',
    'v46_notifications','v46_needs_subscriptions','v46_saas_subscriptions','v46_conversations'
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
-- 3. Trigger updated_at (comportement existant conservé)
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
-- 4. RLS + accès service_role uniquement (comportement existant conservé)
-- ---------------------------------------------------------------------

do $$
declare t text;
begin
  foreach t in array array[
    'v46_organizations','v46_users','v46_concierge_organizations','v46_invitations',
    'v46_registrations','v46_diagnostics','v46_diagnostic_consents','v46_needs',
    'v46_missions','v46_documents','v46_messages','v46_appointments','v46_quotes',
    'v46_notifications','v46_needs_subscriptions','v46_saas_subscriptions','v46_conversations'
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
