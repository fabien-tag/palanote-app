-- Palanote — Le profil fait foi partout
-- Quand un plongeur ou un DP change son prénom, son nom, son niveau ou la fin de
-- son certificat médical dans « Mon profil », la copie gardée par chaque club suit :
--   · centre_equipe   (l'équipe : DP, guides, moniteurs des formations)
--   · centre_adherents (les membres du club, reliés à son compte)
-- Script autonome et rejouable. À lancer dans le SQL Editor de Supabase.

create or replace function public.propager_profil()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prenom text := coalesce(nullif(btrim(new.first_name), ''), nullif(btrim(new.prenom), ''));
  v_nom text := nullif(btrim(new.nom), '');
begin
  -- Niveau
  if new.niveau is distinct from old.niveau then
    update public.centre_equipe set niveau = nullif(btrim(new.niveau), ''), updated_at = now()
     where user_id = new.id and niveau is distinct from nullif(btrim(new.niveau), '');
    update public.centre_adherents set niveau = nullif(btrim(new.niveau), ''), updated_at = now()
     where user_id = new.id and niveau is distinct from nullif(btrim(new.niveau), '');
  end if;

  -- Prénom et nom
  if v_prenom is not null
     and (new.first_name is distinct from old.first_name or new.prenom is distinct from old.prenom or new.nom is distinct from old.nom) then
    update public.centre_equipe set nom = btrim(v_prenom || ' ' || coalesce(v_nom, '')), updated_at = now()
     where user_id = new.id and nom is distinct from btrim(v_prenom || ' ' || coalesce(v_nom, ''));
    update public.centre_adherents set prenom = v_prenom, nom = coalesce(v_nom, nom), updated_at = now()
     where user_id = new.id and (prenom is distinct from v_prenom or (v_nom is not null and nom is distinct from v_nom));
  end if;

  -- Certificat médical : seulement une date renseignée (on n'efface pas celle du club)
  if new.certificat_fin is not null and new.certificat_fin is distinct from old.certificat_fin then
    update public.centre_adherents set certificat_fin = new.certificat_fin, updated_at = now()
     where user_id = new.id and certificat_fin is distinct from new.certificat_fin;
  end if;

  return new;
end;
$$;
revoke all on function public.propager_profil() from public, anon, authenticated;

drop trigger if exists profiles_propager on public.profiles;
create trigger profiles_propager after update on public.profiles
  for each row execute function public.propager_profil();

-- Les DP qui entrent dans l'équipe prennent le nom complet du profil
create or replace function public.synchroniser_equipe(p_centre uuid)
returns void
language sql
volatile
security definer
set search_path = public
as $$
  insert into public.centre_equipe (centre_id, user_id, nom, role, niveau)
  select m.centre_id, m.user_id,
         btrim((public.infos_plongeur(m.user_id) ->> 'prenom') || ' ' || coalesce((select nullif(btrim(p.nom), '') from public.profiles p where p.id = m.user_id), '')),
         'dp', public.infos_plongeur(m.user_id) ->> 'niveau'
  from public.centre_membres m
  where m.centre_id = p_centre and m.role = 'dp'
  on conflict (centre_id, user_id) do nothing;
$$;
revoke all on function public.synchroniser_equipe(uuid) from public, anon, authenticated;

-- Rattrapage : les copies déjà décalées reprennent les valeurs du profil
update public.centre_equipe e
   set niveau = btrim(p.niveau), updated_at = now()
  from public.profiles p
 where e.user_id = p.id and nullif(btrim(p.niveau), '') is not null and e.niveau is distinct from btrim(p.niveau);

update public.centre_equipe e
   set nom = btrim(coalesce(nullif(btrim(p.first_name), ''), nullif(btrim(p.prenom), '')) || ' ' || coalesce(nullif(btrim(p.nom), ''), '')), updated_at = now()
  from public.profiles p
 where e.user_id = p.id
   and coalesce(nullif(btrim(p.first_name), ''), nullif(btrim(p.prenom), '')) is not null
   and e.nom is distinct from btrim(coalesce(nullif(btrim(p.first_name), ''), nullif(btrim(p.prenom), '')) || ' ' || coalesce(nullif(btrim(p.nom), ''), ''));

update public.centre_adherents a
   set niveau = btrim(p.niveau), updated_at = now()
  from public.profiles p
 where a.user_id = p.id and nullif(btrim(p.niveau), '') is not null and a.niveau is distinct from btrim(p.niveau);

update public.centre_adherents a
   set certificat_fin = p.certificat_fin, updated_at = now()
  from public.profiles p
 where a.user_id = p.id and p.certificat_fin is not null and (a.certificat_fin is null or a.certificat_fin < p.certificat_fin);
