import React, { useState, useEffect, useMemo } from 'react';
import { Eye, Trash2, FileCheck, Truck, Printer, Download, CheckCircle, RotateCcw, Edit2, Plus, FolderPlus } from 'lucide-react';
import Modal from '../components/modals/Modal';
import FilterBar from '../components/Filters/FilterBar';
import PeriodFilter from '../components/Filters/PeriodFilter';
import { inDateRange, inNumberRange } from '../utils/dateFilters';
import { generateFacturePDF } from '../utils/pdfGenerator';
import { useToast } from '../components/Toast/ToastProvider';
import { useConfirm } from '../components/ConfirmDialog/ConfirmProvider';
import { getErrorMessage } from '../utils/errors';
import { matchesWordPrefix } from '../utils/search';
import useBulkSelection, { bulkDelete } from '../hooks/useBulkSelection';
import './Clients.css';
import './Proformas.css';
import { useNavigate } from 'react-router-dom';

const Factures = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const [factures, setFactures] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [paiementFilter, setPaiementFilter] = useState('tous');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [montantMin, setMontantMin] = useState('');
  const [montantMax, setMontantMax] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'date', direction: 'desc' });
  const [proformas, setProformas] = useState([]);
  const [parametres, setParametres] = useState({});
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [convertModalOpen, setConvertModalOpen] = useState(false);
  const [convertDate, setConvertDate] = useState(new Date().toISOString().split('T')[0]);
  const [convertSearchTerm, setConvertSearchTerm] = useState('');
  const [selectedFacture, setSelectedFacture] = useState(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingFacture, setEditingFacture] = useState(null);
  const [editForm, setEditForm] = useState({
    date: '',
    objet: '',
    prestations: 0,
    remise: 0,
    lignes: []
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [facturesData, proformasData, parametresData] = await Promise.all([
      window.electronAPI.factures.getAll(),
      window.electronAPI.proformas.getAll(),
      window.electronAPI.parametres.getAll()
    ]);
    setFactures(facturesData);
    setProformas(proformasData.filter(p => p.statut === 'en_attente'));
    setParametres(parametresData);
  };

  const handleConvertProforma = async (proformaId) => {
    if (!convertDate) {
      toast.error('Veuillez choisir la date de la facture.');
      return;
    }
    try {
      await window.electronAPI.factures.createFromProforma(proformaId, convertDate);
      toast.success('Facture créée avec succès !');
      loadData();
      setConvertModalOpen(false);
    } catch (error) {
      toast.error(getErrorMessage(error, 'Erreur lors de la création de la facture.'));
    }
  };

  const handleView = async (facture) => {
    const fullFacture = await window.electronAPI.factures.getById(facture.id);
    setSelectedFacture(fullFacture);
    setViewModalOpen(true);
  };

  // —— Édition d'une facture ——
  const handleEdit = async (facture) => {
    const full = await window.electronAPI.factures.getById(facture.id);
    setEditingFacture(full);
    // Reconstruire les séparateurs de section à partir des lignes
    const lignesForm = [];
    let sectionCourante = '';
    (full.lignes || []).forEach((l) => {
      const titre = l.section_titre || '';
      if (titre !== sectionCourante) {
        sectionCourante = titre;
        if (titre) lignesForm.push({ _type: 'section', titre });
      }
      lignesForm.push({
        produit_id: l.produit_id,
        designation: l.designation,
        unite: l.unite,
        quantite: l.quantite,
        prix_unitaire: l.prix_unitaire,
        montant: l.montant
      });
    });
    setEditForm({
      date: full.date,
      objet: full.objet || '',
      prestations: full.prestations || 0,
      remise: full.remise || 0,
      lignes: lignesForm
    });
    setEditModalOpen(true);
  };

  const editLigneChange = (index, field, value) => {
    setEditForm((prev) => {
      const lignes = prev.lignes.map((l, i) => {
        if (i !== index) return l;
        const updated = { ...l, [field]: value };
        if (updated._type !== 'section') {
          const q = parseFloat(updated.quantite) || 0;
          const pu = parseFloat(updated.prix_unitaire) || 0;
          updated.montant = q * pu;
        }
        return updated;
      });
      return { ...prev, lignes };
    });
  };

  const editAddLigne = () => {
    setEditForm((prev) => ({
      ...prev,
      lignes: [...prev.lignes, { produit_id: null, designation: '', unite: 'Unité', quantite: 1, prix_unitaire: 0, montant: 0 }]
    }));
  };

  const editAddSection = () => {
    setEditForm((prev) => ({
      ...prev,
      lignes: [...prev.lignes, { _type: 'section', titre: '' }]
    }));
  };

  const editRemoveLigne = (index) => {
    setEditForm((prev) => ({ ...prev, lignes: prev.lignes.filter((_, i) => i !== index) }));
  };

  const computeEditTotals = () => {
    const total_materiel_ht = editForm.lignes.reduce(
      (sum, l) => (l._type === 'section' ? sum : sum + (l.montant || 0)),
      0
    );
    const prestations = parseFloat(editForm.prestations) || 0;
    const remise = parseFloat(editForm.remise) || 0;
    const total_ht = total_materiel_ht + prestations - remise;
    const tvaApplicable = editingFacture ? (editingFacture.tva || 0) > 0 : true;
    const tauxTVA = parseFloat(parametres.tva_taux) || 18;
    const tva = tvaApplicable ? total_ht * (tauxTVA / 100) : 0;
    const total_ttc = total_ht + tva;
    return { total_materiel_ht, prestations, remise, total_ht, tva, total_ttc, tvaApplicable, tauxTVA };
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    // Aplatir : les séparateurs attribuent leur titre aux lignes suivantes
    let currentSection = '';
    const lignes = [];
    editForm.lignes.forEach((l) => {
      if (l._type === 'section') {
        currentSection = (l.titre || '').trim();
        return;
      }
      if (!String(l.designation || '').trim()) return;
      lignes.push({
        produit_id: Number.isInteger(l.produit_id) ? l.produit_id : null,
        designation: l.designation,
        unite: l.unite,
        quantite: parseFloat(l.quantite) || 0,
        prix_unitaire: parseFloat(l.prix_unitaire) || 0,
        montant: l.montant || 0,
        section_titre: currentSection
      });
    });
    if (lignes.length === 0) {
      toast.error('La facture doit contenir au moins une ligne.');
      return;
    }
    const { total_materiel_ht, prestations, remise, total_ht, tva, total_ttc } = computeEditTotals();
    try {
      await window.electronAPI.factures.update(editingFacture.id, {
        date: editForm.date,
        objet: editForm.objet,
        total_materiel_ht,
        prestations,
        remise,
        total_ht,
        tva,
        total_ttc,
        lignes
      });
      toast.success(`Facture ${editingFacture.numero} modifiée avec succès.`);
      setEditModalOpen(false);
      setEditingFacture(null);
      loadData();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Erreur lors de la modification de la facture.'));
    }
  };

  const handleDelete = async (id) => {
    const ok = await confirm({
      title: 'Supprimer la facture',
      message: 'Êtes-vous sûr de vouloir supprimer cette facture ? Cette action est irréversible.',
      confirmText: 'Supprimer',
      danger: true,
    });
    if (!ok) return;
    try {
      await window.electronAPI.factures.delete(id);
      toast.success('Facture supprimée avec succès.');
      loadData();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Erreur lors de la suppression de la facture.'));
    }
  };

  const handlePrint = async (facture) => {
    const fullFacture = await window.electronAPI.factures.getById(facture.id);
    const doc = await generateFacturePDF(fullFacture, parametres);
    doc.autoPrint();
    window.open(doc.output('bloburl'), '_blank');
  };

  const handleExport = async (facture) => {
    const fullFacture = await window.electronAPI.factures.getById(facture.id);
    const doc = await generateFacturePDF(fullFacture, parametres);
    doc.save(`Facture_${fullFacture.numero.replace(/\//g, '-')}.pdf`);
  };

  const handleCreateBordereau = async (factureId) => {
    const ok = await confirm({
      title: 'Créer un bordereau',
      message: 'Créer un bordereau de livraison pour cette facture ?',
      confirmText: 'Créer',
    });
    if (!ok) return;
    try {
      await window.electronAPI.bordereaux.createFromFacture(factureId);
      toast.success('Bordereau créé avec succès !');
      navigate('/bordereaux');
    } catch (error) {
      toast.error(getErrorMessage(error, 'Erreur lors de la création du bordereau.'));
    }
  };

  const handleMarkPaid = async (facture) => {
    const ok = await confirm({
      title: 'Valider le paiement',
      message: `Confirmer que la facture ${facture.numero} a été payée par le client ? Sa TVA passera en « TVA à reverser à l'OTR ».`,
      confirmText: 'Valider le paiement',
    });
    if (!ok) return;
    try {
      await window.electronAPI.factures.markPaid(facture.id);
      toast.success('Paiement enregistré. La TVA est désormais à reverser à l\'OTR.');
      loadData();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Erreur lors de la validation du paiement.'));
    }
  };

  const handleMarkUnpaid = async (facture) => {
    const ok = await confirm({
      title: 'Annuler le paiement',
      message: `Marquer la facture ${facture.numero} comme non payée ?`,
      confirmText: 'Annuler le paiement',
      danger: true,
    });
    if (!ok) return;
    try {
      await window.electronAPI.factures.markUnpaid(facture.id);
      toast.success('Facture marquée comme non payée.');
      loadData();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Erreur lors de l\'annulation du paiement.'));
    }
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('fr-FR').format(price);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('fr-FR');
  };

  const getPaiementBadge = (facture) => {
    if (facture.statut_paiement === 'payee') {
      return <span className="badge badge-success">Payée</span>;
    }
    return <span className="badge badge-warning">Non payée</span>;
  };

  const filteredFactures = factures.filter((f) => {
    const term = searchTerm.toLowerCase();
    const matchSearch =
      !term ||
      matchesWordPrefix(f.numero, term) ||
      matchesWordPrefix(f.client_nom, term) ||
      matchesWordPrefix(f.objet, term);
    const matchPaiement =
      paiementFilter === 'tous' ||
      (paiementFilter === 'payee' && f.statut_paiement === 'payee') ||
      (paiementFilter === 'non_payee' && f.statut_paiement !== 'payee');
    const matchDate = inDateRange(f.date, dateFrom, dateTo);
    const matchMontant = inNumberRange(f.total_ttc, montantMin, montantMax);
    return matchSearch && matchPaiement && matchDate && matchMontant;
  });

  const sortedFilteredFactures = useMemo(() => {
    const items = [...filteredFactures];
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
  }, [filteredFactures, sortConfig]);

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

  const filteredProformasForConvert = useMemo(() => {
    const term = convertSearchTerm.toLowerCase();
    if (!term) return proformas;
    return proformas.filter((p) =>
      matchesWordPrefix(p.numero, term) ||
      matchesWordPrefix(p.client_nom, term) ||
      matchesWordPrefix(p.objet, term)
    );
  }, [proformas, convertSearchTerm]);

  const activeCount =
    (paiementFilter !== 'tous' ? 1 : 0) +
    (dateFrom || dateTo ? 1 : 0) +
    (montantMin !== '' || montantMax !== '' ? 1 : 0);

  const resetFilters = () => {
    setPaiementFilter('tous');
    setDateFrom('');
    setDateTo('');
    setMontantMin('');
    setMontantMax('');
  };

  const selection = useBulkSelection(sortedFilteredFactures);
  const handleBulkDelete = () =>
    bulkDelete({
      ids: selection.selectedIds,
      deleteFn: (id) => window.electronAPI.factures.delete(id),
      confirm,
      toast,
      reload: loadData,
      clear: selection.clear,
      labels: { confirmTitle: 'Supprimer les factures', singular: 'facture', plural: 'factures' },
    });

  return (
    <div className="page fade-in">
      <div className="page-header">
        <div>
          <h1>Factures Définitives</h1>
          <p className="subtitle">Gérez vos factures définitives</p>
        </div>
        <div className="header-actions">
          {selection.count > 0 && (
            <button className="btn btn-danger bulk-delete-btn" onClick={handleBulkDelete}>
              <Trash2 size={18} />
              Supprimer la sélection ({selection.count})
            </button>
          )}
          <button className="btn btn-primary" onClick={() => { setConvertDate(new Date().toISOString().split('T')[0]); setConvertModalOpen(true); }}>
            <FileCheck size={20} />
            Convertir une proforma
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
            <label>Paiement</label>
            <select
              className="filter-select"
              value={paiementFilter}
              onChange={(e) => setPaiementFilter(e.target.value)}
            >
              <option value="tous">Tous les paiements</option>
              <option value="payee">Payées</option>
              <option value="non_payee">Non payées</option>
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
            label="Date de la facture"
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
                <th onClick={() => toggleSort('statut_paiement')} style={{ cursor: 'pointer' }}>Paiement{sortMark('statut_paiement')}</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedFilteredFactures.length === 0 ? (
                <tr>
                  <td colSpan="8" className="empty-state">
                    {searchTerm || activeCount > 0 ? 'Aucune facture trouvée' : 'Aucune facture enregistrée'}
                  </td>
                </tr>
              ) : (
                sortedFilteredFactures.map((facture) => (
                  <tr key={facture.id}>
                    <td className="select-col">
                      <input
                        type="checkbox"
                        checked={selection.isSelected(facture.id)}
                        onChange={() => selection.toggle(facture.id)}
                        title="Sélectionner"
                      />
                    </td>
                    <td className="font-semibold">{facture.numero}</td>
                    <td>{formatDate(facture.date)}</td>
                    <td>{facture.client_nom}</td>
                    <td>{facture.objet}</td>
                    <td>{formatPrice(facture.total_ttc)} FCFA</td>
                    <td>{getPaiementBadge(facture)}</td>
                    <td>
                      <div className="action-buttons">
                        {facture.statut_paiement === 'payee' ? (
                          <button
                            className="btn-icon"
                            style={{ color: '#f59e0b' }}
                            onClick={() => handleMarkUnpaid(facture)}
                            title="Annuler le paiement"
                          >
                            <RotateCcw size={16} />
                          </button>
                        ) : (
                          <button
                            className="btn-icon"
                            style={{ color: '#10b981' }}
                            onClick={() => handleMarkPaid(facture)}
                            title="Valider le paiement"
                          >
                            <CheckCircle size={16} />
                          </button>
                        )}
                        <button
                          className="btn-icon btn-icon-primary"
                          onClick={() => handleView(facture)}
                          title="Voir"
                        >
                          <Eye size={16} />
                        </button>
                        <button
                          className="btn-icon"
                          style={{ color: '#f59e0b' }}
                          onClick={() => handleEdit(facture)}
                          title="Modifier"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          className="btn-icon btn-icon-success"
                          onClick={() => handlePrint(facture)}
                          title="Imprimer"
                        >
                          <Printer size={16} />
                        </button>
                        <button
                          className="btn-icon btn-icon-info"
                          onClick={() => handleExport(facture)}
                          title="Exporter PDF"
                        >
                          <Download size={16} />
                        </button>
                        <button
                          className="btn-icon"
                          style={{ color: '#10b981' }}
                          onClick={() => handleCreateBordereau(facture.id)}
                          title="Créer bordereau"
                        >
                          <Truck size={16} />
                        </button>
                        <button
                          className="btn-icon btn-icon-danger"
                          onClick={() => handleDelete(facture.id)}
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

      {/* Modal Modification Facture */}
      <Modal
        isOpen={editModalOpen}
        onClose={() => { setEditModalOpen(false); setEditingFacture(null); }}
        title={editingFacture ? `Modifier la facture ${editingFacture.numero}` : 'Modifier la facture'}
        size="xlarge"
      >
        {editingFacture && (
          <form onSubmit={handleEditSubmit} className="form">
            <div className="form-row">
              <div className="form-group">
                <label>Date *</label>
                <input
                  type="date"
                  value={editForm.date}
                  onChange={(e) => setEditForm({ ...editForm, date: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Client</label>
                <input type="text" value={editingFacture.client_nom || ''} readOnly className="readonly" />
              </div>
            </div>

            <div className="form-group">
              <label>Objet</label>
              <input
                type="text"
                value={editForm.objet}
                onChange={(e) => setEditForm({ ...editForm, objet: e.target.value })}
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Main d'œuvre (FCFA)</label>
                <input
                  type="number"
                  value={editForm.prestations}
                  onChange={(e) => setEditForm({ ...editForm, prestations: e.target.value })}
                  min="0"
                  step="0.01"
                />
              </div>
              <div className="form-group">
                <label>Remise (FCFA)</label>
                <input
                  type="number"
                  value={editForm.remise}
                  onChange={(e) => setEditForm({ ...editForm, remise: e.target.value })}
                  min="0"
                  step="0.01"
                />
              </div>
            </div>

            <div className="lignes-section">
              <div className="lignes-header">
                <h3>Lignes de la facture</h3>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={editAddSection} title="Regrouper les lignes suivantes sous un titre avec sous-total">
                    <FolderPlus size={16} />
                    Ajouter une section
                  </button>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={editAddLigne}>
                    <Plus size={16} />
                    Ajouter une ligne
                  </button>
                </div>
              </div>

              {editForm.lignes.length === 0 ? (
                <div className="ligne-empty-state">Aucune ligne.</div>
              ) : (
                <div className="ligne-table-wrapper">
                  <table className="data-table ligne-table">
                    <thead>
                      <tr>
                        <th>Désignation</th>
                        <th>Unité</th>
                        <th>Quantité</th>
                        <th>Prix unitaire</th>
                        <th>Montant</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {editForm.lignes.map((ligne, index) => {
                        if (ligne._type === 'section') {
                          let sousTotal = 0;
                          for (let i = index + 1; i < editForm.lignes.length; i++) {
                            if (editForm.lignes[i]._type === 'section') break;
                            sousTotal += editForm.lignes[i].montant || 0;
                          }
                          return (
                            <tr key={index}>
                              <td colSpan="4" style={{ background: '#eef2ff', padding: '0.4rem 0.6rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                  <FolderPlus size={16} style={{ color: '#1e3a8a', flexShrink: 0 }} />
                                  <input
                                    type="text"
                                    value={ligne.titre}
                                    onChange={(e) => editLigneChange(index, 'titre', e.target.value)}
                                    placeholder="Titre de la section"
                                    style={{ fontWeight: 700, color: '#1e3a8a', background: 'transparent', border: 'none', borderBottom: '1px dashed #94a3b8', width: '100%' }}
                                  />
                                </div>
                              </td>
                              <td style={{ background: '#eef2ff', textAlign: 'right', fontWeight: 700, color: '#1e3a8a' }}>
                                {formatPrice(sousTotal)}
                              </td>
                              <td style={{ background: '#eef2ff' }}>
                                <button
                                  type="button"
                                  className="btn-remove-ligne"
                                  onClick={() => editRemoveLigne(index)}
                                  title="Supprimer la section (les lignes sont conservées)"
                                >
                                  <Trash2 size={18} />
                                </button>
                              </td>
                            </tr>
                          );
                        }
                        return (
                          <tr key={index}>
                            <td>
                              <input
                                type="text"
                                value={ligne.designation}
                                onChange={(e) => editLigneChange(index, 'designation', e.target.value)}
                              />
                            </td>
                            <td>
                              <input
                                type="text"
                                value={ligne.unite}
                                onChange={(e) => editLigneChange(index, 'unite', e.target.value)}
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                value={ligne.quantite}
                                onChange={(e) => editLigneChange(index, 'quantite', e.target.value)}
                                min="0"
                                step="1"
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                value={ligne.prix_unitaire}
                                onChange={(e) => editLigneChange(index, 'prix_unitaire', e.target.value)}
                                min="0"
                                step="0.01"
                              />
                            </td>
                            <td>
                              <input type="text" value={formatPrice(ligne.montant)} readOnly className="readonly" />
                            </td>
                            <td>
                              <button
                                type="button"
                                className="btn-remove-ligne"
                                onClick={() => editRemoveLigne(index)}
                                title="Supprimer"
                              >
                                <Trash2 size={18} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {(() => {
              const t = computeEditTotals();
              return (
                <div className="totaux-section">
                  <div className="totaux-grid">
                    <div className="totaux-item">
                      <span>Total Matériel HT :</span>
                      <strong>{formatPrice(t.total_materiel_ht)} FCFA</strong>
                    </div>
                    <div className="totaux-item">
                      <span>Main d'œuvre :</span>
                      <strong>{formatPrice(t.prestations)} FCFA</strong>
                    </div>
                    <div className="totaux-item">
                      <span>Remise :</span>
                      <strong>- {formatPrice(t.remise)} FCFA</strong>
                    </div>
                    <div className="totaux-item">
                      <span>Total HT :</span>
                      <strong>{formatPrice(t.total_ht)} FCFA</strong>
                    </div>
                    <div className="totaux-item">
                      <span>TVA ({t.tvaApplicable ? t.tauxTVA : 0}%) :</span>
                      <strong>{formatPrice(t.tva)} FCFA</strong>
                    </div>
                    <div className="totaux-item total-ttc">
                      <span>Total TTC :</span>
                      <strong>{formatPrice(t.total_ttc)} FCFA</strong>
                    </div>
                  </div>
                </div>
              );
            })()}

            <div className="form-actions">
              <button type="button" className="btn btn-secondary" onClick={() => { setEditModalOpen(false); setEditingFacture(null); }}>
                Annuler
              </button>
              <button type="submit" className="btn btn-primary">
                Enregistrer les modifications
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Modal Conversion Proforma */}
      <Modal
        isOpen={convertModalOpen}
        onClose={() => setConvertModalOpen(false)}
        title="Convertir une proforma en facture"
        size="large"
      >
        <div className="convert-list">
          {proformas.length === 0 ? (
            <p className="empty-message">Aucune proforma disponible pour conversion</p>
          ) : (
            <>
              <div className="form-group" style={{ marginBottom: '1rem', maxWidth: '260px' }}>
                <label htmlFor="convert-date">Date de la facture</label>
                <input
                  id="convert-date"
                  type="date"
                  className="form-control"
                  value={convertDate}
                  onChange={(e) => setConvertDate(e.target.value)}
                />
              </div>
              <div className="form-group" style={{ marginBottom: '1rem', maxWidth: '420px' }}>
                <label htmlFor="convert-search">Rechercher une proforma</label>
                <input
                  id="convert-search"
                  type="text"
                  className="form-control"
                  value={convertSearchTerm}
                  onChange={(e) => setConvertSearchTerm(e.target.value)}
                  placeholder="Tapez numéro, client ou objet"
                />
              </div>
              <table className="data-table">
              <thead>
                <tr>
                  <th>N°</th>
                  <th>Date</th>
                  <th>Client</th>
                  <th>Montant TTC</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredProformasForConvert.map((proforma) => (
                  <tr key={proforma.id}>
                    <td>{proforma.numero}</td>
                    <td>{formatDate(proforma.date)}</td>
                    <td>{proforma.client_nom}</td>
                    <td>{formatPrice(proforma.total_ttc)} FCFA</td>
                    <td>
                      <button
                        className="btn btn-success btn-sm"
                        onClick={() => handleConvertProforma(proforma.id)}
                      >
                        Convertir
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredProformasForConvert.length === 0 && (
                  <tr>
                    <td colSpan="5" className="empty-state">Aucune proforma ne correspond à la recherche.</td>
                  </tr>
                )}
              </tbody>
            </table>
            </>
          )}
        </div>
      </Modal>

      {/* Modal Visualisation */}
      {selectedFacture && (
        <Modal
          isOpen={viewModalOpen}
          onClose={() => setViewModalOpen(false)}
          title={`Facture ${selectedFacture.numero}`}
          size="large"
        >
          <div className="view-document">
            <div className="view-header">
              <div>
                <p><strong>Date :</strong> {formatDate(selectedFacture.date)}</p>
                <p><strong>Client :</strong> {selectedFacture.client_nom}</p>
                <p><strong>Objet :</strong> {selectedFacture.objet}</p>
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
                {selectedFacture.lignes.map((ligne, index) => (
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
                <strong>{formatPrice(selectedFacture.total_ht)} FCFA</strong>
              </div>
              <div className="totaux-row">
                <span>TVA ({selectedFacture.total_ht ? Math.round((selectedFacture.tva / selectedFacture.total_ht) * 100) : 18}%) :</span>
                <strong>{formatPrice(selectedFacture.tva)} FCFA</strong>
              </div>
              <div className="totaux-row total">
                <span>Total TTC :</span>
                <strong>{formatPrice(selectedFacture.total_ttc)} FCFA</strong>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default Factures;
