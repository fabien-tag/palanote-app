-- ============================================================
-- Palanote — Parcours 08 « Photos et espèces rencontrées »
-- A. Les photos d'une plongée se partagent avec la palanquée :
--    une seule copie stockée, visible par ceux qui ont la même plongée dans leur carnet.
-- B. L'agent IA « identifier-especes » propose les espèces vues sur tes photos ;
--    tu valides ou tu refuses chacune. Rien n'est ajouté sans ton accord.
-- Prérequis : palanote-numerisation.sql (media, bucket photos),
--             palanote-binomes-plongees.sql et palanote-carnets-ensemble.sql.
-- À coller dans Supabase → SQL Editor → Run. Relançable sans risque.
-- ============================================================

-- ------------------------------------------------------------
-- A1. Une photo est partagée (ou non) avec la palanquée
-- ------------------------------------------------------------
alter table public.media add column if not exists partagee boolean not null default false;

-- ------------------------------------------------------------
-- A2. Le « groupe » d'une plongée : la plongée d'origine + les copies
--     ajoutées par les binômes (parcours 07). C'est la même plongée, vue
--     depuis plusieurs carnets.
-- ------------------------------------------------------------
create or replace function public.groupe_plongee(p_dive uuid)
returns uuid[]
language sql
stable
security definer
set search_path = public
as $$
  with origine as (
    select coalesce(
      (select b.dive_id from public.dive_buddies b where b.copie_dive_id = p_dive limit 1),
      p_dive
    ) as o
  )
  select array(
    select o from origine
    union
    select b.copie_dive_id from public.dive_buddies b, origine
    where b.dive_id = origine.o and b.copie_dive_id is not null
  );
$$;
revoke all on function public.groupe_plongee(uuid) from public, anon, authenticated;

-- Puis-je voir cette photo ? Oui si elle est à moi, ou si elle est partagée
-- et que j'ai la même plongée dans mon carnet.
create or replace function public.peut_voir_media(p_media uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.media m
    where m.id = p_media and m.deleted_at is null
      and (
        m.user_id = auth.uid()
        or (m.partagee and m.dive_id is not null and exists (
              select 1 from public.dives d
              where d.user_id = auth.uid() and d.deleted_at is null
                and d.id = any (public.groupe_plongee(m.dive_id))))
      )
  );
$$;
revoke all on function public.peut_voir_media(uuid) from public, anon;
grant execute on function public.peut_voir_media(uuid) to authenticated;

-- Même question, à partir du chemin du fichier dans le stockage.
-- (Fonction « security definer » : la règle du stockage ne voit pas les photos des autres dans la table media.)
create or replace function public.peut_voir_chemin(p_chemin text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.media m
    where m.chemin = p_chemin and m.partagee and public.peut_voir_media(m.id)
  );
$$;
revoke all on function public.peut_voir_chemin(text) from public, anon;
grant execute on function public.peut_voir_chemin(text) to authenticated;

-- Le stockage laisse lire une photo partagée de ma palanquée (en plus des miennes).
drop policy if exists "photos_lire_celles_de_ma_palanquee" on storage.objects;
create policy "photos_lire_celles_de_ma_palanquee" on storage.objects for select to authenticated
  using (bucket_id = 'photos' and public.peut_voir_chemin(name));

-- ------------------------------------------------------------
-- A3. La galerie commune d'une plongée (écran 42)
-- ------------------------------------------------------------
create or replace function public.galerie_plongee(p_dive uuid)
returns setof jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'connexion requise'; end if;
  if not exists (select 1 from public.dives where id = p_dive and user_id = auth.uid() and deleted_at is null) then
    raise exception 'plongée introuvable';
  end if;
  return query
    select jsonb_build_object(
      'id', m.id,
      'chemin', m.chemin,
      'auteur', public.infos_plongeur(m.user_id),
      'moi', m.user_id = auth.uid(),
      'partagee', m.partagee,
      'cree_le', m.created_at
    )
    from public.media m
    where m.dive_id = any (public.groupe_plongee(p_dive))
      and m.deleted_at is null
      and (m.user_id = auth.uid() or m.partagee)
    order by m.created_at;
