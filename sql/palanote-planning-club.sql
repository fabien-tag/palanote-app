-- ============================================================
-- Palanote — Le poste de pilotage du directeur de plongée (version ordinateur)
--
--   · Planning : les sorties du centre en calendrier (semaine, mois), qu'on déplace
--     d'un jour à l'autre ; les plongeurs inscrits sont prévenus.
--   · Équipe : les encadrants du centre (DP, guides, pilotes, gonfleurs), avec ou sans
--     compte Palanote, affectés aux sorties.
--   · Matériel : bateaux (places), blocs, gilets, détendeurs, combinaisons…, avec
--     la date du prochain contrôle, réservés par sortie.
--
-- Prérequis : palanote-sorties-club.sql (centres, sorties, notifier, texte_sortie)
--             et palanote-page-amis.sql (infos_plongeur, update_updated_at_column).
-- À coller dans Supabase → SQL Editor → Run. Relançable sans risque.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Tables
-- ------------------------------------------------------------
create table if not exists public.centre_equipe (
  id uuid primary key default gen_random_uuid(),
  centre_id uuid not null references public.centres(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null, -- vide = encadrant sans compte (un pilote, par exemple)
  nom text not null,
  role text not null default 'guide',
  niveau text,
  telephone text,
  actif boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint centre_equipe_role_check check (role in ('dp', 'guide', 'pilote', 'gonfleur', 'autre')),
  constraint centre_equipe_nom_check check (char_length(btrim(nom)) between 1 and 80),
  constraint centre_equipe_unique unique (centre_id, user_id)
);
create index if not exists centre_equipe_centre_idx on public.centre_equipe (centre_id);

create table if not exists public.materiel (
  id uuid primary key default gen_random_uuid(),
  centre_id uuid not null references public.centres(id) on delete cascade,
  type text not null,
  libelle text not null,
  quantite integer not null default 1,
  places integer, -- pour un bateau : nombre de plongeurs à bord
  prochain_controle date, -- révision, inspection des blocs…
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint materiel_type_check check (type in ('bateau', 'bloc', 'gilet', 'detendeur', 'combinaison', 'ordinateur', 'autre')),
  constraint materiel_libelle_check check (char_length(btrim(libelle)) between 1 and 80),
  constraint materiel_quantite_check check (quantite between 0 and 999),
  constraint materiel_places_check check (places is null or places between 1 and 200)
);
create index if not exists materiel_centre_idx on public.materiel (centre_id);

create table if not exists public.sortie_equipe (
  sortie_id uuid not null references public.sorties(id) on delete cascade,
  equipier_id uuid not null references public.centre_equipe(id) on delete cascade,
  role text not null default 'guide',
  created_at timestamptz not null default now(),
  primary key (sortie_id, equipier_id),
  constraint sortie_equipe_role_check check (role in ('dp', 'guide', 'pilote', 'gonfleur', 'autre'))
);

create table if not exists public.sortie_materiel (
  sortie_id uuid not null references public.sorties(id) on delete cascade,
  materiel_id uuid not null references public.materiel(id) on delete cascade,
  quantite integer not null default 1,
  primary key (sortie_id, materiel_id),
  constraint sortie_materiel_quantite_check check (quantite between 1 and 999)
);

alter table public.sorties add column if not exists bateau_id uuid references public.materiel(id) on delete set null;

grant select on public.centre_equipe, public.materiel, public.sortie_equipe, public.sortie_materiel to authenticated;
grant all on public.centre_equipe, public.materiel, public.sortie_equipe, public.sortie_materiel to service_role;
alter table public.centre_equipe enable row level security;
alter table public.materiel enable row level security;
alter table public.sortie_equipe enable row level security;
alter table public.sortie_materiel enable row level security;

-- Seuls les DP du centre voient son équipe et son matériel. Les écritures passent par les fonctions.
create or replace function public.est_dp_centre(p_centre uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.centre_membres m where m.centre_id = p_centre and m.user_id = auth.uid() and m.role = 'dp');
$$;
revoke all on function public.est_dp_centre(uuid) from public, anon;
grant execute on function public.est_dp_centre(uuid) to authenticated;

drop policy if exists "DP : lire l'équipe" on public.centre_equipe;
create policy "DP : lire l'équipe" on public.centre_equipe for select to authenticated using (public.est_dp_centre(centre_id));
drop policy if exists "DP : lire le matériel" on public.materiel;
create policy "DP : lire le matériel" on public.materiel for select to authenticated using (public.est_dp_centre(centre_id));
drop policy if exists "DP : lire les affectations" on public.sortie_equipe;
create policy "DP : lire les affectations" on public.sortie_equipe for select to authenticated using (public.est_dp_sortie(sortie_id));
drop policy if exists "DP : lire les réservations" on public.sortie_materiel;
create policy "DP : lire les réservations" on public.sortie_materiel for select to authenticated using (public.est_dp_sortie(sortie_id));

drop trigger if exists centre_equipe_updated_at on public.centre_equipe;
create trigger centre_equipe_updated_at before update on public.centre_equipe
  for each row execute function public.update_updated_at_column();
drop trigger if exists materiel_updated_at on public.materiel;
create trigger materiel_updated_at before update on public.materiel
  for each row execute function public.update_updated_at_column();

-- ------------------------------------------------------------
-- 2. Équipe
-- ------------------------------------------------------------
-- Les DP du centre (membres Palanote) entrent d'eux-mêmes dans l'équipe.
create or replace function public.synchroniser_equipe(p_centre uuid)
returns void
language sql
volatile
security definer
set search_path = public
as $$
  insert into public.centre_equipe (centre_id, user_id, nom, role, niveau)
  select m.centre_id, m.user_id, public.infos_plongeur(m.user_id) ->> 'prenom', 'dp', public.infos_plongeur(m.user_id) ->> 'niveau'
  from public.centre_membres m
  where m.centre_id = p_centre and m.role = 'dp'
  on conflict (centre_id, user_id) do nothing;
$$;
revoke all on function public.synchroniser_equipe(uuid) from public, anon, authenticated;

create or replace function public.ligne_equipier(e public.centre_equipe)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object('id', e.id, 'user_id', e.user_id, 'nom', e.nom, 'role', e.role, 'niveau', e.niveau,
                            'telephone', e.telephone, 'actif', e.actif);
$$;
revoke all on function public.ligne_equipier(public.centre_equipe) from public, anon, authenticated;

create or replace function public.equipe_centre(p_centre uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  if not public.est_dp_centre(p_centre) then raise exception 'réservé aux directeurs de plongée du centre'; end if;
  perform public.synchroniser_equipe(p_centre);
  return coalesce((
    select jsonb_agg(public.ligne_equipier(e) order by e.actif desc,
             array_position(array['dp', 'guide', 'pilote', 'gonfleur', 'autre'], e.role), e.nom)
    from public.centre_equipe e where e.centre_id = p_centre), '[]'::jsonb);
end;
$$;
revoke all on function public.equipe_centre(uuid) from public, anon;
grant execute on function public.equipe_centre(uuid) to authenticated;

-- Ajouter (p_id vide) ou modifier un équipier
create or replace function public.enregistrer_equipier(
  p_centre uuid, p_id uuid, p_nom text, p_role text, p_niveau text default null, p_telephone text default null, p_actif boolean default true)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  e public.centre_equipe;
begin
  if not public.est_dp_centre(p_centre) then raise exception 'réservé aux directeurs de plongée du centre'; end if;
  if p_id is null then
    insert into public.centre_equipe (centre_id, nom, role, niveau, telephone)
    values (p_centre, btrim(p_nom), p_role, nullif(btrim(coalesce(p_niveau, '')), ''), nullif(btrim(coalesce(p_telephone, '')), ''))
    returning * into e;
  else
    update public.centre_equipe
      set nom = btrim(p_nom), role = p_role, niveau = nullif(btrim(coalesce(p_niveau, '')), ''),
          telephone = nullif(btrim(coalesce(p_telephone, '')), ''), actif = coalesce(p_actif, true)
      where id = p_id and centre_id = p_centre
      returning * into e;
    if e.id is null then raise exception 'équipier introuvable'; end if;
  end if;
  return public.ligne_equipier(e);
end;
$$;
revoke all on function public.enregistrer_equipier(uuid, uuid, text, text, text, text, boolean) from public, anon;
grant execute on function public.enregistrer_equipier(uuid, uuid, text, text, text, text, boolean) to authenticated;

-- Affecter un équipier à une sortie (p_role vide = le retirer)
create or replace function public.affecter_equipier(p_sortie uuid, p_equipier uuid, p_role text)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  if not public.est_dp_sortie(p_sortie) then raise exception 'réservé au directeur de plongée'; end if;
  if not exists (select 1 from public.centre_equipe e join public.sorties s on s.centre_id = e.centre_id
                 where e.id = p_equipier and s.id = p_sortie) then
    raise exception 'équipier d''un autre centre';
  end if;
  if p_role is null or p_role = '' then
    delete from public.sortie_equipe where sortie_id = p_sortie and equipier_id = p_equipier;
  else
    insert into public.sortie_equipe (sortie_id, equipier_id, role) values (p_sortie, p_equipier, p_role)
    on conflict (sortie_id, equipier_id) do update set role = excluded.role;
  end if;
end;
$$;
revoke all on function public.affecter_equipier(uuid, uuid, text) from public, anon;
grant execute on function public.affecter_equipier(uuid, uuid, text) to authenticated;

-- ------------------------------------------------------------
-- 3. Matériel
-- ------------------------------------------------------------
create or replace function public.ligne_materiel(m public.materiel)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object('id', m.id, 'type', m.type, 'libelle', m.libelle, 'quantite', m.quantite,
                            'places', m.places, 'prochain_controle', m.prochain_controle, 'note', m.note);
$$;
revoke all on function public.ligne_materiel(public.materiel) from public, anon, authenticated;

create or replace function public.materiel_centre(p_centre uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.est_dp_centre(p_centre) then raise exception 'réservé aux directeurs de plongée du centre'; end if;
  return coalesce((
    select jsonb_agg(public.ligne_materiel(m) order by
             array_position(array['bateau', 'bloc', 'gilet', 'detendeur', 'combinaison', 'ordinateur', 'autre'], m.type), m.libelle)
    from public.materiel m where m.centre_id = p_centre and m.deleted_at is null), '[]'::jsonb);
end;
$$;
revoke all on function public.materiel_centre(uuid) from public, anon;
grant execute on function public.materiel_centre(uuid) to authenticated;

-- Ajouter (p_id vide) ou modifier un matériel
create or replace function public.enregistrer_materiel(
  p_centre uuid, p_id uuid, p_type text, p_libelle text, p_quantite integer default 1,
  p_places integer default null, p_controle date default null, p_note text default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  m public.materiel;
begin
  if not public.est_dp_centre(p_centre) then raise exception 'réservé aux directeurs de plongée du centre'; end if;
  if p_id is null then
    insert into public.materiel (centre_id, type, libelle, quantite, places, prochain_controle, note)
    values (p_centre, p_type, btrim(p_libelle), coalesce(p_quantite, 1), case when p_type = 'bateau' then p_places end,
            p_controle, nullif(btrim(coalesce(p_note, '')), ''))
    returning * into m;
  else
    update public.materiel
      set type = p_type, libelle = btrim(p_libelle), quantite = coalesce(p_quantite, 1),
          places = case when p_type = 'bateau' then p_places end, prochain_controle = p_controle,
          note = nullif(btrim(coalesce(p_note, '')), '')
      where id = p_id and centre_id = p_centre and deleted_at is null
      returning * into m;
    if m.id is null then raise exception 'matériel introuvable'; end if;
    -- Le nom du bateau suit sur les sorties à venir
    if m.type = 'bateau' then
      update public.sorties set bateau = m.libelle where bateau_id = m.id and statut = 'prevue';
    end if;
  end if;
  return public.ligne_materiel(m);
end;
$$;
revoke all on function public.enregistrer_materiel(uuid, uuid, text, text, integer, integer, date, text) from public, anon;
grant execute on function public.enregistrer_materiel(uuid, uuid, text, text, integer, integer, date, text) to authenticated;

create or replace function public.retirer_materiel(p_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_centre uuid;
begin
  select centre_id into v_centre from public.materiel where id = p_id and deleted_at is null;
  if v_centre is null or not public.est_dp_centre(v_centre) then raise exception 'matériel introuvable'; end if;
  update public.materiel set deleted_at = now() where id = p_id;
  delete from public.sortie_materiel sm using public.sorties s
    where sm.materiel_id = p_id and s.id = sm.sortie_id and s.statut = 'prevue';
  update public.sorties set bateau_id = null where bateau_id = p_id and statut = 'prevue';
end;
$$;
revoke all on function public.retirer_materiel(uuid) from public, anon;
grant execute on function public.retirer_materiel(uuid) to authenticated;

-- Réserver une quantité pour une sortie (0 = annuler la réservation)
create or replace function public.reserver_materiel(p_sortie uuid, p_materiel uuid, p_quantite integer)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  if not public.est_dp_sortie(p_sortie) then raise exception 'réservé au directeur de plongée'; end if;
  if not exists (select 1 from public.materiel m join public.sorties s on s.centre_id = m.centre_id
                 where m.id = p_materiel and s.id = p_sortie and m.deleted_at is null and m.type <> 'bateau') then
    raise exception 'matériel introuvable';
  end if;
  if coalesce(p_quantite, 0) <= 0 then
    delete from public.sortie_materiel where sortie_id = p_sortie and materiel_id = p_materiel;
  else
    insert into public.sortie_materiel (sortie_id, materiel_id, quantite) values (p_sortie, p_materiel, least(p_quantite, 999))
    on conflict (sortie_id, materiel_id) do update set quantite = excluded.quantite;
  end if;
end;
$$;
revoke all on function public.reserver_materiel(uuid, uuid, integer) from public, anon;
grant execute on function public.reserver_materiel(uuid, uuid, integer) to authenticated;

-- Choisir le bateau de la sortie (vide = aucun)
create or replace function public.choisir_bateau(p_sortie uuid, p_bateau uuid)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_libelle text;
begin
  if not public.est_dp_sortie(p_sortie) then raise exception 'réservé au directeur de plongée'; end if;
  if p_bateau is not null then
    select m.libelle into v_libelle from public.materiel m join public.sorties s on s.centre_id = m.centre_id
      where m.id = p_bateau and s.id = p_sortie and m.type = 'bateau' and m.deleted_at is null;
    if v_libelle is null then raise exception 'bateau introuvable'; end if;
  end if;
  update public.sorties set bateau_id = p_bateau, bateau = coalesce(v_libelle, case when p_bateau is null and bateau_id is not null then null else bateau end)
  where id = p_sortie;
end;
$$;
revoke all on function public.choisir_bateau(uuid, uuid) from public, anon;
grant execute on function public.choisir_bateau(uuid, uuid) to authenticated;

-- ------------------------------------------------------------
-- 4. Planning
-- ------------------------------------------------------------
-- Tout ce qu'il faut pour le calendrier, en un appel : sorties de la période,
-- leur équipe et leur matériel, plus l'équipe et le matériel du centre.
create or replace function public.planning_centre(p_centre uuid, p_debut date, p_fin date)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  if not public.est_dp_centre(p_centre) then raise exception 'réservé aux directeurs de plongée du centre'; end if;
  if p_fin < p_debut or p_fin - p_debut > 62 then raise exception 'période invalide'; end if;
  perform public.synchroniser_equipe(p_centre);
  return jsonb_build_object(
    'sorties', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', s.id, 'date', s.date_sortie, 'heure', s.heure, 'site', s.site_name, 'lieu', s.site_location,
        'statut', s.statut, 'dp_id', s.dp_id, 'dp', public.infos_plongeur(s.dp_id) ->> 'prenom',
        'mienne', s.dp_id = auth.uid(), 'bateau', s.bateau, 'bateau_id', s.bateau_id,
        'places', (select m.places from public.materiel m where m.id = s.bateau_id),
        'profondeur_prevue', s.profondeur_prevue, 'duree_min', s.duree_min,
        'nb_inscrits', (select count(*) from public.sortie_participants p where p.sortie_id = s.id and p.user_id is not null),
        'nb_prevus', (select count(*) from public.sortie_participants p where p.sortie_id = s.id and p.user_id is null),
        'nb_completees', (select count(*) from public.sortie_participants p where p.sortie_id = s.id and p.dive_id is not null),
        'nb_palanquees', (select count(*) from public.sortie_palanquees q where q.sortie_id = s.id
                           and exists (select 1 from public.sortie_participants p where p.palanquee_id = q.id)),
        'sans_guide', (select count(*) from public.sortie_palanquees q where q.sortie_id = s.id and q.guide_id is null
                        and exists (select 1 from public.sortie_participants p where p.palanquee_id = q.id)),
        'equipe', coalesce((select jsonb_agg(jsonb_build_object('id', e.id, 'nom', e.nom, 'role', se.role, 'user_id', e.user_id) order by se.created_at)
                            from public.sortie_equipe se join public.centre_equipe e on e.id = se.equipier_id
                            where se.sortie_id = s.id), '[]'::jsonb),
        'materiel', coalesce((select jsonb_agg(jsonb_build_object('materiel_id', sm.materiel_id, 'quantite', sm.quantite))
                              from public.sortie_materiel sm where sm.sortie_id = s.id), '[]'::jsonb))
        order by s.date_sortie, s.heure nulls last)
      from public.sorties s
      where s.centre_id = p_centre and s.deleted_at is null and s.date_sortie between p_debut and p_fin), '[]'::jsonb),
    'equipe', coalesce((select jsonb_agg(public.ligne_equipier(e) order by array_position(array['dp', 'guide', 'pilote', 'gonfleur', 'autre'], e.role), e.nom)
                        from public.centre_equipe e where e.centre_id = p_centre and e.actif), '[]'::jsonb),
    'materiel', coalesce((select jsonb_agg(public.ligne_materiel(m) order by
                            array_position(array['bateau', 'bloc', 'gilet', 'detendeur', 'combinaison', 'ordinateur', 'autre'], m.type), m.libelle)
                          from public.materiel m where m.centre_id = p_centre and m.deleted_at is null), '[]'::jsonb)
  );
end;
$$;
revoke all on function public.planning_centre(uuid, date, date) from public, anon;
grant execute on function public.planning_centre(uuid, date, date) to authenticated;

-- Déplacer une sortie prévue (glisser dans le calendrier) ; les inscrits sont prévenus.
create or replace function public.deplacer_sortie(p_sortie uuid, p_date date, p_heure time default null)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  s public.sorties;
  p record;
begin
  if not public.est_dp_sortie(p_sortie) then raise exception 'réservé au directeur de plongée'; end if;
  select * into s from public.sorties where id = p_sortie;
  if s.statut <> 'prevue' then raise exception 'seule une sortie prévue se déplace'; end if;
  if p_date < current_date then raise exception 'impossible de déplacer une sortie dans le passé'; end if;
  if p_date = s.date_sortie and coalesce(p_heure, s.heure) is not distinct from s.heure then return; end if;
  update public.sorties set date_sortie = p_date, heure = coalesce(p_heure, heure) where id = p_sortie;
  for p in select user_id from public.sortie_participants where sortie_id = p_sortie and user_id is not null and user_id <> auth.uid() loop
    perform public.notifier(p.user_id, 'sortie_modifiee', 'Ta sortie change de date',
      public.texte_sortie(p_sortie) || ' (au lieu du ' || public.date_fr(s.date_sortie) || ').',
      '/sortie?id=' || p_sortie, jsonb_build_object('sortie_id', p_sortie));
  end loop;
end;
$$;
revoke all on function public.deplacer_sortie(uuid, date, time) from public, anon;
grant execute on function public.deplacer_sortie(uuid, date, time) to authenticated;
