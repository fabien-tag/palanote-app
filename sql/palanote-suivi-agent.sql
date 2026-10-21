-- Palanote — Le suivi de l'agent de lecture en production (tableau de bord admin › Agent IA)
-- Ce que l'agent a vraiment fait sur les pages des plongeurs : pages lues, échecs, vérifications,
-- étapes, jetons consommés, et le taux de correction humaine (champs proposés par l'IA que le
-- plongeur a dû corriger à la relecture). Les pages lues avant l'agent (lecture directe) sont
-- comptées à part, pour comparer.
-- Aucune donnée personnelle n'est renvoyée : seulement des chiffres agrégés.
-- Réservé à l'administrateur. Prérequis : palanote-tableau-de-bord.sql, palanote-agent-lecture.sql.
-- Script autonome et rejouable, à lancer dans le SQL Editor de Supabase.

-- Compare deux valeurs de champ comme le ferait un humain : casse, espaces, virgule décimale
create or replace function public.valeur_normalisee(v text)
returns text
language sql
immutable
set search_path = public
as $$
  select case
    when v is null or btrim(v) = '' then null
    when replace(btrim(v), ',', '.') ~ '^-?[0-9]+(\.[0-9]+)?$' then (replace(btrim(v), ',', '.')::numeric)::text
    else lower(regexp_replace(btrim(v), '\s+', ' ', 'g'))
  end;
$$;

create or replace function public.admin_suivi_agent(p_jours int default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_depuis timestamptz := now() - make_interval(days => greatest(1, least(p_jours, 365)));
  v_resultat jsonb;
begin
  if not public.est_admin() then raise exception 'réservé à l''administrateur'; end if;

  with pages as (
    select p.*, case when p.etapes_agent is null then 'direct' else 'agent' end as mode
    from public.ocr_pages p
    where p.created_at >= v_depuis
  ),
  -- Chaque champ proposé par l'IA, face à la valeur validée par le plongeur
  champs as (
    select pg.mode,
      e.confiances ->> c.cle as confiance,
      public.valeur_normalisee(pg.reponse_modele -> 'plongees' -> e.ordre -> c.cle ->> 'valeur') as propose,
      public.valeur_normalisee(e.champs ->> c.cle) as valide
    from pages pg
    join public.ocr_extractions e on e.page_id = pg.id and e.statut = 'validee'
    cross join lateral jsonb_object_keys(coalesce(e.champs, '{}'::jsonb)) as c(cle)
    where c.cle not in ('commentaire', 'signee', 'tamponnee')
  ),
  par_mode as (
    select m.mode,
      jsonb_build_object(
        'pages', count(p.id),
        'lues', count(*) filter (where statut = 'lue'),
        'illisibles', count(*) filter (where statut = 'illisible'),
        'erreurs', count(*) filter (where statut = 'erreur'),
        'en_cours', count(*) filter (where statut in ('en_attente', 'en_cours')),
        'avec_verification', count(*) filter (where jsonb_array_length(coalesce(journal_agent, '[]'::jsonb)) > 0),
        'verifications', coalesce(sum(jsonb_array_length(coalesce(journal_agent, '[]'::jsonb))), 0),
        'zooms', coalesce(sum((select count(*) from jsonb_array_elements(coalesce(journal_agent, '[]'::jsonb)) j where j ->> 'outil' = 'zoomer')), 0),
        'pages_voisines', coalesce(sum((select count(*) from jsonb_array_elements(coalesce(journal_agent, '[]'::jsonb)) j where j ->> 'outil' = 'voir_page_voisine')), 0),
        'etapes_moyennes', round(avg(etapes_agent)::numeric, 2),
        'tokens_entree', coalesce(sum(tokens_entree), 0),
        'tokens_sortie', coalesce(sum(tokens_sortie), 0),
        'pages_avec_tokens', count(*) filter (where tokens_entree is not null),
        'champs_proposes', (select count(*) from champs c where c.mode = m.mode and c.propose is not null),
        'champs_corriges', (select count(*) from champs c where c.mode = m.mode and c.propose is not null and c.propose is distinct from c.valide),
        'faux_surs', (select count(*) from champs c where c.mode = m.mode and c.confiance = 'sur' and c.propose is not null and c.propose is distinct from c.valide),
        'champs_surs', (select count(*) from champs c where c.mode = m.mode and c.confiance = 'sur' and c.propose is not null),
        'champs_completes', (select count(*) from champs c where c.mode = m.mode and c.propose is null and c.valide is not null)
      ) as chiffres
    from (select 'agent'::text as mode union all select 'direct') m
    left join pages p on p.mode = m.mode
    group by m.mode
  )
  select jsonb_build_object(
    'jours', p_jours,
    'modes', (select jsonb_object_agg(mode, chiffres) from par_mode),
    'plongees_validees', (select count(*) from public.ocr_extractions e join pages p on p.id = e.page_id where e.statut = 'validee'),
    'plongees_rejetees', (select count(*) from public.ocr_extractions e join pages p on p.id = e.page_id where e.statut = 'rejetee'),
    'par_jour', (
      select coalesce(jsonb_agg(jsonb_build_object('jour', j::date, 'agent', (select count(*) from pages p where p.mode = 'agent' and p.created_at::date = j::date), 'direct', (select count(*) from pages p where p.mode = 'direct' and p.created_at::date = j::date)) order by j), '[]'::jsonb)
      from generate_series(current_date - 13, current_date, interval '1 day') j
    ),
    'dernieres', (
      select coalesce(jsonb_agg(x order by x ->> 'le' desc), '[]'::jsonb) from (
        select jsonb_build_object('le', p.created_at, 'mode', p.mode, 'statut', p.statut, 'etapes', p.etapes_agent,
          'verifications', (select coalesce(jsonb_agg(j ->> 'raison'), '[]'::jsonb) from jsonb_array_elements(coalesce(p.journal_agent, '[]'::jsonb)) j),
          'tokens', coalesce(p.tokens_entree, 0) + coalesce(p.tokens_sortie, 0), 'erreur', left(p.erreur, 160)) as x
        from pages p order by p.created_at desc limit 12
      ) d
    )
  ) into v_resultat;
  return v_resultat;
end;
$$;
revoke all on function public.admin_suivi_agent(int) from public, anon;
grant execute on function public.admin_suivi_agent(int) to authenticated;
revoke all on function public.valeur_normalisee(text) from public, anon;
grant execute on function public.valeur_normalisee(text) to authenticated;
