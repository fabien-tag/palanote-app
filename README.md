# Palanote

**Le carnet de plongée qui lit tes carnets papier.**

Palanote est une application web (pensée d'abord pour le téléphone) qui réunit, au même endroit, le carnet de plongée du plongeur et l'outil de travail du directeur de plongée (DP) d'un club.

- Le **plongeur** photographie les pages de ses anciens carnets papier : un agent IA les lit et propose les plongées, que le plongeur relit et valide. Il tient ensuite son carnet dans l'app, retrouve ses binômes, ses sites sur une carte et les espèces croisées.
- Le **directeur de plongée** organise ses sorties : inscriptions par QR code, palanquées, fiche de sécurité, tampon numérique des carnets, adhérents et certificats, matériel, site internet du club.

**Application en ligne :** https://palanote.fabientag.fr

Projet réalisé dans le cadre de la certification RNCP 41143 « Concepteur de solutions No-Code », bloc 2 (LION), par Fabien Tagliareni.

---

## Sommaire

1. [Fonctionnalités](#fonctionnalités)
2. [L'agent IA de lecture des carnets](#lagent-ia-de-lecture-des-carnets)
3. [Stack technique](#stack-technique)
4. [Architecture et organisation du dépôt](#architecture-et-organisation-du-dépôt)
5. [Base de données et sécurité](#base-de-données-et-sécurité)
6. [Installation et lancement en local](#installation-et-lancement-en-local)
7. [Fonctions serveur et secrets](#fonctions-serveur-et-secrets)
8. [Tests](#tests)
9. [Qualité : accessibilité, sécurité, QA](#qualité--accessibilité-sécurité-qa)
10. [Déploiement](#déploiement)
11. [Façon de travailler](#façon-de-travailler)

---

## Fonctionnalités

### Espace plongeur (téléphone)

| Fonction | Ce que ça fait |
|---|---|
| Carnet | Liste des plongées par année, filtres, statistiques (niveau, nombre de plongées, profondeur max, heures sous l'eau) |
| Saisie d'une plongée | Fiche complète (site sur carte, profondeurs, durée, paliers, gaz, matériel, binômes, photos) ou plongée express en 30 secondes |
| **Numériser ses carnets papier** | Photographier une ou plusieurs pages, l'agent IA les lit, puis relecture champ par champ avec la photo de la page sous les yeux |
| Espèces | Identification des espèces sur les photos de plongée (proposées par l'IA, validées par le plongeur), avec image de référence |
| Carte | Tous ses sites de plongée sur une carte du monde |
| Amis et binômes | QR code pour devenir binômes, plongées communes proposées au binôme |
| Moi | Profil, passeport (brevets, certificat médical), réglages, confidentialité, export UDDF |
| Hors ligne | Le carnet et la saisie fonctionnent sans réseau, la synchronisation se fait au retour |

### Espace club (ordinateur et téléphone)

| Fonction | Ce que ça fait |
|---|---|
| Tableau de bord du DP | Prochaine sortie, semaine, points d'attention (certificats, matériel), actions à faire |
| Sorties | Création, inscriptions par QR code, liste d'attente, palanquées, fiche de sécurité signée à l'écran |
| Tampon numérique | En fin de sortie, le DP tamponne les carnets de tous les plongeurs d'un geste |
| Membres | Import Excel des adhérents, certificats médicaux, membres privilégiés |
| Équipe, matériel, formations | Planning de l'équipe, inventaire et contrôles du matériel, formations et fiches de progression |
| Site du club | Mini site vitrine public généré à partir des données du club |
| Sécurité | Un centre déjà géré par un DP ne peut pas être rejoint par quelqu'un d'autre |

### Administration (ordinateur)

Tableau de bord réservé à l'administrateur : vue d'ensemble (connectés, actifs, plongées, pages lues), **suivi de l'agent IA en production et banc d'essai (eval set)**, retours des utilisateurs, erreurs de l'app, utilisateurs, finances, lettre annuelle.

---

## L'agent IA de lecture des carnets

La brique principale du projet. Code : [`supabase/functions/lire-page`](supabase/functions/lire-page/index.ts).

- **Archétype :** extraction structurée. Entrée : la photo d'une page. Sortie : les plongées de la page, 15 champs chacune, avec pour chaque champ la valeur, le texte brut lu et une confiance (`sur`, `a_verifier`, `non_lu`).
- **Boucle d'agent bornée (4 étapes au plus) :** l'agent lit la page, décide lui-même de vérifier ses doutes avec deux outils (`zoomer` sur une zone de la photo, `voir_page_voisine` pour comparer avec les pages déjà lues du carnet), puis enregistre.
- **Modèle :** Claude Sonnet (Anthropic), appelé depuis une Edge Function Supabase. La clé API reste côté serveur, dans les secrets Supabase.
- **Le plongeur valide toujours :** rien n'entre dans le carnet sans sa relecture. Les champs douteux sont mis en évidence.
- **Échecs prévus :** page illisible ou hors sujet → aucune plongée inventée, avec la raison ; zoom impossible → l'agent continue sans ; pas de conclusion → rappel, puis enregistrement forcé à la dernière étape.
- **Évaluation :** un eval set de 12 pages réelles (8 nominales, 2 en bordure, 2 hostiles) se rejoue depuis l'admin, en lecture directe et avec l'agent. Résultat actuel : **11 cas réussis sur 12, 0 plongée inventée**. Chaque changement de consigne, d'outil ou de modèle se valide sur cet eval set avant d'être livré.
- **Suivi en production :** pages lues, vérifications faites, jetons, coût et taux de correction humaine, dans Admin › Agent IA.

---

## Stack technique

| Couche | Outil | Rôle |
|---|---|---|
| Génération et itération | **Lovable** | Construction de l'interface par vibe coding, synchronisée avec ce dépôt |
| Front | React 19, TypeScript, **TanStack Start / Router**, Vite | Application, routes par fichiers (`src/routes`), rendu côté serveur |
| Style | **Tailwind CSS v4**, composants Radix UI / shadcn, Lucide | Design system Palanote (palette marine, menthe, corail ; formes organiques) |
| Données | **Supabase** (PostgreSQL, Auth, Storage, Edge Functions, Realtime) | Base de données, connexion (e-mail et Google), photos, fonctions serveur |
| IA | **Anthropic Claude** (API Messages, outils) | Lecture des carnets, identification des espèces |
| Carte | Leaflet | Carte des sites |
| E-mails | Resend | Lettre annuelle |
| Hébergement | **Vercel** | Production sur https://palanote.fabientag.fr (HTTPS automatique) |
| Tests | **Playwright** | Tests de parcours, lancés à chaque push par GitHub Actions |

---

## Architecture et organisation du dépôt

```
src/
  routes/          Une route par fichier (TanStack Router)
                   _dp.club*.tsx  → espace club (préfixe /club)
                   admin.tsx      → tableau de bord d'administration
  components/      Composants par domaine (club, admin, numerisation, especes, moi, site…)
  lib/             Accès aux données Supabase et logique métier (un fichier par domaine)
  assets/          Images et illustrations
supabase/
  functions/       Edge Functions : lire-page (agent IA), identifier-especes,
                   envoyer-lettre, abonnement-club
sql/               Un script SQL autonome et relançable par fonctionnalité,
                   palanote-schema-complet.sql (référence), palanote-schema.dbml (schéma)
tests/e2e/         Tests Playwright (paquet isolé, Supabase simulé)
docs/              Mise en ligne, rapports d'accessibilité (docs/accessibilite)
.github/workflows/ Tests Playwright à chaque push
```

Le client Supabase est créé dans [`src/lib/supabase.ts`](src/lib/supabase.ts) avec la **clé publique** (`sb_publishable_…`), faite pour être dans le navigateur : toutes les données sont protégées par la RLS côté base.

---

## Base de données et sécurité

- **Schéma :** [`sql/palanote-schema.dbml`](sql/palanote-schema.dbml), à ouvrir dans [dbdiagram.io](https://dbdiagram.io). Tables principales : `profiles`, `dives`, `media`, `dive_species`, `ocr_batches` / `ocr_pages` / `ocr_extractions` (numérisation), `centres` / `centre_membres` / `sorties` / `sortie_participants` (club), plus les tables du suivi et de l'eval set.
- **Scripts :** chaque fonctionnalité a son script SQL autonome et relançable dans `sql/`. [`sql/palanote-schema-complet.sql`](sql/palanote-schema-complet.sql) recrée toute la base.
- **RLS activée sur toutes les tables.** Un plongeur ne voit que ses données ; un DP ne voit que les adhérents de son centre ; l'admin passe par des fonctions `security definer` qui vérifient `est_admin()`. Les règles du PRD et les politiques correspondantes sont détaillées dans [`sql/palanote-rls-prd.sql`](sql/palanote-rls-prd.sql).
- **Secrets :** aucune clé secrète dans le code ni dans l'historique Git. Les clés (Anthropic, Resend, Stripe) sont dans les secrets Supabase ; `.env` est ignoré par Git.
- **Comptes :** Supabase Auth (e-mail et mot de passe, Google), protection contre les mots de passe compromis, double authentification activée sur Supabase, Vercel et GitHub.
- **RGPD :** consentement aux conditions versionné, politique de confidentialité, export et suppression du compte depuis Moi › Confidentialité.

---

## Installation et lancement en local

Prérequis : Node.js 22 et npm (ou Bun).

```sh
git clone https://github.com/fabien-tag/palanote-b745c068.git
cd palanote-b745c068
npm install
npm run dev
```

L'app s'ouvre sur http://localhost:5173 et se connecte au projet Supabase Palanote (adresse et clé publique dans `src/lib/supabase.ts`).

Pour repartir d'une base Supabase vide : créer un projet, lancer `sql/palanote-schema-complet.sql` dans le SQL Editor, remplacer l'adresse et la clé publique dans `src/lib/supabase.ts`, puis déployer les Edge Functions (voir ci-dessous).

| Commande | Rôle |
|---|---|
| `npm run dev` | Serveur de développement |
| `npm run build` | Build de production |
| `npm run preview` | Prévisualiser le build |
| `npm run lint` | ESLint |
| `npm run format` | Prettier |

---

## Fonctions serveur et secrets

| Edge Function | Rôle | Secrets utilisés |
|---|---|---|
| `lire-page` | Agent de lecture des carnets, banc d'essai | `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` (facultatif), `AGENT_ETAPES_MAX` (facultatif) |
| `identifier-especes` | Espèces proposées à partir des photos | `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL_ESPECES` (facultatif) |
| `envoyer-lettre` | Lettre annuelle aux plongeurs | `RESEND_API_KEY`, `LETTRE_EXPEDITEUR`, `APP_URL` |
| `abonnement-club` | Offres club (paiement pas encore branché) | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `PRIX_ADVANCED`, `PRIX_PREMIUM` |

Les secrets se règlent dans Supabase › Edge Functions › Secrets. `SUPABASE_URL` et la clé secrète du projet sont fournies automatiquement aux fonctions.

---

## Tests

Tests de parcours Playwright dans [`tests/e2e`](tests/e2e) (paquet isolé, Supabase simulé : aucune donnée réelle n'est touchée).

```sh
cd tests/e2e
npm ci
npx playwright install chromium
npx playwright test
```

Ils couvrent la connexion, la numérisation d'une page par l'agent jusqu'à la relecture, l'analyse des espèces, l'espace club (vitrine, centre déjà géré) et l'admin (droits, banc d'essai). Ils tournent sur téléphone (iPhone 13) et sur ordinateur, et sont relancés automatiquement à chaque push par GitHub Actions ([`.github/workflows/tests-e2e.yml`](.github/workflows/tests-e2e.yml)).

---

## Qualité : accessibilité, sécurité, QA

- **Accessibilité (WCAG 2.2 AA) :** audit axe-core sur 49 écrans et vérifications manuelles (clavier, focus, reflow à 320 px, animations). 895 éléments en erreur avant corrections, 18 après (17 faux positifs). Rapports et planches avant / après : [`docs/accessibilite`](docs/accessibilite).
- **Sécurité :** audit du dépôt (secrets, `.env`, clés publique et secrète, RLS de chaque table) : voir [`docs/securite`](docs/securite).
- **Mise en ligne :** check-list dans [`docs/mise-en-ligne.md`](docs/mise-en-ligne.md).

---

## Déploiement

- **Production :** Vercel, à chaque push sur `main`, sur https://palanote.fabientag.fr (sous-domaine du domaine personnel de l'auteur, HTTPS géré par Vercel). Réglage du build : variable `NITRO_PRESET=vercel`.
- **Base et fonctions :** projet Supabase Palanote. Les scripts SQL se lancent dans le SQL Editor ; les Edge Functions se déploient depuis `supabase/functions`.
- **Lovable :** le dépôt est synchronisé avec l'éditeur Lovable, qui pousse sur `main`.

---

## Façon de travailler

- Le travail se fait par **lots** sur une branche de travail, puis part sur `main` en un seul commit après validation (voir [`AGENTS.md`](AGENTS.md)).
- Chaque nouvelle fonctionnalité arrive avec **son script SQL** autonome et relançable.
- Chaque changement de l'agent IA se **valide sur l'eval set** avant d'être livré, puis s'observe en production.
- Principe produit : **l'IA propose, le plongeur valide.**
