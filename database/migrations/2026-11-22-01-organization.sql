-- Organisation interne : PDG, services, équipes, tâches et stratégies marketing.
-- Idempotent. À exécuter AVANT de déployer le code correspondant.
begin;

alter table public.v46_users drop constraint if exists v46_users_role_check;
alter table public.v46_users add constraint v46_users_role_check
  check (role in ('admin','concierge','dirigeant','manager','collaborateur','prestataire','commercial','sales','agent','crm','staff'));

alter table public.v46_invitations drop constraint if exists v46_invitations_kind_check;
alter table public.v46_invitations add constraint v46_invitations_kind_check
  check (kind in ('owner','team','concierge','sales','crm','staff'));

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
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from public, anon, authenticated', t);
    execute format('grant all on table public.%I to service_role', t);
  end loop;
end $$;

create index if not exists v46_org_tasks_team_idx on public.v46_org_tasks ((payload->>'teamId'));
create index if not exists v46_org_tasks_assignee_idx on public.v46_org_tasks ((payload->>'assigneeId'));

commit;

notify pgrst, 'reload schema';
