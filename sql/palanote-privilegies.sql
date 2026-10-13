-- ============================================================
-- Palanote — Les membres privilégiés du club
--
-- Les plus actifs du club reçoivent une étoile : ils forment une communauté à part,
-- avec des plongées qui leur sont réservées (épaves, plongées profondes…).
--   · le DP met une étoile à un adhérent ou à un plongeur venu en sortie ;
--   · une sortie peut être « réservée aux membres privilégiés », avec son mélange
--     (air, nitrox, trimix…) ;
--   · le DP programme une série de plongées (par exemple chaque dimanche) en une fois ;
--   · il invite les privilégiés choisis : notification dans l'app pour ceux qui l'ont,
--     e-mail préparé pour tous.
-- Sur une sortie réservée, seuls les privilégiés peuvent s'inscrire eux-mêmes (QR ou lien) ;
-- le DP, lui, peut toujours ajouter qui il veut.
--
-- Prérequis : palanote-sorties-club.sql, palanote-planning-club.sql (est_dp_centre)
--             et palanote-import-excel.sql (centre_adherents).
-- À coller dans Supabase → SQL Editor → Run. Relançable sans risque.
-- ============================================================

alter table public.centre_adherents add column if not exists privilegie boolean not null default false;
alter table public.centre_adherents add column if not exists privilegie_depuis timestamptz;
alter table public.sorties add column if not exists reservee_privilegies boolean not null default false;
alter table public.sorties add column if not exists melange text;
alter table public.sorties drop constraint if exists sorties_melange_check;
alter table public.sorties add constraint sorties_melange_check
  check (melange is null or melange in ('Air', 'Nitrox 32', 'Nitrox 36', 'Nitrox 40', 'Trimix', 'Air ou nitrox'));

-- Le plongeur est-il un membre privilégié de ce centre ? (compte relié, ou même e-mail)
create or replace function public.est_privilegie(p_centre uuid, p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.centre_adherents a
    where a.centre_id = p_centre and a.privilegie
      and (a.user_id = p_user
           or (a.email is not null and lower(a.email) = (select lower(u.email) from auth.users u where u.id = p_user))));
$$;
revoke all on function public.est_privilegie(uuid, uuid) from public, anon, authenticated;

-- Sortie réservée : un plongeur non privilégié ne peut pas s'y inscrire lui-même
create or replace function public.controler_sortie_reservee()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.sorties;
begin
  if new.user_id is null or new.via not in ('qr', 'lien') then return new; end if;
  select * into s from public.sorties where id = new.sortie_id;
  if s.reservee_privilegies and s.centre_id is not null and new.user_id <> s.dp_id
     and not public.est_privilegie(s.centre_id, new.user_id) then
    raise exception 'sortie réservée aux membres privilégiés';
  end if;
  return new;
end;
$$;
drop trigger if exists sortie_participants_reservee on public.sortie_participants;
create trigger sortie_participants_reservee before insert on public.sortie_participants
  for each row execute function public.controler_sortie_reservee();

-- ------------------------------------------------------------
-- Étoiles
-- ------------------------------------------------------------
create or replace function public.basculer_privilegie(p_adherent uuid, p_oui boolean)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_centre uuid;
begin
  select centre_id into v_centre from public.centre_adherents where id = p_adherent;
  if v_centre is null or not public.est_dp_centre(v_centre) then raise exception 'adhérent introuvable'; end if;
  update public.centre_adherents
    set privilegie = coalesce(p_oui, false), privilegie_depuis = case when p_oui then coalesce(privilegie_depuis, now()) end
  where id = p_adherent;
end;
$$;
revoke all on function public.basculer_privilegie(uuid, boolean) from public, anon;
grant execute on function public.basculer_privilegie(uuid, boolean) to authenticated;

