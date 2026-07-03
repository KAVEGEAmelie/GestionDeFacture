import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Eye, Trash2, FileText, Printer, Download, PackagePlus, Edit2, X, Stamp, Percent, Mail, Mails, Receipt } from 'lucide-react';
import Modal from '../components/modals/Modal';
import FilterBar from '../components/Filters/FilterBar';
import PeriodFilter from '../components/Filters/PeriodFilter';
import { inDateRange, inNumberRange } from '../utils/dateFilters';
import { generateProformaPDF, generateLettreSoumissionPDF, generateEnveloppesPDF } from '../utils/pdfGenerator';
import { useToast } from '../components/Toast/ToastProvider';
import { useConfirm } from '../components/ConfirmDialog/ConfirmProvider';
import { getErrorMessage } from '../utils/errors';
import { matchesWordPrefix } from '../utils/search';
import useBulkSelection, { bulkDelete } from '../hooks/useBulkSelection';
import SearchableSelect from '../components/Inputs/SearchableSelect';
import './Clients.css';
import './Proformas.css';

const UNIT_PRESETS = ['Unité', 'Pièce', 'Lot', 'Gros', 'Kilogramme', 'Mètre', 'Litre', 'Heure', 'Jour'];

const PDF_OPTIONS = {
  titre: "APPEL D'OFFRE",
  sommeIntro: 'Arrêtée la présente offre à la somme de :',
};

