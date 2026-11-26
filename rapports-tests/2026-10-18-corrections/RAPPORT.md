# Validation des sept corrections

Date : 18 octobre 2026. Application : Gestion Facturation 1.4.3.

## Résultat

**116 contrôles réussis, aucun échec sur le passage final.**

| Périmètre | Réussites | Échecs |
| --- | ---: | ---: |
| Métier, SQLite, migrations, sauvegardes, sécurité et licence | 65 | 0 |
| Build React dans jsdom, formulaires et parcours de paiement | 33 | 0 |
| Générateurs PDF et contenu des documents | 18 | 0 |

La compilation de production du nouvel écran de factures a réussi. Les vérifications de syntaxe JavaScript et `git diff --check` passent également.

## Corrections livrées

1. **Migration des anciennes bases.** La reconstruction des tables de lignes conserve désormais les colonnes de section et de description. Les clés étrangères sont réactivées même en cas d'erreur. Les tests vérifient les deux tables, les lignes existantes et leurs données après redémarrage.

2. **Restauration des sauvegardes.** Le schéma commercial de base et l'intégrité SQLite sont contrôlés avant remplacement. Une copie de la source est créée via l'API SQLite, ce qui inclut les écritures WAL. Cette copie est migrée puis contrôlée sur l'ensemble des tables et colonnes attendues. La base active reste ouverte pendant la préparation ; le remplacement final est synchrone, avec retour à la base précédente si le déplacement échoue. La source n'est pas migrée ni modifiée. Les tests couvrent une sauvegarde actuelle, une ancienne sauvegarde complète, une base incomplète, des colonnes manquantes, des références invalides, le WAL et une interruption simulée du remplacement.

3. **Conversion unique d'une proforma.** La conversion vérifie le statut de la proforma, son lien de facture et les factures réellement existantes. Le contrôle et la création s'exécutent dans une transaction immédiate. Le parcours de création simultanée d'une facture et d'un bordereau possède la même protection. Deux demandes simultanées n'émettent qu'une facture ; une seconde conversion ne crée ni document partiel ni incrément de compteur.

4. **Paiements protégés par la TVA/OTR.** Le contrôle commun prend en compte la TVA déjà versée et les lots rattachés à la facture ou à ses situations. Il protège les annulations et les suppressions dès qu'un lot est en cours. L'annulation du lot libère ensuite les opérations autorisées. La date d'une situation déjà réglée ne peut pas non plus être modifiée lorsqu'elle est protégée par l'OTR.

5. **Suppression d'une facture liée à l'OTR.** Elle est refusée tant que des engagements OTR subsistent. Les bordereaux sont contrôlés dans les deux sens du rattachement. Une facture possédant des situations payées ne peut pas servir à contourner la protection par suppression en cascade.

6. **Statut après annulation d'une tranche.** Le statut de la facture principale est recalculé à partir des situations réellement payées. Annuler le solde de 5 % laisse donc une facture non intégralement payée. Le déclenchement de TVA et la date de la première tranche sont conservés lorsque cette tranche demeure réglée ; ils sont retirés si son paiement est annulé. Pour une facture soldée, la date retenue correspond au dernier règlement chronologique.

7. **Suppression contrôlée d'une tranche.** Une tranche payée exige d'abord une annulation explicite, confirmée dans l'interface et autorisée par les contrôles OTR. Après suppression, les montants des tranches restantes, leurs arrondis, la répartition de TVA et le statut parent sont recalculés. Une suppression qui modifierait les montants d'une autre tranche déjà payée est refusée et intégralement annulée ; il faut d'abord annuler les paiements concernés.

L'interface conserve l'accès aux situations d'une facture payée à 100 %, afin de permettre leur consultation et les annulations contrôlées. La liste principale et la fenêtre des situations sont actualisées après les opérations.

## Comparaison avec les anciens échecs

Les sept anomalies demandées sont corrigées. Le huitième point de l'ancien rapport concernait l'année de numérotation, exclue de cette demande : le code conserve l'année de création pour une facture antidatée. Le test de régression vérifie explicitement cette règle actuelle ; il ne prétend pas qu'une autre règle métier a été adoptée.

L'ancien scénario de restauration d'une base contenant uniquement `parametres` attendait que l'application soit utilisable après restauration. Le nouveau comportement attendu et testé est le **refus de cette base avant remplacement**, avec conservation des données actives. Une ancienne sauvegarde complète est testée séparément et restaurée avec migration.

## Fichiers et reproduction

Les corrections applicatives sont dans `main.js` et `src/pages/Factures.js`. Le script npm `test:regression` et les tests durables sont ajoutés dans `package.json` et `scripts/tests/`.

Depuis la racine :

```bash
npm run test:regression
BUILD_PATH=/tmp/gestion-facture-corrections-build npm run build
```

[Preuves des contrôles](preuves-tests.zip) : résultats JSON finaux, scripts temporaires utilisés pour l'interface et les PDF, PDF et textes extraits. Aucune base utilisateur ni clé privée n'est incluse.

Les modifications locales préexistantes de `scripts/seed-test-data.js`, `src/pages/Proformas.js`, `src/pages/Tva.js` et `src/utils/pdfGenerator.js` ont été préservées.

## Limites

Les tests métier utilisent le véritable module SQLite natif et les véritables gestionnaires, avec des dialogues simulés et des bases temporaires. L'interface est testée dans jsdom sur le nouveau build, avec de vraies écritures SQLite. Les confirmations, le refus d'une suppression payée, l'actualisation du statut parent et le blocage OTR sont exercés depuis l'interface.

Les tests PDF vérifient les générateurs réels et le contenu texte de 17 documents, plus le rejet d'un paiement absent. Le logo est lu directement depuis le PNG du projet.

Ce passage ne couvre pas une session graphique Electron complète, une installation Windows/Linux, une impression physique ou une activation avec une licence valide. L'avertissement canvas de jsdom et les avertissements de compilation sur Browserslist et `fs.F_OK` sont des limites ou avertissements non bloquants de l'environnement.
