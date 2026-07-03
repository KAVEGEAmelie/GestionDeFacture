import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, Trash2, Printer, Download, Plus, X, FileText } from 'lucide-react';
import Modal from '../components/modals/Modal';
import FilterBar from '../components/Filters/FilterBar';
import PeriodFilter from '../components/Filters/PeriodFilter';
import { inDateRange } from '../utils/dateFilters';
import { generateBordereauPDF } from '../utils/pdfGenerator';
import { useToast } from '../components/Toast/ToastProvider';
import { useConfirm } from '../components/ConfirmDialog/ConfirmProvider';
import { getErrorMessage } from '../utils/errors';
import { matchesWordPrefix } from '../utils/search';
import useBulkSelection, { bulkDelete } from '../hooks/useBulkSelection';
import SearchableSelect from '../components/Inputs/SearchableSelect';
import './Clients.css';
import './Proformas.css';

const Bordereaux = () => {
  const toast = useToast();
  const confirm = useConfirm();
  const navigate = useNavigate();
  const [bordereaux, setBordereaux] = useState([]);
  const [clients, setClients] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'date', direction: 'desc' });
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [parametres, setParametres] = useState({});
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [selectedBordereau, setSelectedBordereau] = useState(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const emptyLigne = { designation: '', quantite: '' };
  const [createForm, setCreateForm] = useState({
    date: new Date().toISOString().split('T')[0],
    client_id: '',
    lignes: [{ ...emptyLigne }]
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [bordereauxData, parametresData, clientsData] = await Promise.all([
      window.electronAPI.bordereaux.getAll(),
      window.electronAPI.parametres.getAll(),
      window.electronAPI.clients.getAll()
    ]);
    setBordereaux(bordereauxData);
    setParametres(parametresData);
    setClients(clientsData || []);
  };

  const openCreateModal = () => {
    setCreateForm({
      date: new Date().toISOString().split('T')[0],
      client_id: '',
      lignes: [{ ...emptyLigne }]
    });
    setCreateModalOpen(true);
  };

  const updateLigne = (index, field, value) => {
    setCreateForm((prev) => {
      const lignes = prev.lignes.map((l, i) => (i === index ? { ...l, [field]: value } : l));
      return { ...prev, lignes };
    });
  };

  const addLigne = () => {
    setCreateForm((prev) => ({ ...prev, lignes: [...prev.lignes, { ...emptyLigne }] }));
  };

  const removeLigne = (index) => {
    setCreateForm((prev) => ({
      ...prev,
      lignes: prev.lignes.length > 1 ? prev.lignes.filter((_, i) => i !== index) : prev.lignes
    }));
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!createForm.client_id) {
      toast.error('Sélectionnez un client.');
      return;
    }
    const lignes = createForm.lignes
      .filter((l) => l.designation.trim())
      .map((l) => ({ designation: l.designation.trim(), quantite: parseFloat(l.quantite) || 0 }));
    if (lignes.length === 0) {
      toast.error('Ajoutez au moins une ligne avec une désignation.');
      return;
    }
    try {
      const res = await window.electronAPI.bordereaux.create({
        date: createForm.date,
        client_id: parseInt(createForm.client_id, 10),
        lignes
      });
      toast.success(`Bordereau ${res.numero} créé avec succès.`);
      setCreateModalOpen(false);
      loadData();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Erreur lors de la création du bordereau.'));
    }
  };

  const handleView = async (bordereau) => {
    const fullBordereau = await window.electronAPI.bordereaux.getById(bordereau.id);
    setSelectedBordereau(fullBordereau);
    setViewModalOpen(true);
  };

  const handleDelete = async (id) => {
    const ok = await confirm({
      title: 'Supprimer le bordereau',
      message: 'Êtes-vous sûr de vouloir supprimer ce bordereau ? Cette action est irréversible.',
      confirmText: 'Supprimer',
      danger: true,
    });
    if (!ok) return;
    try {
      await window.electronAPI.bordereaux.delete(id);
      toast.success('Bordereau supprimé avec succès.');
      loadData();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Erreur lors de la suppression du bordereau.'));
    }
  };

  const handlePrint = async (bordereau) => {
    const fullBordereau = await window.electronAPI.bordereaux.getById(bordereau.id);
    const doc = await generateBordereauPDF(fullBordereau, parametres);
    doc.autoPrint();
    window.open(doc.output('bloburl'), '_blank');
  };

  const handleExport = async (bordereau) => {
    const fullBordereau = await window.electronAPI.bordereaux.getById(bordereau.id);
    const doc = await generateBordereauPDF(fullBordereau, parametres);
    doc.save(`Bordereau_${fullBordereau.numero.replace(/\//g, '-')}.pdf`);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('fr-FR');
  };

  const filteredBordereaux = bordereaux.filter((b) => {
    const term = searchTerm.toLowerCase();
    const matchSearch =
      !term ||
      matchesWordPrefix(b.numero, term) ||
      matchesWordPrefix(b.client_nom, term);
    const matchDate = inDateRange(b.date, dateFrom, dateTo);
    return matchSearch && matchDate;
  });

  const sortedFilteredBordereaux = useMemo(() => {
    const items = [...filteredBordereaux];
    const { key, direction } = sortConfig;
    const factor = direction === 'asc' ? 1 : -1;
    return items.sort((a, b) => {
      if (key === 'date') {
        return ((new Date(a.date).getTime() || 0) - (new Date(b.date).getTime() || 0)) * factor;
      }
      return String(a[key] || '').localeCompare(String(b[key] || ''), 'fr', { sensitivity: 'base' }) * factor;
    });
  }, [filteredBordereaux, sortConfig]);

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

  const activeCount = dateFrom || dateTo ? 1 : 0;

  const resetFilters = () => {
    setDateFrom('');
    setDateTo('');
  };

  const selection = useBulkSelection(sortedFilteredBordereaux);
  const handleBulkDelete = () =>
    bulkDelete({
      ids: selection.selectedIds,
      deleteFn: (id) => window.electronAPI.bordereaux.delete(id),
      confirm,
      toast,
      reload: loadData,
      clear: selection.clear,
      labels: { confirmTitle: 'Supprimer les bordereaux', singular: 'bordereau', plural: 'bordereaux' },
    });

  // Fusionner les bordereaux sélectionnés en une proforma (prix à saisir)
  const handleCreateProformaFromSelection = async () => {
    if (selection.count === 0) {
      toast.error('Sélectionnez au moins un bordereau.');
      return;
    }
    try {
      const fulls = await Promise.all(
        selection.selectedIds.map((id) => window.electronAPI.bordereaux.getById(id))
      );

      // Tous les bordereaux doivent appartenir au même client
      const clientIds = Array.from(new Set(fulls.map((b) => b.client_id)));
      if (clientIds.length > 1) {
        toast.error('Les bordereaux sélectionnés doivent appartenir au même client.');
        return;
      }

      const ok = await confirm({
        title: 'Créer une proforma',
        message: `Créer une proforma à partir de ${fulls.length} bordereau(x) (${fulls.map((b) => b.numero).join(', ')}) ? Les lignes seront regroupées et vous pourrez saisir les prix avant d'enregistrer.`,
        confirmText: 'Continuer',
        danger: false,
      });
      if (!ok) return;

      // Regrouper les lignes : même désignation => quantités additionnées
      const merged = new Map();
      fulls.forEach((b) => {
        (b.lignes || []).forEach((l) => {
          const key = String(l.designation || '').trim().toLowerCase();
          if (merged.has(key)) {
            merged.get(key).quantite += Number(l.quantite) || 0;
          } else {
            merged.set(key, {
              designation: l.designation,
              quantite: Number(l.quantite) || 0,
            });
          }
        });
      });

      selection.clear();
      navigate('/proformas', {
        state: {
          prefill: {
            client_id: String(clientIds[0]),
            objet: `Livraisons ${fulls.map((b) => b.numero).join(', ')}`,
            lignes: Array.from(merged.values()),
          },
        },
      });
    } catch (error) {
      toast.error(getErrorMessage(error, 'Erreur lors de la préparation de la proforma.'));
    }
  };

  return (
    <div className="page fade-in">
      <div className="page-header">
        <div>
          <h1>Bordereaux de Livraison</h1>
          <p className="subtitle">Gérez vos bordereaux de livraison</p>
        </div>
        <div className="header-actions">
          {selection.count > 0 && (
            <>
              <button className="btn btn-secondary" onClick={handleCreateProformaFromSelection}>
                <FileText size={18} />
                Créer une proforma ({selection.count})
              </button>
              <button className="btn btn-danger bulk-delete-btn" onClick={handleBulkDelete}>
                <Trash2 size={18} />
                Supprimer la sélection ({selection.count})
              </button>
            </>
          )}
          <button className="btn btn-primary" onClick={openCreateModal}>
            <Plus size={18} />
            Nouveau bordereau
          </button>
        </div>
      </div>

      <div className="content-card">
        <FilterBar
          searchValue={searchTerm}
          onSearchChange={setSearchTerm}
          searchPlaceholder="Rechercher par numéro ou client..."
          activeCount={activeCount}
          onReset={resetFilters}
        >
          <PeriodFilter
            label="Date du bordereau"
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
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedFilteredBordereaux.length === 0 ? (
                <tr>
                  <td colSpan="5" className="empty-state">
                    {searchTerm || activeCount > 0 ? 'Aucun bordereau trouvé' : 'Aucun bordereau enregistré'}
                  </td>
                </tr>
              ) : (
                sortedFilteredBordereaux.map((bordereau) => (
                  <tr key={bordereau.id}>
                    <td className="select-col">
                      <input
                        type="checkbox"
                        checked={selection.isSelected(bordereau.id)}
                        onChange={() => selection.toggle(bordereau.id)}
                        title="Sélectionner"
                      />
                    </td>
                    <td className="font-semibold">{bordereau.numero}</td>
                    <td>{formatDate(bordereau.date)}</td>
                    <td>{bordereau.client_nom}</td>
                    <td>
                      <div className="action-buttons">
                        <button
                          className="btn-icon btn-icon-primary"
                          onClick={() => handleView(bordereau)}
                          title="Voir"
                        >
                          <Eye size={16} />
                        </button>
                        <button
                          className="btn-icon btn-icon-success"
                          onClick={() => handlePrint(bordereau)}
                          title="Imprimer"
                        >
                          <Printer size={16} />
                        </button>
                        <button
                          className="btn-icon btn-icon-info"
                          onClick={() => handleExport(bordereau)}
                          title="Exporter PDF"
                        >
                          <Download size={16} />
                        </button>
                        <button
                          className="btn-icon btn-icon-danger"
                          onClick={() => handleDelete(bordereau.id)}
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

      {/* Modal Création bordereau autonome */}
      <Modal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Nouveau bordereau de livraison"
        size="large"
      >
        <form onSubmit={handleCreateSubmit} className="form">
          <div className="form-row">
            <div className="form-group">
              <label>Date *</label>
              <input
                type="date"
                value={createForm.date}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, date: e.target.value }))}
                required
              />
            </div>
            <div className="form-group">
              <label>Client *</label>
              <SearchableSelect
                options={clients.map((c) => ({ value: String(c.id), label: c.nom }))}
                value={createForm.client_id}
                onChange={(clientId) => setCreateForm((prev) => ({ ...prev, client_id: clientId }))}
                placeholder="Rechercher un client"
                noOptionsText="Aucun client correspondant"
              />
            </div>
          </div>

          <div className="form-group">
            <label>Lignes du bordereau *</label>
            {createForm.lignes.map((ligne, index) => (
              <div key={index} className="form-row" style={{ alignItems: 'flex-end', marginBottom: '0.5rem' }}>
                <div className="form-group" style={{ flex: 3, marginBottom: 0 }}>
                  <input
                    type="text"
                    placeholder="Désignation"
                    value={ligne.designation}
                    onChange={(e) => updateLigne(index, 'designation', e.target.value)}
                  />
                </div>
                <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    placeholder="Quantité"
                    value={ligne.quantite}
                    onChange={(e) => updateLigne(index, 'quantite', e.target.value)}
                  />
                </div>
                <button
                  type="button"
                  className="btn-icon btn-icon-danger"
                  onClick={() => removeLigne(index)}
                  title="Retirer cette ligne"
                  disabled={createForm.lignes.length === 1}
                >
                  <X size={16} />
                </button>
              </div>
            ))}
            <button type="button" className="btn btn-secondary btn-sm" onClick={addLigne}>
              <Plus size={16} />
              Ajouter une ligne
            </button>
          </div>

          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={() => setCreateModalOpen(false)}>
              Annuler
            </button>
            <button type="submit" className="btn btn-primary">
              Créer le bordereau
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal Visualisation */}
      {selectedBordereau && (
        <Modal
          isOpen={viewModalOpen}
          onClose={() => setViewModalOpen(false)}
          title={`Bordereau de Livraison ${selectedBordereau.numero}`}
          size="large"
        >
          <div className="view-document">
            <div className="view-header">
              <div>
                <p><strong>Date :</strong> {formatDate(selectedBordereau.date)}</p>
                <p><strong>Client :</strong> {selectedBordereau.client_nom}</p>
                {selectedBordereau.client_adresse && (
                  <p><strong>Adresse :</strong> {selectedBordereau.client_adresse}</p>
                )}
              </div>
            </div>

            <table className="view-table">
              <thead>
                <tr>
                  <th>Désignation</th>
                  <th>Quantité</th>
                </tr>
              </thead>
              <tbody>
                {selectedBordereau.lignes.map((ligne, index) => (
                  <tr key={index}>
                    <td>{ligne.designation}</td>
                    <td>{ligne.quantite}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{ marginTop: '2rem', padding: '1rem', backgroundColor: '#f9fafb', borderRadius: '8px' }}>
              <p style={{ fontSize: '0.875rem', color: '#6b7280', fontStyle: 'italic' }}>
                ITS reste propriétaire de la marchandise livrée à compter du jour de la livraison jusqu'à complet paiement de l'intégralité de la facture.
              </p>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default Bordereaux;
