-- Palanote — Rejoindre un centre : fermeture de la faille du 20 octobre 2026
-- Avant : n'importe quel compte pouvait chercher un centre et en devenir directeur de plongée en un clic,
-- et voir ainsi les adhérents (dont les certificats médicaux), l'équipe et les sorties.
-- Désormais : un centre qui a déjà un directeur de plongée ne peut plus être rejoint librement.
-- Seul un centre resté sans DP peut encore être rejoint. Créer son propre centre reste possible.
-- Script autonome et rejouable, à lancer dans le SQL Editor de Supabase.

create or replace function public.rejoindre_centre(p_centre uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c public.centres;
begin
  if auth.uid() is null then raise exception 'connexion requise'; end if;
  select * into c from public.centres where id = p_centre and deleted_at is null;
  if not found then raise exception 'centre introuvable'; end if;

  -- Déjà membre : rien à faire
  if exists (select 1 from public.centre_membres m where m.centre_id = p_centre and m.user_id = auth.uid()) then
    return jsonb_build_object('id', c.id, 'nom', c.nom, 'ville', c.ville);
  end if;

  -- Le centre a déjà un directeur de plongée : on n'y entre pas sans son accord
  if exists (select 1 from public.centre_membres m where m.centre_id = p_centre) then
    raise exception 'centre_deja_gere' using hint = 'Ce centre a déjà un directeur de plongée.';
  end if;

  insert into public.centre_membres (centre_id, user_id, role) values (p_centre, auth.uid(), 'dp')
    on conflict (centre_id, user_id) do nothing;
  -- Le profil suit : club et rôle remplis s'ils étaient vides
  update public.profiles set
    club = coalesce(nullif(club, ''), c.nom),
    role_plongee = coalesce(nullif(role_plongee, ''), 'directeur')
  where id = auth.uid();
  return jsonb_build_object('id', c.id, 'nom', c.nom, 'ville', c.ville);
end;
$$;
revoke all on function public.rejoindre_centre(uuid) from public, anon;
grant execute on function public.rejoindre_centre(uuid) to authenticated;

-- Vérification : doit afficher « protégé »
select case when position('centre_deja_gere' in prosrc) > 0 then 'protégé' else 'NON protégé' end as rejoindre_centre
from pg_proc where proname = 'rejoindre_centre';
