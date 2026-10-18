# Deuxième passage de tests — Gestion Facturation 1.4.3

Date : 18 octobre 2026. Commit de référence : `dc64dac`. Les modifications locales existantes de `src/pages/Proformas.js`, `src/pages/Tva.js` et `src/utils/pdfGenerator.js` sont incluses dans ce passage et ont été préservées.

## Bilan

**84 scénarios exécutés : 76 réussites et 8 échecs.**

Les scripts temporaires du premier passage n'étaient plus disponibles. Ses 73 scénarios ont été reconstitués à partir de leur description et rejoués sur le code actuel. Ils retrouvent le bilan précédent : **65 réussites et 8 échecs**. Onze scénarios supplémentaires couvrent les modifications locales récentes ; ils réussissent tous.

| Périmètre | Scénarios | Réussites | Échecs |
| --- | ---: | ---: | ---: |
| Métier, SQLite, sauvegardes, migrations, mot de passe et licence | 39 | 31 | 8 |
| Interface : écrans, formulaires, saisies et nouveaux parcours | 27 | 27 | 0 |
| PDF : génération, contenu et rejet d'un paiement absent | 18 | 18 | 0 |
| Total | 84 | 76 | 8 |

Vérifications complémentaires :

- Nouvelle compilation de production : **réussie**, avec sortie sous `/tmp/gestion-facture-retest-build`.
- Syntaxe de `main.js`, `preload.js` et `license/license.js` : **valide**.
- Communication IPC : **76 appels exposés, 76 gestionnaires, aucun gestionnaire manquant**.
- Vérification du contenu texte des 17 PDF générés : **réussie**, y compris l'absence de la quittance non sélectionnée dans le PDF d'un paiement individuel.
- Inspection visuelle de quatre rendus : proforma, détail de versement OTR, détail de paiement OTR et dernière page du détail OTR long. Aucun défaut bloquant observé sur ces pages.

## Fonctions récentes vérifiées

Six nouveaux scénarios d'interface : ajout d'une ligne dans la première section d'une proforma ; ajout sans section avant les sections existantes ; sélection par défaut de la dernière section ; génération de l'impression du détail d'un versement ; génération de l'impression d'un paiement individuel ; message affiché si la fenêtre d'impression est bloquée.

Cinq nouveaux scénarios PDF : détail complet d'un versement ; détail limité à un paiement sélectionné ; versement sans facture ni paiement ; pagination d'un lot de 100 factures et 100 paiements sur 8 pages ; rejet d'un identifiant de paiement absent.

Les 13 PDF du premier passage ont également été régénérés : proforma, facture, situations 95 % et 5 %, bordereau, attestation, interventions simplifiée et V11, rapport technique, rapport de 15 pages, proforma de 9 pages, rapport TVA et rapport des versements.

## Échecs toujours reproductibles

Sept anomalies sont confirmées et une règle de numérotation reste à confirmer. Les assertions en échec expriment le comportement attendu ; aucune correction applicative n'a été effectuée pendant ce passage.

### 1. Une proforma peut être convertie deux fois

Source : `main.js:1344`.

Reproduction : invoquer deux fois `factures:createFromProforma` avec le même identifiant.

Résultat : deux factures sont créées au lieu d'un refus de la seconde conversion. Le lien de la proforma pointe ensuite vers la seconde facture. Reproduit par l'API IPC ; cela ne démontre pas qu'une conversion séquentielle est proposée dans l'interface.

### 2. Année du numéro d'une facture antidatée — règle à confirmer

Source : `main.js:1354`.

Reproduction : créer une facture avec date au 31/12/2025.

Résultat : date en 2025, numéro `2026/00001-ITS`. Le test attendait une année de numéro égale à celle du document. Le code utilise explicitement l'année courante ; la règle métier doit être confirmée avant correction.

### 3. Annuler le solde laisse la facture marquée payée

Source : `main.js:1635`.

Reproduction : créer puis payer les situations 95 % et 5 %, annuler le paiement de la situation de 5 %.

Résultat : `statut_paiement` de la facture reste `payee`, alors que seuls 95 % sont réglés.

### 4. Supprimer une situation payée ne recalcule pas le statut

Source : `main.js:1664`.

Reproduction : payer les situations 95 % et 5 %, puis supprimer la situation de 5 %.

Résultat : suppression acceptée, facture toujours payée. Le contrôle attendait soit un refus, soit un recalcul cohérent du statut.

### 5. Annulation de première situation après règlement de sa TVA

