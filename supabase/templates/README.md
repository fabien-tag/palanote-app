# E-mails de connexion Palanote

Modèles des e-mails envoyés par Supabase Auth, aux couleurs de Palanote.
À coller dans **Supabase › Authentication › Emails › Templates** (un onglet par modèle).

| Onglet Supabase | Fichier | Objet (Subject) |
|---|---|---|
| Confirm signup | `confirmation.html` | Confirme ton adresse e-mail · Palanote |
| Reset password | `recovery.html` | Ton nouveau mot de passe Palanote |
| Magic link | `magic_link.html` | Ton lien de connexion Palanote |
| Change email address | `email_change.html` | Confirme ta nouvelle adresse · Palanote |
| Invite user | `invite.html` | Tu es invité sur Palanote |
| Reauthentication | `reauthentication.html` | Ton code de vérification Palanote |

Les liens utilisent `{{ .ConfirmationURL }}` : les redirections de l'app (`/connexion`, `/nouveau-mot-de-passe`,
`/moi/reglages`) restent celles du code (`src/lib/auth.ts`, `src/lib/moi.ts`).
Le logo est servi par l'app : `https://palanote.fabientag.fr/icone-192.png`.

**Envoi :** le service d'e-mail intégré à Supabase est limité à quelques messages par heure. Pour un vrai usage,
brancher Resend dans **Authentication › Emails › SMTP Settings** : hôte `smtp.resend.com`, port `465`,
utilisateur `resend`, mot de passe = clé API Resend, expéditeur sur un domaine vérifié chez Resend.
