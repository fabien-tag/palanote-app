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


-- ============================================================
-- Palanote — Accueil du directeur de plongée et fiche de sécurité
--
-- L'onglet « Sorties » devient l'accueil du DP :
--   · la prochaine sortie (remplissage, palanquées sans guide),
--   · ce qu'il reste à faire (tampons, fiches pas remplies, prénoms jamais réclamés),
--   · sa saison (sorties encadrées, plongeurs, tampons, heures),
--   · les habitués et les nouveaux du centre, les sites les plus pratiqués.
-- Le DP peut relancer les plongeurs qui n'ont pas rempli leur fiche (une fois par jour).
-- La fiche de sécurité de la sortie s'imprime (palanquées, niveaux, paramètres).
--
-- Prérequis : palanote-sorties-club.sql (et palanote-page-amis.sql pour infos_plongeur).
-- À coller dans Supabase → SQL Editor → Run. Relançable sans risque.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Le tableau de bord du DP pour un centre
-- ------------------------------------------------------------
create or replace function public.accueil_dp(p_centre uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_moi uuid := auth.uid();
  v_debut date := date_trunc('year', current_date)::date;
  v_mois date := date_trunc('month', current_date)::date;
  v_prochaine jsonb;
  v_a_faire jsonb;
  v_stats jsonb;
  v_habitues jsonb;
  v_nouveaux jsonb;
  v_sites jsonb;
begin
  if v_moi is null then raise exception 'connexion requise'; end if;
  if not exists (select 1 from public.centre_membres m where m.centre_id = p_centre and m.user_id = v_moi and m.role = 'dp') then
    raise exception 'réservé aux directeurs de plongée du centre';
  end if;

  -- La prochaine sortie du centre
  select jsonb_build_object(
    'id', s.id, 'date', s.date_sortie, 'date_texte', public.date_fr(s.date_sortie), 'heure', s.heure,
    'site', s.site_name, 'lieu', s.site_location, 'bateau', s.bateau, 'profondeur_prevue', s.profondeur_prevue,
    'dans_jours', s.date_sortie - current_date,
    'mienne', s.dp_id = v_moi,
    'nb_inscrits', (select count(*) from public.sortie_participants p where p.sortie_id = s.id and p.user_id is not null),
    'nb_prevus', (select count(*) from public.sortie_participants p where p.sortie_id = s.id and p.user_id is null),
    'nb_palanquees', (select count(*) from public.sortie_palanquees q where q.sortie_id = s.id
                       and exists (select 1 from public.sortie_participants p where p.palanquee_id = q.id)),
    'sans_guide', (select count(*) from public.sortie_palanquees q where q.sortie_id = s.id and q.guide_id is null
                    and exists (select 1 from public.sortie_participants p where p.palanquee_id = q.id)),
    'sans_palanquee', (select count(*) from public.sortie_participants p where p.sortie_id = s.id and p.palanquee_id is null))
  into v_prochaine
  from public.sorties s
  where s.centre_id = p_centre and s.deleted_at is null and s.statut = 'prevue' and s.date_sortie >= current_date
  order by s.date_sortie, s.heure nulls last
  limit 1;

  -- À faire : tampons (avec les fiches encore vides), fiches manquantes après tampon,
  -- prénoms jamais réclamés (3 dernières semaines)
  select coalesce(jsonb_agg(x order by x ->> 'ordre', x ->> 'date' desc), '[]'::jsonb) into v_a_faire
  from (
    select jsonb_build_object(
      'type', 'tampon', 'ordre', '1', 'sortie_id', s.id, 'site', s.site_name, 'date', s.date_sortie,
      'date_texte', public.date_fr(s.date_sortie),
      'nb', (select count(*) from public.sortie_participants p where p.sortie_id = s.id and p.dive_id is not null),
      'total', (select count(*) from public.sortie_participants p where p.sortie_id = s.id),
      'manquantes', (select count(*) from public.sortie_participants p
                     where p.sortie_id = s.id and p.user_id is not null and p.dive_id is null and p.user_id <> s.dp_id),
      'relance_le', (select max(n.created_at) from public.notifications n
                     where n.type = 'sortie_relance' and n.donnees ->> 'sortie_id' = s.id::text)) as x
    from public.sorties s
    where s.centre_id = p_centre and s.deleted_at is null and s.statut = 'terminee'
    union all
    select jsonb_build_object(
      'type', 'fiches', 'ordre', '2', 'sortie_id', s.id, 'site', s.site_name, 'date', s.date_sortie,
      'date_texte', public.date_fr(s.date_sortie), 'nb', f.nb,
      'relance_le', (select max(n.created_at) from public.notifications n
                     where n.type = 'sortie_relance' and n.donnees ->> 'sortie_id' = s.id::text))
    from public.sorties s
    cross join lateral (
      select count(*) as nb from public.sortie_participants p
      where p.sortie_id = s.id and p.user_id is not null and p.dive_id is null and not p.exclu_tampon and p.user_id <> s.dp_id
    ) f
    where s.centre_id = p_centre and s.deleted_at is null and s.statut = 'validee'
      and s.date_sortie >= current_date - 21 and f.nb > 0
    union all
    select jsonb_build_object(
      'type', 'noms', 'ordre', '3', 'sortie_id', s.id, 'site', s.site_name, 'date', s.date_sortie,
      'date_texte', public.date_fr(s.date_sortie), 'nb', f.nb)
    from public.sorties s
    cross join lateral (
      select count(*) as nb from public.sortie_participants p where p.sortie_id = s.id and p.user_id is null
    ) f
    where s.centre_id = p_centre and s.deleted_at is null and s.statut in ('terminee', 'validee')
      and s.date_sortie >= current_date - 21 and f.nb > 0
  ) t;

  -- Sa saison (année en cours) : les sorties qu'il a encadrées dans ce centre
  select jsonb_build_object(
    'annee', extract(year from current_date)::int,
    'sorties', count(distinct s.id),
    'sorties_mois', count(distinct s.id) filter (where s.date_sortie >= v_mois),
    'plongees', count(p.id) filter (where p.user_id is not null or p.nom_prevu is not null),
    'plongeurs', count(distinct p.user_id),
    'tampons', count(p.id) filter (where p.tamponne_le is not null),
    'minutes', coalesce((select sum(s2.duree_min) from public.sorties s2
                         where s2.centre_id = p_centre and s2.dp_id = v_moi and s2.deleted_at is null
                           and s2.statut in ('terminee', 'validee') and s2.date_sortie >= v_debut), 0))
  into v_stats
  from public.sorties s
  left join public.sortie_participants p on p.sortie_id = s.id and p.user_id is distinct from v_moi
  where s.centre_id = p_centre and s.dp_id = v_moi and s.deleted_at is null
    and s.statut in ('terminee', 'validee') and s.date_sortie >= v_debut;

  -- Les habitués du centre (tous DP confondus)
  select coalesce(jsonb_agg(public.infos_plongeur(h.user_id) || jsonb_build_object('nb', h.nb, 'derniere', h.derniere)
                            order by h.nb desc, h.derniere desc), '[]'::jsonb)
  into v_habitues
  from (
    select p.user_id, count(distinct s.id) as nb, max(s.date_sortie) as derniere
    from public.sortie_participants p
    join public.sorties s on s.id = p.sortie_id
    where s.centre_id = p_centre and s.deleted_at is null and s.statut in ('terminee', 'validee')
      and p.user_id is not null and p.user_id <> s.dp_id
    group by p.user_id
    having count(distinct s.id) >= 2
    order by count(distinct s.id) desc, max(s.date_sortie) desc
    limit 6
  ) h;

  -- Les nouveaux : première sortie avec le centre il y a moins de 30 jours (ou à venir)
  select coalesce(jsonb_agg(public.infos_plongeur(n.user_id) || jsonb_build_object('premiere', n.premiere, 'site', n.site)
                            order by n.premiere desc), '[]'::jsonb)
  into v_nouveaux
  from (
    select distinct on (p.user_id) p.user_id, s.date_sortie as premiere, s.site_name as site
    from public.sortie_participants p
    join public.sorties s on s.id = p.sortie_id
    where s.centre_id = p_centre and s.deleted_at is null and s.statut <> 'annulee'
      and p.user_id is not null and p.user_id <> s.dp_id
    order by p.user_id, s.date_sortie
  ) n
  where n.premiere >= current_date - 30;

  -- Les sites les plus pratiqués par le centre
  select coalesce(jsonb_agg(jsonb_build_object('site', t.site, 'nb', t.nb, 'duree_moy', t.duree_moy, 'prof_max', t.prof_max)
                            order by t.nb desc, t.site), '[]'::jsonb)
  into v_sites
  from (
    select min(s.site_name) as site, count(*) as nb,
           round(avg(s.duree_min))::int as duree_moy, max(s.profondeur_prevue) as prof_max
    from public.sorties s
    where s.centre_id = p_centre and s.deleted_at is null and s.statut in ('terminee', 'validee')
    group by lower(btrim(s.site_name))
    order by count(*) desc
    limit 4
  ) t;

  return jsonb_build_object(
    'prochaine', v_prochaine, 'a_faire', v_a_faire, 'stats', v_stats,
    'habitues', v_habitues, 'nouveaux', v_nouveaux, 'sites', v_sites);
end;
$$;
revoke all on function public.accueil_dp(uuid) from public, anon;
grant execute on function public.accueil_dp(uuid) to authenticated;

-- ------------------------------------------------------------
-- 2. Relancer les plongeurs qui n'ont pas rempli leur fiche (une fois par jour)
-- ------------------------------------------------------------
create or replace function public.relancer_fiches(p_sortie uuid)
returns integer
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  s public.sorties;
  p record;
  v_nb integer := 0;
begin
  if not public.est_dp_sortie(p_sortie) then raise exception 'réservé au directeur de plongée'; end if;
  select * into s from public.sorties where id = p_sortie;
  if s.statut not in ('terminee', 'validee') then raise exception 'termine d''abord la sortie'; end if;
  if exists (select 1 from public.notifications n
             where n.type = 'sortie_relance' and n.donnees ->> 'sortie_id' = p_sortie::text
               and n.created_at > now() - interval '20 hours') then
    raise exception 'déjà relancé aujourd''hui';
  end if;
  for p in select user_id from public.sortie_participants
           where sortie_id = p_sortie and user_id is not null and dive_id is null and not exclu_tampon
             and user_id <> s.dp_id and user_id <> auth.uid() loop
    perform public.notifier(p.user_id, 'sortie_relance',
      'Ta fiche t''attend',
      public.date_fr(s.date_sortie) || ' · ' || s.site_name || '. Elle est déjà préremplie : 1 minute suffit'
        || case when s.centre_id is not null then ' pour avoir ton tampon.' else '.' end,
      '/nouvelle-plongee?sortie=' || p_sortie, jsonb_build_object('sortie_id', p_sortie));
    v_nb := v_nb + 1;
  end loop;
  return v_nb;
end;
$$;
revoke all on function public.relancer_fiches(uuid) from public, anon;
grant execute on function public.relancer_fiches(uuid) to authenticated;

-- ------------------------------------------------------------
-- 3. La fiche de sécurité de la sortie (à imprimer ou garder en PDF)
-- ------------------------------------------------------------
create or replace function public.fiche_securite(p_sortie uuid)
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
  if not public.est_dp_sortie(p_sortie) then raise exception 'réservé au directeur de plongée'; end if;
  select * into s from public.sorties where id = p_sortie;
  select * into c from public.centres where id = s.centre_id;
  return jsonb_build_object(
    'id', s.id, 'date', s.date_sortie, 'date_texte', public.date_fr(s.date_sortie), 'heure', s.heure,
    'site', s.site_name, 'lieu', s.site_location, 'bateau', s.bateau, 'profondeur_prevue', s.profondeur_prevue,
    'consignes', s.consignes, 'statut', s.statut, 'duree_min', s.duree_min, 'temp_fond_c', s.temp_fond_c,
    'visibilite_m', s.visibilite_m,
    'centre', case when c.id is null then null else jsonb_build_object('nom', c.nom, 'ville', c.ville) end,
    'dp', public.infos_plongeur(s.dp_id) || jsonb_build_object(
            'nom', (select nullif(to_jsonb(pr) ->> 'nom', '') from public.profiles pr where pr.id = s.dp_id)),
    'plongeurs', coalesce((
      select jsonb_agg(jsonb_build_object(
               'palanquee', q.numero,
               'user_id', p.user_id,
               'prenom', coalesce(public.infos_plongeur(p.user_id) ->> 'prenom', p.nom_prevu),
               'nom', (select nullif(to_jsonb(pr) ->> 'nom', '') from public.profiles pr where pr.id = p.user_id),
               'niveau', public.infos_plongeur(p.user_id) ->> 'niveau',
               'guide', p.user_id is not null and p.user_id = q.guide_id,
               'prevu', p.user_id is null,
               'prof_max', d.max_depth_m, 'duree', d.duration_min, 'immersion', d.start_time, 'sortie', d.end_time)
             order by q.numero nulls last, (p.user_id = q.guide_id) desc nulls last, p.created_at)
      from public.sortie_participants p
      left join public.sortie_palanquees q on q.id = p.palanquee_id
      left join public.dives d on d.id = p.dive_id and d.deleted_at is null
      where p.sortie_id = s.id), '[]'::jsonb)
  );
end;
$$;
revoke all on function public.fiche_securite(uuid) from public, anon;
grant execute on function public.fiche_securite(uuid) to authenticated;


-- ============================================================
-- Palanote — Le poste de pilotage du directeur de plongée (version ordinateur)
--
--   · Planning : les sorties du centre en calendrier (semaine, mois), qu'on déplace
--     d'un jour à l'autre ; les plongeurs inscrits sont prévenus.
--   · Équipe : les encadrants du centre (DP, guides, pilotes, gonfleurs), avec ou sans
--     compte Palanote, affectés aux sorties.
--   · Matériel : bateaux (places), blocs, gilets, détendeurs, combinaisons…, avec
--     la date du prochain contrôle, réservés par sortie.
--
-- Prérequis : palanote-sorties-club.sql (centres, sorties, notifier, texte_sortie)
--             et palanote-page-amis.sql (infos_plongeur, update_updated_at_column).
-- À coller dans Supabase → SQL Editor → Run. Relançable sans risque.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Tables
-- ------------------------------------------------------------
create table if not exists public.centre_equipe (
  id uuid primary key default gen_random_uuid(),
  centre_id uuid not null references public.centres(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null, -- vide = encadrant sans compte (un pilote, par exemple)
  nom text not null,
  role text not null default 'guide',
  niveau text,
  telephone text,
  actif boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint centre_equipe_role_check check (role in ('dp', 'guide', 'pilote', 'gonfleur', 'autre')),
  constraint centre_equipe_nom_check check (char_length(btrim(nom)) between 1 and 80),
  constraint centre_equipe_unique unique (centre_id, user_id)
);
create index if not exists centre_equipe_centre_idx on public.centre_equipe (centre_id);

create table if not exists public.materiel (
  id uuid primary key default gen_random_uuid(),
  centre_id uuid not null references public.centres(id) on delete cascade,
  type text not null,
  libelle text not null,
  quantite integer not null default 1,
  places integer, -- pour un bateau : nombre de plongeurs à bord
  prochain_controle date, -- révision, inspection des blocs…
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint materiel_type_check check (type in ('bateau', 'bloc', 'gilet', 'detendeur', 'combinaison', 'ordinateur', 'autre')),
  constraint materiel_libelle_check check (char_length(btrim(libelle)) between 1 and 80),
  constraint materiel_quantite_check check (quantite between 0 and 999),
  constraint materiel_places_check check (places is null or places between 1 and 200)
);
create index if not exists materiel_centre_idx on public.materiel (centre_id);

create table if not exists public.sortie_equipe (
  sortie_id uuid not null references public.sorties(id) on delete cascade,
  equipier_id uuid not null references public.centre_equipe(id) on delete cascade,
  role text not null default 'guide',
  created_at timestamptz not null default now(),
  primary key (sortie_id, equipier_id),
  constraint sortie_equipe_role_check check (role in ('dp', 'guide', 'pilote', 'gonfleur', 'autre'))
);

create table if not exists public.sortie_materiel (
  sortie_id uuid not null references public.sorties(id) on delete cascade,
  materiel_id uuid not null references public.materiel(id) on delete cascade,
  quantite integer not null default 1,
  primary key (sortie_id, materiel_id),
  constraint sortie_materiel_quantite_check check (quantite between 1 and 999)
);

alter table public.sorties add column if not exists bateau_id uuid references public.materiel(id) on delete set null;

grant select on public.centre_equipe, public.materiel, public.sortie_equipe, public.sortie_materiel to authenticated;
grant all on public.centre_equipe, public.materiel, public.sortie_equipe, public.sortie_materiel to service_role;
alter table public.centre_equipe enable row level security;
alter table public.materiel enable row level security;
alter table public.sortie_equipe enable row level security;
alter table public.sortie_materiel enable row level security;

-- Seuls les DP du centre voient son équipe et son matériel. Les écritures passent par les fonctions.
create or replace function public.est_dp_centre(p_centre uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.centre_membres m where m.centre_id = p_centre and m.user_id = auth.uid() and m.role = 'dp');
$$;
revoke all on function public.est_dp_centre(uuid) from public, anon;
grant execute on function public.est_dp_centre(uuid) to authenticated;

drop policy if exists "DP : lire l'équipe" on public.centre_equipe;
create policy "DP : lire l'équipe" on public.centre_equipe for select to authenticated using (public.est_dp_centre(centre_id));
drop policy if exists "DP : lire le matériel" on public.materiel;
create policy "DP : lire le matériel" on public.materiel for select to authenticated using (public.est_dp_centre(centre_id));
drop policy if exists "DP : lire les affectations" on public.sortie_equipe;
create policy "DP : lire les affectations" on public.sortie_equipe for select to authenticated using (public.est_dp_sortie(sortie_id));
drop policy if exists "DP : lire les réservations" on public.sortie_materiel;
create policy "DP : lire les réservations" on public.sortie_materiel for select to authenticated using (public.est_dp_sortie(sortie_id));

drop trigger if exists centre_equipe_updated_at on public.centre_equipe;
create trigger centre_equipe_updated_at before update on public.centre_equipe
  for each row execute function public.update_updated_at_column();
drop trigger if exists materiel_updated_at on public.materiel;
create trigger materiel_updated_at before update on public.materiel
  for each row execute function public.update_updated_at_column();

-- ------------------------------------------------------------
-- 2. Équipe
-- ------------------------------------------------------------
-- Les DP du centre (membres Palanote) entrent d'eux-mêmes dans l'équipe.
create or replace function public.synchroniser_equipe(p_centre uuid)
returns void
language sql
volatile
security definer
set search_path = public
as $$
  insert into public.centre_equipe (centre_id, user_id, nom, role, niveau)
  select m.centre_id, m.user_id, public.infos_plongeur(m.user_id) ->> 'prenom', 'dp', public.infos_plongeur(m.user_id) ->> 'niveau'
  from public.centre_membres m
  where m.centre_id = p_centre and m.role = 'dp'
  on conflict (centre_id, user_id) do nothing;
$$;
revoke all on function public.synchroniser_equipe(uuid) from public, anon, authenticated;

create or replace function public.ligne_equipier(e public.centre_equipe)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object('id', e.id, 'user_id', e.user_id, 'nom', e.nom, 'role', e.role, 'niveau', e.niveau,
                            'telephone', e.telephone, 'actif', e.actif);
$$;
revoke all on function public.ligne_equipier(public.centre_equipe) from public, anon, authenticated;

create or replace function public.equipe_centre(p_centre uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  if not public.est_dp_centre(p_centre) then raise exception 'réservé aux directeurs de plongée du centre'; end if;
  perform public.synchroniser_equipe(p_centre);
  return coalesce((
    select jsonb_agg(public.ligne_equipier(e) order by e.actif desc,
             array_position(array['dp', 'guide', 'pilote', 'gonfleur', 'autre'], e.role), e.nom)
    from public.centre_equipe e where e.centre_id = p_centre), '[]'::jsonb);
end;
$$;
revoke all on function public.equipe_centre(uuid) from public, anon;
grant execute on function public.equipe_centre(uuid) to authenticated;

-- Ajouter (p_id vide) ou modifier un équipier
create or replace function public.enregistrer_equipier(
  p_centre uuid, p_id uuid, p_nom text, p_role text, p_niveau text default null, p_telephone text default null, p_actif boolean default true)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  e public.centre_equipe;
begin
  if not public.est_dp_centre(p_centre) then raise exception 'réservé aux directeurs de plongée du centre'; end if;
  if p_id is null then
    insert into public.centre_equipe (centre_id, nom, role, niveau, telephone)
    values (p_centre, btrim(p_nom), p_role, nullif(btrim(coalesce(p_niveau, '')), ''), nullif(btrim(coalesce(p_telephone, '')), ''))
    returning * into e;
  else
    update public.centre_equipe
      set nom = btrim(p_nom), role = p_role, niveau = nullif(btrim(coalesce(p_niveau, '')), ''),
          telephone = nullif(btrim(coalesce(p_telephone, '')), ''), actif = coalesce(p_actif, true)
      where id = p_id and centre_id = p_centre
      returning * into e;
    if e.id is null then raise exception 'équipier introuvable'; end if;
  end if;
  return public.ligne_equipier(e);
end;
$$;
revoke all on function public.enregistrer_equipier(uuid, uuid, text, text, text, text, boolean) from public, anon;
grant execute on function public.enregistrer_equipier(uuid, uuid, text, text, text, text, boolean) to authenticated;

-- Affecter un équipier à une sortie (p_role vide = le retirer)
create or replace function public.affecter_equipier(p_sortie uuid, p_equipier uuid, p_role text)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  if not public.est_dp_sortie(p_sortie) then raise exception 'réservé au directeur de plongée'; end if;
  if not exists (select 1 from public.centre_equipe e join public.sorties s on s.centre_id = e.centre_id
                 where e.id = p_equipier and s.id = p_sortie) then
    raise exception 'équipier d''un autre centre';
  end if;
  if p_role is null or p_role = '' then
    delete from public.sortie_equipe where sortie_id = p_sortie and equipier_id = p_equipier;
  else
    insert into public.sortie_equipe (sortie_id, equipier_id, role) values (p_sortie, p_equipier, p_role)
    on conflict (sortie_id, equipier_id) do update set role = excluded.role;
  end if;
end;
$$;
revoke all on function public.affecter_equipier(uuid, uuid, text) from public, anon;
grant execute on function public.affecter_equipier(uuid, uuid, text) to authenticated;

-- ------------------------------------------------------------
-- 3. Matériel
-- ------------------------------------------------------------
create or replace function public.ligne_materiel(m public.materiel)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object('id', m.id, 'type', m.type, 'libelle', m.libelle, 'quantite', m.quantite,
                            'places', m.places, 'prochain_controle', m.prochain_controle, 'note', m.note);
$$;
revoke all on function public.ligne_materiel(public.materiel) from public, anon, authenticated;

create or replace function public.materiel_centre(p_centre uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.est_dp_centre(p_centre) then raise exception 'réservé aux directeurs de plongée du centre'; end if;
  return coalesce((
    select jsonb_agg(public.ligne_materiel(m) order by
             array_position(array['bateau', 'bloc', 'gilet', 'detendeur', 'combinaison', 'ordinateur', 'autre'], m.type), m.libelle)
    from public.materiel m where m.centre_id = p_centre and m.deleted_at is null), '[]'::jsonb);
end;
$$;
revoke all on function public.materiel_centre(uuid) from public, anon;
grant execute on function public.materiel_centre(uuid) to authenticated;

-- Ajouter (p_id vide) ou modifier un matériel
create or replace function public.enregistrer_materiel(
  p_centre uuid, p_id uuid, p_type text, p_libelle text, p_quantite integer default 1,
  p_places integer default null, p_controle date default null, p_note text default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  m public.materiel;
begin
  if not public.est_dp_centre(p_centre) then raise exception 'réservé aux directeurs de plongée du centre'; end if;
  if p_id is null then
    insert into public.materiel (centre_id, type, libelle, quantite, places, prochain_controle, note)
    values (p_centre, p_type, btrim(p_libelle), coalesce(p_quantite, 1), case when p_type = 'bateau' then p_places end,
            p_controle, nullif(btrim(coalesce(p_note, '')), ''))
    returning * into m;
  else
    update public.materiel
      set type = p_type, libelle = btrim(p_libelle), quantite = coalesce(p_quantite, 1),
          places = case when p_type = 'bateau' then p_places end, prochain_controle = p_controle,
          note = nullif(btrim(coalesce(p_note, '')), '')
      where id = p_id and centre_id = p_centre and deleted_at is null
      returning * into m;
    if m.id is null then raise exception 'matériel introuvable'; end if;
    -- Le nom du bateau suit sur les sorties à venir
    if m.type = 'bateau' then
      update public.sorties set bateau = m.libelle where bateau_id = m.id and statut = 'prevue';
    end if;
  end if;
  return public.ligne_materiel(m);
end;
$$;
revoke all on function public.enregistrer_materiel(uuid, uuid, text, text, integer, integer, date, text) from public, anon;
grant execute on function public.enregistrer_materiel(uuid, uuid, text, text, integer, integer, date, text) to authenticated;

create or replace function public.retirer_materiel(p_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_centre uuid;
begin
  select centre_id into v_centre from public.materiel where id = p_id and deleted_at is null;
  if v_centre is null or not public.est_dp_centre(v_centre) then raise exception 'matériel introuvable'; end if;
  update public.materiel set deleted_at = now() where id = p_id;
  delete from public.sortie_materiel sm using public.sorties s
    where sm.materiel_id = p_id and s.id = sm.sortie_id and s.statut = 'prevue';
  update public.sorties set bateau_id = null where bateau_id = p_id and statut = 'prevue';
end;
$$;
revoke all on function public.retirer_materiel(uuid) from public, anon;
grant execute on function public.retirer_materiel(uuid) to authenticated;

-- Réserver une quantité pour une sortie (0 = annuler la réservation)
create or replace function public.reserver_materiel(p_sortie uuid, p_materiel uuid, p_quantite integer)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  if not public.est_dp_sortie(p_sortie) then raise exception 'réservé au directeur de plongée'; end if;
  if not exists (select 1 from public.materiel m join public.sorties s on s.centre_id = m.centre_id
                 where m.id = p_materiel and s.id = p_sortie and m.deleted_at is null and m.type <> 'bateau') then
    raise exception 'matériel introuvable';
  end if;
  if coalesce(p_quantite, 0) <= 0 then
    delete from public.sortie_materiel where sortie_id = p_sortie and materiel_id = p_materiel;
  else
    insert into public.sortie_materiel (sortie_id, materiel_id, quantite) values (p_sortie, p_materiel, least(p_quantite, 999))
    on conflict (sortie_id, materiel_id) do update set quantite = excluded.quantite;
  end if;
end;
$$;
revoke all on function public.reserver_materiel(uuid, uuid, integer) from public, anon;
grant execute on function public.reserver_materiel(uuid, uuid, integer) to authenticated;

-- Choisir le bateau de la sortie (vide = aucun)
create or replace function public.choisir_bateau(p_sortie uuid, p_bateau uuid)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_libelle text;
begin
  if not public.est_dp_sortie(p_sortie) then raise exception 'réservé au directeur de plongée'; end if;
  if p_bateau is not null then
    select m.libelle into v_libelle from public.materiel m join public.sorties s on s.centre_id = m.centre_id
      where m.id = p_bateau and s.id = p_sortie and m.type = 'bateau' and m.deleted_at is null;
    if v_libelle is null then raise exception 'bateau introuvable'; end if;
  end if;
  update public.sorties set bateau_id = p_bateau, bateau = coalesce(v_libelle, case when p_bateau is null and bateau_id is not null then null else bateau end)
  where id = p_sortie;
end;
$$;
revoke all on function public.choisir_bateau(uuid, uuid) from public, anon;
grant execute on function public.choisir_bateau(uuid, uuid) to authenticated;

-- ------------------------------------------------------------
-- 4. Planning
-- ------------------------------------------------------------
-- Tout ce qu'il faut pour le calendrier, en un appel : sorties de la période,
-- leur équipe et leur matériel, plus l'équipe et le matériel du centre.
create or replace function public.planning_centre(p_centre uuid, p_debut date, p_fin date)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  if not public.est_dp_centre(p_centre) then raise exception 'réservé aux directeurs de plongée du centre'; end if;
  if p_fin < p_debut or p_fin - p_debut > 62 then raise exception 'période invalide'; end if;
  perform public.synchroniser_equipe(p_centre);
  return jsonb_build_object(
    'sorties', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', s.id, 'date', s.date_sortie, 'heure', s.heure, 'site', s.site_name, 'lieu', s.site_location,
        'statut', s.statut, 'dp_id', s.dp_id, 'dp', public.infos_plongeur(s.dp_id) ->> 'prenom',
        'mienne', s.dp_id = auth.uid(), 'bateau', s.bateau, 'bateau_id', s.bateau_id,
        'places', (select m.places from public.materiel m where m.id = s.bateau_id),
        'profondeur_prevue', s.profondeur_prevue, 'duree_min', s.duree_min,
        'nb_inscrits', (select count(*) from public.sortie_participants p where p.sortie_id = s.id and p.user_id is not null),
        'nb_prevus', (select count(*) from public.sortie_participants p where p.sortie_id = s.id and p.user_id is null),
        'nb_completees', (select count(*) from public.sortie_participants p where p.sortie_id = s.id and p.dive_id is not null),
        'nb_palanquees', (select count(*) from public.sortie_palanquees q where q.sortie_id = s.id
                           and exists (select 1 from public.sortie_participants p where p.palanquee_id = q.id)),
        'sans_guide', (select count(*) from public.sortie_palanquees q where q.sortie_id = s.id and q.guide_id is null
                        and exists (select 1 from public.sortie_participants p where p.palanquee_id = q.id)),
        'equipe', coalesce((select jsonb_agg(jsonb_build_object('id', e.id, 'nom', e.nom, 'role', se.role, 'user_id', e.user_id) order by se.created_at)
                            from public.sortie_equipe se join public.centre_equipe e on e.id = se.equipier_id
                            where se.sortie_id = s.id), '[]'::jsonb),
        'materiel', coalesce((select jsonb_agg(jsonb_build_object('materiel_id', sm.materiel_id, 'quantite', sm.quantite))
                              from public.sortie_materiel sm where sm.sortie_id = s.id), '[]'::jsonb))
        order by s.date_sortie, s.heure nulls last)
      from public.sorties s
      where s.centre_id = p_centre and s.deleted_at is null and s.date_sortie between p_debut and p_fin), '[]'::jsonb),
    'equipe', coalesce((select jsonb_agg(public.ligne_equipier(e) order by array_position(array['dp', 'guide', 'pilote', 'gonfleur', 'autre'], e.role), e.nom)
                        from public.centre_equipe e where e.centre_id = p_centre and e.actif), '[]'::jsonb),
    'materiel', coalesce((select jsonb_agg(public.ligne_materiel(m) order by
                            array_position(array['bateau', 'bloc', 'gilet', 'detendeur', 'combinaison', 'ordinateur', 'autre'], m.type), m.libelle)
                          from public.materiel m where m.centre_id = p_centre and m.deleted_at is null), '[]'::jsonb)
  );
end;
$$;
revoke all on function public.planning_centre(uuid, date, date) from public, anon;
grant execute on function public.planning_centre(uuid, date, date) to authenticated;

-- Déplacer une sortie prévue (glisser dans le calendrier) ; les inscrits sont prévenus.
create or replace function public.deplacer_sortie(p_sortie uuid, p_date date, p_heure time default null)
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
  if not public.est_dp_sortie(p_sortie) then raise exception 'réservé au directeur de plongée'; end if;
  select * into s from public.sorties where id = p_sortie;
  if s.statut <> 'prevue' then raise exception 'seule une sortie prévue se déplace'; end if;
  if p_date < current_date then raise exception 'impossible de déplacer une sortie dans le passé'; end if;
  if p_date = s.date_sortie and coalesce(p_heure, s.heure) is not distinct from s.heure then return; end if;
  update public.sorties set date_sortie = p_date, heure = coalesce(p_heure, heure) where id = p_sortie;
  for p in select user_id from public.sortie_participants where sortie_id = p_sortie and user_id is not null and user_id <> auth.uid() loop
    perform public.notifier(p.user_id, 'sortie_modifiee', 'Ta sortie change de date',
      public.texte_sortie(p_sortie) || ' (au lieu du ' || public.date_fr(s.date_sortie) || ').',
      '/sortie?id=' || p_sortie, jsonb_build_object('sortie_id', p_sortie));
  end loop;
end;
$$;
revoke all on function public.deplacer_sortie(uuid, date, time) from public, anon;
grant execute on function public.deplacer_sortie(uuid, date, time) to authenticated;


-- ============================================================
-- Palanote — Espace club du directeur de plongée (version ordinateur) :
-- carte du club, membres du club, paramètres du centre.
--
--   · Carte : les sorties plongées par le centre, sur la carte (positions déjà floutées
--     de 100 à 150 m à la création de la sortie).
--   · Membres : les plongeurs venus avec le centre (sorties, fiches, tampons, prochaine sortie).
--   · Paramètres : nom et ville du centre, ses directeurs de plongée.
--
-- Prérequis : palanote-sorties-club.sql et palanote-planning-club.sql (est_dp_centre).
-- À coller dans Supabase → SQL Editor → Run. Relançable sans risque.
-- ============================================================

-- Les sorties plongées par le centre, pour la carte
create or replace function public.carte_centre(p_centre uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.est_dp_centre(p_centre) then raise exception 'réservé aux directeurs de plongée du centre'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', s.id, 'date', s.date_sortie, 'site', s.site_name, 'lieu', s.site_location, 'coords', s.site_coords,
      'statut', s.statut, 'profondeur', s.profondeur_prevue, 'duree', s.duree_min, 'dp', public.infos_plongeur(s.dp_id) ->> 'prenom',
      'nb', (select count(*) from public.sortie_participants p where p.sortie_id = s.id))
      order by s.date_sortie desc)
    from public.sorties s
    where s.centre_id = p_centre and s.deleted_at is null and s.statut in ('terminee', 'validee') and s.site_coords is not null), '[]'::jsonb);
