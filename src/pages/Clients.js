import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Search } from 'lucide-react';
import Modal from '../components/modals/Modal';
import './Clients.css';

const Clients = () => {
  const [clients, setClients] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [formData, setFormData] = useState({
    nom: '',
    adresse: '',
    telephone: '',
    email: '',
    nif: ''
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
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (editingClient) {
      await window.electronAPI.clients.update(editingClient.id, formData);
    } else {
      await window.electronAPI.clients.create(formData);
    }
    
    loadClients();
    closeModal();
  };

  const handleEdit = (client) => {
    setEditingClient(client);
    setFormData({
      nom: client.nom,
      adresse: client.adresse || '',
      telephone: client.telephone || '',
      email: client.email || '',
      nif: client.nif || ''
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer ce client ?')) {
      await window.electronAPI.clients.delete(id);
      loadClients();
    }
  };

  const openModal = () => {
    setEditingClient(null);
    setFormData({
      nom: '',
      adresse: '',
      telephone: '',
      email: '',
      nif: ''
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingClient(null);
  };

  const filteredClients = clients.filter(client =>
    client.nom.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (client.telephone && client.telephone.includes(searchTerm)) ||
    (client.email && client.email.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="page fade-in">
      <div className="page-header">
        <div>
          <h1>Gestion des Clients</h1>
          <p className="subtitle">Gérez votre base de clients</p>
        </div>
        <button className="btn btn-primary" onClick={openModal}>
          <Plus size={20} />
          Nouveau client
        </button>
      </div>

      <div className="content-card">
        <div className="search-bar">
          <Search size={20} />
          <input
            type="text"
            placeholder="Rechercher un client..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Nom</th>
                <th>Téléphone</th>
                <th>Email</th>
                <th>Adresse</th>
                <th>NIF</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredClients.length === 0 ? (
                <tr>
                  <td colSpan="6" className="empty-state">
                    {searchTerm ? 'Aucun client trouvé' : 'Aucun client enregistré'}
                  </td>
                </tr>
              ) : (
                filteredClients.map((client) => (
                  <tr key={client.id}>
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
