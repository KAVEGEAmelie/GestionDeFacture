const { contextBridge, ipcRenderer } = require('electron');

// Expose les API de manière sécurisée au renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  // CLIENTS
  clients: {
    getAll: () => ipcRenderer.invoke('clients:getAll'),
    getById: (id) => ipcRenderer.invoke('clients:getById', id),
    create: (client) => ipcRenderer.invoke('clients:create', client),
    update: (id, client) => ipcRenderer.invoke('clients:update', id, client),
    delete: (id) => ipcRenderer.invoke('clients:delete', id)
  },
  
  // PRODUITS
  produits: {
    getAll: () => ipcRenderer.invoke('produits:getAll'),
    getById: (id) => ipcRenderer.invoke('produits:getById', id),
    create: (produit) => ipcRenderer.invoke('produits:create', produit),
    update: (id, produit) => ipcRenderer.invoke('produits:update', id, produit),
    delete: (id) => ipcRenderer.invoke('produits:delete', id)
  },
  
  // PROFORMAS
  proformas: {
    getAll: () => ipcRenderer.invoke('proformas:getAll'),
    getById: (id) => ipcRenderer.invoke('proformas:getById', id),
    create: (proforma) => ipcRenderer.invoke('proformas:create', proforma),
    update: (id, proforma) => ipcRenderer.invoke('proformas:update', id, proforma),
    delete: (id) => ipcRenderer.invoke('proformas:delete', id)
  },
  
  // FACTURES
  factures: {
    getAll: () => ipcRenderer.invoke('factures:getAll'),
    getById: (id) => ipcRenderer.invoke('factures:getById', id),
    createFromProforma: (proformaId, dateFacture) => ipcRenderer.invoke('factures:createFromProforma', proformaId, dateFacture),
    markPaid: (id) => ipcRenderer.invoke('factures:markPaid', id),
    markUnpaid: (id) => ipcRenderer.invoke('factures:markUnpaid', id),
    delete: (id) => ipcRenderer.invoke('factures:delete', id)
  },
  
  // LICENCE / PÉRIODE D'ESSAI
  license: {
    getStatus: () => ipcRenderer.invoke('license:getStatus'),
    activate: (code) => ipcRenderer.invoke('license:activate', code)
  },

  // APPELS D'OFFRE
  appelsOffres: {
    getAll: () => ipcRenderer.invoke('appelsOffres:getAll'),
    getById: (id) => ipcRenderer.invoke('appelsOffres:getById', id),
    create: (data) => ipcRenderer.invoke('appelsOffres:create', data),
    update: (id, data) => ipcRenderer.invoke('appelsOffres:update', id, data),
    delete: (id) => ipcRenderer.invoke('appelsOffres:delete', id),
    transformerEnProforma: (id) => ipcRenderer.invoke('appelsOffres:transformerEnProforma', id)
  },

  // BORDEREAUX
  bordereaux: {
    getAll: () => ipcRenderer.invoke('bordereaux:getAll'),
    getById: (id) => ipcRenderer.invoke('bordereaux:getById', id),
    create: (data) => ipcRenderer.invoke('bordereaux:create', data),
    createFromFacture: (factureId) => ipcRenderer.invoke('bordereaux:createFromFacture', factureId),
    createFromProforma: (proformaId, createFacture) => ipcRenderer.invoke('bordereaux:createFromProforma', proformaId, createFacture),
    delete: (id) => ipcRenderer.invoke('bordereaux:delete', id)
  },

  // TVA / OTR
  tva: {
    getStats: () => ipcRenderer.invoke('tva:getStats'),
    verser: (ids) => ipcRenderer.invoke('tva:verser', ids),
    annuler: (ids) => ipcRenderer.invoke('tva:annuler', ids)
  },
  // ATTESTATIONS DE SERVICE FAIT
  attestations: {
    getAll: () => ipcRenderer.invoke('attestations:getAll'),
    getById: (id) => ipcRenderer.invoke('attestations:getById', id),
    create: (data) => ipcRenderer.invoke('attestations:create', data),
    update: (id, data) => ipcRenderer.invoke('attestations:update', id, data),
    delete: (id) => ipcRenderer.invoke('attestations:delete', id)
  },
  // RAPPORTS TECHNIQUES
  rapports: {
    getAll: () => ipcRenderer.invoke('rapports:getAll'),
    getById: (id) => ipcRenderer.invoke('rapports:getById', id),
    create: (data) => ipcRenderer.invoke('rapports:create', data),
    update: (id, data) => ipcRenderer.invoke('rapports:update', id, data),
    delete: (id) => ipcRenderer.invoke('rapports:delete', id)
  },
  // PARAMETRES
  parametres: {
    getAll: () => ipcRenderer.invoke('parametres:getAll'),
    update: (cle, valeur) => ipcRenderer.invoke('parametres:update', cle, valeur)
  },

  // SECURITE (mot de passe de l'application)
  security: {
    getStatus: () => ipcRenderer.invoke('security:getStatus'),
    setPassword: (data) => ipcRenderer.invoke('security:setPassword', data),
    verify: (password) => ipcRenderer.invoke('security:verify', password),
    disable: (currentPassword) => ipcRenderer.invoke('security:disable', currentPassword)
  },
  
  // STATISTIQUES
  stats: {
    getCounts: () => ipcRenderer.invoke('stats:getCounts'),
    getDashboard: () => ipcRenderer.invoke('stats:getDashboard')
  },

  // SAUVEGARDE / RESTAURATION
  database: {
    backup: () => ipcRenderer.invoke('database:backup'),
    restore: () => ipcRenderer.invoke('database:restore')
  }
});
