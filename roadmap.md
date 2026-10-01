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
- Écran « Numériser mes carnets » (`/numeriser`) : maquette en place, apparition en cascade.
  Les deux boutons ouvrent bien l'appareil photo (capteur arrière) et la galerie du téléphone ;
  les pages choisies s'empilent en aperçus sous les boutons. Rien n'est encore envoyé ni stocké,
  donc aucune table n'est nécessaire pour l'instant.

## À faire
- Envoi des photos vers Supabase + écran de prise de photo : livrer avec son script
  (`ocr_batches`, `ocr_pages`, `ocr_extractions`, `media`, `dives`) et le bucket `photos`
- Tester une inscription complète (email + Google) de bout en bout

- Page carnet : livrer avec son script (`dives`, `dive_buddies`, `dive_sites`, `media`)
- Gérer les ajouts que Fabien annoncera dans le schéma

## Fait — page Nouvelle plongée (30/09)
- Route /nouvelle-plongee : tous les champs de la maquette SaisieComplete, modifiables ; « Enregistrer » bascule en affichage en ligne (texte aux mêmes endroits), « Modifier » repasse en édition. Vérifié dans l'aperçu.
- Bouton « Ajouter ma première plongée » du carnet câblé vers /nouvelle-plongee.
- Script SQL livré : sql/palanote-page-nouvelle-plongee.sql (table dives + RLS + index), à coller dans le SQL Editor. Données pas encore persistées (mode maquette).
- À faire ensuite : enregistrement réel dans Supabase (nécessite connexion utilisateur), puis liste des plongées sur le carnet.

## Fait — enregistrement réel des plongées (01/10)
- « Enregistrer » sur /nouvelle-plongee écrit la plongée dans la table `dives` (création, puis mise à jour si on modifie). Heure de la plongée → `start_time`, durée (menu 0–2 h) → `duration_min` en minutes.
- Sans connexion : la plongée reste sur l'appareil (mode maquette) et un message le signale.
- Le carnet affiche les plongées du compte connecté depuis Supabase.
- Prérequis : avoir exécuté sql/palanote-page-nouvelle-plongee.sql dans le SQL Editor.
