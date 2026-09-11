// Insère des données de test dans la base de l'application.
// Usage : node scripts/seed-test-data.js
// Fermez l'application avant de lancer le script.
const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const os = require('os');
const fs = require('fs');

const dbPath = path.join(os.homedir(), '.config', 'gestion-facturation', 'facturation.db');
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
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

const annee = new Date().getFullYear();
const fiches = [
  {
    // Fiche réseaux complète (tests conformes, 2 matériels, résolu)
    date: `${annee}-03-12`, intervenant: 'Kossi AMEGAN', heure_arrivee: '08:30', heure_depart: '12:15',
    client_nom: 'ECOBANK TOGO', client_adresse: '20 Avenue Sylvanus Olympio, Lomé',
    client_contact: '+228 22 21 72 14 / info@ecobank.tg', interlocuteur: 'M. TOGBE (Resp. IT)',
    options_reseaux: ['Fibre Optique / Cuivre (RJ45)', 'Routeur / Switch / Pare-feu', 'Brassage / Baie / Câblage'],
    options_maintenance: [],
    marque_modele: 'Cisco Catalyst 2960', num_serie: 'FOC1932X0K4', systeme_exploitation: '', vol_donnees: '',
    test_continuite: 'Conforme', ping: '4', debit_desc: '94', debit_mont: '88',
    description_probleme: 'Coupures intermittentes du réseau au 2e étage. Plusieurs postes perdent la connexion aux heures de pointe.',
    travaux_realises: "Recertification des liens cuivre, remplacement de 3 jarretières défectueuses, reconfiguration du switch d'étage et équilibrage des VLAN.",
    materiels: [
      { designation: 'Jarretière Cat6 2m', qte: '3', garantie: '12' },
      { designation: 'Module SFP 1G Cisco', qte: '1', garantie: '24' },
    ],
    statut_final: 'Résolu',
  },
  {
    // Fiche maintenance informatique (OS Windows, partiellement résolu)
    date: `${annee}-05-04`, intervenant: 'Afi DOSSOU', heure_arrivee: '14:00', heure_depart: '17:45',
    client_nom: 'PHARMACIE DU GOLFE', client_adresse: 'Rue du Commerce, Lomé',
    client_contact: '+228 90 11 22 33 / pharmagolfe@gmail.com', interlocuteur: 'Mme AKOSSIWA (Gérante)',
    options_reseaux: [],
    options_maintenance: ['Unité Centrale / PC Portable', 'Nettoyage physique / Pâte thermique', 'Sauvegarde & Transfert de données'],
    marque_modele: 'HP ProDesk 400 G6', num_serie: 'CZC1234ABC', systeme_exploitation: 'Windows', vol_donnees: '250',
    test_continuite: '', ping: '', debit_desc: '', debit_mont: '',
    description_probleme: "Poste de caisse très lent au démarrage, surchauffe et extinctions inopinées en fin de journée.",
    travaux_realises: "Nettoyage complet, remplacement de la pâte thermique, sauvegarde des données de caisse (250 Go) et réinstallation du système. Disque dur vieillissant à remplacer prochainement.",
    materiels: [
      { designation: 'Pâte thermique Arctic MX-4', qte: '1', garantie: '' },
      { designation: 'Barrette RAM 8Go DDR4', qte: '1', garantie: '12' },
      { designation: 'Ventilateur boitier 120mm', qte: '1', garantie: '6' },
    ],
    statut_final: 'Partiellement résolu',
  },
  {
    // Fiche mixte A + D, textes longs (test des sauts de page), 6 matériels, non résolu
    date: `${annee}-06-18`, intervenant: 'Yao KPOTUFE', heure_arrivee: '09:00', heure_depart: '18:30',
    client_nom: 'UNIVERSITÉ DE LOMÉ', client_adresse: 'Boulevard Eyadéma, Lomé',
    client_contact: '+228 22 25 50 94 / rectorat@univ-lome.tg', interlocuteur: 'Dr KODJO (DSI)',
    options_reseaux: ['Wi-Fi / Faisceau Radio', 'Téléphonie (IP / PABX)', 'Brassage / Baie / Câblage'],
    options_maintenance: ['Serveur Physique / Rack', 'Imprimante / Scanner / Périphérique'],
    marque_modele: 'Dell PowerEdge R740', num_serie: 'SVCTAG-7XK9Q', systeme_exploitation: 'Linux', vol_donnees: '2000',
    test_continuite: 'Non conforme', ping: '210', debit_desc: '12', debit_mont: '3',
    description_probleme: "Panne générale du réseau Wi-Fi du campus nord suite à un orage. Le serveur de téléphonie IP ne répond plus, la baie de brassage du bâtiment C présente des traces de surtension. Les débits mesurés sur les liaisons restantes sont très dégradés et le ping vers la passerelle dépasse 200 ms. Plusieurs bornes Wi-Fi ne s'allument plus du tout et l'onduleur principal est en défaut. Les enseignants ne peuvent plus accéder à la plateforme de cours en ligne depuis les salles du campus nord.",
    travaux_realises: "Diagnostic complet de la chaîne réseau : contrôle des arrivées fibre, tests de continuité sur l'ensemble des liens cuivre du bâtiment C, vérification des alimentations. Remplacement de l'injecteur PoE principal et de deux bornes Wi-Fi détruites. Redémarrage et resynchronisation du PABX IP. Le commutateur cœur de réseau reste instable : un remplacement complet est nécessaire, le matériel de rechange a été commandé. Une nouvelle intervention est planifiée dès réception du commutateur pour rétablir l'ensemble des services.",
    materiels: [
      { designation: 'Borne Wi-Fi 6 plafonnier', qte: '2', garantie: '24' },
      { designation: 'Injecteur PoE+ 30W', qte: '1', garantie: '12' },
      { designation: 'Jarretière fibre LC-LC 3m', qte: '4', garantie: '12' },
      { designation: 'Parafoudre Ethernet', qte: '6', garantie: '12' },
      { designation: 'Bandeau de prises rackable', qte: '1', garantie: '6' },
      { designation: 'Batterie onduleur 12V 9Ah', qte: '2', garantie: '12' },
    ],
    statut_final: 'Non résolu',
  },
  {
    // Fiche minimale : imprimable vierge, à remplir à la main sur le terrain
    date: `${annee}-07-01`, intervenant: '', heure_arrivee: '', heure_depart: '',
    client_nom: 'HÔTEL SARAKAWA', client_adresse: '', client_contact: '', interlocuteur: '',
    options_reseaux: [], options_maintenance: [],
    marque_modele: '', num_serie: '', systeme_exploitation: '', vol_donnees: '',
    test_continuite: '', ping: '', debit_desc: '', debit_mont: '',
    description_probleme: '', travaux_realises: '',
    materiels: [],
    statut_final: '',
  },
  {
    // Fiche sauvegarde serveur (OS Autre, sans matériel, résolu)
    date: `${annee}-08-22`, intervenant: 'Kossi AMEGAN', heure_arrivee: '07:45', heure_depart: '10:00',
    client_nom: 'CLINIQUE BIASA', client_adresse: "Rue de l'OCAM, Lomé",
    client_contact: '+228 22 21 32 87 / accueil@biasa.tg', interlocuteur: 'M. LAWSON (Administrateur)',
    options_reseaux: [],
    options_maintenance: ['Serveur Physique / Rack', 'Sauvegarde & Transfert de données'],
    marque_modele: 'Synology DS920+', num_serie: 'SYN20AB123', systeme_exploitation: 'Autre', vol_donnees: '850',
    test_continuite: 'Conforme', ping: '2', debit_desc: '', debit_mont: '',
    description_probleme: 'Migration demandée des dossiers patients vers le nouveau NAS avec mise en place de sauvegardes automatiques.',
    travaux_realises: 'Transfert de 850 Go de données, configuration RAID 1, planification des sauvegardes quotidiennes à 22h et test de restauration validé avec le client.',
    materiels: [],
    statut_final: 'Résolu',
  },
];

