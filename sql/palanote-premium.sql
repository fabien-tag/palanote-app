-- Palanote — « membres privilégiés » devient « membres premium » (retour d'un test utilisateur, 23/10/2026)
-- Change seulement deux textes vus par les plongeurs : la notification d'invitation et le message
-- d'une sortie réservée. Rien d'autre ne bouge (tables, droits, noms des fonctions).
-- Idempotent : on peut le relancer sans risque.

do $$
declare
  d text;
begin
  d := pg_get_functiondef('public.inviter_privilegies'::regproc);
  if position('membres privilégiés' in d) > 0 then
    execute replace(d, 'Plongée réservée aux membres privilégiés', 'Plongée réservée aux membres premium');
  end if;

  d := pg_get_functiondef('public.controler_sortie_reservee'::regproc);
  if position('membres privilégiés' in d) > 0 then
    execute replace(d, 'sortie réservée aux membres privilégiés', 'sortie réservée aux membres premium');
  end if;
end $$;
