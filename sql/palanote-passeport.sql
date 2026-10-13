-- ============================================================
-- Palanote — Le passeport du plongeur
--
-- Le plongeur range ses brevets (niveau, Nitrox, Trimix…) avec la photo de ses cartes,
-- et la date de fin de son certificat médical (la date seulement, jamais le document).
-- Il montre son passeport au directeur de plongée sur le bateau ; le DP le consulte aussi
-- depuis la sortie, et peut marquer une carte « vérifiée » (le plongeur ne peut pas se
-- l'attribuer lui-même, et la vérification tombe s'il modifie sa carte).
-- Qui voit le passeport : le plongeur, et les DP qui l'encadrent (une sortie de leur centre
-- dans l'année, ou adhérent de leur club).
--
-- Prérequis : palanote-sorties-club.sql, palanote-planning-club.sql (est_dp_centre)
--             et palanote-import-excel.sql (centre_adherents).
-- À coller dans Supabase → SQL Editor → Run. Relançable sans risque.
-- ============================================================

alter table public.profiles add column if not exists certificat_fin date; -- fin de validité du certificat médical

create table if not exists public.plongeur_brevets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null default 'niveau',
  intitule text not null,
  organisme text,
  numero text,
  obtenu_le date,
  photo_recto text, -- chemin dans le stockage « passeports »
  photo_verso text,
  verifie_par uuid references auth.users(id) on delete set null,
  verifie_le timestamptz,
  verifie_centre text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint plongeur_brevets_type_check check (type in ('niveau', 'nitrox', 'trimix', 'autre')),
  constraint plongeur_brevets_intitule_check check (char_length(btrim(intitule)) between 1 and 80)
);
create index if not exists plongeur_brevets_user_idx on public.plongeur_brevets (user_id);

grant select, insert, update, delete on public.plongeur_brevets to authenticated;
grant all on public.plongeur_brevets to service_role;
alter table public.plongeur_brevets enable row level security;
drop policy if exists "Lire ses brevets" on public.plongeur_brevets;
create policy "Lire ses brevets" on public.plongeur_brevets for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Ajouter un brevet" on public.plongeur_brevets;
create policy "Ajouter un brevet" on public.plongeur_brevets for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "Modifier un brevet" on public.plongeur_brevets;
create policy "Modifier un brevet" on public.plongeur_brevets for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Retirer un brevet" on public.plongeur_brevets;
create policy "Retirer un brevet" on public.plongeur_brevets for delete to authenticated using (auth.uid() = user_id);

drop trigger if exists plongeur_brevets_updated_at on public.plongeur_brevets;
create trigger plongeur_brevets_updated_at before update on public.plongeur_brevets
  for each row execute function public.update_updated_at_column();

-- La vérification ne s'écrit que par verifier_brevet ; elle tombe si la carte change
create or replace function public.proteger_verification_brevet()
returns trigger
language plpgsql
as $$
begin
  if current_setting('palanote.verification', true) = 'oui' then return new; end if;
  if tg_op = 'INSERT' then
    new.verifie_par := null; new.verifie_le := null; new.verifie_centre := null;
  elsif (new.type, new.intitule, new.organisme, new.numero, new.obtenu_le, new.photo_recto, new.photo_verso)
        is distinct from (old.type, old.intitule, old.organisme, old.numero, old.obtenu_le, old.photo_recto, old.photo_verso) then
    new.verifie_par := null; new.verifie_le := null; new.verifie_centre := null;
  else
    new.verifie_par := old.verifie_par; new.verifie_le := old.verifie_le; new.verifie_centre := old.verifie_centre;
  end if;
  return new;
end;
$$;
drop trigger if exists plongeur_brevets_verification on public.plongeur_brevets;
create trigger plongeur_brevets_verification before insert or update on public.plongeur_brevets
  for each row execute function public.proteger_verification_brevet();

