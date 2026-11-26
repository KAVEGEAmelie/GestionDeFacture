import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Edit2, Trash2 } from 'lucide-react';
import Modal from '../components/modals/Modal';
import FilterBar from '../components/Filters/FilterBar';
import { useToast } from '../components/Toast/ToastProvider';
import { useConfirm } from '../components/ConfirmDialog/ConfirmProvider';
import { getErrorMessage } from '../utils/errors';
import { matchesWordPrefix } from '../utils/search';
import useBulkSelection, { bulkDelete } from '../hooks/useBulkSelection';
import './Clients.css';

const Clients = () => {
  const toast = useToast();
  const confirm = useConfirm();
  const [clients, setClients] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchField, setSearchField] = useState('tous');
  const [sortConfig, setSortConfig] = useState({ key: 'nom', direction: 'asc' });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [formData, setFormData] = useState({
    nom: '',
    adresse: '',
    telephone: '',
    email: '',
    nif: '',
    tva_applicable: true
  });

  // Charger les clients
  useEffect(() => {
    loadClients();
  }, []);

  const loadClients = async () => {
    const data = await window.electronAPI.clients.getAll();
    setClients(data);
  };

  const handleInputChange = (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setFormData({
      ...formData,
      [e.target.name]: value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      if (editingClient) {
        await window.electronAPI.clients.update(editingClient.id, formData);
        toast.success('Client modifié avec succès.');
      } else {
        await window.electronAPI.clients.create(formData);
        toast.success('Client ajouté avec succès.');
      }
      loadClients();
      closeModal();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Erreur lors de l\'enregistrement du client.'));
    }
  };

  const handleEdit = (client) => {
    setEditingClient(client);
    setFormData({
      nom: client.nom,
      adresse: client.adresse || '',
      telephone: client.telephone || '',
      email: client.email || '',
      nif: client.nif || '',
      tva_applicable: client.tva_applicable === 1
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id) => {
    const ok = await confirm({
      title: 'Supprimer le client',
      message: 'Êtes-vous sûr de vouloir supprimer ce client ? Cette action est irréversible.',
      confirmText: 'Supprimer',
      danger: true,
    });
    if (!ok) return;
    try {
      await window.electronAPI.clients.delete(id);
      toast.success('Client supprimé avec succès.');
      loadClients();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Erreur lors de la suppression du client.'));
    }
  };

  const openModal = () => {
    setEditingClient(null);
    setFormData({
      nom: '',
      adresse: '',
      telephone: '',
      email: '',
      nif: '',
      tva_applicable: true
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingClient(null);
  };

  const matchField = (client, field, term) => {
    switch (field) {
      case 'nom':
        return matchesWordPrefix(client.nom, term);
      case 'email':
        return matchesWordPrefix(client.email, term);
      case 'telephone':
        return matchesWordPrefix(client.telephone, term);
      case 'nif':
        return matchesWordPrefix(client.nif, term);
      case 'adresse':
        return matchesWordPrefix(client.adresse, term);
      default:
        return (
          matchesWordPrefix(client.nom, term) ||
          matchesWordPrefix(client.email, term) ||
          matchesWordPrefix(client.telephone, term) ||
          matchesWordPrefix(client.nif, term) ||
          matchesWordPrefix(client.adresse, term)
        );
    }
  };

  const filteredClients = clients.filter((client) => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return true;
    return matchField(client, searchField, term);
  });

  const sortedClients = useMemo(() => {
    const items = [...filteredClients];
    const { key, direction } = sortConfig;
    const factor = direction === 'asc' ? 1 : -1;
    return items.sort((a, b) =>
      String(a[key] || '').localeCompare(String(b[key] || ''), 'fr', { sensitivity: 'base' }) * factor
    );
  }, [filteredClients, sortConfig]);

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

  const activeCount = searchField !== 'tous' ? 1 : 0;

  const resetFilters = () => {
    setSearchField('tous');
  };

  const selection = useBulkSelection(sortedClients);
  const handleBulkDelete = () =>
    bulkDelete({
      ids: selection.selectedIds,
      deleteFn: (id) => window.electronAPI.clients.delete(id),
      confirm,
      toast,
      reload: loadClients,
      clear: selection.clear,
      labels: { confirmTitle: 'Supprimer les clients', singular: 'client', plural: 'clients' },
    });

  return (
    <div className="page fade-in">
      <div className="page-header">
        <div>
          <h1>Gestion des Clients</h1>
          <p className="subtitle">Gérez votre base de clients</p>
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
            Nouveau client
          </button>
        </div>
      </div>

      <div className="content-card">
        <FilterBar
          searchValue={searchTerm}
          onSearchChange={setSearchTerm}
          searchPlaceholder="Rechercher un client (nom, email, téléphone, NIF, adresse)..."
          activeCount={activeCount}
          onReset={resetFilters}
        >
          <div className="filter-group">
            <label>Rechercher dans le champ</label>
            <select
              className="filter-select"
              value={searchField}
              onChange={(e) => setSearchField(e.target.value)}
            >
              <option value="tous">Tous les champs</option>
              <option value="nom">Nom / Raison sociale</option>
              <option value="email">Email</option>
              <option value="telephone">Téléphone</option>
              <option value="nif">NIF</option>
              <option value="adresse">Adresse</option>
            </select>
          </div>
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
                <th onClick={() => toggleSort('nom')} style={{ cursor: 'pointer' }}>Nom{sortMark('nom')}</th>
                <th onClick={() => toggleSort('telephone')} style={{ cursor: 'pointer' }}>Téléphone{sortMark('telephone')}</th>
                <th onClick={() => toggleSort('email')} style={{ cursor: 'pointer' }}>Email{sortMark('email')}</th>
                <th onClick={() => toggleSort('adresse')} style={{ cursor: 'pointer' }}>Adresse{sortMark('adresse')}</th>
                <th onClick={() => toggleSort('nif')} style={{ cursor: 'pointer' }}>NIF{sortMark('nif')}</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedClients.length === 0 ? (
                <tr>
                  <td colSpan="7" className="empty-state">
                    {searchTerm ? 'Aucun client trouvé' : 'Aucun client enregistré'}
                  </td>
                </tr>
              ) : (
                sortedClients.map((client) => (
                  <tr key={client.id}>
                    <td className="select-col">
                      <input
                        type="checkbox"
                        checked={selection.isSelected(client.id)}
                        onChange={() => selection.toggle(client.id)}
                        title="Sélectionner"
                      />
                    </td>
                    <td className="font-semibold">{client.nom}</td>
                    <td>{client.telephone || '-'}</td>
                    <td>{client.email || '-'}</td>
                    <td>{client.adresse || '-'}</td>
                    <td>{client.nif || '-'}</td>
                    <td>
                      <div className="action-buttons">
                        <button
                          className="btn-icon btn-icon-primary"
                          onClick={() => handleEdit(client)}
                          title="Modifier"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          className="btn-icon btn-icon-danger"
                          onClick={() => handleDelete(client.id)}
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
        title={editingClient ? 'Modifier le client' : 'Nouveau client'}
        size="medium"
      >
        <form onSubmit={handleSubmit} className="form">
          <div className="form-group">
            <label>Nom / Raison sociale *</label>
            <input
              type="text"
              name="nom"
              value={formData.nom}
              onChange={handleInputChange}
              required
              placeholder="Ex: CHR-Tomdè"
            />
          </div>

          <div className="form-group">
            <label>Adresse</label>
            <input
              type="text"
              name="adresse"
              value={formData.adresse}
              onChange={handleInputChange}
              placeholder="Ex: 20 Av. du RPT, Lomé"
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Téléphone</label>
              <input
                type="text"
                name="telephone"
                value={formData.telephone}
                onChange={handleInputChange}
                placeholder="Ex: +228 90 11 66 86"
              />
            </div>

            <div className="form-group">
              <label>Email</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                placeholder="Ex: contact@client.com"
              />
            </div>
          </div>

          <div className="form-group">
            <label>NIF / IFU</label>
            <input
              type="text"
              name="nif"
              value={formData.nif}
              onChange={handleInputChange}
              placeholder="Numéro d'identification fiscale"
            />
          </div>

          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={closeModal}>
              Annuler
            </button>
            <button type="submit" className="btn btn-primary">
              {editingClient ? 'Modifier' : 'Créer'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Clients;
