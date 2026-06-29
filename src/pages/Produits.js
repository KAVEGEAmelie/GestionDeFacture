import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Edit2, Trash2 } from 'lucide-react';
import Modal from '../components/modals/Modal';
import FilterBar from '../components/Filters/FilterBar';
import PeriodFilter from '../components/Filters/PeriodFilter';
import { inDateRange, inNumberRange } from '../utils/dateFilters';
import { useToast } from '../components/Toast/ToastProvider';
import { useConfirm } from '../components/ConfirmDialog/ConfirmProvider';
import { getErrorMessage } from '../utils/errors';
import { matchesWordPrefix } from '../utils/search';
import useBulkSelection, { bulkDelete } from '../hooks/useBulkSelection';
import SearchableSelect from '../components/Inputs/SearchableSelect';
import './Clients.css';

const UNIT_PRESETS = ['Unité', 'Pièce', 'Lot', 'Gros', 'Kilogramme', 'Mètre', 'Litre', 'Heure', 'Jour'];

const Produits = () => {
  const toast = useToast();
  const confirm = useConfirm();
  const [produits, setProduits] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [uniteFilter, setUniteFilter] = useState('toutes');
  const [prixMin, setPrixMin] = useState('');
  const [prixMax, setPrixMax] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'designation', direction: 'asc' });
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduit, setEditingProduit] = useState(null);
  const [formData, setFormData] = useState({
    designation: '',
    prix_unitaire: '',
    unite: 'Unité',
    description: ''
  });

  useEffect(() => {
    loadProduits();
  }, []);

  const loadProduits = async () => {
    const data = await window.electronAPI.produits.getAll();
    setProduits(data);
  };

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const data = {
      ...formData,
      prix_unitaire: parseFloat(formData.prix_unitaire) || 0
    };

    if (editingProduit) {
      try {
        await window.electronAPI.produits.update(editingProduit.id, data);
        toast.success('Produit modifié avec succès.');
      } catch (error) {
        toast.error(getErrorMessage(error, 'Erreur lors de l\'enregistrement du produit.'));
        return;
      }
    } else {
      try {
        await window.electronAPI.produits.create(data);
        toast.success('Produit ajouté avec succès.');
      } catch (error) {
        toast.error(getErrorMessage(error, 'Erreur lors de l\'enregistrement du produit.'));
        return;
      }
    }
    
    loadProduits();
    closeModal();
  };

  const handleEdit = (produit) => {
    setEditingProduit(produit);
    setFormData({
      designation: produit.designation,
      prix_unitaire: produit.prix_unitaire.toString(),
      unite: produit.unite,
      description: produit.description || ''
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id) => {
    const ok = await confirm({
      title: 'Supprimer le produit',
      message: 'Êtes-vous sûr de vouloir supprimer ce produit ? Cette action est irréversible.',
      confirmText: 'Supprimer',
      danger: true,
    });
    if (!ok) return;
    try {
      await window.electronAPI.produits.delete(id);
      toast.success('Produit supprimé avec succès.');
      loadProduits();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Erreur lors de la suppression du produit.'));
    }
  };

  const openModal = () => {
    setEditingProduit(null);
    setFormData({
      designation: '',
      prix_unitaire: '',
      unite: 'Unité',
      description: ''
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingProduit(null);
  };

  const unitesDisponibles = Array.from(
    new Set([
      ...UNIT_PRESETS,
      ...produits.map((p) => String(p.unite || '').trim()).filter(Boolean),
    ])
  ).sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' }));

  const filteredProduits = produits.filter((produit) => {
    const term = searchTerm.toLowerCase().trim();
    const matchSearch =
      !term ||
      matchesWordPrefix(produit.designation, term) ||
      matchesWordPrefix(produit.description, term);
    const matchUnite = uniteFilter === 'toutes' || produit.unite === uniteFilter;
    const matchPrix = inNumberRange(produit.prix_unitaire, prixMin, prixMax);
    const matchDate = inDateRange(produit.created_at, dateFrom, dateTo);
    return matchSearch && matchUnite && matchPrix && matchDate;
  });

  const sortedFilteredProduits = useMemo(() => {
    const items = [...filteredProduits];
    const { key, direction } = sortConfig;
    const factor = direction === 'asc' ? 1 : -1;
    return items.sort((a, b) => {
      if (key === 'prix_unitaire') {
        return ((Number(a.prix_unitaire) || 0) - (Number(b.prix_unitaire) || 0)) * factor;
      }
      return String(a[key] || '').localeCompare(String(b[key] || ''), 'fr', { sensitivity: 'base' }) * factor;
    });
  }, [filteredProduits, sortConfig]);

  const toggleSort = (key) => {
    setSortConfig((prev) =>
      prev.key === key
        ? { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
        : { key, direction: 'asc' }
    );
  };

  const sortMark = (key) => {
    if (sortConfig.key !== key) return ' ↕';
    return sortConfig.direction === 'asc' ? ' ↑' : ' ↓';
  };

  const activeCount =
    (uniteFilter !== 'toutes' ? 1 : 0) +
    (prixMin !== '' || prixMax !== '' ? 1 : 0) +
    (dateFrom || dateTo ? 1 : 0);

  const resetFilters = () => {
    setUniteFilter('toutes');
    setPrixMin('');
    setPrixMax('');
    setDateFrom('');
    setDateTo('');
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('fr-FR').format(price);
  };

  const selection = useBulkSelection(sortedFilteredProduits);
  const handleBulkDelete = () =>
    bulkDelete({
      ids: selection.selectedIds,
      deleteFn: (id) => window.electronAPI.produits.delete(id),
      confirm,
      toast,
      reload: loadProduits,
      clear: selection.clear,
      labels: { confirmTitle: 'Supprimer les produits', singular: 'produit', plural: 'produits' },
    });

  return (
    <div className="page fade-in">
      <div className="page-header">
        <div>
          <h1>Gestion des Produits</h1>
          <p className="subtitle">Gérez votre catalogue de produits</p>
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
            Nouveau produit
          </button>
        </div>
      </div>

      <div className="content-card">
        <FilterBar
          searchValue={searchTerm}
          onSearchChange={setSearchTerm}
          searchPlaceholder="Rechercher un produit (désignation, description)..."
          activeCount={activeCount}
          onReset={resetFilters}
        >
          <div className="filter-group">
            <label>Unité</label>
            <input
              className="filter-select"
              list="produits-unites-filter-list"
              placeholder="Toutes les unités"
              value={uniteFilter === 'toutes' ? '' : uniteFilter}
              onChange={(e) => setUniteFilter(e.target.value.trim() || 'toutes')}
            />
            <datalist id="produits-unites-filter-list">
              {unitesDisponibles.map((u) => (
                <option key={u} value={u} />
              ))}
            </datalist>
          </div>

          <div className="filter-group">
            <label>Prix unitaire (FCFA)</label>
            <div className="filter-range">
              <input
                type="number"
                min="0"
                placeholder="Min"
                value={prixMin}
                onChange={(e) => setPrixMin(e.target.value)}
              />
              <span>—</span>
              <input
                type="number"
                min="0"
                placeholder="Max"
                value={prixMax}
                onChange={(e) => setPrixMax(e.target.value)}
              />
            </div>
          </div>

          <PeriodFilter
            label="Date de création"
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
                <th onClick={() => toggleSort('designation')} style={{ cursor: 'pointer' }}>Désignation{sortMark('designation')}</th>
                <th onClick={() => toggleSort('prix_unitaire')} style={{ cursor: 'pointer' }}>Prix unitaire{sortMark('prix_unitaire')}</th>
                <th onClick={() => toggleSort('unite')} style={{ cursor: 'pointer' }}>Unité{sortMark('unite')}</th>
                <th onClick={() => toggleSort('description')} style={{ cursor: 'pointer' }}>Description{sortMark('description')}</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedFilteredProduits.length === 0 ? (
                <tr>
                  <td colSpan="6" className="empty-state">
                    {searchTerm || activeCount > 0 ? 'Aucun produit trouvé' : 'Aucun produit enregistré'}
                  </td>
                </tr>
              ) : (
                sortedFilteredProduits.map((produit) => (
                  <tr key={produit.id}>
                    <td className="select-col">
                      <input
                        type="checkbox"
                        checked={selection.isSelected(produit.id)}
                        onChange={() => selection.toggle(produit.id)}
                        title="Sélectionner"
                      />
                    </td>
                    <td className="font-semibold">{produit.designation}</td>
                    <td>
                      {produit.prix_unitaire > 0 ? (
                        `${formatPrice(produit.prix_unitaire)} FCFA`
                      ) : (
                        <span className="badge badge-warning">À fixer</span>
                      )}
                    </td>
                    <td>{produit.unite}</td>
                    <td>{produit.description || '-'}</td>
                    <td>
                      <div className="action-buttons">
                        <button
                          className="btn-icon btn-icon-primary"
                          onClick={() => handleEdit(produit)}
                          title="Modifier"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          className="btn-icon btn-icon-danger"
                          onClick={() => handleDelete(produit.id)}
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

      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        title={editingProduit ? 'Modifier le produit' : 'Nouveau produit'}
        size="medium"
      >
        <form onSubmit={handleSubmit} className="form">
          <div className="form-group">
            <label>Désignation *</label>
            <input
              type="text"
              name="designation"
              value={formData.designation}
              onChange={handleInputChange}
              required
              placeholder="Ex: Bobines Thermiques pour imprimante"
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Prix unitaire (FCFA)</label>
              <input
                type="number"
                name="prix_unitaire"
                value={formData.prix_unitaire}
                onChange={handleInputChange}
                min="0"
                step="0.01"
                placeholder="Optionnel — à fixer selon le client"
              />
            </div>

            <div className="form-group">
              <label>Unité</label>
              <SearchableSelect
                options={unitesDisponibles.map((unite) => ({ value: unite, label: unite }))}
                value={formData.unite}
                onChange={(uniteValue, option) =>
                  setFormData((prev) => ({ ...prev, unite: option?.label || uniteValue }))
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
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              placeholder="Description détaillée du produit"
            />
          </div>

          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={closeModal}>
              Annuler
            </button>
            <button type="submit" className="btn btn-primary">
              {editingProduit ? 'Modifier' : 'Créer'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Produits;
