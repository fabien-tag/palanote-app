-- ============================================================
-- Palanote — Ajouter un membre depuis l'accueil du club, et l'inviter sur Palanote
--
-- Au comptoir, le DP saisit un nouveau membre (prénom, nom, e-mail, téléphone, niveau,
-- licence, certificat médical). Le membre rejoint la liste des adhérents du club et reçoit
-- un lien d'invitation personnel (QR code à scanner sur place, SMS ou e-mail).
-- En ouvrant ce lien, il crée son compte Palanote (ou se connecte) : son compte est relié
-- au club, il retrouve son historique, et le DP est prévenu.
-- S'il a déjà un compte avec cette adresse e-mail, il est relié tout de suite et prévenu
-- dans l'app.
--
-- Prérequis : palanote-import-excel.sql (centre_adherents), palanote-planning-club.sql
--             (est_dp_centre) et palanote-privilegies.sql (privilegie).
-- À coller dans Supabase → SQL Editor → Run. Relançable sans risque.
-- ============================================================

alter table public.centre_adherents add column if not exists invitation_jeton text;
alter table public.centre_adherents add column if not exists invite_le timestamptz;
alter table public.centre_adherents add column if not exists rejoint_le timestamptz;
create unique index if not exists centre_adherents_invitation_idx on public.centre_adherents (invitation_jeton) where invitation_jeton is not null;

-- Un jeton d'invitation (16 caractères, difficile à deviner)
create or replace function public.nouveau_jeton_invitation()
returns text
language sql
volatile
set search_path = public
as $$
  select left(replace(gen_random_uuid()::text, '-', ''), 16);
$$;

-- Prévient le membre s'il a déjà un compte avec cette adresse e-mail (et relie son compte)
create or replace function public.relier_membre_existant(p_adherent uuid)
returns boolean
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  a public.centre_adherents;
  v_user uuid;
begin
  select * into a from public.centre_adherents where id = p_adherent;
  if a.user_id is not null then return true; end if;
  if a.email is null then return false; end if;
  select id into v_user from auth.users where lower(email) = lower(a.email) limit 1;
  if v_user is null then return false; end if;
  update public.centre_adherents set user_id = v_user, rejoint_le = coalesce(rejoint_le, now()) where id = p_adherent;
  perform public.notifier(v_user, 'club_adhesion', (select nom from public.centres where id = a.centre_id) || ' t''a ajouté à ses membres',
    'Ton compte Palanote est relié au club : tes sorties et ton historique avec le club arrivent dans ton carnet.',
    '/carnet', jsonb_build_object('centre_id', a.centre_id));
  return true;
end;
$$;
revoke all on function public.relier_membre_existant(uuid) from public, anon, authenticated;

-- Le DP ajoute un membre (ou complète une fiche existante, même e-mail)
create or replace function public.ajouter_membre(
  p_centre uuid, p_prenom text, p_nom text default null, p_email text default null, p_telephone text default null,
  p_niveau text default null, p_licence text default null, p_certificat date default null, p_privilegie boolean default false)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_prenom text := nullif(btrim(left(coalesce(p_prenom, ''), 60)), '');
  v_email text := lower(nullif(btrim(coalesce(p_email, '')), ''));
  v_compte boolean;
  a public.centre_adherents;
begin
  if not public.est_dp_centre(p_centre) then raise exception 'réservé aux directeurs de plongée du centre'; end if;
  if v_prenom is null then raise exception 'le prénom est obligatoire'; end if;
  if v_email is not null and v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'adresse e-mail invalide'; end if;

  if v_email is not null then
    select id into v_id from public.centre_adherents where centre_id = p_centre and lower(email) = v_email;
  end if;
  if v_id is null then
    insert into public.centre_adherents (centre_id, prenom, nom, email, telephone, niveau, licence, certificat_fin, adhesion)
    values (p_centre, v_prenom, nullif(btrim(left(coalesce(p_nom, ''), 60)), ''), v_email,
            nullif(btrim(left(coalesce(p_telephone, ''), 30)), ''), nullif(btrim(left(coalesce(p_niveau, ''), 30)), ''),
            nullif(btrim(left(coalesce(p_licence, ''), 40)), ''), p_certificat, current_date)
    returning id into v_id;
  else
    update public.centre_adherents set
      prenom = v_prenom,
      nom = coalesce(nullif(btrim(left(coalesce(p_nom, ''), 60)), ''), nom),
      telephone = coalesce(nullif(btrim(left(coalesce(p_telephone, ''), 30)), ''), telephone),
      niveau = coalesce(nullif(btrim(left(coalesce(p_niveau, ''), 30)), ''), niveau),
      licence = coalesce(nullif(btrim(left(coalesce(p_licence, ''), 40)), ''), licence),
      certificat_fin = coalesce(p_certificat, certificat_fin)
    where id = v_id;
  end if;
  if p_privilegie then
    update public.centre_adherents set privilegie = true, privilegie_depuis = coalesce(privilegie_depuis, now()) where id = v_id;
  end if;
  update public.centre_adherents set invitation_jeton = coalesce(invitation_jeton, public.nouveau_jeton_invitation()), invite_le = now()
  where id = v_id;
  v_compte := public.relier_membre_existant(v_id);
  select * into a from public.centre_adherents where id = v_id;
  return jsonb_build_object('id', a.id, 'prenom', a.prenom, 'email', a.email, 'telephone', a.telephone,
                            'jeton', a.invitation_jeton, 'compte', v_compte);
