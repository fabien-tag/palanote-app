-- ============================================================
-- Palanote — Les formations du club (niveaux et certifications)
--
--   · Le catalogue du club : N1, N2, N3, N4, Nitrox, RIFAP… avec le tarif, le nombre de
--     cours théoriques et pratiques, les prérequis.
--   · La formation d'un élève : le cursus choisi, le moniteur de l'équipe qui en a la charge,
--     les dates, et ses séances jour par jour (pratique le matin et l'après-midi, théorie
--     entre midi et deux…). Les séances apparaissent sur le planning de travail du moniteur.
--   · Les rappels : l'élève est prévenu à la programmation, 3 jours puis la veille du début,
--     et la veille de chaque journée de cours ; le moniteur aussi.
--
-- Prérequis : palanote-planning-club.sql (centre_equipe, est_dp_centre),
--             palanote-import-excel.sql (centre_adherents) et palanote-rappels-dp.sql (rappel_une_fois).
-- À coller dans Supabase → SQL Editor → Run. Relançable sans risque.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Le catalogue du club
-- ------------------------------------------------------------
create table if not exists public.formations_catalogue (
  id uuid primary key default gen_random_uuid(),
  centre_id uuid not null references public.centres(id) on delete cascade,
  code text not null, -- « N2 », « Nitrox »…
  intitule text not null,
  organisme text not null default 'FFESSM',
  categorie text not null default 'niveau',
  prix numeric(7,2),
  nb_theorie integer not null default 0,
  nb_pratique integer not null default 0,
  prerequis text,
  description text,
  actif boolean not null default true,
  ordre integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint formations_catalogue_categorie_check check (categorie in ('niveau', 'gaz', 'encadrement', 'secourisme', 'specialite')),
  constraint formations_catalogue_nb_check check (nb_theorie between 0 and 60 and nb_pratique between 0 and 60)
);
create index if not exists formations_catalogue_centre_idx on public.formations_catalogue (centre_id, ordre);