-- Étoile sur un plongeur venu en sortie (sa fiche d'adhérent est créée s'il n'en a pas)
create or replace function public.privilegier_plongeur(p_centre uuid, p_user uuid, p_oui boolean)
returns uuid
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_infos jsonb := public.infos_plongeur(p_user);
begin
  if not public.est_dp_centre(p_centre) then raise exception 'réservé aux directeurs de plongée du centre'; end if;
  if not exists (select 1 from public.sortie_participants p join public.sorties s on s.id = p.sortie_id
                 where s.centre_id = p_centre and p.user_id = p_user)
     and not exists (select 1 from public.centre_adherents where centre_id = p_centre and user_id = p_user) then
    raise exception 'plongeur inconnu du centre';
  end if;
  select id into v_id from public.centre_adherents where centre_id = p_centre and user_id = p_user limit 1;
  if v_id is null then
    insert into public.centre_adherents (centre_id, prenom, niveau, user_id)
    values (p_centre, coalesce(v_infos ->> 'prenom', 'Plongeur'), v_infos ->> 'niveau', p_user)
    returning id into v_id;
  end if;
  perform public.basculer_privilegie(v_id, p_oui);
  return v_id;
end;
$$;
revoke all on function public.privilegier_plongeur(uuid, uuid, boolean) from public, anon;
grant execute on function public.privilegier_plongeur(uuid, uuid, boolean) to authenticated;

-- ------------------------------------------------------------
-- La communauté : membres, suggestions, plongées réservées
-- ------------------------------------------------------------
create or replace function public.privilegies_centre(p_centre uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  if not public.est_dp_centre(p_centre) then raise exception 'réservé aux directeurs de plongée du centre'; end if;
  perform public.lier_adherents(p_centre);
  return jsonb_build_object(
    -- Les membres privilégiés, avec leur activité
    'membres', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', a.id, 'user_id', a.user_id, 'prenom', a.prenom, 'nom', a.nom, 'email', a.email, 'niveau', a.niveau,
        'certificat_fin', a.certificat_fin, 'depuis', a.privilegie_depuis, 'sur_palanote', a.user_id is not null,
        'activite', t.plongees + t.sorties, 'derniere', greatest(t.derniere_h, t.derniere_s),
        'inscrit_reservees', (select count(*) from public.sortie_participants p join public.sorties s on s.id = p.sortie_id
                              where p.user_id = a.user_id and s.centre_id = p_centre and s.reservee_privilegies
                                and s.statut = 'prevue' and s.date_sortie >= current_date))
        order by t.plongees + t.sorties desc, a.prenom)
      from public.centre_adherents a
      cross join lateral (
        select (select count(*) from public.adherent_plongees h where h.adherent_id = a.id) as plongees,
               (select max(h.date_plongee) from public.adherent_plongees h where h.adherent_id = a.id) as derniere_h,
               case when a.user_id is null then 0 else (select count(distinct s.id) from public.sortie_participants p join public.sorties s on s.id = p.sortie_id
                 where p.user_id = a.user_id and s.centre_id = p_centre and s.statut in ('terminee', 'validee')) end as sorties,
               case when a.user_id is null then null else (select max(s.date_sortie) from public.sortie_participants p join public.sorties s on s.id = p.sortie_id
                 where p.user_id = a.user_id and s.centre_id = p_centre and s.statut in ('terminee', 'validee')) end as derniere_s
      ) t
      where a.centre_id = p_centre and a.privilegie), '[]'::jsonb),
    -- Les plus actifs qui n'ont pas encore l'étoile (3 plongées ou plus avec le club)
    'suggestions', coalesce((
      select jsonb_agg(x order by (x ->> 'activite')::int desc) from (
        select jsonb_build_object('id', a.id, 'user_id', a.user_id, 'prenom', a.prenom, 'nom', a.nom, 'niveau', a.niveau,
                 'activite', (select count(*) from public.adherent_plongees h where h.adherent_id = a.id)
                           + case when a.user_id is null then 0 else (select count(distinct s.id) from public.sortie_participants p join public.sorties s on s.id = p.sortie_id
                               where p.user_id = a.user_id and s.centre_id = p_centre and s.statut in ('terminee', 'validee')) end) as x
        from public.centre_adherents a
        where a.centre_id = p_centre and not a.privilegie
        union all
        select jsonb_build_object('id', null, 'user_id', p.user_id, 'prenom', public.infos_plongeur(p.user_id) ->> 'prenom', 'nom', null,
                 'niveau', public.infos_plongeur(p.user_id) ->> 'niveau', 'activite', count(distinct s.id))
        from public.sortie_participants p join public.sorties s on s.id = p.sortie_id
        where s.centre_id = p_centre and s.statut in ('terminee', 'validee') and p.user_id is not null and p.user_id <> s.dp_id
          and not exists (select 1 from public.centre_adherents a where a.centre_id = p_centre and a.user_id = p.user_id)
        group by p.user_id
      ) t where (x ->> 'activite')::int >= 3 limit 8), '[]'::jsonb),
    -- Les plongées réservées à venir
    'sorties', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', s.id, 'date', s.date_sortie, 'date_texte', public.date_fr(s.date_sortie), 'heure', s.heure,
        'site', s.site_name, 'lieu', s.site_location, 'melange', s.melange, 'profondeur_prevue', s.profondeur_prevue,
        'bateau', s.bateau, 'jeton', s.jeton,
        'nb_inscrits', (select count(*) from public.sortie_participants p where p.sortie_id = s.id and p.user_id is not null))
        order by s.date_sortie, s.heure nulls last)
      from public.sorties s
      where s.centre_id = p_centre and s.deleted_at is null and s.reservee_privilegies and s.statut = 'prevue'
        and s.date_sortie >= current_date), '[]'::jsonb)
  );
