-- ============================================================
-- Palanote — Binômes identifiés sur une plongée
-- Dans une fiche de plongée, on choisit ses binômes Palanote :
-- la plongée leur est proposée (« À confirmer »), ils l'ajoutent à leur carnet en un clic.
-- Sur la fiche d'un binôme, on ne voit QUE les plongées faites ensemble.
--
-- Prérequis : palanote-page-nouvelle-plongee.sql et palanote-page-amis.sql déjà lancés.
-- À coller dans Supabase → SQL Editor → Run. Relançable sans risque.
-- ============================================================

-- ------------------------------------------------------------
-- Table : dive_buddies (un binôme Palanote identifié sur une plongée)
-- ------------------------------------------------------------
create table if not exists public.dive_buddies (
  id uuid primary key default gen_random_uuid(),
  dive_id uuid not null references public.dives(id) on delete cascade,
  buddy_user_id uuid references auth.users(id) on delete cascade,
  buddy_nom text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.dive_buddies add column if not exists identifie_par uuid references auth.users(id) on delete cascade;
alter table public.dive_buddies add column if not exists statut text not null default 'a_confirmer';
alter table public.dive_buddies add column if not exists copie_dive_id uuid references public.dives(id) on delete set null;
alter table public.dive_buddies add column if not exists repondu_le timestamptz;

do $$ begin
  alter table public.dive_buddies add constraint dive_buddies_statut_check
    check (statut in ('a_confirmer', 'ajoutee', 'refusee'));
exception when duplicate_object then null; end $$;

create unique index if not exists dive_buddies_dive_buddy_uidx on public.dive_buddies (dive_id, buddy_user_id);
create index if not exists dive_buddies_buddy_idx on public.dive_buddies (buddy_user_id, statut);
create index if not exists dive_buddies_par_idx on public.dive_buddies (identifie_par);

-- Lecture seule côté app ; tout passe par les fonctions ci-dessous.
revoke insert, update, delete on public.dive_buddies from authenticated;
grant select on public.dive_buddies to authenticated;
grant all on public.dive_buddies to service_role;
alter table public.dive_buddies enable row level security;

drop policy if exists "Lire sa palanquee" on public.dive_buddies;
drop policy if exists "Ajouter un binome" on public.dive_buddies;
drop policy if exists "Modifier sa palanquee" on public.dive_buddies;
drop policy if exists "Retirer un binome" on public.dive_buddies;
drop policy if exists "Lire ses identifications" on public.dive_buddies;
create policy "Lire ses identifications" on public.dive_buddies for select to authenticated
  using (auth.uid() = identifie_par or auth.uid() = buddy_user_id);

drop trigger if exists dive_buddies_updated_at on public.dive_buddies;
create trigger dive_buddies_updated_at before update on public.dive_buddies
  for each row execute function public.update_updated_at_column();

-- ------------------------------------------------------------
-- Vrai si les deux plongeurs sont binômes (amitié acceptée)
-- ------------------------------------------------------------
create or replace function public.sont_binomes(p_a uuid, p_b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.friendships f
    where f.statut = 'acceptee' and f.user_a = least(p_a, p_b) and f.user_b = greatest(p_a, p_b)
  );
$$;
revoke all on function public.sont_binomes(uuid, uuid) from public, anon, authenticated;

-- ------------------------------------------------------------
-- Résumé d'une plongée, partagé entre binômes (rien de personnel :
-- ni note, ni commentaire, ni équipement, ni pressions)
-- ------------------------------------------------------------
create or replace function public.resume_plongee(p_dive uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'date', d.dive_date,
    'site', d.site_name,
    'lieu', d.site_location,
    'prof_max', d.max_depth_m,
    'duree', d.duration_min,
    'temp_fond', d.temp_bottom_c,
    'melange', d.gas_mix
  )
  from public.dives d where d.id = p_dive;
$$;
revoke all on function public.resume_plongee(uuid) from public, anon, authenticated;

-- ------------------------------------------------------------
-- Identifier ses binômes sur une de ses plongées (remplace la liste)
-- ------------------------------------------------------------
create or replace function public.identifier_binomes(p_dive uuid, p_amis uuid[])
returns integer
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_moi uuid := auth.uid();
  v_amis uuid[];
begin
  if v_moi is null then raise exception 'connexion requise'; end if;
  if not exists (select 1 from public.dives where id = p_dive and user_id = v_moi and deleted_at is null) then
    raise exception 'plongée introuvable';
  end if;

  select coalesce(array_agg(distinct a), '{}') into v_amis
  from unnest(coalesce(p_amis, '{}')) a
  where a <> v_moi and public.sont_binomes(v_moi, a);

  delete from public.dive_buddies
  where dive_id = p_dive and buddy_user_id is not null and not (buddy_user_id = any (v_amis));

  insert into public.dive_buddies (dive_id, buddy_user_id, identifie_par, statut)
  select p_dive, a, v_moi, 'a_confirmer' from unnest(v_amis) a
  on conflict (dive_id, buddy_user_id) do nothing;

  return coalesce(array_length(v_amis, 1), 0);
end;
$$;
revoke all on function public.identifier_binomes(uuid, uuid[]) from public, anon;
grant execute on function public.identifier_binomes(uuid, uuid[]) to authenticated;

-- ------------------------------------------------------------
-- Plongées où l'on m'a identifié, en attente de ma réponse
-- ------------------------------------------------------------
create or replace function public.plongees_a_confirmer()
returns setof jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object('id', b.id, 'de', public.infos_plongeur(b.identifie_par))
         || public.resume_plongee(b.dive_id)
  from public.dive_buddies b
  join public.dives d on d.id = b.dive_id
  where b.buddy_user_id = auth.uid()
    and b.statut = 'a_confirmer'
    and d.deleted_at is null
    and public.sont_binomes(b.identifie_par, auth.uid())
  order by d.dive_date desc nulls last, b.created_at desc;
