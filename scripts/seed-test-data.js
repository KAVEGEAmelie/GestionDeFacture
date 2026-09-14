// Insère des données de test dans la base de l'application.
// Usage : node scripts/seed-test-data.js
// Fermez l'application avant de lancer le script.
const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const os = require('os');
const fs = require('fs');

const configDir = process.platform === 'win32'
  ? (process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'))
  : path.join(os.homedir(), '.config');
const dbPath = path.join(configDir, 'gestion-facturation', 'facturation.db');
if (!fs.existsSync(dbPath)) {
  console.error('Base introuvable :', dbPath);
  process.exit(1);
}
const db = new DatabaseSync(dbPath);

const ANNEE = new Date().getFullYear();
const pad5 = (n) => String(n).padStart(5, '0');
const hasCol = (table, col) =>
  db.prepare(`PRAGMA table_info(${table})`).all().some((c) => c.name === col);

const sectionsOK = {
  proforma_lignes: hasCol('proforma_lignes', 'section_titre'),
  facture_lignes: hasCol('facture_lignes', 'section_titre'),
  bordereau_lignes: hasCol('bordereau_lignes', 'section_titre'),
};

// `--proformas-desc` : insère uniquement 4 proformas d'exemple avec descriptions détaillées de lignes
if (process.argv.includes('--proformas-desc')) {
  if (!hasCol('proforma_lignes', 'description')) {
    db.exec("ALTER TABLE proforma_lignes ADD COLUMN description TEXT DEFAULT ''");
  }
  const clientsRows = db.prepare('SELECT id, nom FROM clients ORDER BY id').all();
  if (clientsRows.length === 0) {
    console.error("Aucun client dans la base : lancez d'abord le seed complet.");
    process.exit(1);
  }
  const getCpt = (cle) => {
    const r = db.prepare('SELECT valeur FROM parametres WHERE cle = ?').get(cle);
    return r ? parseInt(r.valeur, 10) || 0 : 0;
  };
  const setCpt = (cle, val) =>
    db.prepare('INSERT INTO parametres (cle, valeur) VALUES (?, ?) ON CONFLICT(cle) DO UPDATE SET valeur = excluded.valeur')
      .run(cle, String(val));

  const exemples = [
    {
      // 1. Descriptions courtes (1 à 2 lignes) sur chaque ligne
      date: `${ANNEE}-04-06`,
      objet: "Fourniture et installation d'un réseau structuré",
      tva_applicable: 1,
      lignes: [
        {
          designation: 'Câble réseau Cat6 (rouleau 305m)', unite: 'Rouleau', quantite: 2, prix: 85000,
          description: '-Câble UTP Cat6 certifié classe E\n-Gaine LSZH faible émission de fumée',
        },
        {
          designation: 'Switch 24 ports Gigabit', unite: 'Unité', quantite: 1, prix: 145000,
          description: '-Switch manageable niveau 2\n-24 ports Gigabit + 4 ports SFP\n-Configuration des VLAN incluse\n-Supervision incluse',
        },
        {
          designation: 'Installation et configuration', unite: 'Forfait', quantite: 1, prix: 250000,
          description: '-Pose et brassage\n-Certification des liens\n-Recette avec rapport de tests',
        },
      ],
    },
    {
      // 2. Descriptions longues multi-paragraphes
      date: `${ANNEE}-05-14`,
      objet: "Mise en place d'un système de vidéosurveillance IP",
      tva_applicable: 1,
      lignes: [
        {
          designation: 'Caméra IP dôme 4MP', unite: 'Unité', quantite: 8, prix: 78000,
          description: "Caractéristiques:\n\n-Vision nocturne infrarouge portée 30 m\n-Étanche IP67 (poussière et pluie)\n-Alimentation PoE : un seul câble réseau\n-Objectif grand angle 2,8 mm",
        },
        {
          designation: 'NVR 16 canaux', unite: 'Unité', quantite: 1, prix: 265000,
          description: "-Disque dur de surveillance 4 To (environ 30 jours d'enregistrement)\n-Accès à distance depuis smartphone et ordinateur\n-Notifications en cas de détection de mouvement\n-Extensible jusqu'à 16 caméras",
        },
        {
          designation: 'Écran de supervision 43"', unite: 'Unité', quantite: 1, prix: 185000,
          description: '-Moniteur 4K dédié à la supervision\n-Affichage en mosaïque des 8 caméras\n-Zoom sur incident',
        },
      ],
    },
    {
      // 3. Avec sections (lots) et mélange lignes avec / sans description
      date: `${ANNEE}-06-02`,
      objet: 'Aménagement de la salle serveur — matériel et services',
      tva_applicable: 1,
      lignes: [
        {
          designation: 'Baie de brassage 42U', unite: 'Unité', quantite: 1, prix: 350000, section: 'LOT 1 : FOURNITURES',
          description: '-Armoire rack 19" 42U\n-Portes avant vitrée et arrière métal\n-4 ventilateurs de toit\n-2 bandeaux de prises',
        },
        {
          designation: 'Panneau de brassage 24 ports', unite: 'Unité', quantite: 2, prix: 45000, section: 'LOT 1 : FOURNITURES',
          description: '',
        },
        {
          designation: 'Onduleur 1500VA', unite: 'Unité', quantite: 2, prix: 125000, section: 'LOT 1 : FOURNITURES',
          description: "-Line-interactive avec régulation automatique de tension\n-Autonomie d'environ 20 minutes à pleine charge",
        },
        {
          designation: 'Installation et configuration', unite: 'Forfait', quantite: 1, prix: 300000, section: 'LOT 2 : TRAVAUX ET SERVICES',
          description: '-Montage de la baie\n-Reprise du brassage existant\n-Étiquetage complet\n-Remise du dossier de recette',
        },
        {
          designation: 'Maintenance annuelle', unite: 'Forfait', quantite: 1, prix: 300000, section: 'LOT 2 : TRAVAUX ET SERVICES',
          description: '',
        },
      ],
    },
    {
      // 4. Sans TVA : une seule ligne avec description très longue (test extrême)
      date: `${ANNEE}-07-20`,
      objet: 'Fourniture d\'un serveur de fichiers clé en main',
      tva_applicable: 0,
      lignes: [
        {
          designation: 'Serveur tour Xeon 32Go', unite: 'Unité', quantite: 1, prix: 1250000,
          description: "ServeurPro:\n\n-Processeur Intel Xeon 8 cœurs\n-32 Go de mémoire ECC\n-4 disques de 2 To en RAID 5 (6 To utiles)\n-Système serveur préinstallé et configuré\n-Partages de fichiers avec droits d'accès par service\n-Sauvegarde automatique quotidienne\n\nMise en service : reprise des données (jusqu'à 2 To), création des comptes, formation d'une demi-journée, garantie 3 ans sur site.",
        },
      ],
    },
  ];

  const insP = db.prepare(`
    INSERT INTO proformas (numero, date, client_id, objet, total_materiel_ht, prestations, remise, total_ht, tva, total_ttc, statut, avec_cachet, tva_applicable)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insL = sectionsOK.proforma_lignes
    ? db.prepare('INSERT INTO proforma_lignes (proforma_id, produit_id, designation, description, unite, quantite, prix_unitaire, montant, ordre, section_titre) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    : db.prepare('INSERT INTO proforma_lignes (proforma_id, produit_id, designation, description, unite, quantite, prix_unitaire, montant, ordre) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');

  let cpt = getCpt('proforma_compteur');
  exemples.forEach((ex, k) => {
    cpt += 1;
    const numero = `${ANNEE}/${pad5(cpt)}-ITS`;
    const clientId = clientsRows[k % clientsRows.length].id;
    const totalMateriel = ex.lignes.reduce((s, l) => s + l.quantite * l.prix, 0);
    const tva = ex.tva_applicable ? Math.round(totalMateriel * 0.18) : 0;
    const res = insP.run(
      numero, ex.date, clientId, ex.objet,
      totalMateriel, 0, 0, totalMateriel, tva, totalMateriel + tva,
      'en_attente', 1, ex.tva_applicable
    );
    const pid = Number(res.lastInsertRowid);
    ex.lignes.forEach((l, i) => {
      const args = [pid, null, l.designation, l.description || '', l.unite, l.quantite, l.prix, l.quantite * l.prix, i];
      if (sectionsOK.proforma_lignes) args.push(l.section || '');
      insL.run(...args);
    });
    console.log(`✔ Proforma ${numero} — ${ex.objet}`);
  });
  setCpt('proforma_compteur', cpt);
  db.close();
  console.log('\nSeed limité aux proformas avec descriptions :', dbPath);
  process.exit(0);
}

// ---------- FICHES D'INTERVENTION TECHNIQUE ----------
// Crée la table si l'app n'a pas encore démarré avec la nouvelle version
db.exec(`
  CREATE TABLE IF NOT EXISTS interventions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    numero TEXT UNIQUE NOT NULL,
    date DATE,
    intervenant TEXT,
    heure_arrivee TEXT,
    heure_depart TEXT,
    client_nom TEXT,
    client_adresse TEXT,
    client_contact TEXT,
    interlocuteur TEXT,
    options_reseaux TEXT,
    options_maintenance TEXT,
    marque_modele TEXT,
    num_serie TEXT,
    systeme_exploitation TEXT,
    vol_donnees TEXT,
    test_continuite TEXT,
    ping TEXT,
    debit_desc TEXT,
    debit_mont TEXT,
    description_probleme TEXT,
    travaux_realises TEXT,
    materiels TEXT,
    statut_final TEXT,
    details TEXT DEFAULT '{}',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);
if (!hasCol('interventions', 'details')) {
  db.exec("ALTER TABLE interventions ADD COLUMN details TEXT DEFAULT '{}'");
}

const annee = new Date().getFullYear();
// Fiches modèle V11 : champs de base en colonnes, le reste dans `details` (JSON)
const fiches = [
  {
    // Fiche réseau (résolue) — toutes les zones de texte remplies
    date: `${annee}-03-12`, intervenant: 'Kossi AMEGAN',
    client_nom: 'ECOBANK TOGO', client_adresse: 'Agence centrale — Service informatique, 2e étage, Lomé',
    client_contact: 'M. TOGBE (Resp. IT) — +228 22 21 72 14',
    marque_modele: 'Cisco Catalyst 2960', num_serie: 'FOC1932X0K4',
    description_probleme: "Coupures intermittentes du réseau au 2e étage de l'agence. Plusieurs postes de travail perdent la connexion aux heures de pointe et les opérations au guichet sont ralenties. Le problème est apparu après des travaux d'électricité réalisés la semaine précédente dans le local technique.",
    travaux_realises: "Recertification de l'ensemble des liens cuivre de l'étage, remplacement de trois jarretières écrasées lors des travaux, reprise du brassage de la baie du 2e étage et reconfiguration du switch d'étage (répartition des VLAN, activation du spanning-tree). Nettoyage et ré-étiquetage complet de la baie de brassage.",
    materiels: [
      { designation: 'Jarretière Cat6 2m', qte: '3', etat: 'Neuf', ref: 'Remplacement des liens écrasés' },
      { designation: 'Module SFP 1G Cisco', qte: '1', etat: 'Neuf', ref: 'GLC-LH-SMD — garantie 24 mois' },
    ],
    statut_final: 'Résolu',
    details: {
      nature: ['Panne', 'Contrôle'],
      equipements: ['Switch', 'Baie/Brassage', 'Fibre/SFP'],
      accessoires: 'Câble console, 2 modules SFP de rechange remis par le client',
      etat_reception: 'Bon',
      diagnostic: "Trois liens cuivre du 2e étage présentent une continuité défectueuse : les jarretières ont été pincées lors du passage des nouvelles gaines électriques. Le switch d'étage redémarrait par intermittence à cause d'une boucle créée par un brassage provisoire laissé en place. Aucun défaut constaté sur la liaison fibre montante ni sur le routeur principal.",
      tests: ['Réseau LAN OK', 'Internet OK', 'Accès serveur OK', 'Tests concluants'],
      backup_before: 'Non nécessaire',
      donnees: ['Aucune'],
      donnees_autres: '',
      securite: ['Comptes/accès vérifiés', 'Mises à jour'],
      data_obs: "Aucune donnée utilisateur manipulée pendant l'intervention. Les accès d'administration du switch ont été vérifiés et les identifiants consignés auprès du responsable IT.",
      equip_final: 'En service',
      fin: `${annee}-03-12`,
      duree: '3h45',
      prochaine_action: 'Contrôle préventif du brassage dans 6 mois',
      recommandations: "Prévoir le remplacement du switch d'étage (fin de support constructeur) et l'étiquetage complet des liens restants de la baie. Faire passer les prochains câbles électriques dans une goulotte séparée des courants faibles pour éviter tout nouvel incident.",
      obs_client: 'Intervention rapide et soignée, le réseau est de nouveau stable sur tout le 2e étage.',
    },
  },
  {
    // Fiche maintenance poste de caisse (résolu provisoirement)
    date: `${annee}-05-04`, intervenant: 'Afi DOSSOU',
    client_nom: 'PHARMACIE DU GOLFE', client_adresse: 'Comptoir principal — Rue du Commerce, Lomé',
    client_contact: 'Mme AKOSSIWA (Gérante) — +228 90 11 22 33',
    marque_modele: 'HP ProDesk 400 G6', num_serie: 'CZC1234ABC',
    description_probleme: "Poste de caisse très lent au démarrage, surchauffe importante et extinctions inopinées en fin de journée. La gérante signale également des messages d'erreur du logiciel de caisse et craint de perdre l'historique des ventes.",
    travaux_realises: "Sauvegarde complète des données de caisse (250 Go) sur disque externe, démontage et nettoyage complet de l'unité centrale, remplacement de la pâte thermique et du ventilateur de boîtier, ajout d'une barrette de 8 Go de RAM, réinstallation du système et du logiciel de caisse, puis restauration des données et vérification du bon fonctionnement avec la gérante.",
    materiels: [
      { designation: 'Pâte thermique Arctic MX-4', qte: '1', etat: 'Neuf', ref: 'Tube 4 g' },
      { designation: 'Barrette RAM 8Go DDR4', qte: '1', etat: 'Neuf', ref: 'Garantie 12 mois' },
      { designation: 'Ventilateur boitier 120mm', qte: '1', etat: 'Neuf', ref: 'Garantie 6 mois' },
    ],
    statut_final: 'Résolu provisoirement',
    details: {
      nature: ['Panne', 'Maintenance préventive'],
      equipements: ['Ordinateur bureau', 'Windows/Système', 'Sauvegarde'],
      accessoires: "Câble d'alimentation, clavier, souris, écran HP 22\"",
      etat_reception: 'Moyen',
      diagnostic: "Encrassement sévère du dissipateur et pâte thermique desséchée provoquant la surchauffe et les extinctions. Le disque dur présente des secteurs réalloués (SMART dégradé) : il est à l'origine des lenteurs et devra être remplacé rapidement. Mémoire vive insuffisante pour le logiciel de caisse.",
      tests: ['Démarrage OK', 'Réseau LAN OK', 'Sauvegarde OK', 'Tests concluants'],
      backup_before: 'Oui',
      donnees: ['Documents', 'Base de données'],
      donnees_autres: 'Fichiers du logiciel de caisse (historique des ventes)',
      securite: ['Antivirus contrôlé', 'Mises à jour', 'Mot de passe modifié par le client'],
      data_obs: "Sauvegarde intégrale réalisée avant toute manœuvre et vérifiée par restauration d'un échantillon. Le mot de passe de session a été modifié par la gérante en fin d'intervention.",
      equip_final: 'En service',
      fin: `${annee}-05-04`,
      duree: '3h30',
      prochaine_action: 'Remplacement du disque dur par un SSD dès accord du client',
      recommandations: "Remplacer le disque dur vieillissant par un SSD de 500 Go sous quinzaine (devis transmis). Mettre en place une sauvegarde automatique quotidienne des données de caisse sur support externe et dépoussiérer l'unité centrale tous les six mois.",
      obs_client: "Le poste est nettement plus rapide. J'attends le devis pour le remplacement du disque dur.",
    },
  },
  {
    // Fiche campus (textes longs pour tester les sauts de page, en attente de pièce)
    date: `${annee}-06-18`, intervenant: 'Yao KPOTUFE',
    client_nom: 'UNIVERSITÉ DE LOMÉ', client_adresse: 'Campus nord — Bâtiment C, salle serveurs, Lomé',
    client_contact: 'Dr KODJO (DSI) — +228 22 25 50 94',
    marque_modele: 'Dell PowerEdge R740', num_serie: 'SVCTAG-7XK9Q',
    description_probleme: "Panne générale du réseau Wi-Fi du campus nord suite à un orage. Le serveur de téléphonie IP ne répond plus et la baie de brassage du bâtiment C présente des traces de surtension. Plusieurs bornes Wi-Fi ne s'allument plus du tout et l'onduleur principal est en défaut. Les enseignants ne peuvent plus accéder à la plateforme de cours en ligne depuis les salles du campus nord et la scolarité ne peut plus imprimer les attestations.",
    travaux_realises: "Contrôle des arrivées fibre et tests de continuité sur l'ensemble des liens cuivre du bâtiment C. Remplacement de l'injecteur PoE principal, de deux bornes Wi-Fi détruites et des batteries de l'onduleur. Pose de parafoudres Ethernet sur les liaisons exposées. Redémarrage et resynchronisation du PABX IP : la téléphonie est rétablie. Le commutateur cœur de réseau reste instable malgré la remise à niveau du microcode : son remplacement complet est nécessaire, le matériel a été commandé.",
    materiels: [
      { designation: 'Borne Wi-Fi 6 plafonnier', qte: '2', etat: 'Neuf', ref: 'Garantie 24 mois' },
      { designation: 'Injecteur PoE+ 30W', qte: '1', etat: 'Neuf', ref: 'Garantie 12 mois' },
      { designation: 'Jarretière fibre LC-LC 3m', qte: '4', etat: 'Neuf', ref: 'Liens baie C vers cœur de réseau' },
      { designation: 'Parafoudre Ethernet', qte: '6', etat: 'Neuf', ref: 'Pose sur liaisons extérieures' },
      { designation: 'Bandeau de prises rackable', qte: '1', etat: 'Réutilisé', ref: 'Récupéré de la baie du bâtiment A' },
      { designation: 'Batterie onduleur 12V 9Ah', qte: '2', etat: 'Neuf', ref: 'Garantie 12 mois' },
    ],
    statut_final: 'En attente de pièce',
    details: {
      nature: ['Panne', 'Contrôle', 'Mise à niveau'],
      equipements: ['Serveur', "Point d'accès Wi-Fi", 'Téléphonie IP', 'Baie/Brassage', 'Onduleur/UPS'],
      accessoires: 'Clés de la salle serveurs, badge d’accès visiteur, plan de câblage du bâtiment C',
      etat_reception: 'Dégradé',
      diagnostic: "La surtension provoquée par l'orage a détruit l'injecteur PoE principal et deux bornes Wi-Fi, et endommagé les batteries de l'onduleur. Le commutateur cœur de réseau a subi des redémarrages répétés et présente des ports défectueux : il n'est plus fiable et doit être remplacé. Le serveur de téléphonie n'a pas été endommagé, il était simplement isolé du réseau. Les liaisons fibre inter-bâtiments sont intactes.",
      tests: ['Wi-Fi OK', 'Internet OK', 'Fonctionnement partiel', 'À poursuivre', 'Équipement à remplacer'],
      backup_before: 'Impossible',
      donnees: ['Messagerie', 'Base de données'],
      donnees_autres: 'Plateforme de cours en ligne (hébergée sur le serveur local)',
      securite: ['Comptes/accès vérifiés', 'Mises à jour'],
      data_obs: "Le serveur étant inaccessible à l'arrivée, aucune sauvegarde préalable n'a pu être réalisée. Après rétablissement, l'intégrité des bases de données a été vérifiée et une sauvegarde complète a été lancée immédiatement vers le NAS du rectorat.",
      equip_final: 'Remplacé temporairement',
      fin: `${annee}-06-18`,
      duree: '9h30',
      prochaine_action: 'Retour dès réception du commutateur cœur de réseau',
      recommandations: "Installer un parafoudre en tête de tableau électrique du local technique et raccorder l'ensemble des équipements actifs à l'onduleur. Souscrire un contrat de maintenance préventive incluant le contrôle semestriel des protections. Prévoir à moyen terme la redondance du cœur de réseau pour éviter une nouvelle interruption générale du campus.",
      obs_client: "Service rétabli partiellement dans la journée, la téléphonie fonctionne. Nous attendons le remplacement du commutateur pour valider définitivement l'intervention.",
    },
  },
];

const existeFit = db.prepare('SELECT 1 FROM interventions WHERE numero = ?');
let cptFit = annee === 2026 ? 16 : 0;
db.prepare('SELECT numero FROM interventions').all().forEach((r) => {
  const m = /^(\d{4})\/(\d{5})-ITS$/.exec(r.numero || '');
  if (m && Number(m[1]) === annee) cptFit = Math.max(cptFit, Number(m[2]));
});
const insIntervention = db.prepare(`
  INSERT INTO interventions (numero, date, intervenant, client_nom, client_adresse, client_contact,
    marque_modele, num_serie, description_probleme, travaux_realises, materiels, statut_final, details)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
fiches.forEach((f) => {
  let numero;
  do {
    cptFit += 1;
    numero = `${annee}/${pad5(cptFit)}-ITS`;
  } while (existeFit.get(numero));
  insIntervention.run(
    numero, f.date, f.intervenant, f.client_nom, f.client_adresse, f.client_contact,
    f.marque_modele, f.num_serie, f.description_probleme, f.travaux_realises,
    JSON.stringify(f.materiels), f.statut_final, JSON.stringify(f.details)
  );
});
console.log(`✔ ${fiches.length} fiches d'intervention`);

// `--interventions` : insère uniquement les fiches (évite de dupliquer clients/produits/documents)
if (process.argv.includes('--interventions')) {
  db.close();
  console.log('\nSeed limité aux fiches d\'intervention :', dbPath);
  process.exit(0);
}

// ---------- CLIENTS ----------
const clients = [
  ['SOCIÉTÉ TOGOLAISE DE COTON', 'BP 219, Lomé', '+228 22 21 33 44', 'contact@sotoco.tg', '1000123456', 1],
  ['MINISTÈRE DES TRAVAUX PUBLICS', 'Avenue de la Présidence, Lomé', '+228 22 21 55 66', 'courrier@mtp.gouv.tg', '1000234567', 1],
  ['HÔTEL SARAKAWA', 'Boulevard du Mono, Lomé', '+228 22 27 65 90', 'reception@sarakawa.tg', '1000345678', 1],
  ['PHARMACIE DU GOLFE', 'Rue du Commerce, Lomé', '+228 90 11 22 33', 'pharmagolfe@gmail.com', '1000456789', 0],
  ['ECOBANK TOGO', '20 Avenue Sylvanus Olympio, Lomé', '+228 22 21 72 14', 'info@ecobank.tg', '1000567890', 1],
  ['UNIVERSITÉ DE LOMÉ', 'Boulevard Eyadéma, Lomé', '+228 22 25 50 94', 'rectorat@univ-lome.tg', '1000678901', 1],
  ['GARAGE MODERNE SARL', 'Zone portuaire, Lomé', '+228 91 44 55 66', 'garagemoderne@yahoo.fr', '1000789012', 0],
  ['CLINIQUE BIASA', 'Rue de l\'OCAM, Lomé', '+228 22 21 32 87', 'accueil@biasa.tg', '1000890123', 1],
];
const insClient = db.prepare(
  'INSERT INTO clients (nom, adresse, telephone, email, nif, tva_applicable) VALUES (?, ?, ?, ?, ?, ?)'
);
const clientIds = clients.map((c) => Number(insClient.run(...c).lastInsertRowid));
console.log(`✔ ${clientIds.length} clients`);

// ---------- PRODUITS ----------
const produits = [
  ['Câble réseau Cat6 (rouleau 305m)', 85000, 'Rouleau', 'Câble UTP Cat6 certifié'],
  ['Switch 24 ports Gigabit', 145000, 'Unité', 'Switch manageable rackable'],
  ['Point d\'accès WiFi 6', 95000, 'Unité', 'AP plafonnier double bande'],
  ['Onduleur 1500VA', 125000, 'Unité', 'Onduleur line-interactive'],
  ['Caméra IP dôme 4MP', 78000, 'Unité', 'Vision nocturne 30m, PoE'],
  ['NVR 16 canaux', 265000, 'Unité', 'Enregistreur réseau avec disque 4To'],
  ['Écran de supervision 43"', 185000, 'Unité', 'Moniteur 4K pour vidéosurveillance'],
  ['Baie de brassage 42U', 350000, 'Unité', 'Armoire rack avec ventilation'],
  ['Panneau de brassage 24 ports', 45000, 'Unité', 'Patch panel Cat6'],
  ['Prise réseau RJ45 double', 8500, 'Unité', 'Prise murale avec plastron'],
  ['Goulotte 40x60 (barre 2m)', 4500, 'Barre', 'Goulotte PVC blanche'],
  ['Installation et configuration', 50000, 'Forfait', 'Main d\'œuvre technique'],
  ['Maintenance annuelle', 300000, 'Forfait', 'Contrat de maintenance préventive'],
  ['Serveur tour Xeon 32Go', 1250000, 'Unité', 'Serveur de fichiers avec RAID'],
  ['Licence antivirus (poste)', 15000, 'Licence', 'Protection endpoint 1 an'],
];
const insProduit = db.prepare(
  'INSERT INTO produits (designation, prix_unitaire, unite, description) VALUES (?, ?, ?, ?)'
);
const produitRows = produits.map((p) => ({
  id: Number(insProduit.run(...p).lastInsertRowid),
  designation: p[0],
  prix: p[1],
  unite: p[2],
}));
console.log(`✔ ${produitRows.length} produits`);

// ---------- Helpers documents ----------
const getCompteur = (cle) => {
  const row = db.prepare('SELECT valeur FROM parametres WHERE cle = ?').get(cle);
  return row ? parseInt(row.valeur, 10) || 0 : 0;
};
const setCompteur = (cle, val) => {
  db.prepare('INSERT INTO parametres (cle, valeur) VALUES (?, ?) ON CONFLICT(cle) DO UPDATE SET valeur = excluded.valeur')
    .run(cle, String(val));
};
const pick = (arr, n) => {
  const copy = [...arr];
  const out = [];
  while (out.length < n && copy.length) {
    out.push(copy.splice(Math.floor(Math.random() * copy.length), 1)[0]);
  }
  return out;
};
const dateAleatoire = () => {
  const d = new Date(ANNEE, Math.floor(Math.random() * 8), 1 + Math.floor(Math.random() * 28));
  return d.toISOString().split('T')[0];
};

const OBJETS = [
  'Fourniture et installation de matériel réseau',
  'Mise en place d\'un système de vidéosurveillance',
  'Câblage informatique des bureaux',
  'Fourniture d\'équipements informatiques',
  'Extension du réseau WiFi',
  'Installation d\'un serveur de fichiers',
  'Maintenance du parc informatique',
  'Sécurisation de la salle serveur',
];

function construireLignes(nb, avecSections) {
  const choisis = pick(produitRows, nb);
  return choisis.map((p, i) => {
    const quantite = 1 + Math.floor(Math.random() * 10);
    return {
      produit_id: p.id,
      designation: p.designation,
      unite: p.unite,
      quantite,
      prix_unitaire: p.prix,
      montant: quantite * p.prix,
      section_titre: avecSections ? (i < Math.ceil(nb / 2) ? 'LOT 1 : FOURNITURES' : 'LOT 2 : TRAVAUX ET SERVICES') : '',
    };
  });
}

// ---------- PROFORMAS ----------
let cptProforma = getCompteur('proforma_compteur');
const insProforma = db.prepare(`
  INSERT INTO proformas (numero, date, client_id, objet, total_materiel_ht, prestations, remise, total_ht, tva, total_ttc, statut, avec_cachet, tva_applicable)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
const insProformaLigne = sectionsOK.proforma_lignes
  ? db.prepare('INSERT INTO proforma_lignes (proforma_id, produit_id, designation, unite, quantite, prix_unitaire, montant, ordre, section_titre) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
  : db.prepare('INSERT INTO proforma_lignes (proforma_id, produit_id, designation, unite, quantite, prix_unitaire, montant, ordre) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');

const proformasCreees = [];
for (let k = 0; k < 10; k++) {
  cptProforma += 1;
  const numero = `${ANNEE}/${pad5(cptProforma)}-ITS`;
  const clientId = clientIds[k % clientIds.length];
  const tvaApplicable = k % 4 === 3 ? 0 : 1;
  const avecSections = sectionsOK.proforma_lignes && k % 3 === 0;
  const lignes = construireLignes(3 + Math.floor(Math.random() * 4), avecSections);
  const totalMateriel = lignes.reduce((s, l) => s + l.montant, 0);
  const prestations = k % 2 === 0 ? 150000 : 0;
  const remise = k % 5 === 0 ? 50000 : 0;
  const totalHT = totalMateriel + prestations - remise;
  const tva = tvaApplicable ? Math.round(totalHT * 0.18) : 0;
  const totalTTC = totalHT + tva;

  const res = insProforma.run(
    numero, dateAleatoire(), clientId, OBJETS[k % OBJETS.length],
    totalMateriel, prestations, remise, totalHT, tva, totalTTC,
    'en_attente', k % 2, tvaApplicable
  );
  const proformaId = Number(res.lastInsertRowid);
  lignes.forEach((l, i) => {
    const args = [proformaId, l.produit_id, l.designation, l.unite, l.quantite, l.prix_unitaire, l.montant, i];
    if (sectionsOK.proforma_lignes) args.push(l.section_titre);
    insProformaLigne.run(...args);
  });
  proformasCreees.push({ id: proformaId, numero, clientId, lignes, totalMateriel, prestations, remise, totalHT, tva, totalTTC });
}
setCompteur('proforma_compteur', cptProforma);
console.log(`✔ ${proformasCreees.length} proformas`);

// ---------- FACTURES (à partir des 5 premières proformas) ----------
let cptFacture = getCompteur('facture_compteur');
const insFacture = db.prepare(`
  INSERT INTO factures (numero, date, client_id, objet, total_materiel_ht, prestations, remise, total_ht, tva, total_ttc, proforma_id)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
const insFactureLigne = sectionsOK.facture_lignes
  ? db.prepare('INSERT INTO facture_lignes (facture_id, produit_id, designation, unite, quantite, prix_unitaire, montant, ordre, section_titre) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
  : db.prepare('INSERT INTO facture_lignes (facture_id, produit_id, designation, unite, quantite, prix_unitaire, montant, ordre) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');

const facturesCreees = [];
proformasCreees.slice(0, 5).forEach((p, k) => {
  cptFacture += 1;
  const numero = `${ANNEE}/${pad5(cptFacture)}-ITS`;
  const res = insFacture.run(
    numero, dateAleatoire(), p.clientId, OBJETS[k % OBJETS.length],
    p.totalMateriel, p.prestations, p.remise, p.totalHT, p.tva, p.totalTTC, p.id
  );
  const factureId = Number(res.lastInsertRowid);
  p.lignes.forEach((l, i) => {
    const args = [factureId, l.produit_id, l.designation, l.unite, l.quantite, l.prix_unitaire, l.montant, i];
    if (sectionsOK.facture_lignes) args.push(l.section_titre);
    insFactureLigne.run(...args);
  });
  db.prepare("UPDATE proformas SET statut = 'facturee', facture_id = ? WHERE id = ?").run(factureId, p.id);
  facturesCreees.push({ id: factureId, numero, clientId: p.clientId, lignes: p.lignes, tva: p.tva, totalTTC: p.totalTTC });
});
setCompteur('facture_compteur', cptFacture);
console.log(`✔ ${facturesCreees.length} factures`);

// ---------- BORDEREAUX (pour 3 factures) ----------
let cptBordereau = getCompteur('bordereau_compteur');
const insBordereau = db.prepare('INSERT INTO bordereaux (numero, date, client_id, facture_id) VALUES (?, ?, ?, ?)');
const insBordereauLigne = sectionsOK.bordereau_lignes
  ? db.prepare('INSERT INTO bordereau_lignes (bordereau_id, designation, quantite, ordre, section_titre) VALUES (?, ?, ?, ?, ?)')
  : db.prepare('INSERT INTO bordereau_lignes (bordereau_id, designation, quantite, ordre) VALUES (?, ?, ?, ?)');

facturesCreees.slice(0, 3).forEach((f) => {
  cptBordereau += 1;
  const numero = `${ANNEE}/${pad5(cptBordereau)}-ITS`;
  const res = insBordereau.run(numero, dateAleatoire(), f.clientId, f.id);
  const bordereauId = Number(res.lastInsertRowid);
  f.lignes.forEach((l, i) => {
    const args = [bordereauId, l.designation, l.quantite, i];
    if (sectionsOK.bordereau_lignes) args.push(l.section_titre);
    insBordereauLigne.run(...args);
  });
  db.prepare('UPDATE factures SET bordereau_id = ? WHERE id = ?').run(bordereauId, f.id);
});
setCompteur('bordereau_compteur', cptBordereau);
console.log('✔ 3 bordereaux');

// ---------- RAPPORTS TECHNIQUES ----------
let cptRapport = getCompteur('rapport_compteur');
const insRapport = db.prepare(`
  INSERT INTO rapports (numero, date, titre, client_id, client_nom, lieu, objet, sections, avec_cachet)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
const rapportsData = [
  ['Rapport d\'installation du réseau informatique', 'Lomé', 'Installation réseau siège', [
    { titre: 'Contexte', contenu: 'Installation d\'un réseau structuré de 45 points d\'accès dans les locaux du client.' },
    { titre: 'Travaux réalisés', contenu: 'Tirage de câbles Cat6, pose de goulottes, brassage et certification des liens.' },
    { titre: 'Recommandations', contenu: 'Prévoir un contrat de maintenance annuel et un onduleur pour la baie principale.' },
  ]],
  ['Rapport de maintenance vidéosurveillance', 'Lomé', 'Maintenance trimestrielle CCTV', [
    { titre: 'Interventions', contenu: 'Nettoyage des caméras, vérification des enregistrements, mise à jour du firmware NVR.' },
    { titre: 'Anomalies constatées', contenu: 'Caméra n°7 hors service (câble sectionné), remplacée sous garantie.' },
  ]],
  ['Rapport d\'audit du parc informatique', 'Kara', 'Audit annuel', [
    { titre: 'Inventaire', contenu: '32 postes de travail, 2 serveurs, 5 imprimantes réseau recensés.' },
    { titre: 'État général', contenu: '4 postes obsolètes à remplacer, antivirus expiré sur 12 machines.' },
    { titre: 'Plan d\'action', contenu: 'Renouvellement progressif sur 6 mois et déploiement de licences antivirus.' },
  ]],
];
rapportsData.forEach((r, k) => {
  cptRapport += 1;
  const numero = `${ANNEE}/${pad5(cptRapport)}-ITS`;
  const clientId = clientIds[k % clientIds.length];
  const clientNom = clients[k % clients.length][0];
  insRapport.run(numero, dateAleatoire(), r[0], clientId, clientNom, r[1], r[2], JSON.stringify(r[3]), k % 2);
});
setCompteur('rapport_compteur', cptRapport);
console.log(`✔ ${rapportsData.length} rapports techniques`);

// ---------- ATTESTATIONS ----------
const nbAttestations = db.prepare('SELECT COUNT(*) AS count FROM attestations').get().count || 0;
const insAttestation = db.prepare(`
  INSERT INTO attestations (numero, reference, title, date, lieu, client_nom, objet, intro, travaux, conformite, signataire_gauche, signataire_droite)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
for (let k = 0; k < 3; k++) {
  const numero = `ASF-${String(nbAttestations + k + 1).padStart(4, '0')}`;
  insAttestation.run(
    numero,
    `REF-${ANNEE}-${100 + k}`,
    'ATTESTATION DE SERVICE FAIT',
    dateAleatoire(),
    'Lomé',
    clients[k][0],
    OBJETS[k],
    'Nous soussignés, In-Tel Services, attestons que les travaux ci-dessous ont été exécutés conformément aux règles de l\'art.',
    JSON.stringify([
      'Fourniture du matériel',
      'Installation et configuration',
      'Tests et mise en service',
      'Formation des utilisateurs',
    ]),
    'Les prestations ont été réalisées dans les délais et jugées conformes au cahier des charges.',
    'Le Directeur Technique',
    'Le Client'
  );
}
console.log('✔ 3 attestations');

// ---------- APPELS D'OFFRES ----------
let cptAO = getCompteur('appel_offre_compteur');
const insAO = db.prepare(`
  INSERT INTO appels_offres (numero, date, client_id, objet, total_materiel_ht, prestations, remise, total_ht, tva, total_ttc,
    statut, avec_cachet, tva_applicable, reference_externe, autorite, autorite_adresse, validite_offre, delai_execution)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
const insAOLigne = db.prepare(
  'INSERT INTO appel_offre_lignes (appel_offre_id, produit_id, designation, unite, quantite, prix_unitaire, montant, ordre) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
);
const aoData = [
  {
    // AO public avec autorité contractante et référence externe
    objet: 'Fourniture et installation d\'équipements réseau pour 3 directions régionales',
    reference_externe: `AAO N°012/${ANNEE}/MTP/DGMP`,
    autorite: 'MINISTÈRE DES TRAVAUX PUBLICS — Direction des Marchés Publics',
    autorite_adresse: 'Avenue de la Présidence, BP 335, Lomé',
    validite: 120, delai: '45 jours calendaires', tva_applicable: 1, statut: 'en_attente', nbLignes: 6,
  },
  {
    // AO gagné (statut différent) avec délai court
    objet: 'Acquisition de matériel de vidéosurveillance pour le siège',
    reference_externe: `DRP N°034/${ANNEE}/EB-TG`,
    autorite: 'ECOBANK TOGO — Direction des Achats',
    autorite_adresse: '20 Avenue Sylvanus Olympio, Lomé',
    validite: 90, delai: '30 jours', tva_applicable: 1, statut: 'gagne', nbLignes: 4,
  },
  {
    // AO sans TVA, validité courte, peu de lignes
    objet: 'Câblage informatique de l\'annexe de Kara',
    reference_externe: '',
    autorite: 'UNIVERSITÉ DE LOMÉ — Rectorat',
    autorite_adresse: 'Boulevard Eyadéma, Lomé',
    validite: 60, delai: '3 semaines', tva_applicable: 0, statut: 'perdu', nbLignes: 3,
  },
];
aoData.forEach((ao, k) => {
  cptAO += 1;
  const numero = `AO-${ANNEE}/${pad5(cptAO)}-ITS`;
  const lignes = construireLignes(ao.nbLignes, false);
  const totalMateriel = lignes.reduce((s, l) => s + l.montant, 0);
  const totalHT = totalMateriel;
  const tva = ao.tva_applicable ? Math.round(totalHT * 0.18) : 0;
  const res = insAO.run(
    numero, dateAleatoire(), clientIds[(k + 1) % clientIds.length], ao.objet,
    totalMateriel, 0, 0, totalHT, tva, totalHT + tva,
    ao.statut, k % 2, ao.tva_applicable,
    ao.reference_externe, ao.autorite, ao.autorite_adresse, ao.validite, ao.delai
  );
  const aoId = Number(res.lastInsertRowid);
  lignes.forEach((l, i) =>
    insAOLigne.run(aoId, l.produit_id, l.designation, l.unite, l.quantite, l.prix_unitaire, l.montant, i)
  );
});
setCompteur('appel_offre_compteur', cptAO);
console.log(`✔ ${aoData.length} appels d'offres`);

// ---------- PAIEMENTS DE FACTURES (statuts variés pour tester le suivi TVA) ----------
// Factures 1-3 : payées (éligibles au versement TVA) ; facture 4 : payée + TVA déjà versée ; facture 5 : non payée
const marquerPayee = db.prepare(
  "UPDATE factures SET statut_paiement = 'payee', date_paiement = ? WHERE id = ?"
);
facturesCreees.slice(0, 4).forEach((f, k) => marquerPayee.run(dateAleatoire(), f.id));
if (facturesCreees[3]) {
  db.prepare("UPDATE factures SET tva_versee = 1, date_versement_tva = ? WHERE id = ?")
    .run(dateAleatoire(), facturesCreees[3].id);
}
console.log('✔ Statuts de paiement : 4 payées (dont 1 TVA versée), 1 non payée');

// ---------- VERSEMENT TVA OTR (lot + paiements partiels) ----------
// Lot avec les 2 premières factures payées : dû = 50 % de la TVA collectée
const facturesLot = facturesCreees.slice(0, 2).filter((f) => f.tva > 0);
if (facturesLot.length > 0) {
  let cptVers = db.prepare('SELECT COUNT(*) AS c FROM tva_versements').get().c || 0;
  let numVers;
  do {
    cptVers += 1;
    numVers = `VT-${String(cptVers).padStart(4, '0')}`;
  } while (db.prepare('SELECT 1 FROM tva_versements WHERE numero = ?').get(numVers));
  const totalTvaLot = facturesLot.reduce((s, f) => s + f.tva, 0);
  const totalDu = totalTvaLot / 2;
  const resVers = db.prepare(
    "INSERT INTO tva_versements (numero, date, total_du, note) VALUES (?, ?, ?, ?)"
  ).run(numVers, `${ANNEE}-08-05`, totalDu, 'Lot de test — TVA 1er semestre');
  const versId = Number(resVers.lastInsertRowid);
  const insVF = db.prepare('INSERT INTO tva_versement_factures (versement_id, facture_id, tva) VALUES (?, ?, ?)');
  facturesLot.forEach((f) => insVF.run(versId, f.id, f.tva));
  // Deux paiements partiels (~60 % puis ~25 %) : le lot reste ouvert avec un solde
  const insPaiement = db.prepare(
    'INSERT INTO tva_paiements (versement_id, date, montant, quittance, mode, note) VALUES (?, ?, ?, ?, ?, ?)'
  );
  insPaiement.run(versId, `${ANNEE}-08-10`, Math.round(totalDu * 0.6), `QUIT-${ANNEE}-0451`, 'Virement', '1er acompte');
  insPaiement.run(versId, `${ANNEE}-08-25`, Math.round(totalDu * 0.25), `QUIT-${ANNEE}-0502`, 'Chèque', '2e acompte — solde restant à régler');
  console.log(`✔ Versement TVA ${numVers} (${facturesLot.length} factures, 2 paiements partiels, solde ouvert)`);
}

// ---------- LISTES DE CHOIX (techniciens, sites/services) ----------
const insListe = db.prepare('INSERT OR IGNORE INTO listes_choix (categorie, valeur) VALUES (?, ?)');
const techniciens = ['Kossi AMEGAN', 'Afi DOSSOU', 'Yao KPOTUFE', 'Komlan EDORH', 'Essohanam PALI'];
const sitesServices = [
  'Agence centrale — Service informatique, 2e étage, Lomé',
  'Campus nord — Bâtiment C, salle serveurs, Lomé',
  'Comptoir principal — Rue du Commerce, Lomé',
  'Direction régionale de Kara — Service comptabilité',
  'Zone portuaire — Atelier mécanique, Lomé',
];
techniciens.forEach((t) => insListe.run('technicien', t));
sitesServices.forEach((s) => insListe.run('site_service', s));
console.log(`✔ Listes de choix : ${techniciens.length} techniciens, ${sitesServices.length} sites/services`);

db.close();
console.log('\nDonnées de test insérées avec succès dans', dbPath);
