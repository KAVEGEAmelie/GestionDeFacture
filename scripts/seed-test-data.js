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
