-- Palanote — Le site internet du club (offre Starter)
-- Un site vitrine public, généré depuis les données du back-office :
-- formations et tarifs, zones de plongée, bateau et matériel, équipe, infos pratiques.
-- Le DP règle l'apparence (modèle, couleurs, logo, photo) et les textes dans « Mon site ».
-- Adresse publique : /clubs/<adresse-du-club>
-- Script autonome et rejouable. À lancer dans le SQL Editor de Supabase.

-- ------------------------------------------------------------
-- 1. Le site du club
-- ------------------------------------------------------------
create table if not exists public.club_sites (
  centre_id uuid primary key references public.centres(id) on delete cascade,
  slug text not null unique,
  publie boolean not null default false,
  offre text not null default 'starter',
  modele text not null default 'lagon',
  couleur_accent text not null default '#14B8C4',
  couleur_secondaire text not null default '#0B3B63',
  couleur_tertiaire text not null default '#FF8A75',
  couleur_fond text not null default '#F4F8FB',
  couleur_texte text not null default '#10263F',
  logo_url text,
  couverture_url text,
  accroche text,
  sous_titre text,
  presentation text,
  atouts jsonb not null default '[]'::jsonb,
  zones jsonb not null default '[]'::jsonb,
  adresse text,
  telephone text,
  email text,
  horaires text,
  saison text,
  infos text,
  sections jsonb not null default '{"formations": true, "zones": true, "materiel": true, "equipe": true, "infos": true}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint club_sites_slug_check check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) between 3 and 60),
  constraint club_sites_offre_check check (offre in ('starter', 'premium', 'advanced')),
  constraint club_sites_couleurs_check check (
    couleur_accent ~ '^#[0-9A-Fa-f]{6}$' and couleur_secondaire ~ '^#[0-9A-Fa-f]{6}$' and couleur_tertiaire ~ '^#[0-9A-Fa-f]{6}$'
    and couleur_fond ~ '^#[0-9A-Fa-f]{6}$' and couleur_texte ~ '^#[0-9A-Fa-f]{6}$')
);
alter table public.club_sites enable row level security; -- lecture et écriture par les fonctions ci-dessous

drop trigger if exists club_sites_updated_at on public.club_sites;
create trigger club_sites_updated_at before update on public.club_sites
  for each row execute function public.update_updated_at_column();

-- ------------------------------------------------------------
-- 2. Le logo et la photo de couverture (lecture publique)
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('sites-clubs', 'sites-clubs', true, 5242880, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update set public = true, file_size_limit = 5242880, allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp'];

-- Le dossier porte l'identifiant du centre : seuls ses DP y déposent
drop policy if exists "Sites clubs : lecture" on storage.objects;
create policy "Sites clubs : lecture" on storage.objects for select
  using (bucket_id = 'sites-clubs');
drop policy if exists "Sites clubs : dépôt par les DP" on storage.objects;
create policy "Sites clubs : dépôt par les DP" on storage.objects for insert to authenticated
  with check (bucket_id = 'sites-clubs' and public.est_dp_centre(((storage.foldername(name))[1])::uuid));
drop policy if exists "Sites clubs : remplacement par les DP" on storage.objects;
create policy "Sites clubs : remplacement par les DP" on storage.objects for update to authenticated
  using (bucket_id = 'sites-clubs' and public.est_dp_centre(((storage.foldername(name))[1])::uuid));
drop policy if exists "Sites clubs : suppression par les DP" on storage.objects;
create policy "Sites clubs : suppression par les DP" on storage.objects for delete to authenticated
  using (bucket_id = 'sites-clubs' and public.est_dp_centre(((storage.foldername(name))[1])::uuid));

-- ------------------------------------------------------------
-- 3. Outils
-- ------------------------------------------------------------
-- « Centre de plongée le Lion » → « centre-de-plongee-le-lion »
create or replace function public.slug_texte(p text)
returns text
language sql
immutable
set search_path = public
as $$
  select trim(both '-' from regexp_replace(
    lower(translate(coalesce(p, ''),
      'ÀÁÂÃÄÅàáâãäåÇçÈÉÊËèéêëÌÍÎÏìíîïÑñÒÓÔÕÖòóôõöÙÚÛÜùúûüÝýÿŒœÆæ''’',
      'AAAAAAaaaaaaCcEEEEeeeeIIIIiiiiNnOOOOOoooooUUUUuuuuYyyOoAa--')),
    '[^a-z0-9]+', '-', 'g'));
$$;

-- Les zones déjà plongées par le club (sorties passées), pour pré-remplir
create or replace function public.zones_depuis_sorties(p_centre uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'nom', z.nom, 'profondeur', z.prof, 'niveau', '', 'description', coalesce(z.lieu, ''))
           order by z.nb desc), '[]'::jsonb)
  from (
    select min(s.site_name) as nom, max(s.profondeur_prevue) as prof, min(s.site_location) as lieu, count(*) as nb
    from public.sorties s
    where s.centre_id = p_centre and s.deleted_at is null and s.statut <> 'annulee' and btrim(s.site_name) <> ''
    group by lower(btrim(s.site_name))
    order by count(*) desc
    limit 12
  ) z;
