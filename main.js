const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const Database = require('better-sqlite3');

// Désactive l'accélération matérielle (évite que la fenêtre reste invisible
// sur certaines configurations GPU sous Linux)
app.disableHardwareAcceleration();

let mainWindow;
let db;

// Initialisation de la base de données
function initDatabase() {
  const dbPath = path.join(app.getPath('userData'), 'facturation.db');
  db = new Database(dbPath);
  
  // Création des tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS clients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nom TEXT NOT NULL,
      adresse TEXT,
      telephone TEXT,
      email TEXT,
      nif TEXT,
      tva_applicable INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS produits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      designation TEXT NOT NULL,
      prix_unitaire REAL NOT NULL,
      unite TEXT DEFAULT 'Unité',
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS proformas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      numero TEXT UNIQUE NOT NULL,
      date DATE NOT NULL,
      client_id INTEGER NOT NULL,
      objet TEXT,
      total_materiel_ht REAL DEFAULT 0,
      prestations REAL DEFAULT 0,
      remise REAL DEFAULT 0,
      total_ht REAL NOT NULL,
      tva REAL NOT NULL,
      total_ttc REAL NOT NULL,
      statut TEXT DEFAULT 'en_attente',
      facture_id INTEGER,
      avec_cachet INTEGER DEFAULT 0,
      tva_applicable INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (client_id) REFERENCES clients(id)
    );

    CREATE TABLE IF NOT EXISTS proforma_lignes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      proforma_id INTEGER NOT NULL,
      produit_id INTEGER,
      designation TEXT NOT NULL,
      unite TEXT NOT NULL,
      quantite REAL NOT NULL,
      prix_unitaire REAL NOT NULL,
      montant REAL NOT NULL,
      ordre INTEGER DEFAULT 0,
      FOREIGN KEY (proforma_id) REFERENCES proformas(id) ON DELETE CASCADE,
      FOREIGN KEY (produit_id) REFERENCES produits(id)
    );

    CREATE TABLE IF NOT EXISTS factures (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      numero TEXT UNIQUE NOT NULL,
      date DATE NOT NULL,
      client_id INTEGER NOT NULL,
      objet TEXT,
      total_materiel_ht REAL DEFAULT 0,
      prestations REAL DEFAULT 0,
      remise REAL DEFAULT 0,
      total_ht REAL NOT NULL,
      tva REAL NOT NULL,
      total_ttc REAL NOT NULL,
      proforma_id INTEGER,
      bordereau_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (client_id) REFERENCES clients(id),
      FOREIGN KEY (proforma_id) REFERENCES proformas(id)
    );

    CREATE TABLE IF NOT EXISTS facture_lignes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      facture_id INTEGER NOT NULL,
      produit_id INTEGER,
      designation TEXT NOT NULL,
      unite TEXT NOT NULL,
      quantite REAL NOT NULL,
      prix_unitaire REAL NOT NULL,
      montant REAL NOT NULL,
      ordre INTEGER DEFAULT 0,
      FOREIGN KEY (facture_id) REFERENCES factures(id) ON DELETE CASCADE,
      FOREIGN KEY (produit_id) REFERENCES produits(id)
    );

    CREATE TABLE IF NOT EXISTS bordereaux (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      numero TEXT UNIQUE NOT NULL,
      date DATE NOT NULL,
      client_id INTEGER NOT NULL,
      facture_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (client_id) REFERENCES clients(id),
      FOREIGN KEY (facture_id) REFERENCES factures(id)
    );

    CREATE TABLE IF NOT EXISTS bordereau_lignes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bordereau_id INTEGER NOT NULL,
      designation TEXT NOT NULL,
      quantite REAL NOT NULL,
      ordre INTEGER DEFAULT 0,
      FOREIGN KEY (bordereau_id) REFERENCES bordereaux(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS parametres (
      cle TEXT PRIMARY KEY,
      valeur TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS securite (
      cle TEXT PRIMARY KEY,
      valeur TEXT
    );

    CREATE TABLE IF NOT EXISTS rapports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      numero TEXT UNIQUE NOT NULL,
      date DATE NOT NULL,
      titre TEXT NOT NULL,
      client_id INTEGER REFERENCES clients(id),
      client_nom TEXT,
      lieu TEXT,
      objet TEXT,
      sections TEXT,
      avec_cachet INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Migration : ajout des colonnes de suivi du paiement et de la TVA
  // sur les factures existantes (sans perdre les données).
  const factureCols = db.prepare("PRAGMA table_info(factures)").all().map((c) => c.name);
  if (!factureCols.includes('statut_paiement')) {
    db.exec("ALTER TABLE factures ADD COLUMN statut_paiement TEXT DEFAULT 'non_payee'");
  }
  if (!factureCols.includes('date_paiement')) {
    db.exec("ALTER TABLE factures ADD COLUMN date_paiement DATE");
  }
  if (!factureCols.includes('tva_versee')) {
    db.exec("ALTER TABLE factures ADD COLUMN tva_versee INTEGER DEFAULT 0");
  }
  if (!factureCols.includes('date_versement_tva')) {
    db.exec("ALTER TABLE factures ADD COLUMN date_versement_tva DATE");
  }

  // Migration : choix d'ajouter le cachet + signature sur la proforma.
  const proformaCols = db.prepare("PRAGMA table_info(proformas)").all().map((c) => c.name);
  if (!proformaCols.includes('avec_cachet')) {
    db.exec("ALTER TABLE proformas ADD COLUMN avec_cachet INTEGER DEFAULT 0");
  }
  // Migration : choix d'appliquer la TVA sur la proforma (et donc la facture).
  if (!proformaCols.includes('tva_applicable')) {
    db.exec("ALTER TABLE proformas ADD COLUMN tva_applicable INTEGER DEFAULT 1");
  }

  // Migration : rendre produit_id nullable sur les lignes (permet la saisie
  // libre d'une désignation sans produit du catalogue). SQLite ne permet pas
  // de retirer une contrainte NOT NULL via ALTER : on reconstruit la table.
  const rendreProduitIdNullable = (table) => {
    const info = db.prepare(`PRAGMA table_info(${table})`).all();
    const colProduit = info.find((c) => c.name === 'produit_id');
    if (!colProduit || colProduit.notnull !== 1) return; // déjà nullable ou absente
    const cols = info.map((c) => c.name).join(', ');
    db.pragma('foreign_keys = OFF');
    const migrer = db.transaction(() => {
      db.exec(`ALTER TABLE ${table} RENAME TO ${table}_old`);
      if (table === 'proforma_lignes') {
        db.exec(`
          CREATE TABLE proforma_lignes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            proforma_id INTEGER NOT NULL,
            produit_id INTEGER,
            designation TEXT NOT NULL,
            unite TEXT NOT NULL,
            quantite REAL NOT NULL,
            prix_unitaire REAL NOT NULL,
            montant REAL NOT NULL,
            ordre INTEGER DEFAULT 0,
            FOREIGN KEY (proforma_id) REFERENCES proformas(id) ON DELETE CASCADE,
            FOREIGN KEY (produit_id) REFERENCES produits(id)
          )
        `);
      } else {
        db.exec(`
          CREATE TABLE facture_lignes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            facture_id INTEGER NOT NULL,
            produit_id INTEGER,
            designation TEXT NOT NULL,
            unite TEXT NOT NULL,
            quantite REAL NOT NULL,
            prix_unitaire REAL NOT NULL,
            montant REAL NOT NULL,
            ordre INTEGER DEFAULT 0,
            FOREIGN KEY (facture_id) REFERENCES factures(id) ON DELETE CASCADE,
            FOREIGN KEY (produit_id) REFERENCES produits(id)
          )
        `);
      }
      db.exec(`INSERT INTO ${table} (${cols}) SELECT ${cols} FROM ${table}_old`);
      db.exec(`DROP TABLE ${table}_old`);
    });
    migrer();
    db.pragma('foreign_keys = ON');
  };
  rendreProduitIdNullable('proforma_lignes');
  rendreProduitIdNullable('facture_lignes');

  // Insertion des paramètres par défaut (informations de l'entreprise)
  const clientCols = db.prepare("PRAGMA table_info(clients)").all().map((c) => c.name);
  if (!clientCols.includes('tva_applicable')) {
    db.exec("ALTER TABLE clients ADD COLUMN tva_applicable INTEGER DEFAULT 1");
  }

  // Migration : lier un rapport technique à un client enregistré.
  const rapportCols = db.prepare("PRAGMA table_info(rapports)").all().map((c) => c.name);
  if (!rapportCols.includes('client_id')) {
    db.exec("ALTER TABLE rapports ADD COLUMN client_id INTEGER REFERENCES clients(id)");
  }
  const checkParams = db.prepare('SELECT COUNT(*) as count FROM parametres').get();
  if (checkParams.count === 0) {
    const insertParam = db.prepare('INSERT INTO parametres (cle, valeur) VALUES (?, ?)');
    insertParam.run('entreprise_nom', 'IN-TEL SERVICES');
    insertParam.run('entreprise_slogan1', 'Solutions Réseaux • Télécommunications');
    insertParam.run('entreprise_slogan2', 'Sécurité Électronique • Énergie');
    insertParam.run('entreprise_rccm', 'TG-LOM 2013 A 6170');
    insertParam.run('entreprise_nif', '1000278436');
    insertParam.run('entreprise_tel', '+228 22 51 66 86');
    insertParam.run('entreprise_cel', '90 11 66 86');
    insertParam.run('entreprise_adresse', '04BP144 LOME ADIDOGOME-TOGO');
    insertParam.run('entreprise_email', 'infos_its@gmail.com');
    insertParam.run('entreprise_utb', '010350245170210119');
    insertParam.run('entreprise_slogan_pied1', 'Votre partenaire en réseaux informatiques,');
    insertParam.run('entreprise_slogan_pied2', 'télécommunications et sécurité électronique.');
    insertParam.run('application_sous_titre', 'Gestion Facturation');
    insertParam.run('entreprise_logo', '');
    insertParam.run('signataire_titre', 'Le Directeur,');
    insertParam.run('signataire_nom', 'Koffi KAVEGE');
    insertParam.run('tva_taux', '18');
    insertParam.run('proforma_compteur', '5');
    insertParam.run('facture_compteur', '17');
    insertParam.run('bordereau_compteur', '4');
  }

  // Ajoute les paramètres manquants pour les bases déjà existantes
  // (ex. slogans ajoutés après coup), sans écraser les valeurs saisies.
  const ensureParam = db.prepare('INSERT OR IGNORE INTO parametres (cle, valeur) VALUES (?, ?)');
  ensureParam.run('entreprise_slogan1', 'Solutions Réseaux • Télécommunications');
  ensureParam.run('entreprise_slogan2', 'Sécurité Électronique • Énergie');
  ensureParam.run('entreprise_slogan_pied1', 'Votre partenaire en réseaux informatiques,');
  ensureParam.run('entreprise_slogan_pied2', 'télécommunications et sécurité électronique.');
  ensureParam.run('application_sous_titre', 'Gestion Facturation');
  ensureParam.run('entreprise_logo', '');
  ensureParam.run('signataire_titre', 'Le Directeur,');
  ensureParam.run('signataire_nom', 'Koffi KAVEGE');
  // Compteur des rapports techniques (créé pour les bases existantes aussi)
  ensureParam.run('rapport_compteur', '0');

  // Valeurs de sécurité par défaut (mot de passe désactivé au départ)
  const checkSecu = db.prepare('SELECT COUNT(*) as count FROM securite').get();
  if (checkSecu.count === 0) {
    const insertSecu = db.prepare('INSERT INTO securite (cle, valeur) VALUES (?, ?)');
    insertSecu.run('enabled', '0');
    insertSecu.run('hash', '');
    insertSecu.run('salt', '');
  }

  console.log('Base de données initialisée:', dbPath);
}

// Fonction pour attendre que le serveur React soit prêt
async function waitForReact(url, maxRetries = 30) {
  const http = require('http');
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      await new Promise((resolve, reject) => {
        http.get(url, (res) => {
          if (res.statusCode === 200) {
            resolve();
          } else {
            reject();
          }
        }).on('error', reject);
      });
      return true;
    } catch (e) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  return false;
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, 'src/assets/logo.png')
  });

  // En développement, charge depuis le serveur React
  // En production, charge depuis les fichiers buildés
  const startUrl = process.env.ELECTRON_START_URL || `file://${path.join(__dirname, 'build/index.html')}`;
  
  // En développement, attendre que React soit prêt
  if (process.env.ELECTRON_START_URL) {
    console.log('Attente du serveur React...');
    const ready = await waitForReact(startUrl);
    if (ready) {
      console.log('Serveur React prêt !');
    } else {
      console.log('Timeout - chargement quand même...');
    }
  }
  
  mainWindow.loadURL(startUrl);

  // Ouvre les DevTools en mode développement
  if (process.env.ELECTRON_START_URL) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  initDatabase();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    db.close();
    app.quit();
  }
});

