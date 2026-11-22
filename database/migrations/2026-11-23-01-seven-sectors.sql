-- Ouvre ALLNEEDS aux 7 secteurs. Idempotent. À exécuter AVANT de déployer le code correspondant.
-- Les secteurs existants gardent leur valeur (sante, enseignement, tourisme) : aucune donnée n'est modifiée.
begin;

alter table public.v46_organizations drop constraint if exists v46_organizations_sector_check;
alter table public.v46_organizations add constraint v46_organizations_sector_check
  check (sector in ('sante','enseignement','tourisme','commerce-distribution','industrie-production','btp-immobilier','services-artisanat'));

commit;

notify pgrst, 'reload schema';
