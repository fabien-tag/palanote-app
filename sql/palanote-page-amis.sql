-- ============================================================
-- Palanote — Onglet Amis : binômes et invitations par QR code
-- Tables : friendships (binômes), friend_invites (invitations de 10 min)
-- Fonctions : creer_invitation, voir_invitation, accepter_invitation, mes_binomes
-- À coller dans Supabase → SQL Editor → Run. Relançable sans risque.
-- ============================================================

do $$ begin create type public.friend_status as enum ('en_attente','acceptee','bloquee'); exception when duplicate_object then null; end $$;

-- ------------------------------------------------------------
-- Binômes (une ligne par paire, user_a < user_b)
-- ------------------------------------------------------------
create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references auth.users(id) on delete cascade,
  user_b uuid not null references auth.users(id) on delete cascade,
  demande_par uuid not null references auth.users(id) on delete cascade,
  statut public.friend_status not null default 'en_attente',
  accepte_le timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint friendships_ordre check (user_a < user_b),
  constraint friendships_paire_unique unique (user_a, user_b)
);
create index if not exists friendships_a_idx on public.friendships (user_a);
create index if not exists friendships_b_idx on public.friendships (user_b);

grant select, delete on public.friendships to authenticated;
grant all on public.friendships to service_role;
alter table public.friendships enable row level security;

drop policy if exists "Lire ses relations" on public.friendships;
create policy "Lire ses relations" on public.friendships for select to authenticated
  using (auth.uid() = user_a or auth.uid() = user_b);
drop policy if exists "Retirer un ami" on public.friendships;
create policy "Retirer un ami" on public.friendships for delete to authenticated
  using (auth.uid() = user_a or auth.uid() = user_b);
-- Les binômes se créent uniquement par accepter_invitation (ci-dessous).

drop trigger if exists friendships_updated_at on public.friendships;
create trigger friendships_updated_at before update on public.friendships
  for each row execute function public.update_updated_at_column();

-- ------------------------------------------------------------
-- Invitations (jeton aléatoire, valable 10 minutes, utilisable une fois)
-- ------------------------------------------------------------
create table if not exists public.friend_invites (
  id uuid primary key default gen_random_uuid(),
  emis_par uuid not null references auth.users(id) on delete cascade,
  token text not null unique,
  expire_le timestamptz not null,
  utilise_par uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists friend_invites_emis_idx on public.friend_invites (emis_par);

grant select on public.friend_invites to authenticated;
grant all on public.friend_invites to service_role;
alter table public.friend_invites enable row level security;

drop policy if exists "Lire ses invitations" on public.friend_invites;
create policy "Lire ses invitations" on public.friend_invites for select to authenticated
  using (auth.uid() = emis_par or auth.uid() = utilise_par);
-- Création et utilisation : seulement par les fonctions ci-dessous.
drop policy if exists "Emettre une invitation" on public.friend_invites;
drop policy if exists "Consommer une invitation" on public.friend_invites;

drop trigger if exists friend_invites_updated_at on public.friend_invites;
create trigger friend_invites_updated_at before update on public.friend_invites
  for each row execute function public.update_updated_at_column();

-- ------------------------------------------------------------
-- Infos publiques d'un plongeur : prénom, niveau, club (rien d'autre)
-- ------------------------------------------------------------
create or replace function public.infos_plongeur(p_user uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id', u.id,
    'prenom', coalesce(
      nullif(to_jsonb(p) ->> 'first_name', ''),
      nullif(to_jsonb(p) ->> 'prenom', ''),
      nullif(u.raw_user_meta_data ->> 'first_name', ''),
      nullif(split_part(u.raw_user_meta_data ->> 'full_name', ' ', 1), ''),
      nullif(split_part(u.raw_user_meta_data ->> 'name', ' ', 1), ''),
      'Un plongeur'
    ),
    'niveau', nullif(to_jsonb(p) ->> 'niveau', ''),
    'club', nullif(to_jsonb(p) ->> 'club', '')
  )
  from auth.users u
  left join public.profiles p on p.id = u.id
  where u.id = p_user;
$$;
revoke all on function public.infos_plongeur(uuid) from public, anon, authenticated;

-- Crée une invitation pour la personne connectée (les anciennes encore valides sont fermées).
create or replace function public.creer_invitation()
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_token text := replace(gen_random_uuid()::text, '-', '');
  v_expire timestamptz := now() + interval '10 minutes';
begin
  if auth.uid() is null then raise exception 'connexion requise'; end if;
  update public.friend_invites set expire_le = now()
    where emis_par = auth.uid() and utilise_par is null and expire_le > now();
  insert into public.friend_invites (emis_par, token, expire_le) values (auth.uid(), v_token, v_expire);
  return jsonb_build_object('token', v_token, 'expire_le', v_expire);
end;
$$;
revoke all on function public.creer_invitation() from public, anon;
grant execute on function public.creer_invitation() to authenticated;

-- Ce que voit la personne qui scanne (même sans compte) : qui l'invite, et si c'est encore valable.
create or replace function public.voir_invitation(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v public.friend_invites;
begin
  select * into v from public.friend_invites where token = p_token;
  if not found then return jsonb_build_object('etat', 'introuvable'); end if;
  return public.infos_plongeur(v.emis_par) || jsonb_build_object(
    'etat', case
      when v.utilise_par is not null then 'utilisee'
      when v.expire_le <= now() then 'expiree'
      else 'valide' end,
    'expire_le', v.expire_le
  );
end;
$$;
revoke all on function public.voir_invitation(text) from public;
grant execute on function public.voir_invitation(text) to anon, authenticated;

-- Accepte l'invitation : les deux plongeurs deviennent binômes.
create or replace function public.accepter_invitation(p_token text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v public.friend_invites;
  v_moi uuid := auth.uid();
begin
  if v_moi is null then raise exception 'connexion requise'; end if;
  select * into v from public.friend_invites where token = p_token for update;
  if not found then return jsonb_build_object('etat', 'introuvable'); end if;
  if v.emis_par = v_moi then return jsonb_build_object('etat', 'soi_meme'); end if;
  if v.utilise_par is not null and v.utilise_par <> v_moi then return jsonb_build_object('etat', 'utilisee'); end if;
  if v.utilise_par is null and v.expire_le <= now() then return jsonb_build_object('etat', 'expiree'); end if;

  update public.friend_invites set utilise_par = v_moi where id = v.id;
  insert into public.friendships (user_a, user_b, demande_par, statut, accepte_le)
    values (least(v.emis_par, v_moi), greatest(v.emis_par, v_moi), v.emis_par, 'acceptee', now())
    on conflict (user_a, user_b) do update set statut = 'acceptee', accepte_le = coalesce(public.friendships.accepte_le, now());

  return public.infos_plongeur(v.emis_par) || jsonb_build_object('etat', 'acceptee');
end;
$$;
revoke all on function public.accepter_invitation(text) from public, anon;
grant execute on function public.accepter_invitation(text) to authenticated;

-- Mes binômes, du plus récent au plus ancien.
create or replace function public.mes_binomes()
returns setof jsonb
language sql
stable
security definer
set search_path = public
as $$
  select public.infos_plongeur(case when f.user_a = auth.uid() then f.user_b else f.user_a end)
         || jsonb_build_object('depuis', f.accepte_le)
  from public.friendships f
  where f.statut = 'acceptee' and (f.user_a = auth.uid() or f.user_b = auth.uid())
  order by f.accepte_le desc nulls last;
$$;
revoke all on function public.mes_binomes() from public, anon;
grant execute on function public.mes_binomes() to authenticated;
