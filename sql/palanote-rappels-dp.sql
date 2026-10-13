-- ============================================================
-- Palanote — Les rappels du directeur de plongée (notifications in-app)
--
-- Le DP reçoit dans sa cloche :
--   · matériel : contrôle à prévoir (J-30, J-7) et contrôle dépassé (inspection des blocs,
--     révision des détendeurs, du bateau…) ;
--   · adhérents : certificats médicaux qui expirent dans le mois ou viennent d'expirer
--     (un rappel groupé par semaine) ;
--   · ses sorties : à préparer la veille (personne d'inscrit, plongeurs non placés,
--     palanquée sans guide, pas de bateau), à clôturer, à tamponner.
-- Les rappels sont créés quand le DP ouvre l'app (pas besoin de tâche planifiée), une seule
-- fois chacun : la table rappels_envoyes garde la trace de ce qui est déjà parti.
--
-- Prérequis : palanote-sorties-club.sql (notifier, date_fr), palanote-planning-club.sql
--             (materiel, est_dp_centre) et palanote-import-excel.sql (centre_adherents).
-- À coller dans Supabase → SQL Editor → Run. Relançable sans risque.
-- ============================================================

create table if not exists public.rappels_envoyes (
  user_id uuid not null references auth.users(id) on delete cascade,
  cle text not null, -- ex. « materiel:<id>:2026-11-03:j7 »
  created_at timestamptz not null default now(),
  primary key (user_id, cle)
);
alter table public.rappels_envoyes enable row level security; -- aucune lecture directe : seules les fonctions y écrivent
grant all on public.rappels_envoyes to service_role;

-- Envoie la notification si ce rappel n'est pas déjà parti ; renvoie 1 si envoyé
create or replace function public.rappel_une_fois(p_user uuid, p_cle text, p_type text, p_titre text, p_texte text, p_lien text,
                                                  p_donnees jsonb default '{}'::jsonb)
returns integer
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  insert into public.rappels_envoyes (user_id, cle) values (p_user, p_cle) on conflict do nothing;
  if not found then return 0; end if;
  perform public.notifier(p_user, p_type, p_titre, p_texte, p_lien, p_donnees);
  return 1;
end;
$$;
revoke all on function public.rappel_une_fois(uuid, text, text, text, text, text, jsonb) from public, anon, authenticated;

-- Appelée par l'app du DP à l'ouverture : crée les rappels du jour, renvoie leur nombre
create or replace function public.generer_rappels_dp()
returns integer
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_moi uuid := auth.uid();
  v_nb integer := 0;
  c record;
  m record;
  s record;
  v_jours integer;
  v_etape text;
  v_certifs integer;
  v_expires integer;
  v_soucis text[];
