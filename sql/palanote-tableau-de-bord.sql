-- ============================================================
-- Palanote — Tableau de bord du développeur
-- Tables : app_admins (qui peut voir le tableau de bord), feedback (retours des
-- utilisateurs), app_errors (erreurs remontées par l'app), user_activity et
-- daily_activity (présence, pour « connectés » et « actifs »).
-- Fonctions : est_admin, signaler_presence, admin_stats, admin_utilisateurs.
-- À coller dans Supabase → SQL Editor → Run. Relançable sans risque.
-- ============================================================

-- ------------------------------------------------------------
-- Administrateurs
-- ------------------------------------------------------------
create table if not exists public.app_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.app_admins enable row level security;
revoke all on public.app_admins from anon, authenticated;
grant all on public.app_admins to service_role;

-- Le compte de Fabien
insert into public.app_admins (user_id)
select id from auth.users where lower(email) = 'fabien.tagliareni@gmail.com'
on conflict do nothing;

create or replace function public.est_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.app_admins where user_id = auth.uid());
$$;
revoke all on function public.est_admin() from public, anon;
grant execute on function public.est_admin() to authenticated;

-- ------------------------------------------------------------
-- Retours des utilisateurs (« Dis-moi ce qui manque »)
-- ------------------------------------------------------------
create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null default auth.uid(),
  raison text,
  message text not null check (char_length(message) between 1 and 2000),
  email text,
  version text,
  appareil text,
  systeme text,
  page text,
  statut text not null default 'nouveau' check (statut in ('nouveau', 'traite')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists feedback_created_idx on public.feedback (created_at desc);

grant insert on public.feedback to anon, authenticated;
grant select, update, delete on public.feedback to authenticated;
grant all on public.feedback to service_role;
alter table public.feedback enable row level security;

drop policy if exists "Envoyer un retour" on public.feedback;
create policy "Envoyer un retour" on public.feedback for insert to anon, authenticated
  with check (user_id is null or user_id = auth.uid());
drop policy if exists "Admin lit les retours" on public.feedback;
create policy "Admin lit les retours" on public.feedback for select to authenticated
  using (public.est_admin());
drop policy if exists "Admin traite les retours" on public.feedback;
create policy "Admin traite les retours" on public.feedback for update to authenticated
  using (public.est_admin()) with check (public.est_admin());
drop policy if exists "Admin efface les retours" on public.feedback;
create policy "Admin efface les retours" on public.feedback for delete to authenticated
  using (public.est_admin());

drop trigger if exists feedback_updated_at on public.feedback;
create trigger feedback_updated_at before update on public.feedback
  for each row execute function public.update_updated_at_column();

-- ------------------------------------------------------------
-- Erreurs remontées par l'app
-- ------------------------------------------------------------
create table if not exists public.app_errors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null default auth.uid(),
  message text not null check (char_length(message) between 1 and 1000),
  details text check (details is null or char_length(details) <= 6000),
  page text,
  version text,
  appareil text,
  systeme text,
  created_at timestamptz not null default now()
);
create index if not exists app_errors_created_idx on public.app_errors (created_at desc);

grant insert on public.app_errors to anon, authenticated;
grant select, delete on public.app_errors to authenticated;
grant all on public.app_errors to service_role;
alter table public.app_errors enable row level security;

drop policy if exists "Signaler une erreur" on public.app_errors;
create policy "Signaler une erreur" on public.app_errors for insert to anon, authenticated
  with check (user_id is null or user_id = auth.uid());
drop policy if exists "Admin lit les erreurs" on public.app_errors;
create policy "Admin lit les erreurs" on public.app_errors for select to authenticated
  using (public.est_admin());
drop policy if exists "Admin efface les erreurs" on public.app_errors;
create policy "Admin efface les erreurs" on public.app_errors for delete to authenticated
  using (public.est_admin());

-- ------------------------------------------------------------
-- Présence : dernière visite + un jour d'activité par personne
-- ------------------------------------------------------------
create table if not exists public.user_activity (
  user_id uuid primary key references auth.users(id) on delete cascade,
  premiere_visite timestamptz not null default now(),
  derniere_visite timestamptz not null default now(),
  appareil text,
  version text
);
create table if not exists public.daily_activity (
  user_id uuid not null references auth.users(id) on delete cascade,
  jour date not null default current_date,
  primary key (user_id, jour)
);
create index if not exists daily_activity_jour_idx on public.daily_activity (jour);
alter table public.user_activity enable row level security;
alter table public.daily_activity enable row level security;
revoke all on public.user_activity from anon, authenticated;
revoke all on public.daily_activity from anon, authenticated;
grant all on public.user_activity to service_role;
grant all on public.daily_activity to service_role;