// ===== Sécurité : hachage du mot de passe (scrypt + sel) =====

function hashPassword(password, salt) {
  // scrypt : dérivation lente et salée, adaptée au stockage de mots de passe
  return crypto.scryptSync(String(password), salt, 64).toString('hex');
}

function getSecurite() {
  const rows = db.prepare('SELECT cle, valeur FROM securite').all();
  return rows.reduce((acc, r) => {
    acc[r.cle] = r.valeur;
    return acc;
  }, {});
}

function setSecurite(cle, valeur) {
  const exists = db.prepare('SELECT 1 FROM securite WHERE cle = ?').get(cle);
  if (exists) {
    db.prepare('UPDATE securite SET valeur = ? WHERE cle = ?').run(valeur, cle);
  } else {
    db.prepare('INSERT INTO securite (cle, valeur) VALUES (?, ?)').run(cle, valeur);
  }
}

// ===== Numérotation des documents =====
// Génère un numéro libre à partir du compteur stocké : part de (compteur + 1)
// et saute automatiquement tout numéro déjà utilisé dans la table donnée,
// afin d'éviter les conflits (ex. compteur remis à 0 alors que des numéros
// existent déjà). Renvoie le numéro formaté ET le compteur retenu.
function genererNumero(table, compteurCle, annee) {
  const row = db.prepare('SELECT valeur FROM parametres WHERE cle = ?').get(compteurCle);
  let compteur = parseInt(row && row.valeur, 10);
  if (Number.isNaN(compteur)) compteur = 0;

  const existeStmt = db.prepare(`SELECT 1 FROM ${table} WHERE numero = ?`);

  let numero;
  do {
    compteur += 1;
    numero = `${annee}/${compteur.toString().padStart(5, '0')}-ITS`;
  } while (existeStmt.get(numero));

  return { numero, compteur };
}

