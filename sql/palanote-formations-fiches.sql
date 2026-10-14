-- Palanote — Les fiches détaillées des formations (N1, N2, N3, N4, Nitrox…)
-- Pour chaque formation du catalogue : accroche, objectifs, âge minimum, profondeur,
-- contenu, ce qui est inclus, prérogatives, documents à fournir, période et cursus.
-- Les formations du catalogue type sont pré-remplies (modifiables par le club) ;
-- elles s'affichent sur le site du club et dans « Formations ».
-- Prérequis : palanote-formations.sql. Script autonome et rejouable, à lancer dans le SQL Editor de Supabase.

alter table public.formations_catalogue add column if not exists accroche text;
alter table public.formations_catalogue add column if not exists objectifs text;
alter table public.formations_catalogue add column if not exists age_min integer;
alter table public.formations_catalogue add column if not exists profondeur_max integer;
alter table public.formations_catalogue add column if not exists contenu jsonb not null default '[]'::jsonb;
alter table public.formations_catalogue add column if not exists inclus jsonb not null default '[]'::jsonb;
alter table public.formations_catalogue add column if not exists prerogatives text;
alter table public.formations_catalogue add column if not exists documents jsonb not null default '[]'::jsonb;
alter table public.formations_catalogue add column if not exists periode text;
alter table public.formations_catalogue add column if not exists cursus text;