const AppelsOffres = () => {
  const toast = useToast();
  const confirm = useConfirm();
  const [appelsOffres, setAppelsOffres] = useState([]);
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
  const [selectedAppelOffre, setSelectedAppelOffre] = useState(null);
  const [editingAppelOffre, setEditingAppelOffre] = useState(null);
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
    reference_externe: '',
    autorite: '',
    autorite_adresse: '',
    validite_offre: 90,
    delai_execution: '',
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
    const [appelsOffresData, clientsData, produitsData, parametresData] = await Promise.all([
      window.electronAPI.appelsOffres.getAll(),
      window.electronAPI.clients.getAll(),
      window.electronAPI.produits.getAll(),
      window.electronAPI.parametres.getAll()
    ]);
    setAppelsOffres(appelsOffresData);
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
      reference_externe: formData.reference_externe,
      autorite: formData.autorite,
      autorite_adresse: formData.autorite_adresse,
      validite_offre: formData.validite_offre,
      delai_execution: formData.delai_execution,
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
      if (editingAppelOffre) {
        await window.electronAPI.appelsOffres.update(editingAppelOffre.id, data);
        toast.success("Appel d'offre modifié avec succès !");
      } else {
        await window.electronAPI.appelsOffres.create(data);
        toast.success("Appel d'offre créé avec succès !");
      }
      loadData();
      closeModal();
    } catch (error) {
      toast.error(getErrorMessage(error, "Erreur lors de l'enregistrement de l'appel d'offre."));
    }
  };

  const handleTransformer = async (appelOffre) => {
    const ok = await confirm({
      title: 'Transformer en proforma',
      message: `Voulez-vous transformer l'appel d'offre ${appelOffre.numero} en facture proforma ? Une nouvelle proforma sera créée avec les mêmes lignes.`,
      confirmText: 'Transformer',
      danger: false,
    });
    if (!ok) return;
    try {
      const res = await window.electronAPI.appelsOffres.transformerEnProforma(appelOffre.id);
      toast.success(`Proforma ${res.proformaNumero} créée avec succès.`);
      loadData();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Erreur lors de la transformation en proforma.'));
    }
  };

  const handleView = async (appelOffre) => {
    const full = await window.electronAPI.appelsOffres.getById(appelOffre.id);
    setSelectedAppelOffre(full);
    setViewModalOpen(true);
  };

  const handleEdit = async (appelOffre) => {
    if (appelOffre.statut === 'transformee') {
      toast.error("Cet appel d'offre a déjà été transformé en proforma et ne peut plus être modifié.");
      return;
    }
    const full = await window.electronAPI.appelsOffres.getById(appelOffre.id);
    setEditingAppelOffre(full);
    setFormData({
      date: full.date,
      client_id: String(full.client_id),
      objet: full.objet || '',
      prestations: full.prestations || 0,
      remise: full.remise || 0,
      avec_cachet: full.avec_cachet === 1,
      tva_applicable: full.tva_applicable !== 0,
      reference_externe: full.reference_externe || '',
      autorite: full.autorite || '',
      autorite_adresse: full.autorite_adresse || '',
      validite_offre: full.validite_offre || 90,
      delai_execution: full.delai_execution || '',
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
      title: "Supprimer l'appel d'offre",
      message: "Êtes-vous sûr de vouloir supprimer cet appel d'offre ? Cette action est irréversible.",
      confirmText: 'Supprimer',
      danger: true,
    });
    if (!ok) return;
    try {
      await window.electronAPI.appelsOffres.delete(id);
      toast.success("Appel d'offre supprimé avec succès.");
      loadData();
    } catch (error) {
      toast.error(getErrorMessage(error, "Erreur lors de la suppression de l'appel d'offre."));
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

  const handlePrint = async (appelOffre) => {
    const full = await window.electronAPI.appelsOffres.getById(appelOffre.id);
    const withCachet = full.avec_cachet === 1;
    const doc = await generateProformaPDF(full, parametres, { ...PDF_OPTIONS, withCachet });
    doc.autoPrint();
    window.open(doc.output('bloburl'), '_blank');
  };

  const handleExport = async (appelOffre) => {
    const full = await window.electronAPI.appelsOffres.getById(appelOffre.id);
    const withCachet = full.avec_cachet === 1;
    const doc = await generateProformaPDF(full, parametres, { ...PDF_OPTIONS, withCachet });
    doc.save(`AppelOffre_${full.numero.replace(/\//g, '-')}.pdf`);
  };

  const handleBordereauPrix = async (appelOffre) => {
    const full = await window.electronAPI.appelsOffres.getById(appelOffre.id);
    const withCachet = full.avec_cachet === 1;
    const doc = await generateProformaPDF(full, parametres, {
      titre: 'BORDEREAU DES PRIX',
      sommeIntro: 'Arrêté le présent bordereau des prix à la somme de :',
      withCachet,
    });
    doc.save(`BordereauPrix_${full.numero.replace(/\//g, '-')}.pdf`);
  };

  const handleLettreSoumission = async (appelOffre) => {
    const full = await window.electronAPI.appelsOffres.getById(appelOffre.id);
    const doc = await generateLettreSoumissionPDF(full, parametres);
    doc.save(`LettreSoumission_${full.numero.replace(/\//g, '-')}.pdf`);
  };

  const handleEnveloppes = async (appelOffre) => {
    const full = await window.electronAPI.appelsOffres.getById(appelOffre.id);
    const doc = await generateEnveloppesPDF(full, parametres);
    doc.save(`Enveloppes_${full.numero.replace(/\//g, '-')}.pdf`);
  };

  const openModal = () => {
    setEditingAppelOffre(null);
    setFormData({
      date: new Date().toISOString().split('T')[0],
      client_id: '',
      objet: '',
      prestations: 0,
      remise: 0,
      avec_cachet: false,
      tva_applicable: true,
      reference_externe: '',
      autorite: '',
      autorite_adresse: '',
      validite_offre: 90,
      delai_execution: '',
      lignes: []
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingAppelOffre(null);
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
      'transformee': { label: 'Transformée en proforma', class: 'badge-success' }
    };
    const badge = badges[statut] || badges['en_attente'];
    return <span className={`badge ${badge.class}`}>{badge.label}</span>;
  };

  const { total_materiel_ht, prestations, remise, total_ht, tva, total_ttc, tvaApplicable, tauxTVA } = calculateTotals();

  const filteredAppelsOffres = appelsOffres.filter((a) => {
    const term = searchTerm.toLowerCase();
    const matchSearch =
      !term ||
      matchesWordPrefix(a.numero, term) ||
      matchesWordPrefix(a.client_nom, term) ||
      matchesWordPrefix(a.objet, term);
    const matchStatut = statutFilter === 'tous' || a.statut === statutFilter;
    const matchDate = inDateRange(a.date, dateFrom, dateTo);
    const matchMontant = inNumberRange(a.total_ttc, montantMin, montantMax);
    return matchSearch && matchStatut && matchDate && matchMontant;
  });

  const sortedFilteredAppelsOffres = useMemo(() => {
    const items = [...filteredAppelsOffres];
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
  }, [filteredAppelsOffres, sortConfig]);

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

  const selection = useBulkSelection(sortedFilteredAppelsOffres);
  const handleBulkDelete = () =>
    bulkDelete({
      ids: selection.selectedIds,
      deleteFn: (id) => window.electronAPI.appelsOffres.delete(id),
      confirm,
      toast,
      reload: loadData,
      clear: selection.clear,
      labels: { confirmTitle: "Supprimer les appels d'offre", singular: "appel d'offre", plural: "appels d'offre" },
    });

  return (
    <div className="page fade-in">
      <div className="page-header">
        <div>
          <h1>Appels d'offre</h1>
          <p className="subtitle">Créez et gérez vos offres pour les appels d'offre</p>
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
            Nouvel appel d'offre
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
              <option value="transformee">Transformée en proforma</option>
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
            label="Date de l'appel d'offre"
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
              {sortedFilteredAppelsOffres.length === 0 ? (
                <tr>
                  <td colSpan="8" className="empty-state">
                    {searchTerm || activeCount > 0 ? "Aucun appel d'offre trouvé" : "Aucun appel d'offre enregistré"}
                  </td>
                </tr>
              ) : (
                sortedFilteredAppelsOffres.map((appelOffre) => (
                  <tr key={appelOffre.id}>
                    <td className="select-col">
                      <input
                        type="checkbox"
                        checked={selection.isSelected(appelOffre.id)}
                        onChange={() => selection.toggle(appelOffre.id)}
                        title="Sélectionner"
                      />
                    </td>
                    <td className="font-semibold">{appelOffre.numero}</td>
                    <td>{formatDate(appelOffre.date)}</td>
                    <td>{appelOffre.client_nom}</td>
                    <td>{appelOffre.objet}</td>
                    <td>{formatPrice(appelOffre.total_ttc)} FCFA</td>
                    <td>{getStatutBadge(appelOffre.statut)}</td>
                    <td>
                      <div className="action-buttons">
                        <button
                          className="btn-icon btn-icon-primary"
                          onClick={() => handleView(appelOffre)}
                          title="Voir"
                        >
                          <Eye size={16} />
                        </button>
                        <button
                          className="btn-icon"
                          style={{ color: '#f59e0b' }}
                          onClick={() => handleEdit(appelOffre)}
                          title="Modifier"
                          disabled={appelOffre.statut === 'transformee'}
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          className="btn-icon btn-icon-success"
                          onClick={() => handlePrint(appelOffre)}
                          title="Imprimer"
                        >
                          <Printer size={16} />
                        </button>
                        <button
                          className="btn-icon btn-icon-info"
                          onClick={() => handleTransformer(appelOffre)}
                          title="Transformer en proforma"
                          disabled={appelOffre.statut === 'transformee'}
                        >
                          <FileText size={16} />
                        </button>
                        <button
                          className="btn-icon btn-icon-info"
                          onClick={() => handleExport(appelOffre)}
                          title="Exporter PDF"
                        >
                          <Download size={16} />
                        </button>
                        <button
                          className="btn-icon btn-icon-info"
                          onClick={() => handleBordereauPrix(appelOffre)}
                          title="Bordereau des prix (PDF)"
                        >
                          <Receipt size={16} />
                        </button>
                        <button
                          className="btn-icon btn-icon-info"
                          onClick={() => handleLettreSoumission(appelOffre)}
                          title="Lettre de soumission (PDF)"
                        >
                          <Mail size={16} />
                        </button>
                        <button
                          className="btn-icon btn-icon-info"
                          onClick={() => handleEnveloppes(appelOffre)}
                          title="Enveloppes intérieure / extérieure (PDF)"
                        >
                          <Mails size={16} />
                        </button>
                        <button
                          className="btn-icon btn-icon-danger"
                          onClick={() => handleDelete(appelOffre.id)}
                          title="Supprimer"
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

      {/* Modal Création / Édition */}
      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        title={editingAppelOffre ? `Modifier l'appel d'offre ${editingAppelOffre.numero}` : "Nouvel appel d'offre"}
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
              placeholder="Ex: Fourniture et installation de matériel réseau"
              required
            />
          </div>

          <h4 style={{ margin: '0.5rem 0 0', color: 'var(--primary, #1e3a8a)' }}>Informations de soumission (facultatif)</h4>
          <div className="form-row">
            <div className="form-group">
              <label>Référence de l'appel d'offres (publiée)</label>
              <input
                type="text"
                value={formData.reference_externe}
                onChange={(e) => setFormData({ ...formData, reference_externe: e.target.value })}
                placeholder="Ex: AOO N°005/2025/MEF"
              />
            </div>
            <div className="form-group">
              <label>Autorité contractante</label>
              <input
                type="text"
                value={formData.autorite}
                onChange={(e) => setFormData({ ...formData, autorite: e.target.value })}
                placeholder="Ex: Ministère de l'Économie et des Finances"
              />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Adresse de l'autorité</label>
              <input
                type="text"
                value={formData.autorite_adresse}
                onChange={(e) => setFormData({ ...formData, autorite_adresse: e.target.value })}
                placeholder="Ex: BP 123, Lomé - TOGO"
              />
            </div>
            <div className="form-group">
              <label>Validité de l'offre (jours)</label>
              <input
                type="number"
                value={formData.validite_offre}
                onChange={(e) => setFormData({ ...formData, validite_offre: e.target.value })}
                min="1"
                placeholder="90"
              />
            </div>
            <div className="form-group">
              <label>Délai d'exécution</label>
              <input
                type="text"
                value={formData.delai_execution}
                onChange={(e) => setFormData({ ...formData, delai_execution: e.target.value })}
                placeholder="Ex: 45 jours"
              />
            </div>
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
                    ? "Appliquer le cachet et la signature sur cet appel d'offre."
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
                    ? "La TVA est appliquée à cet appel d'offre."
                    : "Appel d'offre émis sans TVA."}
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
              <h3>Lignes de l'appel d'offre</h3>
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
                      list="appels-offres-unites-list"
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
                            list="appels-offres-unites-list"
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
              {editingAppelOffre ? 'Enregistrer les modifications' : "Créer l'appel d'offre"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal Visualisation */}
      {selectedAppelOffre && (
        <Modal
          isOpen={viewModalOpen}
          onClose={() => setViewModalOpen(false)}
          title={`Appel d'offre ${selectedAppelOffre.numero}`}
          size="large"
        >
          <div className="view-document">
            <div className="view-header">
              <div>
                <p><strong>Date :</strong> {formatDate(selectedAppelOffre.date)}</p>
                <p><strong>Client :</strong> {selectedAppelOffre.client_nom}</p>
                <p><strong>Objet :</strong> {selectedAppelOffre.objet}</p>
              </div>
              <div>
                {getStatutBadge(selectedAppelOffre.statut)}
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
                {selectedAppelOffre.lignes.map((ligne, index) => (
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
                <strong>{formatPrice(selectedAppelOffre.total_ht)} FCFA</strong>
              </div>
              <div className="totaux-row">
                <span>TVA ({selectedAppelOffre.total_ht ? Math.round((selectedAppelOffre.tva / selectedAppelOffre.total_ht) * 100) : 18}%) :</span>
                <strong>{formatPrice(selectedAppelOffre.tva)} FCFA</strong>
              </div>
              <div className="totaux-row total">
                <span>Total TTC :</span>
                <strong>{formatPrice(selectedAppelOffre.total_ttc)} FCFA</strong>
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

      <datalist id="appels-offres-unites-list">
        {uniteSuggestions.map((u) => (
          <option key={u} value={u} />
        ))}
      </datalist>
    </div>
  );
};

export default AppelsOffres;
