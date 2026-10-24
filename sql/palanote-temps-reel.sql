-- Palanote — temps réel (Supabase Realtime)
-- Ajoute les tables suivies par l'app à la publication supabase_realtime :
-- notifications (photo partagée, carnet lu…), dive_buddies (plongée remplie par un binôme),
-- friendships (nouveau binôme). La RLS s'applique aux événements : chacun ne reçoit que ses lignes.
-- Script relançable.

do $$
declare
  t text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
  foreach t in array array['notifications', 'dive_buddies', 'friendships'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- Vérification : les trois tables doivent apparaître
select tablename from pg_publication_tables where pubname = 'supabase_realtime' order by 1;
