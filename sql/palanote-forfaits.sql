-- ============================================================
-- Palanote — Version gratuite et forfaits
-- · La version gratuite : le carnet complet + 50 pages de carnet lues par l'IA.
--   (L'analyse des espèces reste gratuite et illimitée.)
-- · Au-delà : un pack « Numériser mes carnets » (200 pages, sans abonnement)
--   ou Palanote+ (numérisation illimitée pendant un an).
-- · Le compteur est tenu par le serveur : l'app ne peut pas le modifier.
-- Prérequis : palanote-numerisation.sql, palanote-tableau-de-bord.sql (est_admin),
--             palanote-finances-lettre.sql (admin_reglages).
-- À coller dans Supabase → SQL Editor → Run. Relançable sans risque.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Le nombre de pages offertes, réglable (20 par défaut depuis le 27 octobre 2026, voir palanote-pages-offertes-20.sql)
-- ------------------------------------------------------------
alter table public.admin_reglages add column if not exists pages_offertes integer not null default 50;
do $$ begin
  alter table public.admin_reglages add constraint admin_reglages_pages_offertes_check check (pages_offertes >= 0);
exception when duplicate_object then null; end $$;

-- ------------------------------------------------------------
-- 2. Les forfaits achetés (saisis à la main tant que Stripe n'est pas branché)
-- ------------------------------------------------------------
create table if not exists public.forfaits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  type text not null check (type in ('pack', 'plus')),
  pages integer check (pages is null or pages > 0),      -- pack : pages ajoutées
  debut timestamptz not null default now(),
  fin timestamptz,                                        -- plus : fin de l'abonnement
  montant numeric(8,2) check (montant is null or montant >= 0),
  source text not null default 'manuel' check (source in ('manuel', 'stripe', 'offert')),
  reference text,                                         -- identifiant du paiement Stripe (plus tard)
  note text,
  created_at timestamptz not null default now()
);
create index if not exists forfaits_user_idx on public.forfaits (user_id);

grant select on public.forfaits to authenticated;
grant all on public.forfaits to service_role;
alter table public.forfaits enable row level security;

-- Chacun voit ses forfaits ; l'administrateur voit et gère tout (via les fonctions plus bas).
drop policy if exists "forfaits_lire_les_siens" on public.forfaits;
create policy "forfaits_lire_les_siens" on public.forfaits for select to authenticated
  using (auth.uid() = user_id or public.est_admin());

-- ------------------------------------------------------------
-- 3. Le compteur de pages lues par l'IA (une ligne par compte)
-- ------------------------------------------------------------
create table if not exists public.quota_ia (
  user_id uuid primary key references auth.users (id) on delete cascade,
  pages_lues integer not null default 0 check (pages_lues >= 0),
  updated_at timestamptz not null default now()
);

grant select on public.quota_ia to authenticated;
grant all on public.quota_ia to service_role;
alter table public.quota_ia enable row level security;

drop policy if exists "quota_lire_le_sien" on public.quota_ia;
create policy "quota_lire_le_sien" on public.quota_ia for select to authenticated
  using (auth.uid() = user_id or public.est_admin());
-- Pas de règle d'ajout ni de modification : seul le serveur écrit le compteur.

-- Reprise de l'existant : les pages déjà lues avant ce script comptent.
insert into public.quota_ia (user_id, pages_lues)
select b.user_id, count(*)
from public.ocr_pages p
join public.ocr_batches b on b.id = p.batch_id
where p.statut in ('lue', 'illisible')
group by b.user_id
on conflict (user_id) do nothing;

-- ------------------------------------------------------------
-- 4. Où en est un plongeur ? (pages offertes, achetées, lues, restantes)
-- ------------------------------------------------------------
create or replace function public.forfait_de(p_user uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with r as (
    select coalesce((select pages_offertes from public.admin_reglages limit 1), 50) as offertes
  ),
  q as (
    select coalesce((select pages_lues from public.quota_ia where user_id = p_user), 0) as lues
  ),
  f as (
    select
      coalesce(sum(pages) filter (where type = 'pack'), 0)::integer as achetees,
      max(fin) filter (where type = 'plus' and debut <= now() and (fin is null or fin > now())) as plus_fin,
      bool_or(type = 'plus' and debut <= now() and (fin is null or fin > now())) as plus
    from public.forfaits where user_id = p_user
  )
  select jsonb_build_object(
    'offertes', r.offertes,
    'achetees', f.achetees,
    'lues', q.lues,
    'plus', coalesce(f.plus, false),
    'plus_jusqu_au', f.plus_fin,
    'restantes', case when coalesce(f.plus, false) then null
                      else greatest(r.offertes + f.achetees - q.lues, 0) end
  )
  from r, q, f;
$$;
revoke all on function public.forfait_de(uuid) from public, anon, authenticated;
grant execute on function public.forfait_de(uuid) to service_role;

-- Pour l'app : mon forfait
create or replace function public.mon_forfait()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'connexion requise'; end if;
  return public.forfait_de(auth.uid());
end;
$$;
revoke all on function public.mon_forfait() from public, anon;
grant execute on function public.mon_forfait() to authenticated;

-- ------------------------------------------------------------
-- 5. Pour le serveur (fonction lire-page) : prendre une page sur le quota,
--    ou la rendre si la lecture a échoué. Réservé à la clé secrète.
-- ------------------------------------------------------------
create or replace function public.consommer_page_ia(p_user uuid)
returns boolean
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v jsonb;
begin
  insert into public.quota_ia (user_id) values (p_user) on conflict (user_id) do nothing;
  perform 1 from public.quota_ia where user_id = p_user for update;   -- un appel à la fois
  v := public.forfait_de(p_user);
  if not (v ->> 'plus')::boolean and (v ->> 'restantes')::integer <= 0 then
    return false;
  end if;
  update public.quota_ia set pages_lues = pages_lues + 1, updated_at = now() where user_id = p_user;
  return true;
end;
$$;
revoke all on function public.consommer_page_ia(uuid) from public, anon, authenticated;
grant execute on function public.consommer_page_ia(uuid) to service_role;

create or replace function public.rendre_page_ia(p_user uuid)
returns void
language sql
volatile
security definer
set search_path = public
as $$
  update public.quota_ia set pages_lues = greatest(pages_lues - 1, 0), updated_at = now() where user_id = p_user;
$$;
revoke all on function public.rendre_page_ia(uuid) from public, anon, authenticated;
grant execute on function public.rendre_page_ia(uuid) to service_role;

-- ------------------------------------------------------------
-- 6. Tableau de bord : la liste des forfaits, en ajouter un, en retirer un
-- ------------------------------------------------------------
create or replace function public.admin_forfaits()
returns setof jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.est_admin() then raise exception 'réservé à l''administrateur'; end if;
  return query
  select jsonb_build_object(
    'id', f.id, 'email', u.email, 'type', f.type, 'pages', f.pages, 'debut', f.debut, 'fin', f.fin,
    'montant', f.montant, 'source', f.source, 'note', f.note,
    'actif', case when f.type = 'plus' then f.debut <= now() and (f.fin is null or f.fin > now()) else true end
  )
  from public.forfaits f
  join auth.users u on u.id = f.user_id
  order by f.created_at desc;
end;
$$;
revoke all on function public.admin_forfaits() from public, anon;
grant execute on function public.admin_forfaits() to authenticated;

create or replace function public.admin_donner_forfait(p_email text, p_type text, p_montant numeric default null, p_note text default null)
returns uuid
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_user uuid;
  v_id uuid;
begin
  if not public.est_admin() then raise exception 'réservé à l''administrateur'; end if;
  select id into v_user from auth.users where lower(email) = lower(trim(p_email));
  if v_user is null then raise exception 'aucun compte avec cette adresse'; end if;
  if p_type not in ('pack', 'plus') then raise exception 'type de forfait inconnu'; end if;
  insert into public.forfaits (user_id, type, pages, fin, montant, source, note)
  values (
    v_user, p_type,
    case when p_type = 'pack' then 200 end,
    case when p_type = 'plus' then now() + interval '1 year' end,
    p_montant,
    case when coalesce(p_montant, 0) = 0 then 'offert' else 'manuel' end,
    nullif(trim(coalesce(p_note, '')), '')
  )
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.admin_donner_forfait(text, text, numeric, text) from public, anon;
grant execute on function public.admin_donner_forfait(text, text, numeric, text) to authenticated;

create or replace function public.admin_retirer_forfait(p_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  if not public.est_admin() then raise exception 'réservé à l''administrateur'; end if;
  delete from public.forfaits where id = p_id;
end;
$$;
revoke all on function public.admin_retirer_forfait(uuid) from public, anon;
grant execute on function public.admin_retirer_forfait(uuid) to authenticated;
