const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const Database = require('better-sqlite3');

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
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (client_id) REFERENCES clients(id)
    );

    CREATE TABLE IF NOT EXISTS proforma_lignes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      proforma_id INTEGER NOT NULL,
      produit_id INTEGER NOT NULL,
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
      produit_id INTEGER NOT NULL,
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
  `);

  // Insertion des paramètres par défaut (informations de l'entreprise)
  const checkParams = db.prepare('SELECT COUNT(*) as count FROM parametres').get();
  if (checkParams.count === 0) {
    const insertParam = db.prepare('INSERT INTO parametres (cle, valeur) VALUES (?, ?)');
    insertParam.run('entreprise_nom', 'In-Tel Services');
    insertParam.run('entreprise_rccm', 'TG-LOM 2013 A 6170');
    insertParam.run('entreprise_nif', '1000278436');
    insertParam.run('entreprise_tel', '+228 22 51 66 86');
    insertParam.run('entreprise_cel', '90 11 66 86');
    insertParam.run('entreprise_adresse', '04BP144 LOME ADIDOGOME-TOGO');
    insertParam.run('entreprise_email', 'infos_its@gmail.com');
    insertParam.run('entreprise_utb', '010350245170210119');
    insertParam.run('tva_taux', '18');
    insertParam.run('proforma_compteur', '5');
    insertParam.run('facture_compteur', '17');
    insertParam.run('bordereau_compteur', '4');
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
    INSERT INTO clients (nom, adresse, telephone, email, nif)
    VALUES (?, ?, ?, ?, ?)
  `);
  const result = stmt.run(client.nom, client.adresse, client.telephone, client.email, client.nif);
  return { id: result.lastInsertRowid };
});

ipcMain.handle('clients:update', (event, id, client) => {
  const stmt = db.prepare(`
    UPDATE clients 
    SET nom = ?, adresse = ?, telephone = ?, email = ?, nif = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);
  stmt.run(client.nom, client.adresse, client.telephone, client.email, client.nif, id);
  return { success: true };
});

ipcMain.handle('clients:delete', (event, id) => {
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
  const stmt = db.prepare('DELETE FROM produits WHERE id = ?');
  stmt.run(id);
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
  const stmt = db.prepare('UPDATE parametres SET valeur = ? WHERE cle = ?');
  stmt.run(valeur, cle);
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
    SELECT p.*, c.nom as client_nom, c.adresse as client_adresse
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
    // Générer le numéro
    const params = db.prepare('SELECT valeur FROM parametres WHERE cle = ?').get('proforma_compteur');
    const compteur = parseInt(params.valeur) + 1;
    const numero = `2025/${compteur.toString().padStart(5, '0')}-ITS`;
    
    // Créer la proforma
    const stmt = db.prepare(`
      INSERT INTO proformas (numero, date, client_id, objet, total_materiel_ht, prestations, remise, total_ht, tva, total_ttc, statut)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      'en_attente'
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
        ligne.produit_id,
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

ipcMain.handle('proformas:delete', (event, id) => {
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
    SELECT f.*, c.nom as client_nom, c.adresse as client_adresse
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

ipcMain.handle('factures:createFromProforma', (event, proformaId) => {
  const transaction = db.transaction((pId) => {
    // Récupérer la proforma
    const proforma = db.prepare('SELECT * FROM proformas WHERE id = ?').get(pId);
    const lignes = db.prepare('SELECT * FROM proforma_lignes WHERE proforma_id = ?').all(pId);
    
    // Générer le numéro de facture
    const params = db.prepare('SELECT valeur FROM parametres WHERE cle = ?').get('facture_compteur');
    const compteur = parseInt(params.valeur) + 1;
    const numero = `2025/${compteur.toString().padStart(5, '0')}-ITS`;
    
    // Créer la facture
    const stmt = db.prepare(`
      INSERT INTO factures (numero, date, client_id, objet, total_materiel_ht, prestations, remise, total_ht, tva, total_ttc, proforma_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      numero,
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
    
    const factureId = result.lastInsertRowid;
    
    // Insérer les lignes
    const stmtLigne = db.prepare(`
      INSERT INTO facture_lignes (facture_id, produit_id, designation, unite, quantite, prix_unitaire, montant, ordre)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    lignes.forEach((ligne, index) => {
      stmtLigne.run(
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
    
    // Mettre à jour le statut de la proforma
    db.prepare('UPDATE proformas SET statut = ?, facture_id = ? WHERE id = ?').run('facturee', factureId, pId);
    
    // Mettre à jour le compteur
    db.prepare('UPDATE parametres SET valeur = ? WHERE cle = ?').run(compteur.toString(), 'facture_compteur');
    
    return { id: factureId, numero };
  });
  
  return transaction(proformaId);
});

ipcMain.handle('factures:delete', (event, id) => {
  const stmt = db.prepare('DELETE FROM factures WHERE id = ?');
  stmt.run(id);
  return { success: true };
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
    SELECT b.*, c.nom as client_nom, c.adresse as client_adresse
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
    
    // Générer le numéro de bordereau
    const params = db.prepare('SELECT valeur FROM parametres WHERE cle = ?').get('bordereau_compteur');
    const compteur = parseInt(params.valeur) + 1;
    const numero = `2025/${compteur.toString().padStart(5, '0')}-ITS`;
    
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

ipcMain.handle('bordereaux:delete', (event, id) => {
  const stmt = db.prepare('DELETE FROM bordereaux WHERE id = ?');
  stmt.run(id);
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
