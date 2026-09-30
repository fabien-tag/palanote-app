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
