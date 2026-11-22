-- Studio IA (Magnific) et demandes de sites web.
-- Idempotent et sans modification des données existantes. À exécuter AVANT de déployer le code correspondant.
begin;

do $$
declare t text;
begin
  foreach t in array array[
    'v46_managed_files',
    'v46_website_requests',
    'v46_website_events',
    'v46_website_deliveries',
    'v46_website_revisions',
    'v46_website_notes',
    'v46_website_imports',
    'v46_magnific_generations'
  ] loop
    execute format('create table if not exists public.%I (
      id text primary key,
      organization_id text references public.v46_organizations(id) on delete set null,
      payload jsonb not null default ''{}''::jsonb,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )', t);
    execute format('create index if not exists %I on public.%I (organization_id)', t || '_org_idx', t);
    execute format('drop trigger if exists %I on public.%I', t || '_updated_at', t);
    execute format('create trigger %I before update on public.%I for each row execute function public.allneeds_set_updated_at()', t || '_updated_at', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from public, anon, authenticated', t);
    execute format('grant all on table public.%I to service_role', t);
  end loop;
end $$;

create index if not exists v46_website_requests_status_idx on public.v46_website_requests ((payload->>'status'));
create index if not exists v46_website_requests_developer_idx on public.v46_website_requests ((payload->>'developerId'));
create index if not exists v46_website_events_request_idx on public.v46_website_events ((payload->>'requestId'));
create index if not exists v46_magnific_generations_owner_idx on public.v46_magnific_generations ((payload->>'ownerId'));

-- Stockage privé : aucun accès public, seuls le serveur et ses liens signés de courte durée y accèdent.
do $$
begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('allneeds-private', 'allneeds-private', false, 52428800, array['image/jpeg','image/png','image/webp','video/mp4','video/webm','video/quicktime','audio/mpeg','audio/wav','audio/mp4','audio/ogg','application/octet-stream'])
    on conflict (id) do update set public = false;
  end if;
end $$;

commit;

notify pgrst, 'reload schema';