Source : `main.js:1635`.

Reproduction : payer la première situation, créer le lot OTR de la facture, solder le lot, puis annuler le paiement de la première situation.

Résultat : annulation acceptée alors que la TVA de la facture est déjà versée. La protection contrôle la situation, tandis que le parcours courant rattache le lot à la facture parente.

### 6. Suppression d'une facture présente dans un lot TVA

Source : `main.js:1466`.

Reproduction : payer une facture sans bordereau, l'ajouter à un lot OTR, puis supprimer la facture.

Résultat : suppression acceptée. Le rattachement au lot subsiste, ce qui peut rendre son total incohérent avec les factures affichées.

### 7. Migration d'une ancienne table bloquante

Source : `main.js:410` et `main.js:457`.

Reproduction : initialiser l'application sur une base avec une ancienne table `proforma_lignes` où `produit_id` est obligatoire.

Résultat : `table proforma_lignes has no column named section_titre`.

La migration ajoute `section_titre` et `description`, puis reconstruit une table sans ces colonnes avant de tenter de les recopier. Seul le cas `proforma_lignes` a été exécuté ; la reconstruction de `facture_lignes` suit la même structure.

### 8. Restauration d'une base incomplète acceptée

Source : `main.js:2418`.

Reproduction : sélectionner une base SQLite contenant seulement une table `parametres` valide.

Résultat : la restauration remplace la base, puis les statistiques échouent avec `no such table: clients`.

Le scénario simule une sauvegarde incomplète. Il ne prouve pas que toutes les anciennes sauvegardes échouent. La validation courante ne contrôle que `parametres` et ne relance pas l'initialisation après remplacement.

## Méthode et limites

Les véritables gestionnaires de `main.js` et le véritable `preload.js` sont exécutés avec les services de fenêtre et de dialogue Electron simulés. Les bases sont des SQLite temporaires indépendantes, avec le module natif installé et le moteur d'Electron 28.3.3 / Node 18.18.2. Aucun fichier de données réel n'est ouvert par le banc de tests.

L'interface utilise le nouveau build de production dans jsdom, avec la vraie API IPC et les vraies écritures SQLite. Les 11 écrans et 8 formulaires ont été vérifiés, puis deux formulaires ont été remplis et enregistrés. La licence est simulée pour ces tests d'interface. Le chargement des images et la fenêtre d'impression sont simulés pour permettre de contrôler la génération et le lien Blob ; aucune impression physique n'est lancée.

Les PDF proviennent des générateurs réels, avec le logo PNG du projet lu directement. Leurs contenus sont contrôlés avec `pdftotext`. Les rendus inspectés proviennent de `pdftoppm`.

Le module de licence est testé dans des dossiers temporaires avec une horloge contrôlée : essai, code invalide, expiration et recul d'horloge. Aucun code valide n'est généré et aucune clé privée n'est consultée.

La compilation émet des avertissements non bloquants sur `fs.F_OK` et les données Browserslist anciennes. jsdom émet un avertissement sur l'absence de `HTMLCanvasElement.getContext` ; il s'agit d'une limite du simulateur, pas d'un défaut démontré dans Electron.

Ce passage ne couvre pas une session graphique Electron complète, les installations Windows/Linux, une impression physique, une activation RSA valide, une validation fiscale, ni les imports Word et exports Excel de bout en bout.

## Preuves et reproduction

[Archive des scripts, résultats et PDF](preuves-tests.zip). L'archive ne contient aucune base de données de l'utilisateur ni clé de licence.

Pour rejouer depuis la racine du projet : extraire les scripts de l'archive dans `/tmp/gestion-facture-tests`, puis exécuter :

```bash
BUILD_PATH=/tmp/gestion-facture-retest-build npm run build
ELECTRON_RUN_AS_NODE=1 node_modules/electron/dist/electron /tmp/gestion-facture-tests/run.cjs
ELECTRON_RUN_AS_NODE=1 node_modules/electron/dist/electron /tmp/gestion-facture-tests/ui.cjs
ELECTRON_RUN_AS_NODE=1 node_modules/electron/dist/electron /tmp/gestion-facture-tests/pdf.cjs
python3 /tmp/gestion-facture-tests/verify-pdfs.py
```

Le script métier renvoie un code de sortie `1` lorsque ses scénarios trouvent une anomalie, tout en enregistrant tous les résultats dans `results.json`. Le rapport de ce passage inclut ces échecs attendus de détection ; ils ne doivent pas être interprétés comme des tests réussis.
