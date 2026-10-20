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