const existeFit = db.prepare('SELECT 1 FROM interventions WHERE numero = ?');
let cptFit = db.prepare('SELECT COUNT(*) AS count FROM interventions').get().count || 0;
const insIntervention = db.prepare(`
  INSERT INTO interventions (numero, date, intervenant, heure_arrivee, heure_depart,
    client_nom, client_adresse, client_contact, interlocuteur,
    options_reseaux, options_maintenance, marque_modele, num_serie, systeme_exploitation, vol_donnees,
    test_continuite, ping, debit_desc, debit_mont, description_probleme, travaux_realises,
    materiels, statut_final)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
fiches.forEach((f) => {
  let numero;
  do {
    cptFit += 1;
    numero = `FIT-${String(cptFit).padStart(4, '0')}`;
  } while (existeFit.get(numero));
  insIntervention.run(
    numero, f.date, f.intervenant, f.heure_arrivee, f.heure_depart,
    f.client_nom, f.client_adresse, f.client_contact, f.interlocuteur,
    JSON.stringify(f.options_reseaux), JSON.stringify(f.options_maintenance),
    f.marque_modele, f.num_serie, f.systeme_exploitation, f.vol_donnees,
    f.test_continuite, f.ping, f.debit_desc, f.debit_mont,
    f.description_probleme, f.travaux_realises,
    JSON.stringify(f.materiels), f.statut_final
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
  facturesCreees.push({ id: factureId, numero, clientId: p.clientId, lignes: p.lignes });
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

db.close();
console.log('\nDonnées de test insérées avec succès dans', dbPath);
