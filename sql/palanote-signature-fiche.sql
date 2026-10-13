-- ============================================================
-- Palanote — La signature du DP sur la fiche de sécurité
--
-- Le DP signe la fiche de sécurité au doigt (ou à la souris), sans l'imprimer.
-- La signature (une petite image) est gardée avec la date, l'heure et son nom ;
-- elle apparaît sur la fiche et sur le PDF. Il peut signer à nouveau tant que la
-- sortie n'est pas tamponnée (la fiche peut changer jusque-là).
--
-- Prérequis : palanote-sorties-club.sql (sorties, est_dp_sortie).
-- À coller dans Supabase → SQL Editor → Run. Relançable sans risque.
-- ============================================================

create table if not exists public.fiche_signatures (
  sortie_id uuid primary key references public.sorties(id) on delete cascade,
  signature text not null, -- image PNG (data URL), 200 ko au plus
  signe_par uuid references auth.users(id) on delete set null,
  signe_le timestamptz not null default now(),
  constraint fiche_signatures_image_check check (signature like 'data:image/png;base64,%' and char_length(signature) <= 200000)
);
alter table public.fiche_signatures enable row level security; -- lecture et écriture par les fonctions seulement
grant all on public.fiche_signatures to service_role;

create or replace function public.signer_fiche(p_sortie uuid, p_signature text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  s public.sorties;
begin
  select * into s from public.sorties where id = p_sortie and deleted_at is null;
  if not found or not public.est_dp_sortie(p_sortie) then raise exception 'réservé au directeur de plongée'; end if;
  if s.statut = 'validee' and exists (select 1 from public.fiche_signatures where sortie_id = p_sortie) then
    raise exception 'sortie tamponnée : la fiche signée ne change plus';
  end if;
  if p_signature is null then
    delete from public.fiche_signatures where sortie_id = p_sortie;
    return null;
  end if;
  insert into public.fiche_signatures (sortie_id, signature, signe_par, signe_le)
  values (p_sortie, p_signature, auth.uid(), now())
  on conflict (sortie_id) do update set signature = excluded.signature, signe_par = excluded.signe_par, signe_le = excluded.signe_le;
  return public.signature_fiche(p_sortie);
end;
$$;
revoke all on function public.signer_fiche(uuid, text) from public, anon;
grant execute on function public.signer_fiche(uuid, text) to authenticated;

create or replace function public.signature_fiche(p_sortie uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case when public.est_dp_sortie(p_sortie) then (
    select jsonb_build_object('signature', f.signature, 'signe_le', f.signe_le,
                              'par', public.infos_plongeur(f.signe_par) ->> 'prenom',
                              'nom', (select nullif(to_jsonb(pr) ->> 'nom', '') from public.profiles pr where pr.id = f.signe_par))
    from public.fiche_signatures f where f.sortie_id = p_sortie) end;
$$;
revoke all on function public.signature_fiche(uuid) from public, anon;
grant execute on function public.signature_fiche(uuid) to authenticated;
