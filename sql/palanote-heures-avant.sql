-- ============================================================
-- Palanote — Heures sous l'eau avant Palanote
-- À lancer une fois dans Supabase › SQL Editor (relançable sans risque).
--
-- À la création du compte, le plongeur donne son nombre de plongées environ.
-- L'app estime les heures sous l'eau (nombre × durée moyenne choisie : 40, 50
-- ou 60 min) et les garde ici, pour que « sous l'eau » soit juste dès le départ.
-- Vide = pas renseigné : l'app estime alors 50 min par plongée déjà faite.
-- ============================================================

alter table public.profiles add column if not exists heures_avant numeric(6,1);

do $$ begin
  alter table public.profiles add constraint profiles_heures_avant_check
    check (heures_avant is null or (heures_avant >= 0 and heures_avant <= 20000));
exception when duplicate_object then null; end $$;

comment on column public.profiles.heures_avant is
  'Heures passées sous l''eau avant Palanote (estimées à l''inscription, modifiables dans Moi › Mon profil)';
