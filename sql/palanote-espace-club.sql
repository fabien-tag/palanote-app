-- ============================================================
-- Palanote — Espace club du directeur de plongée (version ordinateur) :
-- carte du club, membres du club, paramètres du centre.
--
--   · Carte : les sorties plongées par le centre, sur la carte (positions déjà floutées
--     de 100 à 150 m à la création de la sortie).
--   · Membres : les plongeurs venus avec le centre (sorties, fiches, tampons, prochaine sortie).
--   · Paramètres : nom et ville du centre, ses directeurs de plongée.
--
-- Prérequis : palanote-sorties-club.sql et palanote-planning-club.sql (est_dp_centre).
-- À coller dans Supabase → SQL Editor → Run. Relançable sans risque.
-- ============================================================

-- Les sorties plongées par le centre, pour la carte
create or replace function public.carte_centre(p_centre uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.est_dp_centre(p_centre) then raise exception 'réservé aux directeurs de plongée du centre'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', s.id, 'date', s.date_sortie, 'site', s.site_name, 'lieu', s.site_location, 'coords', s.site_coords,
      'statut', s.statut, 'profondeur', s.profondeur_prevue, 'duree', s.duree_min, 'dp', public.infos_plongeur(s.dp_id) ->> 'prenom',
      'nb', (select count(*) from public.sortie_participants p where p.sortie_id = s.id))
      order by s.date_sortie desc)
    from public.sorties s
    where s.centre_id = p_centre and s.deleted_at is null and s.statut in ('terminee', 'validee') and s.site_coords is not null), '[]'::jsonb);
end;
$$;
revoke all on function public.carte_centre(uuid) from public, anon;
grant execute on function public.carte_centre(uuid) to authenticated;

-- Les membres du club : les plongeurs venus avec le centre (hors DP de la sortie)
create or replace function public.membres_centre(p_centre uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.est_dp_centre(p_centre) then raise exception 'réservé aux directeurs de plongée du centre'; end if;
  return coalesce((
    select jsonb_agg(public.infos_plongeur(m.user_id) || jsonb_build_object(
      'sorties', m.sorties, 'premiere', m.premiere, 'derniere', m.derniere,
      'fiches', m.fiches, 'tampons', m.tampons, 'prochaine', m.prochaine)
      order by m.derniere desc nulls last)
    from (
      select p.user_id,
             count(distinct s.id) filter (where s.statut in ('terminee', 'validee')) as sorties,
             min(s.date_sortie) filter (where s.statut in ('terminee', 'validee')) as premiere,
             max(s.date_sortie) filter (where s.statut in ('terminee', 'validee')) as derniere,
             count(p.dive_id) as fiches,
             count(p.tamponne_le) filter (where p.dive_id is not null) as tampons,
             min(s.date_sortie) filter (where s.statut = 'prevue' and s.date_sortie >= current_date) as prochaine
      from public.sortie_participants p
      join public.sorties s on s.id = p.sortie_id
      where s.centre_id = p_centre and s.deleted_at is null and s.statut <> 'annulee'
        and p.user_id is not null and p.user_id <> s.dp_id
      group by p.user_id
    ) m), '[]'::jsonb);
end;
$$;
revoke all on function public.membres_centre(uuid) from public, anon;
grant execute on function public.membres_centre(uuid) to authenticated;

-- Les paramètres du centre : identité et directeurs de plongée
create or replace function public.parametres_centre(p_centre uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  c public.centres;
begin
  if not public.est_dp_centre(p_centre) then raise exception 'réservé aux directeurs de plongée du centre'; end if;
  select * into c from public.centres where id = p_centre;
  return jsonb_build_object(
    'id', c.id, 'nom', c.nom, 'ville', c.ville, 'verifie', c.verifie, 'cree_le', c.created_at,
    'dp', coalesce((select jsonb_agg(public.infos_plongeur(m.user_id) || jsonb_build_object('depuis', m.created_at, 'moi', m.user_id = auth.uid())
                                     order by m.created_at)
                    from public.centre_membres m where m.centre_id = p_centre and m.role = 'dp'), '[]'::jsonb),
    'nb_sorties', (select count(*) from public.sorties s where s.centre_id = p_centre and s.deleted_at is null and s.statut in ('terminee', 'validee')));
end;
$$;
revoke all on function public.parametres_centre(uuid) from public, anon;
grant execute on function public.parametres_centre(uuid) to authenticated;

-- Renommer le centre ou changer sa ville (un centre vérifié garde son nom)
create or replace function public.modifier_centre(p_centre uuid, p_nom text, p_ville text)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  c public.centres;
begin
  if not public.est_dp_centre(p_centre) then raise exception 'réservé aux directeurs de plongée du centre'; end if;
  select * into c from public.centres where id = p_centre;
  if c.verifie and btrim(p_nom) <> c.nom then raise exception 'le nom d''un centre vérifié ne se change pas'; end if;
  update public.centres set nom = btrim(p_nom), ville = nullif(btrim(coalesce(p_ville, '')), '') where id = p_centre;
end;
$$;
revoke all on function public.modifier_centre(uuid, text, text) from public, anon;
grant execute on function public.modifier_centre(uuid, text, text) to authenticated;
