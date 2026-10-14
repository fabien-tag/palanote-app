-- Palanote — Les offres du site (Starter, Premium, Advanced) et le nom de domaine du club
-- · L'offre et l'abonnement ne se changent que côté serveur (fonction abonnement-club, après paiement Stripe).
-- · Premium et Advanced : le club branche son propre nom de domaine (acheté chez OVH, Hostinger, IONOS…).
--   L'app lui donne 2 réglages DNS et vérifie qu'ils sont en place.
-- Prérequis : palanote-site-club.sql. Script autonome et rejouable, à lancer dans le SQL Editor de Supabase.

-- Le site public ne doit jamais montrer les informations de paiement : il faut la dernière version du site
do $$
begin
  if to_regclass('public.club_sites') is null
     or position('stripe_client' in coalesce((select prosrc from pg_proc where proname = 'contenu_site_club' limit 1), '')) = 0 then
    raise exception 'Lance d''abord la dernière version de palanote-site-club.sql, puis ce script.';
  end if;
end $$;

-- ------------------------------------------------------------
-- 1. Abonnement et domaine, sur le site du club
-- ------------------------------------------------------------
alter table public.club_sites add column if not exists abonnement_statut text not null default 'aucun';
alter table public.club_sites add column if not exists abonnement_fin timestamptz;
alter table public.club_sites add column if not exists stripe_client text;
alter table public.club_sites add column if not exists stripe_abonnement text;
alter table public.club_sites add column if not exists domaine text;
alter table public.club_sites add column if not exists domaine_hebergeur text;
alter table public.club_sites add column if not exists domaine_statut text not null default 'aucun';
alter table public.club_sites add column if not exists domaine_jeton text;
alter table public.club_sites add column if not exists domaine_verifie_le timestamptz;

alter table public.club_sites drop constraint if exists club_sites_abonnement_check;
alter table public.club_sites add constraint club_sites_abonnement_check check (
  abonnement_statut in ('aucun', 'actif', 'impaye', 'annule')
  and domaine_statut in ('aucun', 'en_attente', 'branche')
  and (domaine is null or domaine ~ '^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$')
  and (domaine_hebergeur is null or domaine_hebergeur in ('ovh', 'hostinger', 'ionos', 'autre')));
create unique index if not exists club_sites_domaine_idx on public.club_sites (domaine) where domaine is not null;

