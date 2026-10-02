-- ============================================================
-- Palanote — Profil du plongeur (inscription + Moi › Mon profil)
-- A. Rôle : plongeur, encadrant, directeur de plongée, club ou centre.
--    Servira plus tard à ouvrir l'espace « organiser les palanquées ».
-- B. Profondeur max atteinte avant Palanote (comptée dans les stats).
-- Script relançable sans risque.
-- ============================================================

-- 1. La colonne (vide = pas encore renseigné)
alter table public.profiles add column if not exists role_plongee text;

-- 2. Seules ces 4 valeurs sont acceptées
do $$ begin
  alter table public.profiles add constraint profiles_role_plongee_check
    check (role_plongee is null or role_plongee in ('plongeur', 'encadrant', 'directeur', 'centre'));
exception when duplicate_object then null; end $$;

-- 3. Retrouver vite les encadrants (pour le futur espace palanquées)
create index if not exists profiles_role_plongee_idx on public.profiles (role_plongee)
  where role_plongee in ('encadrant', 'directeur', 'centre');

-- 4. Profondeur max avant Palanote, en mètres (vide = non renseignée)
alter table public.profiles add column if not exists prof_max_avant numeric(4,1);

do $$ begin
  alter table public.profiles add constraint profiles_prof_max_avant_check
    check (prof_max_avant is null or (prof_max_avant > 0 and prof_max_avant <= 350));
exception when duplicate_object then null; end $$;