// ===== IPC Handlers pour les opérations de base de données =====

// CLIENTS
ipcMain.handle('clients:getAll', () => {
  return db.prepare('SELECT * FROM clients ORDER BY nom').all();
});

ipcMain.handle('clients:getById', (event, id) => {
  return db.prepare('SELECT * FROM clients WHERE id = ?').get(id);
});

ipcMain.handle('clients:create', (event, client) => {
  const stmt = db.prepare(`
    INSERT INTO clients (nom, adresse, telephone, email, nif, tva_applicable)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const result = stmt.run(
    client.nom,
    client.adresse,
    client.telephone,
    client.email,
    client.nif,
    client.tva_applicable ? 1 : 0
  );
  return { id: result.lastInsertRowid };
});

ipcMain.handle('clients:update', (event, id, client) => {
  const stmt = db.prepare(`
    UPDATE clients 
    SET nom = ?, adresse = ?, telephone = ?, email = ?, nif = ?, tva_applicable = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);
  stmt.run(
    client.nom,
    client.adresse,
    client.telephone,
    client.email,
    client.nif,
    client.tva_applicable ? 1 : 0,
    id
  );
  return { success: true };
});

ipcMain.handle('clients:delete', (event, id) => {
  const proformaCount = db.prepare('SELECT COUNT(*) as count FROM proformas WHERE client_id = ?').get(id).count;
  const factureCount = db.prepare('SELECT COUNT(*) as count FROM factures WHERE client_id = ?').get(id).count;
  if (proformaCount > 0 || factureCount > 0) {
    throw new Error('Impossible de supprimer ce client : il est rattaché à des proformas ou des factures.');
  }
  const stmt = db.prepare('DELETE FROM clients WHERE id = ?');
  stmt.run(id);
  return { success: true };
});

// PRODUITS
ipcMain.handle('produits:getAll', () => {
  return db.prepare('SELECT * FROM produits ORDER BY designation').all();
});

ipcMain.handle('produits:getById', (event, id) => {
  return db.prepare('SELECT * FROM produits WHERE id = ?').get(id);
});

ipcMain.handle('produits:create', (event, produit) => {
  const stmt = db.prepare(`
    INSERT INTO produits (designation, prix_unitaire, unite, description)
    VALUES (?, ?, ?, ?)
  `);
  const result = stmt.run(produit.designation, produit.prix_unitaire, produit.unite, produit.description);
  return { id: result.lastInsertRowid };
});

