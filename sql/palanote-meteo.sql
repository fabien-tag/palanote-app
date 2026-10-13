-- ============================================================
-- Palanote — Annuler ou reporter des sorties en un geste (météo, mer, bateau…)
--
-- Le DP choisit une ou plusieurs sorties (souvent toute la journée), le motif
-- (météo, mer formée, vent, visibilité, bateau indisponible, autre), un message
-- facultatif, et annule ou reporte à une autre date. Tous les inscrits, et les
-- plongeurs en liste d'attente, sont prévenus dans leur cloche avec le motif.
-- Le motif reste sur la sortie (il apparaît dans l'export de la saison).
--
-- Prérequis : palanote-sorties-club.sql, palanote-planning-club.sql
--             et palanote-liste-attente.sql.
-- À coller dans Supabase → SQL Editor → Run. Relançable sans risque.
-- ============================================================

alter table public.sorties add column if not exists motif_changement text; -- « Météo », « Mer formée »… + message du DP

create or replace function public.annuler_reporter_sorties(
  p_sorties uuid[], p_action text, p_motif text, p_message text default null,
  p_date date default null, p_heure time default null)
returns integer
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_id uuid;
  s public.sorties;
  p record;
  v_motif text := left(coalesce(nullif(btrim(p_motif), ''), 'Autre'), 40);
  v_message text := nullif(btrim(left(coalesce(p_message, ''), 400)), '');
  v_texte text;
  v_nb integer := 0;
begin
  if p_action not in ('annuler', 'reporter') then raise exception 'action inconnue'; end if;
  if p_action = 'reporter' and (p_date is null or p_date < current_date) then raise exception 'choisis une nouvelle date à venir'; end if;
  if coalesce(array_length(p_sorties, 1), 0) = 0 or array_length(p_sorties, 1) > 20 then raise exception 'choisis entre 1 et 20 sorties'; end if;

  foreach v_id in array p_sorties loop
    select * into s from public.sorties where id = v_id and deleted_at is null;
    if not found or not public.est_dp_sortie(v_id) then raise exception 'réservé au directeur de plongée'; end if;
    if s.statut <> 'prevue' then raise exception 'la sortie % n''est plus prévue', s.site_name; end if;

    if p_action = 'annuler' then
      update public.sorties set statut = 'annulee', motif_changement = v_motif || coalesce(' : ' || v_message, '') where id = v_id;
      v_texte := public.texte_sortie(v_id) || '.' || coalesce(' ' || v_message, '');
      for p in select user_id from public.sortie_participants where sortie_id = v_id and user_id is not null and user_id <> auth.uid()
               union select user_id from public.sortie_attente where sortie_id = v_id loop
        perform public.notifier(p.user_id, 'sortie_annulee', 'Sortie annulée · ' || lower(v_motif), v_texte,
          '/sortie?id=' || v_id, jsonb_build_object('sortie_id', v_id, 'motif', v_motif));
        v_nb := v_nb + 1;
      end loop;
      delete from public.sortie_attente where sortie_id = v_id;
    else
      update public.sorties set date_sortie = p_date, heure = coalesce(p_heure, heure),
                                motif_changement = v_motif || coalesce(' : ' || v_message, '') where id = v_id;
      v_texte := public.texte_sortie(v_id) || ' (au lieu du ' || public.date_fr(s.date_sortie)
                 || coalesce(' à ' || to_char(s.heure, 'HH24"h"MI'), '') || ').' || coalesce(' ' || v_message, '');
      for p in select user_id from public.sortie_participants where sortie_id = v_id and user_id is not null and user_id <> auth.uid()
               union select user_id from public.sortie_attente where sortie_id = v_id loop
        perform public.notifier(p.user_id, 'sortie_modifiee', 'Sortie reportée · ' || lower(v_motif), v_texte,
          '/sortie?id=' || v_id, jsonb_build_object('sortie_id', v_id, 'motif', v_motif));
        v_nb := v_nb + 1;
      end loop;
    end if;
  end loop;
  return v_nb;
end;
$$;
revoke all on function public.annuler_reporter_sorties(uuid[], text, text, text, date, time) from public, anon;
grant execute on function public.annuler_reporter_sorties(uuid[], text, text, text, date, time) to authenticated;
