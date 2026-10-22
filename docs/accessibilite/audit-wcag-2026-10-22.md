# Audit d'accessibilité WCAG 2.2 — Palanote

**Date :** 22 octobre 2026
**Auditeur :** Fabien Tagliareni, avec Claude (agent IA)
**Référentiel :** WCAG 2.2, niveaux A et AA. Le RGAA 4.1 s'appuie sur les mêmes critères.
**Version testée :** branche `main` au commit `509ffc5`, lancée en local avec des données de démonstration.

## En bref

Palanote **n'est pas encore conforme au niveau AA**, pour une seule raison de fond : le contraste du texte secondaire. Les gris clairs utilisés pour les dates, les unités, les légendes et les compteurs sont trop pâles. Ce seul critère (1.4.3) représente **891 des 895 erreurs** relevées par l'outil automatique, sur 40 des 49 écrans.

Le reste tient bien :

- tout se fait au clavier, avec un focus toujours visible ;
- l'app reste lisible à 320 px de large ;
- le mode « réduire les animations » est respecté ;
- les images ont un texte alternatif et les boutons-icônes ont un nom ;
- la langue est déclarée et chaque page a un titre ;
- les messages d'erreur sont annoncés aux lecteurs d'écran.

La correction du contraste est mécanique : remplacer quelques gris par le gris secondaire déjà présent dans la charte (`#5B7189`). Elle prend environ une heure, vérification visuelle comprise. Une fois faite, il reste 4 anomalies moyennes, rapides à corriger, et quelques finitions.

| Gravité | Nombre de problèmes | Critères WCAG |
|---|---:|---|
| Majeur | 1 | 1.4.3 Contraste du texte secondaire (gris trop pâles) |
| Moyen | 4 | 1.4.3 / 1.4.11 Corail sur fond clair · 1.4.11 Bordures des champs · 4.1.2 / 1.3.1 Champs sans étiquette · 2.4.1 Contourner les blocs |
| Mineur | 5 | 2.5.8 Taille des cibles · 1.3.1 Titres de niveau 1 · 2.4.2 Titres de page · 3.3.1 Erreurs liées au champ · 2.2.2 Bulles animées |

## Méthode

1. **Passage automatique avec axe-core 4.10.2** (Deque), lancé par Playwright dans Chromium sur **49 écrans** :
   - 8 écrans publics et 18 écrans plongeur, au format téléphone (390 × 844) ;
   - 16 écrans de l'espace club et les 7 onglets de l'admin, au format ordinateur (1440 × 900).

   Les règles appliquées sont celles marquées WCAG 2.0, 2.1 et 2.2, niveaux A et AA. Chaque page est parcourue jusqu'en bas avant l'analyse, pour que tout son contenu soit chargé.
2. **Vérifications manuelles outillées :**
   - **Clavier :** parcours à la touche Tab sur l'accueil, la connexion, le carnet, la saisie d'une plongée et le tableau de bord du club, avec un indicateur de focus mesuré à chaque arrêt ;
   - **Reflow :** affichage de 14 écrans à 320 px de large, en cherchant un défilement horizontal ;
   - **Animations :** pages ouvertes avec « réduire les animations » activé ;
   - **Messages d'erreur :** affichés à l'écran, puis repassés à axe ;
   - **Code source :** lecture pour la langue, le zoom, les messages annoncés et les animations.
3. **Calcul des contrastes** avec la formule WCAG pour chaque couleur fautive, et proposition d'une couleur de remplacement qui atteint 4,5:1.

**Limites :**

- Un outil automatique détecte environ un tiers des problèmes d'accessibilité.
- Il manque un vrai test avec un lecteur d'écran (VoiceOver sur iPhone, NVDA sur PC), à faire à la main : 10 minutes sur le parcours « numériser une page », par exemple.
- Les écrans ont été testés avec des données de démonstration. Un compte très rempli peut faire apparaître d'autres cas.
- Quelques résultats d'axe sont des faux positifs : du texte blanc posé sur une photo, dans l'en-tête du site d'un club. Ils sont signalés plus bas.

