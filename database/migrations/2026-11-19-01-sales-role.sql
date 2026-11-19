-- =====================================================================
-- ALLNEEDS — Présentation commerciale : rôle `sales`
--
-- Autorise le rôle `sales` (comptes commerciaux) dans v46_users et le type
-- d'invitation `sales` dans v46_invitations.
--
-- GARANTIES :
--   * Idempotente : ré-exécutable sans effet de bord.
--   * Aucune table ni donnée supprimée : seules les contraintes CHECK sont
--     remplacées par une version qui inclut les nouvelles valeurs.
--   * L'unicité des e-mails (v46_users_email_ci_unique) empêche les doublons
--     du compte de présentation.
-- =====================================================================

begin;

alter table public.v46_users drop constraint if exists v46_users_role_check;
alter table public.v46_users add constraint v46_users_role_check
  check (role in ('admin','concierge','dirigeant','manager','collaborateur','prestataire','commercial','sales'));

alter table public.v46_invitations drop constraint if exists v46_invitations_kind_check;
alter table public.v46_invitations add constraint v46_invitations_kind_check
  check (kind in ('owner','team','concierge','sales'));

commit;
