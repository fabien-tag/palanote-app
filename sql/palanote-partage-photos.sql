-- ============================================================
-- Palanote — Partage des photos avec la palanquée, avec un accord donné une fois
-- (retour du test du 23 octobre 2026)
--
-- 1. profiles.partage_photos : null = jamais demandé, true = j'accepte, false = je refuse.
--    Demandé une fois dans l'app (à la première photo d'une plongée avec binômes),
--    modifiable ensuite dans Moi › Confidentialité.
-- 2. Avec l'accord, chaque photo ajoutée à une plongée est partagée d'office avec
--    les binômes qui ont cette plongée dans leur carnet (et seulement eux).
-- 3. Une photo partagée prévient les autres plongeurs de la plongée (cloche + notification).
--
-- Idempotent : on peut le relancer sans risque.
-- ============================================================

alter table public.profiles add column if not exists partage_photos boolean;

-- 2. Partage d'office à l'ajout d'une photo, si le plongeur a donné son accord
create or replace function public.media_partage_auto()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.dive_id is not null and coalesce(new.partagee, false) = false
     and exists (select 1 from public.profiles p where p.id = new.user_id and p.partage_photos is true) then
    new.partagee := true;
  end if;
  return new;
end;
$$;
drop trigger if exists media_partage_auto on public.media;
create trigger media_partage_auto before insert on public.media
  for each row execute function public.media_partage_auto();

-- 3. Prévenir la palanquée : « Fabien a ajouté une photo à votre plongée »
--    (une seule notification non lue par plongée et par tranche de 10 minutes)
create or replace function public.media_prevenir_palanquee()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.partagee is not true or new.dive_id is null or new.deleted_at is not null then return null; end if;
  if tg_op = 'UPDATE' and old.partagee is true then return null; end if;
  insert into public.notifications (user_id, type, titre, texte, lien, donnees)
  select d.user_id,
         'photo_partagee',
         coalesce(nullif(public.infos_plongeur(new.user_id) ->> 'prenom', ''), 'Ton binôme') || ' a ajouté une photo à votre plongée',
         coalesce(nullif(d.site_name, ''), 'Votre plongée') || coalesce(' · ' || to_char(d.dive_date, 'DD/MM/YYYY'), ''),
         '/plongee/photos?id=' || d.id,
         jsonb_build_object('dive_id', d.id, 'media_id', new.id, 'de', new.user_id)
  from public.dives d
  where d.id = any (public.groupe_plongee(new.dive_id))
    and d.deleted_at is null
    and d.user_id <> new.user_id
    and not exists (
      select 1 from public.notifications n
      where n.user_id = d.user_id and n.type = 'photo_partagee' and n.lue_le is null
        and n.donnees ->> 'dive_id' = d.id::text and n.created_at > now() - interval '10 minutes'
    );
  return null;
end;
$$;
drop trigger if exists media_prevenir_palanquee on public.media;
create trigger media_prevenir_palanquee after insert or update of partagee on public.media
  for each row execute function public.media_prevenir_palanquee();

-- Le réglage, depuis l'app. Activer partage aussi les photos déjà dans le carnet ;
-- désactiver retire le partage de toutes ses photos (retrait de l'accord).
create or replace function public.regler_partage_photos(p_actif boolean)
returns integer
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  n integer;
begin
  if auth.uid() is null then raise exception 'connexion requise'; end if;
  update public.profiles set partage_photos = p_actif, updated_at = now() where id = auth.uid();
  if p_actif then
    update public.media set partagee = true, updated_at = now()
    where user_id = auth.uid() and dive_id is not null and deleted_at is null and partagee = false;
  else
    update public.media set partagee = false, updated_at = now()
    where user_id = auth.uid() and partagee = true;
  end if;
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke all on function public.regler_partage_photos(boolean) from public, anon;
grant execute on function public.regler_partage_photos(boolean) to authenticated;
