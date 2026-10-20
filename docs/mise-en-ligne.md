# Check-list de mise en ligne de Palanote

Les 5 premières tâches s'affichent aussi dans le tableau de bord (Moi › Tableau de bord), tant qu'elles ne sont pas faites.

## Informations légales
- [ ] **E-mail de contact** : le remplir dans `src/lib/legal.ts` → `EDITEUR.email: "contact@…"`. Il apparaît alors dans les mentions légales, la politique de confidentialité et les CGU (aujourd'hui : « adresse e-mail bientôt disponible »).
- [x] **Hébergeur** (Vercel ajouté le 20/10/2026) : vérifier dans `src/lib/legal.ts` → `HEBERGEURS` que c'est bien Lovable qui héberge la version publique (sinon mettre le bon nom, l'adresse et le site).
- [ ] Relire les 3 pages : /mentions-legales, /politique-de-confidentialite, /conditions-utilisation.
- [ ] **Forfaits payants** (pack « Numériser mes carnets » 4,99 €, Palanote+ 19 €/an) : brancher Stripe, vérifier l'activité déclarée de la micro-entreprise, ajouter des conditions de vente (prix, rétractation) et un médiateur de la consommation, ajouter Stripe dans la politique de confidentialité.
- [ ] Ajuster `pages_offertes` (50) dans `admin_reglages` si besoin, et suivre les « Ça m'intéresse » dans les retours (sujet « Forfait »).
- [ ] Si les conditions changent : modifier `VERSION_CONDITIONS` et `DATE_CONDITIONS` dans `src/lib/legal.ts` → chacun devra les accepter à nouveau.

## Connexion
- [x] Retirer « Se souvenir de moi » de la page Connexion (`src/routes/connexion.tsx`).
- [ ] Connexion Google : URI de redirection `https://imjbtxvhanvewopafmxk.supabase.co/auth/v1/callback` dans Google Cloud, écran de consentement publié.
- [ ] Supabase › Authentication › URL Configuration : ajouter le domaine final (Site URL + Redirect URLs).

## Données
- [ ] Purge automatique : comptes sans connexion depuis 3 ans (après un e-mail), données techniques de plus de 12 mois (promis dans la politique de confidentialité).
- [ ] Fonctions serveur déployées : lire-page, envoyer-lettre, identifier-especes. Secrets ANTHROPIC_API_KEY et RESEND_API_KEY en place.