ipcMain.handle('produits:update', (event, id, produit) => {
  const stmt = db.prepare(`
    UPDATE produits 
    SET designation = ?, prix_unitaire = ?, unite = ?, description = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);
  stmt.run(produit.designation, produit.prix_unitaire, produit.unite, produit.description, id);
  return { success: true };
});

ipcMain.handle('produits:delete', (event, id) => {
  const inProformas = db.prepare('SELECT COUNT(*) as count FROM proforma_lignes WHERE produit_id = ?').get(id).count;
  const inFactures = db.prepare('SELECT COUNT(*) as count FROM facture_lignes WHERE produit_id = ?').get(id).count;
  if (inProformas > 0 || inFactures > 0) {
    throw new Error('Impossible de supprimer ce produit : il est utilisé dans des proformas ou des factures.');
  }
  const stmt = db.prepare('DELETE FROM produits WHERE id = ?');
  stmt.run(id);
  return { success: true };
});

// RAPPORTS TECHNIQUES
ipcMain.handle('rapports:getAll', () => {
  return db.prepare('SELECT * FROM rapports ORDER BY created_at DESC').all();
});

ipcMain.handle('rapports:getById', (event, id) => {
  const rapport = db.prepare('SELECT * FROM rapports WHERE id = ?').get(id);
  if (rapport) {
    try {
      rapport.sections = rapport.sections ? JSON.parse(rapport.sections) : [];
    } catch {
      rapport.sections = [];
    }
  }
  return rapport;
});

ipcMain.handle('rapports:create', (event, data) => {
  const annee = new Date(data.date || Date.now()).getFullYear();
  const { numero, compteur } = genererNumero('rapports', 'rapport_compteur', annee);

  // Si un client est lié, on récupère son nom pour l'historique (dénormalisé).
  let clientNom = data.client_nom || '';
  const clientId = data.client_id ? parseInt(data.client_id) : null;
  if (clientId) {
    const c = db.prepare('SELECT nom FROM clients WHERE id = ?').get(clientId);
    if (c) clientNom = c.nom;
  }

  const stmt = db.prepare(`
    INSERT INTO rapports (numero, date, titre, client_id, client_nom, lieu, objet, sections, avec_cachet)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const result = stmt.run(
    numero,
    data.date,
    data.titre,
    clientId,
    clientNom,
    data.lieu || '',
    data.objet || '',
    JSON.stringify(data.sections || []),
    data.avec_cachet ? 1 : 0
  );

  db.prepare('UPDATE parametres SET valeur = ? WHERE cle = ?').run(compteur.toString(), 'rapport_compteur');
  return { id: result.lastInsertRowid, numero };
});

ipcMain.handle('rapports:update', (event, id, data) => {
  let clientNom = data.client_nom || '';
  const clientId = data.client_id ? parseInt(data.client_id) : null;
  if (clientId) {
    const c = db.prepare('SELECT nom FROM clients WHERE id = ?').get(clientId);
    if (c) clientNom = c.nom;
  }

  db.prepare(`
    UPDATE rapports
    SET date = ?, titre = ?, client_id = ?, client_nom = ?, lieu = ?, objet = ?, sections = ?, avec_cachet = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    data.date,
    data.titre,
    clientId,
    clientNom,
    data.lieu || '',
    data.objet || '',
    JSON.stringify(data.sections || []),
    data.avec_cachet ? 1 : 0,
    id
  );
  return { success: true };
});

ipcMain.handle('rapports:delete', (event, id) => {
  db.prepare('DELETE FROM rapports WHERE id = ?').run(id);
  return { success: true };
});

// PARAMETRES
ipcMain.handle('parametres:getAll', () => {
  const params = db.prepare('SELECT * FROM parametres').all();
  return params.reduce((acc, p) => {
    acc[p.cle] = p.valeur;
    return acc;
  }, {});
});

ipcMain.handle('parametres:update', (event, cle, valeur) => {
  // Upsert : met à jour la clé, ou la crée si elle n'existe pas encore.
  // On force une chaîne (la colonne est NOT NULL) pour éviter toute erreur
  // si une valeur arrive à null/undefined.
  const val = valeur === null || valeur === undefined ? '' : String(valeur);
  const stmt = db.prepare(`
    INSERT INTO parametres (cle, valeur) VALUES (?, ?)
    ON CONFLICT(cle) DO UPDATE SET valeur = excluded.valeur
  `);
  stmt.run(cle, val);
  return { success: true };
});

// PROFORMAS
ipcMain.handle('proformas:getAll', () => {
  const proformas = db.prepare(`
    SELECT p.*, c.nom as client_nom 
    FROM proformas p
    LEFT JOIN clients c ON p.client_id = c.id
    ORDER BY p.created_at DESC
  `).all();
  return proformas;
});

ipcMain.handle('proformas:getById', (event, id) => {
  const proforma = db.prepare(`
    SELECT p.*, c.nom as client_nom, c.adresse as client_adresse,
           c.telephone as client_telephone, c.email as client_email, c.nif as client_nif
    FROM proformas p
    LEFT JOIN clients c ON p.client_id = c.id
    WHERE p.id = ?
  `).get(id);
  
  if (proforma) {
    const lignes = db.prepare(`
      SELECT * FROM proforma_lignes WHERE proforma_id = ? ORDER BY ordre
    `).all(id);
    proforma.lignes = lignes;
  }
  
  return proforma;
});

ipcMain.handle('proformas:create', (event, proforma) => {
  const transaction = db.transaction((data) => {
    // Générer le numéro (année basée sur la date du document),
    // en sautant les numéros déjà utilisés.
    const annee = new Date(data.date).getFullYear() || new Date().getFullYear();
    const { numero, compteur } = genererNumero('proformas', 'proforma_compteur', annee);
    
    // Créer la proforma
    const stmt = db.prepare(`
      INSERT INTO proformas (numero, date, client_id, objet, total_materiel_ht, prestations, remise, total_ht, tva, total_ttc, statut, avec_cachet, tva_applicable)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      numero,
      data.date,
      data.client_id,
      data.objet,
      data.total_materiel_ht || 0,
      data.prestations || 0,
      data.remise || 0,
      data.total_ht,
      data.tva,
      data.total_ttc,
      'en_attente',
      data.avec_cachet ? 1 : 0,
      data.tva_applicable === false ? 0 : 1
    );
    
    const proformaId = result.lastInsertRowid;
    
    // Insérer les lignes
    const stmtLigne = db.prepare(`
      INSERT INTO proforma_lignes (proforma_id, produit_id, designation, unite, quantite, prix_unitaire, montant, ordre)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    data.lignes.forEach((ligne, index) => {
      stmtLigne.run(
        proformaId,
        Number.isInteger(ligne.produit_id) ? ligne.produit_id : null,
        ligne.designation,
        ligne.unite,
        ligne.quantite,
        ligne.prix_unitaire,
        ligne.montant,
        index
      );
    });
    
    // Mettre à jour le compteur
    db.prepare('UPDATE parametres SET valeur = ? WHERE cle = ?').run(compteur.toString(), 'proforma_compteur');
    
    return { id: proformaId, numero };
  });
  
  return transaction(proforma);
});

ipcMain.handle('proformas:update', (event, id, data) => {
  const existing = db.prepare('SELECT statut, facture_id FROM proformas WHERE id = ?').get(id);
  if (!existing) {
    throw new Error('Proforma introuvable.');
  }
  if (existing.statut === 'facturee' || existing.facture_id) {
    throw new Error('Impossible de modifier cette proforma : elle a déjà été convertie en facture.');
  }

  const transaction = db.transaction((payload) => {
    db.prepare(`
      UPDATE proformas
      SET date = ?, client_id = ?, objet = ?, total_materiel_ht = ?, prestations = ?, remise = ?, total_ht = ?, tva = ?, total_ttc = ?, avec_cachet = ?, tva_applicable = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      payload.date,
      payload.client_id,
      payload.objet,
      payload.total_materiel_ht || 0,
      payload.prestations || 0,
      payload.remise || 0,
      payload.total_ht,
      payload.tva,
      payload.total_ttc,
      payload.avec_cachet ? 1 : 0,
      payload.tva_applicable === false ? 0 : 1,
      id
    );

    // Remplacer les lignes
    db.prepare('DELETE FROM proforma_lignes WHERE proforma_id = ?').run(id);
    const stmtLigne = db.prepare(`
      INSERT INTO proforma_lignes (proforma_id, produit_id, designation, unite, quantite, prix_unitaire, montant, ordre)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    payload.lignes.forEach((ligne, index) => {
      stmtLigne.run(
        id,
        Number.isInteger(ligne.produit_id) ? ligne.produit_id : null,
        ligne.designation,
        ligne.unite,
        ligne.quantite,
        ligne.prix_unitaire,
        ligne.montant,
        index
      );
    });

    return { id, success: true };
  });

  return transaction(data);
});

ipcMain.handle('proformas:delete', (event, id) => {
  const proforma = db.prepare('SELECT facture_id FROM proformas WHERE id = ?').get(id);
  if (proforma && proforma.facture_id) {
    throw new Error('Impossible de supprimer cette proforma : elle a déjà été convertie en facture.');
  }
  const stmt = db.prepare('DELETE FROM proformas WHERE id = ?');
  stmt.run(id);
  return { success: true };
});

// FACTURES
ipcMain.handle('factures:getAll', () => {
  const factures = db.prepare(`
    SELECT f.*, c.nom as client_nom 
    FROM factures f
    LEFT JOIN clients c ON f.client_id = c.id
    ORDER BY f.created_at DESC
  `).all();
  return factures;
});

ipcMain.handle('factures:getById', (event, id) => {
  const facture = db.prepare(`
    SELECT f.*, c.nom as client_nom, c.adresse as client_adresse,
           c.telephone as client_telephone, c.email as client_email, c.nif as client_nif
    FROM factures f
    LEFT JOIN clients c ON f.client_id = c.id
    WHERE f.id = ?
  `).get(id);
  
  if (facture) {
    const lignes = db.prepare(`
      SELECT * FROM facture_lignes WHERE facture_id = ? ORDER BY ordre
    `).all(id);
    facture.lignes = lignes;
  }
  
  return facture;
});

ipcMain.handle('factures:createFromProforma', (event, proformaId, dateFacture) => {
  const transaction = db.transaction((pId) => {
    // Récupérer la proforma
    const proforma = db.prepare('SELECT * FROM proformas WHERE id = ?').get(pId);
    const lignes = db.prepare('SELECT * FROM proforma_lignes WHERE proforma_id = ?').all(pId);
    
    // Générer le numéro de facture (année courante), en sautant les numéros déjà utilisés.
    const { numero, compteur } = genererNumero('factures', 'facture_compteur', new Date().getFullYear());
    
    // Date de la facture : celle choisie par l'utilisateur, sinon aujourd'hui.
    const dateValue = dateFacture || new Date().toISOString().split('T')[0];

    // Créer la facture
    const stmt = db.prepare(`
      INSERT INTO factures (numero, date, client_id, objet, total_materiel_ht, prestations, remise, total_ht, tva, total_ttc, proforma_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      numero,
      dateValue,
      proforma.client_id,
      proforma.objet,
      proforma.total_materiel_ht || 0,
      proforma.prestations || 0,
      proforma.remise || 0,
      proforma.total_ht,
      proforma.tva,
      proforma.total_ttc,
      pId
    );
    
    const factureId = result.lastInsertRowid;
    
    // Insérer les lignes
    const stmtLigne = db.prepare(`
      INSERT INTO facture_lignes (facture_id, produit_id, designation, unite, quantite, prix_unitaire, montant, ordre)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    lignes.forEach((ligne, index) => {
      stmtLigne.run(
        factureId,
        Number.isInteger(ligne.produit_id) ? ligne.produit_id : null,
        ligne.designation,
        ligne.unite,
        ligne.quantite,
        ligne.prix_unitaire,
        ligne.montant,
        index
      );
    });
    
    // Mettre à jour le statut de la proforma
    db.prepare('UPDATE proformas SET statut = ?, facture_id = ? WHERE id = ?').run('facturee', factureId, pId);
    
    // Mettre à jour le compteur
    db.prepare('UPDATE parametres SET valeur = ? WHERE cle = ?').run(compteur.toString(), 'facture_compteur');
    
    return { id: factureId, numero };
  });
  
  return transaction(proformaId);
});

ipcMain.handle('factures:delete', (event, id) => {
  const facture = db.prepare('SELECT bordereau_id, proforma_id FROM factures WHERE id = ?').get(id);
  if (facture && facture.bordereau_id) {
    throw new Error('Impossible de supprimer cette facture : un bordereau de livraison y est rattaché. Supprimez d\'abord le bordereau.');
  }
  const transaction = db.transaction((factureId) => {
    // Réinitialiser la proforma liée pour qu'elle puisse être reconvertie
    if (facture && facture.proforma_id) {
      db.prepare('UPDATE proformas SET statut = ?, facture_id = NULL WHERE id = ?').run('en_attente', facture.proforma_id);
    }
    db.prepare('DELETE FROM factures WHERE id = ?').run(factureId);
  });
  transaction(id);
  return { success: true };
});

// PAIEMENT DES FACTURES
ipcMain.handle('factures:markPaid', (event, id) => {
  const facture = db.prepare('SELECT statut_paiement FROM factures WHERE id = ?').get(id);
  if (!facture) {
    throw new Error('Facture introuvable.');
  }
  db.prepare(
    "UPDATE factures SET statut_paiement = 'payee', date_paiement = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
  ).run(new Date().toISOString().split('T')[0], id);
  return { success: true };
});

ipcMain.handle('factures:markUnpaid', (event, id) => {
  const facture = db.prepare('SELECT tva_versee FROM factures WHERE id = ?').get(id);
  if (!facture) {
    throw new Error('Facture introuvable.');
  }
  if (facture.tva_versee) {
    throw new Error('Impossible d\'annuler le paiement : la TVA de cette facture a déjà été versée à l\'OTR.');
  }
  db.prepare(
    "UPDATE factures SET statut_paiement = 'non_payee', date_paiement = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
  ).run(id);
  return { success: true };
});

// SUIVI DE LA TVA (OTR)
ipcMain.handle('tva:getStats', () => {
  const nonVersee = db.prepare(
    "SELECT COALESCE(SUM(tva), 0) as total, COUNT(*) as count FROM factures WHERE statut_paiement = 'payee' AND tva_versee = 0 AND tva > 0"
  ).get();
  const versee = db.prepare(
    "SELECT COALESCE(SUM(tva), 0) as total, COUNT(*) as count FROM factures WHERE tva_versee = 1 AND tva > 0"
  ).get();

  // Factures payées dont la TVA n'est pas encore versée
  const aVerser = db.prepare(`
    SELECT f.id, f.numero, f.date, f.date_paiement, f.tva, f.total_ttc, c.nom as client_nom
    FROM factures f
    LEFT JOIN clients c ON f.client_id = c.id
    WHERE f.statut_paiement = 'payee' AND f.tva_versee = 0 AND f.tva > 0
    ORDER BY f.date_paiement
  `).all();

  // Factures dont la TVA a été versée
  const verseesListe = db.prepare(`
    SELECT f.id, f.numero, f.date, f.date_versement_tva, f.tva, f.total_ttc, c.nom as client_nom
    FROM factures f
    LEFT JOIN clients c ON f.client_id = c.id
    WHERE f.tva_versee = 1 AND f.tva > 0
    ORDER BY f.date_versement_tva DESC
  `).all();

  return {
    tvaNonVersee: nonVersee.total,
    nbNonVersee: nonVersee.count,
    tvaVersee: versee.total,
    nbVersee: versee.count,
    aVerser,
    versees: verseesListe
  };
});

ipcMain.handle('tva:verser', (event, ids) => {
  if (!Array.isArray(ids) || ids.length === 0) {
    throw new Error('Aucune facture sélectionnée.');
  }
  const dateVersement = new Date().toISOString().split('T')[0];
  const transaction = db.transaction((factureIds) => {
    const stmt = db.prepare(
      "UPDATE factures SET tva_versee = 1, date_versement_tva = ? WHERE id = ? AND statut_paiement = 'payee' AND tva_versee = 0"
    );
    let count = 0;
    factureIds.forEach((id) => {
      const res = stmt.run(dateVersement, id);
      count += res.changes;
    });
    return count;
  });
  const count = transaction(ids);
  return { success: true, count };
});

// BORDEREAUX
ipcMain.handle('bordereaux:getAll', () => {
  const bordereaux = db.prepare(`
    SELECT b.*, c.nom as client_nom 
    FROM bordereaux b
    LEFT JOIN clients c ON b.client_id = c.id
    ORDER BY b.created_at DESC
  `).all();
  return bordereaux;
});

ipcMain.handle('bordereaux:getById', (event, id) => {
  const bordereau = db.prepare(`
    SELECT b.*, c.nom as client_nom, c.adresse as client_adresse,
           c.telephone as client_telephone, c.email as client_email, c.nif as client_nif
    FROM bordereaux b
    LEFT JOIN clients c ON b.client_id = c.id
    WHERE b.id = ?
  `).get(id);
  
  if (bordereau) {
    const lignes = db.prepare(`
      SELECT * FROM bordereau_lignes WHERE bordereau_id = ? ORDER BY ordre
    `).all(id);
    bordereau.lignes = lignes;
  }
  
  return bordereau;
});

ipcMain.handle('bordereaux:createFromFacture', (event, factureId) => {
  const transaction = db.transaction((fId) => {
    // Récupérer la facture
    const facture = db.prepare('SELECT * FROM factures WHERE id = ?').get(fId);
    const lignes = db.prepare('SELECT * FROM facture_lignes WHERE facture_id = ?').all(fId);
    
    // Générer le numéro de bordereau (année courante), en sautant les numéros déjà utilisés.
    const { numero, compteur } = genererNumero('bordereaux', 'bordereau_compteur', new Date().getFullYear());
    
    // Créer le bordereau
    const stmt = db.prepare(`
      INSERT INTO bordereaux (numero, date, client_id, facture_id)
      VALUES (?, ?, ?, ?)
    `);
    const result = stmt.run(
      numero,
      new Date().toISOString().split('T')[0],
      facture.client_id,
      fId
    );
    
    const bordereauId = result.lastInsertRowid;
    
    // Insérer les lignes
    const stmtLigne = db.prepare(`
      INSERT INTO bordereau_lignes (bordereau_id, designation, quantite, ordre)
      VALUES (?, ?, ?, ?)
    `);
    
    lignes.forEach((ligne, index) => {
      stmtLigne.run(
        bordereauId,
        ligne.designation,
        ligne.quantite,
        index
      );
    });
    
    // Mettre à jour la facture
    db.prepare('UPDATE factures SET bordereau_id = ? WHERE id = ?').run(bordereauId, fId);
    
    // Mettre à jour le compteur
    db.prepare('UPDATE parametres SET valeur = ? WHERE cle = ?').run(compteur.toString(), 'bordereau_compteur');
    
    return { id: bordereauId, numero };
  });
  
  return transaction(factureId);
});

ipcMain.handle('bordereaux:createFromProforma', (event, proformaId, createFacture) => {
  const transaction = db.transaction((pId, withFacture) => {
    const proforma = db.prepare('SELECT * FROM proformas WHERE id = ?').get(pId);
    if (!proforma) {
      throw new Error('Proforma introuvable.');
    }

    let factureResult = null;
    if (withFacture) {
      const { numero: factureNumero, compteur: factureCompteur } = genererNumero('factures', 'facture_compteur', new Date().getFullYear());
      const factureStmt = db.prepare(`
        INSERT INTO factures (numero, date, client_id, objet, total_materiel_ht, prestations, remise, total_ht, tva, total_ttc, proforma_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const factureInsert = factureStmt.run(
        factureNumero,
        new Date().toISOString().split('T')[0],
        proforma.client_id,
        proforma.objet,
        proforma.total_materiel_ht || 0,
        proforma.prestations || 0,
        proforma.remise || 0,
        proforma.total_ht,
        proforma.tva,
        proforma.total_ttc,
        pId
      );
      const factureId = factureInsert.lastInsertRowid;

      const factureLignes = db.prepare('SELECT * FROM proforma_lignes WHERE proforma_id = ?').all(pId);
      const factLigneStmt = db.prepare(`
        INSERT INTO facture_lignes (facture_id, produit_id, designation, unite, quantite, prix_unitaire, montant, ordre)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      factureLignes.forEach((ligne, index) => {
        factLigneStmt.run(
          factureId,
          ligne.produit_id,
          ligne.designation,
          ligne.unite,
          ligne.quantite,
          ligne.prix_unitaire,
          ligne.montant,
          index
        );
      });

      db.prepare('UPDATE proformas SET statut = ?, facture_id = ? WHERE id = ?').run('facturee', factureId, pId);
      db.prepare('UPDATE parametres SET valeur = ? WHERE cle = ?').run(factureCompteur.toString(), 'facture_compteur');
      factureResult = { id: factureId, numero: factureNumero };
    }

    const { numero: bordereauNumero, compteur: bordereauCompteur } = genererNumero('bordereaux', 'bordereau_compteur', new Date().getFullYear());
    const bordereauStmt = db.prepare(`
      INSERT INTO bordereaux (numero, date, client_id, facture_id)
      VALUES (?, ?, ?, ?)
    `);
    const bordereauInsert = bordereauStmt.run(
      bordereauNumero,
      new Date().toISOString().split('T')[0],
      proforma.client_id,
      factureResult ? factureResult.id : null
    );
    const bordereauId = bordereauInsert.lastInsertRowid;

    const bordereauLigneStmt = db.prepare(`
      INSERT INTO bordereau_lignes (bordereau_id, designation, quantite, ordre)
      VALUES (?, ?, ?, ?)
    `);
    const proformaLignes = db.prepare('SELECT * FROM proforma_lignes WHERE proforma_id = ?').all(pId);
    proformaLignes.forEach((ligne, index) => {
      bordereauLigneStmt.run(
        bordereauId,
        ligne.designation,
        ligne.quantite,
        index
      );
    });

    if (factureResult) {
      db.prepare('UPDATE factures SET bordereau_id = ? WHERE id = ?').run(bordereauId, factureResult.id);
    }

    db.prepare('UPDATE parametres SET valeur = ? WHERE cle = ?').run(bordereauCompteur.toString(), 'bordereau_compteur');

    return {
      bordereauId,
      bordereauNumero,
      factureId: factureResult ? factureResult.id : null,
      factureNumero: factureResult ? factureResult.numero : null
    };
  });

  return transaction(proformaId, createFacture);
});

ipcMain.handle('bordereaux:delete', (event, id) => {
  const bordereau = db.prepare('SELECT facture_id FROM bordereaux WHERE id = ?').get(id);
  const transaction = db.transaction((bordereauId) => {
    // Détacher le bordereau de sa facture
    if (bordereau && bordereau.facture_id) {
      db.prepare('UPDATE factures SET bordereau_id = NULL WHERE id = ?').run(bordereau.facture_id);
    }
    db.prepare('DELETE FROM bordereaux WHERE id = ?').run(bordereauId);
  });
  transaction(id);
  return { success: true };
});

// STATISTIQUES
ipcMain.handle('stats:getCounts', () => {
  const clients = db.prepare('SELECT COUNT(*) as count FROM clients').get();
  const produits = db.prepare('SELECT COUNT(*) as count FROM produits').get();
  const proformas = db.prepare('SELECT COUNT(*) as count FROM proformas').get();
  const factures = db.prepare('SELECT COUNT(*) as count FROM factures').get();
  
  return {
    clients: clients.count,
    produits: produits.count,
    proformas: proformas.count,
    factures: factures.count
  };
});

ipcMain.handle('stats:getDashboard', () => {
  const annee = new Date().getFullYear();

  const caTotal = db.prepare('SELECT COALESCE(SUM(total_ttc), 0) as total FROM factures').get().total;
  const caAnnee = db.prepare(
    "SELECT COALESCE(SUM(total_ttc), 0) as total FROM factures WHERE strftime('%Y', date) = ?"
  ).get(String(annee)).total;
  const proformasEnAttente = db.prepare(
    "SELECT COUNT(*) as count FROM proformas WHERE statut = 'en_attente'"
  ).get().count;

  // Chiffre d'affaires par mois pour l'année courante
  const rows = db.prepare(
    "SELECT strftime('%m', date) as mois, COALESCE(SUM(total_ttc), 0) as total FROM factures WHERE strftime('%Y', date) = ? GROUP BY mois"
  ).all(String(annee));
  const caParMois = Array(12).fill(0);
  rows.forEach((r) => {
    const idx = parseInt(r.mois, 10) - 1;
    if (idx >= 0 && idx < 12) caParMois[idx] = r.total;
  });

  // Top 5 clients par chiffre d'affaires
  const topClients = db.prepare(`
    SELECT c.nom as nom, COALESCE(SUM(f.total_ttc), 0) as total
    FROM factures f
    LEFT JOIN clients c ON f.client_id = c.id
    GROUP BY f.client_id
    ORDER BY total DESC
    LIMIT 5
  `).all();

  return { caTotal, caAnnee, proformasEnAttente, caParMois, topClients, annee };
});


// ===== SAUVEGARDE / RESTAURATION DE LA BASE =====

ipcMain.handle('database:backup', async () => {
  const defaultName = `sauvegarde-facturation-${new Date().toISOString().split('T')[0]}.db`;
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    title: 'Enregistrer la sauvegarde',
    defaultPath: defaultName,
    filters: [{ name: 'Base de données', extensions: ['db'] }]
  });

  if (canceled || !filePath) {
    return { success: false, canceled: true };
  }

  await db.backup(filePath);
  return { success: true, path: filePath };
});

ipcMain.handle('database:restore', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    title: 'Choisir une sauvegarde à restaurer',
    properties: ['openFile'],
    filters: [{ name: 'Base de données', extensions: ['db'] }]
  });

  if (canceled || !filePaths || filePaths.length === 0) {
    return { success: false, canceled: true };
  }

  const source = filePaths[0];

  // Vérifier que le fichier est une base SQLite valide avant de remplacer
  try {
    const test = new Database(source, { readonly: true });
    test.prepare('SELECT COUNT(*) FROM parametres').get();
    test.close();
  } catch (e) {
    throw new Error('Le fichier sélectionné n\'est pas une sauvegarde valide.');
  }

  const dbPath = path.join(app.getPath('userData'), 'facturation.db');

  // Fermer la base courante, remplacer le fichier puis rouvrir
  db.close();
  fs.copyFileSync(source, dbPath);
  db = new Database(dbPath);

  return { success: true };
});

// ===== SECURITE (mot de passe de l'application) =====

// Renvoie l'état : le mot de passe est-il activé ?
ipcMain.handle('security:getStatus', () => {
  const s = getSecurite();
  return {
    enabled: s.enabled === '1',
    hasPassword: !!(s.hash && s.salt)
  };
});

// Définit (ou redéfinit) le mot de passe et active la protection.
// Si un mot de passe existe déjà, l'ancien doit être fourni et correct.
ipcMain.handle('security:setPassword', (event, { currentPassword, newPassword }) => {
  if (!newPassword || String(newPassword).length < 4) {
    throw new Error('Le mot de passe doit contenir au moins 4 caractères.');
  }

  const s = getSecurite();
  const hasPassword = !!(s.hash && s.salt);

  // Vérifier l'ancien mot de passe si un mot de passe est déjà défini
  if (hasPassword) {
    if (!currentPassword) {
      throw new Error('Veuillez saisir le mot de passe actuel.');
    }
    const currentHash = hashPassword(currentPassword, s.salt);
    if (currentHash !== s.hash) {
      throw new Error('Le mot de passe actuel est incorrect.');
    }
  }

  const salt = crypto.randomBytes(16).toString('hex');
  const hash = hashPassword(newPassword, salt);

  setSecurite('salt', salt);
  setSecurite('hash', hash);
  setSecurite('enabled', '1');

  return { success: true };
});

// Vérifie un mot de passe (écran de verrouillage).
ipcMain.handle('security:verify', (event, password) => {
  const s = getSecurite();
  if (!(s.hash && s.salt)) {
    return { success: true }; // pas de mot de passe défini
  }
  const hash = hashPassword(password, s.salt);
  if (hash !== s.hash) {
    throw new Error('Mot de passe incorrect.');
  }
  return { success: true };
});

// Désactive (et supprime) le mot de passe après vérification.
ipcMain.handle('security:disable', (event, currentPassword) => {
  const s = getSecurite();
  const hasPassword = !!(s.hash && s.salt);

  if (hasPassword) {
    if (!currentPassword) {
      throw new Error('Veuillez saisir le mot de passe actuel.');
    }
    const currentHash = hashPassword(currentPassword, s.salt);
    if (currentHash !== s.hash) {
      throw new Error('Le mot de passe actuel est incorrect.');
    }
  }

  setSecurite('enabled', '0');
  setSecurite('hash', '');
  setSecurite('salt', '');

  return { success: true };
});

