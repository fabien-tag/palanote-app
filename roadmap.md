# Roadmap — import Palanote

## Fait
- App reliée au Supabase personnel de Fabien (projet Palanote), pas à Lovable Cloud
- Import du code du projet « Palanote - Ton app de plongée » (routes, composants, images, styles)
- Fournisseur Google activé dans Supabase, bouton « Continuer avec Google » branché
- Tables de création de compte présentes dans Palanote : profiles, user_settings, consents

## Façon de travailler
- Schéma au fur et à mesure : chaque nouvelle page livrée vient avec son script SQL
  autonome et relançable à coller dans SQL Editor. `sql/palanote-schema-complet.sql`
  reste la référence et la solution de secours.
- Base actuelle : `profiles`, `user_settings`, `consents` uniquement. Le code n'utilise
  encore que `profiles`.

## En cours
- Écran « Numériser mes carnets » (`/numeriser`) : maquette en place, apparition en cascade ;
  les boutons ne font encore rien et aucune table n'est nécessaire pour l'instant.

## À faire
- Écran de prise de photo : livrer avec son script (`ocr_batches`, `ocr_pages`, `ocr_extractions`, `media`, `dives`)
- Tester une inscription complète (email + Google) de bout en bout

- Page carnet : livrer avec son script (`dives`, `dive_buddies`, `dive_sites`, `media`)
- Gérer les ajouts que Fabien annoncera dans le schéma
