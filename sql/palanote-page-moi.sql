-- ============================================================
-- Palanote — Onglet Moi : profil, réglages, confidentialité, suppression du compte
-- Complète la table profiles existante (sans rien effacer) et ajoute
-- la fonction de suppression du compte.
-- À coller dans Supabase → SQL Editor → Run. Relançable sans risque.
-- ============================================================

-- ------------------------------------------------------------
-- Profil : colonnes utilisées par l'app (ajoutées seulement si absentes)
-- ------------------------------------------------------------
alter table public.profiles add column if not exists first_name text;
alter table public.profiles add column if not exists niveau text;
alter table public.profiles add column if not exists club text;
alter table public.profiles add column if not exists premiere_plongee_le date;
alter table public.profiles add column if not exists numero_depart integer;

-- Réglages
alter table public.profiles add column if not exists notif_lecture boolean not null default true;
alter table public.profiles add column if not exists notif_binome boolean not null default true;

-- Consentement à la lettre annuelle : un choix daté, à un seul endroit
alter table public.profiles add column if not exists lettre_annuelle boolean not null default false;
alter table public.profiles add column if not exists lettre_annuelle_le timestamptz;

-- ------------------------------------------------------------
-- Droits : chacun lit, crée et modifie uniquement son profil
-- ------------------------------------------------------------
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

drop policy if exists "Palanote lire son profil" on public.profiles;
create policy "Palanote lire son profil" on public.profiles for select to authenticated
  using (auth.uid() = id);
drop policy if exists "Palanote creer son profil" on public.profiles;
create policy "Palanote creer son profil" on public.profiles for insert to authenticated
  with check (auth.uid() = id);
drop policy if exists "Palanote modifier son profil" on public.profiles;
create policy "Palanote modifier son profil" on public.profiles for update to authenticated
  using (auth.uid() = id) with check (auth.uid() = id);

-- ------------------------------------------------------------
-- Supprimer mon compte et toutes mes données
-- (les photos sont effacées par l'app juste avant)
-- ------------------------------------------------------------
create or replace function public.supprimer_mon_compte()
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_moi uuid := auth.uid();
  t record;
begin
  if v_moi is null then raise exception 'connexion requise'; end if;

  -- Tables de l'app reliées au compte par une colonne user_id (quel que soit leur réglage de suppression)
  for t in
    select c.table_name
    from information_schema.columns c
    join information_schema.tables tb on tb.table_schema = c.table_schema and tb.table_name = c.table_name
    where c.table_schema = 'public' and c.column_name = 'user_id' and tb.table_type = 'BASE TABLE'
      and c.table_name <> 'dives'
  loop
    execute format('delete from public.%I where user_id = $1', t.table_name) using v_moi;
  end loop;

  delete from public.dives where user_id = v_moi;
  delete from public.profiles where id = v_moi;
  delete from auth.users where id = v_moi;
end;
$$;
revoke all on function public.supprimer_mon_compte() from public, anon;
grant execute on function public.supprimer_mon_compte() to authenticated;
