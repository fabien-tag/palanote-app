-- ============================================================
-- PALANOTE · Pages légales : accord aux conditions d'utilisation
-- A coller dans Supabase > SQL Editor > New query > Run
-- Idempotent : peut être relancé sans danger.
-- ============================================================
-- La table consents existe déjà : ce script la complète.
--  · un accord par plongeur, par type et par version (pas de doublon)
--  · accepter_conditions(version) : enregistre en une fois
--    « cgu » et « confidentialite » pour la version affichée dans l'app

-- 1. Types d'accord (au cas où)
do $$ begin
  create type public.consent_type as enum ('cgu','confidentialite','bilan_annuel','photos_partagees');
exception when duplicate_object then null; end $$;
alter type public.consent_type add value if not exists 'cgu';
alter type public.consent_type add value if not exists 'confidentialite';

-- 2. Table (au cas où)
create table if not exists public.consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type public.consent_type not null,
  version text not null,
  accepte_le timestamptz not null default now(),
  revoque_le timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists consents_user_idx on public.consents (user_id);

-- 3. Un seul accord actif par plongeur, type et version
create unique index if not exists consents_un_actif_idx
  on public.consents (user_id, type, version)
  where revoque_le is null;

-- 4. Droits : chacun lit, donne et révoque uniquement ses accords
grant select, insert, update on public.consents to authenticated;
grant all on public.consents to service_role;
alter table public.consents enable row level security;

drop policy if exists "Lire ses consentements" on public.consents;
create policy "Lire ses consentements" on public.consents for select to authenticated
  using (auth.uid() = user_id);
drop policy if exists "Donner un consentement" on public.consents;
create policy "Donner un consentement" on public.consents for insert to authenticated
  with check (auth.uid() = user_id and revoque_le is null);
drop policy if exists "Révoquer un consentement" on public.consents;
create policy "Révoquer un consentement" on public.consents for update to authenticated
  using (auth.uid() = user_id and revoque_le is null)
  with check (auth.uid() = user_id and revoque_le is not null);

-- 5. Accepter les conditions (case cochée à l'inscription ou feuille « Avant de continuer »)
create or replace function public.accepter_conditions(p_version text)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_moi uuid := auth.uid();
begin
  if v_moi is null then raise exception 'connexion requise'; end if;
  if coalesce(trim(p_version), '') = '' or length(p_version) > 20 then
    raise exception 'version invalide';
  end if;
  insert into public.consents (user_id, type, version)
  values (v_moi, 'cgu', p_version), (v_moi, 'confidentialite', p_version)
  on conflict (user_id, type, version) where revoque_le is null do nothing;
end;
$$;

revoke all on function public.accepter_conditions(text) from public, anon;
grant execute on function public.accepter_conditions(text) to authenticated;
