-- ============================================================
-- Palanote — Certifications du plongeur (Nitrox, Trimix)
-- Ajoute au profil la liste des certifications de gaz, affichées en
-- tag sur l'en-tête du carnet et modifiables dans Moi › Mon profil.
-- Prérequis : palanote-page-moi.sql déjà lancé.
-- À coller dans Supabase → SQL Editor → Run. Relançable sans risque.
-- ============================================================

-- Une liste de textes, vide par défaut : '{}' = aucune certification
alter table public.profiles add column if not exists certifications text[] not null default '{}';

-- Seules les valeurs prévues par l'app sont acceptées
do $$ begin
  alter table public.profiles add constraint profiles_certifications_check
    check (certifications <@ array['Nitrox', 'Trimix']::text[]);
exception when duplicate_object then null; end $$;
