-- ============================================================
-- Palanote — Numérisation des carnets papier (écrans 11 à 17)
-- Tables : media, ocr_batches, ocr_pages, ocr_extractions
-- Stockage : bucket privé « photos » (une dossier par utilisateur)
-- À coller dans Supabase → SQL Editor → Run
-- Relançable sans risque : ne casse rien si exécuté deux fois.
-- Prérequis : sql/palanote-page-nouvelle-plongee.sql (table dives) déjà exécuté.
-- ============================================================

-- ------------------------------------------------------------
-- Types
-- ------------------------------------------------------------
do $$ begin create type public.ocr_batch_status as enum ('en_attente','en_cours','a_relire','termine','erreur'); exception when duplicate_object then null; end $$;
do $$ begin create type public.ocr_page_status as enum ('en_attente','lue','illisible','erreur'); exception when duplicate_object then null; end $$;
do $$ begin create type public.ocr_extraction_status as enum ('a_relire','validee','rejetee','doublon'); exception when duplicate_object then null; end $$;

-- Lecture en cours (ajout à la liste prévue dans le schéma de référence)
alter type public.ocr_page_status add value if not exists 'en_cours';

-- ------------------------------------------------------------
-- media : une photo stockée (ici, une page de carnet)
-- ------------------------------------------------------------
create table if not exists public.media (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  dive_id uuid references public.dives(id) on delete set null,
  bucket text not null default 'photos',
  chemin text not null unique,
  octets bigint,
  largeur int,
  hauteur int,
  prise_le timestamptz,
  hash text,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists media_user_idx on public.media (user_id);
create index if not exists media_dive_idx on public.media (dive_id);

grant select, insert, update, delete on public.media to authenticated;
grant all on public.media to service_role;
alter table public.media enable row level security;

drop policy if exists "Lire ses medias" on public.media;
create policy "Lire ses medias" on public.media for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Declarer un media" on public.media;
create policy "Declarer un media" on public.media for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "Modifier un media" on public.media;
create policy "Modifier un media" on public.media for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Supprimer un media" on public.media;
create policy "Supprimer un media" on public.media for delete to authenticated using (auth.uid() = user_id);

drop trigger if exists media_updated_at on public.media;
create trigger media_updated_at before update on public.media for each row execute function public.update_updated_at_column();

-- ------------------------------------------------------------
-- ocr_batches : un carnet en cours de numérisation
-- ------------------------------------------------------------
create table if not exists public.ocr_batches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  libelle text,
  nb_pages int not null default 0,
  statut public.ocr_batch_status not null default 'en_attente',
  termine_le timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.ocr_batches add column if not exists numero int;        -- « Carnet n° 1 »
create index if not exists ocr_batches_user_idx on public.ocr_batches (user_id, created_at desc);

grant select, insert, update, delete on public.ocr_batches to authenticated;
grant all on public.ocr_batches to service_role;
alter table public.ocr_batches enable row level security;

drop policy if exists "Lire ses lots" on public.ocr_batches;
create policy "Lire ses lots" on public.ocr_batches for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Creer un lot" on public.ocr_batches;
create policy "Creer un lot" on public.ocr_batches for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "Modifier son lot" on public.ocr_batches;
create policy "Modifier son lot" on public.ocr_batches for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Supprimer son lot" on public.ocr_batches;
create policy "Supprimer son lot" on public.ocr_batches for delete to authenticated using (auth.uid() = user_id);

drop trigger if exists ocr_batches_updated_at on public.ocr_batches;
create trigger ocr_batches_updated_at before update on public.ocr_batches for each row execute function public.update_updated_at_column();

-- ------------------------------------------------------------
-- ocr_pages : une page photographiée, dans l'ordre du carnet
-- ------------------------------------------------------------
create table if not exists public.ocr_pages (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.ocr_batches(id) on delete cascade,
  media_id uuid references public.media(id) on delete set null,
  ordre int not null default 0,
  statut public.ocr_page_status not null default 'en_attente',
  texte_brut text,
  reponse_modele jsonb,
  modele text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ocr_pages_ordre_unique unique (batch_id, ordre)
);
alter table public.ocr_pages add column if not exists erreur text;          -- détail technique si la lecture échoue
alter table public.ocr_pages add column if not exists relue boolean not null default false; -- toutes ses plongées relues
create index if not exists ocr_pages_batch_idx on public.ocr_pages (batch_id, ordre);

grant select, insert, update, delete on public.ocr_pages to authenticated;
grant all on public.ocr_pages to service_role;
alter table public.ocr_pages enable row level security;

drop policy if exists "Lire ses pages" on public.ocr_pages;
create policy "Lire ses pages" on public.ocr_pages for select to authenticated
  using (exists (select 1 from public.ocr_batches b where b.id = ocr_pages.batch_id and b.user_id = auth.uid()));
drop policy if exists "Ajouter une page" on public.ocr_pages;
create policy "Ajouter une page" on public.ocr_pages for insert to authenticated
  with check (exists (select 1 from public.ocr_batches b where b.id = ocr_pages.batch_id and b.user_id = auth.uid()));
drop policy if exists "Modifier sa page" on public.ocr_pages;
create policy "Modifier sa page" on public.ocr_pages for update to authenticated
  using (exists (select 1 from public.ocr_batches b where b.id = ocr_pages.batch_id and b.user_id = auth.uid()))
  with check (exists (select 1 from public.ocr_batches b where b.id = ocr_pages.batch_id and b.user_id = auth.uid()));
drop policy if exists "Supprimer sa page" on public.ocr_pages;
create policy "Supprimer sa page" on public.ocr_pages for delete to authenticated
  using (exists (select 1 from public.ocr_batches b where b.id = ocr_pages.batch_id and b.user_id = auth.uid()));

drop trigger if exists ocr_pages_updated_at on public.ocr_pages;
create trigger ocr_pages_updated_at before update on public.ocr_pages for each row execute function public.update_updated_at_column();

-- ------------------------------------------------------------
-- ocr_extractions : une plongée lue sur une page, à relire
--   champs     : valeurs proposées   {"date":"1987-08-12","profondeur_max":38.5,…}
--   confiances : par champ            {"date":"sur","temperature":"a_verifier","pression_fin":"non_lu"}
--   lectures   : texte brut lu        {"temperature":"1g"}
-- ------------------------------------------------------------
create table if not exists public.ocr_extractions (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references public.ocr_pages(id) on delete cascade,
  champs jsonb not null default '{}'::jsonb,
  confiances jsonb not null default '{}'::jsonb,
  statut public.ocr_extraction_status not null default 'a_relire',
  dive_id uuid references public.dives(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.ocr_extractions add column if not exists lectures jsonb not null default '{}'::jsonb;
alter table public.ocr_extractions add column if not exists ordre int not null default 0; -- « plongée 1 sur 2 »
create index if not exists ocr_extractions_page_idx on public.ocr_extractions (page_id, ordre);
create index if not exists ocr_extractions_statut_idx on public.ocr_extractions (statut);

grant select, insert, update, delete on public.ocr_extractions to authenticated;
grant all on public.ocr_extractions to service_role;
alter table public.ocr_extractions enable row level security;

drop policy if exists "Lire ses extractions" on public.ocr_extractions;
create policy "Lire ses extractions" on public.ocr_extractions for select to authenticated
  using (exists (select 1 from public.ocr_pages p join public.ocr_batches b on b.id = p.batch_id where p.id = ocr_extractions.page_id and b.user_id = auth.uid()));
drop policy if exists "Creer une extraction" on public.ocr_extractions;
create policy "Creer une extraction" on public.ocr_extractions for insert to authenticated
  with check (exists (select 1 from public.ocr_pages p join public.ocr_batches b on b.id = p.batch_id where p.id = ocr_extractions.page_id and b.user_id = auth.uid()));
drop policy if exists "Modifier son extraction" on public.ocr_extractions;
create policy "Modifier son extraction" on public.ocr_extractions for update to authenticated
  using (exists (select 1 from public.ocr_pages p join public.ocr_batches b on b.id = p.batch_id where p.id = ocr_extractions.page_id and b.user_id = auth.uid()))
  with check (exists (select 1 from public.ocr_pages p join public.ocr_batches b on b.id = p.batch_id where p.id = ocr_extractions.page_id and b.user_id = auth.uid()));
drop policy if exists "Supprimer son extraction" on public.ocr_extractions;
create policy "Supprimer son extraction" on public.ocr_extractions for delete to authenticated
  using (exists (select 1 from public.ocr_pages p join public.ocr_batches b on b.id = p.batch_id where p.id = ocr_extractions.page_id and b.user_id = auth.uid()));

drop trigger if exists ocr_extractions_updated_at on public.ocr_extractions;
create trigger ocr_extractions_updated_at before update on public.ocr_extractions for each row execute function public.update_updated_at_column();

-- ------------------------------------------------------------
-- dives : origine de la plongée (saisie, carnet numérisé…)
-- ------------------------------------------------------------
alter table public.dives add column if not exists source text not null default 'manuelle'; -- manuelle | ocr
alter table public.dives add column if not exists signed boolean;   -- carnet signé
alter table public.dives add column if not exists stamped boolean;  -- carnet tamponné

-- ------------------------------------------------------------
-- Stockage : bucket privé « photos »
-- Chaque utilisateur n'accède qu'à son dossier : photos/<son id>/…
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', false, 15728640, array['image/jpeg','image/png','image/webp','image/heic','image/heif'])
on conflict (id) do nothing;

drop policy if exists "photos_lire_les_siennes" on storage.objects;
create policy "photos_lire_les_siennes" on storage.objects for select to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "photos_ajouter_les_siennes" on storage.objects;
create policy "photos_ajouter_les_siennes" on storage.objects for insert to authenticated
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "photos_modifier_les_siennes" on storage.objects;
create policy "photos_modifier_les_siennes" on storage.objects for update to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "photos_supprimer_les_siennes" on storage.objects;
create policy "photos_supprimer_les_siennes" on storage.objects for delete to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
