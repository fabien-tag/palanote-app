-- ============================================================
-- Palanote — Accueil du directeur de plongée et fiche de sécurité
--
-- L'onglet « Sorties » devient l'accueil du DP :
--   · la prochaine sortie (remplissage, palanquées sans guide),
--   · ce qu'il reste à faire (tampons, fiches pas remplies, prénoms jamais réclamés),
--   · sa saison (sorties encadrées, plongeurs, tampons, heures),
--   · les habitués et les nouveaux du centre, les sites les plus pratiqués.
-- Le DP peut relancer les plongeurs qui n'ont pas rempli leur fiche (une fois par jour).
-- La fiche de sécurité de la sortie s'imprime (palanquées, niveaux, paramètres).
--
-- Prérequis : palanote-sorties-club.sql (et palanote-page-amis.sql pour infos_plongeur).
-- À coller dans Supabase → SQL Editor → Run. Relançable sans risque.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Le tableau de bord du DP pour un centre
-- ------------------------------------------------------------
create or replace function public.accueil_dp(p_centre uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_moi uuid := auth.uid();
  v_debut date := date_trunc('year', current_date)::date;
  v_mois date := date_trunc('month', current_date)::date;
  v_prochaine jsonb;
  v_a_faire jsonb;
  v_stats jsonb;
  v_habitues jsonb;
  v_nouveaux jsonb;
  v_sites jsonb;
begin
  if v_moi is null then raise exception 'connexion requise'; end if;
  if not exists (select 1 from public.centre_membres m where m.centre_id = p_centre and m.user_id = v_moi and m.role = 'dp') then
    raise exception 'réservé aux directeurs de plongée du centre';
  end if;

  -- La prochaine sortie du centre
  select jsonb_build_object(
    'id', s.id, 'date', s.date_sortie, 'date_texte', public.date_fr(s.date_sortie), 'heure', s.heure,
    'site', s.site_name, 'lieu', s.site_location, 'bateau', s.bateau, 'profondeur_prevue', s.profondeur_prevue,
    'dans_jours', s.date_sortie - current_date,
    'mienne', s.dp_id = v_moi,
    'nb_inscrits', (select count(*) from public.sortie_participants p where p.sortie_id = s.id and p.user_id is not null),
    'nb_prevus', (select count(*) from public.sortie_participants p where p.sortie_id = s.id and p.user_id is null),
    'nb_palanquees', (select count(*) from public.sortie_palanquees q where q.sortie_id = s.id
                       and exists (select 1 from public.sortie_participants p where p.palanquee_id = q.id)),
    'sans_guide', (select count(*) from public.sortie_palanquees q where q.sortie_id = s.id and q.guide_id is null
                    and exists (select 1 from public.sortie_participants p where p.palanquee_id = q.id)),
    'sans_palanquee', (select count(*) from public.sortie_participants p where p.sortie_id = s.id and p.palanquee_id is null))
  into v_prochaine
  from public.sorties s
  where s.centre_id = p_centre and s.deleted_at is null and s.statut = 'prevue' and s.date_sortie >= current_date
  order by s.date_sortie, s.heure nulls last
  limit 1;

  -- À faire : tampons (avec les fiches encore vides), fiches manquantes après tampon,
  -- prénoms jamais réclamés (3 dernières semaines)
  select coalesce(jsonb_agg(x order by x ->> 'ordre', x ->> 'date' desc), '[]'::jsonb) into v_a_faire
  from (
    select jsonb_build_object(
      'type', 'tampon', 'ordre', '1', 'sortie_id', s.id, 'site', s.site_name, 'date', s.date_sortie,
      'date_texte', public.date_fr(s.date_sortie),
      'nb', (select count(*) from public.sortie_participants p where p.sortie_id = s.id and p.dive_id is not null),
      'total', (select count(*) from public.sortie_participants p where p.sortie_id = s.id),
      'manquantes', (select count(*) from public.sortie_participants p
                     where p.sortie_id = s.id and p.user_id is not null and p.dive_id is null and p.user_id <> s.dp_id),
      'relance_le', (select max(n.created_at) from public.notifications n
                     where n.type = 'sortie_relance' and n.donnees ->> 'sortie_id' = s.id::text)) as x
    from public.sorties s
    where s.centre_id = p_centre and s.deleted_at is null and s.statut = 'terminee'
    union all
    select jsonb_build_object(
      'type', 'fiches', 'ordre', '2', 'sortie_id', s.id, 'site', s.site_name, 'date', s.date_sortie,
      'date_texte', public.date_fr(s.date_sortie), 'nb', f.nb,
      'relance_le', (select max(n.created_at) from public.notifications n
                     where n.type = 'sortie_relance' and n.donnees ->> 'sortie_id' = s.id::text))
    from public.sorties s
    cross join lateral (
      select count(*) as nb from public.sortie_participants p
      where p.sortie_id = s.id and p.user_id is not null and p.dive_id is null and not p.exclu_tampon and p.user_id <> s.dp_id
    ) f
    where s.centre_id = p_centre and s.deleted_at is null and s.statut = 'validee'
      and s.date_sortie >= current_date - 21 and f.nb > 0
    union all
    select jsonb_build_object(
      'type', 'noms', 'ordre', '3', 'sortie_id', s.id, 'site', s.site_name, 'date', s.date_sortie,
      'date_texte', public.date_fr(s.date_sortie), 'nb', f.nb)
    from public.sorties s
    cross join lateral (
      select count(*) as nb from public.sortie_participants p where p.sortie_id = s.id and p.user_id is null
    ) f
    where s.centre_id = p_centre and s.deleted_at is null and s.statut in ('terminee', 'validee')
      and s.date_sortie >= current_date - 21 and f.nb > 0
  ) t;

  -- Sa saison (année en cours) : les sorties qu'il a encadrées dans ce centre
  select jsonb_build_object(
    'annee', extract(year from current_date)::int,
    'sorties', count(distinct s.id),
    'sorties_mois', count(distinct s.id) filter (where s.date_sortie >= v_mois),
    'plongees', count(p.id) filter (where p.user_id is not null or p.nom_prevu is not null),
    'plongeurs', count(distinct p.user_id),
    'tampons', count(p.id) filter (where p.tamponne_le is not null),
    'minutes', coalesce((select sum(s2.duree_min) from public.sorties s2
                         where s2.centre_id = p_centre and s2.dp_id = v_moi and s2.deleted_at is null
                           and s2.statut in ('terminee', 'validee') and s2.date_sortie >= v_debut), 0))
  into v_stats
  from public.sorties s
  left join public.sortie_participants p on p.sortie_id = s.id and p.user_id is distinct from v_moi
  where s.centre_id = p_centre and s.dp_id = v_moi and s.deleted_at is null
    and s.statut in ('terminee', 'validee') and s.date_sortie >= v_debut;

  -- Les habitués du centre (tous DP confondus)
  select coalesce(jsonb_agg(public.infos_plongeur(h.user_id) || jsonb_build_object('nb', h.nb, 'derniere', h.derniere)
                            order by h.nb desc, h.derniere desc), '[]'::jsonb)
  into v_habitues
  from (
    select p.user_id, count(distinct s.id) as nb, max(s.date_sortie) as derniere
    from public.sortie_participants p
    join public.sorties s on s.id = p.sortie_id
    where s.centre_id = p_centre and s.deleted_at is null and s.statut in ('terminee', 'validee')
      and p.user_id is not null and p.user_id <> s.dp_id
    group by p.user_id
    having count(distinct s.id) >= 2
    order by count(distinct s.id) desc, max(s.date_sortie) desc
    limit 6
  ) h;

  -- Les nouveaux : première sortie avec le centre il y a moins de 30 jours (ou à venir)
  select coalesce(jsonb_agg(public.infos_plongeur(n.user_id) || jsonb_build_object('premiere', n.premiere, 'site', n.site)
                            order by n.premiere desc), '[]'::jsonb)
  into v_nouveaux
  from (
    select distinct on (p.user_id) p.user_id, s.date_sortie as premiere, s.site_name as site
    from public.sortie_participants p
    join public.sorties s on s.id = p.sortie_id
    where s.centre_id = p_centre and s.deleted_at is null and s.statut <> 'annulee'
      and p.user_id is not null and p.user_id <> s.dp_id
    order by p.user_id, s.date_sortie
  ) n
  where n.premiere >= current_date - 30;

  -- Les sites les plus pratiqués par le centre
  select coalesce(jsonb_agg(jsonb_build_object('site', t.site, 'nb', t.nb, 'duree_moy', t.duree_moy, 'prof_max', t.prof_max)
                            order by t.nb desc, t.site), '[]'::jsonb)
  into v_sites
  from (
    select min(s.site_name) as site, count(*) as nb,
           round(avg(s.duree_min))::int as duree_moy, max(s.profondeur_prevue) as prof_max
    from public.sorties s
    where s.centre_id = p_centre and s.deleted_at is null and s.statut in ('terminee', 'validee')
    group by lower(btrim(s.site_name))
    order by count(*) desc
    limit 4
  ) t;

  return jsonb_build_object(
    'prochaine', v_prochaine, 'a_faire', v_a_faire, 'stats', v_stats,
    'habitues', v_habitues, 'nouveaux', v_nouveaux, 'sites', v_sites);
end;
$$;
revoke all on function public.accueil_dp(uuid) from public, anon;
grant execute on function public.accueil_dp(uuid) to authenticated;

-- ------------------------------------------------------------
-- 2. Relancer les plongeurs qui n'ont pas rempli leur fiche (une fois par jour)
-- ------------------------------------------------------------
create or replace function public.relancer_fiches(p_sortie uuid)
returns integer
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  s public.sorties;
  p record;
  v_nb integer := 0;
begin
  if not public.est_dp_sortie(p_sortie) then raise exception 'réservé au directeur de plongée'; end if;
  select * into s from public.sorties where id = p_sortie;
  if s.statut not in ('terminee', 'validee') then raise exception 'termine d''abord la sortie'; end if;
  if exists (select 1 from public.notifications n
             where n.type = 'sortie_relance' and n.donnees ->> 'sortie_id' = p_sortie::text
               and n.created_at > now() - interval '20 hours') then
    raise exception 'déjà relancé aujourd''hui';
  end if;
  for p in select user_id from public.sortie_participants
           where sortie_id = p_sortie and user_id is not null and dive_id is null and not exclu_tampon
             and user_id <> s.dp_id and user_id <> auth.uid() loop
    perform public.notifier(p.user_id, 'sortie_relance',
      'Ta fiche t''attend',
      public.date_fr(s.date_sortie) || ' · ' || s.site_name || '. Elle est déjà préremplie : 1 minute suffit'
        || case when s.centre_id is not null then ' pour avoir ton tampon.' else '.' end,
      '/nouvelle-plongee?sortie=' || p_sortie, jsonb_build_object('sortie_id', p_sortie));
    v_nb := v_nb + 1;
  end loop;
  return v_nb;
end;
$$;
revoke all on function public.relancer_fiches(uuid) from public, anon;
grant execute on function public.relancer_fiches(uuid) to authenticated;

-- ------------------------------------------------------------
-- 3. La fiche de sécurité de la sortie (à imprimer ou garder en PDF)
-- ------------------------------------------------------------
create or replace function public.fiche_securite(p_sortie uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  s public.sorties;
  c public.centres;
begin
  if not public.est_dp_sortie(p_sortie) then raise exception 'réservé au directeur de plongée'; end if;
  select * into s from public.sorties where id = p_sortie;
  select * into c from public.centres where id = s.centre_id;
  return jsonb_build_object(
    'id', s.id, 'date', s.date_sortie, 'date_texte', public.date_fr(s.date_sortie), 'heure', s.heure,
    'site', s.site_name, 'lieu', s.site_location, 'bateau', s.bateau, 'profondeur_prevue', s.profondeur_prevue,
    'consignes', s.consignes, 'statut', s.statut, 'duree_min', s.duree_min, 'temp_fond_c', s.temp_fond_c,
    'visibilite_m', s.visibilite_m,
    'centre', case when c.id is null then null else jsonb_build_object('nom', c.nom, 'ville', c.ville) end,
    'dp', public.infos_plongeur(s.dp_id) || jsonb_build_object(
            'nom', (select nullif(to_jsonb(pr) ->> 'nom', '') from public.profiles pr where pr.id = s.dp_id)),
    'plongeurs', coalesce((
      select jsonb_agg(jsonb_build_object(
               'palanquee', q.numero,
               'user_id', p.user_id,
               'prenom', coalesce(public.infos_plongeur(p.user_id) ->> 'prenom', p.nom_prevu),
               'nom', (select nullif(to_jsonb(pr) ->> 'nom', '') from public.profiles pr where pr.id = p.user_id),
               'niveau', public.infos_plongeur(p.user_id) ->> 'niveau',
               'guide', p.user_id is not null and p.user_id = q.guide_id,
               'prevu', p.user_id is null,
               'prof_max', d.max_depth_m, 'duree', d.duration_min, 'immersion', d.start_time, 'sortie', d.end_time)
             order by q.numero nulls last, (p.user_id = q.guide_id) desc nulls last, p.created_at)
      from public.sortie_participants p
      left join public.sortie_palanquees q on q.id = p.palanquee_id
      left join public.dives d on d.id = p.dive_id and d.deleted_at is null
      where p.sortie_id = s.id), '[]'::jsonb)
  );
end;
$$;
revoke all on function public.fiche_securite(uuid) from public, anon;
grant execute on function public.fiche_securite(uuid) to authenticated;
