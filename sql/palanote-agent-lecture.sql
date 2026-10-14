-- Palanote — L'agent de lecture des carnets : son journal de travail
-- L'agent lit une page, puis décide lui-même de vérifier ses doutes (zoomer sur une zone,
-- comparer avec la page voisine) avant d'enregistrer. Chaque page garde la trace de ce qu'il a fait,
-- le nombre d'étapes et les jetons consommés (pour suivre le coût et la qualité).
-- Prérequis : palanote-numerisation.sql. Script autonome et rejouable, à lancer dans le SQL Editor de Supabase.

alter table public.ocr_pages add column if not exists journal_agent jsonb not null default '[]'::jsonb;
alter table public.ocr_pages add column if not exists etapes_agent integer;
alter table public.ocr_pages add column if not exists tokens_entree integer;
alter table public.ocr_pages add column if not exists tokens_sortie integer;

comment on column public.ocr_pages.journal_agent is 'Vérifications faites par l''agent : [{etape, outil, raison, zone, resultat}]';
comment on column public.ocr_pages.etapes_agent is 'Nombre d''appels au modèle pour lire la page (1 = lecture directe)';
