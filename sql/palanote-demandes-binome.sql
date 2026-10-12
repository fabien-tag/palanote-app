-- ============================================================
-- Palanote — « Rechercher quelqu'un » et demandes de binôme (onglet Amis)
--
-- On trouve un plongeur :
--   · par son e-mail exact (n'importe quel plongeur Palanote),
--   · ou par son prénom, mais seulement parmi les plongeurs qu'on « connaît déjà » :
--     les binômes de ses binômes et les plongeurs croisés dans une sortie club.
-- Pas d'annuaire ouvert : impossible de lister tous les plongeurs de l'app.
-- On lui envoie une demande ; il la reçoit dans sa cloche et dans Amis, et l'accepte ou la refuse.
--
-- Prérequis : palanote-page-amis.sql (friendships, infos_plongeur)
--             et palanote-sorties-club.sql (notifications, notifier).
-- À coller dans Supabase → SQL Editor → Run. Relançable sans risque.
-- ============================================================

-- Où en est la relation entre moi et un autre plongeur
create or replace function public.relation_binome(p_autre uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
    when f.id is null then null
    when f.statut = 'acceptee' then 'binome'
    when f.statut = 'en_attente' and f.demande_par = auth.uid() then 'demande_envoyee'
    when f.statut = 'en_attente' then 'demande_recue'
    else null
  end
  from (select 1) x
  left join public.friendships f on f.user_a = least(auth.uid(), p_autre) and f.user_b = greatest(auth.uid(), p_autre);
$$;
revoke all on function public.relation_binome(uuid) from public, anon, authenticated;

create or replace function public.chercher_plongeur(p_q text)
returns setof jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  q text := btrim(coalesce(p_q, ''));
begin
  if auth.uid() is null then raise exception 'connexion requise'; end if;
  if char_length(q) < 2 then return; end if;
  return query
    with mes_binomes as (
      select case when f.user_a = auth.uid() then f.user_b else f.user_a end as id
      from public.friendships f
      where f.statut = 'acceptee' and auth.uid() in (f.user_a, f.user_b)
    ),
    candidats as (
      -- e-mail exact
      select u.id from auth.users u where position('@' in q) > 0 and lower(u.email) = lower(q)
      union
      -- binômes de mes binômes
      select case when f.user_a = b.id then f.user_b else f.user_a end
      from public.friendships f join mes_binomes b on b.id in (f.user_a, f.user_b)
      where f.statut = 'acceptee' and position('@' in q) = 0
      union
      -- plongeurs croisés dans une sortie club
      select p2.user_id
      from public.sortie_participants p1
      join public.sortie_participants p2 on p2.sortie_id = p1.sortie_id
      where p1.user_id = auth.uid() and position('@' in q) = 0
      union
      select s.dp_id
      from public.sortie_participants p1 join public.sorties s on s.id = p1.sortie_id
      where p1.user_id = auth.uid() and position('@' in q) = 0
    )
    select public.infos_plongeur(c.id) || jsonb_build_object('relation', public.relation_binome(c.id))
    from candidats c
    where c.id is not null and c.id <> auth.uid()
      and (position('@' in q) > 0 or (public.infos_plongeur(c.id) ->> 'prenom') ilike '%' || q || '%')
    limit 15;
end;
$$;
revoke all on function public.chercher_plongeur(text) from public, anon;
grant execute on function public.chercher_plongeur(text) to authenticated;

create or replace function public.demander_binome(p_user uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_moi uuid := auth.uid();
  f public.friendships;
  v_prenom text;
begin
  if v_moi is null then raise exception 'connexion requise'; end if;
  if p_user = v_moi then raise exception 'c''est toi'; end if;
  if not exists (select 1 from auth.users where id = p_user) then raise exception 'plongeur introuvable'; end if;
  -- Garde-fou contre les envois en série
  if (select count(*) from public.friendships where demande_par = v_moi and statut = 'en_attente' and created_at > now() - interval '1 day') >= 30 then
    raise exception 'trop de demandes aujourd''hui';
  end if;

  select * into f from public.friendships where user_a = least(v_moi, p_user) and user_b = greatest(v_moi, p_user) for update;
  if found and f.statut = 'acceptee' then return jsonb_build_object('relation', 'binome'); end if;
  if found and f.statut = 'bloquee' then return jsonb_build_object('relation', null); end if;
  v_prenom := public.infos_plongeur(v_moi) ->> 'prenom';

  -- Il m'avait déjà fait une demande : on devient binômes tout de suite
  if found and f.statut = 'en_attente' and f.demande_par = p_user then
    update public.friendships set statut = 'acceptee', accepte_le = now() where id = f.id;
    perform public.notifier(p_user, 'binome_accepte', v_prenom || ' a accepté ta demande',
      'Vous êtes maintenant binômes : vos plongées communes pourront se remplir des deux côtés.', '/amis', jsonb_build_object('de', v_moi));
    return jsonb_build_object('relation', 'binome');
  end if;
  if found then return jsonb_build_object('relation', 'demande_envoyee'); end if;

  insert into public.friendships (user_a, user_b, demande_par, statut)
    values (least(v_moi, p_user), greatest(v_moi, p_user), v_moi, 'en_attente');
  perform public.notifier(p_user, 'binome_demande', v_prenom || ' veut devenir ton binôme',
    coalesce(nullif(concat_ws(' · ', public.infos_plongeur(v_moi) ->> 'niveau', public.infos_plongeur(v_moi) ->> 'club'), ''), 'Plongeur Palanote') || '. Réponds dans Amis.',
    '/amis', jsonb_build_object('de', v_moi));
  return jsonb_build_object('relation', 'demande_envoyee');
end;
$$;
revoke all on function public.demander_binome(uuid) from public, anon;
grant execute on function public.demander_binome(uuid) to authenticated;

-- Les demandes que j'ai reçues
create or replace function public.demandes_binome_recues()
returns setof jsonb
language sql
stable
security definer
set search_path = public
as $$
  select public.infos_plongeur(f.demande_par) || jsonb_build_object('demande_id', f.id, 'le', f.created_at)
  from public.friendships f
  where f.statut = 'en_attente' and f.demande_par <> auth.uid() and auth.uid() in (f.user_a, f.user_b)
  order by f.created_at desc;
$$;
revoke all on function public.demandes_binome_recues() from public, anon;
grant execute on function public.demandes_binome_recues() to authenticated;

create or replace function public.repondre_demande_binome(p_id uuid, p_accepter boolean)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  f public.friendships;
begin
  select * into f from public.friendships where id = p_id for update;
  if not found or f.statut <> 'en_attente' or f.demande_par = auth.uid() or auth.uid() not in (f.user_a, f.user_b) then
    raise exception 'demande introuvable';
  end if;
  if p_accepter then
    update public.friendships set statut = 'acceptee', accepte_le = now() where id = p_id;
    perform public.notifier(f.demande_par, 'binome_accepte', (public.infos_plongeur(auth.uid()) ->> 'prenom') || ' a accepté ta demande',
      'Vous êtes maintenant binômes : vos plongées communes pourront se remplir des deux côtés.', '/amis', jsonb_build_object('de', auth.uid()));
  else
    -- Refus discret : la demande disparaît, sans prévenir
    delete from public.friendships where id = p_id;
  end if;
end;
$$;
revoke all on function public.repondre_demande_binome(uuid, boolean) from public, anon;
grant execute on function public.repondre_demande_binome(uuid, boolean) to authenticated;
