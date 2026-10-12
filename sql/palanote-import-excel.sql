-- ============================================================
-- Palanote — Import Excel pour les clubs
--
-- Un club arrive sur Palanote avec ses fichiers Excel, avant que ses plongeurs aient l'app :
--   · les adhérents : prénom, nom, e-mail, téléphone, niveau, licence, fin du certificat médical ;
--   · l'historique de leurs plongées avec le club : date, site, profondeur, durée, palanquée ;
--   · l'équipe (encadrants, pilotes) et le matériel (bateaux, blocs, gilets…).
-- Quand un adhérent crée son compte Palanote avec la même adresse e-mail, il retrouve
-- ses plongées du club et peut les ajouter à son carnet (il est le seul à voir les siennes).
-- Les plongeurs d'une sortie s'importent avec ajouter_noms_prevus (palanote-sorties-club.sql).
--
-- Prérequis : palanote-sorties-club.sql, palanote-planning-club.sql (est_dp_centre,
--             centre_equipe, materiel) et palanote-page-amis.sql (update_updated_at_column).
-- À coller dans Supabase → SQL Editor → Run. Relançable sans risque.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Tables
-- ------------------------------------------------------------
create table if not exists public.centre_adherents (
  id uuid primary key default gen_random_uuid(),
  centre_id uuid not null references public.centres(id) on delete cascade,
  prenom text not null,
  nom text,
  email text,
  telephone text,
  niveau text,
  licence text,
  certificat_fin date, -- fin de validité du certificat médical
  adhesion date,
  note text,
  user_id uuid references auth.users(id) on delete set null, -- son compte Palanote, retrouvé par l'e-mail
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint centre_adherents_prenom_check check (char_length(btrim(prenom)) between 1 and 60),
  constraint centre_adherents_email_check check (email is null or email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')
);
create index if not exists centre_adherents_centre_idx on public.centre_adherents (centre_id);
create unique index if not exists centre_adherents_email_unique on public.centre_adherents (centre_id, lower(email)) where email is not null;
create index if not exists centre_adherents_email_idx on public.centre_adherents (lower(email));

create table if not exists public.adherent_plongees (
  id uuid primary key default gen_random_uuid(),
  centre_id uuid not null references public.centres(id) on delete cascade,
  adherent_id uuid not null references public.centre_adherents(id) on delete cascade,
  date_plongee date not null,
  heure time,
  site text,
  lieu text,
  profondeur numeric(5,1),
  duree integer,
  palanquee text,
  role text, -- « GP », « Plongeur », « Élève »…
  note text,
  dive_id uuid references public.dives(id) on delete set null, -- une fois ajoutée au carnet
  recuperee_le timestamptz, -- ajoutée au carnet, ou écartée par le plongeur
  created_at timestamptz not null default now(),
  constraint adherent_plongees_prof_check check (profondeur is null or profondeur between 0 and 350),
  constraint adherent_plongees_duree_check check (duree is null or duree between 1 and 600)
);
create unique index if not exists adherent_plongees_unique on public.adherent_plongees (adherent_id, date_plongee, lower(coalesce(site, '')), coalesce(heure, '00:00'));
create index if not exists adherent_plongees_centre_idx on public.adherent_plongees (centre_id);

grant select on public.centre_adherents, public.adherent_plongees to authenticated;
grant all on public.centre_adherents, public.adherent_plongees to service_role;
alter table public.centre_adherents enable row level security;
alter table public.adherent_plongees enable row level security;
drop policy if exists "DP : lire les adhérents" on public.centre_adherents;
create policy "DP : lire les adhérents" on public.centre_adherents for select to authenticated using (public.est_dp_centre(centre_id));
drop policy if exists "DP : lire l'historique" on public.adherent_plongees;
create policy "DP : lire l'historique" on public.adherent_plongees for select to authenticated using (public.est_dp_centre(centre_id));
-- Écritures et lecture côté plongeur : uniquement par les fonctions ci-dessous.

drop trigger if exists centre_adherents_updated_at on public.centre_adherents;
create trigger centre_adherents_updated_at before update on public.centre_adherents
  for each row execute function public.update_updated_at_column();

-- Petits outils de nettoyage des cellules
create or replace function public.cellule(p jsonb, p_cle text)
returns text
language sql
immutable
as $$
  select nullif(btrim(p ->> p_cle), '');
$$;

create or replace function public.cellule_nombre(p jsonb, p_cle text)
returns numeric
language plpgsql
immutable
as $$
begin
  return nullif(replace(regexp_replace(coalesce(p ->> p_cle, ''), '[^0-9,.\-]', '', 'g'), ',', '.'), '')::numeric;
exception when others then
  return null;
end;
$$;

create or replace function public.cellule_date(p jsonb, p_cle text)
returns date
language plpgsql
immutable
as $$
begin
  return nullif(btrim(p ->> p_cle), '')::date; -- l'app envoie des dates AAAA-MM-JJ
exception when others then
  return null;
end;
$$;

create or replace function public.cellule_heure(p jsonb, p_cle text)
returns time
language plpgsql
immutable
as $$
begin
  return nullif(btrim(p ->> p_cle), '')::time;
exception when others then
  return null;
end;
$$;

-- Retrouve le compte Palanote des adhérents par leur e-mail
create or replace function public.lier_adherents(p_centre uuid)
returns void
language sql
volatile
security definer
set search_path = public
as $$
  update public.centre_adherents a set user_id = u.id
  from auth.users u
  where a.centre_id = p_centre and a.user_id is null and a.email is not null and lower(u.email) = lower(a.email);
$$;
revoke all on function public.lier_adherents(uuid) from public, anon, authenticated;

-- ------------------------------------------------------------
-- 2. Imports du DP (une ligne du tableur = un objet JSON)
-- ------------------------------------------------------------
-- Adhérents : mis à jour s'ils existent déjà (même e-mail, ou même prénom et nom)
create or replace function public.importer_adherents(p_centre uuid, p_lignes jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  l jsonb;
  v_id uuid;
  v_email text;
  v_prenom text;
  v_nom text;
  v_ajoutes integer := 0;
  v_maj integer := 0;
  v_ignorees integer := 0;
begin
  if not public.est_dp_centre(p_centre) then raise exception 'réservé aux directeurs de plongée du centre'; end if;
  if jsonb_array_length(coalesce(p_lignes, '[]'::jsonb)) > 3000 then raise exception 'fichier trop long (3 000 lignes au plus)'; end if;
  for l in select * from jsonb_array_elements(coalesce(p_lignes, '[]'::jsonb)) loop
    v_prenom := left(public.cellule(l, 'prenom'), 60);
    v_nom := left(public.cellule(l, 'nom'), 80);
    v_email := lower(public.cellule(l, 'email'));
    if v_email is not null and v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then v_email := null; end if;
    if v_prenom is null then
      v_ignorees := v_ignorees + 1;
      continue;
    end if;
    v_id := null;
    if v_email is not null then
      select id into v_id from public.centre_adherents where centre_id = p_centre and lower(email) = v_email;
    end if;
    if v_id is null then
      select id into v_id from public.centre_adherents
      where centre_id = p_centre and lower(prenom) = lower(v_prenom) and lower(coalesce(nom, '')) = lower(coalesce(v_nom, ''))
        and (email is null or v_email is null)
      limit 1;
    end if;
    if v_id is null then
      insert into public.centre_adherents (centre_id, prenom, nom, email, telephone, niveau, licence, certificat_fin, adhesion, note)
      values (p_centre, v_prenom, v_nom, v_email, left(public.cellule(l, 'telephone'), 30), left(public.cellule(l, 'niveau'), 40),
              left(public.cellule(l, 'licence'), 40), public.cellule_date(l, 'certificat_fin'), public.cellule_date(l, 'adhesion'),
              left(public.cellule(l, 'note'), 500));
      v_ajoutes := v_ajoutes + 1;
    else
      update public.centre_adherents set
        prenom = v_prenom,
        nom = coalesce(v_nom, nom),
        email = coalesce(v_email, email),
        telephone = coalesce(left(public.cellule(l, 'telephone'), 30), telephone),
        niveau = coalesce(left(public.cellule(l, 'niveau'), 40), niveau),
        licence = coalesce(left(public.cellule(l, 'licence'), 40), licence),
        certificat_fin = coalesce(public.cellule_date(l, 'certificat_fin'), certificat_fin),
        adhesion = coalesce(public.cellule_date(l, 'adhesion'), adhesion),
        note = coalesce(left(public.cellule(l, 'note'), 500), note)
      where id = v_id;
      v_maj := v_maj + 1;
    end if;
  end loop;
  perform public.lier_adherents(p_centre);
  return jsonb_build_object('ajoutes', v_ajoutes, 'mis_a_jour', v_maj, 'ignorees', v_ignorees);
end;
$$;
revoke all on function public.importer_adherents(uuid, jsonb) from public, anon;
grant execute on function public.importer_adherents(uuid, jsonb) to authenticated;

-- Historique des plongées : une ligne = une plongée d'un adhérent (créé s'il manque)
create or replace function public.importer_historique(p_centre uuid, p_lignes jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  l jsonb;
  v_adh uuid;
  v_email text;
  v_prenom text;
  v_nom text;
  v_date date;
  v_prof numeric;
  v_duree integer;
  v_plongees integer := 0;
  v_nouveaux integer := 0;
  v_ignorees integer := 0;
  v_doublons integer := 0;
begin
  if not public.est_dp_centre(p_centre) then raise exception 'réservé aux directeurs de plongée du centre'; end if;
  if jsonb_array_length(coalesce(p_lignes, '[]'::jsonb)) > 10000 then raise exception 'fichier trop long (10 000 lignes au plus)'; end if;
  for l in select * from jsonb_array_elements(coalesce(p_lignes, '[]'::jsonb)) loop
    v_prenom := left(public.cellule(l, 'prenom'), 60);
    v_nom := left(public.cellule(l, 'nom'), 80);
    v_email := lower(public.cellule(l, 'email'));
    if v_email is not null and v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then v_email := null; end if;
    v_date := public.cellule_date(l, 'date');
    if v_date is null or v_date > current_date or (v_prenom is null and v_email is null) then
      v_ignorees := v_ignorees + 1;
      continue;
    end if;
    v_adh := null;
    if v_email is not null then
      select id into v_adh from public.centre_adherents where centre_id = p_centre and lower(email) = v_email;
    end if;
    if v_adh is null and v_prenom is not null then
      select id into v_adh from public.centre_adherents
      where centre_id = p_centre and lower(prenom) = lower(v_prenom) and lower(coalesce(nom, '')) = lower(coalesce(v_nom, ''))
      limit 1;
    end if;
    if v_adh is null then
      insert into public.centre_adherents (centre_id, prenom, nom, email, niveau)
      values (p_centre, coalesce(v_prenom, split_part(v_email, '@', 1)), v_nom, v_email, left(public.cellule(l, 'niveau'), 40))
      returning id into v_adh;
      v_nouveaux := v_nouveaux + 1;
    end if;
    v_prof := public.cellule_nombre(l, 'profondeur');
    if v_prof is not null and (v_prof < 0 or v_prof > 350) then v_prof := null; end if;
    v_duree := round(public.cellule_nombre(l, 'duree'))::integer;
    if v_duree is not null and (v_duree < 1 or v_duree > 600) then v_duree := null; end if;
    insert into public.adherent_plongees (centre_id, adherent_id, date_plongee, heure, site, lieu, profondeur, duree, palanquee, role, note)
    values (p_centre, v_adh, v_date, public.cellule_heure(l, 'heure'), left(public.cellule(l, 'site'), 120), left(public.cellule(l, 'lieu'), 120),
            v_prof, v_duree, left(public.cellule(l, 'palanquee'), 20), left(public.cellule(l, 'role'), 40), left(public.cellule(l, 'note'), 500))
    on conflict do nothing;
    if found then v_plongees := v_plongees + 1; else v_doublons := v_doublons + 1; end if;
  end loop;
  perform public.lier_adherents(p_centre);
  return jsonb_build_object('plongees', v_plongees, 'nouveaux_adherents', v_nouveaux, 'doublons', v_doublons, 'ignorees', v_ignorees);
end;
$$;
revoke all on function public.importer_historique(uuid, jsonb) from public, anon;
grant execute on function public.importer_historique(uuid, jsonb) to authenticated;

-- Équipe : mise à jour par le nom (encadrants sans compte), sinon ajout
create or replace function public.importer_equipe(p_centre uuid, p_lignes jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  l jsonb;
  v_nom text;
  v_role text;
  v_id uuid;
  v_ajoutes integer := 0;
  v_maj integer := 0;
begin
  if not public.est_dp_centre(p_centre) then raise exception 'réservé aux directeurs de plongée du centre'; end if;
  if jsonb_array_length(coalesce(p_lignes, '[]'::jsonb)) > 500 then raise exception 'fichier trop long (500 lignes au plus)'; end if;
  for l in select * from jsonb_array_elements(coalesce(p_lignes, '[]'::jsonb)) loop
    v_nom := left(public.cellule(l, 'nom'), 80);
    if v_nom is null then continue; end if;
    v_role := coalesce(public.cellule(l, 'role'), 'guide');
    if v_role not in ('dp', 'guide', 'pilote', 'gonfleur', 'autre') then v_role := 'autre'; end if;
    select id into v_id from public.centre_equipe where centre_id = p_centre and lower(nom) = lower(v_nom) limit 1;
    if v_id is null then
      insert into public.centre_equipe (centre_id, nom, role, niveau, telephone)
      values (p_centre, v_nom, v_role, left(public.cellule(l, 'niveau'), 40), left(public.cellule(l, 'telephone'), 30));
      v_ajoutes := v_ajoutes + 1;
    else
      update public.centre_equipe set role = v_role, actif = true,
        niveau = coalesce(left(public.cellule(l, 'niveau'), 40), niveau),
        telephone = coalesce(left(public.cellule(l, 'telephone'), 30), telephone)
      where id = v_id;
      v_maj := v_maj + 1;
    end if;
  end loop;
  return jsonb_build_object('ajoutes', v_ajoutes, 'mis_a_jour', v_maj);
end;
$$;
revoke all on function public.importer_equipe(uuid, jsonb) from public, anon;
grant execute on function public.importer_equipe(uuid, jsonb) to authenticated;

-- Matériel : mise à jour par le type et le libellé, sinon ajout
create or replace function public.importer_materiel(p_centre uuid, p_lignes jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  l jsonb;
  v_type text;
  v_libelle text;
  v_qte integer;
  v_places integer;
  v_id uuid;
  v_ajoutes integer := 0;
  v_maj integer := 0;
begin
  if not public.est_dp_centre(p_centre) then raise exception 'réservé aux directeurs de plongée du centre'; end if;
  if jsonb_array_length(coalesce(p_lignes, '[]'::jsonb)) > 1000 then raise exception 'fichier trop long (1 000 lignes au plus)'; end if;
  for l in select * from jsonb_array_elements(coalesce(p_lignes, '[]'::jsonb)) loop
    v_libelle := left(public.cellule(l, 'libelle'), 80);
    if v_libelle is null then continue; end if;
    v_type := coalesce(public.cellule(l, 'type'), 'autre');
    if v_type not in ('bateau', 'bloc', 'gilet', 'detendeur', 'combinaison', 'ordinateur', 'autre') then v_type := 'autre'; end if;
    v_qte := least(999, greatest(0, coalesce(round(public.cellule_nombre(l, 'quantite'))::integer, 1)));
    v_places := case when v_type = 'bateau' then least(200, greatest(1, coalesce(round(public.cellule_nombre(l, 'places'))::integer, 12))) end;
    select id into v_id from public.materiel where centre_id = p_centre and type = v_type and lower(libelle) = lower(v_libelle) and deleted_at is null limit 1;
    if v_id is null then
      insert into public.materiel (centre_id, type, libelle, quantite, places, prochain_controle, note)
      values (p_centre, v_type, v_libelle, case when v_type = 'bateau' then 1 else v_qte end, v_places,
              public.cellule_date(l, 'controle'), left(public.cellule(l, 'note'), 300));
      v_ajoutes := v_ajoutes + 1;
    else
      update public.materiel set
        quantite = case when v_type = 'bateau' then 1 else v_qte end,
        places = coalesce(v_places, places),
        prochain_controle = coalesce(public.cellule_date(l, 'controle'), prochain_controle),
        note = coalesce(left(public.cellule(l, 'note'), 300), note)
      where id = v_id;
      v_maj := v_maj + 1;
    end if;
  end loop;
  return jsonb_build_object('ajoutes', v_ajoutes, 'mis_a_jour', v_maj);
end;
$$;
revoke all on function public.importer_materiel(uuid, jsonb) from public, anon;
grant execute on function public.importer_materiel(uuid, jsonb) to authenticated;

-- ------------------------------------------------------------
-- 3. Lecture côté DP : les adhérents et leur suivi
-- ------------------------------------------------------------
create or replace function public.adherents_centre(p_centre uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  if not public.est_dp_centre(p_centre) then raise exception 'réservé aux directeurs de plongée du centre'; end if;
  perform public.lier_adherents(p_centre);
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', a.id, 'prenom', a.prenom, 'nom', a.nom, 'email', a.email, 'telephone', a.telephone, 'niveau', a.niveau,
      'licence', a.licence, 'certificat_fin', a.certificat_fin, 'adhesion', a.adhesion, 'note', a.note,
      'sur_palanote', a.user_id is not null,
      'plongees', (select count(*) from public.adherent_plongees h where h.adherent_id = a.id),
      'derniere', (select max(h.date_plongee) from public.adherent_plongees h where h.adherent_id = a.id),
      'prof_max', (select max(h.profondeur) from public.adherent_plongees h where h.adherent_id = a.id),
      'recuperees', (select count(*) from public.adherent_plongees h where h.adherent_id = a.id and h.dive_id is not null),
      'sorties', case when a.user_id is null then 0 else (
        select count(distinct s.id) from public.sortie_participants p join public.sorties s on s.id = p.sortie_id
        where p.user_id = a.user_id and s.centre_id = p_centre and s.statut in ('terminee', 'validee')) end)
      order by lower(coalesce(a.nom, '')), lower(a.prenom))
    from public.centre_adherents a where a.centre_id = p_centre), '[]'::jsonb);
end;
$$;
revoke all on function public.adherents_centre(uuid) from public, anon;
grant execute on function public.adherents_centre(uuid) to authenticated;

create or replace function public.supprimer_adherent(p_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_centre uuid;
begin
  select centre_id into v_centre from public.centre_adherents where id = p_id;
  if v_centre is null or not public.est_dp_centre(v_centre) then raise exception 'adhérent introuvable'; end if;
  delete from public.centre_adherents where id = p_id;
end;
$$;
revoke all on function public.supprimer_adherent(uuid) from public, anon;
grant execute on function public.supprimer_adherent(uuid) to authenticated;

-- ------------------------------------------------------------
-- 4. Côté plongeur : retrouver ses plongées gardées par son club
-- ------------------------------------------------------------
-- Les plongées pas encore récupérées, rattachées à mon adresse e-mail, centre par centre
create or replace function public.mon_historique_club()
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_email text;
begin
  if auth.uid() is null then return '[]'::jsonb; end if;
  select lower(email) into v_email from auth.users where id = auth.uid();
  if v_email is null then return '[]'::jsonb; end if;
  update public.centre_adherents set user_id = auth.uid() where lower(email) = v_email and user_id is null;
  return coalesce((
    select jsonb_agg(jsonb_build_object('centre_id', c.id, 'centre', c.nom, 'ville', c.ville, 'plongees', t.plongees) order by c.nom)
    from (
      select a.centre_id,
             jsonb_agg(jsonb_build_object('id', h.id, 'date', h.date_plongee, 'heure', h.heure, 'site', h.site, 'lieu', h.lieu,
                                          'profondeur', h.profondeur, 'duree', h.duree, 'palanquee', h.palanquee, 'role', h.role, 'note', h.note)
                       order by h.date_plongee) as plongees
      from public.centre_adherents a
      join public.adherent_plongees h on h.adherent_id = a.id
      where a.user_id = auth.uid() and h.recuperee_le is null
      group by a.centre_id
    ) t join public.centres c on c.id = t.centre_id), '[]'::jsonb);
end;
$$;
revoke all on function public.mon_historique_club() from public, anon;
grant execute on function public.mon_historique_club() to authenticated;

-- Après l'ajout au carnet (ou si le plongeur n'en veut pas) : ne plus les proposer
create or replace function public.marquer_historique_club(p_centre uuid)
returns integer
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_nb integer;
begin
  update public.adherent_plongees h set recuperee_le = now()
  from public.centre_adherents a
  where a.id = h.adherent_id and a.user_id = auth.uid() and a.centre_id = p_centre and h.recuperee_le is null;
  get diagnostics v_nb = row_count;
  return v_nb;
end;
$$;
revoke all on function public.marquer_historique_club(uuid) from public, anon;
grant execute on function public.marquer_historique_club(uuid) to authenticated;
