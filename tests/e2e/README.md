# Tests de bout en bout de Palanote (Playwright)

Ces tests rejouent les parcours clés comme un vrai utilisateur, sur téléphone (iPhone 13) et sur ordinateur.
L'app tourne en local et parle à un **faux Supabase en mémoire** (`support/supabase.ts`) :
aucune vraie donnée n'est lue ni écrite, aucun crédit IA n'est consommé.

## Ce qui est testé

| Fichier | Parcours |
|---|---|
| `specs/connexion.spec.ts` | Connexion, carnet avec ses plongées ; sans compte, la numérisation demande de se connecter |
| `specs/numerisation.spec.ts` | Agent de lecture : envoi d'une page, lecture, relecture des champs « à vérifier », rien n'entre au carnet avant la validation |
| `specs/especes.spec.ts` | Espèces : écran « Analyser mes photos », accord demandé une fois, image de référence, validation par le plongeur, retour à l'écran d'analyse |
| `specs/club.spec.ts` | Vitrine de l'espace club ; un centre déjà géré ne se rejoint pas ; un centre sans DP se rejoint |
| `specs/admin.spec.ts` | Page admin refusée à un non-admin ; banc d'essai de l'agent (ajout d'un cas, évaluation, score) |

## Lancer les tests

Dans un terminal, depuis ce dossier (`tests/e2e`) :

```
npm install
npx playwright install chromium
npx playwright test
```

La deuxième commande télécharge le navigateur de test (une seule fois).
Ensuite `npx playwright show-report rapport` ouvre le rapport, avec une capture d'écran de chaque étape.

Le serveur de l'app (port 5199) est démarré automatiquement par les tests.