-- ------------------------------------------------------------
-- 1. Les fiches type, par code
-- ------------------------------------------------------------
create or replace function public.fiche_type_formation(p_code text)
returns jsonb
language sql
immutable
set search_path = public
as $$
  select case upper(btrim(p_code))
    when 'N1' then jsonb_build_object(
      'accroche', 'Votre permis de plonger',
      'objectifs', 'Plonger encadré par un guide de palanquée jusqu''à 20 m, et maîtriser les gestes de sécurité de base.',
      'age_min', 14, 'profondeur_max', 20,
      'contenu', jsonb_build_array('Des plongées en mer, de la faible profondeur jusqu''à 20 m', 'Des cours théoriques : matériel, pressions, sécurité, signes', 'Le carnet de plongée Palanote pour noter chaque plongée', 'La carte de niveau 1, reconnue à l''international'),
      'inclus', jsonb_build_array('Tout l''équipement', 'Les sorties en bateau', 'L''encadrement par un moniteur'),
      'prerogatives', 'Plonger encadré jusqu''à 20 m (PE20).',
      'documents', jsonb_build_array('Certificat médical de non contre-indication à la plongée', 'Autorisation parentale pour les mineurs'),
      'periode', 'Toute la saison, sur rendez-vous : en stage sur quelques jours ou sur plusieurs week-ends.',
      'cursus', 'FFESSM (licence fédérale en supplément)')
    when 'N2' then jsonb_build_object(
      'accroche', 'Devenez autonome',
      'objectifs', 'Plonger en autonomie jusqu''à 20 m avec votre binôme, et encadré jusqu''à 40 m.',
      'age_min', 16, 'profondeur_max', 40,
      'contenu', jsonb_build_array('Des plongées en mer, progressivement jusqu''à 40 m', 'Des cours théoriques : décompression, ordinateur, réglementation', 'Navigation sous-marine et gestion de son air', 'La carte de niveau 2'),
      'inclus', jsonb_build_array('Tout l''équipement', 'Les sorties en bateau', 'L''encadrement par un moniteur'),
      'prerogatives', 'Autonome jusqu''à 20 m (PA20), encadré jusqu''à 40 m (PE40).',
      'documents', jsonb_build_array('Carte de niveau 1 (ou équivalent)', 'Certificat médical de non contre-indication à la plongée', 'Autorisation parentale pour les mineurs'),
      'periode', 'Du printemps à l''automne, en stage ou sur plusieurs semaines.',
      'cursus', 'FFESSM (licence fédérale en supplément)')
    when 'N3' then jsonb_build_object(
      'accroche', 'L''autonomie jusqu''à 60 m',
      'objectifs', 'Organiser et mener votre plongée en autonomie jusqu''à 60 m, sous la responsabilité d''un directeur de plongée.',
      'age_min', 18, 'profondeur_max', 60,
      'contenu', jsonb_build_array('Des plongées profondes et sur épave', 'Des cours théoriques : planification, accidents, physiologie', 'L''organisation des secours', 'La carte de niveau 3'),
      'inclus', jsonb_build_array('Tout l''équipement', 'Les sorties en bateau', 'L''encadrement par un moniteur'),
      'prerogatives', 'Autonome jusqu''à 60 m (PA60).',
      'documents', jsonb_build_array('Carte de niveau 2', 'Certificat médical de non contre-indication à la plongée', 'Attestation de secourisme (RIFAP conseillé)'),
      'periode', 'En stage intensif, souvent en fin de saison.',
      'cursus', 'FFESSM (licence fédérale en supplément)')
    when 'N4' then jsonb_build_object(
      'accroche', 'Guidez une palanquée',
      'objectifs', 'Guider une palanquée de plongeurs en exploration et assister le directeur de plongée.',
      'age_min', 18, 'profondeur_max', 40,
      'contenu', jsonb_build_array('Des plongées de guidage, de sauvetage et d''orientation', 'Des cours théoriques : réglementation, théorie avancée, organisation', 'Des épreuves de condition physique (nage, apnée, sauvetage)', 'La carte de niveau 4 Guide de palanquée'),
      'inclus', jsonb_build_array('Tout l''équipement', 'Les sorties en bateau', 'L''encadrement par un moniteur'),
      'prerogatives', 'Guide de palanquée jusqu''à 40 m ; autonome jusqu''à 60 m.',
      'documents', jsonb_build_array('Carte de niveau 3', 'Attestation RIFAP', 'Certificat médical de non contre-indication à la plongée'),
      'periode', 'Sur la saison, avec un examen en fin de cursus.',
      'cursus', 'FFESSM (licence fédérale en supplément)')
    when 'NX' then jsonb_build_object(
      'accroche', 'Plongez au Nitrox',
      'objectifs', 'Plonger avec un mélange enrichi en oxygène (jusqu''à 40 %) dans les limites de votre niveau, pour moins de fatigue et des plongées plus longues.',
      'contenu', jsonb_build_array('Des plongées au Nitrox', 'Des cours : analyse du mélange, profondeur limite, toxicité de l''oxygène'),
      'inclus', jsonb_build_array('Les blocs Nitrox et l''analyseur', 'L''encadrement par un moniteur'),
      'prerogatives', 'Plonger au Nitrox (jusqu''à 40 % d''oxygène) dans les limites de son niveau.',
      'documents', jsonb_build_array('Carte de niveau', 'Certificat médical de non contre-indication à la plongée'))
    when 'NXC' then jsonb_build_object(
      'accroche', 'Tous les mélanges suroxygénés',
      'objectifs', 'Utiliser tous les mélanges enrichis en oxygène et l''oxygène pur pour la décompression.',
      'contenu', jsonb_build_array('Des plongées avec changement de gaz', 'Des cours : planification, décompression à l''oxygène'),
      'inclus', jsonb_build_array('Les blocs et l''oxygène', 'L''encadrement par un moniteur'),
      'prerogatives', 'Plonger avec tous les mélanges suroxygénés et décompresser à l''oxygène.',
      'documents', jsonb_build_array('Carte de niveau 2 et Nitrox', 'Certificat médical de non contre-indication à la plongée'))
    when 'TX' then jsonb_build_object(
      'accroche', 'Plongez à l''hélium',
      'objectifs', 'Plonger avec des mélanges contenant de l''hélium pour limiter la narcose en profondeur.',
      'contenu', jsonb_build_array('Des plongées au Trimix', 'Des cours : mélanges, planification, décompression'),
      'inclus', jsonb_build_array('Les gaz et l''encadrement'),
      'prerogatives', 'Plonger au Trimix élémentaire.',
      'documents', jsonb_build_array('Carte de niveau 3 et Nitrox confirmé', 'Certificat médical de non contre-indication à la plongée'))
    when 'RIFAP' then jsonb_build_object(
      'accroche', 'Savoir réagir',
      'objectifs', 'Réagir face à un accident de plongée : alerter, sortir la victime de l''eau, l''oxygéner, la réanimer.',
      'contenu', jsonb_build_array('Des mises en situation dans l''eau et sur le bateau', 'L''oxygénothérapie et les gestes de premiers secours'),
      'inclus', jsonb_build_array('Le matériel de secours', 'L''encadrement par un moniteur'),
      'prerogatives', 'Nécessaire pour le niveau 3, le niveau 4 et l''initiateur.',
      'documents', jsonb_build_array('Carte de niveau 1', 'Certificat médical de non contre-indication à la plongée'))
    when 'E1' then jsonb_build_object(
      'accroche', 'Transmettez votre passion',
      'objectifs', 'Enseigner la plongée jusqu''à 6 m, en piscine et en mer, sous l''autorité d''un moniteur.',
      'contenu', jsonb_build_array('Des séances pédagogiques encadrées', 'Des cours : pédagogie, sécurité, réglementation'),
      'inclus', jsonb_build_array('L''encadrement par un moniteur'),
      'prerogatives', 'Enseigner jusqu''à 6 m.',
      'documents', jsonb_build_array('Carte de niveau 2', 'Attestation RIFAP', 'Certificat médical de non contre-indication à la plongée'))
    when 'CCR' then jsonb_build_object(
      'accroche', 'La plongée en silence',
      'objectifs', 'Découvrir la plongée en circuit fermé : montage, contrôles, gestion des mélanges et procédures de secours.',
      'contenu', jsonb_build_array('Des plongées en recycleur', 'Des cours : principe, cellules, chaux, procédures'),
      'inclus', jsonb_build_array('Le recycleur et ses consommables', 'L''encadrement par un instructeur'),
      'prerogatives', 'Plonger en recycleur dans les limites de la qualification.',
      'documents', jsonb_build_array('Carte de niveau 2 et Nitrox confirmé', 'Certificat médical de non contre-indication à la plongée'))
    else '{}'::jsonb
  end;
