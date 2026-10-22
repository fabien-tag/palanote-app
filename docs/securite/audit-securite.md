# Audit de sécurité — Palanote

**Audit initial :** 21 octobre 2026, réalisé avec Claude Code (agent IA) sur le dépôt et le projet Supabase de production.
**Revérification :** 22 octobre 2026, sur la branche `main` et la base de production.
**Périmètre :** le code du dépôt et tout son historique Git, la configuration Supabase (RLS, fonctions, stockage, Auth), les comptes Supabase, Vercel et GitHub.

Ce rapport porte sur les **failles qui exposeraient l'app ou ses données**. Les bugs qui cassent l'app relèvent du rapport de QA, qui est un document séparé.

## En bref

Aucune donnée n'est exposée :
- aucune clé secrète n'est présente dans le code ni dans l'historique Git ;
- les 47 tables ont la RLS activée ;
- aucune politique n'ouvre de données aux visiteurs anonymes.

L'audit a trouvé **une faille réelle**, corrigée le jour même : n'importe quel utilisateur connecté pouvait devenir directeur de plongée d'un centre déjà géré. Il reste **une faille assumée** : la revendication d'un centre libre ne vérifie pas que la personne en est vraiment responsable. Elle est documentée plus bas, avec sa correction prévue.

## Méthode

1. **Secrets :** recherche de motifs de clés (Anthropic `sk-ant-`, Supabase `sb_secret_`, `service_role`, Resend `re_…`, Stripe `sk_live_` et `sk_test_`) dans le code et dans **tout l'historique Git**.
2. **Fichier `.env` :** vérifier qu'il est ignoré par Git et qu'aucun fichier `.env` n'a jamais été versionné.
3. **Clé publique et clé secrète :** vérifier que le navigateur n'utilise que la clé publique `sb_publishable_…` et que la clé secrète reste côté serveur.
4. **RLS :** pour chaque table, vérifier que la RLS est active et ce que chaque politique autorise. Puis un test réel avec un visiteur anonyme et avec un utilisateur inconnu sur les tables sensibles.
5. **Fonctions SQL `security definer` :** qui peut les appeler, et ce qu'elles vérifient.
6. **Stockage :** buckets publics ou privés.
7. **Comptes :** double authentification et protection des mots de passe.
8. **Conseiller de sécurité Supabase** (Security Advisor).

## Constats, du plus grave au moins grave

| # | Gravité | Constat | État |
|---:|---|---|---|
| 1 | **Critique** | `rejoindre_centre` : n'importe quel utilisateur connecté pouvait rejoindre comme directeur de plongée un centre **déjà géré** par un autre DP, et voir ses adhérents et leurs certificats médicaux. | **Corrigé le 21/10** ([`sql/palanote-centre-protege.sql`](../../sql/palanote-centre-protege.sql)). La fonction refuse avec `centre_deja_gere`, et l'interface affiche « Déjà géré ». Couvert par un test Playwright. |
| 2 | Moyen | 5 fonctions SQL sans `search_path` fixé (risque de détournement par un objet du même nom). | **Corrigé le 21/10** ([`sql/palanote-securite-nettoyage.sql`](../../sql/palanote-securite-nettoyage.sql)). |
| 3 | Faible | Politiques en double sur `profiles` (« Lire son profil », « Modifier son profil »), sans faille, mais source de confusion. | **Corrigé le 21/10** (même script). |
| 4 | Faible | `.gitignore` ne listait pas `.env`. Aucun `.env` n'avait été versionné, mais rien ne l'empêchait. | **Corrigé le 21/10** : `.env`, `.env.*`, `supabase/.env` et `supabase/.temp` sont ignorés. |
| 5 | Faible | Comptes sans double authentification, protection contre les mots de passe compromis désactivée. | **Corrigé le 21/10** : double authentification sur Supabase, Vercel et GitHub ; MFA exigée sur l'organisation Supabase ; protection contre les mots de passe compromis activée. |
| 6 | **Assumé** | Un **centre libre** (sans DP) peut être revendiqué par le premier utilisateur qui le choisit, sans preuve qu'il en est responsable. | Voir « La faille assumée » ci-dessous. |

## Ce qui est sain (revérifié le 22/10)

| Point | Résultat |
|---|---|
| Secrets dans le code | Aucun. `src/lib/supabase.ts` ne contient que l'adresse du projet et la clé **publique** `sb_publishable_…`, prévue pour le navigateur. |
| Secrets dans l'historique Git | Aucun sur 193 commits. La seule occurrence trouvée est un commentaire d'exemple (`sk_test_…`). |
| Fichiers `.env` versionnés | Aucun, ni aujourd'hui ni dans l'historique. |
| Clés secrètes | Anthropic, Resend et Stripe sont dans les **secrets Supabase**. La clé secrète du projet n'est utilisée que dans les Edge Functions, côté serveur. |
| RLS | **47 tables sur 47** avec la RLS activée, 74 politiques, **aucune politique ouverte aux anonymes**. |
| Tables sans politique | 10 tables ont la RLS active sans politique : elles sont **fermées à tous** et ne sont lues que par des fonctions serveur (choix voulu, par exemple les réglages de l'admin). |
| Fonctions `security definer` | Celles de l'admin vérifient `est_admin()`, celles du club vérifient `est_dp_centre()`. Les 7 accessibles sans compte servent les liens publics (invitation, inscription par QR code, site d'un club) et n'exposent qu'une donnée liée à un jeton ou déjà publique. |
| Stockage | `photos`, `passeports` et `evals` sont **privés** (liens signés et temporaires). Seul `sites-clubs` est public, car il contient les images des sites vitrines des clubs. |
| Accès anonyme | Les seules écritures possibles sans compte sont l'envoi d'un retour et le signalement d'une erreur de l'app. Aucune lecture. |
| Test réel | Un visiteur anonyme et un utilisateur inconnu ne lisent aucune ligne de `dives`, `profiles`, `media`, `centre_membres` ni des tables de l'admin. |

## La faille assumée

**Le risque.** Quand un centre n'a encore aucun directeur de plongée, le premier utilisateur qui le choisit en devient le DP. Quelqu'un pourrait donc revendiquer un club qui n'est pas le sien, avant le vrai responsable.

**Pourquoi elle est assumée pour le MVP :**
- Elle ne donne accès à **aucune donnée existante** : un centre libre n'a ni adhérents, ni sorties, ni certificats.
- Elle ne peut pas voler un centre déjà géré : c'est la faille n°1, corrigée.
- Une vérification sérieuse (Kbis ou numéro SIRET, contrôle par un administrateur) demande un circuit de validation humaine qui dépasse le MVP.

**Ce qui la limite déjà :** l'administrateur voit les comptes, et un centre revendiqué à tort peut être réattribué au vrai responsable par une correction directe en base. Il n'existe pas encore d'écran pour le faire.

**Correction prévue (V2) :** à la création ou à la revendication d'un centre, demander le SIRET et un justificatif. Le centre reste « en attente de vérification » jusqu'à la validation par l'administrateur.

## Points de vigilance pour la suite

- Tenir le script RLS de référence à jour à chaque nouvelle table ([`sql/palanote-rls-prd.sql`](../../sql/palanote-rls-prd.sql)).
- Relancer le Security Advisor de Supabase après chaque lot de scripts SQL.
- Au branchement du paiement (Stripe) : vérifier la signature du webhook (`STRIPE_WEBHOOK_SECRET`), déjà prévue dans la fonction `abonnement-club`.