end;
$$;
revoke all on function public.carte_centre(uuid) from public, anon;
grant execute on function public.carte_centre(uuid) to authenticated;

-- Les membres du club : les plongeurs venus avec le centre (hors DP de la sortie)
create or replace function public.membres_centre(p_centre uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.est_dp_centre(p_centre) then raise exception 'réservé aux directeurs de plongée du centre'; end if;
  return coalesce((
    select jsonb_agg(public.infos_plongeur(m.user_id) || jsonb_build_object(
      'sorties', m.sorties, 'premiere', m.premiere, 'derniere', m.derniere,
      'fiches', m.fiches, 'tampons', m.tampons, 'prochaine', m.prochaine)
      order by m.derniere desc nulls last)
    from (
      select p.user_id,
             count(distinct s.id) filter (where s.statut in ('terminee', 'validee')) as sorties,
             min(s.date_sortie) filter (where s.statut in ('terminee', 'validee')) as premiere,
             max(s.date_sortie) filter (where s.statut in ('terminee', 'validee')) as derniere,
             count(p.dive_id) as fiches,
             count(p.tamponne_le) filter (where p.dive_id is not null) as tampons,
             min(s.date_sortie) filter (where s.statut = 'prevue' and s.date_sortie >= current_date) as prochaine
      from public.sortie_participants p
      join public.sorties s on s.id = p.sortie_id
      where s.centre_id = p_centre and s.deleted_at is null and s.statut <> 'annulee'
        and p.user_id is not null and p.user_id <> s.dp_id
      group by p.user_id
    ) m), '[]'::jsonb);
end;
$$;
revoke all on function public.membres_centre(uuid) from public, anon;
grant execute on function public.membres_centre(uuid) to authenticated;

-- Les paramètres du centre : identité et directeurs de plongée
create or replace function public.parametres_centre(p_centre uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  c public.centres;
begin
  if not public.est_dp_centre(p_centre) then raise exception 'réservé aux directeurs de plongée du centre'; end if;
  select * into c from public.centres where id = p_centre;
  return jsonb_build_object(
    'id', c.id, 'nom', c.nom, 'ville', c.ville, 'verifie', c.verifie, 'cree_le', c.created_at,
    'dp', coalesce((select jsonb_agg(public.infos_plongeur(m.user_id) || jsonb_build_object('depuis', m.created_at, 'moi', m.user_id = auth.uid())
                                     order by m.created_at)
                    from public.centre_membres m where m.centre_id = p_centre and m.role = 'dp'), '[]'::jsonb),
    'nb_sorties', (select count(*) from public.sorties s where s.centre_id = p_centre and s.deleted_at is null and s.statut in ('terminee', 'validee')));
end;
$$;
revoke all on function public.parametres_centre(uuid) from public, anon;
grant execute on function public.parametres_centre(uuid) to authenticated;

-- Renommer le centre ou changer sa ville (un centre vérifié garde son nom)
create or replace function public.modifier_centre(p_centre uuid, p_nom text, p_ville text)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  c public.centres;
begin
  if not public.est_dp_centre(p_centre) then raise exception 'réservé aux directeurs de plongée du centre'; end if;
  select * into c from public.centres where id = p_centre;
  if c.verifie and btrim(p_nom) <> c.nom then raise exception 'le nom d''un centre vérifié ne se change pas'; end if;
  update public.centres set nom = btrim(p_nom), ville = nullif(btrim(coalesce(p_ville, '')), '') where id = p_centre;
end;
$$;
revoke all on function public.modifier_centre(uuid, text, text) from public, anon;
grant execute on function public.modifier_centre(uuid, text, text) to authenticated;


-- ============================================================
-- Palanote — Import Excel pour les clubs
--
-- Un club arrive sur Palanote avec ses fichiers Excel, avant que ses plongeurs aient l'app :
--   · les adhérents : prénom, nom, e-mail, téléphone, niveau, licence, fin du certificat médical ;
--   · l'historique de leurs plongées avec le club : date, site, profondeur, durée, palanquée ;
--   · l'équipe (encadrants, pilotes) et le matériel (bateaux, blocs, gilets…).
-- Quand un adhérent crée son compte Palanote avec la même adresse e-mail, il retrouve
-- ses plongées du club et peut les ajouter à son carnet (il est le seul à voir les siennes).
-- Les plongeurs d'une sortie s'importent avec ajouter_noms_prevus (palanote-sorties-club.sql).
--
-- Prérequis : palanote-sorties-club.sql, palanote-planning-club.sql (est_dp_centre,
--             centre_equipe, materiel) et palanote-page-amis.sql (update_updated_at_column).
-- À coller dans Supabase → SQL Editor → Run. Relançable sans risque.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Tables
-- ------------------------------------------------------------
create table if not exists public.centre_adherents (
  id uuid primary key default gen_random_uuid(),
  centre_id uuid not null references public.centres(id) on delete cascade,
  prenom text not null,
  nom text,
  email text,
  telephone text,
  niveau text,
  licence text,
  certificat_fin date, -- fin de validité du certificat médical
  adhesion date,
  note text,
  user_id uuid references auth.users(id) on delete set null, -- son compte Palanote, retrouvé par l'e-mail
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint centre_adherents_prenom_check check (char_length(btrim(prenom)) between 1 and 60),
  constraint centre_adherents_email_check check (email is null or email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')
);
create index if not exists centre_adherents_centre_idx on public.centre_adherents (centre_id);
create unique index if not exists centre_adherents_email_unique on public.centre_adherents (centre_id, lower(email)) where email is not null;
create index if not exists centre_adherents_email_idx on public.centre_adherents (lower(email));

create table if not exists public.adherent_plongees (
  id uuid primary key default gen_random_uuid(),
  centre_id uuid not null references public.centres(id) on delete cascade,
  adherent_id uuid not null references public.centre_adherents(id) on delete cascade,
  date_plongee date not null,
  heure time,
  site text,
  lieu text,
  profondeur numeric(5,1),
  duree integer,
  palanquee text,
  role text, -- « GP », « Plongeur », « Élève »…
  note text,
  dive_id uuid references public.dives(id) on delete set null, -- une fois ajoutée au carnet
  recuperee_le timestamptz, -- ajoutée au carnet, ou écartée par le plongeur
  created_at timestamptz not null default now(),
  constraint adherent_plongees_prof_check check (profondeur is null or profondeur between 0 and 350),
  constraint adherent_plongees_duree_check check (duree is null or duree between 1 and 600)
);
create unique index if not exists adherent_plongees_unique on public.adherent_plongees (adherent_id, date_plongee, lower(coalesce(site, '')), coalesce(heure, '00:00'));
create index if not exists adherent_plongees_centre_idx on public.adherent_plongees (centre_id);

grant select on public.centre_adherents, public.adherent_plongees to authenticated;
grant all on public.centre_adherents, public.adherent_plongees to service_role;
alter table public.centre_adherents enable row level security;
alter table public.adherent_plongees enable row level security;
drop policy if exists "DP : lire les adhérents" on public.centre_adherents;
create policy "DP : lire les adhérents" on public.centre_adherents for select to authenticated using (public.est_dp_centre(centre_id));
drop policy if exists "DP : lire l'historique" on public.adherent_plongees;
create policy "DP : lire l'historique" on public.adherent_plongees for select to authenticated using (public.est_dp_centre(centre_id));
-- Écritures et lecture côté plongeur : uniquement par les fonctions ci-dessous.

drop trigger if exists centre_adherents_updated_at on public.centre_adherents;
create trigger centre_adherents_updated_at before update on public.centre_adherents
  for each row execute function public.update_updated_at_column();

-- Petits outils de nettoyage des cellules
create or replace function public.cellule(p jsonb, p_cle text)
returns text
language sql
immutable
as $$
  select nullif(btrim(p ->> p_cle), '');
$$;

create or replace function public.cellule_nombre(p jsonb, p_cle text)
returns numeric
language plpgsql
immutable
as $$
begin
  return nullif(replace(regexp_replace(coalesce(p ->> p_cle, ''), '[^0-9,.\-]', '', 'g'), ',', '.'), '')::numeric;
exception when others then
  return null;
end;
$$;

create or replace function public.cellule_date(p jsonb, p_cle text)
returns date
language plpgsql
immutable
as $$
begin
  return nullif(btrim(p ->> p_cle), '')::date; -- l'app envoie des dates AAAA-MM-JJ
exception when others then
  return null;
end;
$$;

create or replace function public.cellule_heure(p jsonb, p_cle text)
returns time
language plpgsql
immutable
as $$
begin
  return nullif(btrim(p ->> p_cle), '')::time;
exception when others then
  return null;
end;
$$;

-- Retrouve le compte Palanote des adhérents par leur e-mail
create or replace function public.lier_adherents(p_centre uuid)
returns void
language sql
volatile
security definer
set search_path = public
as $$
  update public.centre_adherents a set user_id = u.id
  from auth.users u
  where a.centre_id = p_centre and a.user_id is null and a.email is not null and lower(u.email) = lower(a.email);
$$;
revoke all on function public.lier_adherents(uuid) from public, anon, authenticated;

-- ------------------------------------------------------------
-- 2. Imports du DP (une ligne du tableur = un objet JSON)
-- ------------------------------------------------------------
-- Adhérents : mis à jour s'ils existent déjà (même e-mail, ou même prénom et nom)
create or replace function public.importer_adherents(p_centre uuid, p_lignes jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  l jsonb;
  v_id uuid;
  v_email text;
  v_prenom text;
  v_nom text;
  v_ajoutes integer := 0;
  v_maj integer := 0;
  v_ignorees integer := 0;
begin
  if not public.est_dp_centre(p_centre) then raise exception 'réservé aux directeurs de plongée du centre'; end if;
  if jsonb_array_length(coalesce(p_lignes, '[]'::jsonb)) > 3000 then raise exception 'fichier trop long (3 000 lignes au plus)'; end if;
  for l in select * from jsonb_array_elements(coalesce(p_lignes, '[]'::jsonb)) loop
    v_prenom := left(public.cellule(l, 'prenom'), 60);
    v_nom := left(public.cellule(l, 'nom'), 80);
    v_email := lower(public.cellule(l, 'email'));
    if v_email is not null and v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then v_email := null; end if;
    if v_prenom is null then
      v_ignorees := v_ignorees + 1;
      continue;
    end if;
    v_id := null;
    if v_email is not null then
      select id into v_id from public.centre_adherents where centre_id = p_centre and lower(email) = v_email;
    end if;
    if v_id is null then
      select id into v_id from public.centre_adherents
      where centre_id = p_centre and lower(prenom) = lower(v_prenom) and lower(coalesce(nom, '')) = lower(coalesce(v_nom, ''))
        and (email is null or v_email is null)
      limit 1;
    end if;
    if v_id is null then
      insert into public.centre_adherents (centre_id, prenom, nom, email, telephone, niveau, licence, certificat_fin, adhesion, note)
      values (p_centre, v_prenom, v_nom, v_email, left(public.cellule(l, 'telephone'), 30), left(public.cellule(l, 'niveau'), 40),
              left(public.cellule(l, 'licence'), 40), public.cellule_date(l, 'certificat_fin'), public.cellule_date(l, 'adhesion'),
              left(public.cellule(l, 'note'), 500));
      v_ajoutes := v_ajoutes + 1;
    else
      update public.centre_adherents set
        prenom = v_prenom,
        nom = coalesce(v_nom, nom),
        email = coalesce(v_email, email),
        telephone = coalesce(left(public.cellule(l, 'telephone'), 30), telephone),
        niveau = coalesce(left(public.cellule(l, 'niveau'), 40), niveau),
        licence = coalesce(left(public.cellule(l, 'licence'), 40), licence),
        certificat_fin = coalesce(public.cellule_date(l, 'certificat_fin'), certificat_fin),
        adhesion = coalesce(public.cellule_date(l, 'adhesion'), adhesion),
        note = coalesce(left(public.cellule(l, 'note'), 500), note)
      where id = v_id;
      v_maj := v_maj + 1;
    end if;
  end loop;
  perform public.lier_adherents(p_centre);
  return jsonb_build_object('ajoutes', v_ajoutes, 'mis_a_jour', v_maj, 'ignorees', v_ignorees);
end;
$$;
revoke all on function public.importer_adherents(uuid, jsonb) from public, anon;
grant execute on function public.importer_adherents(uuid, jsonb) to authenticated;

-- Historique des plongées : une ligne = une plongée d'un adhérent (créé s'il manque)
create or replace function public.importer_historique(p_centre uuid, p_lignes jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  l jsonb;
  v_adh uuid;
  v_email text;
  v_prenom text;
  v_nom text;
  v_date date;
  v_prof numeric;
  v_duree integer;
  v_plongees integer := 0;
  v_nouveaux integer := 0;
  v_ignorees integer := 0;
  v_doublons integer := 0;
begin
  if not public.est_dp_centre(p_centre) then raise exception 'réservé aux directeurs de plongée du centre'; end if;
  if jsonb_array_length(coalesce(p_lignes, '[]'::jsonb)) > 10000 then raise exception 'fichier trop long (10 000 lignes au plus)'; end if;
  for l in select * from jsonb_array_elements(coalesce(p_lignes, '[]'::jsonb)) loop
    v_prenom := left(public.cellule(l, 'prenom'), 60);
    v_nom := left(public.cellule(l, 'nom'), 80);
    v_email := lower(public.cellule(l, 'email'));
    if v_email is not null and v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then v_email := null; end if;
    v_date := public.cellule_date(l, 'date');
    if v_date is null or v_date > current_date or (v_prenom is null and v_email is null) then
      v_ignorees := v_ignorees + 1;
      continue;
    end if;
    v_adh := null;
    if v_email is not null then
      select id into v_adh from public.centre_adherents where centre_id = p_centre and lower(email) = v_email;
    end if;
    if v_adh is null and v_prenom is not null then
      select id into v_adh from public.centre_adherents
      where centre_id = p_centre and lower(prenom) = lower(v_prenom) and lower(coalesce(nom, '')) = lower(coalesce(v_nom, ''))
      limit 1;
    end if;
    if v_adh is null then
      insert into public.centre_adherents (centre_id, prenom, nom, email, niveau)
      values (p_centre, coalesce(v_prenom, split_part(v_email, '@', 1)), v_nom, v_email, left(public.cellule(l, 'niveau'), 40))
      returning id into v_adh;
      v_nouveaux := v_nouveaux + 1;
    end if;
    v_prof := public.cellule_nombre(l, 'profondeur');
    if v_prof is not null and (v_prof < 0 or v_prof > 350) then v_prof := null; end if;
    v_duree := round(public.cellule_nombre(l, 'duree'))::integer;
    if v_duree is not null and (v_duree < 1 or v_duree > 600) then v_duree := null; end if;
    insert into public.adherent_plongees (centre_id, adherent_id, date_plongee, heure, site, lieu, profondeur, duree, palanquee, role, note)
    values (p_centre, v_adh, v_date, public.cellule_heure(l, 'heure'), left(public.cellule(l, 'site'), 120), left(public.cellule(l, 'lieu'), 120),
            v_prof, v_duree, left(public.cellule(l, 'palanquee'), 20), left(public.cellule(l, 'role'), 40), left(public.cellule(l, 'note'), 500))
    on conflict do nothing;
    if found then v_plongees := v_plongees + 1; else v_doublons := v_doublons + 1; end if;
  end loop;
  perform public.lier_adherents(p_centre);
  return jsonb_build_object('plongees', v_plongees, 'nouveaux_adherents', v_nouveaux, 'doublons', v_doublons, 'ignorees', v_ignorees);
end;
$$;
revoke all on function public.importer_historique(uuid, jsonb) from public, anon;
grant execute on function public.importer_historique(uuid, jsonb) to authenticated;

-- Équipe : mise à jour par le nom (encadrants sans compte), sinon ajout
create or replace function public.importer_equipe(p_centre uuid, p_lignes jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  l jsonb;
  v_nom text;
  v_role text;
  v_id uuid;
  v_ajoutes integer := 0;
  v_maj integer := 0;
begin
  if not public.est_dp_centre(p_centre) then raise exception 'réservé aux directeurs de plongée du centre'; end if;
  if jsonb_array_length(coalesce(p_lignes, '[]'::jsonb)) > 500 then raise exception 'fichier trop long (500 lignes au plus)'; end if;
  for l in select * from jsonb_array_elements(coalesce(p_lignes, '[]'::jsonb)) loop
    v_nom := left(public.cellule(l, 'nom'), 80);
    if v_nom is null then continue; end if;
    v_role := coalesce(public.cellule(l, 'role'), 'guide');
    if v_role not in ('dp', 'guide', 'pilote', 'gonfleur', 'autre') then v_role := 'autre'; end if;
    select id into v_id from public.centre_equipe where centre_id = p_centre and lower(nom) = lower(v_nom) limit 1;
    if v_id is null then
      insert into public.centre_equipe (centre_id, nom, role, niveau, telephone)
      values (p_centre, v_nom, v_role, left(public.cellule(l, 'niveau'), 40), left(public.cellule(l, 'telephone'), 30));
      v_ajoutes := v_ajoutes + 1;
    else
      update public.centre_equipe set role = v_role, actif = true,
        niveau = coalesce(left(public.cellule(l, 'niveau'), 40), niveau),
        telephone = coalesce(left(public.cellule(l, 'telephone'), 30), telephone)
      where id = v_id;
      v_maj := v_maj + 1;
    end if;
  end loop;
  return jsonb_build_object('ajoutes', v_ajoutes, 'mis_a_jour', v_maj);
end;
$$;
revoke all on function public.importer_equipe(uuid, jsonb) from public, anon;
grant execute on function public.importer_equipe(uuid, jsonb) to authenticated;

-- Matériel : mise à jour par le type et le libellé, sinon ajout
create or replace function public.importer_materiel(p_centre uuid, p_lignes jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  l jsonb;
  v_type text;
  v_libelle text;
  v_qte integer;
  v_places integer;
  v_id uuid;
  v_ajoutes integer := 0;
  v_maj integer := 0;
begin
  if not public.est_dp_centre(p_centre) then raise exception 'réservé aux directeurs de plongée du centre'; end if;
  if jsonb_array_length(coalesce(p_lignes, '[]'::jsonb)) > 1000 then raise exception 'fichier trop long (1 000 lignes au plus)'; end if;
  for l in select * from jsonb_array_elements(coalesce(p_lignes, '[]'::jsonb)) loop
    v_libelle := left(public.cellule(l, 'libelle'), 80);
    if v_libelle is null then continue; end if;
    v_type := coalesce(public.cellule(l, 'type'), 'autre');
    if v_type not in ('bateau', 'bloc', 'gilet', 'detendeur', 'combinaison', 'ordinateur', 'autre') then v_type := 'autre'; end if;
    v_qte := least(999, greatest(0, coalesce(round(public.cellule_nombre(l, 'quantite'))::integer, 1)));
    v_places := case when v_type = 'bateau' then least(200, greatest(1, coalesce(round(public.cellule_nombre(l, 'places'))::integer, 12))) end;
    select id into v_id from public.materiel where centre_id = p_centre and type = v_type and lower(libelle) = lower(v_libelle) and deleted_at is null limit 1;
    if v_id is null then
      insert into public.materiel (centre_id, type, libelle, quantite, places, prochain_controle, note)
      values (p_centre, v_type, v_libelle, case when v_type = 'bateau' then 1 else v_qte end, v_places,
              public.cellule_date(l, 'controle'), left(public.cellule(l, 'note'), 300));
      v_ajoutes := v_ajoutes + 1;
    else
      update public.materiel set
        quantite = case when v_type = 'bateau' then 1 else v_qte end,
        places = coalesce(v_places, places),
        prochain_controle = coalesce(public.cellule_date(l, 'controle'), prochain_controle),
        note = coalesce(left(public.cellule(l, 'note'), 300), note)
      where id = v_id;
      v_maj := v_maj + 1;
    end if;
  end loop;
  return jsonb_build_object('ajoutes', v_ajoutes, 'mis_a_jour', v_maj);
end;
$$;
revoke all on function public.importer_materiel(uuid, jsonb) from public, anon;
grant execute on function public.importer_materiel(uuid, jsonb) to authenticated;

-- ------------------------------------------------------------
-- 3. Lecture côté DP : les adhérents et leur suivi
-- ------------------------------------------------------------
create or replace function public.adherents_centre(p_centre uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  if not public.est_dp_centre(p_centre) then raise exception 'réservé aux directeurs de plongée du centre'; end if;
  perform public.lier_adherents(p_centre);
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', a.id, 'prenom', a.prenom, 'nom', a.nom, 'email', a.email, 'telephone', a.telephone, 'niveau', a.niveau,
      'licence', a.licence, 'certificat_fin', a.certificat_fin, 'adhesion', a.adhesion, 'note', a.note,
      'sur_palanote', a.user_id is not null,
      'plongees', (select count(*) from public.adherent_plongees h where h.adherent_id = a.id),
      'derniere', (select max(h.date_plongee) from public.adherent_plongees h where h.adherent_id = a.id),
      'prof_max', (select max(h.profondeur) from public.adherent_plongees h where h.adherent_id = a.id),
      'recuperees', (select count(*) from public.adherent_plongees h where h.adherent_id = a.id and h.dive_id is not null),
      'sorties', case when a.user_id is null then 0 else (
        select count(distinct s.id) from public.sortie_participants p join public.sorties s on s.id = p.sortie_id
        where p.user_id = a.user_id and s.centre_id = p_centre and s.statut in ('terminee', 'validee')) end)
      order by lower(coalesce(a.nom, '')), lower(a.prenom))
    from public.centre_adherents a where a.centre_id = p_centre), '[]'::jsonb);
end;
$$;
revoke all on function public.adherents_centre(uuid) from public, anon;
grant execute on function public.adherents_centre(uuid) to authenticated;

create or replace function public.supprimer_adherent(p_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_centre uuid;
begin
  select centre_id into v_centre from public.centre_adherents where id = p_id;
  if v_centre is null or not public.est_dp_centre(v_centre) then raise exception 'adhérent introuvable'; end if;
  delete from public.centre_adherents where id = p_id;
end;
$$;
revoke all on function public.supprimer_adherent(uuid) from public, anon;
grant execute on function public.supprimer_adherent(uuid) to authenticated;

-- ------------------------------------------------------------
-- 4. Côté plongeur : retrouver ses plongées gardées par son club
-- ------------------------------------------------------------
-- Les plongées pas encore récupérées, rattachées à mon adresse e-mail, centre par centre
create or replace function public.mon_historique_club()
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_email text;
begin
  if auth.uid() is null then return '[]'::jsonb; end if;
  select lower(email) into v_email from auth.users where id = auth.uid();
  if v_email is null then return '[]'::jsonb; end if;
  update public.centre_adherents set user_id = auth.uid() where lower(email) = v_email and user_id is null;
  return coalesce((
    select jsonb_agg(jsonb_build_object('centre_id', c.id, 'centre', c.nom, 'ville', c.ville, 'plongees', t.plongees) order by c.nom)
    from (
      select a.centre_id,
             jsonb_agg(jsonb_build_object('id', h.id, 'date', h.date_plongee, 'heure', h.heure, 'site', h.site, 'lieu', h.lieu,
                                          'profondeur', h.profondeur, 'duree', h.duree, 'palanquee', h.palanquee, 'role', h.role, 'note', h.note)
                       order by h.date_plongee) as plongees
      from public.centre_adherents a
      join public.adherent_plongees h on h.adherent_id = a.id
      where a.user_id = auth.uid() and h.recuperee_le is null
      group by a.centre_id
    ) t join public.centres c on c.id = t.centre_id), '[]'::jsonb);
end;
$$;
revoke all on function public.mon_historique_club() from public, anon;
grant execute on function public.mon_historique_club() to authenticated;

-- Après l'ajout au carnet (ou si le plongeur n'en veut pas) : ne plus les proposer
create or replace function public.marquer_historique_club(p_centre uuid)
returns integer
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_nb integer;
begin
  update public.adherent_plongees h set recuperee_le = now()
  from public.centre_adherents a
  where a.id = h.adherent_id and a.user_id = auth.uid() and a.centre_id = p_centre and h.recuperee_le is null;
  get diagnostics v_nb = row_count;
  return v_nb;
end;
$$;
revoke all on function public.marquer_historique_club(uuid) from public, anon;
grant execute on function public.marquer_historique_club(uuid) to authenticated;


-- ============================================================
-- Palanote — Les membres privilégiés du club
--
-- Les plus actifs du club reçoivent une étoile : ils forment une communauté à part,
-- avec des plongées qui leur sont réservées (épaves, plongées profondes…).
--   · le DP met une étoile à un adhérent ou à un plongeur venu en sortie ;
--   · une sortie peut être « réservée aux membres privilégiés », avec son mélange
--     (air, nitrox, trimix…) ;
--   · le DP programme une série de plongées (par exemple chaque dimanche) en une fois ;
--   · il invite les privilégiés choisis : notification dans l'app pour ceux qui l'ont,
--     e-mail préparé pour tous.
-- Sur une sortie réservée, seuls les privilégiés peuvent s'inscrire eux-mêmes (QR ou lien) ;
-- le DP, lui, peut toujours ajouter qui il veut.
--
-- Prérequis : palanote-sorties-club.sql, palanote-planning-club.sql (est_dp_centre)
--             et palanote-import-excel.sql (centre_adherents).
-- À coller dans Supabase → SQL Editor → Run. Relançable sans risque.
-- ============================================================

alter table public.centre_adherents add column if not exists privilegie boolean not null default false;
alter table public.centre_adherents add column if not exists privilegie_depuis timestamptz;
alter table public.sorties add column if not exists reservee_privilegies boolean not null default false;
alter table public.sorties add column if not exists melange text;
alter table public.sorties drop constraint if exists sorties_melange_check;
update public.sorties set melange = 'Nitrox' where melange like 'Nitrox %';
alter table public.sorties add constraint sorties_melange_check
  check (melange is null or melange in ('Air', 'Nitrox', 'Trimix', 'Air ou nitrox'));

-- Le plongeur est-il un membre privilégié de ce centre ? (compte relié, ou même e-mail)
create or replace function public.est_privilegie(p_centre uuid, p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.centre_adherents a
    where a.centre_id = p_centre and a.privilegie
      and (a.user_id = p_user
           or (a.email is not null and lower(a.email) = (select lower(u.email) from auth.users u where u.id = p_user))));
$$;
revoke all on function public.est_privilegie(uuid, uuid) from public, anon, authenticated;

-- Sortie réservée : un plongeur non privilégié ne peut pas s'y inscrire lui-même
create or replace function public.controler_sortie_reservee()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.sorties;
begin
  if new.user_id is null or new.via not in ('qr', 'lien') then return new; end if;
  select * into s from public.sorties where id = new.sortie_id;
  if s.reservee_privilegies and s.centre_id is not null and new.user_id <> s.dp_id
     and not public.est_privilegie(s.centre_id, new.user_id) then
    raise exception 'sortie réservée aux membres privilégiés';
  end if;
  return new;
end;
$$;
drop trigger if exists sortie_participants_reservee on public.sortie_participants;
create trigger sortie_participants_reservee before insert on public.sortie_participants
  for each row execute function public.controler_sortie_reservee();

-- ------------------------------------------------------------
-- Étoiles
-- ------------------------------------------------------------
create or replace function public.basculer_privilegie(p_adherent uuid, p_oui boolean)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_centre uuid;
begin
  select centre_id into v_centre from public.centre_adherents where id = p_adherent;
  if v_centre is null or not public.est_dp_centre(v_centre) then raise exception 'adhérent introuvable'; end if;
  update public.centre_adherents
    set privilegie = coalesce(p_oui, false), privilegie_depuis = case when p_oui then coalesce(privilegie_depuis, now()) end
  where id = p_adherent;
end;
$$;
revoke all on function public.basculer_privilegie(uuid, boolean) from public, anon;
grant execute on function public.basculer_privilegie(uuid, boolean) to authenticated;

-- Étoile sur un plongeur venu en sortie (sa fiche d'adhérent est créée s'il n'en a pas)
create or replace function public.privilegier_plongeur(p_centre uuid, p_user uuid, p_oui boolean)
returns uuid
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_infos jsonb := public.infos_plongeur(p_user);
begin
  if not public.est_dp_centre(p_centre) then raise exception 'réservé aux directeurs de plongée du centre'; end if;
  if not exists (select 1 from public.sortie_participants p join public.sorties s on s.id = p.sortie_id
                 where s.centre_id = p_centre and p.user_id = p_user)
     and not exists (select 1 from public.centre_adherents where centre_id = p_centre and user_id = p_user) then
    raise exception 'plongeur inconnu du centre';
  end if;
  select id into v_id from public.centre_adherents where centre_id = p_centre and user_id = p_user limit 1;
  if v_id is null then
    insert into public.centre_adherents (centre_id, prenom, niveau, user_id)
    values (p_centre, coalesce(v_infos ->> 'prenom', 'Plongeur'), v_infos ->> 'niveau', p_user)
    returning id into v_id;
  end if;
  perform public.basculer_privilegie(v_id, p_oui);
  return v_id;
end;
$$;
revoke all on function public.privilegier_plongeur(uuid, uuid, boolean) from public, anon;
grant execute on function public.privilegier_plongeur(uuid, uuid, boolean) to authenticated;

-- ------------------------------------------------------------
-- La communauté : membres, suggestions, plongées réservées
-- ------------------------------------------------------------
create or replace function public.privilegies_centre(p_centre uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  if not public.est_dp_centre(p_centre) then raise exception 'réservé aux directeurs de plongée du centre'; end if;
  perform public.lier_adherents(p_centre);
  return jsonb_build_object(
    -- Les membres privilégiés, avec leur activité
    'membres', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', a.id, 'user_id', a.user_id, 'prenom', a.prenom, 'nom', a.nom, 'email', a.email, 'niveau', a.niveau,
        'certificat_fin', a.certificat_fin, 'depuis', a.privilegie_depuis, 'sur_palanote', a.user_id is not null,
        'activite', t.plongees + t.sorties, 'derniere', greatest(t.derniere_h, t.derniere_s),
        'inscrit_reservees', (select count(*) from public.sortie_participants p join public.sorties s on s.id = p.sortie_id
                              where p.user_id = a.user_id and s.centre_id = p_centre and s.reservee_privilegies
                                and s.statut = 'prevue' and s.date_sortie >= current_date))
        order by t.plongees + t.sorties desc, a.prenom)
      from public.centre_adherents a
      cross join lateral (
        select (select count(*) from public.adherent_plongees h where h.adherent_id = a.id) as plongees,
               (select max(h.date_plongee) from public.adherent_plongees h where h.adherent_id = a.id) as derniere_h,
               case when a.user_id is null then 0 else (select count(distinct s.id) from public.sortie_participants p join public.sorties s on s.id = p.sortie_id
                 where p.user_id = a.user_id and s.centre_id = p_centre and s.statut in ('terminee', 'validee')) end as sorties,
               case when a.user_id is null then null else (select max(s.date_sortie) from public.sortie_participants p join public.sorties s on s.id = p.sortie_id
                 where p.user_id = a.user_id and s.centre_id = p_centre and s.statut in ('terminee', 'validee')) end as derniere_s
      ) t
      where a.centre_id = p_centre and a.privilegie), '[]'::jsonb),
    -- Les plus actifs qui n'ont pas encore l'étoile (3 plongées ou plus avec le club)
    'suggestions', coalesce((
      select jsonb_agg(x order by (x ->> 'activite')::int desc) from (
        select jsonb_build_object('id', a.id, 'user_id', a.user_id, 'prenom', a.prenom, 'nom', a.nom, 'niveau', a.niveau,
                 'activite', (select count(*) from public.adherent_plongees h where h.adherent_id = a.id)
                           + case when a.user_id is null then 0 else (select count(distinct s.id) from public.sortie_participants p join public.sorties s on s.id = p.sortie_id
                               where p.user_id = a.user_id and s.centre_id = p_centre and s.statut in ('terminee', 'validee')) end) as x
        from public.centre_adherents a
        where a.centre_id = p_centre and not a.privilegie
        union all
        select jsonb_build_object('id', null, 'user_id', p.user_id, 'prenom', public.infos_plongeur(p.user_id) ->> 'prenom', 'nom', null,
                 'niveau', public.infos_plongeur(p.user_id) ->> 'niveau', 'activite', count(distinct s.id))
        from public.sortie_participants p join public.sorties s on s.id = p.sortie_id
        where s.centre_id = p_centre and s.statut in ('terminee', 'validee') and p.user_id is not null and p.user_id <> s.dp_id
          and not exists (select 1 from public.centre_adherents a where a.centre_id = p_centre and a.user_id = p.user_id)
        group by p.user_id
      ) t where (x ->> 'activite')::int >= 3 limit 8), '[]'::jsonb),
    -- Les plongées réservées à venir
    'sorties', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', s.id, 'date', s.date_sortie, 'date_texte', public.date_fr(s.date_sortie), 'heure', s.heure,
        'site', s.site_name, 'lieu', s.site_location, 'melange', s.melange, 'profondeur_prevue', s.profondeur_prevue,
        'bateau', s.bateau, 'jeton', s.jeton,
        'nb_inscrits', (select count(*) from public.sortie_participants p where p.sortie_id = s.id and p.user_id is not null))
        order by s.date_sortie, s.heure nulls last)
      from public.sorties s
      where s.centre_id = p_centre and s.deleted_at is null and s.reservee_privilegies and s.statut = 'prevue'
        and s.date_sortie >= current_date), '[]'::jsonb)
  );