-- ------------------------------------------------------------
-- 2. La formation d'un élève et ses séances
-- ------------------------------------------------------------
create table if not exists public.formations_eleves (
  id uuid primary key default gen_random_uuid(),
  centre_id uuid not null references public.centres(id) on delete cascade,
  catalogue_id uuid references public.formations_catalogue(id) on delete set null,
  intitule text not null, -- copié du catalogue (garde l'historique)
  adherent_id uuid references public.centre_adherents(id) on delete set null,
  eleve_id uuid references auth.users(id) on delete set null, -- son compte Palanote, s'il en a un
  eleve_nom text not null,
  moniteur_id uuid references public.centre_equipe(id) on delete set null,
  date_debut date not null,
  date_fin date not null,
  prix numeric(7,2),
  statut text not null default 'prevue',
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint formations_eleves_statut_check check (statut in ('prevue', 'en_cours', 'validee', 'abandon')),
  constraint formations_eleves_dates_check check (date_fin >= date_debut)
);
create index if not exists formations_eleves_centre_idx on public.formations_eleves (centre_id, date_debut);
create index if not exists formations_eleves_eleve_idx on public.formations_eleves (eleve_id);

create table if not exists public.formations_seances (
  id uuid primary key default gen_random_uuid(),
  formation_id uuid not null references public.formations_eleves(id) on delete cascade,
  type text not null,
  jour date not null,
  heure_debut time not null,
  heure_fin time,
  intitule text,
  lieu text,
  moniteur_id uuid references public.centre_equipe(id) on delete set null, -- sinon celui de la formation
  faite boolean not null default false,
  created_at timestamptz not null default now(),
  constraint formations_seances_type_check check (type in ('theorie', 'pratique'))
);
create index if not exists formations_seances_formation_idx on public.formations_seances (formation_id, jour, heure_debut);

-- Tout passe par les fonctions ci-dessous
alter table public.formations_catalogue enable row level security;
alter table public.formations_eleves enable row level security;
alter table public.formations_seances enable row level security;
grant all on public.formations_catalogue, public.formations_eleves, public.formations_seances to service_role;

drop trigger if exists formations_catalogue_updated_at on public.formations_catalogue;
create trigger formations_catalogue_updated_at before update on public.formations_catalogue for each row execute function public.update_updated_at_column();
drop trigger if exists formations_eleves_updated_at on public.formations_eleves;
create trigger formations_eleves_updated_at before update on public.formations_eleves for each row execute function public.update_updated_at_column();

-- ------------------------------------------------------------
-- 3. Catalogue : lire, enregistrer, retirer, catalogue type
-- ------------------------------------------------------------
create or replace function public.catalogue_formations(p_centre uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case when public.est_dp_centre(p_centre) then coalesce((
    select jsonb_agg(to_jsonb(f) - 'centre_id' - 'created_at' - 'updated_at'
             || jsonb_build_object('en_cours', (select count(*) from public.formations_eleves e
                                                 where e.catalogue_id = f.id and e.statut in ('prevue', 'en_cours')))
             order by f.ordre, f.code)
    from public.formations_catalogue f where f.centre_id = p_centre), '[]'::jsonb) else '[]'::jsonb end;
$$;
revoke all on function public.catalogue_formations(uuid) from public, anon;
grant execute on function public.catalogue_formations(uuid) to authenticated;

create or replace function public.enregistrer_formation_catalogue(p_centre uuid, p_formation jsonb)
returns uuid
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_id uuid := nullif(p_formation ->> 'id', '')::uuid;
begin
  if not public.est_dp_centre(p_centre) then raise exception 'réservé aux directeurs de plongée du centre'; end if;
  if nullif(btrim(p_formation ->> 'code'), '') is null or nullif(btrim(p_formation ->> 'intitule'), '') is null then
    raise exception 'le code et l''intitulé sont obligatoires';
  end if;
  if v_id is null then
    insert into public.formations_catalogue (centre_id, code, intitule, organisme, categorie, prix, nb_theorie, nb_pratique, prerequis, description, ordre)
    values (p_centre, left(btrim(p_formation ->> 'code'), 20), left(btrim(p_formation ->> 'intitule'), 80),
            coalesce(nullif(btrim(p_formation ->> 'organisme'), ''), 'FFESSM'), coalesce(nullif(p_formation ->> 'categorie', ''), 'niveau'),
            nullif(p_formation ->> 'prix', '')::numeric, coalesce(nullif(p_formation ->> 'nb_theorie', '')::int, 0),
            coalesce(nullif(p_formation ->> 'nb_pratique', '')::int, 0), nullif(btrim(p_formation ->> 'prerequis'), ''),
            nullif(btrim(p_formation ->> 'description'), ''),
            coalesce((select max(ordre) + 1 from public.formations_catalogue where centre_id = p_centre), 0))
    returning id into v_id;
  else
    update public.formations_catalogue set
      code = left(btrim(p_formation ->> 'code'), 20), intitule = left(btrim(p_formation ->> 'intitule'), 80),
      organisme = coalesce(nullif(btrim(p_formation ->> 'organisme'), ''), 'FFESSM'),
      categorie = coalesce(nullif(p_formation ->> 'categorie', ''), categorie),
      prix = nullif(p_formation ->> 'prix', '')::numeric,
      nb_theorie = coalesce(nullif(p_formation ->> 'nb_theorie', '')::int, 0), nb_pratique = coalesce(nullif(p_formation ->> 'nb_pratique', '')::int, 0),
      prerequis = nullif(btrim(p_formation ->> 'prerequis'), ''), description = nullif(btrim(p_formation ->> 'description'), ''),
      actif = coalesce((p_formation ->> 'actif')::boolean, actif)
    where id = v_id and centre_id = p_centre;
  end if;
  return v_id;
end;
$$;
revoke all on function public.enregistrer_formation_catalogue(uuid, jsonb) from public, anon;
grant execute on function public.enregistrer_formation_catalogue(uuid, jsonb) to authenticated;

create or replace function public.retirer_formation_catalogue(p_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_centre uuid;
begin
  select centre_id into v_centre from public.formations_catalogue where id = p_id;
  if v_centre is null or not public.est_dp_centre(v_centre) then raise exception 'réservé aux directeurs de plongée du centre'; end if;
  delete from public.formations_catalogue where id = p_id;
end;
$$;
revoke all on function public.retirer_formation_catalogue(uuid) from public, anon;
grant execute on function public.retirer_formation_catalogue(uuid) to authenticated;

-- Le catalogue type d'un club FFESSM (tarifs indicatifs, à adapter)
create or replace function public.catalogue_formations_type(p_centre uuid)
returns integer
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_nb integer;
begin
  if not public.est_dp_centre(p_centre) then raise exception 'réservé aux directeurs de plongée du centre'; end if;
  insert into public.formations_catalogue (centre_id, code, intitule, organisme, categorie, prix, nb_theorie, nb_pratique, prerequis, description, ordre)
  select p_centre, x.code, x.intitule, x.organisme, x.categorie, x.prix, x.th, x.pr, x.prerequis, x.description, x.ordre
  from (values
    ('N1', 'Plongeur Niveau 1 (PE12)', 'FFESSM', 'niveau', 420, 3, 6, '14 ans, certificat médical', 'Plonger encadré jusqu''à 20 m. Baptême, fosse puis mer.', 1),
    ('N2', 'Plongeur Niveau 2 (PE40 / PA20)', 'FFESSM', 'niveau', 590, 5, 8, 'N1, 16 ans, certificat médical', 'Autonome à 20 m, encadré jusqu''à 40 m.', 2),
    ('N3', 'Plongeur Niveau 3 (PA60)', 'FFESSM', 'niveau', 690, 6, 10, 'N2, 18 ans, certificat médical', 'Autonome jusqu''à 60 m.', 3),
    ('N4', 'Guide de palanquée (Niveau 4)', 'FFESSM', 'encadrement', 890, 10, 14, 'N3, RIFAP, 18 ans', 'Guider une palanquée, organiser la plongée.', 4),
    ('NX', 'Plongeur Nitrox', 'FFESSM', 'gaz', 160, 2, 2, 'N1 ou PE20', 'Mélanges jusqu''à 40 % d''oxygène.', 5),
    ('NXC', 'Plongeur Nitrox confirmé', 'FFESSM', 'gaz', 280, 3, 3, 'N2 et Nitrox', 'Tous mélanges suroxygénés, décompression à l''oxygène.', 6),
    ('TX', 'Trimix élémentaire', 'FFESSM', 'gaz', 450, 4, 4, 'N3 et Nitrox confirmé', 'Mélanges ternaires jusqu''à 70 m.', 7),
    ('RIFAP', 'Réaction et intervention face à un accident de plongée', 'FFESSM', 'secourisme', 110, 2, 2, 'N1', 'Secourisme spécifique à la plongée.', 8),
    ('E1', 'Initiateur (E1)', 'FFESSM', 'encadrement', 350, 6, 6, 'N2, RIFAP, 18 ans', 'Enseigner en piscine et à 6 m.', 9),
    ('CCR', 'Recycleur (initiation)', 'Fabricant', 'specialite', 650, 4, 6, 'N2 et Nitrox confirmé', 'Plongée en circuit fermé électronique.', 10)
  ) as x(code, intitule, organisme, categorie, prix, th, pr, prerequis, description, ordre)
  where not exists (select 1 from public.formations_catalogue f where f.centre_id = p_centre and lower(f.code) = lower(x.code));
  get diagnostics v_nb = row_count;
  return v_nb;
end;
$$;
revoke all on function public.catalogue_formations_type(uuid) from public, anon;
grant execute on function public.catalogue_formations_type(uuid) to authenticated;

-- ------------------------------------------------------------
-- 4. Les élèves en formation
-- ------------------------------------------------------------
create or replace function public.ligne_formation(p_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select to_jsonb(e) - 'centre_id' - 'created_at' - 'updated_at'
    || jsonb_build_object(
      'code', (select code from public.formations_catalogue c where c.id = e.catalogue_id),
      'moniteur', (select jsonb_build_object('id', q.id, 'nom', q.nom, 'niveau', q.niveau) from public.centre_equipe q where q.id = e.moniteur_id),
      'eleve_niveau', coalesce((select a.niveau from public.centre_adherents a where a.id = e.adherent_id), public.infos_plongeur(e.eleve_id) ->> 'niveau'),
      'seances', coalesce((
        select jsonb_agg(jsonb_build_object('id', s.id, 'type', s.type, 'jour', s.jour, 'heure_debut', to_char(s.heure_debut, 'HH24:MI'),
                                            'heure_fin', to_char(s.heure_fin, 'HH24:MI'), 'intitule', s.intitule, 'lieu', s.lieu, 'faite', s.faite,
                                            'moniteur', (select q.nom from public.centre_equipe q where q.id = coalesce(s.moniteur_id, e.moniteur_id)))
                         order by s.jour, s.heure_debut)
        from public.formations_seances s where s.formation_id = e.id), '[]'::jsonb))
  from public.formations_eleves e where e.id = p_id;
$$;
revoke all on function public.ligne_formation(uuid) from public, anon, authenticated;

create or replace function public.formations_centre(p_centre uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case when public.est_dp_centre(p_centre) then coalesce((
    select jsonb_agg(public.ligne_formation(e.id) order by (e.statut in ('validee', 'abandon')), e.date_debut)
    from public.formations_eleves e where e.centre_id = p_centre), '[]'::jsonb) else '[]'::jsonb end;
$$;
revoke all on function public.formations_centre(uuid) from public, anon;
grant execute on function public.formations_centre(uuid) to authenticated;

-- Texte d'une journée de cours : « 9h00 pratique · 12h30 théorie · 14h00 pratique »
create or replace function public.texte_journee_formation(p_formation uuid, p_jour date)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select string_agg(to_char(s.heure_debut, 'HH24"h"MI') || ' ' || case s.type when 'theorie' then 'théorie' else 'pratique' end
                    || coalesce(' (' || s.intitule || ')', ''), ' · ' order by s.heure_debut)
  from public.formations_seances s where s.formation_id = p_formation and s.jour = p_jour;
$$;
revoke all on function public.texte_journee_formation(uuid, date) from public, anon, authenticated;

-- Programmer la formation d'un élève, avec ses séances
create or replace function public.programmer_formation(p_centre uuid, p_formation jsonb, p_seances jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_id uuid := nullif(p_formation ->> 'id', '')::uuid;
  v_cat public.formations_catalogue;
  v_adh public.centre_adherents;
  v_moniteur uuid := nullif(p_formation ->> 'moniteur_id', '')::uuid;
  v_eleve uuid;
  v_nom text;
  v_debut date;
  v_fin date;
  v_nouvelle boolean := v_id is null;
  s jsonb;
  v_mon_user uuid;
  v_club text;
begin
  if not public.est_dp_centre(p_centre) then raise exception 'réservé aux directeurs de plongée du centre'; end if;
  select * into v_cat from public.formations_catalogue where id = nullif(p_formation ->> 'catalogue_id', '')::uuid and centre_id = p_centre;
  if v_cat.id is null then raise exception 'choisis une formation du catalogue'; end if;
  select * into v_adh from public.centre_adherents where id = nullif(p_formation ->> 'adherent_id', '')::uuid and centre_id = p_centre;
  if v_adh.id is null then raise exception 'choisis l''élève parmi les membres du club'; end if;
  if v_moniteur is not null and not exists (select 1 from public.centre_equipe where id = v_moniteur and centre_id = p_centre) then v_moniteur := null; end if;
  v_eleve := v_adh.user_id;
  v_nom := concat_ws(' ', v_adh.prenom, v_adh.nom);
  select min((x ->> 'jour')::date), max((x ->> 'jour')::date) into v_debut, v_fin from jsonb_array_elements(coalesce(p_seances, '[]'::jsonb)) x;
  v_debut := coalesce(nullif(p_formation ->> 'date_debut', '')::date, v_debut);
  v_fin := greatest(coalesce(v_fin, v_debut), coalesce(nullif(p_formation ->> 'date_fin', '')::date, v_debut));
  if v_debut is null then raise exception 'indique la date de début'; end if;

  if v_nouvelle then
    insert into public.formations_eleves (centre_id, catalogue_id, intitule, adherent_id, eleve_id, eleve_nom, moniteur_id, date_debut, date_fin, prix, note)
    values (p_centre, v_cat.id, v_cat.intitule, v_adh.id, v_eleve, v_nom, v_moniteur, v_debut, v_fin,
            coalesce(nullif(p_formation ->> 'prix', '')::numeric, v_cat.prix), nullif(btrim(p_formation ->> 'note'), ''))
    returning id into v_id;
  else
    update public.formations_eleves set catalogue_id = v_cat.id, intitule = v_cat.intitule, adherent_id = v_adh.id, eleve_id = v_eleve,
      eleve_nom = v_nom, moniteur_id = v_moniteur, date_debut = v_debut, date_fin = v_fin,
      prix = coalesce(nullif(p_formation ->> 'prix', '')::numeric, prix), note = nullif(btrim(p_formation ->> 'note'), '')
    where id = v_id and centre_id = p_centre;
    delete from public.formations_seances where formation_id = v_id and not faite;
  end if;
  for s in select * from jsonb_array_elements(coalesce(p_seances, '[]'::jsonb)) loop
    continue when (s ->> 'id') is not null and exists (select 1 from public.formations_seances where id = (s ->> 'id')::uuid and faite);
    insert into public.formations_seances (formation_id, type, jour, heure_debut, heure_fin, intitule, lieu)
    values (v_id, case when s ->> 'type' = 'theorie' then 'theorie' else 'pratique' end, (s ->> 'jour')::date,
            coalesce(nullif(s ->> 'heure_debut', '')::time, '09:00'), nullif(s ->> 'heure_fin', '')::time,
            nullif(btrim(left(s ->> 'intitule', 80)), ''), nullif(btrim(left(s ->> 'lieu', 80)), ''));
  end loop;

  -- On prévient l'élève (s'il a un compte) et le moniteur
  select nom into v_club from public.centres where id = p_centre;
  if v_eleve is not null then
    perform public.notifier(v_eleve, 'formation_programmee',
      case when v_nouvelle then 'Ta formation ' || v_cat.code || ' est programmée' else 'Ta formation ' || v_cat.code || ' a changé' end,
      v_cat.intitule || ' avec ' || v_club || ', du ' || public.date_fr(v_debut) || ' au ' || public.date_fr(v_fin)
        || ' · ' || (select count(*) from public.formations_seances where formation_id = v_id) || ' séances.',
      '/moi/formation', jsonb_build_object('formation_id', v_id));
  end if;
  select user_id into v_mon_user from public.centre_equipe where id = v_moniteur;
  if v_mon_user is not null and v_mon_user <> auth.uid() then
    perform public.notifier(v_mon_user, 'formation_moniteur', 'Tu encadres la formation ' || v_cat.code || ' de ' || v_adh.prenom,
      'Du ' || public.date_fr(v_debut) || ' au ' || public.date_fr(v_fin) || ' : les séances sont sur ton planning.',
      '/club/formations', jsonb_build_object('formation_id', v_id));
  end if;
  return public.ligne_formation(v_id);
end;
$$;
revoke all on function public.programmer_formation(uuid, jsonb, jsonb) from public, anon;
grant execute on function public.programmer_formation(uuid, jsonb, jsonb) to authenticated;

-- Le DP fait avancer la formation : séance faite, statut (validée = brevet obtenu), moniteur
create or replace function public.modifier_formation(p_formation uuid, p_statut text default null, p_moniteur uuid default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  e public.formations_eleves;
begin
  select * into e from public.formations_eleves where id = p_formation;
  if not found or not public.est_dp_centre(e.centre_id) then raise exception 'réservé aux directeurs de plongée du centre'; end if;
  update public.formations_eleves set
    statut = coalesce(nullif(p_statut, ''), statut),
    moniteur_id = coalesce(p_moniteur, moniteur_id)
  where id = p_formation;
  if p_statut = 'validee' and e.statut <> 'validee' and e.eleve_id is not null then
    perform public.notifier(e.eleve_id, 'formation_validee', 'Bravo, formation validée !',
      e.intitule || ' : le club a validé ta formation. Ajoute ta carte à ton passeport dès que tu l''as.',
      '/moi/passeport', jsonb_build_object('formation_id', e.id));
  end if;
  return public.ligne_formation(p_formation);
end;
$$;
revoke all on function public.modifier_formation(uuid, text, uuid) from public, anon;
grant execute on function public.modifier_formation(uuid, text, uuid) to authenticated;

create or replace function public.cocher_seance(p_seance uuid, p_faite boolean)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_centre uuid;
begin
  select e.centre_id into v_centre from public.formations_seances s join public.formations_eleves e on e.id = s.formation_id where s.id = p_seance;
  if v_centre is null or not public.est_dp_centre(v_centre) then raise exception 'réservé aux directeurs de plongée du centre'; end if;
  update public.formations_seances set faite = p_faite where id = p_seance;
  -- La formation passe « en cours » dès la première séance faite
  update public.formations_eleves e set statut = 'en_cours'
  where e.id = (select formation_id from public.formations_seances where id = p_seance) and e.statut = 'prevue' and p_faite;
end;
$$;
revoke all on function public.cocher_seance(uuid, boolean) from public, anon;
grant execute on function public.cocher_seance(uuid, boolean) to authenticated;

create or replace function public.supprimer_formation(p_formation uuid)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  e public.formations_eleves;
begin
  select * into e from public.formations_eleves where id = p_formation;
  if not found or not public.est_dp_centre(e.centre_id) then raise exception 'réservé aux directeurs de plongée du centre'; end if;
  delete from public.formations_eleves where id = p_formation;
  if e.eleve_id is not null and e.date_fin >= current_date then
    perform public.notifier(e.eleve_id, 'formation_annulee', 'Formation annulée', e.intitule || ' du ' || public.date_fr(e.date_debut) || ' est annulée. Le club te recontactera.',
      '/moi/formation', '{}'::jsonb);
  end if;
end;
$$;
revoke all on function public.supprimer_formation(uuid) from public, anon;
grant execute on function public.supprimer_formation(uuid) to authenticated;

-- Les séances d'une période (planning de travail de l'équipe)
create or replace function public.seances_centre(p_centre uuid, p_debut date, p_fin date)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case when public.est_dp_centre(p_centre) then coalesce((
    select jsonb_agg(jsonb_build_object('id', s.id, 'formation_id', e.id, 'code', coalesce(c.code, e.intitule), 'eleve', e.eleve_nom,
                                        'type', s.type, 'jour', s.jour, 'heure_debut', to_char(s.heure_debut, 'HH24:MI'),
                                        'heure_fin', to_char(s.heure_fin, 'HH24:MI'), 'moniteur_id', coalesce(s.moniteur_id, e.moniteur_id))
                     order by s.jour, s.heure_debut)
    from public.formations_seances s join public.formations_eleves e on e.id = s.formation_id
    left join public.formations_catalogue c on c.id = e.catalogue_id
    where e.centre_id = p_centre and e.statut <> 'abandon' and s.jour between p_debut and p_fin), '[]'::jsonb) else '[]'::jsonb end;
$$;
revoke all on function public.seances_centre(uuid, date, date) from public, anon;
grant execute on function public.seances_centre(uuid, date, date) to authenticated;

-- ------------------------------------------------------------
-- 5. Côté élève : ses formations et son programme
-- ------------------------------------------------------------
create or replace function public.mes_formations()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(public.ligne_formation(e.id) || jsonb_build_object('club', c.nom) order by e.date_debut desc), '[]'::jsonb)
  from public.formations_eleves e join public.centres c on c.id = e.centre_id
  where e.eleve_id = auth.uid()
     or e.adherent_id in (select a.id from public.centre_adherents a where a.user_id = auth.uid());
$$;
revoke all on function public.mes_formations() from public, anon;
grant execute on function public.mes_formations() to authenticated;

-- ------------------------------------------------------------
-- 6. Les rappels (créés quand l'élève ou le moniteur ouvre l'app, une seule fois chacun)
-- ------------------------------------------------------------
create or replace function public.generer_rappels_formations()
returns integer
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_moi uuid := auth.uid();
  v_nb integer := 0;
  f record;
  j record;
begin
  if v_moi is null then return 0; end if;

  -- L'élève : 3 jours avant, la veille, puis la veille (ou le matin) de chaque journée de cours
  for f in select e.*, coalesce(c.code, e.intitule) as code_f, ce.nom as club
           from public.formations_eleves e
           join public.centres ce on ce.id = e.centre_id
           left join public.formations_catalogue c on c.id = e.catalogue_id
           where e.statut in ('prevue', 'en_cours') and e.date_fin >= current_date
             and (e.eleve_id = v_moi or e.adherent_id in (select a.id from public.centre_adherents a where a.user_id = v_moi)) loop
    if f.date_debut - current_date between 2 and 3 then
      v_nb := v_nb + public.rappel_une_fois(v_moi, 'formation-j3:' || f.id, 'formation_rappel',
        'Ta formation ' || f.code_f || ' commence dans ' || (f.date_debut - current_date) || ' jours',
        f.intitule || ' avec ' || f.club || ', du ' || public.date_fr(f.date_debut) || ' au ' || public.date_fr(f.date_fin)
          || '. Pense à ton certificat médical et à ton matériel.', '/moi/formation', jsonb_build_object('formation_id', f.id));
    end if;
    for j in select distinct s.jour from public.formations_seances s
             where s.formation_id = f.id and s.jour between current_date and current_date + 1 and not s.faite loop
      v_nb := v_nb + public.rappel_une_fois(v_moi, 'formation-jour:' || f.id || ':' || j.jour, 'formation_rappel',
        case when j.jour = current_date then 'Aujourd''hui' else 'Demain' end || ' : formation ' || f.code_f
          || case when j.jour = f.date_debut then ' (premier jour)' else '' end,
        public.texte_journee_formation(f.id, j.jour) || '.', '/moi/formation', jsonb_build_object('formation_id', f.id));
    end loop;
  end loop;

  -- Le moniteur : la veille de chaque journée où il encadre
  for f in select e.*, coalesce(c.code, e.intitule) as code_f
           from public.formations_eleves e
           left join public.formations_catalogue c on c.id = e.catalogue_id
           where e.statut in ('prevue', 'en_cours') and e.date_fin >= current_date
             and exists (select 1 from public.centre_equipe q where q.user_id = v_moi
                         and q.id in (select coalesce(s.moniteur_id, e.moniteur_id) from public.formations_seances s where s.formation_id = e.id)) loop
    for j in select distinct s.jour from public.formations_seances s
             where s.formation_id = f.id and s.jour between current_date and current_date + 1 and not s.faite loop
      v_nb := v_nb + public.rappel_une_fois(v_moi, 'formation-moniteur:' || f.id || ':' || j.jour, 'formation_rappel',
        case when j.jour = current_date then 'Aujourd''hui' else 'Demain' end || ' tu encadres ' || f.code_f || ' · ' || f.eleve_nom,
        public.texte_journee_formation(f.id, j.jour) || '.', '/club/formations', jsonb_build_object('formation_id', f.id));
    end loop;
  end loop;
  return v_nb;
end;
$$;
revoke all on function public.generer_rappels_formations() from public, anon;
grant execute on function public.generer_rappels_formations() to authenticated;
