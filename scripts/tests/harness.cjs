const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const { createRequire } = require('module');
const root = process.cwd();
const req = createRequire(path.join(root, 'package.json'));
const Database = req('better-sqlite3');
const base = fs.mkdtempSync(path.join(os.tmpdir(), 'gestion-facturation-tests-'));
function createApp(options = {}) {
  const dir = fs.mkdtempSync(path.join(base, 'case-'));
  const documents = path.join(dir, 'documents');
  fs.mkdirSync(documents);
  const dbPath = path.join(dir, 'facturation.db');
  if (options.beforeInit) {
    const d = new Database(dbPath); options.beforeInit(d); d.close();
  }
  const handlers = new Map();
  const dialogs = { save: { canceled: true }, open: { canceled: true } };
  const app = {
    disableHardwareAcceleration() {}, getPath: name => name === 'documents' ? documents : dir,
    getVersion: () => req('./package.json').version,
    whenReady: () => ({ then() {} }), on() {}, quit() {}
  };
  const electron = { app, BrowserWindow: function () {},
    ipcMain: { handle: (channel, handler) => handlers.set(channel, handler) },
    dialog: { showSaveDialog: async () => dialogs.save, showOpenDialog: async () => dialogs.open }
  };
  const context = vm.createContext({
    require: name => name === 'electron' ? electron : name === './license/license' ? {}
      : name === 'fs' ? { ...fs, ...options.fs } : req(name),
    __dirname: root, process, Buffer, setTimeout, clearTimeout, console: { log() {}, error() {} }
  });
  vm.runInContext(fs.readFileSync(path.join(root, 'main.js'), 'utf8') + '\n globalThis.testAccess = { initDatabase, migrateDatabase, autoBackupDatabase, getDb: () => db };', context);
  let api;
  vm.runInNewContext(fs.readFileSync(path.join(root, 'preload.js'), 'utf8'), {
    require: () => ({ contextBridge: { exposeInMainWorld: (name, value) => { api = value; } },
      ipcRenderer: { invoke: (channel, ...args) => Promise.resolve().then(() => handlers.get(channel)({}, ...args)) } })
  });
  const access = context.testAccess;
  try { access.initDatabase(); } catch(e) { try {access.getDb().close();} catch {} throw e; }
  return { dir, documents, dbPath, api, dialogs, handlers,
    get db() { return access.getDb(); },
    call: (channel, ...args) => handlers.get(channel)({}, ...args),
    autoBackup: access.autoBackupDatabase,
    init: access.initDatabase,
    migrate: access.migrateDatabase,
    close() { try { access.getDb().close(); } catch {} }
  };
}
function createLicense() {
  const dir = fs.mkdtempSync(path.join(base, 'license-')); let now = Date.now();
  class Clock extends Date { constructor(...args) { super(...(args.length ? args : [now])); } static now() { return now; } }
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'license/license.js'), 'utf8'), {
    module, exports: module.exports, Buffer, process, Date: Clock,
    require: name => name === 'electron' ? { app: { getPath: () => dir } }
      : name === 'os' ? { ...os, homedir: () => dir } : req(name)
  });
  return { license: module.exports, dir, advance: ms => { now += ms; } };
}
const clientData = { nom: 'Client de test', adresse: 'Lomé', telephone: '00000000', email: 'test@example.invalid', nif: 'TEST', tva_applicable: true };
function fixture(a) {
  const c = a.call('clients:create', clientData);
  const p = a.call('produits:create', { designation: 'Routeur test', prix_unitaire: 100000, unite: 'Unité', description: 'Test temporaire' });
  return { client: c.id, produit: p.id };
}
function proforma(a, f, overrides = {}) {
  return a.call('proformas:create', {
    date: '2026-10-18', client_id: f.client, objet: 'Installation de test',
    total_materiel_ht: 100000, prestations: 10000, remise: 0, total_ht: 110000, tva: 19800, total_ttc: 129800,
    avec_cachet: false, tva_applicable: true,
    lignes: [{ produit_id: f.produit, designation: 'Routeur test', unite: 'Unité', quantite: 1, prix_unitaire: 100000, montant: 100000, section_titre: 'Réseau', description: 'Description détaillée' }], ...overrides
  });
}
function facture(a, f, overrides = {}) { return a.call('factures:createFromProforma', proforma(a, f, overrides).id, '2026-10-18'); }
module.exports = { root, req, base, Database, createApp, createLicense, fixture, proforma, facture, clientData };