## Problèmes relevés

### 1. Majeur : texte secondaire trop pâle (1.4.3 Contraste minimum, AA)

**Constat.** 891 éléments sur 40 écrans. Les dates, les unités (« m », « min »), les légendes, les compteurs, les en-têtes de tableau et les mentions « facultatif » utilisent des gris trop clairs pour un texte de petite taille (10,5 à 14,5 px). Il faut **4,5:1** pour un texte de cette taille.

| Gris utilisé | Contraste sur blanc | Sur fond `#F1F6FC` | Exemples |
|---|---:|---:|---|
| `#9DB0C0` | 2,2:1 | 2,1:1 | numéro et date des plongées dans le carnet, unités (« min », « /5 »), coordonnées GPS |
| `#9AAAB9` | 2,4:1 | 2,2:1 | « Aucun palier » dans la saisie d'une plongée |
| `#7D93A8` | 3,2:1 | 2,9:1 | titres de rubrique de Mon profil, Réglages et Confidentialité (« Unités », « Qui voit quoi ») |
| `#7990A7` | 3,3:1 | 3,0:1 | libellés des chiffres de l'admin (« Actifs sur 7 jours ») |
| `#63809A` | 4,1:1 | 3,8:1 | onglets inactifs de la barre du bas (Carte, Amis, Moi) et liens du menu de l'espace club |

Dans le code, `#9DB0C0` revient 251 fois et `#7D93A8` 172 fois.

**Pourquoi c'est important.** Une personne malvoyante, ou n'importe qui sur le bateau en plein soleil, ne lit pas ces informations. Or elles comptent : la date d'une plongée, l'unité d'une profondeur.

**Correction proposée.** Pour tout texte secondaire, utiliser **`#5B7189`**, le gris secondaire déjà employé 418 fois dans l'app (5,0:1 sur blanc, 4,6:1 sur `#F1F6FC`). Sur les cartes bleu très clair (`#E3F4FC`), prendre `#566C83` (4,8:1). La hiérarchie visuelle passe alors par la taille et la graisse plutôt que par la pâleur. Les gris clairs restent permis pour les éléments purement décoratifs, comme les séparateurs.

### 2. Moyen : corail sur fond clair (1.4.3 et 1.4.11)

**Constat.** Le corail de la charte (`#FF8A75`) n'a que **2,3:1** sur blanc. Il est utilisé deux fois sur fond clair :

- **Plongée express :** le compteur de photos (« 2 photos »), en texte de 12,5 px. Il faut 4,5:1 (critère 1.4.3).
- **Saisie d'une plongée :** le bouton « Ajouter une photo », dont l'icône et la bordure pointillée sont en corail. Il faut 3:1 pour un composant (critère 1.4.11).

Les messages d'erreur, eux aussi en corail, s'affichent tous sur fond bleu nuit : connexion, création de compte, nouveau mot de passe, profil plongeur. Ils y restent lisibles, et axe ne relève rien sur ces écrans, erreurs affichées.

**Correction proposée.** Garder `#FF8A75` pour les illustrations et sur fond sombre. Sur fond clair, prendre un corail foncé, **`#C2412D`** (5,1:1 sur blanc).

### 3. Moyen : bordures des champs presque invisibles (1.4.11 Contraste du contenu non textuel, AA)

**Constat.** Les champs de saisie ont une bordure `#E4EBF1` (1,2:1 sur blanc). Posés sur le fond de page `#F1F6FC`, le blanc du champ ne ressort qu'à 1,09:1. Pour une personne malvoyante, la zone où taper ne se distingue pas. Il faut 3:1 pour repérer un composant.

**Correction proposée.** Une bordure **`#7B8FA3`** au repos (3,3:1 sur blanc, 3,1:1 sur `#F1F6FC`), en gardant le contour turquoise au focus. Variante plus douce : garder la bordure claire et placer le libellé juste au-dessus, collé au champ, ce que l'app fait déjà presque partout.

