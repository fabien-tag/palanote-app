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

-- Heures sous l'eau avant Palanote (voir palanote-heures-avant.sql)
alter table public.profiles add column if not exists heures_avant numeric(6,1);


-- ============================================================
-- Palanote — Parcours 15 « Sortie club et tampon numérique »
--
-- Le directeur de plongée (DP) choisit ou crée son centre, prépare une sortie
-- (date, site, bateau, palanquées) et y ajoute les plongeurs à la volée :
--   · QR code scanné sur le bateau ou lien envoyé par SMS / WhatsApp,
--   · recherche par nom (ses binômes, les habitués du centre) ou par e-mail exact.
-- Chaque plongeur ajouté est prévenu dans l'app (la cloche) avec les infos de la sortie.
-- Après la plongée, le DP note les infos communes (durée, eau, visibilité) :
-- chaque plongeur reçoit sa fiche préremplie, complète ce qui lui est propre
-- (profondeur, air, sa note), puis le DP pose le tampon numérique d'un geste.
--
-- Le tampon ne peut être posé que par ces fonctions : impossible de le fabriquer
-- depuis l'app, et il s'efface si le plongeur change la date, le site, la
-- profondeur ou la durée d'une plongée tamponnée.
--
-- Prérequis : palanote-page-amis.sql (infos_plongeur, update_updated_at_column)
--             et palanote-binomes-plongees.sql (sont_binomes).
-- À coller dans Supabase → SQL Editor → Run. Relançable sans risque.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Centres de plongée
-- ------------------------------------------------------------
create table if not exists public.centres (
  id uuid primary key default gen_random_uuid(),
  nom text not null,
  ville text,
  site_coords text,
  cree_par uuid references auth.users(id) on delete set null,
  verifie boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint centres_nom_check check (char_length(btrim(nom)) between 2 and 80)
);
create unique index if not exists centres_nom_ville_idx
  on public.centres (lower(btrim(nom)), lower(coalesce(btrim(ville), ''))) where deleted_at is null;

grant select on public.centres to authenticated;
grant all on public.centres to service_role;
alter table public.centres enable row level security;
drop policy if exists "Lire les centres" on public.centres;
create policy "Lire les centres" on public.centres for select to authenticated using (deleted_at is null);
-- Création et modification : seulement par les fonctions ci-dessous.

drop trigger if exists centres_updated_at on public.centres;
create trigger centres_updated_at before update on public.centres
  for each row execute function public.update_updated_at_column();

