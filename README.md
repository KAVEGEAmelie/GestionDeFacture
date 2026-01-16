# 📊 Application de Gestion de Facturation

Application desktop de gestion de facturation pour **In-Tel Services**, développée avec Electron, React et SQLite.

## 🎯 Fonctionnalités Complètes

✅ **Phase 1 - Fondations**
- Structure complète du projet
- Base de données SQLite intégrée
- Interface utilisateur moderne avec navigation
- Architecture évolutive

✅ **Phase 2 - Gestion des données**
- 📋 Gestion complète des **Clients** (CRUD)
- 📦 Gestion complète des **Produits** (CRUD)
- 🔍 Recherche et filtrage
- ✏️ Modification et suppression

✅ **Phase 3 - Documents commerciaux**
- 📄 Création de **Factures Proforma**
- 🔄 Conversion Proforma → Facture
- 🚚 Génération de **Bordereaux de livraison**
- 💰 Calcul automatique TVA (18%)
- 📊 Visualisation des documents
- 🔢 Numérotation automatique

✅ **Phase 4 - Finalisation**
- ⚙️ Page de **Paramètres** complète
- 📈 **Statistiques** en temps réel
- 🏢 Configuration entreprise
- 🔄 Gestion des compteurs
- 💾 Sauvegarde automatique

## 🛠️ Technologies utilisées

- **Electron.js** - Framework desktop multi-plateforme
- **React.js** - Interface utilisateur moderne
- **Node.js** - Backend et logique métier
- **SQLite** - Base de données locale embarquée
- **Lucide React** - Bibliothèque d'icônes
- **React Router** - Navigation entre pages

## 📋 Prérequis

Avant de commencer, assurez-vous d'avoir installé :

- **Node.js** (version 18 ou supérieure)
- **npm** (inclus avec Node.js)

## 🚀 Installation

### 1. Installer les dépendances

```bash
npm install
```

⏱️ Durée : 2-3 minutes

### 2. Démarrer l'application en mode développement

```bash
npm run dev
```

Cette commande :
- Lance le serveur de développement React (port 3000)
- Démarre l'application Electron
- Active le hot-reload pour le développement

### 3. Autres commandes disponibles

```bash
# React uniquement (sans Electron)
npm run dev:react

# Electron uniquement
npm start

# Build pour production
npm run build

# Package en .exe installable
npm run package
```

## 📦 Packaging pour distribution

Pour créer un fichier .exe installable :

```bash
npm run build      # Build React
npm run package    # Package Electron
```

Le fichier d'installation se trouvera dans le dossier `dist/`.

## 📁 Structure du projet

```
gestion-facturation/
├── main.js                 # Point d'entrée Electron
├── preload.js             # Communication IPC sécurisée
├── package.json           # Configuration et dépendances
├── public/                # Fichiers statiques
│   └── index.html
├── src/
│   ├── App.js            # Composant principal React
│   ├── index.js          # Point d'entrée React
│   ├── components/       # Composants réutilisables
│   │   ├── Layout.js     # Layout avec navigation
│   │   └── modals/       # Composants modaux
│   │       └── Modal.js
│   └── pages/            # Pages de l'application
│       ├── Dashboard.js   # ✅ Tableau de bord
│       ├── Clients.js     # ✅ Gestion clients
│       ├── Produits.js    # ✅ Gestion produits
│       ├── Proformas.js   # ✅ Factures proforma
│       ├── Factures.js    # ✅ Factures définitives
│       ├── Bordereaux.js  # ✅ Bordereaux de livraison
│       └── Parametres.js  # ✅ Paramètres
└── README.md
```

## 🗃️ Base de données

La base de données SQLite est créée automatiquement au premier lancement dans :
- **Windows** : `C:\Users\[Username]\AppData\Roaming\gestion-facturation\facturation.db`

### Tables créées :

- `clients` - Informations clients
- `produits` - Catalogue produits
- `proformas` - Factures proforma
- `proforma_lignes` - Lignes de proforma
- `factures` - Factures définitives
- `facture_lignes` - Lignes de facture
- `bordereaux` - Bordereaux de livraison
- `bordereau_lignes` - Lignes de bordereau
- `parametres` - Paramètres de l'entreprise

## 🎨 Fonctionnalités détaillées

### 1. **Tableau de bord** ✅
- Vue d'ensemble avec statistiques
- Cartes cliquables pour navigation rapide
- Compteurs en temps réel

### 2. **Gestion des clients** ✅
- Ajouter, modifier, supprimer des clients
- Recherche dynamique
- Informations complètes (Nom, Adresse, Téléphone, Email, NIF)

### 3. **Gestion des produits** ✅
- Ajouter, modifier, supprimer des produits
- Prix unitaire et unités personnalisables
- Description détaillée optionnelle

### 4. **Factures Proforma** ✅
- Création avec sélection client et produits
- Ajout de lignes multiples
- Calcul automatique HT, TVA (18%), TTC
- Visualisation détaillée
- Numérotation automatique

### 5. **Factures Définitives** ✅
- Conversion depuis une proforma
- Conservation des données
- Génération bordereau de livraison
- Visualisation complète

### 6. **Bordereaux de Livraison** ✅
- Création depuis une facture
- Liste des articles livrés
- Mentions légales automatiques

### 7. **Paramètres** ✅
- Configuration entreprise (RCCM, NIF, Adresse, etc.)
- Gestion taux de TVA
- Compteurs de numérotation
- Sauvegarde instantanée

## 🔧 Configuration

Les paramètres de l'entreprise (In-Tel Services) sont pré-configurés :
- **RCCM** : TG-LOM 2013 A 6170
- **NIF** : 1000278436
- **TVA** : 18% (modifiable)
- **Numérotation** : Automatique avec format `2025/XXXXX-ITS`

## 💡 Utilisation

### Workflow typique :

1. **Ajouter des clients** : Menu Clients → Nouveau client
2. **Ajouter des produits** : Menu Produits → Nouveau produit
3. **Créer une proforma** : Menu Proformas → Nouvelle proforma
4. **Convertir en facture** : Menu Factures → Convertir une proforma
5. **Générer bordereau** : Menu Factures → Icône camion sur la facture

## 🐛 Dépannage

### L'application ne démarre pas
```bash
# Vérifier Node.js
node --version

# Supprimer et réinstaller
rm -rf node_modules
npm install
```

### Erreur de base de données
- La base de données se crée automatiquement
- Vérifiez les permissions du dossier AppData

### Port 3000 déjà utilisé
```bash
# Modifier dans .env
PORT=3001
```

### Erreur d'installation npm
```bash
# Nettoyer le cache
npm cache clean --force
npm install
```

## 📄 Licence

Application développée pour **In-Tel Services**.

## 👨‍💻 Version

- **Version** : 1.0.0 - Application Complète
- **Date** : Janvier 2026
- **Statut** : ✅ Production Ready

---

## 🎉 Fonctionnalités Complètes

✅ **Toutes les phases terminées !**
- Phase 1 : Fondations
- Phase 2 : Gestion données (Clients & Produits)
- Phase 3 : Documents commerciaux (Proforma, Facture, Bordereau)
- Phase 4 : Paramètres et finalisation

**L'application est 100% fonctionnelle et prête à l'emploi !**

Application 100% hors ligne - Aucune connexion Internet requise.