### 4. Moyen : deux champs sans étiquette (4.1.2 Nom, rôle, valeur, et 1.3.1)

**Constat.** Dans Espace club › Paramètres › Mon profil, la **date de fin du certificat médical** et le **club d'origine** sont affichés sous un titre (« Certificat médical », « Club d'origine »), mais ce titre n'est pas relié au champ. Un lecteur d'écran annonce « champ de date » sans dire lequel.

**Correction proposée.** Envelopper chaque champ dans le composant `Libelle` déjà utilisé pour Prénom et Nom, ou ajouter `aria-label="Fin du certificat médical"` et `aria-label="Club d'origine"`.

### 5. Moyen : pas de lien d'évitement (2.4.1 Contourner des blocs, A)

**Constat.**

- Aucun des 49 écrans n'a de lien « Aller au contenu », ni de zone `<main>`.
- Dans l'espace club, il faut **13 appuis sur Tab** pour traverser le menu de gauche avant d'atteindre le contenu.

Le critère est techniquement rempli, car chaque page a un titre de niveau 1 qui permet de sauter au contenu avec un lecteur d'écran. Mais c'est le minimum.

**Correction proposée.** Un lien « Aller au contenu », visible seulement au focus, en tête de la mise en page de l'espace club et de l'admin. Ajouter aussi `<main id="contenu">` autour du contenu de chaque écran. Cela demande deux composants et quelques lignes.

### 6. Mineur : petites cibles (2.5.8 Taille minimale des cibles, AA, nouveau en WCAG 2.2)

- **Espace club › Équipe :** les pastilles de sortie dans le planning de l'équipe font 20 px de haut, sous le minimum de 24 px.
- **Nouvelle sortie :** le champ des prénoms d'une palanquée fait 30 px de haut et est en partie recouvert par la barre du bas quand la page défile.

**Correction :** une hauteur minimale de 24 px pour les pastilles, et une marge en bas du formulaire pour la barre.

### 7. Mineur : structure des titres (1.3.1)

- **« Ma plongée » et « Relecture d'une page » :** pas de titre de niveau 1. Le titre de l'écran est dans la barre du haut, mais en texte simple.
- **« Mon site internet » (espace club) :** deux titres de niveau 1, parce que l'aperçu du site du club est intégré à la page. On peut l'accepter, mais l'aperçu pourrait commencer au niveau 2.

### 8. Mineur : titres de page (2.4.2)

Chaque écran a un titre propre (« Palanote — Carnet », etc.), ce qui est bien. Deux exceptions :

- les 7 onglets de l'admin partagent « Palanote — Tableau de bord » ;
- la plongée express s'appelle « Nouvelle plongée ».

### 9. Mineur : erreurs reliées au champ (3.3.1 Identification des erreurs)

Les erreurs sont écrites en clair et annoncées (`role="alert"`). C'est bien, et rare. Il manque le lien technique avec le champ concerné : `aria-invalid="true"` et `aria-describedby` pointant vers le message. Avec ce lien, un lecteur d'écran relit l'erreur quand on revient sur le champ.

### 10. Mineur : bulles animées en continu (2.2.2 Mettre en pause, arrêter, masquer, A)

Les bulles décoratives de l'accueil, de la vitrine de l'espace club et du site d'un club bougent sans fin. Elles s'arrêtent bien quand l'utilisateur a demandé à réduire les animations : le test avec ce réglage n'a trouvé aucune animation active. Sans ce réglage, il n'existe aucun moyen de les arrêter. Comme elles sont décoratives et discrètes, le risque est faible.

## Ce qui est conforme

