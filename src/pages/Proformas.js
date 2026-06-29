import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Eye, Trash2, FileText, DollarSign, Printer, Download, PackagePlus, Edit2, X, Truck, Stamp, Percent } from 'lucide-react';
import Modal from '../components/modals/Modal';
import FilterBar from '../components/Filters/FilterBar';
import PeriodFilter from '../components/Filters/PeriodFilter';
import { inDateRange, inNumberRange } from '../utils/dateFilters';
import { generateProformaPDF } from '../utils/pdfGenerator';
import { useToast } from '../components/Toast/ToastProvider';
import { useConfirm } from '../components/ConfirmDialog/ConfirmProvider';
import { getErrorMessage } from '../utils/errors';
import { matchesWordPrefix } from '../utils/search';
import useBulkSelection, { bulkDelete } from '../hooks/useBulkSelection';
import SearchableSelect from '../components/Inputs/SearchableSelect';
import './Clients.css';
import './Proformas.css';

const UNIT_PRESETS = ['Unité', 'Pièce', 'Lot', 'Gros', 'Kilogramme', 'Mètre', 'Litre', 'Heure', 'Jour'];

const Proformas = () => {
  const toast = useToast();
  const confirm = useConfirm();
  const [proformas, setProformas] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statutFilter, setStatutFilter] = useState('tous');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [montantMin, setMontantMin] = useState('');
  const [montantMax, setMontantMax] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'date', direction: 'desc' });
  const [clients, setClients] = useState([]);
  const [produits, setProduits] = useState([]);
  const [parametres, setParametres] = useState({});
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [selectedProforma, setSelectedProforma] = useState(null);
  const [editingProforma, setEditingProforma] = useState(null);
  const [addProductModalOpen, setAddProductModalOpen] = useState(false);
  const [showLigneForm, setShowLigneForm] = useState(false);
  const [ligneFormData, setLigneFormData] = useState({
    produit_id: '',
    produit_search: '',
    designation: '',
    unite: 'Unité',
    quantite: 1,
    prix_unitaire: '',
    montant: 0
  });
  const [newProduct, setNewProduct] = useState({
    designation: '',
    prix_unitaire: '',
    unite: 'Unité',
    description: ''
  });
  
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    client_id: '',
    objet: '',
    prestations: 0,
    remise: 0,
    avec_cachet: false,
    tva_applicable: true,
    lignes: []
  });

  const sortedProduits = useMemo(() => {
    return [...produits].sort((a, b) =>
      String(a.designation || '').localeCompare(String(b.designation || ''), 'fr', { sensitivity: 'base' })
    );
  }, [produits]);

  const sortedClients = useMemo(() => {
    return [...clients].sort((a, b) =>
      String(a.nom || '').localeCompare(String(b.nom || ''), 'fr', { sensitivity: 'base' })
    );
  }, [clients]);

  const uniteSuggestions = useMemo(() => {
    return Array.from(
      new Set([
        ...UNIT_PRESETS,
        ...produits.map((p) => String(p.unite || '').trim()).filter(Boolean),
      ])
    ).sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' }));
  }, [produits]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [proformasData, clientsData, produitsData, parametresData] = await Promise.all([
      window.electronAPI.proformas.getAll(),
      window.electronAPI.clients.getAll(),
      window.electronAPI.produits.getAll(),
      window.electronAPI.parametres.getAll()
    ]);
    setProformas(proformasData);
    setClients(clientsData);
    setProduits(produitsData);
    setParametres(parametresData);
  };

  const resetLigneForm = () => {
    setLigneFormData({
      produit_id: '',
      produit_search: '',
      designation: '',
      unite: 'Unité',
      quantite: 1,
      prix_unitaire: '',
      montant: 0
    });
  };

  const handleOpenLigneForm = () => {
    resetLigneForm();
    setShowLigneForm(true);
  };

  const handleCloseLigneForm = () => {
    setShowLigneForm(false);
    resetLigneForm();
  };

  const handleLigneFormChange = (field, value) => {
    const updated = { ...ligneFormData, [field]: value };

    if (field === 'produit_id' && value) {
      const produit = produits.find(p => p.id === parseInt(value));
      if (produit) {
        updated.produit_search = produit.designation;
        updated.designation = produit.designation;
        updated.unite = produit.unite;
        updated.prix_unitaire = produit.prix_unitaire || '';
      }
    }

    if (field === 'produit_search') {
      const searchValue = String(value || '').trim().toLowerCase();
      const produit = sortedProduits.find((p) => String(p.designation || '').trim().toLowerCase() === searchValue);
      if (produit) {
        updated.produit_id = String(produit.id);
        updated.produit_search = produit.designation;
        updated.designation = produit.designation;
        updated.unite = produit.unite;
        updated.prix_unitaire = produit.prix_unitaire || '';
      } else {
        updated.produit_id = '';
      }
    }

    const quantite = parseFloat(updated.quantite) || 0;
    const prixUnitaire = parseFloat(updated.prix_unitaire) || 0;
    updated.montant = quantite * prixUnitaire;

    setLigneFormData(updated);
  };

  const handleAddLigne = () => {
    const quantite = parseFloat(ligneFormData.quantite) || 0;
    const prixUnitaire = parseFloat(ligneFormData.prix_unitaire) || 0;
    const montant = quantite * prixUnitaire;

    setFormData({
      ...formData,
      lignes: [...formData.lignes, {
        produit_id: ligneFormData.produit_id ? parseInt(ligneFormData.produit_id) : '',
        produit_search: ligneFormData.produit_search || '',
        designation: ligneFormData.designation,
        unite: ligneFormData.unite,
        quantite,
        prix_unitaire: prixUnitaire,
        montant
      }]
    });
    handleCloseLigneForm();
  };

  const handleRemoveLigne = (index) => {
    const newLignes = formData.lignes.filter((_, i) => i !== index);
    setFormData({ ...formData, lignes: newLignes });
  };

  const handleLigneChange = (index, field, value) => {
    const newLignes = [...formData.lignes];
    newLignes[index][field] = value;

    // Si on sélectionne un produit, remplir automatiquement
    if (field === 'produit_id' && value) {
      const produit = produits.find(p => p.id === parseInt(value));
      if (produit) {
        newLignes[index].produit_search = produit.designation;
        newLignes[index].designation = produit.designation;
        newLignes[index].unite = produit.unite;
        newLignes[index].prix_unitaire = produit.prix_unitaire;
      }
    }

    if (field === 'produit_search') {
      const searchValue = String(value || '').trim().toLowerCase();
      const produit = sortedProduits.find((p) => String(p.designation || '').trim().toLowerCase() === searchValue);
      if (produit) {
        newLignes[index].produit_id = String(produit.id);
        newLignes[index].produit_search = produit.designation;
        newLignes[index].designation = produit.designation;
        newLignes[index].unite = produit.unite;
        newLignes[index].prix_unitaire = produit.prix_unitaire;
      } else {
        newLignes[index].produit_id = '';
      }
    }

    // Recalculer le montant systématiquement (produit, quantité ou prix)
    const quantite = parseFloat(newLignes[index].quantite) || 0;
    const prixUnitaire = parseFloat(newLignes[index].prix_unitaire) || 0;
    newLignes[index].montant = quantite * prixUnitaire;

    setFormData({ ...formData, lignes: newLignes });
  };

  const calculateTotals = () => {
    const total_materiel_ht = formData.lignes.reduce((sum, ligne) => sum + (ligne.montant || 0), 0);
    const prestations = parseFloat(formData.prestations) || 0;
    const remise = parseFloat(formData.remise) || 0;
    const total_ht = total_materiel_ht + prestations - remise;
    const tvaApplicable = formData.tva_applicable !== false;
    const tauxTVA = parseFloat(parametres.tva_taux) || 18;
    const tva = tvaApplicable ? total_ht * (tauxTVA / 100) : 0;
    const total_ttc = total_ht + tva;
    return { total_materiel_ht, prestations, remise, total_ht, tva, total_ttc, tvaApplicable, tauxTVA };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.client_id) {
      toast.error('Veuillez sélectionner un client valide dans la liste.');
      return;
    }
    
    if (formData.lignes.length === 0) {
      toast.error('Veuillez ajouter au moins une ligne.');
      return;
    }

    const { total_materiel_ht, prestations, remise, total_ht, tva, total_ttc } = calculateTotals();
    
    const data = {
      date: formData.date,
      client_id: parseInt(formData.client_id),
      objet: formData.objet,
      total_materiel_ht,
      prestations,
      remise,
      total_ht,
      tva,
      total_ttc,
      avec_cachet: formData.avec_cachet,
      tva_applicable: formData.tva_applicable,
      lignes: formData.lignes.map(l => ({
        produit_id: parseInt(l.produit_id),
        designation: l.designation,
        unite: l.unite,
        quantite: parseFloat(l.quantite),
        prix_unitaire: parseFloat(l.prix_unitaire),
        montant: l.montant
      }))
    };

    try {
      let proformaResult;
      if (editingProforma) {
        await window.electronAPI.proformas.update(editingProforma.id, data);
        toast.success('Proforma modifiée avec succès !');
      } else {
        await window.electronAPI.proformas.create(data);
        toast.success('Proforma créée avec succès !');
      }

      loadData();
      closeModal();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Erreur lors de l\'enregistrement de la proforma.'));
    }
  };

  const handleCreateBordereau = async (proforma) => {
    const createFacture = await confirm({
      title: 'Créer un bordereau',
      message: 'Voulez-vous créer un bordereau à partir de cette proforma ? Vous pouvez également créer une facture en même temps.',
      confirmText: 'Créer le bordereau',
      danger: false,
    });
    if (!createFacture) return;

    const createInvoice = await confirm({
      title: 'Créer la facture maintenant ?',
      message: 'Voulez-vous créer une facture en même temps que le bordereau ?',
      confirmText: 'Créer la facture',
      danger: false,
    });

    try {
      const res = await window.electronAPI.bordereaux.createFromProforma(proforma.id, createInvoice);
      if (res.bordereauNumero) {
        toast.success(`Bordereau ${res.bordereauNumero} créé avec succès.`);
      }
      if (res.factureNumero) {
        toast.success(`Facture ${res.factureNumero} créée avec succès.`);
      }
      loadData();
    } catch (error) {
      console.error('Erreur bordereau:', error);
      toast.error(getErrorMessage(error, 'Erreur lors de la création du bordereau.'));
    }
  };

  const handleView = async (proforma) => {
    const fullProforma = await window.electronAPI.proformas.getById(proforma.id);
    setSelectedProforma(fullProforma);
    setViewModalOpen(true);
  };

  const handleEdit = async (proforma) => {
    if (proforma.statut === 'facturee') {
      toast.error('Cette proforma est déjà facturée et ne peut plus être modifiée.');
      return;
    }
    const full = await window.electronAPI.proformas.getById(proforma.id);
    setEditingProforma(full);
    setFormData({
      date: full.date,
      client_id: String(full.client_id),
      objet: full.objet || '',
      prestations: full.prestations || 0,
      remise: full.remise || 0,
      avec_cachet: full.avec_cachet === 1,
      tva_applicable: full.tva_applicable !== 0,
      lignes: (full.lignes || []).map(l => ({
        produit_id: String(l.produit_id),
        produit_search: (() => {
          const produit = produits.find((p) => p.id === l.produit_id);
          return produit ? produit.designation : (l.designation || '');
        })(),
        designation: l.designation,
        unite: l.unite,
        quantite: l.quantite,
        prix_unitaire: l.prix_unitaire,
        montant: l.montant
      }))
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id) => {
    const ok = await confirm({
      title: 'Supprimer la proforma',
      message: 'Êtes-vous sûr de vouloir supprimer cette proforma ? Cette action est irréversible.',
      confirmText: 'Supprimer',
      danger: true,
    });
    if (!ok) return;
    try {
      await window.electronAPI.proformas.delete(id);
      toast.success('Proforma supprimée avec succès.');
      loadData();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Erreur lors de la suppression de la proforma.'));
    }
  };

  const handleAddProduct = async (e) => {
    e.preventDefault();
    try {
      await window.electronAPI.produits.create({
        ...newProduct,
        prix_unitaire: parseFloat(newProduct.prix_unitaire) || 0
      });
      await loadData();
      toast.success('Produit ajouté avec succès.');
    } catch (error) {
      toast.error(getErrorMessage(error, 'Erreur lors de l\'ajout du produit.'));
      return;
    }
    setNewProduct({
      designation: '',
      prix_unitaire: '',
      unite: 'Unité',
      description: ''
    });
    setAddProductModalOpen(false);
  };

  const handlePrint = async (proforma) => {
    const fullProforma = await window.electronAPI.proformas.getById(proforma.id);
    const withCachet = fullProforma.avec_cachet === 1;
    const doc = await generateProformaPDF(fullProforma, parametres, { withCachet });
    doc.autoPrint();
    window.open(doc.output('bloburl'), '_blank');
  };

  const handleExport = async (proforma) => {
    const fullProforma = await window.electronAPI.proformas.getById(proforma.id);
    const withCachet = fullProforma.avec_cachet === 1;
    const doc = await generateProformaPDF(fullProforma, parametres, { withCachet });
    doc.save(`Proforma_${fullProforma.numero.replace(/\//g, '-')}.pdf`);
  };

  const openModal = () => {
    setEditingProforma(null);
    setFormData({
      date: new Date().toISOString().split('T')[0],
      client_id: '',
      objet: '',
      prestations: 0,
      remise: 0,
      avec_cachet: false,
      tva_applicable: true,
      lignes: []
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingProforma(null);
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('fr-FR').format(price);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('fr-FR');
  };

  const getStatutBadge = (statut) => {
    const badges = {
      'en_attente': { label: 'En attente', class: 'badge-warning' },
      'facturee': { label: 'Facturée', class: 'badge-success' }
    };
    const badge = badges[statut] || badges['en_attente'];
    return <span className={`badge ${badge.class}`}>{badge.label}</span>;
  };

  const { total_materiel_ht, prestations, remise, total_ht, tva, total_ttc, tvaApplicable, tauxTVA } = calculateTotals();

  const filteredProformas = proformas.filter((p) => {
    const term = searchTerm.toLowerCase();
    const matchSearch =
      !term ||
      matchesWordPrefix(p.numero, term) ||
      matchesWordPrefix(p.client_nom, term) ||
      matchesWordPrefix(p.objet, term);
    const matchStatut = statutFilter === 'tous' || p.statut === statutFilter;
    const matchDate = inDateRange(p.date, dateFrom, dateTo);
    const matchMontant = inNumberRange(p.total_ttc, montantMin, montantMax);
    return matchSearch && matchStatut && matchDate && matchMontant;
  });

  const sortedFilteredProformas = useMemo(() => {
    const items = [...filteredProformas];
    const { key, direction } = sortConfig;
    const factor = direction === 'asc' ? 1 : -1;
    return items.sort((a, b) => {
      if (key === 'date') {
        return ((new Date(a.date).getTime() || 0) - (new Date(b.date).getTime() || 0)) * factor;
      }
      if (key === 'total_ttc') {
        return ((Number(a.total_ttc) || 0) - (Number(b.total_ttc) || 0)) * factor;
      }
      return String(a[key] || '').localeCompare(String(b[key] || ''), 'fr', { sensitivity: 'base' }) * factor;
    });
  }, [filteredProformas, sortConfig]);

  const toggleSort = (key) => {
    setSortConfig((prev) =>
      prev.key === key
        ? { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
        : { key, direction: key === 'date' ? 'desc' : 'asc' }
    );
  };

  const sortMark = (key) => {
    if (sortConfig.key !== key) return ' ↕';
    return sortConfig.direction === 'asc' ? ' ↑' : ' ↓';
  };

  const activeCount =
    (statutFilter !== 'tous' ? 1 : 0) +
    (dateFrom || dateTo ? 1 : 0) +
    (montantMin !== '' || montantMax !== '' ? 1 : 0);

  const resetFilters = () => {
    setStatutFilter('tous');
    setDateFrom('');
    setDateTo('');
    setMontantMin('');
    setMontantMax('');
  };

  const selection = useBulkSelection(sortedFilteredProformas);
  const handleBulkDelete = () =>
    bulkDelete({
      ids: selection.selectedIds,
      deleteFn: (id) => window.electronAPI.proformas.delete(id),
      confirm,
      toast,
      reload: loadData,
      clear: selection.clear,
      labels: { confirmTitle: 'Supprimer les proformas', singular: 'proforma', plural: 'proformas' },
    });

  return (
    <div className="page fade-in">
      <div className="page-header">
        <div>
          <h1>Factures Proforma</h1>
          <p className="subtitle">Créez et gérez vos factures proforma</p>
        </div>
        <div className="header-actions">
          {selection.count > 0 && (
            <button className="btn btn-danger bulk-delete-btn" onClick={handleBulkDelete}>
              <Trash2 size={18} />
              Supprimer la sélection ({selection.count})
            </button>
          )}
          <button className="btn btn-primary" onClick={openModal}>
            <Plus size={20} />
            Nouvelle proforma
          </button>
        </div>
      </div>

      <div className="content-card">
        <FilterBar
          searchValue={searchTerm}
          onSearchChange={setSearchTerm}
          searchPlaceholder="Rechercher par numéro, client ou objet..."
          activeCount={activeCount}
          onReset={resetFilters}
        >
          <div className="filter-group">
            <label>Statut</label>
            <select
              className="filter-select"
              value={statutFilter}
              onChange={(e) => setStatutFilter(e.target.value)}
            >
              <option value="tous">Tous les statuts</option>
              <option value="en_attente">En attente</option>
              <option value="facturee">Facturée</option>
            </select>
          </div>

          <div className="filter-group">
            <label>Montant TTC (FCFA)</label>
            <div className="filter-range">
              <input
                type="number"
                min="0"
                placeholder="Min"
                value={montantMin}
                onChange={(e) => setMontantMin(e.target.value)}
              />
              <span>—</span>
              <input
                type="number"
                min="0"
                placeholder="Max"
                value={montantMax}
                onChange={(e) => setMontantMax(e.target.value)}
              />
            </div>
          </div>

          <PeriodFilter
            label="Date de la proforma"
            from={dateFrom}
            to={dateTo}
            onChange={(f, t) => {
              setDateFrom(f);
              setDateTo(t);
            }}
          />
        </FilterBar>

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th className="select-col">
                  <input
                    type="checkbox"
                    checked={selection.allSelected}
                    onChange={selection.toggleAll}
                    title="Tout sélectionner"
                  />
                </th>
                <th onClick={() => toggleSort('numero')} style={{ cursor: 'pointer' }}>N°{sortMark('numero')}</th>
                <th onClick={() => toggleSort('date')} style={{ cursor: 'pointer' }}>Date{sortMark('date')}</th>
                <th onClick={() => toggleSort('client_nom')} style={{ cursor: 'pointer' }}>Client{sortMark('client_nom')}</th>
                <th onClick={() => toggleSort('objet')} style={{ cursor: 'pointer' }}>Objet{sortMark('objet')}</th>
                <th onClick={() => toggleSort('total_ttc')} style={{ cursor: 'pointer' }}>Montant TTC{sortMark('total_ttc')}</th>
                <th onClick={() => toggleSort('statut')} style={{ cursor: 'pointer' }}>Statut{sortMark('statut')}</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedFilteredProformas.length === 0 ? (
                <tr>
                  <td colSpan="8" className="empty-state">
                    {searchTerm || statutFilter !== 'tous' ? 'Aucune proforma trouvée' : 'Aucune proforma enregistrée'}
                  </td>
                </tr>
              ) : (
                sortedFilteredProformas.map((proforma) => (
                  <tr key={proforma.id}>
                    <td className="select-col">
                      <input
                        type="checkbox"
                        checked={selection.isSelected(proforma.id)}
                        onChange={() => selection.toggle(proforma.id)}
                        disabled={proforma.statut === 'facturee'}
                        title={proforma.statut === 'facturee' ? 'Proforma déjà convertie' : 'Sélectionner'}
                      />
                    </td>
                    <td className="font-semibold">{proforma.numero}</td>
                    <td>{formatDate(proforma.date)}</td>
                    <td>{proforma.client_nom}</td>
                    <td>{proforma.objet}</td>
                    <td>{formatPrice(proforma.total_ttc)} FCFA</td>
                    <td>{getStatutBadge(proforma.statut)}</td>
                    <td>
                      <div className="action-buttons">
                        <button
                          className="btn-icon btn-icon-primary"
                          onClick={() => handleView(proforma)}
                          title="Voir"
                        >
                          <Eye size={16} />
                        </button>
                        <button
                          className="btn-icon"
                          style={{ color: '#f59e0b' }}
                          onClick={() => handleEdit(proforma)}
                          title="Modifier"
                          disabled={proforma.statut === 'facturee'}
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          className="btn-icon btn-icon-success"
                          onClick={() => handlePrint(proforma)}
                          title="Imprimer"
                        >
                          <Printer size={16} />
                        </button>
                        <button
                          className="btn-icon btn-icon-info"
                          onClick={() => handleCreateBordereau(proforma)}
                          title="Créer un bordereau"
                          disabled={proforma.statut === 'facturee'}
                        >
                          <Truck size={16} />
                        </button>
                        <button
                          className="btn-icon btn-icon-info"
                          onClick={() => handleExport(proforma)}
                          title="Exporter PDF"
                        >
                          <Download size={16} />
                        </button>
                        <button
                          className="btn-icon btn-icon-danger"
                          onClick={() => handleDelete(proforma.id)}
                          title="Supprimer"
                          disabled={proforma.statut === 'facturee'}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Création */}
      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        title={editingProforma ? `Modifier la proforma ${editingProforma.numero}` : 'Nouvelle facture proforma'}
        size="xlarge"
      >
        <form onSubmit={handleSubmit} className="form">
          <div className="form-row">
            <div className="form-group">
              <label>Date *</label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label>Client *</label>
              <SearchableSelect
                options={sortedClients.map((client) => ({ value: String(client.id), label: client.nom }))}
                value={formData.client_id}
                onChange={(clientId) => setFormData((prev) => ({ ...prev, client_id: clientId }))}
                placeholder="Rechercher un client"
                noOptionsText="Aucun client correspondant"
              />
            </div>
          </div>

          <div className="form-group">
            <label>Objet *</label>
            <input
              type="text"
              value={formData.objet}
              onChange={(e) => setFormData({ ...formData, objet: e.target.value })}
              placeholder="Ex: Location de consommables informatiques"
              required
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Main d'œuvre (FCFA)</label>
              <input
                type="number"
                value={formData.prestations}
                onChange={(e) => setFormData({ ...formData, prestations: e.target.value })}
                min="0"
                step="0.01"
                placeholder="0"
              />
            </div>

            <div className="form-group">
              <label>Remise (FCFA)</label>
              <input
                type="number"
                value={formData.remise}
                onChange={(e) => setFormData({ ...formData, remise: e.target.value })}
                min="0"
                step="0.01"
                placeholder="0"
              />
            </div>
          </div>

          <div className="options-grid">
            {/* Option cachet & signature */}
            <label className={`option-card ${formData.avec_cachet ? 'is-active' : ''} ${!parametres.signature_image ? 'is-disabled' : ''}`}>
              <span className="option-card__icon">
                <Stamp size={22} />
              </span>
              <span className="option-card__body">
                <span className="option-card__title">Cachet &amp; signature</span>
                <span className={`option-card__desc ${!parametres.signature_image ? 'is-warning' : ''}`}>
                  {parametres.signature_image
                    ? 'Appliquer le cachet et la signature sur cette proforma.'
                    : 'Importez d’abord une image dans Paramètres pour activer cette option.'}
                </span>
              </span>
              <span className="switch">
                <input
                  type="checkbox"
                  checked={formData.avec_cachet}
                  disabled={!parametres.signature_image}
                  onChange={(e) => setFormData({ ...formData, avec_cachet: e.target.checked })}
                />
                <span className="switch__track"><span className="switch__thumb" /></span>
              </span>
            </label>

            {/* Option TVA */}
            <label className={`option-card ${formData.tva_applicable ? 'is-active' : ''}`}>
              <span className="option-card__icon">
                <Percent size={22} />
              </span>
              <span className="option-card__body">
                <span className="option-card__title">
                  TVA ({parseFloat(parametres.tva_taux) || 18}%)
                </span>
                <span className="option-card__desc">
                  {formData.tva_applicable
                    ? 'La TVA est appliquée à cette proforma et à la facture.'
                    : 'Proforma et facture émises sans TVA.'}
                </span>
              </span>
              <span className="switch">
                <input
                  type="checkbox"
                  checked={formData.tva_applicable}
                  onChange={(e) => setFormData({ ...formData, tva_applicable: e.target.checked })}
                />
                <span className="switch__track"><span className="switch__thumb" /></span>
              </span>
            </label>
          </div>

          <div className="lignes-section">
            <div className="lignes-header">
              <h3>Lignes de la proforma</h3>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button type="button" className="btn btn-secondary btn-sm" onClick={handleOpenLigneForm}>
                  <Plus size={16} />
                  Ajouter une ligne
                </button>
                <button type="button" className="btn btn-success btn-sm" onClick={() => setAddProductModalOpen(true)}>
                  <PackagePlus size={16} />
                  Nouveau produit
                </button>
              </div>
            </div>

            {showLigneForm && (
              <div className="ligne-form-panel">
                <div className="ligne-form-header">
                  <div>
                    <h4>Ajouter une ligne</h4>
                    <p>Formulaire flottant pour entrer les détails sans descendre.</p>
                  </div>
                  <button type="button" className="btn-close-panel" onClick={handleCloseLigneForm}>
                    <X size={18} />
                  </button>
                </div>

                <div className="ligne-form-grid">
                  <div className="form-group">
                    <label>Produit (recherche)</label>
                    <SearchableSelect
                      options={sortedProduits.map((produit) => ({ value: String(produit.id), label: produit.designation }))}
                      value={ligneFormData.produit_id}
                      onChange={(produitId) => handleLigneFormChange('produit_id', produitId)}
                      placeholder="Rechercher un produit"
                      noOptionsText="Aucun produit correspondant"
                    />
                  </div>

                  <div className="form-group">
                    <label>Désignation</label>
                    <input
                      type="text"
                      value={ligneFormData.designation}
                      onChange={(e) => handleLigneFormChange('designation', e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label>Unité</label>
                    <input
                      type="text"
                      value={ligneFormData.unite}
                      onChange={(e) => handleLigneFormChange('unite', e.target.value)}
                      list="proformas-unites-list"
                      placeholder="Ex: Carton, Pack..."
                    />
                  </div>

                  <div className="form-group">
                    <label>Quantité</label>
                    <input
                      type="number"
                      value={ligneFormData.quantite}
                      onChange={(e) => handleLigneFormChange('quantite', e.target.value)}
                      min="0"
                      step="1"
                    />
                  </div>

                  <div className="form-group">
                    <label>Prix unitaire</label>
                    <input
                      type="number"
                      value={ligneFormData.prix_unitaire}
                      onChange={(e) => handleLigneFormChange('prix_unitaire', e.target.value)}
                      min="0"
                      step="0.01"
                      placeholder="Optionnel"
                    />
                  </div>

                  <div className="form-group">
                    <label>Montant estimé</label>
                    <input
                      type="text"
                      value={formatPrice(ligneFormData.montant)}
                      readOnly
                      className="readonly"
                    />
                  </div>

                  <div className="ligne-form-actions">
                    <button type="button" className="btn btn-secondary btn-sm" onClick={handleCloseLigneForm}>
                      Annuler
                    </button>
                    <button type="button" className="btn btn-primary btn-sm" onClick={handleAddLigne}>
                      Ajouter
                    </button>
                  </div>
                </div>
              </div>
            )}

            {formData.lignes.length === 0 ? (
              <div className="ligne-empty-state">
                Aucune ligne ajoutée pour le moment.
              </div>
            ) : (
              <div className="ligne-table-wrapper">
                <table className="data-table ligne-table">
                  <thead>
                    <tr>
                      <th>Produit</th>
                      <th>Désignation</th>
                      <th>Unité</th>
                      <th>Quantité</th>
                      <th>Prix unitaire</th>
                      <th>Montant</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {formData.lignes.map((ligne, index) => (
                      <tr key={index}>
                        <td>
                          <SearchableSelect
                            options={sortedProduits.map((produit) => ({ value: String(produit.id), label: produit.designation }))}
                            value={ligne.produit_id}
                            onChange={(produitId) => handleLigneChange(index, 'produit_id', produitId)}
                            placeholder="Rechercher un produit"
                            noOptionsText="Aucun produit"
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            value={ligne.designation}
                            onChange={(e) => handleLigneChange(index, 'designation', e.target.value)}
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            value={ligne.unite}
                            onChange={(e) => handleLigneChange(index, 'unite', e.target.value)}
                            list="proformas-unites-list"
                            placeholder="Unité"
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            value={ligne.quantite}
                            onChange={(e) => handleLigneChange(index, 'quantite', e.target.value)}
                            min="0"
                            step="1"
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            value={ligne.prix_unitaire}
                            onChange={(e) => handleLigneChange(index, 'prix_unitaire', e.target.value)}
                            min="0"
                            step="0.01"
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            value={formatPrice(ligne.montant)}
                            readOnly
                            className="readonly"
                          />
                        </td>
                        <td>
                          <button
                            type="button"
                            className="btn-remove-ligne"
                            onClick={() => handleRemoveLigne(index)}
                            title="Supprimer"
                          >
                            <Trash2 size={18} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="totaux-section">
            <div className="totaux-grid">
              <div className="totaux-item">
                <span>Total Matériel HT :</span>
                <strong>{formatPrice(total_materiel_ht)} FCFA</strong>
              </div>
              <div className="totaux-item">
                <span>Main d'œuvre :</span>
                <strong>{formatPrice(prestations)} FCFA</strong>
              </div>
              <div className="totaux-item">
                <span>Remise :</span>
                <strong>- {formatPrice(remise)} FCFA</strong>
              </div>
              <div className="totaux-item">
                <span>Total HT :</span>
                <strong>{formatPrice(total_ht)} FCFA</strong>
              </div>
              <div className="totaux-item">
                <span>TVA ({tvaApplicable ? tauxTVA : 0}%) :</span>
                <strong>{formatPrice(tva)} FCFA</strong>
              </div>
              <div className="totaux-item total-ttc">
                <span>Total TTC :</span>
                <strong>{formatPrice(total_ttc)} FCFA</strong>
              </div>
            </div>
          </div>

          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={closeModal}>
              Annuler
            </button>
            <button type="submit" className="btn btn-primary">
              {editingProforma ? 'Enregistrer les modifications' : 'Créer la proforma'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal Visualisation */}
      {selectedProforma && (
        <Modal
          isOpen={viewModalOpen}
          onClose={() => setViewModalOpen(false)}
          title={`Proforma ${selectedProforma.numero}`}
          size="large"
        >
          <div className="view-document">
            <div className="view-header">
              <div>
                <p><strong>Date :</strong> {formatDate(selectedProforma.date)}</p>
                <p><strong>Client :</strong> {selectedProforma.client_nom}</p>
                <p><strong>Objet :</strong> {selectedProforma.objet}</p>
              </div>
              <div>
                {getStatutBadge(selectedProforma.statut)}
              </div>
            </div>

            <table className="view-table">
              <thead>
                <tr>
                  <th>Désignation</th>
                  <th>Unité</th>
                  <th>Quantité</th>
                  <th>P.U.</th>
                  <th>Montant</th>
                </tr>
              </thead>
              <tbody>
                {selectedProforma.lignes.map((ligne, index) => (
                  <tr key={index}>
                    <td>{ligne.designation}</td>
                    <td>{ligne.unite}</td>
                    <td>{ligne.quantite}</td>
                    <td>{formatPrice(ligne.prix_unitaire)}</td>
                    <td>{formatPrice(ligne.montant)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="view-totaux">
              <div className="totaux-row">
                <span>Total HT :</span>
                <strong>{formatPrice(selectedProforma.total_ht)} FCFA</strong>
              </div>
              <div className="totaux-row">
                <span>TVA ({selectedProforma.total_ht ? Math.round((selectedProforma.tva / selectedProforma.total_ht) * 100) : 18}%) :</span>
                <strong>{formatPrice(selectedProforma.tva)} FCFA</strong>
              </div>
              <div className="totaux-row total">
                <span>Total TTC :</span>
                <strong>{formatPrice(selectedProforma.total_ttc)} FCFA</strong>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal Ajout Produit */}
      <Modal
        isOpen={addProductModalOpen}
        onClose={() => setAddProductModalOpen(false)}
        title="Ajouter un nouveau produit"
        size="medium"
      >
        <form onSubmit={handleAddProduct} className="form">
          <div className="form-group">
            <label>Désignation *</label>
            <input
              type="text"
              value={newProduct.designation}
              onChange={(e) => setNewProduct({ ...newProduct, designation: e.target.value })}
              required
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Prix unitaire (FCFA)</label>
              <input
                type="number"
                value={newProduct.prix_unitaire}
                onChange={(e) => setNewProduct({ ...newProduct, prix_unitaire: e.target.value })}
                min="0"
                step="0.01"
                placeholder="Optionnel — à fixer selon le client"
              />
            </div>

            <div className="form-group">
              <label>Unité</label>
              <SearchableSelect
                options={uniteSuggestions.map((unite) => ({ value: unite, label: unite }))}
                value={newProduct.unite}
                onChange={(uniteValue, option) =>
                  setNewProduct({ ...newProduct, unite: option?.label || uniteValue })
                }
                placeholder="Rechercher une unité"
                noOptionsText="Aucune unité"
                allowCustomValue
              />
            </div>
          </div>

          <div className="form-group">
            <label>Description</label>
            <textarea
              value={newProduct.description}
              onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })}
              rows="3"
            />
          </div>

          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={() => setAddProductModalOpen(false)}>
              Annuler
            </button>
            <button type="submit" className="btn btn-primary">
              Ajouter le produit
            </button>
          </div>
        </form>
      </Modal>

      <datalist id="proformas-unites-list">
        {uniteSuggestions.map((u) => (
          <option key={u} value={u} />
        ))}
      </datalist>
    </div>
  );
};

export default Proformas;
