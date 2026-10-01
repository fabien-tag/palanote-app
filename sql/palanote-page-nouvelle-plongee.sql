-- ============================================================
-- Palanote — Page « Nouvelle plongée »
-- Table : dives (une plongée du carnet)
-- À coller dans Supabase → SQL Editor → Run
-- Relançable sans risque : ne casse rien si exécuté deux fois.
-- ============================================================

-- Fonction de mise à jour automatique de updated_at (si pas déjà créée)
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
-- Table principale : dives
-- ------------------------------------------------------------
create table if not exists public.dives (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,

  -- Essentiel
  dive_date date,
  start_time time,
  site_name text,
  site_location text,
  site_coords text,

  -- Profil
  max_depth_m numeric(5,2),
  avg_depth_m numeric(5,2),
  duration_min integer,
  end_time time,
  total_time_min integer,
  surface_interval_min integer,
  stops jsonb default '[]'::jsonb,        -- ex. [{"profondeur": 6, "duree": 3}]
  method text,                            -- Ordinateur | Table MN90 | Autre
  computer text,

  -- Gaz et équipement
  gas_mix text,                           -- Air | Nitrox | Trimix
  o2_pct integer,
  he_pct integer,
  tank_config text,                       -- Mono | Bi | Sidemount
  tank_volume_l numeric(4,1),
  weight_kg numeric(4,1),
  pressure_start_bar integer,
  pressure_end_bar integer,
  suit_type text,                         -- Shorty | Humide | Semi-étanche | Étanche
  suit_thickness_mm integer,

  -- Conditions
  temp_surface_c numeric(4,1),
  temp_bottom_c numeric(4,1),
  temp_air_c numeric(4,1),
  visibility_m integer,
  current_strength text,                  -- Nul | Faible | Modéré | Fort
  sea_state text,
  weather text,

  -- Palanquée
  buddies text[] default '{}',            -- noms saisis à la main pour l'instant
  guide_name text,
  dive_leader text,
  club_name text,
  boat_name text,

  -- Contexte
  dive_type text,                         -- Exploration | Formation | Épave | Nuit | ...
  environment text,                       -- Mer | Lac | Carrière | Rivière | Fosse
  entry_type text,                        -- Bateau | Du bord

  -- Ressenti
  rating smallint check (rating between 0 and 5),
  rating_place smallint check (rating_place between 0 and 5),
  rating_conditions smallint check (rating_conditions between 0 and 5),
  rating_wildlife smallint check (rating_wildlife between 0 and 5),
  comment text,
  wildlife text[] default '{}',

  -- Confidentialité
  visibility text not null default 'private'
    check (visibility in ('private', 'friends', 'public')),

  -- Métadonnées
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz                  -- suppression douce
);

-- Droits d'accès (obligatoires pour que l'app puisse utiliser la table)
grant select, insert, update, delete on public.dives to authenticated;
grant all on public.dives to service_role;

-- ------------------------------------------------------------
-- Sécurité : chaque plongeur ne voit que ses plongées
-- ------------------------------------------------------------
alter table public.dives enable row level security;

drop policy if exists "dives_select_own" on public.dives;
create policy "dives_select_own" on public.dives
  for select to authenticated
  using (auth.uid() = user_id); -- les plongées supprimées (deleted_at) sont masquées par l'app

drop policy if exists "dives_insert_own" on public.dives;
create policy "dives_insert_own" on public.dives
  for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "dives_update_own" on public.dives;
create policy "dives_update_own" on public.dives
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "dives_delete_own" on public.dives;
create policy "dives_delete_own" on public.dives
  for delete to authenticated
  using (auth.uid() = user_id);

-- ------------------------------------------------------------
-- Trigger updated_at
-- ------------------------------------------------------------
drop trigger if exists set_dives_updated_at on public.dives;
create trigger set_dives_updated_at
  before update on public.dives
  for each row execute function public.update_updated_at_column();

-- ------------------------------------------------------------
-- Index utiles
-- ------------------------------------------------------------
create index if not exists dives_user_date_idx on public.dives (user_id, dive_date desc);