| Critère | Résultat |
|---|---|
| 1.1.1 Texte alternatif | Toutes les images ont un texte alternatif ou sont marquées décoratives (règle `image-alt` sans erreur). |
| 1.3.4 Orientation · 1.4.4 Agrandissement · 1.4.10 Reflow | Le zoom n'est pas bloqué (`width=device-width, initial-scale=1`). À 320 px de large, 13 écrans sur 14 n'ont aucun défilement horizontal. La liste des membres du club déborde de 11 px : c'est un tableau, une exception prévue par le critère. |
| 2.1.1 Clavier · 2.1.2 Pas de piège | Chaque élément du parcours testé s'atteint au clavier, et le focus revient en début de page après le dernier élément, sans blocage. |
| 2.3.3 Animations · préférence système | Avec « réduire les animations », aucune animation en boucle ne reste active (accueil, connexion, site d'un club). |
| 2.4.2 Titre de page | 49 écrans sur 49 ont un titre, presque tous distincts (voir point 8). |
| 2.4.3 Ordre du focus | L'ordre de tabulation suit l'ordre visuel : menu, recherche, notifications, puis contenu. |
| 2.4.7 Focus visible | Sur 103 appuis sur Tab, répartis sur 5 écrans, chaque arrêt sur un élément de l'app montre un indicateur de focus. Les seuls arrêts sans indicateur sont les sous-champs natifs du sélecteur de date et d'heure, dessinés par le navigateur. |
| 3.1.1 Langue de la page | `lang="fr"` partout. |
| 3.3.1 / 4.1.3 Messages | Les erreurs de connexion et d'inscription sont annoncées (`role="alert"`, 17 zones `aria-live`, `role="status"` ou `role="alert"` dans l'app). |
| 3.3.2 Étiquettes | Tous les champs ont une étiquette, sauf les deux du point 4. |
| 4.1.2 Nom, rôle, valeur | Tous les boutons-icônes ont un nom accessible (règle `button-name` sans erreur). |

**Faux positifs écartés :** 4 éléments de l'en-tête du site d'un club (note Google, téléphone, accroche). Il s'agit de texte blanc posé sur une photo sombre, avec un voile. axe calcule le contraste sur la couleur de secours du fond (`#F5F9FB`), pas sur la photo. À l'écran, ils sont lisibles.

## Plan de correction proposé

| Ordre | Correction | Effort | Gain |
|---:|---|---|---|
| 1 | Remplacer `#9DB0C0`, `#9AAAB9`, `#7D93A8`, `#7990A7` et `#63809A` par `#5B7189` dans le texte, et utiliser `#566C83` sur fond `#E3F4FC` | 1 h | supprime la quasi-totalité des 891 erreurs de contraste |
| 2 | Corail foncé `#C2412D` sur fond clair (compteur de photos, bouton « Ajouter une photo ») | 10 min | point 2 |
| 3 | Étiqueter les deux champs des Paramètres | 5 min | point 4 |
| 4 | Lien « Aller au contenu » et `<main>` | 30 min | point 5 |
| 5 | Bordure des champs `#7B8FA3` | 20 min | point 3 |
| 6 | Points mineurs 6 à 10 | 1 h | finitions |

Les corrections 1 à 4 entrent dans le cadre « corrections de bugs » de la formation : elles ne changent aucune fonctionnalité. Une fois faites, il suffit de relancer le passage axe-core pour vérifier qu'il ne trouve plus rien. Le même contrôle pourrait ensuite rejoindre la suite Playwright, pour qu'aucun gris trop clair ne revienne.

## Détail par écran (passage automatique)

Nombre d'éléments en erreur relevés par axe-core sur chaque écran.