$$;
revoke all on function public.plongees_a_confirmer() from public, anon;
grant execute on function public.plongees_a_confirmer() to authenticated;

-- ------------------------------------------------------------
-- « Ajouter à mon carnet » : copie la plongée dans mon carnet
-- (infos communes seulement ; à moi de compléter le reste)
-- ------------------------------------------------------------
create or replace function public.ajouter_plongee_identifiee(p_id uuid)
returns uuid
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_moi uuid := auth.uid();
  b public.dive_buddies;
  d public.dives;
  v_mon_prenom text;
  v_son_prenom text;
  v_nouvelle uuid := gen_random_uuid();
begin
  if v_moi is null then raise exception 'connexion requise'; end if;
  select * into b from public.dive_buddies where id = p_id and buddy_user_id = v_moi for update;
  if not found then raise exception 'identification introuvable'; end if;
  if b.statut = 'ajoutee' and b.copie_dive_id is not null then return b.copie_dive_id; end if;
  select * into d from public.dives where id = b.dive_id and deleted_at is null;
  if not found then raise exception 'plongée supprimée par ton binôme'; end if;

  v_mon_prenom := public.infos_plongeur(v_moi) ->> 'prenom';
  v_son_prenom := public.infos_plongeur(b.identifie_par) ->> 'prenom';

  insert into public.dives (
    id, user_id, dive_date, start_time, site_name, site_location, site_coords,
    max_depth_m, avg_depth_m, duration_min, end_time, total_time_min, stops,
    gas_mix, o2_pct, he_pct,
    temp_surface_c, temp_bottom_c, temp_air_c, visibility_m, current_strength, sea_state, weather,
    buddies, guide_name, dive_leader, club_name, boat_name,
    dive_type, environment, entry_type, wildlife, visibility
  ) values (
    v_nouvelle, v_moi, d.dive_date, d.start_time, d.site_name, d.site_location, d.site_coords,
    d.max_depth_m, d.avg_depth_m, d.duration_min, d.end_time, d.total_time_min, d.stops,
    d.gas_mix, d.o2_pct, d.he_pct,
    d.temp_surface_c, d.temp_bottom_c, d.temp_air_c, d.visibility_m, d.current_strength, d.sea_state, d.weather,
    array[v_son_prenom] || array(select x from unnest(coalesce(d.buddies, '{}')) x where x is distinct from v_mon_prenom and x is distinct from v_son_prenom),
    d.guide_name, d.dive_leader, d.club_name, d.boat_name,
    d.dive_type, d.environment, d.entry_type, coalesce(d.wildlife, '{}'), 'private'
  );

  update public.dive_buddies
    set statut = 'ajoutee', copie_dive_id = v_nouvelle, repondu_le = now()
    where id = b.id;
  return v_nouvelle;
end;
$$;
revoke all on function public.ajouter_plongee_identifiee(uuid) from public, anon;
grant execute on function public.ajouter_plongee_identifiee(uuid) to authenticated;

-- « Ce n'était pas moi »
create or replace function public.refuser_identification(p_id uuid)
returns void
language sql
volatile
security definer
set search_path = public
as $$
  update public.dive_buddies set statut = 'refusee', repondu_le = now()
  where id = p_id and buddy_user_id = auth.uid() and statut = 'a_confirmer';
$$;
revoke all on function public.refuser_identification(uuid) from public, anon;
grant execute on function public.refuser_identification(uuid) to authenticated;

-- ------------------------------------------------------------
-- Les plongées faites avec un binôme (et seulement celles-là)
-- ------------------------------------------------------------
create or replace function public.plongees_ensemble(p_ami uuid)
returns setof jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
           'id', b.id,
           'statut', b.statut,
           'identifie_par_moi', b.identifie_par = auth.uid(),
           'ma_plongee', case
             when b.identifie_par = auth.uid() then b.dive_id
             else (select c.id from public.dives c where c.id = b.copie_dive_id and c.deleted_at is null)
           end
         ) || public.resume_plongee(b.dive_id)
  from public.dive_buddies b
  join public.dives d on d.id = b.dive_id
  where public.sont_binomes(auth.uid(), p_ami)
    and d.deleted_at is null
    and b.statut <> 'refusee'
    and ((b.identifie_par = auth.uid() and b.buddy_user_id = p_ami)
      or (b.identifie_par = p_ami and b.buddy_user_id = auth.uid()))
  order by d.dive_date desc nulls last, b.created_at desc;
$$;
revoke all on function public.plongees_ensemble(uuid) from public, anon;
grant execute on function public.plongees_ensemble(uuid) to authenticated;

-- Nombre de plongées ensemble, pour chaque binôme
create or replace function public.compter_plongees_ensemble()
returns setof jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object('id', ami, 'n', count(*))
  from (
    select case when b.identifie_par = auth.uid() then b.buddy_user_id else b.identifie_par end as ami
    from public.dive_buddies b
    join public.dives d on d.id = b.dive_id
    where d.deleted_at is null
      and b.statut <> 'refusee'
      and b.buddy_user_id is not null
      and (b.identifie_par = auth.uid() or b.buddy_user_id = auth.uid())
  ) t
  group by ami;
$$;
revoke all on function public.compter_plongees_ensemble() from public, anon;
grant execute on function public.compter_plongees_ensemble() to authenticated;