-- ------------------------------------------------------------
-- Qui peut voir le passeport d'un plongeur
-- ------------------------------------------------------------
create or replace function public.peut_voir_passeport(p_owner uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() = p_owner
    or exists (select 1 from public.sortie_participants p join public.sorties s on s.id = p.sortie_id
               where p.user_id = p_owner and s.deleted_at is null and s.date_sortie >= current_date - 365
                 and public.est_dp_sortie(s.id))
    or exists (select 1 from public.centre_adherents a where a.user_id = p_owner and public.est_dp_centre(a.centre_id));
$$;
revoke all on function public.peut_voir_passeport(uuid) from public, anon;
grant execute on function public.peut_voir_passeport(uuid) to authenticated;

-- Variante pour le stockage (le dossier est un texte)
create or replace function public.peut_voir_passeport_dossier(p_dossier text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  return public.peut_voir_passeport(p_dossier::uuid);
exception when others then
  return false;
end;
$$;
revoke all on function public.peut_voir_passeport_dossier(text) from public, anon;
grant execute on function public.peut_voir_passeport_dossier(text) to authenticated;

-- ------------------------------------------------------------
-- Photos des cartes : stockage privé « passeports », un dossier par plongeur
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('passeports', 'passeports', false, 6291456, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "passeports_select" on storage.objects;
create policy "passeports_select" on storage.objects for select to authenticated
  using (bucket_id = 'passeports' and public.peut_voir_passeport_dossier((storage.foldername(name))[1]));
drop policy if exists "passeports_insert" on storage.objects;
create policy "passeports_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'passeports' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "passeports_update" on storage.objects;
create policy "passeports_update" on storage.objects for update to authenticated
  using (bucket_id = 'passeports' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "passeports_delete" on storage.objects;
create policy "passeports_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'passeports' and (storage.foldername(name))[1] = auth.uid()::text);

-- ------------------------------------------------------------
-- Lecture du passeport
-- ------------------------------------------------------------
create or replace function public.passeport_plongeur(p_user uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.peut_voir_passeport(p_user) then raise exception 'passeport non partagé'; end if;
  return public.infos_plongeur(p_user) || jsonb_build_object(
    'certificat_fin', (select certificat_fin from public.profiles where id = p_user),
    'moi', auth.uid() = p_user,
    'brevets', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', b.id, 'type', b.type, 'intitule', b.intitule, 'organisme', b.organisme, 'numero', b.numero,
        'obtenu_le', b.obtenu_le, 'photo_recto', b.photo_recto, 'photo_verso', b.photo_verso,
        'verifie_le', b.verifie_le, 'verifie_centre', b.verifie_centre,
        'verifie_par', public.infos_plongeur(b.verifie_par) ->> 'prenom')
        order by array_position(array['niveau', 'nitrox', 'trimix', 'autre'], b.type), b.obtenu_le desc nulls last)
      from public.plongeur_brevets b where b.user_id = p_user), '[]'::jsonb));
end;
$$;
revoke all on function public.passeport_plongeur(uuid) from public, anon;
grant execute on function public.passeport_plongeur(uuid) to authenticated;

-- Pour le DP : le résumé des passeports de tous les inscrits d'une sortie (alertes)
create or replace function public.passeports_sortie(p_sortie uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case when public.est_dp_sortie(p_sortie) then coalesce((
    select jsonb_agg(jsonb_build_object(
      'user_id', p.user_id,
      'certificat_fin', pr.certificat_fin,
      -- Déclaré au profil, ou carte dans le passeport (« carte » = preuve photographiée)
      'nitrox', exists (select 1 from public.plongeur_brevets b where b.user_id = p.user_id and b.type in ('nitrox', 'trimix'))
                or coalesce(pr.certifications && array['Nitrox', 'Trimix'], false),
      'trimix', exists (select 1 from public.plongeur_brevets b where b.user_id = p.user_id and b.type = 'trimix')
                or coalesce('Trimix' = any(pr.certifications), false),
      'nitrox_carte', exists (select 1 from public.plongeur_brevets b where b.user_id = p.user_id and b.type in ('nitrox', 'trimix') and b.photo_recto is not null),
      'brevets', (select count(*) from public.plongeur_brevets b where b.user_id = p.user_id),
      'verifies', (select count(*) from public.plongeur_brevets b where b.user_id = p.user_id and b.verifie_le is not null)))
    from public.sortie_participants p
    left join public.profiles pr on pr.id = p.user_id
    where p.sortie_id = p_sortie and p.user_id is not null), '[]'::jsonb) else '[]'::jsonb end;
$$;
revoke all on function public.passeports_sortie(uuid) from public, anon;
grant execute on function public.passeports_sortie(uuid) to authenticated;

-- Le DP a vu la carte : « vérifiée par Marc (Aqua Club Hyères) »
create or replace function public.verifier_brevet(p_brevet uuid, p_oui boolean)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  b public.plongeur_brevets;
  v_centre text;
begin
  select * into b from public.plongeur_brevets where id = p_brevet;
  if not found or b.user_id = auth.uid() or not public.peut_voir_passeport(b.user_id) then
    raise exception 'seul un directeur de plongée qui t''encadre peut vérifier une carte';
  end if;
  select c.nom into v_centre from public.centre_membres m join public.centres c on c.id = m.centre_id
  where m.user_id = auth.uid() and m.role = 'dp' order by m.created_at limit 1;
  perform set_config('palanote.verification', 'oui', true);
  update public.plongeur_brevets set
    verifie_par = case when p_oui then auth.uid() end,
    verifie_le = case when p_oui then now() end,
    verifie_centre = case when p_oui then v_centre end
  where id = p_brevet;
  perform set_config('palanote.verification', '', true);
  if p_oui then
    perform public.notifier(b.user_id, 'passeport_verifie', 'Carte vérifiée',
      b.intitule || ' : vérifiée par ' || coalesce(public.infos_plongeur(auth.uid()) ->> 'prenom', 'ton DP') || coalesce(' (' || v_centre || ')', '') || '.',
      '/moi/passeport', jsonb_build_object('brevet_id', b.id));
  end if;
end;
$$;
revoke all on function public.verifier_brevet(uuid, boolean) from public, anon;
grant execute on function public.verifier_brevet(uuid, boolean) to authenticated;

-- La fiche de sécurité renvoie aussi l'identifiant de chaque plongeur, pour y ajouter
-- la mention Nitrox / Trimix du passeport (même fonction que palanote-accueil-dp.sql)
create or replace function public.fiche_securite(p_sortie uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  s public.sorties;
  c public.centres;
begin
  if not public.est_dp_sortie(p_sortie) then raise exception 'réservé au directeur de plongée'; end if;
  select * into s from public.sorties where id = p_sortie;
  select * into c from public.centres where id = s.centre_id;
  return jsonb_build_object(
    'id', s.id, 'date', s.date_sortie, 'date_texte', public.date_fr(s.date_sortie), 'heure', s.heure,
    'site', s.site_name, 'lieu', s.site_location, 'bateau', s.bateau, 'profondeur_prevue', s.profondeur_prevue,
    'consignes', s.consignes, 'statut', s.statut, 'duree_min', s.duree_min, 'temp_fond_c', s.temp_fond_c,
    'visibilite_m', s.visibilite_m,
    'centre', case when c.id is null then null else jsonb_build_object('nom', c.nom, 'ville', c.ville) end,
    'dp', public.infos_plongeur(s.dp_id) || jsonb_build_object(
            'nom', (select nullif(to_jsonb(pr) ->> 'nom', '') from public.profiles pr where pr.id = s.dp_id)),
    'plongeurs', coalesce((
      select jsonb_agg(jsonb_build_object(
               'palanquee', q.numero,
               'user_id', p.user_id,
               'prenom', coalesce(public.infos_plongeur(p.user_id) ->> 'prenom', p.nom_prevu),
               'nom', (select nullif(to_jsonb(pr) ->> 'nom', '') from public.profiles pr where pr.id = p.user_id),
               'niveau', public.infos_plongeur(p.user_id) ->> 'niveau',
               'guide', p.user_id is not null and p.user_id = q.guide_id,
               'prevu', p.user_id is null,
               'prof_max', d.max_depth_m, 'duree', d.duration_min, 'immersion', d.start_time, 'sortie', d.end_time)
             order by q.numero nulls last, (p.user_id = q.guide_id) desc nulls last, p.created_at)
      from public.sortie_participants p
      left join public.sortie_palanquees q on q.id = p.palanquee_id
      left join public.dives d on d.id = p.dive_id and d.deleted_at is null
      where p.sortie_id = s.id), '[]'::jsonb)
  );
end;
$$;
revoke all on function public.fiche_securite(uuid) from public, anon;