end;
$$;
revoke all on function public.ajouter_membre(uuid, text, text, text, text, text, text, date, boolean) from public, anon;
grant execute on function public.ajouter_membre(uuid, text, text, text, text, text, text, date, boolean) to authenticated;

-- Inviter un adhérent déjà dans la liste (import Excel…) : son lien personnel
create or replace function public.inviter_membre(p_adherent uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  a public.centre_adherents;
  v_compte boolean;
begin
  select * into a from public.centre_adherents where id = p_adherent;
  if not found or not public.est_dp_centre(a.centre_id) then raise exception 'réservé aux directeurs de plongée du centre'; end if;
  update public.centre_adherents set invitation_jeton = coalesce(invitation_jeton, public.nouveau_jeton_invitation()), invite_le = now()
  where id = p_adherent;
  v_compte := public.relier_membre_existant(p_adherent);
  select * into a from public.centre_adherents where id = p_adherent;
  return jsonb_build_object('id', a.id, 'prenom', a.prenom, 'email', a.email, 'telephone', a.telephone,
                            'jeton', a.invitation_jeton, 'compte', v_compte);
end;
$$;
revoke all on function public.inviter_membre(uuid) from public, anon;
grant execute on function public.inviter_membre(uuid) to authenticated;

-- Ce que voit la personne qui ouvre le lien (même sans compte)
create or replace function public.voir_invitation_club(p_jeton text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object('club', c.nom, 'ville', c.ville, 'prenom', a.prenom, 'email', a.email,
                            'plongees', (select count(*) from public.adherent_plongees h where h.adherent_id = a.id),
                            'relie', a.user_id is not null)
  from public.centre_adherents a join public.centres c on c.id = a.centre_id
  where a.invitation_jeton = p_jeton;
$$;
revoke all on function public.voir_invitation_club(text) from public;
grant execute on function public.voir_invitation_club(text) to anon, authenticated;

-- Le membre, connecté, accepte l'invitation : son compte est relié au club, les DP sont prévenus
create or replace function public.accepter_invitation_club(p_jeton text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  a public.centre_adherents;
  c public.centres;
  d record;
begin
  if auth.uid() is null then raise exception 'connexion requise'; end if;
  select * into a from public.centre_adherents where invitation_jeton = p_jeton;
  if not found then raise exception 'invitation introuvable'; end if;
  if a.user_id is not null and a.user_id <> auth.uid() then raise exception 'cette invitation est déjà utilisée par un autre compte'; end if;
  select * into c from public.centres where id = a.centre_id;
  if a.user_id is null then
    update public.centre_adherents set user_id = auth.uid(), rejoint_le = now() where id = a.id;
    -- Le profil prend le club et le niveau s'ils ne sont pas encore renseignés
    update public.profiles set club = coalesce(nullif(club, ''), c.nom), niveau = coalesce(nullif(niveau, ''), a.niveau) where id = auth.uid();
    for d in select user_id from public.centre_membres where centre_id = a.centre_id and role = 'dp' loop
      perform public.notifier(d.user_id, 'membre_rejoint', a.prenom || coalesce(' ' || a.nom, '') || ' a rejoint Palanote',
        'Son compte est relié à ' || c.nom || ' : il apparaît comme inscrit dans les membres du club.',
        '/club/membres', jsonb_build_object('adherent_id', a.id));
    end loop;
  end if;
  return jsonb_build_object('club', c.nom, 'prenom', a.prenom);
end;
$$;
revoke all on function public.accepter_invitation_club(text) from public, anon;
grant execute on function public.accepter_invitation_club(text) to authenticated;