begin
  if v_moi is null then return 0; end if;

  for c in select ce.id, ce.nom from public.centre_membres cm join public.centres ce on ce.id = cm.centre_id
           where cm.user_id = v_moi and cm.role = 'dp' loop

    -- 1. Matériel : contrôle à J-30, à J-7, puis dépassé
    for m in select id, libelle, type, prochain_controle from public.materiel
             where centre_id = c.id and deleted_at is null and prochain_controle is not null
               and prochain_controle <= current_date + 30 loop
      v_jours := m.prochain_controle - current_date;
      v_etape := case when v_jours < 0 then 'depasse' when v_jours <= 7 then 'j7' else 'j30' end;
      v_nb := v_nb + public.rappel_une_fois(v_moi, 'materiel:' || m.id || ':' || m.prochain_controle || ':' || v_etape,
        'rappel_materiel',
        case when v_etape = 'depasse' then 'Contrôle dépassé : ' || m.libelle
             else 'Contrôle à prévoir : ' || m.libelle end,
        case when v_etape = 'depasse' then 'Le contrôle était prévu le ' || public.date_fr(m.prochain_controle) || '. Pense à le faire, puis à mettre à jour la date.'
             when v_jours = 0 then 'Le contrôle est prévu aujourd''hui.'
             else 'Le contrôle est prévu le ' || public.date_fr(m.prochain_controle) || ' (dans ' || v_jours || ' jour' || case when v_jours > 1 then 's' else '' end || ').' end,
        '/club/materiel', jsonb_build_object('materiel_id', m.id, 'centre_id', c.id));
    end loop;

    -- 2. Certificats médicaux des adhérents : un rappel groupé par semaine
    select count(*) filter (where certificat_fin >= current_date),
           count(*) filter (where certificat_fin < current_date)
      into v_certifs, v_expires
      from public.centre_adherents
     where centre_id = c.id and certificat_fin between current_date - 60 and current_date + 30;
    if v_certifs + v_expires > 0 then
      v_nb := v_nb + public.rappel_une_fois(v_moi, 'certificats:' || c.id || ':' || to_char(current_date, 'IYYY-IW'),
        'rappel_certificat',
        'Certificats médicaux à renouveler',
        concat_ws(' · ',
          case when v_expires > 0 then v_expires || ' expiré' || case when v_expires > 1 then 's' else '' end end,
          case when v_certifs > 0 then v_certifs || ' expire' || case when v_certifs > 1 then 'nt' else '' end || ' dans le mois' end)
          || ' (' || c.nom || ').',
        '/club/membres', jsonb_build_object('centre_id', c.id));
    end if;
  end loop;

  -- 3. Mes sorties
  for s in select so.id, so.date_sortie, so.site_name, so.statut, so.bateau_id, so.centre_id from public.sorties so
           where so.dp_id = v_moi and so.deleted_at is null
             and ((so.statut = 'prevue' and so.date_sortie between current_date - 7 and current_date + 1)
               or (so.statut = 'terminee' and so.date_sortie between current_date - 30 and current_date - 1)) loop
    if s.statut = 'prevue' and s.date_sortie >= current_date then
      -- À préparer : la veille ou le jour même
      v_soucis := array_remove(array[
        case when not exists (select 1 from public.sortie_participants p where p.sortie_id = s.id) then 'personne d''inscrit' end,
        case when exists (select 1 from public.sortie_participants p where p.sortie_id = s.id and p.palanquee_id is null)
             then 'des plongeurs sans palanquée' end,
        case when exists (select 1 from public.sortie_palanquees q where q.sortie_id = s.id and q.guide_id is null
                            and exists (select 1 from public.sortie_participants p where p.palanquee_id = q.id))
             then 'une palanquée sans guide' end,
        case when s.bateau_id is null and s.centre_id is not null
                  and exists (select 1 from public.materiel b where b.centre_id = s.centre_id and b.type = 'bateau' and b.deleted_at is null)
             then 'pas de bateau choisi' end], null);
      if cardinality(v_soucis) > 0 then
        v_nb := v_nb + public.rappel_une_fois(v_moi, 'preparer:' || s.id || ':' || s.date_sortie,
          'rappel_sortie',
          case when s.date_sortie = current_date then 'Aujourd''hui : ' else 'Demain : ' end || s.site_name || ' à préparer',
          initcap(left(array_to_string(v_soucis, ', '), 1)) || substr(array_to_string(v_soucis, ', '), 2) || '.',
          '/club/planning?sortie=' || s.id, jsonb_build_object('sortie_id', s.id));
      end if;
    elsif s.statut = 'prevue' then
      -- Passée mais pas clôturée
      v_nb := v_nb + public.rappel_une_fois(v_moi, 'cloturer:' || s.id,
        'rappel_cloture', 'Sortie à clôturer : ' || s.site_name,
        'La sortie du ' || public.date_fr(s.date_sortie) || ' est passée : indique la durée et l''eau pour envoyer les fiches.',
        '/club/sortie?id=' || s.id, jsonb_build_object('sortie_id', s.id));
    else
      -- Terminée depuis au moins un jour, pas encore tamponnée
      v_nb := v_nb + public.rappel_une_fois(v_moi, 'tamponner:' || s.id,
        'rappel_tampon', 'Carnets à tamponner : ' || s.site_name,
        'Les plongeurs du ' || public.date_fr(s.date_sortie) || ' attendent ton tampon.',
        '/club/sortie?id=' || s.id, jsonb_build_object('sortie_id', s.id));
    end if;
  end loop;

  return v_nb;
end;
$$;
revoke all on function public.generer_rappels_dp() from public, anon;
grant execute on function public.generer_rappels_dp() to authenticated;
