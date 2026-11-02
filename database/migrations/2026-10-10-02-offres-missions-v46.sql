-- =====================================================================
-- ALLNEEDS — PHASE 5 : Offres d'accompagnement & missions
--
-- Ajoute la table de collection `v46_offers` (offres BASIQUE / PRO /
-- PERFORMANCE acceptées par les entreprises). L'historique complet est
-- conservé dans le payload ; une seule offre `acceptee` est active par
-- entreprise (règle applicative côté backend).
--
-- La table `v46_missions` (déjà créée en Phase 1) est réutilisée pour
-- les missions générées à l'acceptation d'une offre.
--
-- GARANTIES :
--   * Idempotente : ré-exécutable sans effet de bord.
--   * AUCUN DROP. AUCUNE donnée existante supprimée.
--
-- À exécuter APRÈS 2026-10-10-01-parcours-v46.sql.
-- =====================================================================

begin;
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- 1. Table de collection `v46_offers`
-- ---------------------------------------------------------------------
create table if not exists public.v46_offers (
  id text primary key,
  organization_id text references public.v46_organizations(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists v46_offers_org_idx on public.v46_offers(organization_id);

-- ---------------------------------------------------------------------
-- 2. RLS + accès service_role uniquement (comportement existant)
-- ---------------------------------------------------------------------
alter table public.v46_offers enable row level security;
revoke all on table public.v46_offers from public, anon, authenticated;
grant all on table public.v46_offers to service_role;

commit;
