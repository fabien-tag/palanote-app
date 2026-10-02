-- ============================================================
-- Palanote — Tableau de bord : finances et lettre annuelle
-- Tables : admin_charges (ce que coûte l'app), recif_dons (ce que donnent
-- les membres du Récif), admin_reglages (coût estimé d'une page lue par l'IA),
-- lettres (historique des envois).
-- Fonctions : admin_pages_par_mois, admin_nb_destinataires, se_desabonner,
-- destinataires_lettre (réservée à la fonction d'envoi).
-- Prérequis : palanote-tableau-de-bord.sql et palanote-page-moi.sql déjà lancés.
-- À coller dans Supabase → SQL Editor → Run. Relançable sans risque.
-- ============================================================

-- ------------------------------------------------------------
-- Charges : abonnements et frais de l'app
-- ------------------------------------------------------------
create table if not exists public.admin_charges (
  id uuid primary key default gen_random_uuid(),
  libelle text not null,
  categorie text,
  montant numeric(10,2) not null check (montant >= 0),
  periodicite text not null default 'mois' check (periodicite in ('mois', 'an', 'unique')),
  depuis date not null default date_trunc('month', current_date)::date,
  jusqu_a date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.admin_charges to authenticated;
grant all on public.admin_charges to service_role;
alter table public.admin_charges enable row level security;
drop policy if exists "Admin gère les charges" on public.admin_charges;
create policy "Admin gère les charges" on public.admin_charges for all to authenticated
  using (public.est_admin()) with check (public.est_admin());
drop trigger if exists admin_charges_updated_at on public.admin_charges;
create trigger admin_charges_updated_at before update on public.admin_charges
  for each row execute function public.update_updated_at_column();

-- Les frais connus au départ (modifiables ensuite dans le tableau de bord)
insert into public.admin_charges (libelle, categorie, montant, periodicite)
select * from (values
  ('Supabase : serveur et base', 'Hébergement', 25.00, 'mois'),
  ('Lovable : hébergement du site', 'Hébergement', 20.00, 'mois'),
  ('Nom de domaine', 'Domaine', 15.00, 'an'),
  ('Compte développeur Apple', 'Stores', 99.00, 'an')
) as v(libelle, categorie, montant, periodicite)
where not exists (select 1 from public.admin_charges);

-- ------------------------------------------------------------
-- Réglages du tableau de bord (une seule ligne)
-- ------------------------------------------------------------
create table if not exists public.admin_reglages (
  id boolean primary key default true check (id),
  cout_page_ia numeric(8,4) not null default 0.02,   -- € par page lue par l'IA (estimation)
  updated_at timestamptz not null default now()
);
insert into public.admin_reglages (id) values (true) on conflict do nothing;
grant select, update on public.admin_reglages to authenticated;
grant all on public.admin_reglages to service_role;
alter table public.admin_reglages enable row level security;
drop policy if exists "Admin lit les réglages" on public.admin_reglages;
create policy "Admin lit les réglages" on public.admin_reglages for select to authenticated using (public.est_admin());
drop policy if exists "Admin modifie les réglages" on public.admin_reglages;
create policy "Admin modifie les réglages" on public.admin_reglages for update to authenticated
  using (public.est_admin()) with check (public.est_admin());

-- ------------------------------------------------------------
-- Dons du Récif (saisis à la main pour l'instant, puis par Stripe)
-- ------------------------------------------------------------
create table if not exists public.recif_dons (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  email text,
  prenom text,
  montant numeric(10,2) not null check (montant > 0),
  formule text,                              -- cafe | coup-de-main | a-vie | autre
  source text not null default 'manuel' check (source in ('manuel', 'stripe')),
  reference text unique,                     -- identifiant du paiement Stripe, plus tard
  recu_le timestamptz not null default now(),
  note text,
  created_at timestamptz not null default now()
);
create index if not exists recif_dons_recu_idx on public.recif_dons (recu_le desc);
grant select, insert, update, delete on public.recif_dons to authenticated;
grant all on public.recif_dons to service_role;
alter table public.recif_dons enable row level security;
drop policy if exists "Admin gère les dons" on public.recif_dons;
create policy "Admin gère les dons" on public.recif_dons for all to authenticated
  using (public.est_admin()) with check (public.est_admin());
drop policy if exists "Voir ses propres dons" on public.recif_dons;
create policy "Voir ses propres dons" on public.recif_dons for select to authenticated
  using (auth.uid() = user_id);

-- ------------------------------------------------------------
-- Pages lues par l'IA, mois par mois (12 derniers mois)
-- ------------------------------------------------------------
create or replace function public.admin_pages_par_mois()
returns setof jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.est_admin() then raise exception 'réservé à l''administrateur'; end if;
  if to_regclass('public.ocr_pages') is null then return; end if;
  return query execute $q$
    select jsonb_build_object('mois', to_char(m.mois, 'YYYY-MM'),
             'pages', (select count(*) from public.ocr_pages p where date_trunc('month', p.created_at) = m.mois))
    from generate_series(date_trunc('month', now()) - interval '11 months', date_trunc('month', now()), interval '1 month') as m(mois)
    order by m.mois
  $q$;
end;
$$;
revoke all on function public.admin_pages_par_mois() from public, anon;
grant execute on function public.admin_pages_par_mois() to authenticated;

-- ------------------------------------------------------------
-- Lettre annuelle
-- ------------------------------------------------------------
-- Un jeton par plongeur pour le lien « Ne plus recevoir ce bilan »
alter table public.profiles add column if not exists jeton_lettre uuid not null default gen_random_uuid();

create table if not exists public.lettres (
  id uuid primary key default gen_random_uuid(),
  sujet text not null,
  contenu text not null,
  annee int,
  test boolean not null default false,
  nb_destinataires int not null default 0,
  nb_envoyes int not null default 0,
  erreur text,
  envoyee_par uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
grant select on public.lettres to authenticated;
grant all on public.lettres to service_role;
alter table public.lettres enable row level security;
drop policy if exists "Admin lit les lettres" on public.lettres;
create policy "Admin lit les lettres" on public.lettres for select to authenticated using (public.est_admin());

-- Nombre de plongeurs qui ont accepté la lettre
create or replace function public.admin_nb_destinataires()
returns int
language plpgsql
stable
security definer
set search_path = public
as $$
declare n int;
begin
  if not public.est_admin() then raise exception 'réservé à l''administrateur'; end if;
  select count(*) into n
  from public.profiles p join auth.users u on u.id = p.id
  where p.lettre_annuelle and u.email is not null;
  return n;
end;
$$;
revoke all on function public.admin_nb_destinataires() from public, anon;
grant execute on function public.admin_nb_destinataires() to authenticated;

-- Destinataires et leur bilan de l'année : lu uniquement par la fonction d'envoi (clé secrète)
create or replace function public.destinataires_lettre(p_annee int)
returns setof jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'email', u.email,
    'prenom', public.infos_plongeur(u.id) ->> 'prenom',
    'jeton', p.jeton_lettre,
    'plongees', (select count(*) from public.dives d where d.user_id = u.id and d.deleted_at is null and extract(year from d.dive_date) = p_annee),
    'minutes', (select coalesce(sum(d.duration_min), 0) from public.dives d where d.user_id = u.id and d.deleted_at is null and extract(year from d.dive_date) = p_annee),
    'sites', (select count(distinct lower(trim(d.site_name))) from public.dives d where d.user_id = u.id and d.deleted_at is null and extract(year from d.dive_date) = p_annee and d.site_name is not null),
    'profondeur', (select max(d.max_depth_m) from public.dives d where d.user_id = u.id and d.deleted_at is null and extract(year from d.dive_date) = p_annee)
  )
  from public.profiles p
  join auth.users u on u.id = p.id
  where p.lettre_annuelle and u.email is not null;
$$;
revoke all on function public.destinataires_lettre(int) from public, anon, authenticated;
grant execute on function public.destinataires_lettre(int) to service_role;

-- Lien de désabonnement (sans être connecté)
create or replace function public.se_desabonner(p_jeton uuid)
returns boolean
language plpgsql
volatile
security definer
set search_path = public
as $$
declare n int;
begin
  update public.profiles set lettre_annuelle = false, lettre_annuelle_le = null where jeton_lettre = p_jeton;
  get diagnostics n = row_count;
  return n > 0;
end;
$$;
revoke all on function public.se_desabonner(uuid) from public;
grant execute on function public.se_desabonner(uuid) to anon, authenticated;