| Espace | Écran | Contraste (1.4.3) | Autres | Total |
|---|---|---:|---|---:|
| Plongeur (mobile 390 px) | Carnet | 21 | — | 21 |
| Plongeur (mobile 390 px) | Fiche plongée | 15 | — | 15 |
| Plongeur (mobile 390 px) | Plongée express | 9 | — | 9 |
| Plongeur (mobile 390 px) | Carte | 3 | — | 3 |
| Plongeur (mobile 390 px) | Numériser | 0 | — | 0 |
| Plongeur (mobile 390 px) | Relecture | 0 | — | 0 |
| Plongeur (mobile 390 px) | Forfait | 2 | — | 2 |
| Plongeur (mobile 390 px) | Espèces | 1 | — | 1 |
| Plongeur (mobile 390 px) | Analyser mes photos | 6 | — | 6 |
| Plongeur (mobile 390 px) | Espèces détectées | 5 | — | 5 |
| Plongeur (mobile 390 px) | Amis | 3 | — | 3 |
| Plongeur (mobile 390 px) | Ajouter un binôme | 0 | — | 0 |
| Plongeur (mobile 390 px) | Moi | 13 | — | 13 |
| Plongeur (mobile 390 px) | Profil | 7 | — | 7 |
| Plongeur (mobile 390 px) | Réglages | 12 | — | 12 |
| Plongeur (mobile 390 px) | Confidentialité (Moi) | 5 | — | 5 |
| Plongeur (mobile 390 px) | Notifications | 0 | — | 0 |
| Plongeur (mobile 390 px) | Récif | 1 | — | 1 |
| Public | Accueil | 0 | — | 0 |
| Public | Connexion | 0 | — | 0 |
| Public | Créer un compte | 0 | — | 0 |
| Public | Mot de passe oublié | 0 | — | 0 |
| Public | Mentions légales | 1 | — | 1 |
| Public | Confidentialité | 1 | — | 1 |
| Public | CGU | 1 | — | 1 |
| Public | Site d'un club | 28 | — | 28 |
| Espace club (ordinateur 1440 px) | Tableau de bord | 69 | — | 69 |
| Espace club (ordinateur 1440 px) | Planning | 33 | — | 33 |
| Espace club (ordinateur 1440 px) | Sortie / palanquées | 78 | — | 78 |
| Espace club (ordinateur 1440 px) | Fiche de sécurité | 26 | — | 26 |
| Espace club (ordinateur 1440 px) | Nouvelle sortie | 23 | target-size (1) | 24 |
| Espace club (ordinateur 1440 px) | Membres | 129 | — | 129 |
| Espace club (ordinateur 1440 px) | Équipe | 32 | target-size (2) | 34 |
| Espace club (ordinateur 1440 px) | Matériel | 19 | — | 19 |
| Espace club (ordinateur 1440 px) | Formations | 29 | — | 29 |
| Espace club (ordinateur 1440 px) | Privilégiés | 61 | — | 61 |
| Espace club (ordinateur 1440 px) | Carte du club | 18 | — | 18 |
| Espace club (ordinateur 1440 px) | Site internet | 50 | — | 50 |
| Espace club (ordinateur 1440 px) | Offre | 33 | — | 33 |
| Espace club (ordinateur 1440 px) | Paramètres | 36 | label (1) | 37 |
| Espace club (ordinateur 1440 px) | Notifications club | 46 | — | 46 |
| Admin (ordinateur) | Vue d'ensemble | 13 | — | 13 |
| Admin (ordinateur) | Agent IA | 9 | — | 9 |
| Admin (ordinateur) | Retours | 2 | — | 2 |
| Admin (ordinateur) | Erreurs | 7 | — | 7 |
| Admin (ordinateur) | Utilisateurs | 7 | — | 7 |
| Admin (ordinateur) | Finances | 29 | — | 29 |
| Admin (ordinateur) | Lettre annuelle | 8 | — | 8 |
| Espace club (ordinateur 1440 px) | Vitrine (sans centre) | 0 | — | 0 |

*Résultats bruts : `docs/accessibilite/resultats-axe-2026-10-22.json` (axe-core 4.10.2, 49 écrans).*


> Second audit, après corrections : [audit-wcag-apres-corrections-2026-10-22.md](audit-wcag-apres-corrections-2026-10-22.md) — 895 éléments en erreur avant, 18 après (17 faux positifs).
