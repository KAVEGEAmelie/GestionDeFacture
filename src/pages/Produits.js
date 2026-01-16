import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Search } from 'lucide-react';
import Modal from '../components/modals/Modal';
import './Clients.css';

const Produits = () => {
  const [produits, setProduits] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
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
      prix_unitaire: parseFloat(formData.prix_unitaire)
    };

    if (editingProduit) {
      await window.electronAPI.produits.update(editingProduit.id, data);
    } else {
      await window.electronAPI.produits.create(data);
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
    if (window.confirm('Êtes-vous sûr de vouloir supprimer ce produit ?')) {
      await window.electronAPI.produits.delete(id);
      loadProduits();
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

  const filteredProduits = produits.filter(produit =>
    produit.designation.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
        <div className="search-bar">
          <Search size={20} />
          <input
            type="text"
            placeholder="Rechercher un produit..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

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
                    {searchTerm ? 'Aucun produit trouvé' : 'Aucun produit enregistré'}
                  </td>
                </tr>
              ) : (
                filteredProduits.map((produit) => (
                  <tr key={produit.id}>
                    <td className="font-semibold">{produit.designation}</td>
                    <td>{formatPrice(produit.prix_unitaire)} FCFA</td>
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
              <label>Prix unitaire * (FCFA)</label>
              <input
                type="number"
                name="prix_unitaire"
                value={formData.prix_unitaire}
                onChange={handleInputChange}
                required
                min="0"
                step="0.01"
                placeholder="Ex: 1500"
              />
            </div>

            <div className="form-group">
              <label>Unité *</label>
              <select
                name="unite"
                value={formData.unite}
                onChange={handleInputChange}
                required
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
