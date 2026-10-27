-- ============================================================
-- Palanote : mes sites de plongée (retour du jury, 27 octobre 2026)
-- Chaque site plongé est gardé une fois (nom, lieu, position GPS) pour être
-- choisi dans une liste à la prochaine plongée.
-- Script idempotent : il peut être relancé sans risque.
-- ============================================================

create table if not exists public.sites_plongee (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nom text not null,
  cle text generated always as (lower(btrim(nom))) stored,
  lieu text,
  coords text,
  derniere_plongee date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sites_plongee_nom_check check (char_length(btrim(nom)) between 1 and 120),
  constraint sites_plongee_unique unique (user_id, cle)
);

alter table public.sites_plongee enable row level security;

drop policy if exists "Lire mes sites" on public.sites_plongee;
drop policy if exists "Ajouter un site" on public.sites_plongee;
drop policy if exists "Modifier mon site" on public.sites_plongee;
drop policy if exists "Supprimer mon site" on public.sites_plongee;
create policy "Lire mes sites" on public.sites_plongee for select to authenticated using (auth.uid() = user_id);
create policy "Ajouter un site" on public.sites_plongee for insert to authenticated with check (auth.uid() = user_id);
create policy "Modifier mon site" on public.sites_plongee for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Supprimer mon site" on public.sites_plongee for delete to authenticated using (auth.uid() = user_id);

-- À chaque plongée enregistrée (saisie, carnet numérisé, envoi hors ligne) :
-- le site est ajouté, ou complété avec le lieu et la position les plus récents.
create or replace function public.memoriser_site_plongee()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.site_name is null or btrim(new.site_name) = '' or new.deleted_at is not null then
    return new;
  end if;
  insert into public.sites_plongee (user_id, nom, lieu, coords, derniere_plongee)
  values (new.user_id, btrim(new.site_name), nullif(btrim(new.site_location), ''), nullif(btrim(new.site_coords), ''), new.dive_date)
  on conflict (user_id, cle) do update set
    lieu = coalesce(excluded.lieu, sites_plongee.lieu),
    coords = coalesce(excluded.coords, sites_plongee.coords),
    derniere_plongee = greatest(sites_plongee.derniere_plongee, excluded.derniere_plongee),
    updated_at = now();
  return new;
end;
$$;

drop trigger if exists dives_memoriser_site on public.dives;
create trigger dives_memoriser_site
  after insert or update of site_name, site_location, site_coords, dive_date on public.dives
  for each row execute function public.memoriser_site_plongee();

-- Les sites des plongées déjà dans les carnets (la plus récente donne le lieu et la position)
insert into public.sites_plongee (user_id, nom, lieu, coords, derniere_plongee)
select distinct on (d.user_id, lower(btrim(d.site_name)))
  d.user_id, btrim(d.site_name), nullif(btrim(d.site_location), ''), nullif(btrim(d.site_coords), ''), d.dive_date
from public.dives d
where d.deleted_at is null and d.site_name is not null and btrim(d.site_name) <> ''
order by d.user_id, lower(btrim(d.site_name)), (d.site_coords is null), d.dive_date desc nulls last
on conflict (user_id, cle) do nothing;

select count(*) as sites_enregistres from public.sites_plongee;