end;
$$;
revoke all on function public.privilegies_centre(uuid) from public, anon;
grant execute on function public.privilegies_centre(uuid) to authenticated;

-- Réserver (ou non) une sortie aux privilégiés, et noter son mélange
create or replace function public.definir_sortie_privilegies(p_sortie uuid, p_reservee boolean, p_melange text)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  if not public.est_dp_sortie(p_sortie) then raise exception 'réservé au directeur de plongée'; end if;
  if exists (select 1 from public.sorties where id = p_sortie and centre_id is null) then
    raise exception 'pas de sortie réservée entre amis';
  end if;
  update public.sorties set reservee_privilegies = coalesce(p_reservee, false), melange = nullif(btrim(coalesce(p_melange, '')), '')
  where id = p_sortie;
end;
$$;
revoke all on function public.definir_sortie_privilegies(uuid, boolean, text) from public, anon;
grant execute on function public.definir_sortie_privilegies(uuid, boolean, text) to authenticated;

-- Les options d'une sortie (pour le panneau du planning)
create or replace function public.options_sortie(p_sortie uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object('reservee', s.reservee_privilegies, 'melange', s.melange)
  from public.sorties s where s.id = p_sortie and public.peut_voir_sortie(p_sortie);
$$;
revoke all on function public.options_sortie(uuid) from public, anon;
grant execute on function public.options_sortie(uuid) to authenticated;

-- Côté plongeur, avant de s'inscrire : la sortie est-elle réservée, et suis-je privilégié ?
create or replace function public.reservation_sortie(p_jeton text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object('reservee', s.reservee_privilegies, 'melange', s.melange,
                            'privilegie', auth.uid() is not null and public.est_privilegie(s.centre_id, auth.uid()))
  from public.sorties s where s.jeton = p_jeton and s.deleted_at is null;
$$;
revoke all on function public.reservation_sortie(text) from public;
grant execute on function public.reservation_sortie(text) to anon, authenticated;

-- Programmer une série de plongées réservées en une fois (ex. chaque dimanche, 2 plongées)
create or replace function public.creer_serie_privilegies(p_centre uuid, p_sorties jsonb)
returns integer
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  l jsonb;
  v_id uuid;
  v_nb integer := 0;
  v_bateau public.materiel;
begin
  if not public.est_dp_centre(p_centre) then raise exception 'réservé aux directeurs de plongée du centre'; end if;
  if jsonb_array_length(coalesce(p_sorties, '[]'::jsonb)) > 60 then raise exception 'série trop longue (60 plongées au plus)'; end if;
  for l in select * from jsonb_array_elements(coalesce(p_sorties, '[]'::jsonb)) loop
    if public.cellule_date(l, 'date') is null or public.cellule_date(l, 'date') < current_date or public.cellule(l, 'site') is null then continue; end if;
    v_bateau := null;
    if public.cellule(l, 'bateau_id') is not null then
      select * into v_bateau from public.materiel where id = (l ->> 'bateau_id')::uuid and centre_id = p_centre and type = 'bateau' and deleted_at is null;
    end if;
    insert into public.sorties (centre_id, dp_id, date_sortie, heure, site_name, site_location, profondeur_prevue, consignes,
                                bateau, bateau_id, reservee_privilegies, melange)
    values (p_centre, auth.uid(), public.cellule_date(l, 'date'), public.cellule_heure(l, 'heure'), left(public.cellule(l, 'site'), 120),
            left(public.cellule(l, 'lieu'), 120), public.cellule_nombre(l, 'profondeur'), left(public.cellule(l, 'consignes'), 500),
            v_bateau.libelle, v_bateau.id, true,
            case when public.cellule(l, 'melange') in ('Air', 'Nitrox', 'Trimix', 'Air ou nitrox') then public.cellule(l, 'melange') end)
    returning id into v_id;
    insert into public.sortie_palanquees (sortie_id, numero) values (v_id, 1);
    v_nb := v_nb + 1;
  end loop;
  return v_nb;
end;
$$;
revoke all on function public.creer_serie_privilegies(uuid, jsonb) from public, anon;
grant execute on function public.creer_serie_privilegies(uuid, jsonb) to authenticated;

-- Inviter les privilégiés choisis : une notification par plongée pour ceux qui ont l'app
create or replace function public.inviter_privilegies(p_centre uuid, p_adherents uuid[], p_sorties uuid[])
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  a record;
  s record;
  v_dp text := public.infos_plongeur(auth.uid()) ->> 'prenom';
  v_avec integer := 0;
  v_sans integer := 0;
begin
  if not public.est_dp_centre(p_centre) then raise exception 'réservé aux directeurs de plongée du centre'; end if;
  perform public.lier_adherents(p_centre);
  for a in select * from public.centre_adherents where centre_id = p_centre and id = any(coalesce(p_adherents, '{}')) and privilegie loop
    if a.user_id is null then
      v_sans := v_sans + 1;
      continue;
    end if;
    v_avec := v_avec + 1;
    for s in select * from public.sorties
             where id = any(coalesce(p_sorties, '{}')) and centre_id = p_centre and reservee_privilegies and statut = 'prevue'
             order by date_sortie, heure loop
      perform public.notifier(a.user_id, 'privilegies_invitation',
        'Plongée réservée aux membres privilégiés',
        public.date_fr(s.date_sortie) || coalesce(' à ' || to_char(s.heure, 'HH24"h"MI'), '') || ' · ' || s.site_name
          || coalesce(' · ' || s.melange, '') || '. ' || coalesce(v_dp, 'Ton DP') || ' t''invite.',
        '/sortie?code=' || s.jeton || '&via=lien', jsonb_build_object('sortie_id', s.id));
    end loop;
  end loop;
  return jsonb_build_object('avec_app', v_avec, 'sans_app', v_sans);
end;
$$;
revoke all on function public.inviter_privilegies(uuid, uuid[], uuid[]) from public, anon;
grant execute on function public.inviter_privilegies(uuid, uuid[], uuid[]) to authenticated;

-- L'étoile dans la liste des adhérents
create or replace function public.ids_privilegies(p_centre uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case when public.est_dp_centre(p_centre) then coalesce((
    select jsonb_agg(jsonb_build_object('id', a.id, 'user_id', a.user_id))
    from public.centre_adherents a where a.centre_id = p_centre and a.privilegie), '[]'::jsonb) else '[]'::jsonb end;
$$;
revoke all on function public.ids_privilegies(uuid) from public, anon;
grant execute on function public.ids_privilegies(uuid) to authenticated;


-- ============================================================
-- Palanote — Suivi des palanquées sur le bateau (facultatif)
--
-- Le jour J, si quelqu'un a le temps (le DP conduit souvent le bateau et aide à remonter
-- le matériel : rien n'est obligatoire), deux gestes par palanquée :
--   · « À l'eau » note l'heure d'immersion ;
--   · « Sortie de l'eau » note l'heure de retour.
-- Une palanquée encore à l'eau après la durée prévue passe en orange, puis en rouge.
-- Les heures remplissent la fiche de sécurité, et la durée est proposée à la fin.
--
-- Prérequis : palanote-sorties-club.sql (sortie_palanquees, est_dp_sortie).
-- À coller dans Supabase → SQL Editor → Run. Relançable sans risque.
-- ============================================================

alter table public.sortie_palanquees add column if not exists immersion_le timestamptz;
alter table public.sortie_palanquees add column if not exists sortie_le timestamptz;
alter table public.sortie_palanquees add column if not exists duree_prevue integer;
alter table public.sortie_palanquees drop constraint if exists sortie_palanquees_duree_check;
alter table public.sortie_palanquees add constraint sortie_palanquees_duree_check check (duree_prevue is null or duree_prevue between 5 and 240);

-- Un geste sur une palanquée : 'eau', 'sortie', ou 'annuler' (efface la dernière heure notée)
create or replace function public.marquer_palanquee(p_palanquee uuid, p_etape text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  q public.sortie_palanquees;
begin
  select * into q from public.sortie_palanquees where id = p_palanquee;
  if not found or not public.est_dp_sortie(q.sortie_id) then raise exception 'réservé au directeur de plongée'; end if;
  if p_etape = 'eau' then
    update public.sortie_palanquees set immersion_le = now(), sortie_le = null where id = p_palanquee returning * into q;
  elsif p_etape = 'sortie' then
    if q.immersion_le is null then raise exception 'la palanquée n''est pas encore à l''eau'; end if;
    update public.sortie_palanquees set sortie_le = now() where id = p_palanquee returning * into q;
  elsif p_etape = 'annuler' then
    if q.sortie_le is not null then
      update public.sortie_palanquees set sortie_le = null where id = p_palanquee returning * into q;
    else
      update public.sortie_palanquees set immersion_le = null where id = p_palanquee returning * into q;
    end if;
  else
    raise exception 'étape inconnue';
  end if;
  return jsonb_build_object('id', q.id, 'immersion_le', q.immersion_le, 'sortie_le', q.sortie_le);
end;
$$;
revoke all on function public.marquer_palanquee(uuid, text) from public, anon;
grant execute on function public.marquer_palanquee(uuid, text) to authenticated;

-- Corriger une heure à la main (oubli sur le bateau) : p_quand au format HH:MM, le jour de la sortie
create or replace function public.corriger_heure_palanquee(p_palanquee uuid, p_etape text, p_quand time)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  q public.sortie_palanquees;
  v_jour date;
  v_ts timestamptz;
begin
  select * into q from public.sortie_palanquees where id = p_palanquee;
  if not found or not public.est_dp_sortie(q.sortie_id) then raise exception 'réservé au directeur de plongée'; end if;
  select date_sortie into v_jour from public.sorties where id = q.sortie_id;
  v_ts := case when p_quand is null then null else (v_jour + p_quand) at time zone 'Europe/Paris' end;
  if p_etape = 'eau' then
    update public.sortie_palanquees set immersion_le = v_ts where id = p_palanquee;
  elsif p_etape = 'sortie' then
    update public.sortie_palanquees set sortie_le = v_ts where id = p_palanquee;
  else
    raise exception 'étape inconnue';
  end if;
end;
$$;
revoke all on function public.corriger_heure_palanquee(uuid, text, time) from public, anon;
grant execute on function public.corriger_heure_palanquee(uuid, text, time) to authenticated;

-- Durée prévue d'une palanquée (pour l'alerte « encore à l'eau »)
create or replace function public.duree_prevue_palanquee(p_palanquee uuid, p_minutes integer)
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
  if not found or not public.est_dp_sortie(q.sortie_id) then raise exception 'réservé au directeur de plongée'; end if;
  update public.sortie_palanquees set duree_prevue = p_minutes where id = p_palanquee;
end;
$$;
revoke all on function public.duree_prevue_palanquee(uuid, integer) from public, anon;
grant execute on function public.duree_prevue_palanquee(uuid, integer) to authenticated;

-- Le suivi de toutes les palanquées d'une sortie
create or replace function public.suivi_palanquees(p_sortie uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case when public.est_dp_sortie(p_sortie) then coalesce((
    select jsonb_agg(jsonb_build_object('id', q.id, 'numero', q.numero, 'immersion_le', q.immersion_le, 'sortie_le', q.sortie_le,
                                        'duree_prevue', q.duree_prevue) order by q.numero)
    from public.sortie_palanquees q where q.sortie_id = p_sortie), '[]'::jsonb) else '[]'::jsonb end;
$$;
revoke all on function public.suivi_palanquees(uuid) from public, anon;
grant execute on function public.suivi_palanquees(uuid) to authenticated;


-- ============================================================
-- Palanote — Le passeport du plongeur
--
-- Le plongeur range ses brevets (niveau, Nitrox, Trimix…) avec la photo de ses cartes,
-- et la date de fin de son certificat médical (la date seulement, jamais le document).
-- Il montre son passeport au directeur de plongée sur le bateau ; le DP le consulte aussi
-- depuis la sortie, et peut marquer une carte « vérifiée » (le plongeur ne peut pas se
-- l'attribuer lui-même, et la vérification tombe s'il modifie sa carte).
-- Qui voit le passeport : le plongeur, et les DP qui l'encadrent (une sortie de leur centre
-- dans l'année, ou adhérent de leur club).
--
-- Prérequis : palanote-sorties-club.sql, palanote-planning-club.sql (est_dp_centre)
--             et palanote-import-excel.sql (centre_adherents).
-- À coller dans Supabase → SQL Editor → Run. Relançable sans risque.
-- ============================================================

alter table public.profiles add column if not exists certificat_fin date; -- fin de validité du certificat médical

create table if not exists public.plongeur_brevets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null default 'niveau',
  intitule text not null,
  organisme text,
  numero text,
  obtenu_le date,
  photo_recto text, -- chemin dans le stockage « passeports »
  photo_verso text,
  verifie_par uuid references auth.users(id) on delete set null,
  verifie_le timestamptz,
  verifie_centre text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint plongeur_brevets_type_check check (type in ('niveau', 'nitrox', 'trimix', 'autre')),
  constraint plongeur_brevets_intitule_check check (char_length(btrim(intitule)) between 1 and 80)
);
create index if not exists plongeur_brevets_user_idx on public.plongeur_brevets (user_id);

grant select, insert, update, delete on public.plongeur_brevets to authenticated;
grant all on public.plongeur_brevets to service_role;
alter table public.plongeur_brevets enable row level security;
drop policy if exists "Lire ses brevets" on public.plongeur_brevets;
create policy "Lire ses brevets" on public.plongeur_brevets for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Ajouter un brevet" on public.plongeur_brevets;
create policy "Ajouter un brevet" on public.plongeur_brevets for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "Modifier un brevet" on public.plongeur_brevets;
create policy "Modifier un brevet" on public.plongeur_brevets for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Retirer un brevet" on public.plongeur_brevets;
create policy "Retirer un brevet" on public.plongeur_brevets for delete to authenticated using (auth.uid() = user_id);

drop trigger if exists plongeur_brevets_updated_at on public.plongeur_brevets;
create trigger plongeur_brevets_updated_at before update on public.plongeur_brevets
  for each row execute function public.update_updated_at_column();

-- La vérification ne s'écrit que par verifier_brevet ; elle tombe si la carte change
create or replace function public.proteger_verification_brevet()
returns trigger
language plpgsql
as $$
begin
  if current_setting('palanote.verification', true) = 'oui' then return new; end if;
  if tg_op = 'INSERT' then
    new.verifie_par := null; new.verifie_le := null; new.verifie_centre := null;
  elsif (new.type, new.intitule, new.organisme, new.numero, new.obtenu_le, new.photo_recto, new.photo_verso)
        is distinct from (old.type, old.intitule, old.organisme, old.numero, old.obtenu_le, old.photo_recto, old.photo_verso) then
    new.verifie_par := null; new.verifie_le := null; new.verifie_centre := null;
  else
    new.verifie_par := old.verifie_par; new.verifie_le := old.verifie_le; new.verifie_centre := old.verifie_centre;
  end if;
  return new;
end;
$$;
drop trigger if exists plongeur_brevets_verification on public.plongeur_brevets;
create trigger plongeur_brevets_verification before insert or update on public.plongeur_brevets
  for each row execute function public.proteger_verification_brevet();

-- ------------------------------------------------------------
-- Qui peut voir le passeport d'un plongeur
-- ------------------------------------------------------------
create or replace function public.peut_voir_passeport(p_owner uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() = p_owner
    or exists (select 1 from public.sortie_participants p join public.sorties s on s.id = p.sortie_id
               where p.user_id = p_owner and s.deleted_at is null and s.date_sortie >= current_date - 365
                 and public.est_dp_sortie(s.id))
    or exists (select 1 from public.centre_adherents a where a.user_id = p_owner and public.est_dp_centre(a.centre_id));
$$;
revoke all on function public.peut_voir_passeport(uuid) from public, anon;
grant execute on function public.peut_voir_passeport(uuid) to authenticated;

-- Variante pour le stockage (le dossier est un texte)
create or replace function public.peut_voir_passeport_dossier(p_dossier text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  return public.peut_voir_passeport(p_dossier::uuid);
exception when others then
  return false;
end;
$$;
revoke all on function public.peut_voir_passeport_dossier(text) from public, anon;
grant execute on function public.peut_voir_passeport_dossier(text) to authenticated;

-- ------------------------------------------------------------
-- Photos des cartes : stockage privé « passeports », un dossier par plongeur
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('passeports', 'passeports', false, 6291456, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "passeports_select" on storage.objects;
create policy "passeports_select" on storage.objects for select to authenticated
  using (bucket_id = 'passeports' and public.peut_voir_passeport_dossier((storage.foldername(name))[1]));
drop policy if exists "passeports_insert" on storage.objects;
create policy "passeports_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'passeports' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "passeports_update" on storage.objects;
create policy "passeports_update" on storage.objects for update to authenticated
  using (bucket_id = 'passeports' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "passeports_delete" on storage.objects;
create policy "passeports_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'passeports' and (storage.foldername(name))[1] = auth.uid()::text);

-- ------------------------------------------------------------
-- Lecture du passeport
-- ------------------------------------------------------------
create or replace function public.passeport_plongeur(p_user uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.peut_voir_passeport(p_user) then raise exception 'passeport non partagé'; end if;
  return public.infos_plongeur(p_user) || jsonb_build_object(
    'certificat_fin', (select certificat_fin from public.profiles where id = p_user),
    'moi', auth.uid() = p_user,
    'brevets', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', b.id, 'type', b.type, 'intitule', b.intitule, 'organisme', b.organisme, 'numero', b.numero,
        'obtenu_le', b.obtenu_le, 'photo_recto', b.photo_recto, 'photo_verso', b.photo_verso,
        'verifie_le', b.verifie_le, 'verifie_centre', b.verifie_centre,
        'verifie_par', public.infos_plongeur(b.verifie_par) ->> 'prenom')
        order by array_position(array['niveau', 'nitrox', 'trimix', 'autre'], b.type), b.obtenu_le desc nulls last)
      from public.plongeur_brevets b where b.user_id = p_user), '[]'::jsonb));
end;
$$;
revoke all on function public.passeport_plongeur(uuid) from public, anon;
grant execute on function public.passeport_plongeur(uuid) to authenticated;

-- Pour le DP : le résumé des passeports de tous les inscrits d'une sortie (alertes)
create or replace function public.passeports_sortie(p_sortie uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case when public.est_dp_sortie(p_sortie) then coalesce((
    select jsonb_agg(jsonb_build_object(
      'user_id', p.user_id,
      'certificat_fin', pr.certificat_fin,
      -- Déclaré au profil, ou carte dans le passeport (« carte » = preuve photographiée)
      'nitrox', exists (select 1 from public.plongeur_brevets b where b.user_id = p.user_id and b.type in ('nitrox', 'trimix'))
                or coalesce(pr.certifications && array['Nitrox', 'Trimix'], false),
      'trimix', exists (select 1 from public.plongeur_brevets b where b.user_id = p.user_id and b.type = 'trimix')
                or coalesce('Trimix' = any(pr.certifications), false),
      'nitrox_carte', exists (select 1 from public.plongeur_brevets b where b.user_id = p.user_id and b.type in ('nitrox', 'trimix') and b.photo_recto is not null),
      'brevets', (select count(*) from public.plongeur_brevets b where b.user_id = p.user_id),
      'verifies', (select count(*) from public.plongeur_brevets b where b.user_id = p.user_id and b.verifie_le is not null)))
    from public.sortie_participants p
    left join public.profiles pr on pr.id = p.user_id
    where p.sortie_id = p_sortie and p.user_id is not null), '[]'::jsonb) else '[]'::jsonb end;
$$;
revoke all on function public.passeports_sortie(uuid) from public, anon;
grant execute on function public.passeports_sortie(uuid) to authenticated;

-- Le DP a vu la carte : « vérifiée par Marc (Aqua Club Hyères) »
create or replace function public.verifier_brevet(p_brevet uuid, p_oui boolean)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  b public.plongeur_brevets;
  v_centre text;
begin
  select * into b from public.plongeur_brevets where id = p_brevet;
  if not found or b.user_id = auth.uid() or not public.peut_voir_passeport(b.user_id) then
    raise exception 'seul un directeur de plongée qui t''encadre peut vérifier une carte';
  end if;
  select c.nom into v_centre from public.centre_membres m join public.centres c on c.id = m.centre_id
  where m.user_id = auth.uid() and m.role = 'dp' order by m.created_at limit 1;
  perform set_config('palanote.verification', 'oui', true);
  update public.plongeur_brevets set
    verifie_par = case when p_oui then auth.uid() end,
    verifie_le = case when p_oui then now() end,
    verifie_centre = case when p_oui then v_centre end
  where id = p_brevet;
  perform set_config('palanote.verification', '', true);
  if p_oui then
    perform public.notifier(b.user_id, 'passeport_verifie', 'Carte vérifiée',
      b.intitule || ' : vérifiée par ' || coalesce(public.infos_plongeur(auth.uid()) ->> 'prenom', 'ton DP') || coalesce(' (' || v_centre || ')', '') || '.',
      '/moi/passeport', jsonb_build_object('brevet_id', b.id));
  end if;
end;
$$;
revoke all on function public.verifier_brevet(uuid, boolean) from public, anon;
grant execute on function public.verifier_brevet(uuid, boolean) to authenticated;


-- ============================================================
-- Palanote — Les rappels du directeur de plongée (notifications in-app)
--
-- Le DP reçoit dans sa cloche :
--   · matériel : contrôle à prévoir (J-30, J-7) et contrôle dépassé (inspection des blocs,
--     révision des détendeurs, du bateau…) ;
--   · adhérents : certificats médicaux qui expirent dans le mois ou viennent d'expirer
--     (un rappel groupé par semaine) ;
--   · ses sorties : à préparer la veille (personne d'inscrit, plongeurs non placés,
--     palanquée sans guide, pas de bateau), à clôturer, à tamponner.
-- Les rappels sont créés quand le DP ouvre l'app (pas besoin de tâche planifiée), une seule
-- fois chacun : la table rappels_envoyes garde la trace de ce qui est déjà parti.
--
-- Prérequis : palanote-sorties-club.sql (notifier, date_fr), palanote-planning-club.sql
--             (materiel, est_dp_centre) et palanote-import-excel.sql (centre_adherents).
-- À coller dans Supabase → SQL Editor → Run. Relançable sans risque.
-- ============================================================

create table if not exists public.rappels_envoyes (
  user_id uuid not null references auth.users(id) on delete cascade,
  cle text not null, -- ex. « materiel:<id>:2026-11-03:j7 »
  created_at timestamptz not null default now(),
  primary key (user_id, cle)
);
alter table public.rappels_envoyes enable row level security; -- aucune lecture directe : seules les fonctions y écrivent
grant all on public.rappels_envoyes to service_role;

-- Envoie la notification si ce rappel n'est pas déjà parti ; renvoie 1 si envoyé
create or replace function public.rappel_une_fois(p_user uuid, p_cle text, p_type text, p_titre text, p_texte text, p_lien text,
                                                  p_donnees jsonb default '{}'::jsonb)
returns integer
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  insert into public.rappels_envoyes (user_id, cle) values (p_user, p_cle) on conflict do nothing;
  if not found then return 0; end if;
  perform public.notifier(p_user, p_type, p_titre, p_texte, p_lien, p_donnees);
  return 1;
end;
$$;
revoke all on function public.rappel_une_fois(uuid, text, text, text, text, text, jsonb) from public, anon, authenticated;

-- Appelée par l'app du DP à l'ouverture : crée les rappels du jour, renvoie leur nombre
create or replace function public.generer_rappels_dp()
returns integer
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_moi uuid := auth.uid();
  v_nb integer := 0;
  c record;
  m record;
  s record;
  v_jours integer;
  v_etape text;
  v_certifs integer;
  v_expires integer;
  v_soucis text[];
begin
  if v_moi is null then return 0; end if;

  for c in select ce.id, ce.nom from public.centre_membres cm join public.centres ce on ce.id = cm.centre_id
           where cm.user_id = v_moi and cm.role = 'dp' loop

    -- 1. Matériel : contrôle à J-30, à J-7, puis dépassé
    for m in select id, libelle, type, prochain_controle from public.materiel
             where centre_id = c.id and deleted_at is null and prochain_controle is not null
               and prochain_controle <= current_date + 30 loop
      v_jours := m.prochain_controle - current_date;
      v_etape := case when v_jours < 0 then 'depasse' when v_jours <= 7 then 'j7' else 'j30' end;
      v_nb := v_nb + public.rappel_une_fois(v_moi, 'materiel:' || m.id || ':' || m.prochain_controle || ':' || v_etape,
        'rappel_materiel',
        case when v_etape = 'depasse' then 'Contrôle dépassé : ' || m.libelle
             else 'Contrôle à prévoir : ' || m.libelle end,
        case when v_etape = 'depasse' then 'Le contrôle était prévu le ' || public.date_fr(m.prochain_controle) || '. Pense à le faire, puis à mettre à jour la date.'
             when v_jours = 0 then 'Le contrôle est prévu aujourd''hui.'
             else 'Le contrôle est prévu le ' || public.date_fr(m.prochain_controle) || ' (dans ' || v_jours || ' jour' || case when v_jours > 1 then 's' else '' end || ').' end,
        '/club/materiel', jsonb_build_object('materiel_id', m.id, 'centre_id', c.id));
    end loop;

    -- 2. Certificats médicaux des adhérents : un rappel groupé par semaine
    select count(*) filter (where certificat_fin >= current_date),
           count(*) filter (where certificat_fin < current_date)
      into v_certifs, v_expires
      from public.centre_adherents
     where centre_id = c.id and certificat_fin between current_date - 60 and current_date + 30;
    if v_certifs + v_expires > 0 then
      v_nb := v_nb + public.rappel_une_fois(v_moi, 'certificats:' || c.id || ':' || to_char(current_date, 'IYYY-IW'),
        'rappel_certificat',
        'Certificats médicaux à renouveler',
        concat_ws(' · ',
          case when v_expires > 0 then v_expires || ' expiré' || case when v_expires > 1 then 's' else '' end end,
          case when v_certifs > 0 then v_certifs || ' expire' || case when v_certifs > 1 then 'nt' else '' end || ' dans le mois' end)
          || ' (' || c.nom || ').',
        '/club/membres', jsonb_build_object('centre_id', c.id));
    end if;
  end loop;

  -- 3. Mes sorties
  for s in select so.id, so.date_sortie, so.site_name, so.statut, so.bateau_id, so.centre_id from public.sorties so
           where so.dp_id = v_moi and so.deleted_at is null
             and ((so.statut = 'prevue' and so.date_sortie between current_date - 7 and current_date + 1)
               or (so.statut = 'terminee' and so.date_sortie between current_date - 30 and current_date - 1)) loop
    if s.statut = 'prevue' and s.date_sortie >= current_date then
      -- À préparer : la veille ou le jour même
      v_soucis := array_remove(array[
        case when not exists (select 1 from public.sortie_participants p where p.sortie_id = s.id) then 'personne d''inscrit' end,
        case when exists (select 1 from public.sortie_participants p where p.sortie_id = s.id and p.palanquee_id is null)
             then 'des plongeurs sans palanquée' end,
        case when exists (select 1 from public.sortie_palanquees q where q.sortie_id = s.id and q.guide_id is null
                            and exists (select 1 from public.sortie_participants p where p.palanquee_id = q.id))
             then 'une palanquée sans guide' end,
        case when s.bateau_id is null and s.centre_id is not null
                  and exists (select 1 from public.materiel b where b.centre_id = s.centre_id and b.type = 'bateau' and b.deleted_at is null)
             then 'pas de bateau choisi' end], null);
      if cardinality(v_soucis) > 0 then
        v_nb := v_nb + public.rappel_une_fois(v_moi, 'preparer:' || s.id || ':' || s.date_sortie,
          'rappel_sortie',
          case when s.date_sortie = current_date then 'Aujourd''hui : ' else 'Demain : ' end || s.site_name || ' à préparer',
          initcap(left(array_to_string(v_soucis, ', '), 1)) || substr(array_to_string(v_soucis, ', '), 2) || '.',
          '/club/planning?sortie=' || s.id, jsonb_build_object('sortie_id', s.id));
      end if;
    elsif s.statut = 'prevue' then
      -- Passée mais pas clôturée
      v_nb := v_nb + public.rappel_une_fois(v_moi, 'cloturer:' || s.id,
        'rappel_cloture', 'Sortie à clôturer : ' || s.site_name,
        'La sortie du ' || public.date_fr(s.date_sortie) || ' est passée : indique la durée et l''eau pour envoyer les fiches.',
        '/club/sortie?id=' || s.id, jsonb_build_object('sortie_id', s.id));
    else
      -- Terminée depuis au moins un jour, pas encore tamponnée
      v_nb := v_nb + public.rappel_une_fois(v_moi, 'tamponner:' || s.id,
        'rappel_tampon', 'Carnets à tamponner : ' || s.site_name,
        'Les plongeurs du ' || public.date_fr(s.date_sortie) || ' attendent ton tampon.',
        '/club/sortie?id=' || s.id, jsonb_build_object('sortie_id', s.id));
    end if;
  end loop;

  return v_nb;
end;
$$;
revoke all on function public.generer_rappels_dp() from public, anon;
grant execute on function public.generer_rappels_dp() to authenticated;


-- ============================================================
-- Palanote — Le rappel de la veille pour le plongeur
--
-- La veille (ou le matin même) d'une sortie où il est inscrit, le plongeur reçoit dans sa
-- cloche : l'heure, le lieu, le bateau, le mélange et les consignes du DP, plus ce qu'il doit
-- régler avant de partir (certificat médical expiré à la date de la sortie, sortie au Nitrox
-- ou au Trimix sans brevet dans son passeport).
-- Créé quand le plongeur ouvre l'app, une seule fois par sortie.
--
-- Prérequis : palanote-rappels-dp.sql (rappels_envoyes, rappel_une_fois),
--             palanote-passeport.sql (certificat_fin, plongeur_brevets)
--             et palanote-privilegies.sql (sorties.melange).
-- À coller dans Supabase → SQL Editor → Run. Relançable sans risque.
-- ============================================================

create or replace function public.generer_rappels_plongeur()
returns integer
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_moi uuid := auth.uid();
  v_nb integer := 0;
  v_certif date;
  v_certifs text[];
  s record;
  v_infos text[];
  v_regler text[];
begin
  if v_moi is null then return 0; end if;
  select certificat_fin, coalesce(certifications, '{}') into v_certif, v_certifs from public.profiles where id = v_moi;

  for s in select so.id, so.date_sortie, so.heure, so.site_name, so.site_location, so.bateau, so.melange, so.consignes,
                  so.profondeur_prevue, c.nom as centre
           from public.sortie_participants p
           join public.sorties so on so.id = p.sortie_id
           left join public.centres c on c.id = so.centre_id
           where p.user_id = v_moi and so.deleted_at is null and so.statut = 'prevue'
             and so.date_sortie between current_date and current_date + 1 loop
    v_infos := array_remove(array[
      s.site_location,
      s.bateau,
      case when s.profondeur_prevue is not null then trim(trailing '.' from trim(trailing '0' from s.profondeur_prevue::text)) || ' m prévus' end,
      s.melange], null);
    v_regler := array_remove(array[
      case when v_certif is null then 'indique la date de ton certificat médical dans ton passeport'
           when v_certif < s.date_sortie then 'ton certificat médical sera expiré : apporte le nouveau' end,
      case when s.melange = 'Trimix' and not exists (select 1 from public.plongeur_brevets b where b.user_id = v_moi and b.type = 'trimix')
                and not ('Trimix' = any(v_certifs))
             then 'sortie au Trimix : ajoute ta carte Trimix à ton passeport'
           when s.melange = 'Nitrox' and not exists (select 1 from public.plongeur_brevets b where b.user_id = v_moi and b.type in ('nitrox', 'trimix'))
                and not (v_certifs && array['Nitrox', 'Trimix'])
             then 'sortie au Nitrox : ajoute ta carte Nitrox à ton passeport' end], null);
    v_nb := v_nb + public.rappel_une_fois(v_moi, 'veille:' || s.id || ':' || s.date_sortie,
      'rappel_veille',
      case when s.date_sortie = current_date then 'Aujourd''hui' else 'Demain' end
        || coalesce(' à ' || to_char(s.heure, 'HH24"h"MI'), '') || ' : ' || s.site_name,
      concat_ws(' ',
        nullif(array_to_string(v_infos, ' · '), '') || '.',
        case when s.consignes is not null then 'Consignes : ' || s.consignes || case when right(s.consignes, 1) in ('.', '!', '?') then '' else '.' end end,
        case when cardinality(v_regler) > 0 then 'À régler : ' || array_to_string(v_regler, ' ; ') || '.' end),
      case when cardinality(v_regler) > 0 then '/moi/passeport' else '/sortie?id=' || s.id end,
      jsonb_build_object('sortie_id', s.id, 'centre', s.centre));
  end loop;
  return v_nb;
end;
$$;
revoke all on function public.generer_rappels_plongeur() from public, anon;
grant execute on function public.generer_rappels_plongeur() to authenticated;


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


-- ============================================================
-- Palanote — L'export Excel de la saison (directeur de plongée)
--
-- Toutes les sorties du centre sur une période (année civile ou saison de septembre à août),
-- les plongées de chaque plongeur (sorties Palanote et historique importé d'Excel),
-- et le bilan par plongeur. L'app en fait un fichier Excel à 4 onglets.
--
-- Prérequis : palanote-sorties-club.sql, palanote-planning-club.sql,
--             palanote-import-excel.sql et palanote-privilegies.sql.
-- À coller dans Supabase → SQL Editor → Run. Relançable sans risque.
-- ============================================================

create or replace function public.export_saison(p_centre uuid, p_debut date, p_fin date)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.est_dp_centre(p_centre) then raise exception 'réservé aux directeurs de plongée du centre'; end if;
  if p_fin < p_debut or p_fin - p_debut > 400 then raise exception 'période invalide (13 mois au plus)'; end if;

  return jsonb_build_object(
    'centre', (select nom from public.centres where id = p_centre),

    -- Onglet « Sorties »
    'sorties', coalesce((
      select jsonb_agg(jsonb_build_object(
        'date', s.date_sortie, 'heure', to_char(s.heure, 'HH24:MI'), 'site', s.site_name, 'lieu', s.site_location,
        'bateau', s.bateau, 'dp', public.infos_plongeur(s.dp_id) ->> 'prenom',
        'statut', case s.statut when 'prevue' then 'Prévue' when 'terminee' then 'À tamponner'
                                when 'validee' then 'Tamponnée' when 'annulee' then 'Annulée' else s.statut end,
        'melange', s.melange, 'reservee', s.reservee_privilegies,
        'motif', to_jsonb(s) ->> 'motif_changement', -- annulation ou report (palanote-meteo.sql)
        'profondeur_prevue', s.profondeur_prevue, 'duree', s.duree_min, 'temperature', s.temp_fond_c, 'visibilite', s.visibilite_m,
        'plongeurs', (select count(*) from public.sortie_participants p where p.sortie_id = s.id),
        'palanquees', (select count(*) from public.sortie_palanquees q where q.sortie_id = s.id
                         and exists (select 1 from public.sortie_participants p where p.palanquee_id = q.id)),
        'tampons', (select count(*) from public.sortie_participants p where p.sortie_id = s.id and p.tamponne_le is not null))
        order by s.date_sortie, s.heure nulls last)
      from public.sorties s
      where s.centre_id = p_centre and s.deleted_at is null and s.date_sortie between p_debut and p_fin), '[]'::jsonb),

    -- Onglet « Plongées » : une ligne par plongeur et par plongée
    'plongees', coalesce((
      select jsonb_agg(x order by x ->> 'date', x ->> 'site', x ->> 'plongeur') from (
        select jsonb_build_object(
          'date', s.date_sortie, 'site', s.site_name,
          'plongeur', coalesce(public.infos_plongeur(p.user_id) ->> 'prenom', p.nom_prevu),
          'nom', (select nullif(to_jsonb(pr) ->> 'nom', '') from public.profiles pr where pr.id = p.user_id),
          'niveau', public.infos_plongeur(p.user_id) ->> 'niveau',
          'palanquee', q.numero,
          'role', case when p.user_id is not null and p.user_id = q.guide_id then 'GP' else 'Plongeur' end,
          'profondeur', d.max_depth_m, 'duree', d.duration_min,
          'tamponnee', p.tamponne_le is not null,
          'source', 'Palanote') as x
        from public.sortie_participants p
        join public.sorties s on s.id = p.sortie_id
        left join public.sortie_palanquees q on q.id = p.palanquee_id
        left join public.dives d on d.id = p.dive_id and d.deleted_at is null
        where s.centre_id = p_centre and s.deleted_at is null and s.statut <> 'annulee'
          and s.date_sortie between p_debut and p_fin
        union all
        select jsonb_build_object(
          'date', h.date_plongee, 'site', h.site, 'plongeur', a.prenom, 'nom', a.nom, 'niveau', a.niveau,
          'palanquee', h.palanquee, 'role', h.role, 'profondeur', h.profondeur, 'duree', h.duree,
          'tamponnee', null, 'source', 'Import Excel')
        from public.adherent_plongees h join public.centre_adherents a on a.id = h.adherent_id
        where h.centre_id = p_centre and h.date_plongee between p_debut and p_fin) t), '[]'::jsonb),

    -- Onglet « Plongeurs » : le bilan de chacun sur la période
    'plongeurs', coalesce((
      with lignes as (
        select coalesce(p.user_id::text, 'prevu:' || lower(p.nom_prevu)) as cle, p.user_id, null::uuid as adherent_id,
               s.date_sortie as jour, d.max_depth_m as prof, p.tamponne_le is not null as tampon
        from public.sortie_participants p
        join public.sorties s on s.id = p.sortie_id
        left join public.dives d on d.id = p.dive_id and d.deleted_at is null
        where s.centre_id = p_centre and s.deleted_at is null and s.statut <> 'annulee' and s.date_sortie between p_debut and p_fin
        union all
        select coalesce(a.user_id::text, 'adherent:' || a.id), a.user_id, a.id, h.date_plongee, h.profondeur, false
        from public.adherent_plongees h join public.centre_adherents a on a.id = h.adherent_id
        where h.centre_id = p_centre and h.date_plongee between p_debut and p_fin
      ), bilan as (
        select cle, max(user_id::text)::uuid as user_id, max(adherent_id::text)::uuid as adherent_id,
               count(*) as plongees, count(*) filter (where tampon) as tampons, max(prof) as prof_max,
               min(jour) as premiere, max(jour) as derniere
        from lignes group by cle
      )
      select jsonb_agg(jsonb_build_object(
        'prenom', coalesce(public.infos_plongeur(b.user_id) ->> 'prenom', a.prenom,
                           (select p.nom_prevu from public.sortie_participants p join public.sorties s on s.id = p.sortie_id
                            where s.centre_id = p_centre and 'prevu:' || lower(p.nom_prevu) = b.cle limit 1)),
        'nom', coalesce((select nullif(to_jsonb(pr) ->> 'nom', '') from public.profiles pr where pr.id = b.user_id), a.nom),
        'niveau', coalesce(public.infos_plongeur(b.user_id) ->> 'niveau', a.niveau),
        'plongees', b.plongees, 'tampons', b.tampons, 'prof_max', b.prof_max,
        'premiere', b.premiere, 'derniere', b.derniere,
        'compte', b.user_id is not null,
        'adherent', a.id is not null,
        'licence', a.licence, 'certificat_fin', a.certificat_fin, 'privilegie', coalesce(a.privilegie, false))
        order by b.plongees desc, b.derniere desc)
      from bilan b
      left join lateral (
        select * from public.centre_adherents x
        where x.centre_id = p_centre and (x.id = b.adherent_id or (b.user_id is not null and x.user_id = b.user_id))
        limit 1) a on true), '[]'::jsonb)
  );
end;
$$;
revoke all on function public.export_saison(uuid, date, date) from public, anon;
grant execute on function public.export_saison(uuid, date, date) to authenticated;


-- ============================================================
-- Palanote — Annuler ou reporter des sorties en un geste (météo, mer, bateau…)
--
-- Le DP choisit une ou plusieurs sorties (souvent toute la journée), le motif
-- (météo, mer formée, vent, visibilité, bateau indisponible, autre), un message
-- facultatif, et annule ou reporte à une autre date. Tous les inscrits, et les
-- plongeurs en liste d'attente, sont prévenus dans leur cloche avec le motif.
-- Le motif reste sur la sortie (il apparaît dans l'export de la saison).
--
-- Prérequis : palanote-sorties-club.sql, palanote-planning-club.sql
--             et palanote-liste-attente.sql.
-- À coller dans Supabase → SQL Editor → Run. Relançable sans risque.
-- ============================================================

alter table public.sorties add column if not exists motif_changement text; -- « Météo », « Mer formée »… + message du DP

create or replace function public.annuler_reporter_sorties(
  p_sorties uuid[], p_action text, p_motif text, p_message text default null,
  p_date date default null, p_heure time default null)
returns integer
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_id uuid;
  s public.sorties;
  p record;
  v_motif text := left(coalesce(nullif(btrim(p_motif), ''), 'Autre'), 40);
  v_message text := nullif(btrim(left(coalesce(p_message, ''), 400)), '');
  v_texte text;
  v_nb integer := 0;
begin
  if p_action not in ('annuler', 'reporter') then raise exception 'action inconnue'; end if;
  if p_action = 'reporter' and (p_date is null or p_date < current_date) then raise exception 'choisis une nouvelle date à venir'; end if;
  if coalesce(array_length(p_sorties, 1), 0) = 0 or array_length(p_sorties, 1) > 20 then raise exception 'choisis entre 1 et 20 sorties'; end if;

  foreach v_id in array p_sorties loop
    select * into s from public.sorties where id = v_id and deleted_at is null;
    if not found or not public.est_dp_sortie(v_id) then raise exception 'réservé au directeur de plongée'; end if;
    if s.statut <> 'prevue' then raise exception 'la sortie % n''est plus prévue', s.site_name; end if;

    if p_action = 'annuler' then
      update public.sorties set statut = 'annulee', motif_changement = v_motif || coalesce(' : ' || v_message, '') where id = v_id;
      v_texte := public.texte_sortie(v_id) || '.' || coalesce(' ' || v_message, '');
      for p in select user_id from public.sortie_participants where sortie_id = v_id and user_id is not null and user_id <> auth.uid()
               union select user_id from public.sortie_attente where sortie_id = v_id loop
        perform public.notifier(p.user_id, 'sortie_annulee', 'Sortie annulée · ' || lower(v_motif), v_texte,
          '/sortie?id=' || v_id, jsonb_build_object('sortie_id', v_id, 'motif', v_motif));
        v_nb := v_nb + 1;
      end loop;
      delete from public.sortie_attente where sortie_id = v_id;
    else
      update public.sorties set date_sortie = p_date, heure = coalesce(p_heure, heure),
                                motif_changement = v_motif || coalesce(' : ' || v_message, '') where id = v_id;
      v_texte := public.texte_sortie(v_id) || ' (au lieu du ' || public.date_fr(s.date_sortie)
                 || coalesce(' à ' || to_char(s.heure, 'HH24"h"MI'), '') || ').' || coalesce(' ' || v_message, '');
      for p in select user_id from public.sortie_participants where sortie_id = v_id and user_id is not null and user_id <> auth.uid()
               union select user_id from public.sortie_attente where sortie_id = v_id loop
        perform public.notifier(p.user_id, 'sortie_modifiee', 'Sortie reportée · ' || lower(v_motif), v_texte,
          '/sortie?id=' || v_id, jsonb_build_object('sortie_id', v_id, 'motif', v_motif));
        v_nb := v_nb + 1;
      end loop;
    end if;
  end loop;
  return v_nb;
end;
$$;
revoke all on function public.annuler_reporter_sorties(uuid[], text, text, text, date, time) from public, anon;
grant execute on function public.annuler_reporter_sorties(uuid[], text, text, text, date, time) to authenticated;


-- ============================================================
-- Palanote — La signature du DP sur la fiche de sécurité
--
-- Le DP signe la fiche de sécurité au doigt (ou à la souris), sans l'imprimer.
-- La signature (une petite image) est gardée avec la date, l'heure et son nom ;
-- elle apparaît sur la fiche et sur le PDF. Il peut signer à nouveau tant que la
-- sortie n'est pas tamponnée (la fiche peut changer jusque-là).
--
-- Prérequis : palanote-sorties-club.sql (sorties, est_dp_sortie).
-- À coller dans Supabase → SQL Editor → Run. Relançable sans risque.
-- ============================================================

create table if not exists public.fiche_signatures (
  sortie_id uuid primary key references public.sorties(id) on delete cascade,
  signature text not null, -- image PNG (data URL), 200 ko au plus
  signe_par uuid references auth.users(id) on delete set null,
  signe_le timestamptz not null default now(),
  constraint fiche_signatures_image_check check (signature like 'data:image/png;base64,%' and char_length(signature) <= 200000)
);
alter table public.fiche_signatures enable row level security; -- lecture et écriture par les fonctions seulement
grant all on public.fiche_signatures to service_role;

create or replace function public.signer_fiche(p_sortie uuid, p_signature text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  s public.sorties;
begin
  select * into s from public.sorties where id = p_sortie and deleted_at is null;
  if not found or not public.est_dp_sortie(p_sortie) then raise exception 'réservé au directeur de plongée'; end if;
  if s.statut = 'validee' and exists (select 1 from public.fiche_signatures where sortie_id = p_sortie) then
    raise exception 'sortie tamponnée : la fiche signée ne change plus';
  end if;
  if p_signature is null then
    delete from public.fiche_signatures where sortie_id = p_sortie;
    return null;
  end if;
  insert into public.fiche_signatures (sortie_id, signature, signe_par, signe_le)
  values (p_sortie, p_signature, auth.uid(), now())
  on conflict (sortie_id) do update set signature = excluded.signature, signe_par = excluded.signe_par, signe_le = excluded.signe_le;
  return public.signature_fiche(p_sortie);
end;
$$;
revoke all on function public.signer_fiche(uuid, text) from public, anon;
grant execute on function public.signer_fiche(uuid, text) to authenticated;

create or replace function public.signature_fiche(p_sortie uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case when public.est_dp_sortie(p_sortie) then (
    select jsonb_build_object('signature', f.signature, 'signe_le', f.signe_le,
                              'par', public.infos_plongeur(f.signe_par) ->> 'prenom',
                              'nom', (select nullif(to_jsonb(pr) ->> 'nom', '') from public.profiles pr where pr.id = f.signe_par))
    from public.fiche_signatures f where f.sortie_id = p_sortie) end;
$$;
revoke all on function public.signature_fiche(uuid) from public, anon;
grant execute on function public.signature_fiche(uuid) to authenticated;


-- ============================================================
-- Palanote — Le désistement d'un plongeur, validé par le DP
--
-- Le plongeur ne peut plus venir (même au dernier moment) : il prévient le DP depuis
-- sa sortie, avec un motif. Le DP reçoit une notification (« au dernier moment » si la
-- sortie est dans moins de 24 h) et voit le désistement dans sa sortie. Il valide en un
-- geste : le plongeur est retiré de sa palanquée et de la sortie, la place libérée profite
-- au premier de la liste d'attente. Tant que ce n'est pas validé, le plongeur peut revenir
-- sur sa décision (« Finalement je viens »).
--
-- Prérequis : palanote-sorties-club.sql (sortie_participants, notifier, texte_sortie)
--             et palanote-liste-attente.sql (la place libérée fait avancer la liste).
-- À coller dans Supabase → SQL Editor → Run. Relançable sans risque.
-- ============================================================

alter table public.sortie_participants add column if not exists desiste_le timestamptz;
alter table public.sortie_participants add column if not exists desiste_motif text;

-- Le plongeur prévient qu'il ne vient pas
create or replace function public.se_desister(p_sortie uuid, p_motif text default null)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  s public.sorties;
  p public.sortie_participants;
  v_motif text := nullif(btrim(left(coalesce(p_motif, ''), 200)), '');
  v_dernier boolean;
begin
  select * into s from public.sorties where id = p_sortie and deleted_at is null;
  if not found then raise exception 'sortie introuvable'; end if;
  if s.statut <> 'prevue' then raise exception 'la sortie n''est plus prévue'; end if;
  select * into p from public.sortie_participants where sortie_id = p_sortie and user_id = auth.uid();
  if not found then raise exception 'tu n''es pas inscrit à cette sortie'; end if;
  if p.desiste_le is not null then return; end if;
  update public.sortie_participants set desiste_le = now(), desiste_motif = v_motif where id = p.id;
  if s.dp_id <> auth.uid() then
    v_dernier := (s.date_sortie + coalesce(s.heure, '09:00'::time)) at time zone 'Europe/Paris' < now() + interval '24 hours';
    perform public.notifier(s.dp_id, 'sortie_desistement',
      (public.infos_plongeur(auth.uid()) ->> 'prenom') || ' se désiste' || case when v_dernier then ' au dernier moment' else '' end,
      public.texte_sortie(p_sortie) || '.' || coalesce(' Motif : ' || v_motif || '.', '') || ' Valide son retrait dans la sortie.',
      '/club/sortie?id=' || p_sortie, jsonb_build_object('sortie_id', p_sortie, 'participant_id', p.id));
  end if;
end;
$$;
revoke all on function public.se_desister(uuid, text) from public, anon;
grant execute on function public.se_desister(uuid, text) to authenticated;

-- Finalement il vient (tant que le DP n'a pas validé)
create or replace function public.annuler_desistement(p_sortie uuid)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  s public.sorties;
  p public.sortie_participants;
begin
  select * into s from public.sorties where id = p_sortie;
  select * into p from public.sortie_participants where sortie_id = p_sortie and user_id = auth.uid();
  if not found or p.desiste_le is null then return; end if;
  update public.sortie_participants set desiste_le = null, desiste_motif = null where id = p.id;
  if s.dp_id <> auth.uid() then
    perform public.notifier(s.dp_id, 'sortie_rejointe', (public.infos_plongeur(auth.uid()) ->> 'prenom') || ' vient finalement',
      public.texte_sortie(p_sortie) || ' : il annule son désistement.', '/club/sortie?id=' || p_sortie, jsonb_build_object('sortie_id', p_sortie));
  end if;
end;
$$;
revoke all on function public.annuler_desistement(uuid) from public, anon;
grant execute on function public.annuler_desistement(uuid) to authenticated;

-- Le DP valide : le plongeur est retiré (palanquée et sortie), la liste d'attente avance
create or replace function public.valider_desistement(p_participant uuid)
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
  if not public.est_dp_sortie(p.sortie_id) then raise exception 'réservé au directeur de plongée'; end if;
  if p.desiste_le is null then raise exception 'ce plongeur ne s''est pas désisté'; end if;
  -- Le guide qui part n'est plus guide de sa palanquée
  update public.sortie_palanquees set guide_id = null where id = p.palanquee_id and guide_id = p.user_id;
  delete from public.sortie_participants where id = p_participant;
  if p.user_id is not null then
    perform public.notifier(p.user_id, 'desistement_valide', 'Désistement pris en compte',
      public.texte_sortie(p.sortie_id) || ' : le DP t''a retiré de la sortie. À bientôt sous l''eau !',
      '/carnet', jsonb_build_object('sortie_id', p.sortie_id));
  end if;
end;
$$;
revoke all on function public.valider_desistement(uuid) from public, anon;
grant execute on function public.valider_desistement(uuid) to authenticated;

-- Les désistements d'une sortie : tous pour le DP, le sien pour le plongeur
create or replace function public.desistements_sortie(p_sortie uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'participant_id', p.id, 'user_id', p.user_id,
           'prenom', coalesce(public.infos_plongeur(p.user_id) ->> 'prenom', p.nom_prevu),
           'le', p.desiste_le, 'motif', p.desiste_motif,
           'palanquee', (select numero from public.sortie_palanquees q where q.id = p.palanquee_id))
           order by p.desiste_le), '[]'::jsonb)
  from public.sortie_participants p
  where p.sortie_id = p_sortie and p.desiste_le is not null
    and (public.est_dp_sortie(p_sortie) or p.user_id = auth.uid());
$$;
revoke all on function public.desistements_sortie(uuid) from public, anon;
grant execute on function public.desistements_sortie(uuid) to authenticated;


-- ============================================================
-- Palanote — La recherche de l'espace DP
--
-- Une seule barre pour tout retrouver dans son centre : plongeurs (adhérents et venus en
-- sortie), équipe (guides, pilotes, gonfleurs…), matériel, sorties et sites.
-- Sans tenir compte des accents ni des majuscules (« lea » trouve « Léa »).
--
-- Prérequis : palanote-sorties-club.sql, palanote-planning-club.sql (est_dp_centre,
--             centre_equipe, materiel) et palanote-import-excel.sql (centre_adherents).
-- À coller dans Supabase → SQL Editor → Run. Relançable sans risque.
-- ============================================================

-- Texte comparable : minuscules, sans accents
create or replace function public.texte_simple(p text)
returns text
language sql
immutable
set search_path = public
as $$
  select lower(translate(coalesce(p, ''),
    'àâäáãåçéèêëíìîïñóòôöõúùûüýÿœÀÂÄÁÃÅÇÉÈÊËÍÌÎÏÑÓÒÔÖÕÚÙÛÜÝŸŒ',
    'aaaaaaceeeeiiiinooooouuuuyyoaaaaaaceeeeiiiinooooouuuuyyo'));
$$;

create or replace function public.recherche_dp(p_centre uuid, p_q text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  q text := '%' || public.texte_simple(btrim(coalesce(p_q, ''))) || '%';
begin
  if not public.est_dp_centre(p_centre) then raise exception 'réservé aux directeurs de plongée du centre'; end if;
  if char_length(btrim(coalesce(p_q, ''))) < 2 then return '{}'::jsonb; end if;

  return jsonb_build_object(
    -- Plongeurs : adhérents du club, puis plongeurs venus en sortie avec un compte
    'plongeurs', coalesce((select jsonb_agg(x) from (
      select * from (
        select jsonb_build_object('id', a.id, 'type', 'adherent', 'titre', concat_ws(' ', a.prenom, a.nom),
                 'texte', concat_ws(' · ', a.niveau, case when a.licence is not null then 'licence ' || a.licence end, 'adhérent'),
                 'user_id', a.user_id) as x
        from public.centre_adherents a
        where a.centre_id = p_centre
          and public.texte_simple(concat_ws(' ', a.prenom, a.nom, a.niveau, a.licence, a.email)) like q
        union all
        select jsonb_build_object('id', u.user_id, 'type', 'plongeur', 'titre', concat_ws(' ', i ->> 'prenom', u.nom),
                 'texte', concat_ws(' · ', i ->> 'niveau', u.nb || ' sortie' || case when u.nb > 1 then 's' else '' end || ' avec le centre'),
                 'user_id', u.user_id)
        from (
          select p.user_id, count(distinct p.sortie_id) as nb,
                 (select nullif(to_jsonb(pr) ->> 'nom', '') from public.profiles pr where pr.id = p.user_id) as nom
          from public.sortie_participants p join public.sorties s on s.id = p.sortie_id
          where s.centre_id = p_centre and s.deleted_at is null and p.user_id is not null
            and not exists (select 1 from public.centre_adherents a where a.centre_id = p_centre and a.user_id = p.user_id)
          group by p.user_id
        ) u cross join lateral (select public.infos_plongeur(u.user_id) as i) inf
        where public.texte_simple(concat_ws(' ', i ->> 'prenom', u.nom, i ->> 'niveau', i ->> 'club')) like q
      ) t limit 8) r), '[]'::jsonb),

    'equipe', coalesce((select jsonb_agg(jsonb_build_object('id', e.id, 'titre', e.nom,
                 'texte', concat_ws(' · ', case e.role when 'dp' then 'Directeur de plongée' when 'guide' then 'Guide de palanquée'
                                                       when 'pilote' then 'Pilote' when 'gonfleur' then 'Gonfleur' else 'Équipe' end,
                                    e.niveau, e.telephone)) order by e.nom)
      from (select * from public.centre_equipe
            where centre_id = p_centre and actif
              and public.texte_simple(concat_ws(' ', nom, niveau, telephone, role)) like q
            limit 6) e), '[]'::jsonb),

    'materiel', coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'titre', m.libelle,
                 'texte', concat_ws(' · ',
                   case m.type when 'bateau' then 'Bateau' when 'bloc' then 'Bloc' when 'gilet' then 'Gilet' when 'detendeur' then 'Détendeur'
                               when 'combinaison' then 'Combinaison' when 'ordinateur' then 'Ordinateur' else 'Matériel' end,
                   case when m.type = 'bateau' and m.places is not null then m.places || ' places' when m.quantite > 1 then '×' || m.quantite end,
                   case when m.prochain_controle is not null then 'contrôle le ' || to_char(m.prochain_controle, 'DD/MM/YYYY') end)) order by m.libelle)
      from (select * from public.materiel
            where centre_id = p_centre and deleted_at is null
              and public.texte_simple(concat_ws(' ', libelle, type, note)) like q
            limit 6) m), '[]'::jsonb),

    -- Sorties : les prochaines d'abord, puis les plus récentes
    'sorties', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'titre', s.site_name,
                 'texte', concat_ws(' · ', public.date_fr(s.date_sortie), to_char(s.heure, 'HH24"h"MI'), s.site_location,
                   case s.statut when 'prevue' then 'prévue' when 'terminee' then 'à tamponner' when 'validee' then 'tamponnée' when 'annulee' then 'annulée' end),
                 'date', s.date_sortie) order by (s.date_sortie < current_date), abs(s.date_sortie - current_date))
      from (select * from public.sorties
            where centre_id = p_centre and deleted_at is null
              and public.texte_simple(concat_ws(' ', site_name, site_location, bateau, consignes, public.date_fr(date_sortie))) like q
            order by (date_sortie < current_date), abs(date_sortie - current_date) limit 6) s), '[]'::jsonb),

    'sites', coalesce((select jsonb_agg(jsonb_build_object('titre', x.site, 'texte', concat_ws(' · ', x.lieu, x.nb || ' sortie' || case when x.nb > 1 then 's' else '' end)) order by x.nb desc)
      from (select min(site_name) as site, min(site_location) as lieu, count(*) as nb
            from public.sorties
            where centre_id = p_centre and deleted_at is null and statut <> 'annulee'
              and public.texte_simple(concat_ws(' ', site_name, site_location)) like q
            group by public.texte_simple(site_name) limit 5) x), '[]'::jsonb)
  );
end;
$$;
revoke all on function public.recherche_dp(uuid, text) from public, anon;
grant execute on function public.recherche_dp(uuid, text) to authenticated;


-- ============================================================
-- Palanote — Ajouter un membre depuis l'accueil du club, et l'inviter sur Palanote
--
-- Au comptoir, le DP saisit un nouveau membre (prénom, nom, e-mail, téléphone, niveau,
-- licence, certificat médical). Le membre rejoint la liste des adhérents du club et reçoit
-- un lien d'invitation personnel (QR code à scanner sur place, SMS ou e-mail).
-- En ouvrant ce lien, il crée son compte Palanote (ou se connecte) : son compte est relié
-- au club, il retrouve son historique, et le DP est prévenu.
-- S'il a déjà un compte avec cette adresse e-mail, il est relié tout de suite et prévenu
-- dans l'app.
--
-- Prérequis : palanote-import-excel.sql (centre_adherents), palanote-planning-club.sql
--             (est_dp_centre) et palanote-privilegies.sql (privilegie).
-- À coller dans Supabase → SQL Editor → Run. Relançable sans risque.
-- ============================================================

alter table public.centre_adherents add column if not exists invitation_jeton text;
alter table public.centre_adherents add column if not exists invite_le timestamptz;
alter table public.centre_adherents add column if not exists rejoint_le timestamptz;
create unique index if not exists centre_adherents_invitation_idx on public.centre_adherents (invitation_jeton) where invitation_jeton is not null;

-- Un jeton d'invitation (16 caractères, difficile à deviner)
create or replace function public.nouveau_jeton_invitation()
returns text
language sql
volatile
set search_path = public
as $$
  select left(replace(gen_random_uuid()::text, '-', ''), 16);
$$;

-- Prévient le membre s'il a déjà un compte avec cette adresse e-mail (et relie son compte)
create or replace function public.relier_membre_existant(p_adherent uuid)
returns boolean
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  a public.centre_adherents;
  v_user uuid;
begin
  select * into a from public.centre_adherents where id = p_adherent;
  if a.user_id is not null then return true; end if;
  if a.email is null then return false; end if;
  select id into v_user from auth.users where lower(email) = lower(a.email) limit 1;
  if v_user is null then return false; end if;
  update public.centre_adherents set user_id = v_user, rejoint_le = coalesce(rejoint_le, now()) where id = p_adherent;
  perform public.notifier(v_user, 'club_adhesion', (select nom from public.centres where id = a.centre_id) || ' t''a ajouté à ses membres',
    'Ton compte Palanote est relié au club : tes sorties et ton historique avec le club arrivent dans ton carnet.',
    '/carnet', jsonb_build_object('centre_id', a.centre_id));
  return true;
end;
$$;
revoke all on function public.relier_membre_existant(uuid) from public, anon, authenticated;

-- Le DP ajoute un membre (ou complète une fiche existante, même e-mail)
create or replace function public.ajouter_membre(
  p_centre uuid, p_prenom text, p_nom text default null, p_email text default null, p_telephone text default null,
  p_niveau text default null, p_licence text default null, p_certificat date default null, p_privilegie boolean default false)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_prenom text := nullif(btrim(left(coalesce(p_prenom, ''), 60)), '');
  v_email text := lower(nullif(btrim(coalesce(p_email, '')), ''));
  v_compte boolean;
  a public.centre_adherents;
begin
  if not public.est_dp_centre(p_centre) then raise exception 'réservé aux directeurs de plongée du centre'; end if;
  if v_prenom is null then raise exception 'le prénom est obligatoire'; end if;
  if v_email is not null and v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'adresse e-mail invalide'; end if;

  if v_email is not null then
    select id into v_id from public.centre_adherents where centre_id = p_centre and lower(email) = v_email;
  end if;
  if v_id is null then
    insert into public.centre_adherents (centre_id, prenom, nom, email, telephone, niveau, licence, certificat_fin, adhesion)
    values (p_centre, v_prenom, nullif(btrim(left(coalesce(p_nom, ''), 60)), ''), v_email,
            nullif(btrim(left(coalesce(p_telephone, ''), 30)), ''), nullif(btrim(left(coalesce(p_niveau, ''), 30)), ''),
            nullif(btrim(left(coalesce(p_licence, ''), 40)), ''), p_certificat, current_date)
    returning id into v_id;
  else
    update public.centre_adherents set
      prenom = v_prenom,
      nom = coalesce(nullif(btrim(left(coalesce(p_nom, ''), 60)), ''), nom),
      telephone = coalesce(nullif(btrim(left(coalesce(p_telephone, ''), 30)), ''), telephone),
      niveau = coalesce(nullif(btrim(left(coalesce(p_niveau, ''), 30)), ''), niveau),
      licence = coalesce(nullif(btrim(left(coalesce(p_licence, ''), 40)), ''), licence),
      certificat_fin = coalesce(p_certificat, certificat_fin)
    where id = v_id;
  end if;
  if p_privilegie then
    update public.centre_adherents set privilegie = true, privilegie_depuis = coalesce(privilegie_depuis, now()) where id = v_id;
  end if;
  update public.centre_adherents set invitation_jeton = coalesce(invitation_jeton, public.nouveau_jeton_invitation()), invite_le = now()
  where id = v_id;
  v_compte := public.relier_membre_existant(v_id);
  select * into a from public.centre_adherents where id = v_id;
  return jsonb_build_object('id', a.id, 'prenom', a.prenom, 'email', a.email, 'telephone', a.telephone,
                            'jeton', a.invitation_jeton, 'compte', v_compte);
end;
$$;
revoke all on function public.ajouter_membre(uuid, text, text, text, text, text, text, date, boolean) from public, anon;
grant execute on function public.ajouter_membre(uuid, text, text, text, text, text, text, date, boolean) to authenticated;

-- Inviter un adhérent déjà dans la liste (import Excel…) : son lien personnel
create or replace function public.inviter_membre(p_adherent uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  a public.centre_adherents;
  v_compte boolean;
begin
  select * into a from public.centre_adherents where id = p_adherent;
  if not found or not public.est_dp_centre(a.centre_id) then raise exception 'réservé aux directeurs de plongée du centre'; end if;
  update public.centre_adherents set invitation_jeton = coalesce(invitation_jeton, public.nouveau_jeton_invitation()), invite_le = now()
  where id = p_adherent;
  v_compte := public.relier_membre_existant(p_adherent);
  select * into a from public.centre_adherents where id = p_adherent;
  return jsonb_build_object('id', a.id, 'prenom', a.prenom, 'email', a.email, 'telephone', a.telephone,
                            'jeton', a.invitation_jeton, 'compte', v_compte);
end;
$$;
revoke all on function public.inviter_membre(uuid) from public, anon;
grant execute on function public.inviter_membre(uuid) to authenticated;

-- Ce que voit la personne qui ouvre le lien (même sans compte)
create or replace function public.voir_invitation_club(p_jeton text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object('club', c.nom, 'ville', c.ville, 'prenom', a.prenom, 'email', a.email,
                            'plongees', (select count(*) from public.adherent_plongees h where h.adherent_id = a.id),
                            'relie', a.user_id is not null)
  from public.centre_adherents a join public.centres c on c.id = a.centre_id
  where a.invitation_jeton = p_jeton;
$$;
revoke all on function public.voir_invitation_club(text) from public;
grant execute on function public.voir_invitation_club(text) to anon, authenticated;

-- Le membre, connecté, accepte l'invitation : son compte est relié au club, les DP sont prévenus
create or replace function public.accepter_invitation_club(p_jeton text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  a public.centre_adherents;
  c public.centres;
  d record;
begin
  if auth.uid() is null then raise exception 'connexion requise'; end if;
  select * into a from public.centre_adherents where invitation_jeton = p_jeton;
  if not found then raise exception 'invitation introuvable'; end if;
  if a.user_id is not null and a.user_id <> auth.uid() then raise exception 'cette invitation est déjà utilisée par un autre compte'; end if;
  select * into c from public.centres where id = a.centre_id;
  if a.user_id is null then
    update public.centre_adherents set user_id = auth.uid(), rejoint_le = now() where id = a.id;
    -- Le profil prend le club et le niveau s'ils ne sont pas encore renseignés
    update public.profiles set club = coalesce(nullif(club, ''), c.nom), niveau = coalesce(nullif(niveau, ''), a.niveau) where id = auth.uid();
    for d in select user_id from public.centre_membres where centre_id = a.centre_id and role = 'dp' loop
      perform public.notifier(d.user_id, 'membre_rejoint', a.prenom || coalesce(' ' || a.nom, '') || ' a rejoint Palanote',
        'Son compte est relié à ' || c.nom || ' : il apparaît comme inscrit dans les membres du club.',
        '/club/membres', jsonb_build_object('adherent_id', a.id));
    end loop;
  end if;
  return jsonb_build_object('club', c.nom, 'prenom', a.prenom);
end;
$$;
revoke all on function public.accepter_invitation_club(text) from public, anon;
grant execute on function public.accepter_invitation_club(text) to authenticated;


-- ============================================================
-- Palanote — L'inventaire du matériel, pièce par pièce
--
-- En plus du stock réservé par les sorties (table materiel : « Bloc 12 L × 30 »), chaque
-- pièce a sa fiche : numéro d'inventaire, marque, modèle, taille, n° de série, mise en service,
-- et ses contrôles :
--   · blocs : inspection visuelle annuelle (TIV) et requalification périodique ;
--   · détendeurs, gilets, recycleurs, combinaisons étanches : révision ;
--   · bateau : visite, révision moteur, matériel de sécurité…
-- Les caractéristiques propres à chaque type (volume, robinetterie, immatriculation…) sont
-- rangées dans « caracteristiques ».
--
-- Prérequis : palanote-planning-club.sql (materiel, est_dp_centre).
-- À coller dans Supabase → SQL Editor → Run. Relançable sans risque.
-- ============================================================

create table if not exists public.materiel_articles (
  id uuid primary key default gen_random_uuid(),
  centre_id uuid not null references public.centres(id) on delete cascade,
  materiel_id uuid references public.materiel(id) on delete set null, -- la ligne de stock réservée par les sorties
  categorie text not null,
  reference text not null, -- n° d'inventaire du club (B12-07, DET-12…)
  libelle text,
  marque text,
  modele text,
  taille text,
  numero_serie text,
  mise_en_service date,
  dernier_controle date, -- TIV, révision, visite…
  prochain_controle date,
  derniere_requalif date, -- blocs : requalification périodique
  prochaine_requalif date,
  etat text not null default 'ok',
  caracteristiques jsonb not null default '{}'::jsonb,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint materiel_articles_categorie_check check (categorie in ('bateau', 'bloc', 'detendeur', 'combinaison', 'recycleur', 'gilet', 'ordinateur', 'autre')),
  constraint materiel_articles_etat_check check (etat in ('ok', 'a_controler', 'en_reparation', 'hors_service')),
  constraint materiel_articles_reference_check check (char_length(btrim(reference)) between 1 and 40)
);
create index if not exists materiel_articles_centre_idx on public.materiel_articles (centre_id, categorie) where deleted_at is null;
create unique index if not exists materiel_articles_reference_idx on public.materiel_articles (centre_id, lower(reference)) where deleted_at is null;

grant select, insert, update, delete on public.materiel_articles to authenticated;
grant all on public.materiel_articles to service_role;
alter table public.materiel_articles enable row level security;
drop policy if exists "DP : lire l'inventaire" on public.materiel_articles;
create policy "DP : lire l'inventaire" on public.materiel_articles for select to authenticated using (public.est_dp_centre(centre_id));
drop policy if exists "DP : ajouter à l'inventaire" on public.materiel_articles;
create policy "DP : ajouter à l'inventaire" on public.materiel_articles for insert to authenticated with check (public.est_dp_centre(centre_id));
drop policy if exists "DP : modifier l'inventaire" on public.materiel_articles;
create policy "DP : modifier l'inventaire" on public.materiel_articles for update to authenticated
  using (public.est_dp_centre(centre_id)) with check (public.est_dp_centre(centre_id));
drop policy if exists "DP : retirer de l'inventaire" on public.materiel_articles;
create policy "DP : retirer de l'inventaire" on public.materiel_articles for delete to authenticated using (public.est_dp_centre(centre_id));

drop trigger if exists materiel_articles_updated_at on public.materiel_articles;
create trigger materiel_articles_updated_at before update on public.materiel_articles
  for each row execute function public.update_updated_at_column();


-- ============================================================
-- Palanote — Les formations du club (niveaux et certifications)
--
--   · Le catalogue du club : N1, N2, N3, N4, Nitrox, RIFAP… avec le tarif, le nombre de
--     cours théoriques et pratiques, les prérequis.
--   · La formation d'un élève : le cursus choisi, le moniteur de l'équipe qui en a la charge,
--     les dates, et ses séances jour par jour (pratique le matin et l'après-midi, théorie
--     entre midi et deux…). Les séances apparaissent sur le planning de travail du moniteur.
--   · Les rappels : l'élève est prévenu à la programmation, 3 jours puis la veille du début,
--     et la veille de chaque journée de cours ; le moniteur aussi.
--
-- Prérequis : palanote-planning-club.sql (centre_equipe, est_dp_centre),
--             palanote-import-excel.sql (centre_adherents) et palanote-rappels-dp.sql (rappel_une_fois).
-- À coller dans Supabase → SQL Editor → Run. Relançable sans risque.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Le catalogue du club
-- ------------------------------------------------------------
create table if not exists public.formations_catalogue (
  id uuid primary key default gen_random_uuid(),
  centre_id uuid not null references public.centres(id) on delete cascade,
  code text not null, -- « N2 », « Nitrox »…
  intitule text not null,
  organisme text not null default 'FFESSM',
  categorie text not null default 'niveau',
  prix numeric(7,2),
  nb_theorie integer not null default 0,
  nb_pratique integer not null default 0,
  prerequis text,
  description text,
  actif boolean not null default true,
  ordre integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint formations_catalogue_categorie_check check (categorie in ('niveau', 'gaz', 'encadrement', 'secourisme', 'specialite')),
  constraint formations_catalogue_nb_check check (nb_theorie between 0 and 60 and nb_pratique between 0 and 60)
);
create index if not exists formations_catalogue_centre_idx on public.formations_catalogue (centre_id, ordre);

-- ------------------------------------------------------------
-- 2. La formation d'un élève et ses séances
-- ------------------------------------------------------------
create table if not exists public.formations_eleves (
  id uuid primary key default gen_random_uuid(),
  centre_id uuid not null references public.centres(id) on delete cascade,
  catalogue_id uuid references public.formations_catalogue(id) on delete set null,
  intitule text not null, -- copié du catalogue (garde l'historique)
  adherent_id uuid references public.centre_adherents(id) on delete set null,
  eleve_id uuid references auth.users(id) on delete set null, -- son compte Palanote, s'il en a un
  eleve_nom text not null,
  moniteur_id uuid references public.centre_equipe(id) on delete set null,
  date_debut date not null,
  date_fin date not null,
  prix numeric(7,2),
  statut text not null default 'prevue',
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint formations_eleves_statut_check check (statut in ('prevue', 'en_cours', 'validee', 'abandon')),
  constraint formations_eleves_dates_check check (date_fin >= date_debut)
);
create index if not exists formations_eleves_centre_idx on public.formations_eleves (centre_id, date_debut);
create index if not exists formations_eleves_eleve_idx on public.formations_eleves (eleve_id);

create table if not exists public.formations_seances (
  id uuid primary key default gen_random_uuid(),
  formation_id uuid not null references public.formations_eleves(id) on delete cascade,
  type text not null,
  jour date not null,
  heure_debut time not null,
  heure_fin time,
  intitule text,
  lieu text,
  moniteur_id uuid references public.centre_equipe(id) on delete set null, -- sinon celui de la formation
  faite boolean not null default false,
  created_at timestamptz not null default now(),
  constraint formations_seances_type_check check (type in ('theorie', 'pratique'))
);
create index if not exists formations_seances_formation_idx on public.formations_seances (formation_id, jour, heure_debut);

-- Tout passe par les fonctions ci-dessous
alter table public.formations_catalogue enable row level security;
alter table public.formations_eleves enable row level security;
alter table public.formations_seances enable row level security;
grant all on public.formations_catalogue, public.formations_eleves, public.formations_seances to service_role;

drop trigger if exists formations_catalogue_updated_at on public.formations_catalogue;
create trigger formations_catalogue_updated_at before update on public.formations_catalogue for each row execute function public.update_updated_at_column();
drop trigger if exists formations_eleves_updated_at on public.formations_eleves;
create trigger formations_eleves_updated_at before update on public.formations_eleves for each row execute function public.update_updated_at_column();

-- ------------------------------------------------------------
-- 3. Catalogue : lire, enregistrer, retirer, catalogue type
-- ------------------------------------------------------------
create or replace function public.catalogue_formations(p_centre uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case when public.est_dp_centre(p_centre) then coalesce((
    select jsonb_agg(to_jsonb(f) - 'centre_id' - 'created_at' - 'updated_at'
             || jsonb_build_object('en_cours', (select count(*) from public.formations_eleves e
                                                 where e.catalogue_id = f.id and e.statut in ('prevue', 'en_cours')))
             order by f.ordre, f.code)
    from public.formations_catalogue f where f.centre_id = p_centre), '[]'::jsonb) else '[]'::jsonb end;
$$;
revoke all on function public.catalogue_formations(uuid) from public, anon;
grant execute on function public.catalogue_formations(uuid) to authenticated;

create or replace function public.enregistrer_formation_catalogue(p_centre uuid, p_formation jsonb)
returns uuid
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_id uuid := nullif(p_formation ->> 'id', '')::uuid;
begin
  if not public.est_dp_centre(p_centre) then raise exception 'réservé aux directeurs de plongée du centre'; end if;
  if nullif(btrim(p_formation ->> 'code'), '') is null or nullif(btrim(p_formation ->> 'intitule'), '') is null then
    raise exception 'le code et l''intitulé sont obligatoires';
  end if;
  if v_id is null then
    insert into public.formations_catalogue (centre_id, code, intitule, organisme, categorie, prix, nb_theorie, nb_pratique, prerequis, description, ordre)
    values (p_centre, left(btrim(p_formation ->> 'code'), 20), left(btrim(p_formation ->> 'intitule'), 80),
            coalesce(nullif(btrim(p_formation ->> 'organisme'), ''), 'FFESSM'), coalesce(nullif(p_formation ->> 'categorie', ''), 'niveau'),
            nullif(p_formation ->> 'prix', '')::numeric, coalesce(nullif(p_formation ->> 'nb_theorie', '')::int, 0),
            coalesce(nullif(p_formation ->> 'nb_pratique', '')::int, 0), nullif(btrim(p_formation ->> 'prerequis'), ''),
            nullif(btrim(p_formation ->> 'description'), ''),
            coalesce((select max(ordre) + 1 from public.formations_catalogue where centre_id = p_centre), 0))
    returning id into v_id;
  else
    update public.formations_catalogue set
      code = left(btrim(p_formation ->> 'code'), 20), intitule = left(btrim(p_formation ->> 'intitule'), 80),
      organisme = coalesce(nullif(btrim(p_formation ->> 'organisme'), ''), 'FFESSM'),
      categorie = coalesce(nullif(p_formation ->> 'categorie', ''), categorie),
      prix = nullif(p_formation ->> 'prix', '')::numeric,
      nb_theorie = coalesce(nullif(p_formation ->> 'nb_theorie', '')::int, 0), nb_pratique = coalesce(nullif(p_formation ->> 'nb_pratique', '')::int, 0),
      prerequis = nullif(btrim(p_formation ->> 'prerequis'), ''), description = nullif(btrim(p_formation ->> 'description'), ''),
      actif = coalesce((p_formation ->> 'actif')::boolean, actif)
    where id = v_id and centre_id = p_centre;
  end if;
  return v_id;
end;
$$;
revoke all on function public.enregistrer_formation_catalogue(uuid, jsonb) from public, anon;
grant execute on function public.enregistrer_formation_catalogue(uuid, jsonb) to authenticated;

create or replace function public.retirer_formation_catalogue(p_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_centre uuid;
begin
  select centre_id into v_centre from public.formations_catalogue where id = p_id;
  if v_centre is null or not public.est_dp_centre(v_centre) then raise exception 'réservé aux directeurs de plongée du centre'; end if;
  delete from public.formations_catalogue where id = p_id;
end;
$$;
revoke all on function public.retirer_formation_catalogue(uuid) from public, anon;
grant execute on function public.retirer_formation_catalogue(uuid) to authenticated;

-- Le catalogue type d'un club FFESSM (tarifs indicatifs, à adapter)
create or replace function public.catalogue_formations_type(p_centre uuid)
returns integer
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_nb integer;
begin
  if not public.est_dp_centre(p_centre) then raise exception 'réservé aux directeurs de plongée du centre'; end if;
  insert into public.formations_catalogue (centre_id, code, intitule, organisme, categorie, prix, nb_theorie, nb_pratique, prerequis, description, ordre)
  select p_centre, x.code, x.intitule, x.organisme, x.categorie, x.prix, x.th, x.pr, x.prerequis, x.description, x.ordre
  from (values
    ('N1', 'Plongeur Niveau 1 (PE12)', 'FFESSM', 'niveau', 420, 3, 6, '14 ans, certificat médical', 'Plonger encadré jusqu''à 20 m. Baptême, fosse puis mer.', 1),
    ('N2', 'Plongeur Niveau 2 (PE40 / PA20)', 'FFESSM', 'niveau', 590, 5, 8, 'N1, 16 ans, certificat médical', 'Autonome à 20 m, encadré jusqu''à 40 m.', 2),
    ('N3', 'Plongeur Niveau 3 (PA60)', 'FFESSM', 'niveau', 690, 6, 10, 'N2, 18 ans, certificat médical', 'Autonome jusqu''à 60 m.', 3),
    ('N4', 'Guide de palanquée (Niveau 4)', 'FFESSM', 'encadrement', 890, 10, 14, 'N3, RIFAP, 18 ans', 'Guider une palanquée, organiser la plongée.', 4),
    ('NX', 'Plongeur Nitrox', 'FFESSM', 'gaz', 160, 2, 2, 'N1 ou PE20', 'Mélanges jusqu''à 40 % d''oxygène.', 5),
    ('NXC', 'Plongeur Nitrox confirmé', 'FFESSM', 'gaz', 280, 3, 3, 'N2 et Nitrox', 'Tous mélanges suroxygénés, décompression à l''oxygène.', 6),
    ('TX', 'Trimix élémentaire', 'FFESSM', 'gaz', 450, 4, 4, 'N3 et Nitrox confirmé', 'Mélanges ternaires jusqu''à 70 m.', 7),
    ('RIFAP', 'Réaction et intervention face à un accident de plongée', 'FFESSM', 'secourisme', 110, 2, 2, 'N1', 'Secourisme spécifique à la plongée.', 8),
    ('E1', 'Initiateur (E1)', 'FFESSM', 'encadrement', 350, 6, 6, 'N2, RIFAP, 18 ans', 'Enseigner en piscine et à 6 m.', 9),
    ('CCR', 'Recycleur (initiation)', 'Fabricant', 'specialite', 650, 4, 6, 'N2 et Nitrox confirmé', 'Plongée en circuit fermé électronique.', 10)
  ) as x(code, intitule, organisme, categorie, prix, th, pr, prerequis, description, ordre)
  where not exists (select 1 from public.formations_catalogue f where f.centre_id = p_centre and lower(f.code) = lower(x.code));
  get diagnostics v_nb = row_count;
  return v_nb;
end;
$$;
revoke all on function public.catalogue_formations_type(uuid) from public, anon;
grant execute on function public.catalogue_formations_type(uuid) to authenticated;

-- ------------------------------------------------------------
-- 4. Les élèves en formation
-- ------------------------------------------------------------
create or replace function public.ligne_formation(p_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select to_jsonb(e) - 'centre_id' - 'created_at' - 'updated_at'
    || jsonb_build_object(
      'code', (select code from public.formations_catalogue c where c.id = e.catalogue_id),
      'moniteur', (select jsonb_build_object('id', q.id, 'nom', q.nom, 'niveau', q.niveau) from public.centre_equipe q where q.id = e.moniteur_id),
      'eleve_niveau', coalesce((select a.niveau from public.centre_adherents a where a.id = e.adherent_id), public.infos_plongeur(e.eleve_id) ->> 'niveau'),
      'seances', coalesce((
        select jsonb_agg(jsonb_build_object('id', s.id, 'type', s.type, 'jour', s.jour, 'heure_debut', to_char(s.heure_debut, 'HH24:MI'),
                                            'heure_fin', to_char(s.heure_fin, 'HH24:MI'), 'intitule', s.intitule, 'lieu', s.lieu, 'faite', s.faite,
                                            'moniteur', (select q.nom from public.centre_equipe q where q.id = coalesce(s.moniteur_id, e.moniteur_id)))
                         order by s.jour, s.heure_debut)
        from public.formations_seances s where s.formation_id = e.id), '[]'::jsonb))
  from public.formations_eleves e where e.id = p_id;
$$;
revoke all on function public.ligne_formation(uuid) from public, anon, authenticated;

create or replace function public.formations_centre(p_centre uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case when public.est_dp_centre(p_centre) then coalesce((
    select jsonb_agg(public.ligne_formation(e.id) order by (e.statut in ('validee', 'abandon')), e.date_debut)
    from public.formations_eleves e where e.centre_id = p_centre), '[]'::jsonb) else '[]'::jsonb end;
$$;
revoke all on function public.formations_centre(uuid) from public, anon;
grant execute on function public.formations_centre(uuid) to authenticated;

-- Texte d'une journée de cours : « 9h00 pratique · 12h30 théorie · 14h00 pratique »
create or replace function public.texte_journee_formation(p_formation uuid, p_jour date)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select string_agg(to_char(s.heure_debut, 'HH24"h"MI') || ' ' || case s.type when 'theorie' then 'théorie' else 'pratique' end
                    || coalesce(' (' || s.intitule || ')', ''), ' · ' order by s.heure_debut)
  from public.formations_seances s where s.formation_id = p_formation and s.jour = p_jour;
$$;
revoke all on function public.texte_journee_formation(uuid, date) from public, anon, authenticated;

-- Programmer la formation d'un élève, avec ses séances
create or replace function public.programmer_formation(p_centre uuid, p_formation jsonb, p_seances jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_id uuid := nullif(p_formation ->> 'id', '')::uuid;
  v_cat public.formations_catalogue;
  v_adh public.centre_adherents;
  v_moniteur uuid := nullif(p_formation ->> 'moniteur_id', '')::uuid;
  v_eleve uuid;
  v_nom text;
  v_debut date;
  v_fin date;
  v_nouvelle boolean := v_id is null;
  s jsonb;
  v_mon_user uuid;
  v_club text;
begin
  if not public.est_dp_centre(p_centre) then raise exception 'réservé aux directeurs de plongée du centre'; end if;
  select * into v_cat from public.formations_catalogue where id = nullif(p_formation ->> 'catalogue_id', '')::uuid and centre_id = p_centre;
  if v_cat.id is null then raise exception 'choisis une formation du catalogue'; end if;
  select * into v_adh from public.centre_adherents where id = nullif(p_formation ->> 'adherent_id', '')::uuid and centre_id = p_centre;
  if v_adh.id is null then raise exception 'choisis l''élève parmi les membres du club'; end if;
  if v_moniteur is not null and not exists (select 1 from public.centre_equipe where id = v_moniteur and centre_id = p_centre) then v_moniteur := null; end if;
  v_eleve := v_adh.user_id;
  v_nom := concat_ws(' ', v_adh.prenom, v_adh.nom);
  select min((x ->> 'jour')::date), max((x ->> 'jour')::date) into v_debut, v_fin from jsonb_array_elements(coalesce(p_seances, '[]'::jsonb)) x;
  v_debut := coalesce(nullif(p_formation ->> 'date_debut', '')::date, v_debut);
  v_fin := greatest(coalesce(v_fin, v_debut), coalesce(nullif(p_formation ->> 'date_fin', '')::date, v_debut));
  if v_debut is null then raise exception 'indique la date de début'; end if;

  if v_nouvelle then
    insert into public.formations_eleves (centre_id, catalogue_id, intitule, adherent_id, eleve_id, eleve_nom, moniteur_id, date_debut, date_fin, prix, note)
    values (p_centre, v_cat.id, v_cat.intitule, v_adh.id, v_eleve, v_nom, v_moniteur, v_debut, v_fin,
            coalesce(nullif(p_formation ->> 'prix', '')::numeric, v_cat.prix), nullif(btrim(p_formation ->> 'note'), ''))
    returning id into v_id;
  else
    update public.formations_eleves set catalogue_id = v_cat.id, intitule = v_cat.intitule, adherent_id = v_adh.id, eleve_id = v_eleve,
      eleve_nom = v_nom, moniteur_id = v_moniteur, date_debut = v_debut, date_fin = v_fin,
      prix = coalesce(nullif(p_formation ->> 'prix', '')::numeric, prix), note = nullif(btrim(p_formation ->> 'note'), '')
    where id = v_id and centre_id = p_centre;
    delete from public.formations_seances where formation_id = v_id and not faite;
  end if;
  for s in select * from jsonb_array_elements(coalesce(p_seances, '[]'::jsonb)) loop
    continue when (s ->> 'id') is not null and exists (select 1 from public.formations_seances where id = (s ->> 'id')::uuid and faite);
    insert into public.formations_seances (formation_id, type, jour, heure_debut, heure_fin, intitule, lieu)
    values (v_id, case when s ->> 'type' = 'theorie' then 'theorie' else 'pratique' end, (s ->> 'jour')::date,
            coalesce(nullif(s ->> 'heure_debut', '')::time, '09:00'), nullif(s ->> 'heure_fin', '')::time,
            nullif(btrim(left(s ->> 'intitule', 80)), ''), nullif(btrim(left(s ->> 'lieu', 80)), ''));
  end loop;

  -- On prévient l'élève (s'il a un compte) et le moniteur
  select nom into v_club from public.centres where id = p_centre;
  if v_eleve is not null then
    perform public.notifier(v_eleve, 'formation_programmee',
      case when v_nouvelle then 'Ta formation ' || v_cat.code || ' est programmée' else 'Ta formation ' || v_cat.code || ' a changé' end,
      v_cat.intitule || ' avec ' || v_club || ', du ' || public.date_fr(v_debut) || ' au ' || public.date_fr(v_fin)
        || ' · ' || (select count(*) from public.formations_seances where formation_id = v_id) || ' séances.',
      '/moi/formation', jsonb_build_object('formation_id', v_id));
  end if;
  select user_id into v_mon_user from public.centre_equipe where id = v_moniteur;
  if v_mon_user is not null and v_mon_user <> auth.uid() then
    perform public.notifier(v_mon_user, 'formation_moniteur', 'Tu encadres la formation ' || v_cat.code || ' de ' || v_adh.prenom,
      'Du ' || public.date_fr(v_debut) || ' au ' || public.date_fr(v_fin) || ' : les séances sont sur ton planning.',
      '/club/formations', jsonb_build_object('formation_id', v_id));
  end if;
  return public.ligne_formation(v_id);
end;
$$;
revoke all on function public.programmer_formation(uuid, jsonb, jsonb) from public, anon;
grant execute on function public.programmer_formation(uuid, jsonb, jsonb) to authenticated;

-- Le DP fait avancer la formation : séance faite, statut (validée = brevet obtenu), moniteur
create or replace function public.modifier_formation(p_formation uuid, p_statut text default null, p_moniteur uuid default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  e public.formations_eleves;
begin
  select * into e from public.formations_eleves where id = p_formation;
  if not found or not public.est_dp_centre(e.centre_id) then raise exception 'réservé aux directeurs de plongée du centre'; end if;
  update public.formations_eleves set
    statut = coalesce(nullif(p_statut, ''), statut),
    moniteur_id = coalesce(p_moniteur, moniteur_id)
  where id = p_formation;
  if p_statut = 'validee' and e.statut <> 'validee' and e.eleve_id is not null then
    perform public.notifier(e.eleve_id, 'formation_validee', 'Bravo, formation validée !',
      e.intitule || ' : le club a validé ta formation. Ajoute ta carte à ton passeport dès que tu l''as.',
      '/moi/passeport', jsonb_build_object('formation_id', e.id));
  end if;
  return public.ligne_formation(p_formation);
end;
$$;
revoke all on function public.modifier_formation(uuid, text, uuid) from public, anon;
grant execute on function public.modifier_formation(uuid, text, uuid) to authenticated;

create or replace function public.cocher_seance(p_seance uuid, p_faite boolean)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_centre uuid;
begin
  select e.centre_id into v_centre from public.formations_seances s join public.formations_eleves e on e.id = s.formation_id where s.id = p_seance;
  if v_centre is null or not public.est_dp_centre(v_centre) then raise exception 'réservé aux directeurs de plongée du centre'; end if;
  update public.formations_seances set faite = p_faite where id = p_seance;
  -- La formation passe « en cours » dès la première séance faite
  update public.formations_eleves e set statut = 'en_cours'
  where e.id = (select formation_id from public.formations_seances where id = p_seance) and e.statut = 'prevue' and p_faite;
end;
$$;
revoke all on function public.cocher_seance(uuid, boolean) from public, anon;
grant execute on function public.cocher_seance(uuid, boolean) to authenticated;

create or replace function public.supprimer_formation(p_formation uuid)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  e public.formations_eleves;
begin
  select * into e from public.formations_eleves where id = p_formation;
  if not found or not public.est_dp_centre(e.centre_id) then raise exception 'réservé aux directeurs de plongée du centre'; end if;
  delete from public.formations_eleves where id = p_formation;
  if e.eleve_id is not null and e.date_fin >= current_date then
    perform public.notifier(e.eleve_id, 'formation_annulee', 'Formation annulée', e.intitule || ' du ' || public.date_fr(e.date_debut) || ' est annulée. Le club te recontactera.',
      '/moi/formation', '{}'::jsonb);
  end if;
end;
$$;
revoke all on function public.supprimer_formation(uuid) from public, anon;
grant execute on function public.supprimer_formation(uuid) to authenticated;

-- Les séances d'une période (planning de travail de l'équipe)
create or replace function public.seances_centre(p_centre uuid, p_debut date, p_fin date)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case when public.est_dp_centre(p_centre) then coalesce((
    select jsonb_agg(jsonb_build_object('id', s.id, 'formation_id', e.id, 'code', coalesce(c.code, e.intitule), 'eleve', e.eleve_nom,
                                        'type', s.type, 'jour', s.jour, 'heure_debut', to_char(s.heure_debut, 'HH24:MI'),
                                        'heure_fin', to_char(s.heure_fin, 'HH24:MI'), 'moniteur_id', coalesce(s.moniteur_id, e.moniteur_id))
                     order by s.jour, s.heure_debut)
    from public.formations_seances s join public.formations_eleves e on e.id = s.formation_id
    left join public.formations_catalogue c on c.id = e.catalogue_id
    where e.centre_id = p_centre and e.statut <> 'abandon' and s.jour between p_debut and p_fin), '[]'::jsonb) else '[]'::jsonb end;
$$;
revoke all on function public.seances_centre(uuid, date, date) from public, anon;
grant execute on function public.seances_centre(uuid, date, date) to authenticated;

-- ------------------------------------------------------------
-- 5. Côté élève : ses formations et son programme
-- ------------------------------------------------------------
create or replace function public.mes_formations()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(public.ligne_formation(e.id) || jsonb_build_object('club', c.nom) order by e.date_debut desc), '[]'::jsonb)
  from public.formations_eleves e join public.centres c on c.id = e.centre_id
  where e.eleve_id = auth.uid()
     or e.adherent_id in (select a.id from public.centre_adherents a where a.user_id = auth.uid());
$$;
revoke all on function public.mes_formations() from public, anon;
grant execute on function public.mes_formations() to authenticated;

-- ------------------------------------------------------------
-- 6. Les rappels (créés quand l'élève ou le moniteur ouvre l'app, une seule fois chacun)
-- ------------------------------------------------------------
create or replace function public.generer_rappels_formations()
returns integer
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_moi uuid := auth.uid();
  v_nb integer := 0;
  f record;
  j record;
begin
  if v_moi is null then return 0; end if;

  -- L'élève : 3 jours avant, la veille, puis la veille (ou le matin) de chaque journée de cours
  for f in select e.*, coalesce(c.code, e.intitule) as code_f, ce.nom as club
           from public.formations_eleves e
           join public.centres ce on ce.id = e.centre_id
           left join public.formations_catalogue c on c.id = e.catalogue_id
           where e.statut in ('prevue', 'en_cours') and e.date_fin >= current_date
             and (e.eleve_id = v_moi or e.adherent_id in (select a.id from public.centre_adherents a where a.user_id = v_moi)) loop
    if f.date_debut - current_date between 2 and 3 then
      v_nb := v_nb + public.rappel_une_fois(v_moi, 'formation-j3:' || f.id, 'formation_rappel',
        'Ta formation ' || f.code_f || ' commence dans ' || (f.date_debut - current_date) || ' jours',
        f.intitule || ' avec ' || f.club || ', du ' || public.date_fr(f.date_debut) || ' au ' || public.date_fr(f.date_fin)
          || '. Pense à ton certificat médical et à ton matériel.', '/moi/formation', jsonb_build_object('formation_id', f.id));
    end if;
    for j in select distinct s.jour from public.formations_seances s
             where s.formation_id = f.id and s.jour between current_date and current_date + 1 and not s.faite loop
      v_nb := v_nb + public.rappel_une_fois(v_moi, 'formation-jour:' || f.id || ':' || j.jour, 'formation_rappel',
        case when j.jour = current_date then 'Aujourd''hui' else 'Demain' end || ' : formation ' || f.code_f
          || case when j.jour = f.date_debut then ' (premier jour)' else '' end,
        public.texte_journee_formation(f.id, j.jour) || '.', '/moi/formation', jsonb_build_object('formation_id', f.id));
    end loop;
  end loop;

  -- Le moniteur : la veille de chaque journée où il encadre
  for f in select e.*, coalesce(c.code, e.intitule) as code_f
           from public.formations_eleves e
           left join public.formations_catalogue c on c.id = e.catalogue_id
           where e.statut in ('prevue', 'en_cours') and e.date_fin >= current_date
             and exists (select 1 from public.centre_equipe q where q.user_id = v_moi
                         and q.id in (select coalesce(s.moniteur_id, e.moniteur_id) from public.formations_seances s where s.formation_id = e.id)) loop
    for j in select distinct s.jour from public.formations_seances s
             where s.formation_id = f.id and s.jour between current_date and current_date + 1 and not s.faite loop
      v_nb := v_nb + public.rappel_une_fois(v_moi, 'formation-moniteur:' || f.id || ':' || j.jour, 'formation_rappel',
        case when j.jour = current_date then 'Aujourd''hui' else 'Demain' end || ' tu encadres ' || f.code_f || ' · ' || f.eleve_nom,
        public.texte_journee_formation(f.id, j.jour) || '.', '/club/formations', jsonb_build_object('formation_id', f.id));
    end loop;
  end loop;
  return v_nb;
end;
$$;
revoke all on function public.generer_rappels_formations() from public, anon;
grant execute on function public.generer_rappels_formations() to authenticated;


-- Palanote — Le profil fait foi partout
-- Quand un plongeur ou un DP change son prénom, son nom, son niveau ou la fin de
-- son certificat médical dans « Mon profil », la copie gardée par chaque club suit :
--   · centre_equipe   (l'équipe : DP, guides, moniteurs des formations)
--   · centre_adherents (les membres du club, reliés à son compte)
-- Script autonome et rejouable. À lancer dans le SQL Editor de Supabase.

create or replace function public.propager_profil()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prenom text := coalesce(nullif(btrim(new.first_name), ''), nullif(btrim(new.prenom), ''));
  v_nom text := nullif(btrim(new.nom), '');
begin
  -- Niveau
  if new.niveau is distinct from old.niveau then
    update public.centre_equipe set niveau = nullif(btrim(new.niveau), ''), updated_at = now()
     where user_id = new.id and niveau is distinct from nullif(btrim(new.niveau), '');
    update public.centre_adherents set niveau = nullif(btrim(new.niveau), ''), updated_at = now()
     where user_id = new.id and niveau is distinct from nullif(btrim(new.niveau), '');
  end if;

  -- Prénom et nom
  if v_prenom is not null
     and (new.first_name is distinct from old.first_name or new.prenom is distinct from old.prenom or new.nom is distinct from old.nom) then
    update public.centre_equipe set nom = btrim(v_prenom || ' ' || coalesce(v_nom, '')), updated_at = now()
     where user_id = new.id and nom is distinct from btrim(v_prenom || ' ' || coalesce(v_nom, ''));
    update public.centre_adherents set prenom = v_prenom, nom = coalesce(v_nom, nom), updated_at = now()
     where user_id = new.id and (prenom is distinct from v_prenom or (v_nom is not null and nom is distinct from v_nom));
  end if;

  -- Certificat médical : seulement une date renseignée (on n'efface pas celle du club)
  if new.certificat_fin is not null and new.certificat_fin is distinct from old.certificat_fin then
    update public.centre_adherents set certificat_fin = new.certificat_fin, updated_at = now()
     where user_id = new.id and certificat_fin is distinct from new.certificat_fin;
  end if;

  return new;
end;
$$;
revoke all on function public.propager_profil() from public, anon, authenticated;

drop trigger if exists profiles_propager on public.profiles;
create trigger profiles_propager after update on public.profiles
  for each row execute function public.propager_profil();

-- Les DP qui entrent dans l'équipe prennent le nom complet du profil
create or replace function public.synchroniser_equipe(p_centre uuid)
returns void
language sql
volatile
security definer
set search_path = public
as $$
  insert into public.centre_equipe (centre_id, user_id, nom, role, niveau)
  select m.centre_id, m.user_id,
         btrim((public.infos_plongeur(m.user_id) ->> 'prenom') || ' ' || coalesce((select nullif(btrim(p.nom), '') from public.profiles p where p.id = m.user_id), '')),
         'dp', public.infos_plongeur(m.user_id) ->> 'niveau'
  from public.centre_membres m
  where m.centre_id = p_centre and m.role = 'dp'
  on conflict (centre_id, user_id) do nothing;
$$;
revoke all on function public.synchroniser_equipe(uuid) from public, anon, authenticated;

-- Rattrapage : les copies déjà décalées reprennent les valeurs du profil
update public.centre_equipe e
   set niveau = btrim(p.niveau), updated_at = now()
  from public.profiles p
 where e.user_id = p.id and nullif(btrim(p.niveau), '') is not null and e.niveau is distinct from btrim(p.niveau);

update public.centre_equipe e
   set nom = btrim(coalesce(nullif(btrim(p.first_name), ''), nullif(btrim(p.prenom), '')) || ' ' || coalesce(nullif(btrim(p.nom), ''), '')), updated_at = now()
  from public.profiles p
 where e.user_id = p.id
   and coalesce(nullif(btrim(p.first_name), ''), nullif(btrim(p.prenom), '')) is not null
   and e.nom is distinct from btrim(coalesce(nullif(btrim(p.first_name), ''), nullif(btrim(p.prenom), '')) || ' ' || coalesce(nullif(btrim(p.nom), ''), ''));

update public.centre_adherents a
   set niveau = btrim(p.niveau), updated_at = now()
  from public.profiles p
 where a.user_id = p.id and nullif(btrim(p.niveau), '') is not null and a.niveau is distinct from btrim(p.niveau);

update public.centre_adherents a
   set certificat_fin = p.certificat_fin, updated_at = now()
  from public.profiles p
 where a.user_id = p.id and p.certificat_fin is not null and (a.certificat_fin is null or a.certificat_fin < p.certificat_fin);


-- Palanote — Le site internet du club (offre Starter)
-- Un site vitrine public, généré depuis les données du back-office :
-- tarifs (baptême, niveaux, plongées), formations, zones de plongée, bateau et matériel, équipe, infos pratiques.
-- Le DP règle l'apparence (modèle, couleurs, logo, photo) et les textes dans « Mon site ».
-- Adresse publique : /clubs/<adresse-du-club>
-- Script autonome et rejouable. À lancer dans le SQL Editor de Supabase.

-- ------------------------------------------------------------
-- 1. Le site du club
-- ------------------------------------------------------------
create table if not exists public.club_sites (
  centre_id uuid primary key references public.centres(id) on delete cascade,
  slug text not null unique,
  publie boolean not null default false,
  offre text not null default 'starter',
  modele text not null default 'lagon',
  couleur_accent text not null default '#14B8C4',
  couleur_secondaire text not null default '#0B3B63',
  couleur_tertiaire text not null default '#FF8A75',
  couleur_fond text not null default '#F4F8FB',
  couleur_texte text not null default '#10263F',
  logo_url text,
  couverture_url text,
  accroche text,
  sous_titre text,
  presentation text,
  atouts jsonb not null default '[]'::jsonb,
  zones jsonb not null default '[]'::jsonb,
  adresse text,
  telephone text,
  email text,
  horaires text,
  saison text,
  infos text,
  sections jsonb not null default '{"tarifs": true, "formations": true, "zones": true, "materiel": true, "equipe": true, "infos": true}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint club_sites_slug_check check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) between 3 and 60),
  constraint club_sites_offre_check check (offre in ('starter', 'premium', 'advanced')),
  constraint club_sites_couleurs_check check (
    couleur_accent ~ '^#[0-9A-Fa-f]{6}$' and couleur_secondaire ~ '^#[0-9A-Fa-f]{6}$' and couleur_tertiaire ~ '^#[0-9A-Fa-f]{6}$'
    and couleur_fond ~ '^#[0-9A-Fa-f]{6}$' and couleur_texte ~ '^#[0-9A-Fa-f]{6}$')
);
alter table public.club_sites enable row level security; -- lecture et écriture par les fonctions ci-dessous

-- Les tarifs affichés en haut du site (ajout du 14 octobre) : le baptême à côté des niveaux,
-- puis les plongées (encadrée, exploration, épave). Les prix des niveaux viennent du catalogue Formations.
alter table public.club_sites add column if not exists tarifs jsonb not null default
  '[{"libelle": "Baptême de plongée", "detail": "Votre première plongée, en mer, avec un moniteur. Matériel compris.", "prix": 60, "groupe": "formation"},
    {"libelle": "Plongée encadrée", "detail": "Avec un guide de palanquée, pour les plongeurs N1 et plus.", "prix": 50, "groupe": "plongee"},
    {"libelle": "Plongée d''exploration", "detail": "Pour les plongeurs autonomes, à partir du N2.", "prix": 40, "groupe": "plongee"},
    {"libelle": "Plongée épave", "detail": "Les épaves de la région, selon votre niveau.", "prix": 55, "groupe": "plongee"}]'::jsonb;
update public.club_sites set sections = jsonb_build_object('tarifs', true) || sections where not sections ? 'tarifs';

-- Les chiffres clés et la note Google (ajout du 14 octobre).
-- La note Google est saisie par le club (avec le lien vers sa fiche, pour que chacun vérifie).
alter table public.club_sites add column if not exists annee_creation integer;
alter table public.club_sites add column if not exists satisfaction integer;
alter table public.club_sites add column if not exists note_google numeric(2,1);
alter table public.club_sites add column if not exists nb_avis_google integer;
alter table public.club_sites add column if not exists lien_google text;
alter table public.club_sites add column if not exists chiffres jsonb not null default '["annees", "encadrants", "satisfaction", "sites"]'::jsonb;
alter table public.club_sites drop constraint if exists club_sites_chiffres_check;
alter table public.club_sites add constraint club_sites_chiffres_check check (
  (annee_creation is null or annee_creation between 1900 and 2100)
  and (satisfaction is null or satisfaction between 0 and 100)
  and (note_google is null or note_google between 1 and 5)
  and (nb_avis_google is null or nb_avis_google >= 0)
  and (lien_google is null or lien_google ~* '^https?://'));

drop trigger if exists club_sites_updated_at on public.club_sites;
create trigger club_sites_updated_at before update on public.club_sites
  for each row execute function public.update_updated_at_column();

-- ------------------------------------------------------------
-- 2. Le logo et la photo de couverture (lecture publique)
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('sites-clubs', 'sites-clubs', true, 5242880, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update set public = true, file_size_limit = 5242880, allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp'];

-- Le dossier porte l'identifiant du centre : seuls ses DP y déposent
drop policy if exists "Sites clubs : lecture" on storage.objects;
create policy "Sites clubs : lecture" on storage.objects for select
  using (bucket_id = 'sites-clubs');
drop policy if exists "Sites clubs : dépôt par les DP" on storage.objects;
create policy "Sites clubs : dépôt par les DP" on storage.objects for insert to authenticated
  with check (bucket_id = 'sites-clubs' and public.est_dp_centre(((storage.foldername(name))[1])::uuid));
drop policy if exists "Sites clubs : remplacement par les DP" on storage.objects;
create policy "Sites clubs : remplacement par les DP" on storage.objects for update to authenticated
  using (bucket_id = 'sites-clubs' and public.est_dp_centre(((storage.foldername(name))[1])::uuid));
drop policy if exists "Sites clubs : suppression par les DP" on storage.objects;
create policy "Sites clubs : suppression par les DP" on storage.objects for delete to authenticated
  using (bucket_id = 'sites-clubs' and public.est_dp_centre(((storage.foldername(name))[1])::uuid));

-- ------------------------------------------------------------
-- 3. Outils
-- ------------------------------------------------------------
-- « Centre de plongée le Lion » → « centre-de-plongee-le-lion »
create or replace function public.slug_texte(p text)
returns text
language sql
immutable
set search_path = public
as $$
  select trim(both '-' from regexp_replace(
    lower(translate(coalesce(p, ''),
      'ÀÁÂÃÄÅàáâãäåÇçÈÉÊËèéêëÌÍÎÏìíîïÑñÒÓÔÕÖòóôõöÙÚÛÜùúûüÝýÿŒœÆæ''’',
      'AAAAAAaaaaaaCcEEEEeeeeIIIIiiiiNnOOOOOoooooUUUUuuuuYyyOoAa--')),
    '[^a-z0-9]+', '-', 'g'));
$$;

-- Les zones déjà plongées par le club (sorties passées), pour pré-remplir
create or replace function public.zones_depuis_sorties(p_centre uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'nom', z.nom, 'profondeur', z.prof, 'niveau', '', 'description', coalesce(z.lieu, ''))
           order by z.nb desc), '[]'::jsonb)
  from (
    select min(s.site_name) as nom, max(s.profondeur_prevue) as prof, min(s.site_location) as lieu, count(*) as nb
    from public.sorties s
    where s.centre_id = p_centre and s.deleted_at is null and s.statut <> 'annulee' and btrim(s.site_name) <> ''
    group by lower(btrim(s.site_name))
    order by count(*) desc
    limit 12
  ) z;
$$;
revoke all on function public.zones_depuis_sorties(uuid) from public, anon, authenticated;

-- Ce que le site affiche : réglages du site + données vivantes du back-office
create or replace function public.contenu_site_club(p_centre uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_formations jsonb := '[]'::jsonb;
  v_bateaux jsonb := '[]'::jsonb;
  v_equipement jsonb := '[]'::jsonb;
  v_equipe jsonb;
begin
  -- Formations actives, avec leurs tarifs (si l'espace Formations est installé)
  if to_regclass('public.formations_catalogue') is not null then
    execute $f$
      -- Toute la fiche (tarif, cours, objectifs, contenu, prérogatives…), sans les champs internes
      select coalesce(jsonb_agg(to_jsonb(f) - array['id', 'centre_id', 'actif', 'ordre', 'created_at', 'updated_at']
               order by f.ordre, f.code), '[]'::jsonb)
      from public.formations_catalogue f where f.centre_id = $1 and f.actif$f$
      into v_formations using p_centre;
  end if;

  -- Bateaux et matériel : des familles et des quantités, jamais de numéros de série
  if to_regclass('public.materiel_articles') is not null then
    execute $f$
      select coalesce(jsonb_agg(jsonb_build_object(
               'nom', coalesce(a.libelle, a.reference), 'modele', nullif(btrim(concat_ws(' ', a.marque, a.modele)), ''),
               'type', a.caracteristiques ->> 'type', 'places', a.caracteristiques ->> 'places',
               'longueur', a.caracteristiques ->> 'longueur', 'moteur', a.caracteristiques ->> 'moteur',
               'port', a.caracteristiques ->> 'port_attache', 'oxygene', a.caracteristiques ->> 'oxygene') order by a.reference), '[]'::jsonb)
      from public.materiel_articles a
      where a.centre_id = $1 and a.deleted_at is null and a.categorie = 'bateau' and a.etat <> 'hors_service'$f$
      into v_bateaux using p_centre;

    execute $f$
      select coalesce(jsonb_agg(jsonb_build_object('categorie', x.categorie, 'variante', x.variante, 'nb', x.nb)
               order by array_position(array['bloc','detendeur','combinaison','gilet','ordinateur','recycleur','autre'], x.categorie), x.variante), '[]'::jsonb)
      from (
        select a.categorie,
               coalesce(case a.categorie
                          when 'bloc' then a.caracteristiques ->> 'volume'
                          when 'detendeur' then a.caracteristiques ->> 'raccord'
                          else a.caracteristiques ->> 'type' end, '') as variante,
               count(*) as nb
        from public.materiel_articles a
        where a.centre_id = $1 and a.deleted_at is null and a.categorie <> 'bateau' and a.etat <> 'hors_service'
          and coalesce(a.caracteristiques ->> 'usage', '') <> 'Recycleur'
        group by 1, 2
      ) x$f$
      into v_equipement using p_centre;
  end if;

  -- Bateaux déclarés seulement dans le planning (sans inventaire détaillé)
  if v_bateaux = '[]'::jsonb then
    select coalesce(jsonb_agg(jsonb_build_object('nom', m.libelle, 'places', case when m.places is not null then m.places || ' plongeurs' end)), '[]'::jsonb)
      into v_bateaux
      from public.materiel m where m.centre_id = p_centre and m.deleted_at is null and m.type = 'bateau';
  end if;

  -- L'équipe encadrante (nom, rôle, niveau : rien d'autre)
  select coalesce(jsonb_agg(jsonb_build_object('nom', e.nom, 'role', e.role, 'niveau', e.niveau)
           order by array_position(array['dp','guide','pilote','gonfleur','autre'], e.role), e.nom), '[]'::jsonb)
    into v_equipe
    from public.centre_equipe e
   where e.centre_id = p_centre and e.actif and e.role in ('dp', 'guide', 'pilote');

  return (
    select jsonb_build_object(
      -- Jamais d'informations de paiement ni de jeton de vérification sur le site public
      'site', to_jsonb(s) - array['created_at', 'stripe_client', 'stripe_abonnement', 'domaine_jeton', 'abonnement_fin'],
      'centre', jsonb_build_object('nom', c.nom, 'ville', c.ville, 'verifie', c.verifie),
      'formations', v_formations,
      'bateaux', v_bateaux,
      'equipement', v_equipement,
      'equipe', v_equipe)
    from public.club_sites s join public.centres c on c.id = s.centre_id
    where s.centre_id = p_centre);
end;
$$;
revoke all on function public.contenu_site_club(uuid) from public, anon, authenticated;

-- ------------------------------------------------------------
-- 4. Côté public : le site, par son adresse
-- ------------------------------------------------------------
create or replace function public.site_club_public(p_slug text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_site public.club_sites;
begin
  select * into v_site from public.club_sites where slug = lower(btrim(p_slug));
  if not found then return null; end if;
  -- Pas encore publié : visible seulement par les DP du club (aperçu)
  if not v_site.publie and not public.est_dp_centre(v_site.centre_id) then return null; end if;
  return public.contenu_site_club(v_site.centre_id);
end;
$$;
revoke all on function public.site_club_public(text) from public;
grant execute on function public.site_club_public(text) to anon, authenticated;

-- ------------------------------------------------------------
-- 5. Côté DP : « Mon site »
-- ------------------------------------------------------------
create or replace function public.mon_site_club(p_centre uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_nom text;
  v_ville text;
  v_slug text;
  v_n integer := 1;
begin
  if not public.est_dp_centre(p_centre) then raise exception 'réservé aux directeurs de plongée du centre'; end if;

  -- Premier passage : le site est créé (non publié), pré-rempli avec ce que le club sait déjà
  if not exists (select 1 from public.club_sites where centre_id = p_centre) then
    select nom, ville into v_nom, v_ville from public.centres where id = p_centre;
    v_slug := left(public.slug_texte(v_nom), 50);
    if length(v_slug) < 3 then v_slug := 'club-' || left(p_centre::text, 8); end if;
    while exists (select 1 from public.club_sites where slug = v_slug || case when v_n > 1 then '-' || v_n else '' end) loop
      v_n := v_n + 1;
    end loop;
    insert into public.club_sites (centre_id, slug, accroche, sous_titre, presentation, atouts, zones, saison, infos)
    values (p_centre, v_slug || case when v_n > 1 then '-' || v_n else '' end,
      'Plongez avec ' || v_nom,
      'Club de plongée' || coalesce(' à ' || nullif(btrim(v_ville), ''), '') || ' · baptêmes, formations et explorations',
      'Notre équipe de moniteurs vous accueille pour découvrir la plongée, passer vos niveaux et explorer les plus beaux sites de la région, en petit groupe et en toute sécurité.',
      '[{"titre": "Encadrement diplômé", "texte": "Des moniteurs et des directeurs de plongée qualifiés à chaque sortie."},
        {"titre": "Petits groupes", "texte": "Des palanquées réduites, pour profiter pleinement de chaque plongée."},
        {"titre": "Matériel entretenu", "texte": "Blocs, détendeurs et combinaisons contrôlés et révisés chaque saison."}]'::jsonb,
      public.zones_depuis_sorties(p_centre),
      'D''avril à novembre',
      'Certificat médical d''absence de contre-indication à la plongée obligatoire pour les formations. Pensez à apporter votre maillot, une serviette et votre carnet de plongée.');
  end if;

  return public.contenu_site_club(p_centre)
    || jsonb_build_object('zones_sorties', public.zones_depuis_sorties(p_centre));
end;
$$;
revoke all on function public.mon_site_club(uuid) from public, anon;
grant execute on function public.mon_site_club(uuid) to authenticated;

create or replace function public.enregistrer_site_club(p_centre uuid, p jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_slug text := left(public.slug_texte(p ->> 'slug'), 60);
  t text;
begin
  if not public.est_dp_centre(p_centre) then raise exception 'réservé aux directeurs de plongée du centre'; end if;
  if length(v_slug) < 3 then raise exception 'adresse trop courte : 3 caractères au moins'; end if;
  if exists (select 1 from public.club_sites where slug = v_slug and centre_id <> p_centre) then
    raise exception 'adresse déjà prise par un autre club';
  end if;
  foreach t in array array['couleur_accent', 'couleur_secondaire', 'couleur_tertiaire', 'couleur_fond', 'couleur_texte'] loop
    if p ? t and coalesce(p ->> t, '') !~ '^#[0-9A-Fa-f]{6}$' then raise exception 'couleur invalide : %', p ->> t; end if;
  end loop;

  update public.club_sites set
    slug = v_slug,
    publie = coalesce((p ->> 'publie')::boolean, publie),
    modele = coalesce(nullif(p ->> 'modele', ''), modele),
    couleur_accent = coalesce(p ->> 'couleur_accent', couleur_accent),
    couleur_secondaire = coalesce(p ->> 'couleur_secondaire', couleur_secondaire),
    couleur_tertiaire = coalesce(p ->> 'couleur_tertiaire', couleur_tertiaire),
    couleur_fond = coalesce(p ->> 'couleur_fond', couleur_fond),
    couleur_texte = coalesce(p ->> 'couleur_texte', couleur_texte),
    logo_url = case when p ? 'logo_url' then nullif(p ->> 'logo_url', '') else logo_url end,
    couverture_url = case when p ? 'couverture_url' then nullif(p ->> 'couverture_url', '') else couverture_url end,
    accroche = case when p ? 'accroche' then nullif(btrim(p ->> 'accroche'), '') else accroche end,
    sous_titre = case when p ? 'sous_titre' then nullif(btrim(p ->> 'sous_titre'), '') else sous_titre end,
    presentation = case when p ? 'presentation' then nullif(btrim(p ->> 'presentation'), '') else presentation end,
    atouts = case when jsonb_typeof(p -> 'atouts') = 'array' then p -> 'atouts' else atouts end,
    zones = case when jsonb_typeof(p -> 'zones') = 'array' then p -> 'zones' else zones end,
    adresse = case when p ? 'adresse' then nullif(btrim(p ->> 'adresse'), '') else adresse end,
    telephone = case when p ? 'telephone' then nullif(btrim(p ->> 'telephone'), '') else telephone end,
    email = case when p ? 'email' then nullif(btrim(p ->> 'email'), '') else email end,
    horaires = case when p ? 'horaires' then nullif(btrim(p ->> 'horaires'), '') else horaires end,
    saison = case when p ? 'saison' then nullif(btrim(p ->> 'saison'), '') else saison end,
    infos = case when p ? 'infos' then nullif(btrim(p ->> 'infos'), '') else infos end,
    tarifs = case when jsonb_typeof(p -> 'tarifs') = 'array' then p -> 'tarifs' else tarifs end,
    annee_creation = case when p ? 'annee_creation' then nullif(p ->> 'annee_creation', '')::integer else annee_creation end,
    satisfaction = case when p ? 'satisfaction' then nullif(p ->> 'satisfaction', '')::integer else satisfaction end,
    note_google = case when p ? 'note_google' then nullif(replace(p ->> 'note_google', ',', '.'), '')::numeric(2,1) else note_google end,
    nb_avis_google = case when p ? 'nb_avis_google' then nullif(p ->> 'nb_avis_google', '')::integer else nb_avis_google end,
    lien_google = case when p ? 'lien_google' then nullif(btrim(p ->> 'lien_google'), '') else lien_google end,
    chiffres = case when jsonb_typeof(p -> 'chiffres') = 'array' then p -> 'chiffres' else chiffres end,
    sections = case when jsonb_typeof(p -> 'sections') = 'object' then sections || (p -> 'sections') else sections end
  where centre_id = p_centre;

  return public.contenu_site_club(p_centre);
end;
$$;
revoke all on function public.enregistrer_site_club(uuid, jsonb) from public, anon;
grant execute on function public.enregistrer_site_club(uuid, jsonb) to authenticated;


-- Palanote — Les offres du site (Starter, Premium, Advanced) et le nom de domaine du club
-- · L'offre et l'abonnement ne se changent que côté serveur (fonction abonnement-club, après paiement Stripe).
-- · Premium et Advanced : le club branche son propre nom de domaine (acheté chez OVH, Hostinger, IONOS…).
--   L'app lui donne 2 réglages DNS et vérifie qu'ils sont en place.
-- Prérequis : palanote-site-club.sql. Script autonome et rejouable, à lancer dans le SQL Editor de Supabase.

-- Le site public ne doit jamais montrer les informations de paiement : il faut la dernière version du site
do $$
begin
  if to_regclass('public.club_sites') is null
     or position('stripe_client' in coalesce((select prosrc from pg_proc where proname = 'contenu_site_club' limit 1), '')) = 0 then
    raise exception 'Lance d''abord la dernière version de palanote-site-club.sql, puis ce script.';
  end if;
end $$;

-- ------------------------------------------------------------
-- 1. Abonnement et domaine, sur le site du club
-- ------------------------------------------------------------
alter table public.club_sites add column if not exists abonnement_statut text not null default 'aucun';
alter table public.club_sites add column if not exists abonnement_fin timestamptz;
alter table public.club_sites add column if not exists stripe_client text;
alter table public.club_sites add column if not exists stripe_abonnement text;
alter table public.club_sites add column if not exists domaine text;
alter table public.club_sites add column if not exists domaine_hebergeur text;
alter table public.club_sites add column if not exists domaine_statut text not null default 'aucun';
alter table public.club_sites add column if not exists domaine_jeton text;
alter table public.club_sites add column if not exists domaine_verifie_le timestamptz;

alter table public.club_sites drop constraint if exists club_sites_abonnement_check;
alter table public.club_sites add constraint club_sites_abonnement_check check (
  abonnement_statut in ('aucun', 'actif', 'impaye', 'annule')
  and domaine_statut in ('aucun', 'en_attente', 'branche')
  and (domaine is null or domaine ~ '^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$')
  and (domaine_hebergeur is null or domaine_hebergeur in ('ovh', 'hostinger', 'ionos', 'autre')));
create unique index if not exists club_sites_domaine_idx on public.club_sites (domaine) where domaine is not null;

-- ------------------------------------------------------------
-- 2. Mon offre (lecture par les DP du club)
-- ------------------------------------------------------------
create or replace function public.offre_site_club(p_centre uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.est_dp_centre(p_centre) then raise exception 'réservé aux directeurs de plongée du centre'; end if;
  return (
    select jsonb_build_object(
      'offre', s.offre, 'abonnement_statut', s.abonnement_statut, 'abonnement_fin', s.abonnement_fin,
      'avec_stripe', s.stripe_client is not null,
      'slug', s.slug, 'domaine', s.domaine, 'domaine_hebergeur', s.domaine_hebergeur,
      'domaine_statut', s.domaine_statut, 'domaine_jeton', s.domaine_jeton, 'domaine_verifie_le', s.domaine_verifie_le)
    from public.club_sites s where s.centre_id = p_centre);
end;
$$;
revoke all on function public.offre_site_club(uuid) from public, anon;
grant execute on function public.offre_site_club(uuid) to authenticated;

-- ------------------------------------------------------------
-- 3. Le nom de domaine (Premium et Advanced)
-- ------------------------------------------------------------
create or replace function public.definir_domaine_club(p_centre uuid, p_domaine text, p_hebergeur text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_domaine text := lower(regexp_replace(btrim(coalesce(p_domaine, '')), '^(https?://)?(www\.)?|/.*$', '', 'g'));
  v_offre text;
begin
  if not public.est_dp_centre(p_centre) then raise exception 'réservé aux directeurs de plongée du centre'; end if;
  select offre into v_offre from public.club_sites where centre_id = p_centre;
  if v_offre is null then raise exception 'le site du club n''existe pas encore'; end if;
  if v_offre = 'starter' then raise exception 'le nom de domaine est compris dans l''offre Premium'; end if;
  if v_domaine !~ '^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$' then
    raise exception 'ce nom de domaine n''a pas l''air valide (exemple : club-le-lion.fr)';
  end if;
  if exists (select 1 from public.club_sites where domaine = v_domaine and centre_id <> p_centre) then
    raise exception 'ce nom de domaine est déjà branché sur un autre club';
  end if;

  update public.club_sites set
    domaine = v_domaine,
    domaine_hebergeur = case when p_hebergeur in ('ovh', 'hostinger', 'ionos') then p_hebergeur else 'autre' end,
    domaine_statut = 'en_attente',
    domaine_verifie_le = null,
    -- Un jeton à recopier dans un enregistrement TXT : il prouve que le club possède le domaine
    domaine_jeton = case when domaine = v_domaine and domaine_jeton is not null then domaine_jeton
                         else 'palanote-' || substr(md5(gen_random_uuid()::text), 1, 20) end
  where centre_id = p_centre;
  return public.offre_site_club(p_centre);
end;
$$;
revoke all on function public.definir_domaine_club(uuid, text, text) from public, anon;
grant execute on function public.definir_domaine_club(uuid, text, text) to authenticated;

create or replace function public.retirer_domaine_club(p_centre uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  if not public.est_dp_centre(p_centre) then raise exception 'réservé aux directeurs de plongée du centre'; end if;
  update public.club_sites set domaine = null, domaine_hebergeur = null, domaine_statut = 'aucun',
         domaine_jeton = null, domaine_verifie_le = null
   where centre_id = p_centre;
  return public.offre_site_club(p_centre);
end;
$$;
revoke all on function public.retirer_domaine_club(uuid) from public, anon;
grant execute on function public.retirer_domaine_club(uuid) to authenticated;

-- Résultat de la vérification DNS faite par l'app (enregistrements TXT et CNAME trouvés ou non)
create or replace function public.noter_verification_domaine(p_centre uuid, p_ok boolean)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  if not public.est_dp_centre(p_centre) then raise exception 'réservé aux directeurs de plongée du centre'; end if;
  update public.club_sites set
    domaine_statut = case when domaine is null then 'aucun' when p_ok then 'branche' else 'en_attente' end,
    domaine_verifie_le = case when p_ok then now() else domaine_verifie_le end
  where centre_id = p_centre;
  return public.offre_site_club(p_centre);
end;
$$;
revoke all on function public.noter_verification_domaine(uuid, boolean) from public, anon;
grant execute on function public.noter_verification_domaine(uuid, boolean) to authenticated;

-- ------------------------------------------------------------
-- 4. Changement d'offre : réservé au serveur (fonction abonnement-club, clé secrète)
-- ------------------------------------------------------------
create or replace function public.appliquer_abonnement_club(
  p_centre uuid, p_offre text, p_statut text, p_fin timestamptz, p_client text, p_abonnement text)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  if p_offre not in ('starter', 'premium', 'advanced') then raise exception 'offre inconnue'; end if;
  update public.club_sites set
    offre = p_offre,
    abonnement_statut = coalesce(p_statut, abonnement_statut),
    abonnement_fin = p_fin,
    stripe_client = coalesce(p_client, stripe_client),
    stripe_abonnement = coalesce(p_abonnement, stripe_abonnement),
    -- Retour au Starter : le domaine du club n'est plus servi
    domaine_statut = case when p_offre = 'starter' and domaine is not null then 'en_attente' else domaine_statut end
  where centre_id = p_centre;
end;
$$;
revoke all on function public.appliquer_abonnement_club(uuid, text, text, timestamptz, text, text) from public, anon, authenticated;
grant execute on function public.appliquer_abonnement_club(uuid, text, text, timestamptz, text, text) to service_role;

-- Pour la fonction serveur : le centre et l'adresse e-mail de facturation d'un DP
create or replace function public.club_pour_abonnement(p_user uuid, p_centre uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object('nom', c.nom, 'offre', s.offre, 'stripe_client', s.stripe_client,
                            'stripe_abonnement', s.stripe_abonnement, 'email', u.email)
  from public.centre_membres m
  join public.centres c on c.id = m.centre_id
  join public.club_sites s on s.centre_id = m.centre_id
  join auth.users u on u.id = m.user_id
  where m.user_id = p_user and m.centre_id = p_centre and m.role = 'dp';
$$;
revoke all on function public.club_pour_abonnement(uuid, uuid) from public, anon, authenticated;
grant execute on function public.club_pour_abonnement(uuid, uuid) to service_role;


-- Palanote — Les fiches détaillées des formations (N1, N2, N3, N4, Nitrox…)
-- Pour chaque formation du catalogue : accroche, objectifs, âge minimum, profondeur,
-- contenu, ce qui est inclus, prérogatives, documents à fournir, période et cursus.
-- Les formations du catalogue type sont pré-remplies (modifiables par le club) ;
-- elles s'affichent sur le site du club et dans « Formations ».
-- Prérequis : palanote-formations.sql. Script autonome et rejouable, à lancer dans le SQL Editor de Supabase.

alter table public.formations_catalogue add column if not exists accroche text;
alter table public.formations_catalogue add column if not exists objectifs text;
alter table public.formations_catalogue add column if not exists age_min integer;
alter table public.formations_catalogue add column if not exists profondeur_max integer;
alter table public.formations_catalogue add column if not exists contenu jsonb not null default '[]'::jsonb;
alter table public.formations_catalogue add column if not exists inclus jsonb not null default '[]'::jsonb;
alter table public.formations_catalogue add column if not exists prerogatives text;
alter table public.formations_catalogue add column if not exists documents jsonb not null default '[]'::jsonb;
alter table public.formations_catalogue add column if not exists periode text;
alter table public.formations_catalogue add column if not exists cursus text;

-- ------------------------------------------------------------
-- 1. Les fiches type, par code
-- ------------------------------------------------------------
create or replace function public.fiche_type_formation(p_code text)
returns jsonb
language sql
immutable
set search_path = public
as $$
  select case upper(btrim(p_code))
    when 'N1' then jsonb_build_object(
      'accroche', 'Votre permis de plonger',
      'objectifs', 'Plonger encadré par un guide de palanquée jusqu''à 20 m, et maîtriser les gestes de sécurité de base.',
      'age_min', 14, 'profondeur_max', 20,
      'contenu', jsonb_build_array('Des plongées en mer, de la faible profondeur jusqu''à 20 m', 'Des cours théoriques : matériel, pressions, sécurité, signes', 'Le carnet de plongée Palanote pour noter chaque plongée', 'La carte de niveau 1, reconnue à l''international'),
      'inclus', jsonb_build_array('Tout l''équipement', 'Les sorties en bateau', 'L''encadrement par un moniteur'),
      'prerogatives', 'Plonger encadré jusqu''à 20 m (PE20).',
      'documents', jsonb_build_array('Certificat médical de non contre-indication à la plongée', 'Autorisation parentale pour les mineurs'),
      'periode', 'Toute la saison, sur rendez-vous : en stage sur quelques jours ou sur plusieurs week-ends.',
      'cursus', 'FFESSM (licence fédérale en supplément)')
    when 'N2' then jsonb_build_object(
      'accroche', 'Devenez autonome',
      'objectifs', 'Plonger en autonomie jusqu''à 20 m avec votre binôme, et encadré jusqu''à 40 m.',
      'age_min', 16, 'profondeur_max', 40,
      'contenu', jsonb_build_array('Des plongées en mer, progressivement jusqu''à 40 m', 'Des cours théoriques : décompression, ordinateur, réglementation', 'Navigation sous-marine et gestion de son air', 'La carte de niveau 2'),
      'inclus', jsonb_build_array('Tout l''équipement', 'Les sorties en bateau', 'L''encadrement par un moniteur'),
      'prerogatives', 'Autonome jusqu''à 20 m (PA20), encadré jusqu''à 40 m (PE40).',
      'documents', jsonb_build_array('Carte de niveau 1 (ou équivalent)', 'Certificat médical de non contre-indication à la plongée', 'Autorisation parentale pour les mineurs'),
      'periode', 'Du printemps à l''automne, en stage ou sur plusieurs semaines.',
      'cursus', 'FFESSM (licence fédérale en supplément)')
    when 'N3' then jsonb_build_object(
      'accroche', 'L''autonomie jusqu''à 60 m',
      'objectifs', 'Organiser et mener votre plongée en autonomie jusqu''à 60 m, sous la responsabilité d''un directeur de plongée.',
      'age_min', 18, 'profondeur_max', 60,
      'contenu', jsonb_build_array('Des plongées profondes et sur épave', 'Des cours théoriques : planification, accidents, physiologie', 'L''organisation des secours', 'La carte de niveau 3'),
      'inclus', jsonb_build_array('Tout l''équipement', 'Les sorties en bateau', 'L''encadrement par un moniteur'),
      'prerogatives', 'Autonome jusqu''à 60 m (PA60).',
      'documents', jsonb_build_array('Carte de niveau 2', 'Certificat médical de non contre-indication à la plongée', 'Attestation de secourisme (RIFAP conseillé)'),
      'periode', 'En stage intensif, souvent en fin de saison.',
      'cursus', 'FFESSM (licence fédérale en supplément)')
    when 'N4' then jsonb_build_object(
      'accroche', 'Guidez une palanquée',
      'objectifs', 'Guider une palanquée de plongeurs en exploration et assister le directeur de plongée.',
      'age_min', 18, 'profondeur_max', 40,
      'contenu', jsonb_build_array('Des plongées de guidage, de sauvetage et d''orientation', 'Des cours théoriques : réglementation, théorie avancée, organisation', 'Des épreuves de condition physique (nage, apnée, sauvetage)', 'La carte de niveau 4 Guide de palanquée'),
      'inclus', jsonb_build_array('Tout l''équipement', 'Les sorties en bateau', 'L''encadrement par un moniteur'),
      'prerogatives', 'Guide de palanquée jusqu''à 40 m ; autonome jusqu''à 60 m.',
      'documents', jsonb_build_array('Carte de niveau 3', 'Attestation RIFAP', 'Certificat médical de non contre-indication à la plongée'),
      'periode', 'Sur la saison, avec un examen en fin de cursus.',
      'cursus', 'FFESSM (licence fédérale en supplément)')
    when 'NX' then jsonb_build_object(
      'accroche', 'Plongez au Nitrox',
      'objectifs', 'Plonger avec un mélange enrichi en oxygène (jusqu''à 40 %) dans les limites de votre niveau, pour moins de fatigue et des plongées plus longues.',
      'contenu', jsonb_build_array('Des plongées au Nitrox', 'Des cours : analyse du mélange, profondeur limite, toxicité de l''oxygène'),
      'inclus', jsonb_build_array('Les blocs Nitrox et l''analyseur', 'L''encadrement par un moniteur'),
      'prerogatives', 'Plonger au Nitrox (jusqu''à 40 % d''oxygène) dans les limites de son niveau.',
      'documents', jsonb_build_array('Carte de niveau', 'Certificat médical de non contre-indication à la plongée'))
    when 'NXC' then jsonb_build_object(
      'accroche', 'Tous les mélanges suroxygénés',
      'objectifs', 'Utiliser tous les mélanges enrichis en oxygène et l''oxygène pur pour la décompression.',
      'contenu', jsonb_build_array('Des plongées avec changement de gaz', 'Des cours : planification, décompression à l''oxygène'),
      'inclus', jsonb_build_array('Les blocs et l''oxygène', 'L''encadrement par un moniteur'),
      'prerogatives', 'Plonger avec tous les mélanges suroxygénés et décompresser à l''oxygène.',
      'documents', jsonb_build_array('Carte de niveau 2 et Nitrox', 'Certificat médical de non contre-indication à la plongée'))
    when 'TX' then jsonb_build_object(
      'accroche', 'Plongez à l''hélium',
      'objectifs', 'Plonger avec des mélanges contenant de l''hélium pour limiter la narcose en profondeur.',
      'contenu', jsonb_build_array('Des plongées au Trimix', 'Des cours : mélanges, planification, décompression'),
      'inclus', jsonb_build_array('Les gaz et l''encadrement'),
      'prerogatives', 'Plonger au Trimix élémentaire.',
      'documents', jsonb_build_array('Carte de niveau 3 et Nitrox confirmé', 'Certificat médical de non contre-indication à la plongée'))
    when 'RIFAP' then jsonb_build_object(
      'accroche', 'Savoir réagir',
      'objectifs', 'Réagir face à un accident de plongée : alerter, sortir la victime de l''eau, l''oxygéner, la réanimer.',
      'contenu', jsonb_build_array('Des mises en situation dans l''eau et sur le bateau', 'L''oxygénothérapie et les gestes de premiers secours'),
      'inclus', jsonb_build_array('Le matériel de secours', 'L''encadrement par un moniteur'),
      'prerogatives', 'Nécessaire pour le niveau 3, le niveau 4 et l''initiateur.',
      'documents', jsonb_build_array('Carte de niveau 1', 'Certificat médical de non contre-indication à la plongée'))
    when 'E1' then jsonb_build_object(
      'accroche', 'Transmettez votre passion',
      'objectifs', 'Enseigner la plongée jusqu''à 6 m, en piscine et en mer, sous l''autorité d''un moniteur.',
      'contenu', jsonb_build_array('Des séances pédagogiques encadrées', 'Des cours : pédagogie, sécurité, réglementation'),
      'inclus', jsonb_build_array('L''encadrement par un moniteur'),
      'prerogatives', 'Enseigner jusqu''à 6 m.',
      'documents', jsonb_build_array('Carte de niveau 2', 'Attestation RIFAP', 'Certificat médical de non contre-indication à la plongée'))
    when 'CCR' then jsonb_build_object(
      'accroche', 'La plongée en silence',
      'objectifs', 'Découvrir la plongée en circuit fermé : montage, contrôles, gestion des mélanges et procédures de secours.',
      'contenu', jsonb_build_array('Des plongées en recycleur', 'Des cours : principe, cellules, chaux, procédures'),
      'inclus', jsonb_build_array('Le recycleur et ses consommables', 'L''encadrement par un instructeur'),
      'prerogatives', 'Plonger en recycleur dans les limites de la qualification.',
      'documents', jsonb_build_array('Carte de niveau 2 et Nitrox confirmé', 'Certificat médical de non contre-indication à la plongée'))
    else '{}'::jsonb
  end;
$$;

-- Remplit les cases vides d'une formation avec sa fiche type (sans rien écraser)
create or replace function public.completer_fiche_formation()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  f jsonb := public.fiche_type_formation(new.code);
begin
  if f = '{}'::jsonb then return new; end if;
  new.accroche := coalesce(new.accroche, f ->> 'accroche');
  new.objectifs := coalesce(new.objectifs, f ->> 'objectifs');
  new.age_min := coalesce(new.age_min, (f ->> 'age_min')::integer);
  new.profondeur_max := coalesce(new.profondeur_max, (f ->> 'profondeur_max')::integer);
  new.contenu := case when new.contenu is null or new.contenu = '[]'::jsonb then coalesce(f -> 'contenu', '[]'::jsonb) else new.contenu end;
  new.inclus := case when new.inclus is null or new.inclus = '[]'::jsonb then coalesce(f -> 'inclus', '[]'::jsonb) else new.inclus end;
  new.prerogatives := coalesce(new.prerogatives, f ->> 'prerogatives');
  new.documents := case when new.documents is null or new.documents = '[]'::jsonb then coalesce(f -> 'documents', '[]'::jsonb) else new.documents end;
  new.periode := coalesce(new.periode, f ->> 'periode');
  new.cursus := coalesce(new.cursus, f ->> 'cursus');
  return new;
end;
$$;

drop trigger if exists formations_catalogue_fiche on public.formations_catalogue;
create trigger formations_catalogue_fiche before insert on public.formations_catalogue
  for each row execute function public.completer_fiche_formation();

-- Les formations déjà au catalogue : on complète leurs cases vides
update public.formations_catalogue f set
  accroche = coalesce(f.accroche, t.f ->> 'accroche'),
  objectifs = coalesce(f.objectifs, t.f ->> 'objectifs'),
  age_min = coalesce(f.age_min, (t.f ->> 'age_min')::integer),
  profondeur_max = coalesce(f.profondeur_max, (t.f ->> 'profondeur_max')::integer),
  contenu = case when f.contenu = '[]'::jsonb then coalesce(t.f -> 'contenu', '[]'::jsonb) else f.contenu end,
  inclus = case when f.inclus = '[]'::jsonb then coalesce(t.f -> 'inclus', '[]'::jsonb) else f.inclus end,
  prerogatives = coalesce(f.prerogatives, t.f ->> 'prerogatives'),
  documents = case when f.documents = '[]'::jsonb then coalesce(t.f -> 'documents', '[]'::jsonb) else f.documents end,
  periode = coalesce(f.periode, t.f ->> 'periode'),
  cursus = coalesce(f.cursus, t.f ->> 'cursus')
from (select id, public.fiche_type_formation(code) as f from public.formations_catalogue) t
where t.id = f.id and t.f <> '{}'::jsonb;

-- ------------------------------------------------------------
-- 2. Enregistrer une formation, avec sa fiche
-- ------------------------------------------------------------
create or replace function public.enregistrer_formation_catalogue(p_centre uuid, p_formation jsonb)
returns uuid
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_id uuid := nullif(p_formation ->> 'id', '')::uuid;
begin
  if not public.est_dp_centre(p_centre) then raise exception 'réservé aux directeurs de plongée du centre'; end if;
  if nullif(btrim(p_formation ->> 'code'), '') is null or nullif(btrim(p_formation ->> 'intitule'), '') is null then
    raise exception 'le code et l''intitulé sont obligatoires';
  end if;
  if v_id is null then
    insert into public.formations_catalogue (centre_id, code, intitule, organisme, categorie, prix, nb_theorie, nb_pratique, prerequis, description, ordre)
    values (p_centre, left(btrim(p_formation ->> 'code'), 20), left(btrim(p_formation ->> 'intitule'), 80),
            coalesce(nullif(btrim(p_formation ->> 'organisme'), ''), 'FFESSM'), coalesce(nullif(p_formation ->> 'categorie', ''), 'niveau'),
            nullif(p_formation ->> 'prix', '')::numeric, coalesce(nullif(p_formation ->> 'nb_theorie', '')::int, 0),
            coalesce(nullif(p_formation ->> 'nb_pratique', '')::int, 0), nullif(btrim(p_formation ->> 'prerequis'), ''),
            nullif(btrim(p_formation ->> 'description'), ''),
            coalesce((select max(ordre) + 1 from public.formations_catalogue where centre_id = p_centre), 0))
    returning id into v_id;
  else
    update public.formations_catalogue set
      code = left(btrim(p_formation ->> 'code'), 20), intitule = left(btrim(p_formation ->> 'intitule'), 80),
      organisme = coalesce(nullif(btrim(p_formation ->> 'organisme'), ''), 'FFESSM'),
      categorie = coalesce(nullif(p_formation ->> 'categorie', ''), categorie),
      prix = nullif(p_formation ->> 'prix', '')::numeric,
      nb_theorie = coalesce(nullif(p_formation ->> 'nb_theorie', '')::int, 0), nb_pratique = coalesce(nullif(p_formation ->> 'nb_pratique', '')::int, 0),
      prerequis = nullif(btrim(p_formation ->> 'prerequis'), ''), description = nullif(btrim(p_formation ->> 'description'), ''),
      actif = coalesce((p_formation ->> 'actif')::boolean, actif)
    where id = v_id and centre_id = p_centre;
  end if;

  -- La fiche détaillée (seulement les champs envoyés)
  update public.formations_catalogue set
    accroche = case when p_formation ? 'accroche' then nullif(btrim(p_formation ->> 'accroche'), '') else accroche end,
    objectifs = case when p_formation ? 'objectifs' then nullif(btrim(p_formation ->> 'objectifs'), '') else objectifs end,
    age_min = case when p_formation ? 'age_min' then nullif(p_formation ->> 'age_min', '')::integer else age_min end,
    profondeur_max = case when p_formation ? 'profondeur_max' then nullif(p_formation ->> 'profondeur_max', '')::integer else profondeur_max end,
    contenu = case when jsonb_typeof(p_formation -> 'contenu') = 'array'
                   then coalesce((select jsonb_agg(btrim(x)) from jsonb_array_elements_text(p_formation -> 'contenu') x where btrim(x) <> ''), '[]'::jsonb) else contenu end,
    inclus = case when jsonb_typeof(p_formation -> 'inclus') = 'array'
                  then coalesce((select jsonb_agg(btrim(x)) from jsonb_array_elements_text(p_formation -> 'inclus') x where btrim(x) <> ''), '[]'::jsonb) else inclus end,
    documents = case when jsonb_typeof(p_formation -> 'documents') = 'array'
                     then coalesce((select jsonb_agg(btrim(x)) from jsonb_array_elements_text(p_formation -> 'documents') x where btrim(x) <> ''), '[]'::jsonb) else documents end,
    prerogatives = case when p_formation ? 'prerogatives' then nullif(btrim(p_formation ->> 'prerogatives'), '') else prerogatives end,
    periode = case when p_formation ? 'periode' then nullif(btrim(p_formation ->> 'periode'), '') else periode end,
    cursus = case when p_formation ? 'cursus' then nullif(btrim(p_formation ->> 'cursus'), '') else cursus end
  where id = v_id and centre_id = p_centre;
  return v_id;
end;
$$;
revoke all on function public.enregistrer_formation_catalogue(uuid, jsonb) from public, anon;
grant execute on function public.enregistrer_formation_catalogue(uuid, jsonb) to authenticated;


-- Palanote — L'agent de lecture des carnets : son journal de travail
-- L'agent lit une page, puis décide lui-même de vérifier ses doutes (zoomer sur une zone,
-- comparer avec la page voisine) avant d'enregistrer. Chaque page garde la trace de ce qu'il a fait,
-- le nombre d'étapes et les jetons consommés (pour suivre le coût et la qualité).
-- Prérequis : palanote-numerisation.sql. Script autonome et rejouable, à lancer dans le SQL Editor de Supabase.

alter table public.ocr_pages add column if not exists journal_agent jsonb not null default '[]'::jsonb;
alter table public.ocr_pages add column if not exists etapes_agent integer;
alter table public.ocr_pages add column if not exists tokens_entree integer;
alter table public.ocr_pages add column if not exists tokens_sortie integer;

comment on column public.ocr_pages.journal_agent is 'Vérifications faites par l''agent : [{etape, outil, raison, zone, resultat}]';
comment on column public.ocr_pages.etapes_agent is 'Nombre d''appels au modèle pour lire la page (1 = lecture directe)';


-- Palanote — Le banc d'essai de l'agent de lecture (eval set)
-- Des photos de pages de carnet avec la bonne réponse attendue (cas nominaux, en bordure, hostiles :
-- règle 60-20-20). L'administrateur lance l'évaluation en « lecture directe » (un seul appel)
-- ou en « agent » (vérifications) : chaque cas est noté réussi / raté, avec le coût et la durée.
-- Réservé à l'administrateur (app_admins). Prérequis : palanote-tableau-de-bord.sql.
-- Script autonome et rejouable, à lancer dans le SQL Editor de Supabase.

-- ------------------------------------------------------------
-- 1. Les cas de test
-- ------------------------------------------------------------
create table if not exists public.agent_eval_cas (
  id uuid primary key default gen_random_uuid(),
  titre text not null,
  type text not null default 'nominal',
  chemin text not null, -- la photo, dans le seau privé « evals »
  -- La bonne réponse : { lisible, plongees: [ { date, site, profondeur_max, duree, temperature… } ] }
  -- Une valeur null = « rien n'est écrit » : l'agent ne doit rien inventer à cet endroit.
  attendu jsonb not null default '{"lisible": true, "plongees": []}'::jsonb,
  note text,
  created_at timestamptz not null default now(),
  constraint agent_eval_cas_type_check check (type in ('nominal', 'bordure', 'hostile'))
);
alter table public.agent_eval_cas enable row level security;
drop policy if exists "Admin : cas d'évaluation" on public.agent_eval_cas;
create policy "Admin : cas d'évaluation" on public.agent_eval_cas for all to authenticated
  using (public.est_admin()) with check (public.est_admin());

-- ------------------------------------------------------------
-- 2. Les évaluations et leurs résultats
-- ------------------------------------------------------------
create table if not exists public.agent_eval_runs (
  id uuid primary key default gen_random_uuid(),
  mode text not null,
  modele text,
  etapes_max integer,
  created_at timestamptz not null default now(),
  constraint agent_eval_runs_mode_check check (mode in ('direct', 'agent'))
);
alter table public.agent_eval_runs enable row level security;
drop policy if exists "Admin : évaluations" on public.agent_eval_runs;
create policy "Admin : évaluations" on public.agent_eval_runs for all to authenticated
  using (public.est_admin()) with check (public.est_admin());

create table if not exists public.agent_eval_resultats (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.agent_eval_runs(id) on delete cascade,
  cas_id uuid not null references public.agent_eval_cas(id) on delete cascade,
  reussi boolean not null,
  -- Le détail de la note : structure, champs exacts, signalés, faux, inventés
  details jsonb not null default '{}'::jsonb,
  sortie jsonb, -- ce que l'agent a rendu
  journal jsonb not null default '[]'::jsonb,
  etapes integer,
  tokens_entree integer,
  tokens_sortie integer,
  duree_ms integer,
  erreur text,
  created_at timestamptz not null default now(),
  unique (run_id, cas_id)
);
alter table public.agent_eval_resultats enable row level security;
drop policy if exists "Admin : résultats d'évaluation" on public.agent_eval_resultats;
create policy "Admin : résultats d'évaluation" on public.agent_eval_resultats for all to authenticated
  using (public.est_admin()) with check (public.est_admin());

-- ------------------------------------------------------------
-- 3. Les photos de test (seau privé, administrateur seulement)
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('evals', 'evals', false, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false;

drop policy if exists "Evals : lecture admin" on storage.objects;
create policy "Evals : lecture admin" on storage.objects for select to authenticated
  using (bucket_id = 'evals' and public.est_admin());
drop policy if exists "Evals : dépôt admin" on storage.objects;
create policy "Evals : dépôt admin" on storage.objects for insert to authenticated
  with check (bucket_id = 'evals' and public.est_admin());
drop policy if exists "Evals : suppression admin" on storage.objects;
create policy "Evals : suppression admin" on storage.objects for delete to authenticated
  using (bucket_id = 'evals' and public.est_admin());

-- ------------------------------------------------------------
-- 4. Les droits d'accès aux tables (RLS les réserve ensuite à l'administrateur)
--    Sans ces droits, Supabase refuse toute lecture : « permission denied ».
-- ------------------------------------------------------------
grant select, insert, update, delete on public.agent_eval_cas, public.agent_eval_runs, public.agent_eval_resultats to authenticated;
grant all on public.agent_eval_cas, public.agent_eval_runs, public.agent_eval_resultats to service_role;


-- Palanote — Nettoyage de sécurité (audit Supabase du 20 octobre 2026)
-- 1. Fixe le search_path de 5 fonctions signalées par l'audit (« function_search_path_mutable ») :
--    elles ne peuvent plus être détournées par un schéma placé avant « public ».
-- 2. Supprime les deux règles RLS en double sur « profiles » (les versions « Palanote … » restent,
--    avec exactement la même condition : rien ne change pour les utilisateurs).
-- Script autonome et rejouable, à lancer dans le SQL Editor de Supabase.

do $$
declare f text;
begin
  foreach f in array array[
    'public.cellule(jsonb, text)',
    'public.cellule_nombre(jsonb, text)',
    'public.cellule_date(jsonb, text)',
    'public.cellule_heure(jsonb, text)',
    'public.proteger_verification_brevet()'
  ] loop
    if to_regprocedure(f) is not null then
      execute format('alter function %s set search_path = public', f);
    end if;
  end loop;
end $$;

-- Les doublons (garder « Palanote lire son profil » et « Palanote modifier son profil »)
do $$
begin
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'profiles' and policyname = 'Palanote lire son profil') then
    drop policy if exists "Lire son profil" on public.profiles;
  end if;
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'profiles' and policyname = 'Palanote modifier son profil') then
    drop policy if exists "Modifier son profil" on public.profiles;
  end if;
end $$;

-- Vérification : 0 fonction sans search_path, 3 règles sur profiles (lire, créer, modifier)
select
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in ('cellule', 'cellule_nombre', 'cellule_date', 'cellule_heure', 'proteger_verification_brevet')
      and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')) as fonctions_a_corriger,
  (select count(*) from pg_policies where schemaname = 'public' and tablename = 'profiles') as regles_profiles;


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


-- Palanote — Le suivi de l'agent de lecture en production (tableau de bord admin › Agent IA)
-- Ce que l'agent a vraiment fait sur les pages des plongeurs : pages lues, échecs, vérifications,
-- étapes, jetons consommés, et le taux de correction humaine (champs proposés par l'IA que le
-- plongeur a dû corriger à la relecture). Les pages lues avant l'agent (lecture directe) sont
-- comptées à part, pour comparer.
-- Aucune donnée personnelle n'est renvoyée : seulement des chiffres agrégés.
-- Réservé à l'administrateur. Prérequis : palanote-tableau-de-bord.sql, palanote-agent-lecture.sql.
-- Script autonome et rejouable, à lancer dans le SQL Editor de Supabase.

-- Compare deux valeurs de champ comme le ferait un humain : casse, espaces, virgule décimale
create or replace function public.valeur_normalisee(v text)
returns text
language sql
immutable
set search_path = public
as $$
  select case
    when v is null or btrim(v) = '' then null
    when replace(btrim(v), ',', '.') ~ '^-?[0-9]+(\.[0-9]+)?$' then (replace(btrim(v), ',', '.')::numeric)::text
    else lower(regexp_replace(btrim(v), '\s+', ' ', 'g'))
  end;
$$;

create or replace function public.admin_suivi_agent(p_jours int default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_depuis timestamptz := now() - make_interval(days => greatest(1, least(p_jours, 365)));
  v_resultat jsonb;
begin
  if not public.est_admin() then raise exception 'réservé à l''administrateur'; end if;

  with pages as (
    select p.*, case when p.etapes_agent is null then 'direct' else 'agent' end as mode
    from public.ocr_pages p
    where p.created_at >= v_depuis
  ),
  -- Chaque champ proposé par l'IA, face à la valeur validée par le plongeur
  champs as (
    select pg.mode,
      e.confiances ->> c.cle as confiance,
      public.valeur_normalisee(pg.reponse_modele -> 'plongees' -> e.ordre -> c.cle ->> 'valeur') as propose,
      public.valeur_normalisee(e.champs ->> c.cle) as valide
    from pages pg
    join public.ocr_extractions e on e.page_id = pg.id and e.statut = 'validee'
    cross join lateral jsonb_object_keys(coalesce(e.champs, '{}'::jsonb)) as c(cle)
    where c.cle not in ('commentaire', 'signee', 'tamponnee')
  ),
  par_mode as (
    select m.mode,
      jsonb_build_object(
        'pages', count(p.id),
        'lues', count(*) filter (where statut = 'lue'),
        'illisibles', count(*) filter (where statut = 'illisible'),
        'erreurs', count(*) filter (where statut = 'erreur'),
        'en_cours', count(*) filter (where statut in ('en_attente', 'en_cours')),
        'avec_verification', count(*) filter (where jsonb_array_length(coalesce(journal_agent, '[]'::jsonb)) > 0),
        'verifications', coalesce(sum(jsonb_array_length(coalesce(journal_agent, '[]'::jsonb))), 0),
        'zooms', coalesce(sum((select count(*) from jsonb_array_elements(coalesce(journal_agent, '[]'::jsonb)) j where j ->> 'outil' = 'zoomer')), 0),
        'pages_voisines', coalesce(sum((select count(*) from jsonb_array_elements(coalesce(journal_agent, '[]'::jsonb)) j where j ->> 'outil' = 'voir_page_voisine')), 0),
        'etapes_moyennes', round(avg(etapes_agent)::numeric, 2),
        'tokens_entree', coalesce(sum(tokens_entree), 0),
        'tokens_sortie', coalesce(sum(tokens_sortie), 0),
        'pages_avec_tokens', count(*) filter (where tokens_entree is not null),
        'champs_proposes', (select count(*) from champs c where c.mode = m.mode and c.propose is not null),
        'champs_corriges', (select count(*) from champs c where c.mode = m.mode and c.propose is not null and c.propose is distinct from c.valide),
        'faux_surs', (select count(*) from champs c where c.mode = m.mode and c.confiance = 'sur' and c.propose is not null and c.propose is distinct from c.valide),
        'champs_surs', (select count(*) from champs c where c.mode = m.mode and c.confiance = 'sur' and c.propose is not null),
        'champs_completes', (select count(*) from champs c where c.mode = m.mode and c.propose is null and c.valide is not null)
      ) as chiffres
    from (select 'agent'::text as mode union all select 'direct') m
    left join pages p on p.mode = m.mode
    group by m.mode
  )
  select jsonb_build_object(
    'jours', p_jours,
    'modes', (select jsonb_object_agg(mode, chiffres) from par_mode),
    'plongees_validees', (select count(*) from public.ocr_extractions e join pages p on p.id = e.page_id where e.statut = 'validee'),
    'plongees_rejetees', (select count(*) from public.ocr_extractions e join pages p on p.id = e.page_id where e.statut = 'rejetee'),
    'par_jour', (
      select coalesce(jsonb_agg(jsonb_build_object('jour', j::date, 'agent', (select count(*) from pages p where p.mode = 'agent' and p.created_at::date = j::date), 'direct', (select count(*) from pages p where p.mode = 'direct' and p.created_at::date = j::date)) order by j), '[]'::jsonb)
      from generate_series(current_date - 13, current_date, interval '1 day') j
    ),
    'dernieres', (
      select coalesce(jsonb_agg(x order by x ->> 'le' desc), '[]'::jsonb) from (
        select jsonb_build_object('le', p.created_at, 'mode', p.mode, 'statut', p.statut, 'etapes', p.etapes_agent,
          'verifications', (select coalesce(jsonb_agg(j ->> 'raison'), '[]'::jsonb) from jsonb_array_elements(coalesce(p.journal_agent, '[]'::jsonb)) j),
          'tokens', coalesce(p.tokens_entree, 0) + coalesce(p.tokens_sortie, 0), 'erreur', left(p.erreur, 160)) as x
        from pages p order by p.created_at desc limit 12
      ) d
    )
  ) into v_resultat;
  return v_resultat;
end;
$$;
revoke all on function public.admin_suivi_agent(int) from public, anon;
grant execute on function public.admin_suivi_agent(int) to authenticated;
revoke all on function public.valeur_normalisee(text) from public, anon;
grant execute on function public.valeur_normalisee(text) to authenticated;