-- ------------------------------------------------------------
-- 2. Mon offre (lecture par les DP du club)
-- ------------------------------------------------------------
create or replace function public.offre_site_club(p_centre uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.est_dp_centre(p_centre) then raise exception 'réservé aux directeurs de plongée du centre'; end if;
  return (
    select jsonb_build_object(
      'offre', s.offre, 'abonnement_statut', s.abonnement_statut, 'abonnement_fin', s.abonnement_fin,
      'avec_stripe', s.stripe_client is not null,
      'slug', s.slug, 'domaine', s.domaine, 'domaine_hebergeur', s.domaine_hebergeur,
      'domaine_statut', s.domaine_statut, 'domaine_jeton', s.domaine_jeton, 'domaine_verifie_le', s.domaine_verifie_le)
    from public.club_sites s where s.centre_id = p_centre);
end;
$$;
revoke all on function public.offre_site_club(uuid) from public, anon;
grant execute on function public.offre_site_club(uuid) to authenticated;

-- ------------------------------------------------------------
-- 3. Le nom de domaine (Premium et Advanced)
-- ------------------------------------------------------------
create or replace function public.definir_domaine_club(p_centre uuid, p_domaine text, p_hebergeur text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_domaine text := lower(regexp_replace(btrim(coalesce(p_domaine, '')), '^(https?://)?(www\.)?|/.*$', '', 'g'));
  v_offre text;
begin
  if not public.est_dp_centre(p_centre) then raise exception 'réservé aux directeurs de plongée du centre'; end if;
  select offre into v_offre from public.club_sites where centre_id = p_centre;
  if v_offre is null then raise exception 'le site du club n''existe pas encore'; end if;
  if v_offre = 'starter' then raise exception 'le nom de domaine est compris dans l''offre Premium'; end if;
  if v_domaine !~ '^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$' then
    raise exception 'ce nom de domaine n''a pas l''air valide (exemple : club-le-lion.fr)';
  end if;
  if exists (select 1 from public.club_sites where domaine = v_domaine and centre_id <> p_centre) then
    raise exception 'ce nom de domaine est déjà branché sur un autre club';
  end if;

  update public.club_sites set
    domaine = v_domaine,
    domaine_hebergeur = case when p_hebergeur in ('ovh', 'hostinger', 'ionos') then p_hebergeur else 'autre' end,
    domaine_statut = 'en_attente',
    domaine_verifie_le = null,
    -- Un jeton à recopier dans un enregistrement TXT : il prouve que le club possède le domaine
    domaine_jeton = case when domaine = v_domaine and domaine_jeton is not null then domaine_jeton
                         else 'palanote-' || substr(md5(gen_random_uuid()::text), 1, 20) end
  where centre_id = p_centre;
  return public.offre_site_club(p_centre);
end;
$$;
revoke all on function public.definir_domaine_club(uuid, text, text) from public, anon;
grant execute on function public.definir_domaine_club(uuid, text, text) to authenticated;

create or replace function public.retirer_domaine_club(p_centre uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  if not public.est_dp_centre(p_centre) then raise exception 'réservé aux directeurs de plongée du centre'; end if;
  update public.club_sites set domaine = null, domaine_hebergeur = null, domaine_statut = 'aucun',
         domaine_jeton = null, domaine_verifie_le = null
   where centre_id = p_centre;
  return public.offre_site_club(p_centre);
end;
$$;
revoke all on function public.retirer_domaine_club(uuid) from public, anon;
grant execute on function public.retirer_domaine_club(uuid) to authenticated;

-- Résultat de la vérification DNS faite par l'app (enregistrements TXT et CNAME trouvés ou non)
create or replace function public.noter_verification_domaine(p_centre uuid, p_ok boolean)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  if not public.est_dp_centre(p_centre) then raise exception 'réservé aux directeurs de plongée du centre'; end if;
  update public.club_sites set
    domaine_statut = case when domaine is null then 'aucun' when p_ok then 'branche' else 'en_attente' end,
    domaine_verifie_le = case when p_ok then now() else domaine_verifie_le end
  where centre_id = p_centre;
  return public.offre_site_club(p_centre);
end;
$$;
revoke all on function public.noter_verification_domaine(uuid, boolean) from public, anon;
grant execute on function public.noter_verification_domaine(uuid, boolean) to authenticated;

-- ------------------------------------------------------------
-- 4. Changement d'offre : réservé au serveur (fonction abonnement-club, clé secrète)
-- ------------------------------------------------------------
create or replace function public.appliquer_abonnement_club(
  p_centre uuid, p_offre text, p_statut text, p_fin timestamptz, p_client text, p_abonnement text)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  if p_offre not in ('starter', 'premium', 'advanced') then raise exception 'offre inconnue'; end if;
  update public.club_sites set
    offre = p_offre,
    abonnement_statut = coalesce(p_statut, abonnement_statut),
    abonnement_fin = p_fin,
    stripe_client = coalesce(p_client, stripe_client),
    stripe_abonnement = coalesce(p_abonnement, stripe_abonnement),
    -- Retour au Starter : le domaine du club n'est plus servi
    domaine_statut = case when p_offre = 'starter' and domaine is not null then 'en_attente' else domaine_statut end
  where centre_id = p_centre;
end;
$$;
revoke all on function public.appliquer_abonnement_club(uuid, text, text, timestamptz, text, text) from public, anon, authenticated;
grant execute on function public.appliquer_abonnement_club(uuid, text, text, timestamptz, text, text) to service_role;

-- Pour la fonction serveur : le centre et l'adresse e-mail de facturation d'un DP
create or replace function public.club_pour_abonnement(p_user uuid, p_centre uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object('nom', c.nom, 'offre', s.offre, 'stripe_client', s.stripe_client,
                            'stripe_abonnement', s.stripe_abonnement, 'email', u.email)
  from public.centre_membres m
  join public.centres c on c.id = m.centre_id
  join public.club_sites s on s.centre_id = m.centre_id
  join auth.users u on u.id = m.user_id
  where m.user_id = p_user and m.centre_id = p_centre and m.role = 'dp';
$$;
revoke all on function public.club_pour_abonnement(uuid, uuid) from public, anon, authenticated;
grant execute on function public.club_pour_abonnement(uuid, uuid) to service_role;
