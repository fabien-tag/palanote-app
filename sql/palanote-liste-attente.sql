-- ============================================================
-- Palanote — La liste d'attente quand le bateau est plein
--
-- Le nombre de places est celui du bateau choisi pour la sortie (Matériel → places).
-- Un plongeur qui scanne le QR ou ouvre le lien d'une sortie complète passe en liste
-- d'attente (sauf s'il prend une place que le DP lui avait préparée).
-- Dès qu'une place se libère (un inscrit se retire, ou le DP choisit un plus grand bateau),
-- le premier de la liste est inscrit automatiquement et prévenu dans sa cloche.
-- Le DP voit la liste dans sa sortie : il peut inscrire quelqu'un quand même, ou le retirer.
-- Les plongeurs en attente ne sont pas des inscrits : ils ne comptent ni dans les
-- palanquées, ni sur la fiche de sécurité, ni pour le tampon.
--
-- Prérequis : palanote-sorties-club.sql, palanote-planning-club.sql (materiel, bateau_id)
--             et palanote-privilegies.sql.
-- À coller dans Supabase → SQL Editor → Run. Relançable sans risque.
-- ============================================================

create table if not exists public.sortie_attente (
  id uuid primary key default gen_random_uuid(),
  sortie_id uuid not null references public.sorties(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  via text not null default 'qr',
  created_at timestamptz not null default now(),
  constraint sortie_attente_unique unique (sortie_id, user_id),
  constraint sortie_attente_via_check check (via in ('qr', 'lien'))
);
create index if not exists sortie_attente_sortie_idx on public.sortie_attente (sortie_id, created_at);
alter table public.sortie_attente enable row level security; -- lecture et écriture par les fonctions seulement
grant all on public.sortie_attente to service_role;

-- Places restantes sur le bateau de la sortie (null = pas de limite connue)
create or replace function public.places_restantes(p_sortie uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select m.places - (select count(*)::integer from public.sortie_participants p where p.sortie_id = s.id)
  from public.sorties s join public.materiel m on m.id = s.bateau_id
  where s.id = p_sortie and m.places is not null;
$$;
revoke all on function public.places_restantes(uuid) from public, anon, authenticated;

-- Une nouvelle inscription par QR ou lien sur une sortie complète est refusée
-- (rejoindre_sortie la transforme en liste d'attente). Le DP peut toujours ajouter quelqu'un.
create or replace function public.controler_places_sortie()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.user_id is not null and new.via in ('qr', 'lien') and coalesce(public.places_restantes(new.sortie_id), 1) <= 0 then
    raise exception 'sortie complète';
  end if;
  return new;
end;
$$;
drop trigger if exists sortie_participants_places on public.sortie_participants;
create trigger sortie_participants_places before insert on public.sortie_participants
  for each row execute function public.controler_places_sortie();

-- Inscrit les premiers de la liste tant qu'il reste des places
create or replace function public.promouvoir_attente(p_sortie uuid)
returns integer
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  s public.sorties;
  a public.sortie_attente;
  v_nb integer := 0;
begin
  select * into s from public.sorties where id = p_sortie;
  if not found or s.deleted_at is not null or s.statut <> 'prevue' or s.date_sortie < current_date then return 0; end if;
  loop
    exit when coalesce(public.places_restantes(p_sortie), 1) <= 0;
    select * into a from public.sortie_attente where sortie_id = p_sortie order by created_at limit 1 for update skip locked;
    exit when not found;
    delete from public.sortie_attente where id = a.id;
    begin
      perform public.inscrire_a_la_sortie(p_sortie, a.user_id, a.via, a.user_id, null);
    exception when others then
      continue; -- plus le droit de s'inscrire (sortie réservée…) : on passe au suivant
    end;
    v_nb := v_nb + 1;
    perform public.notifier(a.user_id, 'sortie_place_liberee', 'Une place s''est libérée : tu es inscrit',
      public.texte_sortie(p_sortie) || '.', '/sortie?id=' || p_sortie, jsonb_build_object('sortie_id', p_sortie));
    if s.dp_id <> a.user_id then
      perform public.notifier(s.dp_id, 'sortie_rejointe',
        (public.infos_plongeur(a.user_id) ->> 'prenom') || ' a rejoint ta sortie (liste d''attente)',
        public.texte_sortie(p_sortie) || '.', '/club/sortie?id=' || p_sortie, jsonb_build_object('sortie_id', p_sortie));
    end if;
  end loop;
  return v_nb;
end;
$$;
revoke all on function public.promouvoir_attente(uuid) from public, anon, authenticated;

-- Une place libérée (inscrit retiré) ou un plus grand bateau : on fait avancer la liste
create or replace function public.apres_place_liberee()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_table_name = 'sortie_participants' then
    perform public.promouvoir_attente(old.sortie_id);
    return old;
  end if;
  perform public.promouvoir_attente(new.id);
  return new;
end;
$$;
drop trigger if exists sortie_participants_place_liberee on public.sortie_participants;
create trigger sortie_participants_place_liberee after delete on public.sortie_participants
  for each row execute function public.apres_place_liberee();
drop trigger if exists sorties_bateau_change on public.sorties;
create trigger sorties_bateau_change after update of bateau_id on public.sorties
  for each row when (new.bateau_id is distinct from old.bateau_id) execute function public.apres_place_liberee();

-- Inscrit par le DP : il sort de la liste d'attente
create or replace function public.apres_inscription_attente()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.user_id is not null then
    delete from public.sortie_attente where sortie_id = new.sortie_id and user_id = new.user_id;
  end if;
  return new;
end;
$$;
drop trigger if exists sortie_participants_sortie_attente on public.sortie_participants;
create trigger sortie_participants_sortie_attente after insert or update of user_id on public.sortie_participants
  for each row execute function public.apres_inscription_attente();

-- Rejoindre une sortie (même fonction que palanote-sorties-club.sql) : si elle est complète,
-- le plongeur passe en liste d'attente et le DP est prévenu.
create or replace function public.rejoindre_sortie(p_jeton text, p_via text default 'qr', p_place uuid default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  s public.sorties;
  r jsonb;
  v_via text := case when p_via = 'lien' then 'lien' else 'qr' end;
  v_rang integer;
begin
  if auth.uid() is null then raise exception 'connexion requise'; end if;
  select * into s from public.sorties where jeton = p_jeton and deleted_at is null;
  if not found then raise exception 'sortie introuvable'; end if;
  if s.statut = 'annulee' then raise exception 'sortie fermée'; end if;
  -- Sortie déjà tamponnée : on peut encore venir prendre la place que le DP avait préparée
  -- (le tampon suit), mais plus s'inscrire de zéro.
  if s.statut = 'validee' and not exists (
       select 1 from public.sortie_participants
       where sortie_id = s.id and user_id is null
         and (id = p_place or (p_place is null and public.prenom_simple(nom_prevu) = public.prenom_simple(public.infos_plongeur(auth.uid()) ->> 'prenom'))))
     and not exists (select 1 from public.sortie_participants where sortie_id = s.id and user_id = auth.uid()) then
    raise exception 'sortie fermée';
  end if;
  begin
    r := public.inscrire_a_la_sortie(s.id, auth.uid(), v_via, auth.uid(), p_place);
  exception when others then
    if sqlerrm <> 'sortie complète' then raise; end if;
    -- Complet : liste d'attente
    insert into public.sortie_attente (sortie_id, user_id, via) values (s.id, auth.uid(), v_via) on conflict do nothing;
    if found and s.dp_id <> auth.uid() then
      perform public.notifier(s.dp_id, 'sortie_attente',
        (public.infos_plongeur(auth.uid()) ->> 'prenom') || ' est en liste d''attente',
        public.texte_sortie(s.id) || ' : le bateau est complet.', '/club/sortie?id=' || s.id, jsonb_build_object('sortie_id', s.id));
    end if;
    select count(*) into v_rang from public.sortie_attente a
     where a.sortie_id = s.id and a.created_at <= (select created_at from public.sortie_attente where sortie_id = s.id and user_id = auth.uid());
    return jsonb_build_object('id', s.id, 'rejoint', false, 'attente', v_rang, 'nom_prevu', null, 'palanquee', null);
  end;
  if (r ->> 'nouveau')::boolean and s.dp_id <> auth.uid() then
    perform public.notifier(s.dp_id, 'sortie_rejointe',
      (public.infos_plongeur(auth.uid()) ->> 'prenom') || ' a rejoint ta sortie' || coalesce(' (P' || (r ->> 'palanquee') || ')', ''),
      public.texte_sortie(s.id) || '.', '/club/sortie?id=' || s.id, jsonb_build_object('sortie_id', s.id));
  end if;
  return jsonb_build_object('id', s.id, 'rejoint', (r ->> 'nouveau')::boolean, 'nom_prevu', r ->> 'nom_prevu', 'palanquee', r -> 'palanquee');
end;
$$;
revoke all on function public.rejoindre_sortie(text, text, uuid) from public, anon;
grant execute on function public.rejoindre_sortie(text, text, uuid) to authenticated;

-- Avant de s'inscrire : la sortie est-elle complète, et suis-je déjà en attente ?
create or replace function public.places_sortie(p_jeton text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'restantes', public.places_restantes(s.id),
    'complet', coalesce(public.places_restantes(s.id), 1) <= 0,
    'en_attente', (select count(*) from public.sortie_attente a where a.sortie_id = s.id),
    'mon_rang', nullif((select count(*) from public.sortie_attente a
                        where a.sortie_id = s.id
                          and a.created_at <= (select created_at from public.sortie_attente m where m.sortie_id = s.id and m.user_id = auth.uid())), 0))
  from public.sorties s where s.jeton = p_jeton and s.deleted_at is null;
$$;
revoke all on function public.places_sortie(text) from public;
grant execute on function public.places_sortie(text) to anon, authenticated;

-- Quitter la liste d'attente (le plongeur), ou en retirer quelqu'un (le DP)
create or replace function public.quitter_attente(p_sortie uuid, p_user uuid default null)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  if p_user is not null and p_user <> auth.uid() and not public.est_dp_sortie(p_sortie) then
    raise exception 'réservé au directeur de plongée';
  end if;
  delete from public.sortie_attente where sortie_id = p_sortie and user_id = coalesce(p_user, auth.uid());
end;
$$;
revoke all on function public.quitter_attente(uuid, uuid) from public, anon;
grant execute on function public.quitter_attente(uuid, uuid) to authenticated;

-- Pour le DP : la liste d'attente d'une sortie, dans l'ordre d'arrivée
create or replace function public.attente_sortie(p_sortie uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case when public.est_dp_sortie(p_sortie) then jsonb_build_object(
    'restantes', public.places_restantes(p_sortie),
    'liste', coalesce((
      select jsonb_agg(public.infos_plongeur(a.user_id) || jsonb_build_object('depuis', a.created_at, 'via', a.via) order by a.created_at)
      from public.sortie_attente a where a.sortie_id = p_sortie), '[]'::jsonb))
  else jsonb_build_object('restantes', null, 'liste', '[]'::jsonb) end;
$$;
revoke all on function public.attente_sortie(uuid) from public, anon;
grant execute on function public.attente_sortie(uuid) to authenticated;
