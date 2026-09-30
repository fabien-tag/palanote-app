-- ============================================================
-- PALANOTE · Schema complet
-- A coller dans Supabase > SQL Editor > New query > Run
-- Projet : Palanote (imjbtxvhanvewopafmxk)
-- ============================================================
-- Le script est idempotent : il peut etre relance sans danger.
-- Il ne modifie pas les 3 tables deja presentes (profiles,
-- user_settings, consents) et cree les 29 autres.
-- Ordre impose par les cles etrangeres.

-- ------------------------------------------------------------
-- 01 · Extensions + fonction shared
-- ------------------------------------------------------------
create extension if not exists postgis with schema extensions;
create extension if not exists pg_trgm with schema extensions;

create or replace function public.update_updated_at_column()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ------------------------------------------------------------
-- 02 · Types metier (enum)
-- ------------------------------------------------------------
do $$ begin create type public.device_platform as enum ('ios','android'); exception when duplicate_object then null; end $$;
do $$ begin create type public.gaz_type as enum ('air','nitrox','trimix','recycleur'); exception when duplicate_object then null; end $$;
do $$ begin create type public.combinaison_type as enum ('humide','semi_etanche','etanche'); exception when duplicate_object then null; end $$;
do $$ begin create type public.type_plongee as enum ('exploration','formation','epave','nuit','derive','grotte'); exception when duplicate_object then null; end $$;
do $$ begin create type public.dive_source as enum ('manuelle','ocr','uddf','binome'); exception when duplicate_object then null; end $$;
do $$ begin create type public.dive_status as enum ('brouillon','a_verifier','validee'); exception when duplicate_object then null; end $$;
do $$ begin create type public.buddy_role as enum ('binome','guide','encadrant','eleve'); exception when duplicate_object then null; end $$;
do $$ begin create type public.site_type as enum ('sec','epave','tombant','grotte','tombant_sable'); exception when duplicate_object then null; end $$;
do $$ begin create type public.suggestion_status as enum ('en_attente','acceptee','refusee','doublon'); exception when duplicate_object then null; end $$;
do $$ begin create type public.identification_source as enum ('utilisateur','ia'); exception when duplicate_object then null; end $$;
do $$ begin create type public.ocr_batch_status as enum ('en_attente','en_cours','a_relire','termine','erreur'); exception when duplicate_object then null; end $$;
do $$ begin create type public.ocr_page_status as enum ('en_attente','lue','illisible','erreur'); exception when duplicate_object then null; end $$;
do $$ begin create type public.ocr_extraction_status as enum ('a_relire','validee','rejetee','doublon'); exception when duplicate_object then null; end $$;
do $$ begin create type public.import_format as enum ('uddf','csv','subsurface','divinglog'); exception when duplicate_object then null; end $$;
do $$ begin create type public.export_format as enum ('uddf','csv','pdf','archive_complete'); exception when duplicate_object then null; end $$;
do $$ begin create type public.export_status as enum ('en_cours','pret','expire','erreur'); exception when duplicate_object then null; end $$;
do $$ begin create type public.friend_status as enum ('en_attente','acceptee','bloquee'); exception when duplicate_object then null; end $$;
do $$ begin create type public.proposal_status as enum ('proposee','acceptee','refusee','doublon'); exception when duplicate_object then null; end $$;
do $$ begin create type public.notification_type as enum ('ocr_termine','proposition','ami','sortie','recif'); exception when duplicate_object then null; end $$;
do $$ begin create type public.payment_status as enum ('reussi','rembourse','echoue'); exception when duplicate_object then null; end $$;
do $$ begin create type public.email_type as enum ('bilan','reinitialisation','recif_merci'); exception when duplicate_object then null; end $$;
do $$ begin create type public.email_status as enum ('envoye','rejete','plainte'); exception when duplicate_object then null; end $$;

-- ------------------------------------------------------------
-- 03 · Identite : push_devices
-- ------------------------------------------------------------
create table if not exists public.push_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token text not null unique,
  plateforme public.device_platform not null default 'ios',
  dernier_succes_le timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists push_devices_user_idx on public.push_devices (user_id);

grant select, insert, update, delete on public.push_devices to authenticated;
grant all on public.push_devices to service_role;

alter table public.push_devices enable row level security;
create policy "Lire ses appareils" on public.push_devices for select to authenticated using (auth.uid() = user_id);
create policy "Enregistrer un appareil" on public.push_devices for insert to authenticated with check (auth.uid() = user_id);
create policy "Supprimer un appareil" on public.push_devices for delete to authenticated using (auth.uid() = user_id);