$$;
revoke all on function public.zones_depuis_sorties(uuid) from public, anon, authenticated;

-- Ce que le site affiche : réglages du site + données vivantes du back-office
create or replace function public.contenu_site_club(p_centre uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_formations jsonb := '[]'::jsonb;
  v_bateaux jsonb := '[]'::jsonb;
  v_equipement jsonb := '[]'::jsonb;
  v_equipe jsonb;
begin
  -- Formations actives, avec leurs tarifs (si l'espace Formations est installé)
  if to_regclass('public.formations_catalogue') is not null then
    execute $f$
      select coalesce(jsonb_agg(jsonb_build_object(
               'code', f.code, 'intitule', f.intitule, 'organisme', f.organisme, 'categorie', f.categorie,
               'prix', f.prix, 'nb_theorie', f.nb_theorie, 'nb_pratique', f.nb_pratique,
               'prerequis', f.prerequis, 'description', f.description) order by f.ordre, f.code), '[]'::jsonb)
      from public.formations_catalogue f where f.centre_id = $1 and f.actif$f$
      into v_formations using p_centre;
  end if;

  -- Bateaux et matériel : des familles et des quantités, jamais de numéros de série
  if to_regclass('public.materiel_articles') is not null then
    execute $f$
      select coalesce(jsonb_agg(jsonb_build_object(
               'nom', coalesce(a.libelle, a.reference), 'modele', nullif(btrim(concat_ws(' ', a.marque, a.modele)), ''),
               'type', a.caracteristiques ->> 'type', 'places', a.caracteristiques ->> 'places',
               'longueur', a.caracteristiques ->> 'longueur', 'moteur', a.caracteristiques ->> 'moteur',
               'port', a.caracteristiques ->> 'port_attache', 'oxygene', a.caracteristiques ->> 'oxygene') order by a.reference), '[]'::jsonb)
      from public.materiel_articles a
      where a.centre_id = $1 and a.deleted_at is null and a.categorie = 'bateau' and a.etat <> 'hors_service'$f$
      into v_bateaux using p_centre;

    execute $f$
      select coalesce(jsonb_agg(jsonb_build_object('categorie', x.categorie, 'variante', x.variante, 'nb', x.nb)
               order by array_position(array['bloc','detendeur','combinaison','gilet','ordinateur','recycleur','autre'], x.categorie), x.variante), '[]'::jsonb)
      from (
        select a.categorie,
               coalesce(case a.categorie
                          when 'bloc' then a.caracteristiques ->> 'volume'
                          when 'detendeur' then a.caracteristiques ->> 'raccord'
                          else a.caracteristiques ->> 'type' end, '') as variante,
               count(*) as nb
        from public.materiel_articles a
        where a.centre_id = $1 and a.deleted_at is null and a.categorie <> 'bateau' and a.etat <> 'hors_service'
          and coalesce(a.caracteristiques ->> 'usage', '') <> 'Recycleur'
        group by 1, 2
      ) x$f$
      into v_equipement using p_centre;
  end if;

  -- Bateaux déclarés seulement dans le planning (sans inventaire détaillé)
  if v_bateaux = '[]'::jsonb then
    select coalesce(jsonb_agg(jsonb_build_object('nom', m.libelle, 'places', case when m.places is not null then m.places || ' plongeurs' end)), '[]'::jsonb)
      into v_bateaux
      from public.materiel m where m.centre_id = p_centre and m.deleted_at is null and m.type = 'bateau';
  end if;

  -- L'équipe encadrante (nom, rôle, niveau : rien d'autre)
  select coalesce(jsonb_agg(jsonb_build_object('nom', e.nom, 'role', e.role, 'niveau', e.niveau)
           order by array_position(array['dp','guide','pilote','gonfleur','autre'], e.role), e.nom), '[]'::jsonb)
    into v_equipe
    from public.centre_equipe e
   where e.centre_id = p_centre and e.actif and e.role in ('dp', 'guide', 'pilote');

  return (
    select jsonb_build_object(
      'site', to_jsonb(s) - 'created_at',
      'centre', jsonb_build_object('nom', c.nom, 'ville', c.ville, 'verifie', c.verifie),
      'formations', v_formations,
      'bateaux', v_bateaux,
      'equipement', v_equipement,
      'equipe', v_equipe)
    from public.club_sites s join public.centres c on c.id = s.centre_id
    where s.centre_id = p_centre);
end;
$$;
revoke all on function public.contenu_site_club(uuid) from public, anon, authenticated;

-- ------------------------------------------------------------
-- 4. Côté public : le site, par son adresse
-- ------------------------------------------------------------
create or replace function public.site_club_public(p_slug text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_site public.club_sites;
begin
  select * into v_site from public.club_sites where slug = lower(btrim(p_slug));
  if not found then return null; end if;
  -- Pas encore publié : visible seulement par les DP du club (aperçu)
  if not v_site.publie and not public.est_dp_centre(v_site.centre_id) then return null; end if;
  return public.contenu_site_club(v_site.centre_id);
end;
$$;
revoke all on function public.site_club_public(text) from public;
grant execute on function public.site_club_public(text) to anon, authenticated;

-- ------------------------------------------------------------
-- 5. Côté DP : « Mon site »
-- ------------------------------------------------------------
create or replace function public.mon_site_club(p_centre uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_nom text;
  v_ville text;
  v_slug text;
  v_n integer := 1;
begin
  if not public.est_dp_centre(p_centre) then raise exception 'réservé aux directeurs de plongée du centre'; end if;

  -- Premier passage : le site est créé (non publié), pré-rempli avec ce que le club sait déjà
  if not exists (select 1 from public.club_sites where centre_id = p_centre) then
    select nom, ville into v_nom, v_ville from public.centres where id = p_centre;
    v_slug := left(public.slug_texte(v_nom), 50);
    if length(v_slug) < 3 then v_slug := 'club-' || left(p_centre::text, 8); end if;
    while exists (select 1 from public.club_sites where slug = v_slug || case when v_n > 1 then '-' || v_n else '' end) loop
      v_n := v_n + 1;
    end loop;
    insert into public.club_sites (centre_id, slug, accroche, sous_titre, presentation, atouts, zones, saison, infos)
    values (p_centre, v_slug || case when v_n > 1 then '-' || v_n else '' end,
      'Plongez avec ' || v_nom,
      'Club de plongée' || coalesce(' à ' || nullif(btrim(v_ville), ''), '') || ' · baptêmes, formations et explorations',
      'Notre équipe de moniteurs vous accueille pour découvrir la plongée, passer vos niveaux et explorer les plus beaux sites de la région, en petit groupe et en toute sécurité.',
      '[{"titre": "Encadrement diplômé", "texte": "Des moniteurs et des directeurs de plongée qualifiés à chaque sortie."},
        {"titre": "Petits groupes", "texte": "Des palanquées réduites, pour profiter pleinement de chaque plongée."},
        {"titre": "Matériel entretenu", "texte": "Blocs, détendeurs et combinaisons contrôlés et révisés chaque saison."}]'::jsonb,
      public.zones_depuis_sorties(p_centre),
      'D''avril à novembre',
      'Certificat médical d''absence de contre-indication à la plongée obligatoire pour les formations. Pensez à apporter votre maillot, une serviette et votre carnet de plongée.');
  end if;

  return public.contenu_site_club(p_centre)
    || jsonb_build_object('zones_sorties', public.zones_depuis_sorties(p_centre));
end;
$$;
revoke all on function public.mon_site_club(uuid) from public, anon;
grant execute on function public.mon_site_club(uuid) to authenticated;

create or replace function public.enregistrer_site_club(p_centre uuid, p jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_slug text := left(public.slug_texte(p ->> 'slug'), 60);
  t text;
begin
  if not public.est_dp_centre(p_centre) then raise exception 'réservé aux directeurs de plongée du centre'; end if;
  if length(v_slug) < 3 then raise exception 'adresse trop courte : 3 caractères au moins'; end if;
  if exists (select 1 from public.club_sites where slug = v_slug and centre_id <> p_centre) then
    raise exception 'adresse déjà prise par un autre club';
  end if;
  foreach t in array array['couleur_accent', 'couleur_secondaire', 'couleur_tertiaire', 'couleur_fond', 'couleur_texte'] loop
    if p ? t and coalesce(p ->> t, '') !~ '^#[0-9A-Fa-f]{6}$' then raise exception 'couleur invalide : %', p ->> t; end if;
  end loop;

  update public.club_sites set
    slug = v_slug,
    publie = coalesce((p ->> 'publie')::boolean, publie),
    modele = coalesce(nullif(p ->> 'modele', ''), modele),
    couleur_accent = coalesce(p ->> 'couleur_accent', couleur_accent),
    couleur_secondaire = coalesce(p ->> 'couleur_secondaire', couleur_secondaire),
    couleur_tertiaire = coalesce(p ->> 'couleur_tertiaire', couleur_tertiaire),
    couleur_fond = coalesce(p ->> 'couleur_fond', couleur_fond),
    couleur_texte = coalesce(p ->> 'couleur_texte', couleur_texte),
    logo_url = case when p ? 'logo_url' then nullif(p ->> 'logo_url', '') else logo_url end,
    couverture_url = case when p ? 'couverture_url' then nullif(p ->> 'couverture_url', '') else couverture_url end,
    accroche = case when p ? 'accroche' then nullif(btrim(p ->> 'accroche'), '') else accroche end,
    sous_titre = case when p ? 'sous_titre' then nullif(btrim(p ->> 'sous_titre'), '') else sous_titre end,
    presentation = case when p ? 'presentation' then nullif(btrim(p ->> 'presentation'), '') else presentation end,
    atouts = case when jsonb_typeof(p -> 'atouts') = 'array' then p -> 'atouts' else atouts end,
    zones = case when jsonb_typeof(p -> 'zones') = 'array' then p -> 'zones' else zones end,
    adresse = case when p ? 'adresse' then nullif(btrim(p ->> 'adresse'), '') else adresse end,
    telephone = case when p ? 'telephone' then nullif(btrim(p ->> 'telephone'), '') else telephone end,
    email = case when p ? 'email' then nullif(btrim(p ->> 'email'), '') else email end,
    horaires = case when p ? 'horaires' then nullif(btrim(p ->> 'horaires'), '') else horaires end,
    saison = case when p ? 'saison' then nullif(btrim(p ->> 'saison'), '') else saison end,
    infos = case when p ? 'infos' then nullif(btrim(p ->> 'infos'), '') else infos end,
    sections = case when jsonb_typeof(p -> 'sections') = 'object' then sections || (p -> 'sections') else sections end
  where centre_id = p_centre;

  return public.contenu_site_club(p_centre);
end;
$$;
revoke all on function public.enregistrer_site_club(uuid, jsonb) from public, anon;
grant execute on function public.enregistrer_site_club(uuid, jsonb) to authenticated;
