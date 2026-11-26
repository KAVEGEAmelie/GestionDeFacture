# Tests de régression

Depuis la racine du projet, avec les dépendances installées :

```bash
npm run test:regression
```

Le script utilise le moteur Node d'Electron pour charger le module natif `better-sqlite3` du projet. Il exécute les véritables gestionnaires IPC de `main.js` et le véritable `preload.js`, en simulant les fenêtres et les dialogues.

Chaque scénario possède une base temporaire indépendante. Le dossier de données de l'application et les fichiers de licence réels ne sont pas utilisés. Les scénarios de licence utilisent aussi un dossier personnel simulé et une horloge contrôlée.

Les 65 scénarios couvrent les parcours courants et les sept corrections d'intégrité : migrations avec conservation des lignes, restauration après validation et migration sur copie, reprise après interruption, journal WAL, conversion unique, protections OTR, statuts et montants après annulation ou suppression de situations.

Le chemin du rapport JSON est affiché à la fin. Le code de sortie est `0` si tous les scénarios passent, `1` si une assertion échoue, `2` en cas d'erreur du banc de tests.

La règle actuelle de numérotation selon l'année de création est conservée et vérifiée explicitement. Le scénario de sauvegarde incomplète attend désormais son refus avant remplacement, ainsi que la conservation des données actives.

Les contrôles du build React dans jsdom et des générateurs PDF sont documentés et archivés dans `rapports-tests/2026-10-18-corrections/`. Ils ne remplacent pas une session graphique Electron ou une impression physique.