-- L'équipe d'un centre : les directeurs de plongée qui y organisent des sorties
create table if not exists public.centre_membres (
  centre_id uuid not null references public.centres(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'dp',
  created_at timestamptz not null default now(),
  primary key (centre_id, user_id),
  constraint centre_membres_role_check check (role in ('dp', 'encadrant'))
);
create index if not exists centre_membres_user_idx on public.centre_membres (user_id);

grant select on public.centre_membres to authenticated;
grant all on public.centre_membres to service_role;
alter table public.centre_membres enable row level security;
drop policy if exists "Lire ses centres" on public.centre_membres;
create policy "Lire ses centres" on public.centre_membres for select to authenticated using (user_id = auth.uid());

-- ------------------------------------------------------------
-- 2. Sorties, palanquées, participants
-- ------------------------------------------------------------
create table if not exists public.sorties (
  id uuid primary key default gen_random_uuid(),
  centre_id uuid not null references public.centres(id) on delete cascade,
  dp_id uuid not null references auth.users(id) on delete cascade,
  date_sortie date not null,
  heure time,
  site_name text not null,
  site_location text,
  site_coords text,
  bateau text,
  profondeur_prevue numeric(4,1),
  consignes text,
  statut text not null default 'prevue',
  -- Infos communes notées par le DP après la plongée
  duree_min integer,
  temp_fond_c numeric(4,1),
  visibilite_m integer,
  -- Jeton du QR code et du lien d'invitation
  jeton text not null unique default replace(gen_random_uuid()::text, '-', ''),
  terminee_le timestamptz,
  validee_le timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint sorties_statut_check check (statut in ('prevue', 'terminee', 'validee', 'annulee')),
  constraint sorties_site_check check (char_length(btrim(site_name)) between 1 and 120),
  constraint sorties_duree_check check (duree_min is null or duree_min between 1 and 600),
  constraint sorties_prof_check check (profondeur_prevue is null or profondeur_prevue between 0 and 350)
);
create index if not exists sorties_centre_idx on public.sorties (centre_id, date_sortie desc);
create index if not exists sorties_dp_idx on public.sorties (dp_id);

create table if not exists public.sortie_palanquees (
  id uuid primary key default gen_random_uuid(),
  sortie_id uuid not null references public.sorties(id) on delete cascade,
  numero integer not null,
  guide_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint sortie_palanquees_numero_unique unique (sortie_id, numero)
);

create table if not exists public.sortie_participants (
  id uuid primary key default gen_random_uuid(),
  sortie_id uuid not null references public.sorties(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade, -- vide = prénom noté à l'avance par le DP
  nom_prevu text,
  palanquee_id uuid references public.sortie_palanquees(id) on delete set null,
  ajoute_par uuid references auth.users(id) on delete set null,
  via text not null default 'recherche',
  dive_id uuid references public.dives(id) on delete set null,
  tamponne_le timestamptz,
  exclu_tampon boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sortie_participants_unique unique (sortie_id, user_id),
  constraint sortie_participants_via_check check (via in ('qr', 'lien', 'recherche', 'prevu'))
);
create index if not exists sortie_participants_user_idx on public.sortie_participants (user_id);

-- Sortie entre amis : organisée par un plongeur, sans centre (et donc sans tampon)
alter table public.sorties alter column centre_id drop not null;

-- Palanquées préparées à l'avance : le DP note des prénoms, rattachés au plongeur quand il scanne le QR.
-- (pour une base où la table existait déjà avant cette évolution)
alter table public.sortie_participants add column if not exists nom_prevu text;
alter table public.sortie_participants alter column user_id drop not null;
alter table public.sortie_participants drop constraint if exists sortie_participants_via_check;
alter table public.sortie_participants add constraint sortie_participants_via_check check (via in ('qr', 'lien', 'recherche', 'prevu'));
do $$ begin
  alter table public.sortie_participants add constraint sortie_participants_qui_check
    check (user_id is not null or char_length(btrim(coalesce(nom_prevu, ''))) between 1 and 60);
exception when duplicate_object then null; end $$;

-- Pour comparer des prénoms sans tenir compte des accents ni des majuscules (« Léa » = « lea »)
create or replace function public.prenom_simple(p text)
returns text
language sql
immutable
set search_path = public
as $$
  select translate(lower(split_part(btrim(coalesce(p, '')), ' ', 1)), 'àâäáãéèêëíìîïóòôöõúùûüçñ', 'aaaaaeeeeiiiiooooouuuucn');
$$;

grant select on public.sorties, public.sortie_palanquees, public.sortie_participants to authenticated;
grant all on public.sorties, public.sortie_palanquees, public.sortie_participants to service_role;
alter table public.sorties enable row level security;
alter table public.sortie_palanquees enable row level security;
alter table public.sortie_participants enable row level security;

-- Le DP voit ses sorties et ceux du même centre ; le plongeur voit les sorties où il est inscrit.
create or replace function public.peut_voir_sortie(p_sortie uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.sorties s
    where s.id = p_sortie
      and (
        s.dp_id = auth.uid()
        or exists (select 1 from public.centre_membres m where m.centre_id = s.centre_id and m.user_id = auth.uid())
        or exists (select 1 from public.sortie_participants p where p.sortie_id = s.id and p.user_id = auth.uid())
      )
  );
$$;
revoke all on function public.peut_voir_sortie(uuid) from public, anon;
grant execute on function public.peut_voir_sortie(uuid) to authenticated;

-- Le DP de la sortie, ou un autre DP du même centre
create or replace function public.est_dp_sortie(p_sortie uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.sorties s
    where s.id = p_sortie and s.deleted_at is null
      and (
        s.dp_id = auth.uid()
        or exists (select 1 from public.centre_membres m where m.centre_id = s.centre_id and m.user_id = auth.uid() and m.role = 'dp')
      )
  );
$$;
revoke all on function public.est_dp_sortie(uuid) from public, anon;
grant execute on function public.est_dp_sortie(uuid) to authenticated;

drop policy if exists "Lire ses sorties" on public.sorties;
create policy "Lire ses sorties" on public.sorties for select to authenticated
  using (deleted_at is null and public.peut_voir_sortie(id));
drop policy if exists "Lire les palanquées de ses sorties" on public.sortie_palanquees;
create policy "Lire les palanquées de ses sorties" on public.sortie_palanquees for select to authenticated
  using (public.peut_voir_sortie(sortie_id));
drop policy if exists "Lire sa participation" on public.sortie_participants;
create policy "Lire sa participation" on public.sortie_participants for select to authenticated
  using (user_id = auth.uid() or public.est_dp_sortie(sortie_id));
-- Toutes les écritures passent par les fonctions ci-dessous.

drop trigger if exists sorties_updated_at on public.sorties;
create trigger sorties_updated_at before update on public.sorties
  for each row execute function public.update_updated_at_column();
drop trigger if exists sortie_participants_updated_at on public.sortie_participants;
create trigger sortie_participants_updated_at before update on public.sortie_participants
  for each row execute function public.update_updated_at_column();

-- ------------------------------------------------------------
-- 3. Notifications (la cloche de l'accueil)
-- ------------------------------------------------------------
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  titre text not null,
  texte text,
  lien text,
  donnees jsonb not null default '{}'::jsonb,
  lue_le timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);

grant select on public.notifications to authenticated;
grant all on public.notifications to service_role;
alter table public.notifications enable row level security;
drop policy if exists "Lire ses notifications" on public.notifications;
create policy "Lire ses notifications" on public.notifications for select to authenticated using (user_id = auth.uid());

-- Envoi d'une notification : réservé aux fonctions (jamais appelé depuis l'app).
create or replace function public.notifier(p_user uuid, p_type text, p_titre text, p_texte text, p_lien text, p_donnees jsonb default '{}'::jsonb)
returns void
language sql
volatile
security definer
set search_path = public
as $$
  insert into public.notifications (user_id, type, titre, texte, lien, donnees)
  values (p_user, p_type, p_titre, p_texte, p_lien, coalesce(p_donnees, '{}'::jsonb));
$$;
revoke all on function public.notifier(uuid, text, text, text, text, jsonb) from public, anon, authenticated;

create or replace function public.marquer_notifications_lues(p_ids uuid[] default null)
returns void
language sql
volatile
security definer
set search_path = public
as $$
  update public.notifications set lue_le = now()
  where user_id = auth.uid() and lue_le is null and (p_ids is null or id = any(p_ids));
$$;
revoke all on function public.marquer_notifications_lues(uuid[]) from public, anon;
grant execute on function public.marquer_notifications_lues(uuid[]) to authenticated;

-- « samedi 18 octobre » (indépendant de la langue du serveur)
create or replace function public.date_fr(p_date date)
returns text
language sql
immutable
set search_path = public
as $$
  select (array['dimanche','lundi','mardi','mercredi','jeudi','vendredi','samedi'])[extract(dow from p_date)::int + 1]
    || ' ' || extract(day from p_date)::int
    || case when extract(day from p_date) = 1 then 'er' else '' end
    || ' ' || (array['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'])[extract(month from p_date)::int];
$$;

-- ------------------------------------------------------------
-- 4. Le tampon sur la plongée (posé seulement par les fonctions)
-- ------------------------------------------------------------
alter table public.dives add column if not exists sortie_id uuid references public.sorties(id) on delete set null;
alter table public.dives add column if not exists tampon_le timestamptz;
alter table public.dives add column if not exists tampon_par uuid references auth.users(id) on delete set null;
alter table public.dives add column if not exists tampon_infos jsonb;
create index if not exists dives_sortie_idx on public.dives (sortie_id) where sortie_id is not null;

create or replace function public.proteger_tampon()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- Les fonctions du parcours lèvent ce drapeau le temps de leur écriture.
  if coalesce(current_setting('palanote.tampon', true), '') = 'oui' then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.sortie_id := null;
    new.tampon_le := null;
    new.tampon_par := null;
    new.tampon_infos := null;
    return new;
  end if;
  new.sortie_id := old.sortie_id;
  new.tampon_le := old.tampon_le;
  new.tampon_par := old.tampon_par;
  new.tampon_infos := old.tampon_infos;
  -- Le plongeur change ce que le DP a validé : le tampon tombe.
  if old.tampon_le is not null and (
       new.dive_date is distinct from old.dive_date
       or new.site_name is distinct from old.site_name
       or new.max_depth_m is distinct from old.max_depth_m
       or new.duration_min is distinct from old.duration_min
       or (new.deleted_at is not null and old.deleted_at is null)
     ) then
    new.tampon_le := null;
    new.tampon_par := null;
    new.tampon_infos := coalesce(old.tampon_infos, '{}'::jsonb) || jsonb_build_object('retire_le', now(), 'raison', 'plongée modifiée après validation');
  end if;
  return new;
end;
$$;

drop trigger if exists dives_proteger_tampon on public.dives;
create trigger dives_proteger_tampon before insert or update on public.dives
  for each row execute function public.proteger_tampon();

-- Pose le tampon d'une sortie sur une plongée (usage interne)
create or replace function public.appliquer_tampon(p_dive uuid, p_sortie uuid, p_dp uuid)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  s public.sorties;
  c public.centres;
  dp jsonb;
begin
  select * into s from public.sorties where id = p_sortie;
  select * into c from public.centres where id = s.centre_id;
  dp := public.infos_plongeur(p_dp);
  perform set_config('palanote.tampon', 'oui', true);
  update public.dives set
    sortie_id = p_sortie,
    tampon_le = now(),
    tampon_par = p_dp,
    tampon_infos = jsonb_build_object(
      'dp', dp ->> 'prenom',
      'dp_niveau', dp ->> 'niveau',
      'centre', c.nom,
      'ville', c.ville,
      'centre_verifie', c.verifie,
      'date_sortie', s.date_sortie,
      'site', s.site_name
    )
  where id = p_dive;
  perform set_config('palanote.tampon', '', true);
end;
$$;
revoke all on function public.appliquer_tampon(uuid, uuid, uuid) from public, anon, authenticated;

-- ------------------------------------------------------------
-- 5. Centres : chercher, créer, rejoindre
-- ------------------------------------------------------------
create or replace function public.mes_centres()
returns setof jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object('id', c.id, 'nom', c.nom, 'ville', c.ville, 'verifie', c.verifie, 'role', m.role,
           'nb_dp', (select count(*) from public.centre_membres x where x.centre_id = c.id))
  from public.centre_membres m
  join public.centres c on c.id = m.centre_id and c.deleted_at is null
  where m.user_id = auth.uid()
  order by m.created_at;
$$;
revoke all on function public.mes_centres() from public, anon;
grant execute on function public.mes_centres() to authenticated;

create or replace function public.chercher_centres(p_q text)
returns setof jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object('id', c.id, 'nom', c.nom, 'ville', c.ville, 'verifie', c.verifie,
           'nb_dp', (select count(*) from public.centre_membres x where x.centre_id = c.id),
           'membre', exists (select 1 from public.centre_membres x where x.centre_id = c.id and x.user_id = auth.uid()))
  from public.centres c
  where c.deleted_at is null
    and auth.uid() is not null
    and (coalesce(btrim(p_q), '') = '' or c.nom ilike '%' || btrim(p_q) || '%' or c.ville ilike '%' || btrim(p_q) || '%')
  order by c.verifie desc, c.nom
  limit 20;
$$;
revoke all on function public.chercher_centres(text) from public, anon;
grant execute on function public.chercher_centres(text) to authenticated;

create or replace function public.rejoindre_centre(p_centre uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  c public.centres;
begin
  if auth.uid() is null then raise exception 'connexion requise'; end if;
  select * into c from public.centres where id = p_centre and deleted_at is null;
  if not found then raise exception 'centre introuvable'; end if;
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

create or replace function public.creer_centre(p_nom text, p_ville text default null, p_coords text default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'connexion requise'; end if;
  if char_length(btrim(coalesce(p_nom, ''))) < 2 then raise exception 'nom du centre trop court'; end if;
  -- Même nom, même ville : on rejoint le centre existant plutôt que d'en créer un double.
  select id into v_id from public.centres
    where deleted_at is null and lower(btrim(nom)) = lower(btrim(p_nom))
      and lower(coalesce(btrim(ville), '')) = lower(coalesce(btrim(p_ville), ''));
  if v_id is null then
    insert into public.centres (nom, ville, site_coords, cree_par)
      values (btrim(p_nom), nullif(btrim(coalesce(p_ville, '')), ''), nullif(btrim(coalesce(p_coords, '')), ''), auth.uid())
      returning id into v_id;
  end if;
  return public.rejoindre_centre(v_id);
end;
$$;
revoke all on function public.creer_centre(text, text, text) from public, anon;
grant execute on function public.creer_centre(text, text, text) to authenticated;

create or replace function public.quitter_centre(p_centre uuid)
returns void
language sql
volatile
security definer
set search_path = public
as $$
  delete from public.centre_membres where centre_id = p_centre and user_id = auth.uid();
$$;
revoke all on function public.quitter_centre(uuid) from public, anon;
grant execute on function public.quitter_centre(uuid) to authenticated;

-- ------------------------------------------------------------
-- 6. Sorties côté DP
-- ------------------------------------------------------------
create or replace function public.creer_sortie(
  p_centre uuid, p_date date, p_heure time, p_site text, p_lieu text default null, p_coords text default null,
  p_bateau text default null, p_profondeur numeric default null, p_consignes text default null, p_palanquees integer default 1)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_jeton text;
begin
  if not exists (select 1 from public.centre_membres where centre_id = p_centre and user_id = auth.uid() and role = 'dp') then
    raise exception 'réservé aux directeurs de plongée du centre';
  end if;
  insert into public.sorties (centre_id, dp_id, date_sortie, heure, site_name, site_location, site_coords, bateau, profondeur_prevue, consignes)
    values (p_centre, auth.uid(), p_date, p_heure, btrim(p_site), nullif(btrim(coalesce(p_lieu, '')), ''), nullif(btrim(coalesce(p_coords, '')), ''),
            nullif(btrim(coalesce(p_bateau, '')), ''), p_profondeur, nullif(btrim(coalesce(p_consignes, '')), ''))
    returning id, jeton into v_id, v_jeton;
  insert into public.sortie_palanquees (sortie_id, numero)
    select v_id, n from generate_series(1, greatest(1, least(coalesce(p_palanquees, 1), 20))) n;
  return jsonb_build_object('id', v_id, 'jeton', v_jeton);
end;
$$;
revoke all on function public.creer_sortie(uuid, date, time, text, text, text, text, numeric, text, integer) from public, anon;
grant execute on function public.creer_sortie(uuid, date, time, text, text, text, text, numeric, text, integer) to authenticated;

-- Les sorties des centres où je suis DP
create or replace function public.sorties_dp()
returns setof jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id', s.id, 'date', s.date_sortie, 'heure', s.heure, 'site', s.site_name, 'lieu', s.site_location,
    'statut', s.statut, 'centre', c.nom, 'centre_id', c.id,
    'nb_inscrits', (select count(*) from public.sortie_participants p where p.sortie_id = s.id and p.user_id is not null),
    'nb_prevus', (select count(*) from public.sortie_participants p where p.sortie_id = s.id and p.user_id is null),
    'nb_completees', (select count(*) from public.sortie_participants p where p.sortie_id = s.id and p.dive_id is not null))
  from public.sorties s
  left join public.centres c on c.id = s.centre_id
  where s.deleted_at is null
    and (exists (select 1 from public.centre_membres m where m.centre_id = s.centre_id and m.user_id = auth.uid() and m.role = 'dp')
         or (s.centre_id is null and s.dp_id = auth.uid()))
  order by s.date_sortie desc, s.heure desc nulls last
  limit 60;
$$;
revoke all on function public.sorties_dp() from public, anon;
grant execute on function public.sorties_dp() to authenticated;

-- Le détail complet d'une sortie (DP ou plongeur inscrit)
create or replace function public.detail_sortie(p_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  s public.sorties;
  c public.centres;
  v_dp boolean;
  v_moi public.sortie_participants;
begin
  select * into s from public.sorties where id = p_id and deleted_at is null;
  if not found or not public.peut_voir_sortie(p_id) then raise exception 'sortie introuvable'; end if;
  select * into c from public.centres where id = s.centre_id;
  v_dp := public.est_dp_sortie(p_id);
  select * into v_moi from public.sortie_participants where sortie_id = p_id and user_id = auth.uid();
  return jsonb_build_object(
    'id', s.id, 'date', s.date_sortie, 'date_texte', public.date_fr(s.date_sortie), 'heure', s.heure,
    'site', s.site_name, 'lieu', s.site_location, 'coords', s.site_coords, 'bateau', s.bateau,
    'profondeur_prevue', s.profondeur_prevue, 'consignes', s.consignes, 'statut', s.statut,
    'duree_min', s.duree_min, 'temp_fond_c', s.temp_fond_c, 'visibilite_m', s.visibilite_m,
    'validee_le', s.validee_le,
    'jeton', case when v_dp then s.jeton end,
    'centre', jsonb_build_object('id', c.id, 'nom', c.nom, 'ville', c.ville, 'verifie', c.verifie),
    'entre_amis', s.centre_id is null,
    'dp', public.infos_plongeur(s.dp_id),
    'est_dp', v_dp,
    'moi', case when v_moi.id is null then null else jsonb_build_object(
      'participant_id', v_moi.id, 'dive_id', v_moi.dive_id, 'palanquee_id', v_moi.palanquee_id,
      'tamponne_le', v_moi.tamponne_le, 'exclu_tampon', v_moi.exclu_tampon) end,
    'palanquees', coalesce((
      select jsonb_agg(jsonb_build_object('id', q.id, 'numero', q.numero, 'guide_id', q.guide_id) order by q.numero)
      from public.sortie_palanquees q where q.sortie_id = s.id), '[]'::jsonb),
    -- Le DP voit tout le monde ; un plongeur voit sa palanquée
    'participants', coalesce((
      select jsonb_agg(
               coalesce(public.infos_plongeur(p.user_id), jsonb_build_object('id', null, 'prenom', p.nom_prevu, 'niveau', null, 'club', null))
               || jsonb_build_object(
               'participant_id', p.id, 'palanquee_id', p.palanquee_id, 'via', p.via,
               'nom_prevu', p.nom_prevu, 'prevu', p.user_id is null,
               'complete', p.dive_id is not null, 'tamponne_le', p.tamponne_le, 'exclu_tampon', p.exclu_tampon,
               'moi', p.user_id is not distinct from auth.uid() and p.user_id is not null)
             order by p.created_at)
      from public.sortie_participants p
      where p.sortie_id = s.id
        and (v_dp or p.user_id = auth.uid() or (v_moi.palanquee_id is not null and p.palanquee_id = v_moi.palanquee_id))), '[]'::jsonb),
    'noms_libres', case when v_dp then null else coalesce((
      select jsonb_agg(jsonb_build_object('id', p.id, 'nom', p.nom_prevu, 'palanquee', q.numero) order by q.numero nulls last, p.nom_prevu)
      from public.sortie_participants p left join public.sortie_palanquees q on q.id = p.palanquee_id
      where p.sortie_id = s.id and p.user_id is null), '[]'::jsonb) end
  );
end;
$$;
revoke all on function public.detail_sortie(uuid) from public, anon;
grant execute on function public.detail_sortie(uuid) to authenticated;

-- Chercher un plongeur à ajouter : e-mail exact, ou par prénom parmi
-- ses binômes, l'équipe et les habitués du centre (pas d'annuaire ouvert).
create or replace function public.chercher_plongeurs_sortie(p_sortie uuid, p_q text)
returns setof jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  s public.sorties;
  q text := btrim(coalesce(p_q, ''));
begin
  if not public.est_dp_sortie(p_sortie) then raise exception 'réservé au directeur de plongée'; end if;
  if char_length(q) < 2 then return; end if;
  select * into s from public.sorties where id = p_sortie;
  return query
    with candidats as (
      select u.id from auth.users u where position('@' in q) > 0 and lower(u.email) = lower(q)
      union
      select case when f.user_a = auth.uid() then f.user_b else f.user_a end
        from public.friendships f where f.statut = 'acceptee' and auth.uid() in (f.user_a, f.user_b)
      union
      select p.user_id from public.sortie_participants p join public.sorties x on x.id = p.sortie_id where x.centre_id = s.centre_id
      union
      select m.user_id from public.centre_membres m where m.centre_id = s.centre_id
    )
    select public.infos_plongeur(c.id) || jsonb_build_object(
             'deja_inscrit', exists (select 1 from public.sortie_participants p where p.sortie_id = p_sortie and p.user_id = c.id))
    from candidats c
    where c.id is not null and c.id <> auth.uid()
      and (position('@' in q) > 0 or (public.infos_plongeur(c.id) ->> 'prenom') ilike '%' || q || '%')
    limit 12;
end;
$$;
revoke all on function public.chercher_plongeurs_sortie(uuid, text) from public, anon;
grant execute on function public.chercher_plongeurs_sortie(uuid, text) to authenticated;

-- Message de la notification d'inscription
create or replace function public.texte_sortie(p_sortie uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select public.date_fr(s.date_sortie)
         || coalesce(' à ' || to_char(s.heure, 'HH24"h"MI'), '')
         || ' · ' || s.site_name
         || coalesce(' · ' || c.nom, '')
  from public.sorties s left join public.centres c on c.id = s.centre_id
  where s.id = p_sortie;
$$;
revoke all on function public.texte_sortie(uuid) from public, anon, authenticated;

-- Inscrit un plongeur à une sortie. S'il prend une place préparée par le DP (choisie, ou
-- un seul prénom libre identique au sien), il hérite de sa palanquée (et de son tampon s'il est déjà posé).
create or replace function public.inscrire_a_la_sortie(p_sortie uuid, p_user uuid, p_via text, p_ajoute_par uuid, p_place uuid default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_existant public.sortie_participants;
  v_place public.sortie_participants;
  v_prenom text := public.infos_plongeur(p_user) ->> 'prenom';
  v_nb integer;
  v_id uuid;
begin
  select * into v_existant from public.sortie_participants where sortie_id = p_sortie and user_id = p_user;
  if found then return jsonb_build_object('id', v_existant.id, 'nouveau', false, 'nom_prevu', v_existant.nom_prevu); end if;

  -- La place choisie par le plongeur (« Qui es-tu ? »)
  if p_place is not null then
    select * into v_place from public.sortie_participants where id = p_place and sortie_id = p_sortie and user_id is null for update;
  end if;
  -- Sinon : un seul prénom libre qui correspond au sien
  if v_place.id is null then
    select count(*) into v_nb from public.sortie_participants
      where sortie_id = p_sortie and user_id is null and public.prenom_simple(nom_prevu) = public.prenom_simple(v_prenom);
    if v_nb = 1 then
      select * into v_place from public.sortie_participants
        where sortie_id = p_sortie and user_id is null and public.prenom_simple(nom_prevu) = public.prenom_simple(v_prenom) for update;
    end if;
  end if;

  if v_place.id is not null then
    update public.sortie_participants set user_id = p_user, via = p_via, ajoute_par = p_ajoute_par where id = v_place.id;
    return jsonb_build_object('id', v_place.id, 'nouveau', true, 'nom_prevu', v_place.nom_prevu,
      'palanquee', (select numero from public.sortie_palanquees where id = v_place.palanquee_id));
  end if;
  insert into public.sortie_participants (sortie_id, user_id, ajoute_par, via)
    values (p_sortie, p_user, p_ajoute_par, p_via) returning id into v_id;
  return jsonb_build_object('id', v_id, 'nouveau', true, 'nom_prevu', null, 'palanquee', null);
end;
$$;
revoke all on function public.inscrire_a_la_sortie(uuid, uuid, text, uuid, uuid) from public, anon, authenticated;

create or replace function public.ajouter_participant(p_sortie uuid, p_user uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  s public.sorties;
  r jsonb;
begin
  if not public.est_dp_sortie(p_sortie) then raise exception 'réservé au directeur de plongée'; end if;
  select * into s from public.sorties where id = p_sortie;
  if s.statut in ('validee', 'annulee') then raise exception 'sortie fermée'; end if;
  if not exists (select 1 from auth.users where id = p_user) then raise exception 'plongeur introuvable'; end if;
  if s.centre_id is null and not public.sont_binomes(auth.uid(), p_user) then raise exception 'seulement tes binômes'; end if;
  r := public.inscrire_a_la_sortie(p_sortie, p_user, 'recherche', auth.uid(), null);
  if (r ->> 'nouveau')::boolean then
    perform public.notifier(p_user, 'sortie_inscription',
      'Tu es inscrit à une sortie',
      public.texte_sortie(p_sortie) || coalesce(' · palanquée ' || (r ->> 'palanquee'), '') || '. Inscrit par ' || (public.infos_plongeur(auth.uid()) ->> 'prenom') || '.',
      '/sortie?id=' || p_sortie, jsonb_build_object('sortie_id', p_sortie));
  end if;
  return jsonb_build_object('ajoute', (r ->> 'nouveau')::boolean, 'nom_prevu', r ->> 'nom_prevu');
end;
$$;
revoke all on function public.ajouter_participant(uuid, uuid) from public, anon;
grant execute on function public.ajouter_participant(uuid, uuid) to authenticated;

-- Le DP note des prénoms à l'avance : [["Léa","Paul"],["Sophie"]] = palanquée 1, palanquée 2
create or replace function public.ajouter_noms_prevus(p_sortie uuid, p_noms jsonb)
returns integer
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_num integer := 0;
  v_pal jsonb;
  v_nom text;
  v_id uuid;
  v_nb integer := 0;
begin
  if not public.est_dp_sortie(p_sortie) then raise exception 'réservé au directeur de plongée'; end if;
  for v_pal in select * from jsonb_array_elements(coalesce(p_noms, '[]'::jsonb)) loop
    v_num := v_num + 1;
    select id into v_id from public.sortie_palanquees where sortie_id = p_sortie and numero = v_num;
    if v_id is null then
      insert into public.sortie_palanquees (sortie_id, numero) values (p_sortie, v_num) returning id into v_id;
    end if;
    for v_nom in select btrim(x) from jsonb_array_elements_text(v_pal) x loop
      if char_length(v_nom) between 1 and 60 then
        insert into public.sortie_participants (sortie_id, user_id, nom_prevu, palanquee_id, ajoute_par, via)
          values (p_sortie, null, v_nom, v_id, auth.uid(), 'prevu');
        v_nb := v_nb + 1;
      end if;
    end loop;
    v_id := null;
  end loop;
  return v_nb;
end;
$$;
revoke all on function public.ajouter_noms_prevus(uuid, jsonb) from public, anon;
grant execute on function public.ajouter_noms_prevus(uuid, jsonb) to authenticated;

-- Un prénom de plus dans une palanquée, depuis l'écran de la sortie
create or replace function public.ajouter_nom_prevu(p_palanquee uuid, p_nom text)
returns uuid
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  q public.sortie_palanquees;
  v_id uuid;
begin
  select * into q from public.sortie_palanquees where id = p_palanquee;
  if not found or not public.est_dp_sortie(q.sortie_id) then raise exception 'non autorisé'; end if;
  if char_length(btrim(coalesce(p_nom, ''))) not between 1 and 60 then raise exception 'prénom invalide'; end if;
  insert into public.sortie_participants (sortie_id, user_id, nom_prevu, palanquee_id, ajoute_par, via)
    values (q.sortie_id, null, btrim(p_nom), p_palanquee, auth.uid(), 'prevu') returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.ajouter_nom_prevu(uuid, text) from public, anon;
grant execute on function public.ajouter_nom_prevu(uuid, text) to authenticated;

create or replace function public.retirer_participant(p_participant uuid)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  p public.sortie_participants;
begin
  select * into p from public.sortie_participants where id = p_participant;
  if not found then return; end if;
  if not (public.est_dp_sortie(p.sortie_id) or p.user_id = auth.uid()) then raise exception 'non autorisé'; end if;
  if p.tamponne_le is not null and p.user_id is not null then raise exception 'plongée déjà tamponnée'; end if;
  -- Le plongeur se retire d'une place préparée par le DP : le prénom reste, la place redevient libre
  if p.nom_prevu is not null and p.user_id = auth.uid() and not public.est_dp_sortie(p.sortie_id) then
    update public.sortie_participants set user_id = null, via = 'prevu', dive_id = null where id = p_participant;
    return;
  end if;
  delete from public.sortie_participants where id = p_participant;
end;
$$;
revoke all on function public.retirer_participant(uuid) from public, anon;
grant execute on function public.retirer_participant(uuid) to authenticated;

create or replace function public.placer_participant(p_participant uuid, p_palanquee uuid)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  p public.sortie_participants;
begin
  select * into p from public.sortie_participants where id = p_participant;
  if not found or not public.est_dp_sortie(p.sortie_id) then raise exception 'non autorisé'; end if;
  if p_palanquee is not null and not exists (select 1 from public.sortie_palanquees where id = p_palanquee and sortie_id = p.sortie_id) then
    raise exception 'palanquée introuvable';
  end if;
  update public.sortie_participants set palanquee_id = p_palanquee where id = p_participant;
end;
$$;
revoke all on function public.placer_participant(uuid, uuid) from public, anon;
grant execute on function public.placer_participant(uuid, uuid) to authenticated;

create or replace function public.ajouter_palanquee(p_sortie uuid)
returns uuid
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if not public.est_dp_sortie(p_sortie) then raise exception 'non autorisé'; end if;
  insert into public.sortie_palanquees (sortie_id, numero)
    select p_sortie, coalesce(max(numero), 0) + 1 from public.sortie_palanquees where sortie_id = p_sortie
    returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.ajouter_palanquee(uuid) from public, anon;
grant execute on function public.ajouter_palanquee(uuid) to authenticated;

create or replace function public.definir_guide(p_palanquee uuid, p_user uuid)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  q public.sortie_palanquees;
begin
  select * into q from public.sortie_palanquees where id = p_palanquee;
  if not found or not public.est_dp_sortie(q.sortie_id) then raise exception 'non autorisé'; end if;
  update public.sortie_palanquees set guide_id = p_user where id = p_palanquee;
end;
$$;
revoke all on function public.definir_guide(uuid, uuid) from public, anon;
grant execute on function public.definir_guide(uuid, uuid) to authenticated;

-- Après la plongée : infos communes, puis chaque plongeur reçoit sa fiche à compléter
create or replace function public.terminer_sortie(p_id uuid, p_duree integer, p_temp numeric default null, p_visibilite integer default null)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  s public.sorties;
  p record;
begin
  if not public.est_dp_sortie(p_id) then raise exception 'réservé au directeur de plongée'; end if;
  select * into s from public.sorties where id = p_id;
  if s.statut in ('validee', 'annulee') then raise exception 'sortie fermée'; end if;
  update public.sorties set statut = 'terminee', duree_min = p_duree, temp_fond_c = p_temp, visibilite_m = p_visibilite,
    terminee_le = coalesce(terminee_le, now())
  where id = p_id;
  if s.statut = 'prevue' then
    for p in select user_id from public.sortie_participants where sortie_id = p_id and dive_id is null and user_id is not null and user_id <> auth.uid() loop
      perform public.notifier(p.user_id, 'sortie_a_completer',
        'Ta plongée est prête à compléter',
        public.date_fr(s.date_sortie) || ' · ' || s.site_name || '. Site, date et durée sont déjà remplis : ajoute ta profondeur et ton air.',
        '/nouvelle-plongee?sortie=' || p_id, jsonb_build_object('sortie_id', p_id));
    end loop;
  end if;
end;
$$;
revoke all on function public.terminer_sortie(uuid, integer, numeric, integer) from public, anon;
grant execute on function public.terminer_sortie(uuid, integer, numeric, integer) to authenticated;

-- Le tampon numérique : le DP valide toute la sortie d'un geste (sauf ceux qu'il décoche)
create or replace function public.poser_tampon(p_id uuid, p_exclus uuid[] default '{}')
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  s public.sorties;
  p public.sortie_participants;
  v_dp jsonb := public.infos_plongeur(auth.uid());
  v_nb integer := 0;
begin
  if not public.est_dp_sortie(p_id) then raise exception 'réservé au directeur de plongée'; end if;
  select * into s from public.sorties where id = p_id;
  if s.centre_id is null then raise exception 'pas de tampon pour une sortie entre amis'; end if;
  if s.statut = 'prevue' then raise exception 'termine d''abord la sortie'; end if;
  if s.statut = 'annulee' then raise exception 'sortie annulée'; end if;
  for p in select * from public.sortie_participants where sortie_id = p_id loop
    if p.id = any(coalesce(p_exclus, '{}')) then
      update public.sortie_participants set exclu_tampon = true, tamponne_le = null where id = p.id;
      continue;
    end if;
    update public.sortie_participants set exclu_tampon = false, tamponne_le = coalesce(tamponne_le, now()) where id = p.id;
    v_nb := v_nb + 1;
    if p.dive_id is not null then
      perform public.appliquer_tampon(p.dive_id, p_id, auth.uid());
    end if;
    if p.tamponne_le is null and p.user_id is not null then
      perform public.notifier(p.user_id, 'tampon',
        'Ta plongée est validée',
        public.date_fr(s.date_sortie) || ' · ' || s.site_name || '. Tamponnée par ' || (v_dp ->> 'prenom')
          || coalesce(' (' || (v_dp ->> 'niveau') || ')', '') || '.',
        case when p.dive_id is not null then '/nouvelle-plongee?id=' || p.dive_id else '/nouvelle-plongee?sortie=' || p_id end,
        jsonb_build_object('sortie_id', p_id, 'dive_id', p.dive_id));
    end if;
  end loop;
  update public.sorties set statut = 'validee', validee_le = coalesce(validee_le, now()) where id = p_id;
  return jsonb_build_object('tamponnes', v_nb);
end;
$$;
revoke all on function public.poser_tampon(uuid, uuid[]) from public, anon;
grant execute on function public.poser_tampon(uuid, uuid[]) to authenticated;

create or replace function public.annuler_sortie(p_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  s public.sorties;
  p record;
begin
  if not public.est_dp_sortie(p_id) then raise exception 'réservé au directeur de plongée'; end if;
  select * into s from public.sorties where id = p_id;
  if s.statut = 'validee' then raise exception 'sortie déjà validée'; end if;
  update public.sorties set statut = 'annulee' where id = p_id;
  for p in select user_id from public.sortie_participants where sortie_id = p_id and user_id is not null loop
    perform public.notifier(p.user_id, 'sortie_annulee', 'Sortie annulée',
      public.texte_sortie(p_id) || '.', '/sortie?id=' || p_id, jsonb_build_object('sortie_id', p_id));
  end loop;
end;
$$;
revoke all on function public.annuler_sortie(uuid) from public, anon;
grant execute on function public.annuler_sortie(uuid) to authenticated;

-- ------------------------------------------------------------
-- 7. Côté plongeur
-- ------------------------------------------------------------
-- Ce que voit la personne qui scanne le QR (même sans compte)
create or replace function public.voir_sortie(p_jeton text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  s public.sorties;
  c public.centres;
begin
  select * into s from public.sorties where jeton = p_jeton and deleted_at is null;
  if not found then return jsonb_build_object('etat', 'introuvable'); end if;
  select * into c from public.centres where id = s.centre_id;
  return jsonb_build_object(
    'etat', case when s.statut in ('validee', 'annulee') then s.statut else 'ouverte' end,
    'id', s.id, 'date', s.date_sortie, 'date_texte', public.date_fr(s.date_sortie), 'heure', s.heure,
    'site', s.site_name, 'lieu', s.site_location, 'bateau', s.bateau, 'profondeur_prevue', s.profondeur_prevue,
    'centre', c.nom, 'ville', c.ville, 'centre_verifie', c.verifie,
    'dp', public.infos_plongeur(s.dp_id) ->> 'prenom',
    'nb_inscrits', (select count(*) from public.sortie_participants p where p.sortie_id = s.id and p.user_id is not null),
    -- Les prénoms préparés par le DP, seulement pour un plongeur connecté (« Qui es-tu ? »)
    'noms_libres', case when auth.uid() is null then null else coalesce((
      select jsonb_agg(jsonb_build_object('id', p.id, 'nom', p.nom_prevu, 'palanquee', q.numero,
               'le_mien', public.prenom_simple(p.nom_prevu) = public.prenom_simple(public.infos_plongeur(auth.uid()) ->> 'prenom'))
             order by q.numero nulls last, p.nom_prevu)
      from public.sortie_participants p left join public.sortie_palanquees q on q.id = p.palanquee_id
      where p.sortie_id = s.id and p.user_id is null), '[]'::jsonb) end,
    'deja_inscrit', auth.uid() is not null and exists (select 1 from public.sortie_participants p where p.sortie_id = s.id and p.user_id = auth.uid())
  );
end;
$$;
revoke all on function public.voir_sortie(text) from public;
grant execute on function public.voir_sortie(text) to anon, authenticated;

drop function if exists public.rejoindre_sortie(text, text);
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
  r := public.inscrire_a_la_sortie(s.id, auth.uid(), case when p_via = 'lien' then 'lien' else 'qr' end, auth.uid(), p_place);
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

-- Mes sorties à venir et à compléter (accueil du carnet)
create or replace function public.mes_sorties()
returns setof jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id', s.id, 'date', s.date_sortie, 'date_texte', public.date_fr(s.date_sortie), 'heure', s.heure,
    'site', s.site_name, 'lieu', s.site_location, 'statut', s.statut, 'centre', c.nom,
    'entre_amis', s.centre_id is null,
    'dp', public.infos_plongeur(s.dp_id) ->> 'prenom',
    'dive_id', p.dive_id, 'tamponne_le', p.tamponne_le,
    'a_completer', p.dive_id is null and s.statut in ('terminee', 'validee'))
  from public.sortie_participants p
  join public.sorties s on s.id = p.sortie_id and s.deleted_at is null and s.statut <> 'annulee'
  left join public.centres c on c.id = s.centre_id
  where p.user_id = auth.uid()
    and (s.date_sortie >= current_date - 1 or p.dive_id is null)
  order by s.date_sortie, s.heure nulls last
  limit 20;
$$;
revoke all on function public.mes_sorties() from public, anon;
grant execute on function public.mes_sorties() to authenticated;

-- Ce qui arrive tout seul dans la fiche du plongeur (le reste est à lui)
create or replace function public.preremplir_sortie(p_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  s public.sorties;
  c public.centres;
  p public.sortie_participants;
  q public.sortie_palanquees;
begin
  select * into p from public.sortie_participants where sortie_id = p_id and user_id = auth.uid();
  if not found then raise exception 'tu n''es pas inscrit à cette sortie'; end if;
  select * into s from public.sorties where id = p_id;
  select * into c from public.centres where id = s.centre_id;
  select * into q from public.sortie_palanquees where id = p.palanquee_id;
  return jsonb_build_object(
    'sortie_id', s.id, 'dive_id', p.dive_id, 'statut', s.statut,
    'dive_date', s.date_sortie, 'start_time', s.heure,
    'site_name', s.site_name, 'site_location', s.site_location, 'site_coords', s.site_coords,
    'duration_min', s.duree_min, 'temp_bottom_c', s.temp_fond_c, 'visibility_m', s.visibilite_m,
    'club_name', c.nom, 'boat_name', s.bateau,
    'dive_leader', public.infos_plongeur(s.dp_id) ->> 'prenom',
    'guide_name', case when q.guide_id is not null and q.guide_id <> auth.uid() then public.infos_plongeur(q.guide_id) ->> 'prenom' end,
    'buddies', coalesce((
      select jsonb_agg(coalesce(public.infos_plongeur(x.user_id) ->> 'prenom', x.nom_prevu) order by x.created_at)
      from public.sortie_participants x
      where p.palanquee_id is not null and x.palanquee_id = p.palanquee_id and x.id <> p.id), '[]'::jsonb),
    'palanquee', q.numero
  );
end;
$$;
revoke all on function public.preremplir_sortie(uuid) from public, anon;
grant execute on function public.preremplir_sortie(uuid) to authenticated;

-- La plongée notée par le plongeur est rattachée à la sortie (et tamponnée si le DP l'a déjà fait)
create or replace function public.lier_plongee_sortie(p_sortie uuid, p_dive uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  p public.sortie_participants;
  s public.sorties;
begin
  select * into p from public.sortie_participants where sortie_id = p_sortie and user_id = auth.uid();
  if not found then raise exception 'tu n''es pas inscrit à cette sortie'; end if;
  if not exists (select 1 from public.dives where id = p_dive and user_id = auth.uid() and deleted_at is null) then
    raise exception 'plongée introuvable';
  end if;
  select * into s from public.sorties where id = p_sortie;
  update public.sortie_participants set dive_id = p_dive where id = p.id;
  perform set_config('palanote.tampon', 'oui', true);
  update public.dives set sortie_id = p_sortie, source = case when source = 'manuelle' then 'club' else source end where id = p_dive;
  perform set_config('palanote.tampon', '', true);
  if p.tamponne_le is not null and not p.exclu_tampon then
    perform public.appliquer_tampon(p_dive, p_sortie, coalesce(s.dp_id, auth.uid()));
  end if;
  return jsonb_build_object('tamponnee', p.tamponne_le is not null and not p.exclu_tampon);
end;
$$;
revoke all on function public.lier_plongee_sortie(uuid, uuid) from public, anon;
grant execute on function public.lier_plongee_sortie(uuid, uuid) to authenticated;


-- ------------------------------------------------------------
-- 8. Sortie entre amis (onglet Amis) : un plongeur organise, avec ses binômes
--    Mêmes écrans que la sortie club, mais sans centre et sans tampon.
-- ------------------------------------------------------------
create or replace function public.creer_sortie_amis(
  p_date date, p_heure time, p_site text, p_lieu text default null, p_coords text default null,
  p_profondeur numeric default null, p_consignes text default null,
  p_palanquees jsonb default '[]'::jsonb) -- [["moi", "<id binôme>"], ["<id>"]] : palanquée 1, 2…
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_jeton text;
  v_num integer := 0;
  v_pal jsonb;
  v_qui text;
  v_pid uuid;
  v_user uuid;
  v_moi_place boolean := false;
begin
  if auth.uid() is null then raise exception 'connexion requise'; end if;
  if char_length(btrim(coalesce(p_site, ''))) = 0 then raise exception 'site manquant'; end if;
  insert into public.sorties (centre_id, dp_id, date_sortie, heure, site_name, site_location, site_coords, profondeur_prevue, consignes)
    values (null, auth.uid(), p_date, p_heure, btrim(p_site), nullif(btrim(coalesce(p_lieu, '')), ''), nullif(btrim(coalesce(p_coords, '')), ''),
            p_profondeur, nullif(btrim(coalesce(p_consignes, '')), ''))
    returning id, jeton into v_id, v_jeton;
  for v_pal in select * from jsonb_array_elements(case when jsonb_array_length(coalesce(p_palanquees, '[]'::jsonb)) = 0 then '[["moi"]]'::jsonb else p_palanquees end) loop
    v_num := v_num + 1;
    insert into public.sortie_palanquees (sortie_id, numero) values (v_id, v_num) returning id into v_pid;
    for v_qui in select jsonb_array_elements_text(v_pal) loop
      if v_qui = 'moi' then
        v_user := auth.uid();
        v_moi_place := true;
      else
        v_user := v_qui::uuid;
        if not public.sont_binomes(auth.uid(), v_user) then continue; end if; -- seulement ses binômes
      end if;
      insert into public.sortie_participants (sortie_id, user_id, palanquee_id, ajoute_par, via)
        values (v_id, v_user, v_pid, auth.uid(), 'recherche') on conflict (sortie_id, user_id) do nothing;
      if v_user <> auth.uid() then
        perform public.notifier(v_user, 'sortie_inscription',
          (public.infos_plongeur(auth.uid()) ->> 'prenom') || ' t''embarque en plongée',
          public.texte_sortie(v_id) || ' · palanquée ' || v_num || '.',
          '/sortie?id=' || v_id, jsonb_build_object('sortie_id', v_id));
      end if;
    end loop;
  end loop;
  -- L'organisateur plonge aussi : il a toujours sa place
  if not v_moi_place then
    insert into public.sortie_participants (sortie_id, user_id, palanquee_id, ajoute_par, via)
      values (v_id, auth.uid(), (select id from public.sortie_palanquees where sortie_id = v_id and numero = 1), auth.uid(), 'recherche')
      on conflict (sortie_id, user_id) do nothing;
  end if;
  return jsonb_build_object('id', v_id, 'jeton', v_jeton);
end;
$$;
revoke all on function public.creer_sortie_amis(date, time, text, text, text, numeric, text, jsonb) from public, anon;
grant execute on function public.creer_sortie_amis(date, time, text, text, text, numeric, text, jsonb) to authenticated;


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
