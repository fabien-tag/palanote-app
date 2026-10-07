-- ============================================================
-- Palanote — Parcours 07 « Compléter les carnets ensemble »
-- Quand un binôme t'identifie sur sa plongée, tu reçois une proposition :
--   · ce qui arrive dans ta fiche (site, date, durée, eau, visibilité, bateau, palanquée)
--   · ce qui reste à toi (profondeur max, air, lestage, ta note) — jamais copié
--   · si tu avais déjà noté cette plongée, on complète seulement tes cases vides
-- Une proposition disparaît au bout de 30 jours.
-- Prérequis : palanote-page-amis.sql et palanote-binomes-plongees.sql.
-- À coller dans Supabase → SQL Editor → Run. Relançable sans risque.
-- ============================================================

-- D'où vient une plongée : 'manuelle', 'ocr' (carnet papier) ou 'binome' (proposition acceptée).
-- Déjà créée par le script de numérisation ; ligne gardée pour que ce script tienne seul.
alter table public.dives add column if not exists source text not null default 'manuelle';

-- ------------------------------------------------------------
-- 1. Les propositions en attente (moins de 30 jours)
-- ------------------------------------------------------------
create or replace function public.plongees_a_confirmer()
returns setof jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
           'id', b.id,
           'de', public.infos_plongeur(b.identifie_par),
           'cree_le', b.created_at,
           'expire_le', b.created_at + interval '30 days'
         )
         || public.resume_plongee(b.dive_id)
  from public.dive_buddies b
  join public.dives d on d.id = b.dive_id
  where b.buddy_user_id = auth.uid()
    and b.statut = 'a_confirmer'
    and b.created_at > now() - interval '30 days'
    and d.deleted_at is null
    and public.sont_binomes(b.identifie_par, auth.uid())
  order by b.created_at desc;
$$;
revoke all on function public.plongees_a_confirmer() from public, anon;
grant execute on function public.plongees_a_confirmer() to authenticated;