end;
$$;
revoke all on function public.galerie_plongee(uuid) from public, anon;
grant execute on function public.galerie_plongee(uuid) to authenticated;

-- Qui verra mes photos partagées : les autres plongeurs de cette plongée (écran 44)
create or replace function public.palanquee_plongee(p_dive uuid)
returns setof jsonb
language sql
stable
security definer
set search_path = public
as $$
  select distinct public.infos_plongeur(u)
  from (
    select d.user_id as u from public.dives d
    where d.id = any (public.groupe_plongee(p_dive)) and d.deleted_at is null
  ) t
  where u <> auth.uid()
    and exists (select 1 from public.dives x where x.id = p_dive and x.user_id = auth.uid());
$$;
revoke all on function public.palanquee_plongee(uuid) from public, anon;
grant execute on function public.palanquee_plongee(uuid) to authenticated;

-- Choisir lesquelles de MES photos de cette plongée sont partagées
create or replace function public.partager_photos(p_dive uuid, p_ids uuid[])
returns integer
language sql
volatile
security definer
set search_path = public
as $$
  with maj as (
    update public.media
      set partagee = (id = any (coalesce(p_ids, '{}'))), updated_at = now()
    where dive_id = p_dive and user_id = auth.uid() and deleted_at is null
    returning partagee
  )
  select count(*)::integer from maj where partagee;
$$;
revoke all on function public.partager_photos(uuid, uuid[]) from public, anon;
grant execute on function public.partager_photos(uuid, uuid[]) to authenticated;

-- ------------------------------------------------------------
-- B1. Consentement à l'analyse des photos (écran 45) et état de l'analyse (écran 57)
-- ------------------------------------------------------------
alter table public.profiles add column if not exists analyse_especes_le timestamptz;

alter table public.dives add column if not exists analyse_statut text;
alter table public.dives add column if not exists analyse_le timestamptz;
alter table public.dives add column if not exists analyse_erreur text;
do $$ begin
  alter table public.dives add constraint dives_analyse_statut_check
    check (analyse_statut is null or analyse_statut in ('en_cours', 'terminee', 'aucune', 'erreur'));
exception when duplicate_object then null; end $$;

-- ------------------------------------------------------------
-- B2. Les espèces d'une plongée : proposées par l'IA ou ajoutées à la main
-- ------------------------------------------------------------
create table if not exists public.dive_species (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  dive_id uuid not null references public.dives (id) on delete cascade,
  media_id uuid references public.media (id) on delete set null,
  nom text not null,
  nom_latin text,
  confiance numeric(4,3) check (confiance is null or (confiance >= 0 and confiance <= 1)),
  alternative text,
  source text not null default 'ia' check (source in ('ia', 'manuel')),
  statut text not null default 'proposee' check (statut in ('proposee', 'validee', 'rejetee')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists dive_species_dive_idx on public.dive_species (dive_id);
create index if not exists dive_species_user_nom_idx on public.dive_species (user_id, nom);

grant select, insert, update, delete on public.dive_species to authenticated;
grant all on public.dive_species to service_role;
alter table public.dive_species enable row level security;

drop policy if exists "especes_lire_les_siennes" on public.dive_species;
create policy "especes_lire_les_siennes" on public.dive_species
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "especes_ajouter_les_siennes" on public.dive_species;
create policy "especes_ajouter_les_siennes" on public.dive_species
  for insert to authenticated
  with check (
    auth.uid() = user_id
    and exists (select 1 from public.dives d where d.id = dive_id and d.user_id = auth.uid())
  );

drop policy if exists "especes_modifier_les_siennes" on public.dive_species;
create policy "especes_modifier_les_siennes" on public.dive_species
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "especes_supprimer_les_siennes" on public.dive_species;
create policy "especes_supprimer_les_siennes" on public.dive_species
  for delete to authenticated using (auth.uid() = user_id);

drop trigger if exists set_dive_species_updated_at on public.dive_species;
create trigger set_dive_species_updated_at
  before update on public.dive_species
  for each row execute function public.update_updated_at_column();
