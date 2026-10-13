-- ============================================================
-- Palanote — L'inventaire du matériel, pièce par pièce
--
-- En plus du stock réservé par les sorties (table materiel : « Bloc 12 L × 30 »), chaque
-- pièce a sa fiche : numéro d'inventaire, marque, modèle, taille, n° de série, mise en service,
-- et ses contrôles :
--   · blocs : inspection visuelle annuelle (TIV) et requalification périodique ;
--   · détendeurs, gilets, recycleurs, combinaisons étanches : révision ;
--   · bateau : visite, révision moteur, matériel de sécurité…
-- Les caractéristiques propres à chaque type (volume, robinetterie, immatriculation…) sont
-- rangées dans « caracteristiques ».
--
-- Prérequis : palanote-planning-club.sql (materiel, est_dp_centre).
-- À coller dans Supabase → SQL Editor → Run. Relançable sans risque.
-- ============================================================

create table if not exists public.materiel_articles (
  id uuid primary key default gen_random_uuid(),
  centre_id uuid not null references public.centres(id) on delete cascade,
  materiel_id uuid references public.materiel(id) on delete set null, -- la ligne de stock réservée par les sorties
  categorie text not null,
  reference text not null, -- n° d'inventaire du club (B12-07, DET-12…)
  libelle text,
  marque text,
  modele text,
  taille text,
  numero_serie text,
  mise_en_service date,
  dernier_controle date, -- TIV, révision, visite…
  prochain_controle date,
  derniere_requalif date, -- blocs : requalification périodique
  prochaine_requalif date,
  etat text not null default 'ok',
  caracteristiques jsonb not null default '{}'::jsonb,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint materiel_articles_categorie_check check (categorie in ('bateau', 'bloc', 'detendeur', 'combinaison', 'recycleur', 'gilet', 'ordinateur', 'autre')),
  constraint materiel_articles_etat_check check (etat in ('ok', 'a_controler', 'en_reparation', 'hors_service')),
  constraint materiel_articles_reference_check check (char_length(btrim(reference)) between 1 and 40)
);
create index if not exists materiel_articles_centre_idx on public.materiel_articles (centre_id, categorie) where deleted_at is null;
create unique index if not exists materiel_articles_reference_idx on public.materiel_articles (centre_id, lower(reference)) where deleted_at is null;

grant select, insert, update, delete on public.materiel_articles to authenticated;
grant all on public.materiel_articles to service_role;
alter table public.materiel_articles enable row level security;
drop policy if exists "DP : lire l'inventaire" on public.materiel_articles;
create policy "DP : lire l'inventaire" on public.materiel_articles for select to authenticated using (public.est_dp_centre(centre_id));
drop policy if exists "DP : ajouter à l'inventaire" on public.materiel_articles;
create policy "DP : ajouter à l'inventaire" on public.materiel_articles for insert to authenticated with check (public.est_dp_centre(centre_id));
drop policy if exists "DP : modifier l'inventaire" on public.materiel_articles;
create policy "DP : modifier l'inventaire" on public.materiel_articles for update to authenticated
  using (public.est_dp_centre(centre_id)) with check (public.est_dp_centre(centre_id));
drop policy if exists "DP : retirer de l'inventaire" on public.materiel_articles;
create policy "DP : retirer de l'inventaire" on public.materiel_articles for delete to authenticated using (public.est_dp_centre(centre_id));

drop trigger if exists materiel_articles_updated_at on public.materiel_articles;
create trigger materiel_articles_updated_at before update on public.materiel_articles
  for each row execute function public.update_updated_at_column();