-- ------------------------------------------------------------
-- 2. Le détail d'une proposition (écrans 39 et 41)
-- ------------------------------------------------------------
create or replace function public.proposition_plongee(p_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_moi uuid := auth.uid();
  b public.dive_buddies;
  d public.dives;
  m public.dives;
  v_moi_prenom text;
  v_son_prenom text;
  v_palanquee jsonb;
  v_libres text[];
begin
  if v_moi is null then raise exception 'connexion requise'; end if;
  select * into b from public.dive_buddies where id = p_id and buddy_user_id = v_moi;
  if not found then raise exception 'proposition introuvable'; end if;
  select * into d from public.dives where id = b.dive_id and deleted_at is null;
  if not found then raise exception 'plongée supprimée par ton binôme'; end if;

  v_moi_prenom := public.infos_plongeur(v_moi) ->> 'prenom';
  v_son_prenom := public.infos_plongeur(b.identifie_par) ->> 'prenom';

  -- La palanquée : celui qui propose + les autres binômes Palanote identifiés (sauf moi)
  select coalesce(jsonb_agg(x), '[]'::jsonb) into v_palanquee from (
    select public.infos_plongeur(b.identifie_par) as x
    union all
    select public.infos_plongeur(o.buddy_user_id)
    from public.dive_buddies o
    where o.dive_id = d.id and o.buddy_user_id is not null and o.buddy_user_id <> v_moi
  ) t;

  -- Les noms écrits à la main (sans moi ni lui)
  select coalesce(array_agg(x), '{}') into v_libres
  from unnest(coalesce(d.buddies, '{}')) x
  where x is distinct from v_moi_prenom and x is distinct from v_son_prenom;

  -- Ai-je déjà noté cette plongée ? Même jour, et moins de 3 h d'écart si les deux heures sont connues.
  -- On ignore les plongées qui viennent déjà d'une autre proposition.
  if d.dive_date is not null then
    select * into m from public.dives x
    where x.user_id = v_moi and x.deleted_at is null and x.dive_date = d.dive_date
      and not exists (select 1 from public.dive_buddies c where c.copie_dive_id = x.id and c.buddy_user_id = v_moi)
      and (x.start_time is null or d.start_time is null
           or abs(extract(epoch from (x.start_time - d.start_time))) <= 3 * 3600)
    order by case when x.start_time is not null and d.start_time is not null
                  then abs(extract(epoch from (x.start_time - d.start_time))) else 99999 end,
             x.created_at desc
    limit 1;
  end if;

  return jsonb_build_object(
    'id', b.id,
    'statut', b.statut,
    'de', public.infos_plongeur(b.identifie_par),
    'cree_le', b.created_at,
    'expire_le', b.created_at + interval '30 days',
    'validee_le', d.created_at,
    'commun', jsonb_build_object(
      'date', d.dive_date,
      'heure', to_char(d.start_time, 'HH24:MI'),
      'site', d.site_name,
      'lieu', d.site_location,
      'duree', d.duration_min,
      'temp_fond', d.temp_bottom_c,
      'visibilite', d.visibility_m,
      'bateau', d.boat_name,
      'club', d.club_name,
      'type', d.dive_type
    ),
    'palanquee', v_palanquee,
    'noms_libres', to_jsonb(v_libres),
    'deja', case when m.id is null then null else jsonb_build_object(
      'id', m.id,
      'saisie_le', m.created_at,
      'heure', to_char(m.start_time, 'HH24:MI'),
      'site', m.site_name,
      'prof_max', m.max_depth_m,
      'duree', m.duration_min,
      'temp_fond', m.temp_bottom_c,
      'visibilite', m.visibility_m,
      'bateau', m.boat_name,
      'club', m.club_name,
      'nb_binomes', coalesce(array_length(m.buddies, 1), 0)
    ) end
  );
end;
$$;
revoke all on function public.proposition_plongee(uuid) from public, anon;
grant execute on function public.proposition_plongee(uuid) to authenticated;

-- ------------------------------------------------------------
-- 3. « Ajouter à mon carnet » : nouvelle plongée avec les infos communes
--    + ce que je saisis moi-même (p_perso), jamais ses mesures à lui.
--    p_perso = {"prof_max": 38.5, "pression_debut": 200, "pression_fin": 60, "lestage": 6, "note": 4}
-- ------------------------------------------------------------
drop function if exists public.ajouter_plongee_identifiee(uuid);

create or replace function public.ajouter_plongee_identifiee(p_id uuid, p_perso jsonb default '{}'::jsonb)
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
  v_note smallint := nullif(p_perso ->> 'note', '')::smallint;
begin
  if v_moi is null then raise exception 'connexion requise'; end if;
  select * into b from public.dive_buddies where id = p_id and buddy_user_id = v_moi for update;
  if not found then raise exception 'proposition introuvable'; end if;
  if b.statut = 'ajoutee' and b.copie_dive_id is not null then return b.copie_dive_id; end if;
  select * into d from public.dives where id = b.dive_id and deleted_at is null;
  if not found then raise exception 'plongée supprimée par ton binôme'; end if;

  v_mon_prenom := public.infos_plongeur(v_moi) ->> 'prenom';
  v_son_prenom := public.infos_plongeur(b.identifie_par) ->> 'prenom';

  insert into public.dives (
    id, user_id, source, dive_date, start_time, end_time, site_name, site_location, site_coords,
    duration_min, temp_surface_c, temp_bottom_c, temp_air_c, visibility_m, current_strength, sea_state, weather,
    buddies, guide_name, dive_leader, club_name, boat_name, dive_type, environment, entry_type, visibility,
    max_depth_m, pressure_start_bar, pressure_end_bar, weight_kg, rating
  ) values (
    v_nouvelle, v_moi, 'binome', d.dive_date, d.start_time, d.end_time, d.site_name, d.site_location, d.site_coords,
    d.duration_min, d.temp_surface_c, d.temp_bottom_c, d.temp_air_c, d.visibility_m, d.current_strength, d.sea_state, d.weather,
    array[v_son_prenom] || array(select x from unnest(coalesce(d.buddies, '{}')) x where x is distinct from v_mon_prenom and x is distinct from v_son_prenom),
    d.guide_name, d.dive_leader, d.club_name, d.boat_name, d.dive_type, d.environment, d.entry_type, 'private',
    nullif(p_perso ->> 'prof_max', '')::numeric,
    nullif(p_perso ->> 'pression_debut', '')::integer,
    nullif(p_perso ->> 'pression_fin', '')::integer,
    nullif(p_perso ->> 'lestage', '')::numeric,
    case when v_note between 1 and 5 then v_note end
  );

  update public.dive_buddies
    set statut = 'ajoutee', copie_dive_id = v_nouvelle, repondu_le = now()
    where id = b.id;
  return v_nouvelle;
end;
$$;
revoke all on function public.ajouter_plongee_identifiee(uuid, jsonb) from public, anon;
grant execute on function public.ajouter_plongee_identifiee(uuid, jsonb) to authenticated;

-- ------------------------------------------------------------
-- 4. « Compléter ma plongée » (écran 41) : j'avais déjà noté la plongée,
--    on remplit seulement mes cases vides avec les infos communes.
-- ------------------------------------------------------------
create or replace function public.completer_plongee_identifiee(p_id uuid, p_dive uuid)
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
  v_son_prenom text;
begin
  if v_moi is null then raise exception 'connexion requise'; end if;
  select * into b from public.dive_buddies where id = p_id and buddy_user_id = v_moi for update;
  if not found then raise exception 'proposition introuvable'; end if;
  select * into d from public.dives where id = b.dive_id and deleted_at is null;
  if not found then raise exception 'plongée supprimée par ton binôme'; end if;
  if not exists (select 1 from public.dives where id = p_dive and user_id = v_moi and deleted_at is null) then
    raise exception 'ta plongée est introuvable';
  end if;

  v_son_prenom := public.infos_plongeur(b.identifie_par) ->> 'prenom';

  update public.dives m set
    start_time       = coalesce(m.start_time, d.start_time),
    end_time         = coalesce(m.end_time, d.end_time),
    site_name        = coalesce(nullif(m.site_name, ''), d.site_name),
    site_location    = coalesce(nullif(m.site_location, ''), d.site_location),
    site_coords      = coalesce(nullif(m.site_coords, ''), d.site_coords),
    duration_min     = coalesce(m.duration_min, d.duration_min),
    temp_surface_c   = coalesce(m.temp_surface_c, d.temp_surface_c),
    temp_bottom_c    = coalesce(m.temp_bottom_c, d.temp_bottom_c),
    temp_air_c       = coalesce(m.temp_air_c, d.temp_air_c),
    visibility_m     = coalesce(m.visibility_m, d.visibility_m),
    current_strength = coalesce(nullif(m.current_strength, ''), d.current_strength),
    sea_state        = coalesce(nullif(m.sea_state, ''), d.sea_state),
    weather          = coalesce(nullif(m.weather, ''), d.weather),
    guide_name       = coalesce(nullif(m.guide_name, ''), d.guide_name),
    dive_leader      = coalesce(nullif(m.dive_leader, ''), d.dive_leader),
    club_name        = coalesce(nullif(m.club_name, ''), d.club_name),
    boat_name        = coalesce(nullif(m.boat_name, ''), d.boat_name),
    buddies          = case when v_son_prenom = any (coalesce(m.buddies, '{}')) then m.buddies
                            else coalesce(m.buddies, '{}') || array[v_son_prenom] end
  where m.id = p_dive;

  update public.dive_buddies
    set statut = 'ajoutee', copie_dive_id = p_dive, repondu_le = now()
    where id = b.id;
  return p_dive;
end;
$$;
revoke all on function public.completer_plongee_identifiee(uuid, uuid) from public, anon;
grant execute on function public.completer_plongee_identifiee(uuid, uuid) to authenticated;
