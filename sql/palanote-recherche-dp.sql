-- ============================================================
-- Palanote — La recherche de l'espace DP
--
-- Une seule barre pour tout retrouver dans son centre : plongeurs (adhérents et venus en
-- sortie), équipe (guides, pilotes, gonfleurs…), matériel, sorties et sites.
-- Sans tenir compte des accents ni des majuscules (« lea » trouve « Léa »).
--
-- Prérequis : palanote-sorties-club.sql, palanote-planning-club.sql (est_dp_centre,
--             centre_equipe, materiel) et palanote-import-excel.sql (centre_adherents).
-- À coller dans Supabase → SQL Editor → Run. Relançable sans risque.
-- ============================================================

-- Texte comparable : minuscules, sans accents
create or replace function public.texte_simple(p text)
returns text
language sql
immutable
set search_path = public
as $$
  select lower(translate(coalesce(p, ''),
    'àâäáãåçéèêëíìîïñóòôöõúùûüýÿœÀÂÄÁÃÅÇÉÈÊËÍÌÎÏÑÓÒÔÖÕÚÙÛÜÝŸŒ',
    'aaaaaaceeeeiiiinooooouuuuyyoaaaaaaceeeeiiiinooooouuuuyyo'));
$$;

create or replace function public.recherche_dp(p_centre uuid, p_q text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  q text := '%' || public.texte_simple(btrim(coalesce(p_q, ''))) || '%';
begin
  if not public.est_dp_centre(p_centre) then raise exception 'réservé aux directeurs de plongée du centre'; end if;
  if char_length(btrim(coalesce(p_q, ''))) < 2 then return '{}'::jsonb; end if;

  return jsonb_build_object(
    -- Plongeurs : adhérents du club, puis plongeurs venus en sortie avec un compte
    'plongeurs', coalesce((select jsonb_agg(x) from (
      select * from (
        select jsonb_build_object('id', a.id, 'type', 'adherent', 'titre', concat_ws(' ', a.prenom, a.nom),
                 'texte', concat_ws(' · ', a.niveau, case when a.licence is not null then 'licence ' || a.licence end, 'adhérent'),
                 'user_id', a.user_id) as x
        from public.centre_adherents a
        where a.centre_id = p_centre
          and public.texte_simple(concat_ws(' ', a.prenom, a.nom, a.niveau, a.licence, a.email)) like q
        union all
        select jsonb_build_object('id', u.user_id, 'type', 'plongeur', 'titre', concat_ws(' ', i ->> 'prenom', u.nom),
                 'texte', concat_ws(' · ', i ->> 'niveau', u.nb || ' sortie' || case when u.nb > 1 then 's' else '' end || ' avec le centre'),
                 'user_id', u.user_id)
        from (
          select p.user_id, count(distinct p.sortie_id) as nb,
                 (select nullif(to_jsonb(pr) ->> 'nom', '') from public.profiles pr where pr.id = p.user_id) as nom
          from public.sortie_participants p join public.sorties s on s.id = p.sortie_id
          where s.centre_id = p_centre and s.deleted_at is null and p.user_id is not null
            and not exists (select 1 from public.centre_adherents a where a.centre_id = p_centre and a.user_id = p.user_id)
          group by p.user_id
        ) u cross join lateral (select public.infos_plongeur(u.user_id) as i) inf
        where public.texte_simple(concat_ws(' ', i ->> 'prenom', u.nom, i ->> 'niveau', i ->> 'club')) like q
      ) t limit 8) r), '[]'::jsonb),

    'equipe', coalesce((select jsonb_agg(jsonb_build_object('id', e.id, 'titre', e.nom,
                 'texte', concat_ws(' · ', case e.role when 'dp' then 'Directeur de plongée' when 'guide' then 'Guide de palanquée'
                                                       when 'pilote' then 'Pilote' when 'gonfleur' then 'Gonfleur' else 'Équipe' end,
                                    e.niveau, e.telephone)) order by e.nom)
      from (select * from public.centre_equipe
            where centre_id = p_centre and actif
              and public.texte_simple(concat_ws(' ', nom, niveau, telephone, role)) like q
            limit 6) e), '[]'::jsonb),

    'materiel', coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'titre', m.libelle,
                 'texte', concat_ws(' · ',
                   case m.type when 'bateau' then 'Bateau' when 'bloc' then 'Bloc' when 'gilet' then 'Gilet' when 'detendeur' then 'Détendeur'
                               when 'combinaison' then 'Combinaison' when 'ordinateur' then 'Ordinateur' else 'Matériel' end,
                   case when m.type = 'bateau' and m.places is not null then m.places || ' places' when m.quantite > 1 then '×' || m.quantite end,
                   case when m.prochain_controle is not null then 'contrôle le ' || to_char(m.prochain_controle, 'DD/MM/YYYY') end)) order by m.libelle)
      from (select * from public.materiel
            where centre_id = p_centre and deleted_at is null
              and public.texte_simple(concat_ws(' ', libelle, type, note)) like q
            limit 6) m), '[]'::jsonb),

    -- Sorties : les prochaines d'abord, puis les plus récentes
    'sorties', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'titre', s.site_name,
                 'texte', concat_ws(' · ', public.date_fr(s.date_sortie), to_char(s.heure, 'HH24"h"MI'), s.site_location,
                   case s.statut when 'prevue' then 'prévue' when 'terminee' then 'à tamponner' when 'validee' then 'tamponnée' when 'annulee' then 'annulée' end),
                 'date', s.date_sortie) order by (s.date_sortie < current_date), abs(s.date_sortie - current_date))
      from (select * from public.sorties
            where centre_id = p_centre and deleted_at is null
              and public.texte_simple(concat_ws(' ', site_name, site_location, bateau, consignes, public.date_fr(date_sortie))) like q
            order by (date_sortie < current_date), abs(date_sortie - current_date) limit 6) s), '[]'::jsonb),

    'sites', coalesce((select jsonb_agg(jsonb_build_object('titre', x.site, 'texte', concat_ws(' · ', x.lieu, x.nb || ' sortie' || case when x.nb > 1 then 's' else '' end)) order by x.nb desc)
      from (select min(site_name) as site, min(site_location) as lieu, count(*) as nb
            from public.sorties
            where centre_id = p_centre and deleted_at is null and statut <> 'annulee'
              and public.texte_simple(concat_ws(' ', site_name, site_location)) like q
            group by public.texte_simple(site_name) limit 5) x), '[]'::jsonb)
  );
end;
$$;
revoke all on function public.recherche_dp(uuid, text) from public, anon;
grant execute on function public.recherche_dp(uuid, text) to authenticated;