create or replace function public.signaler_presence(p_appareil text default null, p_version text default null)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then return; end if;
  insert into public.user_activity (user_id, appareil, version)
  values (auth.uid(), left(p_appareil, 120), left(p_version, 30))
  on conflict (user_id) do update
    set derniere_visite = now(), appareil = coalesce(excluded.appareil, user_activity.appareil),
        version = coalesce(excluded.version, user_activity.version);
  insert into public.daily_activity (user_id, jour) values (auth.uid(), current_date)
  on conflict do nothing;
end;
$$;
revoke all on function public.signaler_presence(text, text) from public, anon;
grant execute on function public.signaler_presence(text, text) to authenticated;

-- ------------------------------------------------------------
-- Les chiffres du tableau de bord (réservé à l'admin)
-- ------------------------------------------------------------
create or replace function public.admin_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  r jsonb;
  n bigint;
begin
  if not public.est_admin() then raise exception 'réservé à l''administrateur'; end if;

  r := jsonb_build_object(
    'comptes', (select count(*) from auth.users),
    'comptes_7j', (select count(*) from auth.users where created_at > now() - interval '7 days'),
    'connectes', (select count(*) from public.user_activity where derniere_visite > now() - interval '5 minutes'),
    'actifs_jour', (select count(*) from public.daily_activity where jour = current_date),
    'actifs_7j', (select count(distinct user_id) from public.daily_activity where jour > current_date - 7),
    'actifs_30j', (select count(distinct user_id) from public.daily_activity where jour > current_date - 30),
    'plongees', (select count(*) from public.dives where deleted_at is null),
    'plongees_7j', (select count(*) from public.dives where deleted_at is null and created_at > now() - interval '7 days'),
    'retours_nouveaux', (select count(*) from public.feedback where statut = 'nouveau'),
    'erreurs_24h', (select count(*) from public.app_errors where created_at > now() - interval '24 hours'),
    'par_jour', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'jour', j.jour,
               'actifs', (select count(*) from public.daily_activity d where d.jour = j.jour),
               'inscriptions', (select count(*) from auth.users u where u.created_at::date = j.jour)
             ) order by j.jour), '[]'::jsonb)
      from (select generate_series(current_date - 29, current_date, interval '1 day')::date as jour) j
    )
  );

  -- Tables présentes seulement si les pages correspondantes ont été installées
  if to_regclass('public.ocr_pages') is not null then
    execute 'select count(*) from public.ocr_pages' into n;
    r := r || jsonb_build_object('pages_numerisees', n);
    execute 'select count(*) from public.ocr_pages where created_at > now() - interval ''30 days''' into n;
    r := r || jsonb_build_object('pages_30j', n);
  end if;
  if to_regclass('public.friendships') is not null then
    execute 'select count(*) from public.friendships where statut = ''acceptee''' into n;
    r := r || jsonb_build_object('binomes', n);
  end if;
  if to_regclass('public.media') is not null then
    execute 'select count(*) from public.media where dive_id is not null and deleted_at is null' into n;
    r := r || jsonb_build_object('photos', n);
  end if;
  return r;
end;
$$;
revoke all on function public.admin_stats() from public, anon;
grant execute on function public.admin_stats() to authenticated;

-- Les utilisateurs, du plus récemment actif au plus ancien
create or replace function public.admin_utilisateurs(p_limite int default 100)
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
    'id', u.id,
    'email', u.email,
    'prenom', coalesce(nullif(u.raw_user_meta_data ->> 'first_name', ''), split_part(coalesce(u.raw_user_meta_data ->> 'full_name', ''), ' ', 1)),
    'inscrit_le', u.created_at,
    'derniere_visite', a.derniere_visite,
    'appareil', a.appareil,
    'plongees', (select count(*) from public.dives d where d.user_id = u.id and d.deleted_at is null)
  )
  from auth.users u
  left join public.user_activity a on a.user_id = u.id
  order by coalesce(a.derniere_visite, u.created_at) desc
  limit greatest(1, least(p_limite, 500));
end;
$$;
revoke all on function public.admin_utilisateurs(int) from public, anon;
grant execute on function public.admin_utilisateurs(int) to authenticated;
