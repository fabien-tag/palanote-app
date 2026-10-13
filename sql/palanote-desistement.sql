-- ============================================================
-- Palanote — Le désistement d'un plongeur, validé par le DP
--
-- Le plongeur ne peut plus venir (même au dernier moment) : il prévient le DP depuis
-- sa sortie, avec un motif. Le DP reçoit une notification (« au dernier moment » si la
-- sortie est dans moins de 24 h) et voit le désistement dans sa sortie. Il valide en un
-- geste : le plongeur est retiré de sa palanquée et de la sortie, la place libérée profite
-- au premier de la liste d'attente. Tant que ce n'est pas validé, le plongeur peut revenir
-- sur sa décision (« Finalement je viens »).
--
-- Prérequis : palanote-sorties-club.sql (sortie_participants, notifier, texte_sortie)
--             et palanote-liste-attente.sql (la place libérée fait avancer la liste).
-- À coller dans Supabase → SQL Editor → Run. Relançable sans risque.
-- ============================================================

alter table public.sortie_participants add column if not exists desiste_le timestamptz;
alter table public.sortie_participants add column if not exists desiste_motif text;

-- Le plongeur prévient qu'il ne vient pas
create or replace function public.se_desister(p_sortie uuid, p_motif text default null)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  s public.sorties;
  p public.sortie_participants;
  v_motif text := nullif(btrim(left(coalesce(p_motif, ''), 200)), '');
  v_dernier boolean;
begin
  select * into s from public.sorties where id = p_sortie and deleted_at is null;
  if not found then raise exception 'sortie introuvable'; end if;
  if s.statut <> 'prevue' then raise exception 'la sortie n''est plus prévue'; end if;
  select * into p from public.sortie_participants where sortie_id = p_sortie and user_id = auth.uid();
  if not found then raise exception 'tu n''es pas inscrit à cette sortie'; end if;
  if p.desiste_le is not null then return; end if;
  update public.sortie_participants set desiste_le = now(), desiste_motif = v_motif where id = p.id;
  if s.dp_id <> auth.uid() then
    v_dernier := (s.date_sortie + coalesce(s.heure, '09:00'::time)) at time zone 'Europe/Paris' < now() + interval '24 hours';
    perform public.notifier(s.dp_id, 'sortie_desistement',
      (public.infos_plongeur(auth.uid()) ->> 'prenom') || ' se désiste' || case when v_dernier then ' au dernier moment' else '' end,
      public.texte_sortie(p_sortie) || '.' || coalesce(' Motif : ' || v_motif || '.', '') || ' Valide son retrait dans la sortie.',
      '/club/sortie?id=' || p_sortie, jsonb_build_object('sortie_id', p_sortie, 'participant_id', p.id));
  end if;
end;
$$;
revoke all on function public.se_desister(uuid, text) from public, anon;
grant execute on function public.se_desister(uuid, text) to authenticated;

-- Finalement il vient (tant que le DP n'a pas validé)
create or replace function public.annuler_desistement(p_sortie uuid)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  s public.sorties;
  p public.sortie_participants;
begin
  select * into s from public.sorties where id = p_sortie;
  select * into p from public.sortie_participants where sortie_id = p_sortie and user_id = auth.uid();
  if not found or p.desiste_le is null then return; end if;
  update public.sortie_participants set desiste_le = null, desiste_motif = null where id = p.id;
  if s.dp_id <> auth.uid() then
    perform public.notifier(s.dp_id, 'sortie_rejointe', (public.infos_plongeur(auth.uid()) ->> 'prenom') || ' vient finalement',
      public.texte_sortie(p_sortie) || ' : il annule son désistement.', '/club/sortie?id=' || p_sortie, jsonb_build_object('sortie_id', p_sortie));
  end if;
end;
$$;
revoke all on function public.annuler_desistement(uuid) from public, anon;
grant execute on function public.annuler_desistement(uuid) to authenticated;

-- Le DP valide : le plongeur est retiré (palanquée et sortie), la liste d'attente avance
create or replace function public.valider_desistement(p_participant uuid)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  p public.sortie_participants;
begin
  select * into p from public.sortie_participants where id = p_participant;
  if not found then return; end if;
  if not public.est_dp_sortie(p.sortie_id) then raise exception 'réservé au directeur de plongée'; end if;
  if p.desiste_le is null then raise exception 'ce plongeur ne s''est pas désisté'; end if;
  -- Le guide qui part n'est plus guide de sa palanquée
  update public.sortie_palanquees set guide_id = null where id = p.palanquee_id and guide_id = p.user_id;
  delete from public.sortie_participants where id = p_participant;
  if p.user_id is not null then
    perform public.notifier(p.user_id, 'desistement_valide', 'Désistement pris en compte',
      public.texte_sortie(p.sortie_id) || ' : le DP t''a retiré de la sortie. À bientôt sous l''eau !',
      '/carnet', jsonb_build_object('sortie_id', p.sortie_id));
  end if;
end;
$$;
revoke all on function public.valider_desistement(uuid) from public, anon;
grant execute on function public.valider_desistement(uuid) to authenticated;

-- Les désistements d'une sortie : tous pour le DP, le sien pour le plongeur
create or replace function public.desistements_sortie(p_sortie uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'participant_id', p.id, 'user_id', p.user_id,
           'prenom', coalesce(public.infos_plongeur(p.user_id) ->> 'prenom', p.nom_prevu),
           'le', p.desiste_le, 'motif', p.desiste_motif,
           'palanquee', (select numero from public.sortie_palanquees q where q.id = p.palanquee_id))
           order by p.desiste_le), '[]'::jsonb)
  from public.sortie_participants p
  where p.sortie_id = p_sortie and p.desiste_le is not null
    and (public.est_dp_sortie(p_sortie) or p.user_id = auth.uid());
$$;
revoke all on function public.desistements_sortie(uuid) from public, anon;
grant execute on function public.desistements_sortie(uuid) to authenticated;
