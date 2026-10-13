-- ============================================================
-- Palanote — Le rappel de la veille pour le plongeur
--
-- La veille (ou le matin même) d'une sortie où il est inscrit, le plongeur reçoit dans sa
-- cloche : l'heure, le lieu, le bateau, le mélange et les consignes du DP, plus ce qu'il doit
-- régler avant de partir (certificat médical expiré à la date de la sortie, sortie au Nitrox
-- ou au Trimix sans brevet dans son passeport).
-- Créé quand le plongeur ouvre l'app, une seule fois par sortie.
--
-- Prérequis : palanote-rappels-dp.sql (rappels_envoyes, rappel_une_fois),
--             palanote-passeport.sql (certificat_fin, plongeur_brevets)
--             et palanote-privilegies.sql (sorties.melange).
-- À coller dans Supabase → SQL Editor → Run. Relançable sans risque.
-- ============================================================

create or replace function public.generer_rappels_plongeur()
returns integer
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_moi uuid := auth.uid();
  v_nb integer := 0;
  v_certif date;
  v_certifs text[];
  s record;
  v_infos text[];
  v_regler text[];
begin
  if v_moi is null then return 0; end if;
  select certificat_fin, coalesce(certifications, '{}') into v_certif, v_certifs from public.profiles where id = v_moi;

  for s in select so.id, so.date_sortie, so.heure, so.site_name, so.site_location, so.bateau, so.melange, so.consignes,
                  so.profondeur_prevue, c.nom as centre
           from public.sortie_participants p
           join public.sorties so on so.id = p.sortie_id
           left join public.centres c on c.id = so.centre_id
           where p.user_id = v_moi and so.deleted_at is null and so.statut = 'prevue'
             and so.date_sortie between current_date and current_date + 1 loop
    v_infos := array_remove(array[
      s.site_location,
      s.bateau,
      case when s.profondeur_prevue is not null then trim(trailing '.' from trim(trailing '0' from s.profondeur_prevue::text)) || ' m prévus' end,
      s.melange], null);
    v_regler := array_remove(array[
      case when v_certif is null then 'indique la date de ton certificat médical dans ton passeport'
           when v_certif < s.date_sortie then 'ton certificat médical sera expiré : apporte le nouveau' end,
      case when s.melange = 'Trimix' and not exists (select 1 from public.plongeur_brevets b where b.user_id = v_moi and b.type = 'trimix')
                and not ('Trimix' = any(v_certifs))
             then 'sortie au Trimix : ajoute ta carte Trimix à ton passeport'
           when s.melange = 'Nitrox' and not exists (select 1 from public.plongeur_brevets b where b.user_id = v_moi and b.type in ('nitrox', 'trimix'))
                and not (v_certifs && array['Nitrox', 'Trimix'])
             then 'sortie au Nitrox : ajoute ta carte Nitrox à ton passeport' end], null);
    v_nb := v_nb + public.rappel_une_fois(v_moi, 'veille:' || s.id || ':' || s.date_sortie,
      'rappel_veille',
      case when s.date_sortie = current_date then 'Aujourd''hui' else 'Demain' end
        || coalesce(' à ' || to_char(s.heure, 'HH24"h"MI'), '') || ' : ' || s.site_name,
      concat_ws(' ',
        nullif(array_to_string(v_infos, ' · '), '') || '.',
        case when s.consignes is not null then 'Consignes : ' || s.consignes || case when right(s.consignes, 1) in ('.', '!', '?') then '' else '.' end end,
        case when cardinality(v_regler) > 0 then 'À régler : ' || array_to_string(v_regler, ' ; ') || '.' end),
      case when cardinality(v_regler) > 0 then '/moi/passeport' else '/sortie?id=' || s.id end,
      jsonb_build_object('sortie_id', s.id, 'centre', s.centre));
  end loop;
  return v_nb;
end;
$$;
revoke all on function public.generer_rappels_plongeur() from public, anon;
grant execute on function public.generer_rappels_plongeur() to authenticated;
