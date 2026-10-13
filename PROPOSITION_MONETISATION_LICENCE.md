# Licence commerciale : conditions retenues

Ce document décrit le modèle commercial choisi. **Il ne modifie pas et n'active pas le système de licence de l'application.**

**Gestion Facturation** est un logiciel de facturation générique. In-Tel Services est l'entreprise qui le commercialise et l'installation actuelle est personnalisée pour In-Tel Services. Chaque client peut configurer dans les paramètres l'identité affichée sur ses documents (nom de l'entreprise, logo, coordonnées et autres renseignements disponibles); le logiciel n'est pas réservé à In-Tel Services.

## Conditions commerciales

- Essai gratuit : **15 jours**, à partir du premier lancement sur l'ordinateur.
- Prix : **150 000 FCFA, paiement unique** pour activer l'application.
- Après activation, la licence de Gestion Facturation reste valable sans limite de durée sur l'ordinateur activé; il n'y a ni abonnement mensuel ni renouvellement annuel.
- Les nouvelles versions, modifications, installations ou demandes d'assistance sont facturées séparément par In-Tel Services, selon le travail demandé. Elles ne sont pas comprises dans les 150 000 FCFA.
- L'application stocke ses données localement : activer une licence sur un autre ordinateur ne synchronise ni ne déplace les factures.

## Parcours client

1. Le client installe l'application et dispose de 15 jours d'essai à compter du premier lancement.
2. Pour acheter, il communique à In-Tel Services l'identifiant affiché par l'application et règle les 150 000 FCFA par le moyen de paiement convenu.
3. In-Tel Services vérifie le paiement et génère manuellement un code d'activation propre à cet identifiant.
4. Le client saisit ce code dans l'application. Après validation, l'application reste activée sur cet ordinateur sans date d'expiration.
5. Les demandes de modification ou de mise à jour sont discutées et facturées séparément, sans prélèvement automatique.

## Identifiant et codes

Ne pas lier le code à l'adresse IP : elle peut changer, être partagée ou dépendre du réseau utilisé. L'application actuelle calcule plutôt un identifiant à partir d'informations locales de l'ordinateur (notamment l'identifiant Windows et le numéro de série BIOS, quand ils sont disponibles), puis affiche une empreinte abrégée.

Le code RSA actuel est vérifié avec une clé publique intégrée à l'application; la clé privée reste chez le vendeur. Un code copié sur un autre ordinateur ne devrait donc pas fonctionner. En revanche, sans serveur, il n'est pas possible de révoquer immédiatement une licence déjà émise ni de connaître automatiquement tous les appareils activés.

Un changement d'ordinateur ou de carte mère peut modifier l'identifiant. Le client doit prévenir In-Tel Services et communiquer le nouvel identifiant; le vendeur vérifie l'achat puis génère manuellement un nouveau code. Les modalités éventuelles de frais de transfert restent à fixer. Sans serveur, l'ancien code hors ligne ne peut pas être désactivé à distance.

## Durée de la licence

Le modèle choisi est une activation permanente après paiement unique. Le générateur actuel signe l'identifiant de l'ordinateur sans date d'expiration, ce qui correspond à cette règle. Il faudra cependant associer le code à un numéro de licence et garder un registre vendeur des achats et des transferts.

Les 15 jours concernent uniquement l'essai avant achat; ils ne limitent pas la licence une fois activée. La date d'essai doit rester protégée contre une réinstallation ou un recul de l'horloge.

## Ce qui existe aujourd'hui

- `license/license.js` calcule déjà un identifiant machine et vérifie les codes RSA liés à cet identifiant.
- Le suivi d'essai actuel est configuré à **18 jours**, pas 15.
- `TRIAL_ENFORCEMENT` est à `false` : l'expiration est suivie, mais le blocage effectif est désactivé.
- `scripts/generate-license.js` génère des codes permanents liés à un identifiant machine, utilisables sans connexion Internet.
- Les paiements se font donc entièrement hors de l'application; aucune passerelle de paiement ni aucun serveur de licences n'est configuré.
- L'application stocke ses données dans une base locale par ordinateur. Une activation sur un autre ordinateur ne synchronise pas les factures entre les appareils.

## Sécurité et précautions

- Ne jamais transmettre ni committer `license-keys/license-private.pem`. Le dossier est exclu de Git; garder une copie de secours chiffrée dans un emplacement maîtrisé.
- La clé HMAC utilisée pour protéger les données locales d'essai est incluse dans le code de l'application. Elle ne doit pas être considérée comme un secret inviolable; un utilisateur avancé pourrait l'extraire. Pour une protection plus forte, il faudra tester une validation en ligne ou assumer les limites du mode hors ligne.
- Garder un registre vendeur : client, contact, preuve/date de paiement, identifiant machine, numéro de licence et transfert éventuel. Ne pas y conserver plus de données personnelles que nécessaire.
- Les mises à jour et modifications étant facturées séparément, préciser au client le périmètre et le prix avant chaque intervention.
- Prévoir une sauvegarde/export des données avant toute intervention ou migration de version.

## Étapes avant activation

1. Régler la durée d'essai à 15 jours.
2. Décider si un transfert vers un nouvel ordinateur est gratuit ou facturé.
3. Tester sur une installation Windows propre : essai, expiration, saisie d'un code valide, code d'un autre ordinateur, date système reculée, transfert et récupération des données.
4. Activer le blocage seulement après ces essais et après sauvegarde de la clé privée.

**Conditions retenues : 150 000 FCFA payés une seule fois; 15 jours d'essai; licence permanente sur l'ordinateur activé; modifications et mises à jour facturées séparément. L'application n'a pas encore été modifiée pour appliquer ces conditions.**
