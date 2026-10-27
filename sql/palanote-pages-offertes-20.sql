-- Palanote — Pages offertes : 20 au lieu de 50 (retour du jury, 26 octobre 2026)
-- La lecture des carnets papier par l'IA reste offerte pour les 20 premières pages,
-- puis demande un forfait. Le serveur fait foi : admin_reglages.pages_offertes.
-- Les plongeurs qui ont déjà lu plus de 20 pages gardent leurs plongées ; ils ont simplement 0 page restante.
-- Script relançable.

alter table public.admin_reglages alter column pages_offertes set default 20;
update public.admin_reglages set pages_offertes = 20;

-- Vérification : doit afficher 20
select pages_offertes from public.admin_reglages;
