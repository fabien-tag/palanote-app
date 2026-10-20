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
