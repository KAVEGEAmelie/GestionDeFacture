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
    delete: (id) => ipcRenderer.invoke('proformas:delete', id)
  },
  
  // FACTURES
  factures: {
    getAll: () => ipcRenderer.invoke('factures:getAll'),
    getById: (id) => ipcRenderer.invoke('factures:getById', id),
    createFromProforma: (proformaId) => ipcRenderer.invoke('factures:createFromProforma', proformaId),
    delete: (id) => ipcRenderer.invoke('factures:delete', id)
  },
  
  // BORDEREAUX
  bordereaux: {
    getAll: () => ipcRenderer.invoke('bordereaux:getAll'),
    getById: (id) => ipcRenderer.invoke('bordereaux:getById', id),
    createFromFacture: (factureId) => ipcRenderer.invoke('bordereaux:createFromFacture', factureId),
    delete: (id) => ipcRenderer.invoke('bordereaux:delete', id)
  },
  
  // PARAMETRES
  parametres: {
    getAll: () => ipcRenderer.invoke('parametres:getAll'),
    update: (cle, valeur) => ipcRenderer.invoke('parametres:update', cle, valeur)
  },
  
  // STATISTIQUES
  stats: {
    getCounts: () => ipcRenderer.invoke('stats:getCounts')
  }
});