end;
$$;
revoke all on function public.privilegies_centre(uuid) from public, anon;
grant execute on function public.privilegies_centre(uuid) to authenticated;

-- Réserver (ou non) une sortie aux privilégiés, et noter son mélange
create or replace function public.definir_sortie_privilegies(p_sortie uuid, p_reservee boolean, p_melange text)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  if not public.est_dp_sortie(p_sortie) then raise exception 'réservé au directeur de plongée'; end if;
  if exists (select 1 from public.sorties where id = p_sortie and centre_id is null) then
    raise exception 'pas de sortie réservée entre amis';
  end if;
  update public.sorties set reservee_privilegies = coalesce(p_reservee, false), melange = nullif(btrim(coalesce(p_melange, '')), '')
  where id = p_sortie;
end;
$$;
revoke all on function public.definir_sortie_privilegies(uuid, boolean, text) from public, anon;
grant execute on function public.definir_sortie_privilegies(uuid, boolean, text) to authenticated;

-- Les options d'une sortie (pour le panneau du planning)
create or replace function public.options_sortie(p_sortie uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object('reservee', s.reservee_privilegies, 'melange', s.melange)
  from public.sorties s where s.id = p_sortie and public.peut_voir_sortie(p_sortie);
$$;
revoke all on function public.options_sortie(uuid) from public, anon;
grant execute on function public.options_sortie(uuid) to authenticated;

-- Côté plongeur, avant de s'inscrire : la sortie est-elle réservée, et suis-je privilégié ?
create or replace function public.reservation_sortie(p_jeton text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object('reservee', s.reservee_privilegies, 'melange', s.melange,
                            'privilegie', auth.uid() is not null and public.est_privilegie(s.centre_id, auth.uid()))
  from public.sorties s where s.jeton = p_jeton and s.deleted_at is null;
$$;
revoke all on function public.reservation_sortie(text) from public;
grant execute on function public.reservation_sortie(text) to anon, authenticated;

-- Programmer une série de plongées réservées en une fois (ex. chaque dimanche, 2 plongées)
create or replace function public.creer_serie_privilegies(p_centre uuid, p_sorties jsonb)
returns integer
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  l jsonb;
  v_id uuid;
  v_nb integer := 0;
  v_bateau public.materiel;
begin
  if not public.est_dp_centre(p_centre) then raise exception 'réservé aux directeurs de plongée du centre'; end if;
  if jsonb_array_length(coalesce(p_sorties, '[]'::jsonb)) > 60 then raise exception 'série trop longue (60 plongées au plus)'; end if;
  for l in select * from jsonb_array_elements(coalesce(p_sorties, '[]'::jsonb)) loop
    if public.cellule_date(l, 'date') is null or public.cellule_date(l, 'date') < current_date or public.cellule(l, 'site') is null then continue; end if;
    v_bateau := null;
    if public.cellule(l, 'bateau_id') is not null then
      select * into v_bateau from public.materiel where id = (l ->> 'bateau_id')::uuid and centre_id = p_centre and type = 'bateau' and deleted_at is null;
    end if;
    insert into public.sorties (centre_id, dp_id, date_sortie, heure, site_name, site_location, profondeur_prevue, consignes,
                                bateau, bateau_id, reservee_privilegies, melange)
    values (p_centre, auth.uid(), public.cellule_date(l, 'date'), public.cellule_heure(l, 'heure'), left(public.cellule(l, 'site'), 120),
            left(public.cellule(l, 'lieu'), 120), public.cellule_nombre(l, 'profondeur'), left(public.cellule(l, 'consignes'), 500),
            v_bateau.libelle, v_bateau.id, true,
            case when public.cellule(l, 'melange') in ('Air', 'Nitrox 32', 'Nitrox 36', 'Nitrox 40', 'Trimix', 'Air ou nitrox') then public.cellule(l, 'melange') end)
    returning id into v_id;
    insert into public.sortie_palanquees (sortie_id, numero) values (v_id, 1);
    v_nb := v_nb + 1;
  end loop;
  return v_nb;
end;
$$;
revoke all on function public.creer_serie_privilegies(uuid, jsonb) from public, anon;
grant execute on function public.creer_serie_privilegies(uuid, jsonb) to authenticated;

-- Inviter les privilégiés choisis : une notification par plongée pour ceux qui ont l'app
create or replace function public.inviter_privilegies(p_centre uuid, p_adherents uuid[], p_sorties uuid[])
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  a record;
  s record;
  v_dp text := public.infos_plongeur(auth.uid()) ->> 'prenom';
  v_avec integer := 0;
  v_sans integer := 0;
begin
  if not public.est_dp_centre(p_centre) then raise exception 'réservé aux directeurs de plongée du centre'; end if;
  perform public.lier_adherents(p_centre);
  for a in select * from public.centre_adherents where centre_id = p_centre and id = any(coalesce(p_adherents, '{}')) and privilegie loop
    if a.user_id is null then
      v_sans := v_sans + 1;
      continue;
    end if;
    v_avec := v_avec + 1;
    for s in select * from public.sorties
             where id = any(coalesce(p_sorties, '{}')) and centre_id = p_centre and reservee_privilegies and statut = 'prevue'
             order by date_sortie, heure loop
      perform public.notifier(a.user_id, 'privilegies_invitation',
        'Plongée réservée aux membres privilégiés',
        public.date_fr(s.date_sortie) || coalesce(' à ' || to_char(s.heure, 'HH24"h"MI'), '') || ' · ' || s.site_name
          || coalesce(' · ' || s.melange, '') || '. ' || coalesce(v_dp, 'Ton DP') || ' t''invite.',
        '/sortie?code=' || s.jeton || '&via=lien', jsonb_build_object('sortie_id', s.id));
    end loop;
  end loop;
  return jsonb_build_object('avec_app', v_avec, 'sans_app', v_sans);
end;
$$;
revoke all on function public.inviter_privilegies(uuid, uuid[], uuid[]) from public, anon;
grant execute on function public.inviter_privilegies(uuid, uuid[], uuid[]) to authenticated;

-- L'étoile dans la liste des adhérents
create or replace function public.ids_privilegies(p_centre uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case when public.est_dp_centre(p_centre) then coalesce((
    select jsonb_agg(jsonb_build_object('id', a.id, 'user_id', a.user_id))
    from public.centre_adherents a where a.centre_id = p_centre and a.privilegie), '[]'::jsonb) else '[]'::jsonb end;
$$;
revoke all on function public.ids_privilegies(uuid) from public, anon;
grant execute on function public.ids_privilegies(uuid) to authenticated;
