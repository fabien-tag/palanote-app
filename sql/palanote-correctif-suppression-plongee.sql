-- ============================================================
-- Palanote — Correctif : suppression d'une plongée
-- Erreur corrigée : « new row violates row-level security policy for table dives »
--
-- Pourquoi : la suppression est « douce » (on remplit deleted_at au lieu d'effacer).
-- La règle de lecture cachait les plongées où deleted_at est rempli ; Postgres
-- refuse alors une modification qui rend la ligne invisible à son propriétaire.
-- Solution : la règle de lecture vérifie seulement le propriétaire ; c'est l'app
-- qui masque les plongées supprimées (filtre deleted_at is null).
--
-- À coller dans Supabase → SQL Editor → Run. Relançable sans risque.
-- ============================================================

drop policy if exists "dives_select_own" on public.dives;
create policy "dives_select_own" on public.dives
  for select to authenticated
  using (auth.uid() = user_id);
