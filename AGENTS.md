<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Rules
- Backend is the user's own Supabase project (Palanote), wired manually via src/lib/supabase.ts with the publishable key — the OAuth integration failed; schema changes are delivered as SQL scripts for the user to run in the Supabase SQL editor.
- Ship schema incrementally: every new page/feature comes with its own self-contained, idempotent SQL script (enums, parent tables, children, RLS, buckets) delivered in the same message, because Fabien runs one page's worth of tables at a time in the SQL editor; sql/palanote-schema-complet.sql stays the reference.

## Cadre de la formation (depuis le 14 octobre 2026)
Palanote suit les recommandations du Bootcamp (module agents) jusqu'à la restitution du 26 octobre :
- Une seule brique prioritaire : la numérisation des carnets par l'agent de lecture (supabase/functions/lire-page). Le reste de l'app est gelé : corrections de bugs seulement, pas de nouvelle fonctionnalité sans accord explicite de Fabien.
- Tout travail sur l'agent se cadre avec la grille du cours : archétype (B, extraction structurée), les 6 briques (harnais, provider, connecteurs, database, contexte, tâches), l'échec acceptable (silence, fallback, retry, escalade humaine) écrit dans le PRD, et un eval set de 10 à 20 cas (règle 60-20-20 : nominaux, bordure, hostiles) avec critère réussi / raté.
- Une modification de la consigne, des outils ou du modèle de l'agent se valide sur l'eval set avant d'être livrée, et s'observe ensuite (journal_agent, étapes, jetons, taux de correction humaine).
- Le plongeur valide toujours : l'agent propose, il ne décide jamais seul de ce qui entre dans le carnet.

## Livraison par lots (règle convenue avec Fabien, 22 octobre 2026)
- Le travail se fait sur une branche locale `travail`, jamais directement sur `main`.
- Quand un lot est prêt et testé (tsc, build, tests Playwright), il est présenté à Fabien ; après son accord, il part sur `main` en UN seul commit (squash), avec un message qui résume le lot.
- Ne jamais réécrire l'historique déjà poussé (pas de force push, pas de rebase de commits publiés).
- Seule exception à la règle du lot : un correctif urgent demandé par Fabien (ex. pendant une évaluation), poussé seul.
- Pas de push sur `main` dans les deux jours qui précèdent la soutenance du 26 octobre, sauf correctif urgent.