$$;

-- Remplit les cases vides d'une formation avec sa fiche type (sans rien écraser)
create or replace function public.completer_fiche_formation()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  f jsonb := public.fiche_type_formation(new.code);
begin
  if f = '{}'::jsonb then return new; end if;
  new.accroche := coalesce(new.accroche, f ->> 'accroche');
  new.objectifs := coalesce(new.objectifs, f ->> 'objectifs');
  new.age_min := coalesce(new.age_min, (f ->> 'age_min')::integer);
  new.profondeur_max := coalesce(new.profondeur_max, (f ->> 'profondeur_max')::integer);
  new.contenu := case when new.contenu is null or new.contenu = '[]'::jsonb then coalesce(f -> 'contenu', '[]'::jsonb) else new.contenu end;
  new.inclus := case when new.inclus is null or new.inclus = '[]'::jsonb then coalesce(f -> 'inclus', '[]'::jsonb) else new.inclus end;
  new.prerogatives := coalesce(new.prerogatives, f ->> 'prerogatives');
  new.documents := case when new.documents is null or new.documents = '[]'::jsonb then coalesce(f -> 'documents', '[]'::jsonb) else new.documents end;
  new.periode := coalesce(new.periode, f ->> 'periode');
  new.cursus := coalesce(new.cursus, f ->> 'cursus');
  return new;
end;
$$;

drop trigger if exists formations_catalogue_fiche on public.formations_catalogue;
create trigger formations_catalogue_fiche before insert on public.formations_catalogue
  for each row execute function public.completer_fiche_formation();

-- Les formations déjà au catalogue : on complète leurs cases vides
update public.formations_catalogue f set
  accroche = coalesce(f.accroche, t.f ->> 'accroche'),
  objectifs = coalesce(f.objectifs, t.f ->> 'objectifs'),
  age_min = coalesce(f.age_min, (t.f ->> 'age_min')::integer),
  profondeur_max = coalesce(f.profondeur_max, (t.f ->> 'profondeur_max')::integer),
  contenu = case when f.contenu = '[]'::jsonb then coalesce(t.f -> 'contenu', '[]'::jsonb) else f.contenu end,
  inclus = case when f.inclus = '[]'::jsonb then coalesce(t.f -> 'inclus', '[]'::jsonb) else f.inclus end,
  prerogatives = coalesce(f.prerogatives, t.f ->> 'prerogatives'),
  documents = case when f.documents = '[]'::jsonb then coalesce(t.f -> 'documents', '[]'::jsonb) else f.documents end,
  periode = coalesce(f.periode, t.f ->> 'periode'),
  cursus = coalesce(f.cursus, t.f ->> 'cursus')
from (select id, public.fiche_type_formation(code) as f from public.formations_catalogue) t
where t.id = f.id and t.f <> '{}'::jsonb;

-- ------------------------------------------------------------
-- 2. Enregistrer une formation, avec sa fiche
-- ------------------------------------------------------------
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

  -- La fiche détaillée (seulement les champs envoyés)
  update public.formations_catalogue set
    accroche = case when p_formation ? 'accroche' then nullif(btrim(p_formation ->> 'accroche'), '') else accroche end,
    objectifs = case when p_formation ? 'objectifs' then nullif(btrim(p_formation ->> 'objectifs'), '') else objectifs end,
    age_min = case when p_formation ? 'age_min' then nullif(p_formation ->> 'age_min', '')::integer else age_min end,
    profondeur_max = case when p_formation ? 'profondeur_max' then nullif(p_formation ->> 'profondeur_max', '')::integer else profondeur_max end,
    contenu = case when jsonb_typeof(p_formation -> 'contenu') = 'array'
                   then coalesce((select jsonb_agg(btrim(x)) from jsonb_array_elements_text(p_formation -> 'contenu') x where btrim(x) <> ''), '[]'::jsonb) else contenu end,
    inclus = case when jsonb_typeof(p_formation -> 'inclus') = 'array'
                  then coalesce((select jsonb_agg(btrim(x)) from jsonb_array_elements_text(p_formation -> 'inclus') x where btrim(x) <> ''), '[]'::jsonb) else inclus end,
    documents = case when jsonb_typeof(p_formation -> 'documents') = 'array'
                     then coalesce((select jsonb_agg(btrim(x)) from jsonb_array_elements_text(p_formation -> 'documents') x where btrim(x) <> ''), '[]'::jsonb) else documents end,
    prerogatives = case when p_formation ? 'prerogatives' then nullif(btrim(p_formation ->> 'prerogatives'), '') else prerogatives end,
    periode = case when p_formation ? 'periode' then nullif(btrim(p_formation ->> 'periode'), '') else periode end,
    cursus = case when p_formation ? 'cursus' then nullif(btrim(p_formation ->> 'cursus'), '') else cursus end
  where id = v_id and centre_id = p_centre;
  return v_id;
end;
$$;
revoke all on function public.enregistrer_formation_catalogue(uuid, jsonb) from public, anon;
grant execute on function public.enregistrer_formation_catalogue(uuid, jsonb) to authenticated;