drop trigger if exists push_devices_updated_at on public.push_devices;
create trigger push_devices_updated_at before update on public.push_devices for each row execute function public.update_updated_at_column();

-- ------------------------------------------------------------
-- 04 · Referentiels : dive_sites, site_aliases, site_suggestions, species
-- ------------------------------------------------------------
create table if not exists public.dive_sites (
  id uuid primary key default gen_random_uuid(),
  nom text not null,
  pays text,
  region text,
  position extensions.geography(Point,4326),
  type_site public.site_type,
  prof_max_m numeric(5,2),
  description text,
  valide boolean not null default false,
  cree_par uuid references auth.users(id) on delete set null,
  fusionne_dans uuid references public.dive_sites(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists dive_sites_position_idx on public.dive_sites using gist (position);
create index if not exists dive_sites_nom_idx on public.dive_sites using gin (nom gin_trgm_ops);
create index if not exists dive_sites_region_idx on public.dive_sites (region);

grant select on public.dive_sites to authenticated;
grant all on public.dive_sites to service_role;

alter table public.dive_sites enable row level security;
create policy "Sites lisibles par les plongeurs" on public.dive_sites for select to authenticated using (true);
-- Aucune politique d'ecriture : le referentiel est modifie uniquement cote serveur.

drop trigger if exists dive_sites_updated_at on public.dive_sites;
create trigger dive_sites_updated_at before update on public.dive_sites for each row execute function public.update_updated_at_column();

create table if not exists public.site_aliases (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.dive_sites(id) on delete cascade,
  alias text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists site_aliases_alias_idx on public.site_aliases using gin (alias gin_trgm_ops);
create index if not exists site_aliases_site_idx on public.site_aliases (site_id);

grant select on public.site_aliases to authenticated;
grant all on public.site_aliases to service_role;

alter table public.site_aliases enable row level security;
create policy "Alias lisibles par les plongeurs" on public.site_aliases for select to authenticated using (true);

drop trigger if exists site_aliases_updated_at on public.site_aliases;
create trigger site_aliases_updated_at before update on public.site_aliases for each row execute function public.update_updated_at_column();

create table if not exists public.site_suggestions (
  id uuid primary key default gen_random_uuid(),
  site_id uuid references public.dive_sites(id) on delete set null,
  propose_par uuid not null references auth.users(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  statut public.suggestion_status not null default 'en_attente',
  traite_par uuid references auth.users(id) on delete set null,
  traite_le timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists site_suggestions_statut_idx on public.site_suggestions (statut);

grant select, insert on public.site_suggestions to authenticated;
grant all on public.site_suggestions to service_role;

alter table public.site_suggestions enable row level security;
create policy "Lire ses suggestions" on public.site_suggestions for select to authenticated using (auth.uid() = propose_par);
create policy "Proposer un site" on public.site_suggestions for insert to authenticated with check (auth.uid() = propose_par);

drop trigger if exists site_suggestions_updated_at on public.site_suggestions;
create trigger site_suggestions_updated_at before update on public.site_suggestions for each row execute function public.update_updated_at_column();

create table if not exists public.species (
  id uuid primary key default gen_random_uuid(),
  nom_commun text not null,
  nom_scientifique text not null unique,
  famille text,
  photo_url text,
  description text,
  zones text[] not null default '{}',
  prof_min_m int,
  prof_max_m int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists species_nom_idx on public.species using gin (nom_commun gin_trgm_ops);

grant select on public.species to authenticated;
grant all on public.species to service_role;

alter table public.species enable row level security;
create policy "Especes lisibles par les plongeurs" on public.species for select to authenticated using (true);

drop trigger if exists species_updated_at on public.species;
create trigger species_updated_at before update on public.species for each row execute function public.update_updated_at_column();

-- ------------------------------------------------------------
-- 05 · Le carnet : dives, dive_buddies, tags, dive_tags
-- ------------------------------------------------------------
create table if not exists public.dives (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  numero int,
  date_immersion date,
  heure_immersion time,
  duree_min integer,
  prof_max_m numeric(5,2),
  prof_moy_m numeric(5,2),
  temp_eau_c numeric(4,1),
  visibilite_m integer,
  gaz public.gaz_type,
  o2_pct integer,
  he_pct integer,
  bloc_l numeric(6,2),
  pression_debut_bar integer,
  pression_fin_bar integer,
  lest_kg numeric(5,2),
  combinaison public.combinaison_type,
  type_plongee public.type_plongee,
  note integer check (note between 1 and 5),
  commentaire text,
  site_id uuid references public.dive_sites(id) on delete set null,
  site_saisi text,
  source public.dive_source not null default 'manuelle',
  statut public.dive_status not null default 'validee',
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists dives_user_date_idx on public.dives (user_id, date_immersion desc);
create index if not exists dives_site_idx on public.dives (site_id);
create index if not exists dives_statut_idx on public.dives (statut) where deleted_at is null;

grant select, insert, update, delete on public.dives to authenticated;
grant all on public.dives to service_role;

alter table public.dives enable row level security;
create policy "Lire son carnet" on public.dives for select to authenticated using (auth.uid() = user_id);
create policy "Ajouter une plongee" on public.dives for insert to authenticated with check (auth.uid() = user_id);
create policy "Modifier sa plongee" on public.dives for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Supprimer sa plongee" on public.dives for delete to authenticated using (auth.uid() = user_id);

drop trigger if exists dives_updated_at on public.dives;
create trigger dives_updated_at before update on public.dives for each row execute function public.update_updated_at_column();

create table if not exists public.dive_buddies (
  id uuid primary key default gen_random_uuid(),
  dive_id uuid not null references public.dives(id) on delete cascade,
  buddy_user_id uuid references public.profiles(id) on delete set null,
  buddy_nom text,
  role public.buddy_role not null default 'binome',
  confirme boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint dive_buddies_buddy_obligatoire check (buddy_user_id is not null or buddy_nom is not null)
);
create index if not exists dive_buddies_dive_idx on public.dive_buddies (dive_id);
create index if not exists dive_buddies_user_idx on public.dive_buddies (buddy_user_id);

grant select, insert, update, delete on public.dive_buddies to authenticated;
grant all on public.dive_buddies to service_role;

alter table public.dive_buddies enable row level security;
create policy "Lire sa palanquee" on public.dive_buddies for select to authenticated
  using (
    auth.uid() = buddy_user_id
    or exists (select 1 from public.dives d where d.id = dive_buddies.dive_id and d.user_id = auth.uid())
  );
create policy "Ajouter un binome" on public.dive_buddies for insert to authenticated
  with check (exists (select 1 from public.dives d where d.id = dive_buddies.dive_id and d.user_id = auth.uid()));
create policy "Modifier sa palanquee" on public.dive_buddies for update to authenticated
  using (exists (select 1 from public.dives d where d.id = dive_buddies.dive_id and d.user_id = auth.uid()))
  with check (exists (select 1 from public.dives d where d.id = dive_buddies.dive_id and d.user_id = auth.uid()));
create policy "Retirer un binome" on public.dive_buddies for delete to authenticated
  using (exists (select 1 from public.dives d where d.id = dive_buddies.dive_id and d.user_id = auth.uid()));

drop trigger if exists dive_buddies_updated_at on public.dive_buddies;
create trigger dive_buddies_updated_at before update on public.dive_buddies for each row execute function public.update_updated_at_column();

create table if not exists public.tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  libelle text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tags_unique_par_plongeur unique (user_id, libelle)
);

grant select, insert, update, delete on public.tags to authenticated;
grant all on public.tags to service_role;

alter table public.tags enable row level security;
create policy "Lire ses etiquettes" on public.tags for select to authenticated using (auth.uid() = user_id);
create policy "Creer une etiquette" on public.tags for insert to authenticated with check (auth.uid() = user_id);
create policy "Renommer une etiquette" on public.tags for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Supprimer une etiquette" on public.tags for delete to authenticated using (auth.uid() = user_id);

drop trigger if exists tags_updated_at on public.tags;
create trigger tags_updated_at before update on public.tags for each row execute function public.update_updated_at_column();

create table if not exists public.dive_tags (
  dive_id uuid not null references public.dives(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (dive_id, tag_id)
);

grant select, insert, delete on public.dive_tags to authenticated;
grant all on public.dive_tags to service_role;

alter table public.dive_tags enable row level security;
create policy "Lire ses etiquettes de plongee" on public.dive_tags for select to authenticated
  using (
    exists (select 1 from public.dives d where d.id = dive_tags.dive_id and d.user_id = auth.uid())
    or exists (select 1 from public.tags t where t.id = dive_tags.tag_id and t.user_id = auth.uid())
  );
create policy "Etiqueter sa plongee" on public.dive_tags for insert to authenticated
  with check (
    exists (select 1 from public.dives d where d.id = dive_tags.dive_id and d.user_id = auth.uid())
    and exists (select 1 from public.tags t where t.id = dive_tags.tag_id and t.user_id = auth.uid())
  );
create policy "Retirer une etiquette" on public.dive_tags for delete to authenticated
  using (
    exists (select 1 from public.dives d where d.id = dive_tags.dive_id and d.user_id = auth.uid())
    or exists (select 1 from public.tags t where t.id = dive_tags.tag_id and t.user_id = auth.uid())
  );

-- ------------------------------------------------------------
-- 06 · Photos et especes : media, media_shares, sightings
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
  position extensions.geography(Point,4326),
  hash text,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists media_user_idx on public.media (user_id);
create index if not exists media_dive_idx on public.media (dive_id);
create index if not exists media_prise_le_idx on public.media (prise_le desc);
create index if not exists media_hash_idx on public.media (user_id, hash);

grant select, insert, update, delete on public.media to authenticated;
grant all on public.media to service_role;

alter table public.media enable row level security;
create policy "Lire ses medias" on public.media for select to authenticated using (auth.uid() = user_id);
create policy "Declarer un media" on public.media for insert to authenticated with check (auth.uid() = user_id);
create policy "Modifier un media" on public.media for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Supprimer un media" on public.media for delete to authenticated using (auth.uid() = user_id);

drop trigger if exists media_updated_at on public.media;
create trigger media_updated_at before update on public.media for each row execute function public.update_updated_at_column();

create table if not exists public.media_shares (
  id uuid primary key default gen_random_uuid(),
  media_id uuid not null references public.media(id) on delete cascade,
  partage_avec uuid references public.profiles(id) on delete cascade,
  token text unique,
  expire_le timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists media_shares_media_idx on public.media_shares (media_id);
create index if not exists media_shares_dest_idx on public.media_shares (partage_avec);

grant select, insert, update, delete on public.media_shares to authenticated;
grant all on public.media_shares to service_role;

alter table public.media_shares enable row level security;
create policy "Lire les partages concernants" on public.media_shares for select to authenticated
  using (
    exists (select 1 from public.media m where m.id = media_shares.media_id and m.user_id = auth.uid())
    or auth.uid() = partage_avec
  );
create policy "Partager un media" on public.media_shares for insert to authenticated
  with check (exists (select 1 from public.media m where m.id = media_shares.media_id and m.user_id = auth.uid()));
create policy "Modifier un partage" on public.media_shares for update to authenticated
  using (exists (select 1 from public.media m where m.id = media_shares.media_id and m.user_id = auth.uid()))
  with check (exists (select 1 from public.media m where m.id = media_shares.media_id and m.user_id = auth.uid()));
create policy "Retirer un partage" on public.media_shares for delete to authenticated
  using (
    exists (select 1 from public.media m where m.id = media_shares.media_id and m.user_id = auth.uid())
    or auth.uid() = partage_avec
  );

drop trigger if exists media_shares_updated_at on public.media_shares;
create trigger media_shares_updated_at before update on public.media_shares for each row execute function public.update_updated_at_column();

create table if not exists public.sightings (
  id uuid primary key default gen_random_uuid(),
  dive_id uuid not null references public.dives(id) on delete cascade,
  species_id uuid not null references public.species(id) on delete restrict,
  media_id uuid references public.media(id) on delete set null,
  identifie_par public.identification_source not null default 'utilisateur',
  confiance numeric(3,2),
  confirme boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists sightings_dive_idx on public.sightings (dive_id);
create index if not exists sightings_species_idx on public.sightings (species_id);

grant select, insert, update, delete on public.sightings to authenticated;
grant all on public.sightings to service_role;

alter table public.sightings enable row level security;
create policy "Lire ses observations" on public.sightings for select to authenticated
  using (exists (select 1 from public.dives d where d.id = sightings.dive_id and d.user_id = auth.uid()));
create policy "Ajouter une observation" on public.sightings for insert to authenticated
  with check (exists (select 1 from public.dives d where d.id = sightings.dive_id and d.user_id = auth.uid()));
create policy "Modifier une observation" on public.sightings for update to authenticated
  using (exists (select 1 from public.dives d where d.id = sightings.dive_id and d.user_id = auth.uid()))
  with check (exists (select 1 from public.dives d where d.id = sightings.dive_id and d.user_id = auth.uid()));
create policy "Supprimer une observation" on public.sightings for delete to authenticated
  using (exists (select 1 from public.dives d where d.id = sightings.dive_id and d.user_id = auth.uid()));

drop trigger if exists sightings_updated_at on public.sightings;
create trigger sightings_updated_at before update on public.sightings for each row execute function public.update_updated_at_column();

-- ------------------------------------------------------------
-- 07 · Numerisation : ocr_batches, ocr_pages, ocr_extractions
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
create index if not exists ocr_batches_user_idx on public.ocr_batches (user_id, created_at desc);

grant select, insert, update, delete on public.ocr_batches to authenticated;
grant all on public.ocr_batches to service_role;

alter table public.ocr_batches enable row level security;
create policy "Lire ses lots" on public.ocr_batches for select to authenticated using (auth.uid() = user_id);
create policy "Creer un lot" on public.ocr_batches for insert to authenticated with check (auth.uid() = user_id);
create policy "Modifier son lot" on public.ocr_batches for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Supprimer son lot" on public.ocr_batches for delete to authenticated using (auth.uid() = user_id);

drop trigger if exists ocr_batches_updated_at on public.ocr_batches;
create trigger ocr_batches_updated_at before update on public.ocr_batches for each row execute function public.update_updated_at_column();

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
create index if not exists ocr_pages_batch_idx on public.ocr_pages (batch_id, ordre);

grant select, insert, update, delete on public.ocr_pages to authenticated;
grant all on public.ocr_pages to service_role;

alter table public.ocr_pages enable row level security;
create policy "Lire ses pages" on public.ocr_pages for select to authenticated
  using (exists (select 1 from public.ocr_batches b where b.id = ocr_pages.batch_id and b.user_id = auth.uid()));
create policy "Ajouter une page" on public.ocr_pages for insert to authenticated
  with check (exists (select 1 from public.ocr_batches b where b.id = ocr_pages.batch_id and b.user_id = auth.uid()));
create policy "Modifier sa page" on public.ocr_pages for update to authenticated
  using (exists (select 1 from public.ocr_batches b where b.id = ocr_pages.batch_id and b.user_id = auth.uid()))
  with check (exists (select 1 from public.ocr_batches b where b.id = ocr_pages.batch_id and b.user_id = auth.uid()));
create policy "Supprimer sa page" on public.ocr_pages for delete to authenticated
  using (exists (select 1 from public.ocr_batches b where b.id = ocr_pages.batch_id and b.user_id = auth.uid()));

drop trigger if exists ocr_pages_updated_at on public.ocr_pages;
create trigger ocr_pages_updated_at before update on public.ocr_pages for each row execute function public.update_updated_at_column();

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
create index if not exists ocr_extractions_page_idx on public.ocr_extractions (page_id);
create index if not exists ocr_extractions_statut_idx on public.ocr_extractions (statut);

grant select, insert, update, delete on public.ocr_extractions to authenticated;
grant all on public.ocr_extractions to service_role;

alter table public.ocr_extractions enable row level security;
create policy "Lire ses extractions" on public.ocr_extractions for select to authenticated
  using (exists (select 1 from public.ocr_pages p join public.ocr_batches b on b.id = p.batch_id where p.id = ocr_extractions.page_id and b.user_id = auth.uid()));
create policy "Creer une extraction" on public.ocr_extractions for insert to authenticated
  with check (exists (select 1 from public.ocr_pages p join public.ocr_batches b on b.id = p.batch_id where p.id = ocr_extractions.page_id and b.user_id = auth.uid()));
create policy "Modifier son extraction" on public.ocr_extractions for update to authenticated
  using (exists (select 1 from public.ocr_pages p join public.ocr_batches b on b.id = p.batch_id where p.id = ocr_extractions.page_id and b.user_id = auth.uid()))
  with check (exists (select 1 from public.ocr_pages p join public.ocr_batches b on b.id = p.batch_id where p.id = ocr_extractions.page_id and b.user_id = auth.uid()));
create policy "Supprimer son extraction" on public.ocr_extractions for delete to authenticated
  using (exists (select 1 from public.ocr_pages p join public.ocr_batches b on b.id = p.batch_id where p.id = ocr_extractions.page_id and b.user_id = auth.uid()));

drop trigger if exists ocr_extractions_updated_at on public.ocr_extractions;
create trigger ocr_extractions_updated_at before update on public.ocr_extractions for each row execute function public.update_updated_at_column();

-- ------------------------------------------------------------
-- 08 · Import / export : data_imports, data_exports
-- ------------------------------------------------------------
create table if not exists public.data_imports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  format public.import_format not null default 'uddf',
  fichier text,
  nb_importees int not null default 0,
  nb_ignoreees int not null default 0,
  rapport jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists data_imports_user_idx on public.data_imports (user_id, created_at desc);

grant select, insert, update on public.data_imports to authenticated;
grant all on public.data_imports to service_role;

alter table public.data_imports enable row level security;
create policy "Lire ses imports" on public.data_imports for select to authenticated using (auth.uid() = user_id);
create policy "Declarer un import" on public.data_imports for insert to authenticated with check (auth.uid() = user_id);
create policy "Modifier son import" on public.data_imports for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop trigger if exists data_imports_updated_at on public.data_imports;
create trigger data_imports_updated_at before update on public.data_imports for each row execute function public.update_updated_at_column();

-- lien import -> plongees creees, pour pouvoir annuler un import
alter table public.dives drop constraint if exists dives_import_id_fkey;
alter table public.dives add column if not exists import_id uuid references public.data_imports(id) on delete set null;
create index if not exists dives_import_idx on public.dives (import_id);

create table if not exists public.data_exports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  format public.export_format not null default 'uddf',
  statut public.export_status not null default 'en_cours',
  fichier text,
  expire_le timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists data_exports_user_idx on public.data_exports (user_id, created_at desc);

grant select, insert, update on public.data_exports to authenticated;
grant all on public.data_exports to service_role;

alter table public.data_exports enable row level security;
create policy "Lire ses exports" on public.data_exports for select to authenticated using (auth.uid() = user_id);
create policy "Demander un export" on public.data_exports for insert to authenticated with check (auth.uid() = user_id);
create policy "Modifier son export" on public.data_exports for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop trigger if exists data_exports_updated_at on public.data_exports;
create trigger data_exports_updated_at before update on public.data_exports for each row execute function public.update_updated_at_column();

-- ------------------------------------------------------------
-- 09 · Social : friendships, friend_invites, outings, outing_members,
--             dive_proposals, notifications
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

grant select, insert, update, delete on public.friendships to authenticated;
grant all on public.friendships to service_role;

alter table public.friendships enable row level security;
create policy "Lire ses relations" on public.friendships for select to authenticated using (auth.uid() = user_a or auth.uid() = user_b);
create policy "Demander une amitie" on public.friendships for insert to authenticated
  with check (auth.uid() = demande_par and (auth.uid() = user_a or auth.uid() = user_b));
create policy "Repondre a une demande" on public.friendships for update to authenticated
  using (auth.uid() = user_a or auth.uid() = user_b)
  with check (auth.uid() = user_a or auth.uid() = user_b);
create policy "Retirer un ami" on public.friendships for delete to authenticated using (auth.uid() = user_a or auth.uid() = user_b);

drop trigger if exists friendships_updated_at on public.friendships;
create trigger friendships_updated_at before update on public.friendships for each row execute function public.update_updated_at_column();

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

grant select, insert, update on public.friend_invites to authenticated;
grant all on public.friend_invites to service_role;

alter table public.friend_invites enable row level security;
create policy "Lire ses invitations" on public.friend_invites for select to authenticated
  using (auth.uid() = emis_par or auth.uid() = utilise_par);
create policy "Emettre une invitation" on public.friend_invites for insert to authenticated with check (auth.uid() = emis_par);
-- Utiliser une invitation : n'importe quel plongeur peut consommer un jeton non encore utilise
-- (le jeton est aleatoire et de courte duree, c'est lui qui fait la preuve).
create policy "Consommer une invitation" on public.friend_invites for update to authenticated
  using (utilise_par is null)
  with check (utilise_par = auth.uid());

drop trigger if exists friend_invites_updated_at on public.friend_invites;
create trigger friend_invites_updated_at before update on public.friend_invites for each row execute function public.update_updated_at_column();

create table if not exists public.outings (
  id uuid primary key default gen_random_uuid(),
  site_id uuid references public.dive_sites(id) on delete set null,
  libelle text,
  date_sortie date not null default current_date,
  ouverte_par uuid not null references auth.users(id) on delete cascade,
  token text unique,
  ferme_le timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists outings_date_idx on public.outings (date_sortie desc);
create index if not exists outings_ouverte_par_idx on public.outings (ouverte_par);

grant select, insert, update, delete on public.outings to authenticated;
grant all on public.outings to service_role;

alter table public.outings enable row level security;
create policy "Lire les sorties" on public.outings for select to authenticated
  using (
    auth.uid() = ouverte_par
    or exists (select 1 from public.outing_members m where m.outing_id = outings.id and m.user_id = auth.uid())
    or (ferme_le is not null and now() < ferme_le)
  );
create policy "Ouvrir une sortie" on public.outings for insert to authenticated with check (auth.uid() = ouverte_par);
create policy "Modifier sa sortie" on public.outings for update to authenticated using (auth.uid() = ouverte_par) with check (auth.uid() = ouverte_par);
create policy "Fermer sa sortie" on public.outings for delete to authenticated using (auth.uid() = ouverte_par);

drop trigger if exists outings_updated_at on public.outings;
create trigger outings_updated_at before update on public.outings for each row execute function public.update_updated_at_column();

create table if not exists public.outing_members (
  outing_id uuid not null references public.outings(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  rejoint_le timestamptz not null default now(),
  est_binome boolean not null default false,
  primary key (outing_id, user_id)
);
create index if not exists outing_members_user_idx on public.outing_members (user_id);

grant select, insert, update, delete on public.outing_members to authenticated;
grant all on public.outing_members to service_role;

alter table public.outing_members enable row level security;
create policy "Lire les participants" on public.outing_members for select to authenticated
  using (
    auth.uid() = user_id
    or exists (select 1 from public.outings o where o.id = outing_members.outing_id and o.ouverte_par = auth.uid())
  );
create policy "Rejoindre une sortie" on public.outing_members for insert to authenticated with check (auth.uid() = user_id);
create policy "Modifier sa participation" on public.outing_members for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Quitter une sortie" on public.outing_members for delete to authenticated
  using (auth.uid() = user_id or exists (select 1 from public.outings o where o.id = outing_members.outing_id and o.ouverte_par = auth.uid()));

create table if not exists public.dive_proposals (
  id uuid primary key default gen_random_uuid(),
  dive_source_id uuid not null references public.dives(id) on delete cascade,
  de_user uuid not null references auth.users(id) on delete cascade,
  vers_user uuid not null references auth.users(id) on delete cascade,
  champs jsonb not null default '{}'::jsonb,
  statut public.proposal_status not null default 'proposee',
  dive_id_cree uuid references public.dives(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint dive_proposals_pas_soi check (de_user <> vers_user)
);
create index if not exists dive_proposals_de_idx on public.dive_proposals (de_user);
create index if not exists dive_proposals_vers_idx on public.dive_proposals (vers_user, statut);

grant select, insert, update on public.dive_proposals to authenticated;
grant all on public.dive_proposals to service_role;

alter table public.dive_proposals enable row level security;
create policy "Lire ses propositions" on public.dive_proposals for select to authenticated using (auth.uid() = de_user or auth.uid() = vers_user);
create policy "Emettre une proposition" on public.dive_proposals for insert to authenticated with check (auth.uid() = de_user);
create policy "Repondre a une proposition" on public.dive_proposals for update to authenticated using (auth.uid() = vers_user) with check (auth.uid() = vers_user);

drop trigger if exists dive_proposals_updated_at on public.dive_proposals;
create trigger dive_proposals_updated_at before update on public.dive_proposals for each row execute function public.update_updated_at_column();

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type public.notification_type not null,
  payload jsonb not null default '{}'::jsonb,
  lu_le timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);
create index if not exists notifications_unread_idx on public.notifications (user_id) where lu_le is null;

grant select, update, delete on public.notifications to authenticated;
grant all on public.notifications to service_role;

alter table public.notifications enable row level security;
create policy "Lire ses notifications" on public.notifications for select to authenticated using (auth.uid() = user_id);
create policy "Marquer lues" on public.notifications for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Supprimer une notification" on public.notifications for delete to authenticated using (auth.uid() = user_id);

drop trigger if exists notifications_updated_at on public.notifications;
create trigger notifications_updated_at before update on public.notifications for each row execute function public.update_updated_at_column();

-- ------------------------------------------------------------
-- 10 · Le Recif : recif_payments, recif_wall
-- ------------------------------------------------------------
create table if not exists public.recif_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  palier public.recif_tier not null,
  montant_cts int not null,
  devise text not null default 'eur',
  stripe_payment_id text unique,
  statut public.payment_status not null default 'reussi',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists recif_payments_user_idx on public.recif_payments (user_id);

grant select on public.recif_payments to authenticated;
grant all on public.recif_payments to service_role;

alter table public.recif_payments enable row level security;
create policy "Lire ses dons" on public.recif_payments for select to authenticated using (auth.uid() = user_id);
-- Aucune ecriture depuis l'app : seule la cle de service (webhook Stripe) insere ici.

drop trigger if exists recif_payments_updated_at on public.recif_payments;
create trigger recif_payments_updated_at before update on public.recif_payments for each row execute function public.update_updated_at_column();

create table if not exists public.recif_wall (
  user_id uuid primary key references auth.users(id) on delete cascade,
  prenom_affiche text not null,
  visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete on public.recif_wall to authenticated;
grant all on public.recif_wall to service_role;

alter table public.recif_wall enable row level security;
create policy "Lire le mur" on public.recif_wall for select to authenticated using (visible or auth.uid() = user_id);
create policy "Apparaitre au mur" on public.recif_wall for insert to authenticated with check (auth.uid() = user_id);
create policy "Modifier son apparition" on public.recif_wall for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Quitter le mur" on public.recif_wall for delete to authenticated using (auth.uid() = user_id);

drop trigger if exists recif_wall_updated_at on public.recif_wall;
create trigger recif_wall_updated_at before update on public.recif_wall for each row execute function public.update_updated_at_column();

-- ------------------------------------------------------------
-- 11 · Suivi : satisfaction_responses, annual_recaps, email_log, deleted_records
-- ------------------------------------------------------------
create table if not exists public.satisfaction_responses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  satisfait boolean not null,
  raisons text[] not null default '{}',
  commentaire text,
  version_app text,
  plateforme text,
  created_at timestamptz not null default now()
);
create index if not exists satisfaction_created_idx on public.satisfaction_responses (created_at desc);

grant select, insert on public.satisfaction_responses to authenticated;
grant all on public.satisfaction_responses to service_role;

alter table public.satisfaction_responses enable row level security;
create policy "Lire ses reponses" on public.satisfaction_responses for select to authenticated using (auth.uid() = user_id);
create policy "Repondre au questionnaire" on public.satisfaction_responses for insert to authenticated
  with check (user_id is null or auth.uid() = user_id);

create table if not exists public.annual_recaps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  annee int not null,
  stats jsonb not null default '{}'::jsonb,
  envoye_le timestamptz,
  ouvert_le timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint annual_recaps_annee_unique unique (user_id, annee)
);

grant select on public.annual_recaps to authenticated;
grant all on public.annual_recaps to service_role;

alter table public.annual_recaps enable row level security;
create policy "Lire son bilan" on public.annual_recaps for select to authenticated using (auth.uid() = user_id);

drop trigger if exists annual_recaps_updated_at on public.annual_recaps;
create trigger annual_recaps_updated_at before update on public.annual_recaps for each row execute function public.update_updated_at_column();

create table if not exists public.email_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type public.email_type not null,
  statut public.email_status not null default 'envoye',
  provider_id text,
  created_at timestamptz not null default now()
);
create index if not exists email_log_user_idx on public.email_log (user_id, created_at desc);

grant select on public.email_log to authenticated;
grant all on public.email_log to service_role;

alter table public.email_log enable row level security;
create policy "Lire ses envois" on public.email_log for select to authenticated using (auth.uid() = user_id);

create table if not exists public.deleted_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  table_nom text not null,
  record_id uuid not null,
  supprime_le timestamptz not null default now()
);
create index if not exists deleted_records_user_idx on public.deleted_records (user_id, supprime_le);
create index if not exists deleted_records_purge_idx on public.deleted_records (supprime_le);

grant select, insert on public.deleted_records to authenticated;
grant all on public.deleted_records to service_role;

alter table public.deleted_records enable row level security;
create policy "Lire ses suppressions" on public.deleted_records for select to authenticated using (auth.uid() = user_id);
create policy "Tracer une suppression" on public.deleted_records for insert to authenticated with check (auth.uid() = user_id);

-- ------------------------------------------------------------
-- 12 · Buckets de stockage + regles
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public) values
  ('photos', 'photos', false),
  ('carnets', 'carnets', false),
  ('avatars', 'avatars', true),
  ('exports', 'exports', false)
on conflict (id) do nothing;

drop policy if exists "photos_select" on storage.objects;
create policy "photos_select" on storage.objects for select to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "photos_insert" on storage.objects;
create policy "photos_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "photos_update" on storage.objects;
create policy "photos_update" on storage.objects for update to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "photos_delete" on storage.objects;
create policy "photos_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "carnets_select" on storage.objects;
create policy "carnets_select" on storage.objects for select to authenticated
  using (bucket_id = 'carnets' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "carnets_insert" on storage.objects;
create policy "carnets_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'carnets' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "carnets_update" on storage.objects;
create policy "carnets_update" on storage.objects for update to authenticated
  using (bucket_id = 'carnets' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "carnets_delete" on storage.objects;
create policy "carnets_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'carnets' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "avatars_read" on storage.objects;
create policy "avatars_read" on storage.objects for select to anon, authenticated using (bucket_id = 'avatars');
drop policy if exists "avatars_insert" on storage.objects;
create policy "avatars_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "avatars_update" on storage.objects;
create policy "avatars_update" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "avatars_delete" on storage.objects;
create policy "avatars_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "exports_select" on storage.objects;
create policy "exports_select" on storage.objects for select to authenticated
  using (bucket_id = 'exports' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "exports_insert" on storage.objects;
create policy "exports_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'exports' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "exports_delete" on storage.objects;
create policy "exports_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'exports' and (storage.foldername(name))[1] = auth.uid()::text);

-- ------------------------------------------------------------
-- Fin. Verification rapide a coller plus tard si besoin :
--   select tablename from pg_tables where schemaname='public' order by tablename;
-- ------------------------------------------------------------
