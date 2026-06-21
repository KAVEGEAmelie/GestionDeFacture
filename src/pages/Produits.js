import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2 } from 'lucide-react';
import Modal from '../components/modals/Modal';
import FilterBar from '../components/Filters/FilterBar';
import PeriodFilter from '../components/Filters/PeriodFilter';
import { inDateRange, inNumberRange } from '../utils/dateFilters';
import { useToast } from '../components/Toast/ToastProvider';
import { useConfirm } from '../components/ConfirmDialog/ConfirmProvider';
import { getErrorMessage } from '../utils/errors';
import './Clients.css';

const Produits = () => {
  const toast = useToast();
  const confirm = useConfirm();
  const [produits, setProduits] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [uniteFilter, setUniteFilter] = useState('toutes');
  const [prixMin, setPrixMin] = useState('');
  const [prixMax, setPrixMax] = useState('');
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
    new Set(produits.map((p) => p.unite).filter(Boolean))
  ).sort();

  const filteredProduits = produits.filter((produit) => {
    const term = searchTerm.toLowerCase().trim();
    const matchSearch =
      !term ||
      (produit.designation || '').toLowerCase().includes(term) ||
      (produit.description || '').toLowerCase().includes(term);
    const matchUnite = uniteFilter === 'toutes' || produit.unite === uniteFilter;
    const matchPrix = inNumberRange(produit.prix_unitaire, prixMin, prixMax);
    const matchDate = inDateRange(produit.created_at, dateFrom, dateTo);
    return matchSearch && matchUnite && matchPrix && matchDate;
  });

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

  return (
    <div className="page fade-in">
      <div className="page-header">
        <div>
          <h1>Gestion des Produits</h1>
          <p className="subtitle">Gérez votre catalogue de produits</p>
        </div>
        <button className="btn btn-primary" onClick={openModal}>
          <Plus size={20} />
          Nouveau produit
        </button>
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
            <select
              className="filter-select"
              value={uniteFilter}
              onChange={(e) => setUniteFilter(e.target.value)}
            >
              <option value="toutes">Toutes les unités</option>
              {unitesDisponibles.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
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
                <th>Désignation</th>
                <th>Prix unitaire</th>
                <th>Unité</th>
                <th>Description</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredProduits.length === 0 ? (
                <tr>
                  <td colSpan="5" className="empty-state">
                    {searchTerm || activeCount > 0 ? 'Aucun produit trouvé' : 'Aucun produit enregistré'}
                  </td>
                </tr>
              ) : (
                filteredProduits.map((produit) => (
                  <tr key={produit.id}>
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
              <select
                name="unite"
                value={formData.unite}
                onChange={handleInputChange}
              >
                <option value="Unité">Unité</option>
                <option value="Pièce">Pièce</option>
                <option value="Lot">Lot</option>
                <option value="Kg">Kilogramme</option>
                <option value="Mètre">Mètre</option>
                <option value="Litre">Litre</option>
                <option value="Heure">Heure</option>
                <option value="Jour">Jour</option>
              </select>
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
