-- ============================================================
-- Palanote — L'export Excel de la saison (directeur de plongée)
--
-- Toutes les sorties du centre sur une période (année civile ou saison de septembre à août),
-- les plongées de chaque plongeur (sorties Palanote et historique importé d'Excel),
-- et le bilan par plongeur. L'app en fait un fichier Excel à 4 onglets.
--
-- Prérequis : palanote-sorties-club.sql, palanote-planning-club.sql,
--             palanote-import-excel.sql et palanote-privilegies.sql.
-- À coller dans Supabase → SQL Editor → Run. Relançable sans risque.
-- ============================================================

create or replace function public.export_saison(p_centre uuid, p_debut date, p_fin date)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.est_dp_centre(p_centre) then raise exception 'réservé aux directeurs de plongée du centre'; end if;
  if p_fin < p_debut or p_fin - p_debut > 400 then raise exception 'période invalide (13 mois au plus)'; end if;

  return jsonb_build_object(
    'centre', (select nom from public.centres where id = p_centre),

    -- Onglet « Sorties »
    'sorties', coalesce((
      select jsonb_agg(jsonb_build_object(
        'date', s.date_sortie, 'heure', to_char(s.heure, 'HH24:MI'), 'site', s.site_name, 'lieu', s.site_location,
        'bateau', s.bateau, 'dp', public.infos_plongeur(s.dp_id) ->> 'prenom',
        'statut', case s.statut when 'prevue' then 'Prévue' when 'terminee' then 'À tamponner'
                                when 'validee' then 'Tamponnée' when 'annulee' then 'Annulée' else s.statut end,
        'melange', s.melange, 'reservee', s.reservee_privilegies,
        'motif', to_jsonb(s) ->> 'motif_changement', -- annulation ou report (palanote-meteo.sql)
        'profondeur_prevue', s.profondeur_prevue, 'duree', s.duree_min, 'temperature', s.temp_fond_c, 'visibilite', s.visibilite_m,
        'plongeurs', (select count(*) from public.sortie_participants p where p.sortie_id = s.id),
        'palanquees', (select count(*) from public.sortie_palanquees q where q.sortie_id = s.id
                         and exists (select 1 from public.sortie_participants p where p.palanquee_id = q.id)),
        'tampons', (select count(*) from public.sortie_participants p where p.sortie_id = s.id and p.tamponne_le is not null))
        order by s.date_sortie, s.heure nulls last)
      from public.sorties s
      where s.centre_id = p_centre and s.deleted_at is null and s.date_sortie between p_debut and p_fin), '[]'::jsonb),

    -- Onglet « Plongées » : une ligne par plongeur et par plongée
    'plongees', coalesce((
      select jsonb_agg(x order by x ->> 'date', x ->> 'site', x ->> 'plongeur') from (
        select jsonb_build_object(
          'date', s.date_sortie, 'site', s.site_name,
          'plongeur', coalesce(public.infos_plongeur(p.user_id) ->> 'prenom', p.nom_prevu),
          'nom', (select nullif(to_jsonb(pr) ->> 'nom', '') from public.profiles pr where pr.id = p.user_id),
          'niveau', public.infos_plongeur(p.user_id) ->> 'niveau',
          'palanquee', q.numero,
          'role', case when p.user_id is not null and p.user_id = q.guide_id then 'GP' else 'Plongeur' end,
          'profondeur', d.max_depth_m, 'duree', d.duration_min,
          'tamponnee', p.tamponne_le is not null,
          'source', 'Palanote') as x
        from public.sortie_participants p
        join public.sorties s on s.id = p.sortie_id
        left join public.sortie_palanquees q on q.id = p.palanquee_id
        left join public.dives d on d.id = p.dive_id and d.deleted_at is null
        where s.centre_id = p_centre and s.deleted_at is null and s.statut <> 'annulee'
          and s.date_sortie between p_debut and p_fin
        union all
        select jsonb_build_object(
          'date', h.date_plongee, 'site', h.site, 'plongeur', a.prenom, 'nom', a.nom, 'niveau', a.niveau,
          'palanquee', h.palanquee, 'role', h.role, 'profondeur', h.profondeur, 'duree', h.duree,
          'tamponnee', null, 'source', 'Import Excel')
        from public.adherent_plongees h join public.centre_adherents a on a.id = h.adherent_id
        where h.centre_id = p_centre and h.date_plongee between p_debut and p_fin) t), '[]'::jsonb),

    -- Onglet « Plongeurs » : le bilan de chacun sur la période
    'plongeurs', coalesce((
      with lignes as (
        select coalesce(p.user_id::text, 'prevu:' || lower(p.nom_prevu)) as cle, p.user_id, null::uuid as adherent_id,
               s.date_sortie as jour, d.max_depth_m as prof, p.tamponne_le is not null as tampon
        from public.sortie_participants p
        join public.sorties s on s.id = p.sortie_id
        left join public.dives d on d.id = p.dive_id and d.deleted_at is null
        where s.centre_id = p_centre and s.deleted_at is null and s.statut <> 'annulee' and s.date_sortie between p_debut and p_fin
        union all
        select coalesce(a.user_id::text, 'adherent:' || a.id), a.user_id, a.id, h.date_plongee, h.profondeur, false
        from public.adherent_plongees h join public.centre_adherents a on a.id = h.adherent_id
        where h.centre_id = p_centre and h.date_plongee between p_debut and p_fin
      ), bilan as (
        select cle, max(user_id::text)::uuid as user_id, max(adherent_id::text)::uuid as adherent_id,
               count(*) as plongees, count(*) filter (where tampon) as tampons, max(prof) as prof_max,
               min(jour) as premiere, max(jour) as derniere
        from lignes group by cle
      )
      select jsonb_agg(jsonb_build_object(
        'prenom', coalesce(public.infos_plongeur(b.user_id) ->> 'prenom', a.prenom,
                           (select p.nom_prevu from public.sortie_participants p join public.sorties s on s.id = p.sortie_id
                            where s.centre_id = p_centre and 'prevu:' || lower(p.nom_prevu) = b.cle limit 1)),
        'nom', coalesce((select nullif(to_jsonb(pr) ->> 'nom', '') from public.profiles pr where pr.id = b.user_id), a.nom),
        'niveau', coalesce(public.infos_plongeur(b.user_id) ->> 'niveau', a.niveau),
        'plongees', b.plongees, 'tampons', b.tampons, 'prof_max', b.prof_max,
        'premiere', b.premiere, 'derniere', b.derniere,
        'compte', b.user_id is not null,
        'adherent', a.id is not null,
        'licence', a.licence, 'certificat_fin', a.certificat_fin, 'privilegie', coalesce(a.privilegie, false))
        order by b.plongees desc, b.derniere desc)
      from bilan b
      left join lateral (
        select * from public.centre_adherents x
        where x.centre_id = p_centre and (x.id = b.adherent_id or (b.user_id is not null and x.user_id = b.user_id))
        limit 1) a on true), '[]'::jsonb)
  );
end;
$$;
revoke all on function public.export_saison(uuid, date, date) from public, anon;
grant execute on function public.export_saison(uuid, date, date) to authenticated;
