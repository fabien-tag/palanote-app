-- ============================================================
-- Palanote — Suivi des palanquées sur le bateau (facultatif)
--
-- Le jour J, si quelqu'un a le temps (le DP conduit souvent le bateau et aide à remonter
-- le matériel : rien n'est obligatoire), deux gestes par palanquée :
--   · « À l'eau » note l'heure d'immersion ;
--   · « Sortie de l'eau » note l'heure de retour.
-- Une palanquée encore à l'eau après la durée prévue passe en orange, puis en rouge.
-- Les heures remplissent la fiche de sécurité, et la durée est proposée à la fin.
--
-- Prérequis : palanote-sorties-club.sql (sortie_palanquees, est_dp_sortie).
-- À coller dans Supabase → SQL Editor → Run. Relançable sans risque.
-- ============================================================

alter table public.sortie_palanquees add column if not exists immersion_le timestamptz;
alter table public.sortie_palanquees add column if not exists sortie_le timestamptz;
alter table public.sortie_palanquees add column if not exists duree_prevue integer;
alter table public.sortie_palanquees drop constraint if exists sortie_palanquees_duree_check;
alter table public.sortie_palanquees add constraint sortie_palanquees_duree_check check (duree_prevue is null or duree_prevue between 5 and 240);

-- Un geste sur une palanquée : 'eau', 'sortie', ou 'annuler' (efface la dernière heure notée)
create or replace function public.marquer_palanquee(p_palanquee uuid, p_etape text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  q public.sortie_palanquees;
begin
  select * into q from public.sortie_palanquees where id = p_palanquee;
  if not found or not public.est_dp_sortie(q.sortie_id) then raise exception 'réservé au directeur de plongée'; end if;
  if p_etape = 'eau' then
    update public.sortie_palanquees set immersion_le = now(), sortie_le = null where id = p_palanquee returning * into q;
  elsif p_etape = 'sortie' then
    if q.immersion_le is null then raise exception 'la palanquée n''est pas encore à l''eau'; end if;
    update public.sortie_palanquees set sortie_le = now() where id = p_palanquee returning * into q;
  elsif p_etape = 'annuler' then
    if q.sortie_le is not null then
      update public.sortie_palanquees set sortie_le = null where id = p_palanquee returning * into q;
    else
      update public.sortie_palanquees set immersion_le = null where id = p_palanquee returning * into q;
    end if;
  else
    raise exception 'étape inconnue';
  end if;
  return jsonb_build_object('id', q.id, 'immersion_le', q.immersion_le, 'sortie_le', q.sortie_le);
end;
$$;
revoke all on function public.marquer_palanquee(uuid, text) from public, anon;
grant execute on function public.marquer_palanquee(uuid, text) to authenticated;

-- Corriger une heure à la main (oubli sur le bateau) : p_quand au format HH:MM, le jour de la sortie
create or replace function public.corriger_heure_palanquee(p_palanquee uuid, p_etape text, p_quand time)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  q public.sortie_palanquees;
  v_jour date;
  v_ts timestamptz;
begin
  select * into q from public.sortie_palanquees where id = p_palanquee;
  if not found or not public.est_dp_sortie(q.sortie_id) then raise exception 'réservé au directeur de plongée'; end if;
  select date_sortie into v_jour from public.sorties where id = q.sortie_id;
  v_ts := case when p_quand is null then null else (v_jour + p_quand) at time zone 'Europe/Paris' end;
  if p_etape = 'eau' then
    update public.sortie_palanquees set immersion_le = v_ts where id = p_palanquee;
  elsif p_etape = 'sortie' then
    update public.sortie_palanquees set sortie_le = v_ts where id = p_palanquee;
  else
    raise exception 'étape inconnue';
  end if;
end;
$$;
revoke all on function public.corriger_heure_palanquee(uuid, text, time) from public, anon;
grant execute on function public.corriger_heure_palanquee(uuid, text, time) to authenticated;

-- Durée prévue d'une palanquée (pour l'alerte « encore à l'eau »)
create or replace function public.duree_prevue_palanquee(p_palanquee uuid, p_minutes integer)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  q public.sortie_palanquees;
begin
  select * into q from public.sortie_palanquees where id = p_palanquee;
  if not found or not public.est_dp_sortie(q.sortie_id) then raise exception 'réservé au directeur de plongée'; end if;
  update public.sortie_palanquees set duree_prevue = p_minutes where id = p_palanquee;
end;
$$;
revoke all on function public.duree_prevue_palanquee(uuid, integer) from public, anon;
grant execute on function public.duree_prevue_palanquee(uuid, integer) to authenticated;

-- Le suivi de toutes les palanquées d'une sortie
create or replace function public.suivi_palanquees(p_sortie uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case when public.est_dp_sortie(p_sortie) then coalesce((
    select jsonb_agg(jsonb_build_object('id', q.id, 'numero', q.numero, 'immersion_le', q.immersion_le, 'sortie_le', q.sortie_le,
                                        'duree_prevue', q.duree_prevue) order by q.numero)
    from public.sortie_palanquees q where q.sortie_id = p_sortie), '[]'::jsonb) else '[]'::jsonb end;
$$;
revoke all on function public.suivi_palanquees(uuid) from public, anon;
grant execute on function public.suivi_palanquees(uuid) to authenticated;
