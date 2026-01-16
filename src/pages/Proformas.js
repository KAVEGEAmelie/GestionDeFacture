import React, { useState, useEffect } from 'react';
import { Plus, Eye, Trash2, FileText, DollarSign, Printer, Download, PackagePlus } from 'lucide-react';
import Modal from '../components/modals/Modal';
import { generateProformaPDF } from '../utils/pdfGenerator';
import './Clients.css';
import './Proformas.css';

const Proformas = () => {
  const [proformas, setProformas] = useState([]);
  const [clients, setClients] = useState([]);
  const [produits, setProduits] = useState([]);
  const [parametres, setParametres] = useState({});
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [selectedProforma, setSelectedProforma] = useState(null);
  const [addProductModalOpen, setAddProductModalOpen] = useState(false);
  const [newProduct, setNewProduct] = useState({
    designation: '',
    prix_unitaire: '',
    unite: 'Unité',
    description: ''
  });
  
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    client_id: '',
    objet: 'Consommables informatiques',
    prestations: 0,
    remise: 0,
    lignes: []
  });

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

  const handleAddLigne = () => {
    setFormData({
      ...formData,
      lignes: [...formData.lignes, {
        produit_id: '',
        designation: '',
        unite: 'Unité',
        quantite: 1,
        prix_unitaire: 0,
        montant: 0
      }]
    });
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
        newLignes[index].designation = produit.designation;
        newLignes[index].unite = produit.unite;
        newLignes[index].prix_unitaire = produit.prix_unitaire;
      }
    }

    // Recalculer le montant
    if (field === 'quantite' || field === 'prix_unitaire') {
      const quantite = parseFloat(newLignes[index].quantite) || 0;
      const prixUnitaire = parseFloat(newLignes[index].prix_unitaire) || 0;
      newLignes[index].montant = quantite * prixUnitaire;
    }

    setFormData({ ...formData, lignes: newLignes });
  };

  const calculateTotals = () => {
    const total_materiel_ht = formData.lignes.reduce((sum, ligne) => sum + (ligne.montant || 0), 0);
    const prestations = parseFloat(formData.prestations) || 0;
    const remise = parseFloat(formData.remise) || 0;
    const total_ht = total_materiel_ht + prestations - remise;
    const tva = total_ht * 0.18;
    const total_ttc = total_ht + tva;
    return { total_materiel_ht, prestations, remise, total_ht, tva, total_ttc };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (formData.lignes.length === 0) {
      alert('Veuillez ajouter au moins une ligne');
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
      lignes: formData.lignes.map(l => ({
        produit_id: parseInt(l.produit_id),
        designation: l.designation,
        unite: l.unite,
        quantite: parseFloat(l.quantite),
        prix_unitaire: parseFloat(l.prix_unitaire),
        montant: l.montant
      }))
    };

    await window.electronAPI.proformas.create(data);
    loadData();
    closeModal();
  };

  const handleView = async (proforma) => {
    const fullProforma = await window.electronAPI.proformas.getById(proforma.id);
    setSelectedProforma(fullProforma);
    setViewModalOpen(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer cette proforma ?')) {
      await window.electronAPI.proformas.delete(id);
      loadData();
    }
  };

  const handleAddProduct = async (e) => {
    e.preventDefault();
    await window.electronAPI.produits.create({
      ...newProduct,
      prix_unitaire: parseFloat(newProduct.prix_unitaire)
    });
    await loadData();
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
    const doc = await generateProformaPDF(fullProforma, parametres);
    doc.autoPrint();
    window.open(doc.output('bloburl'), '_blank');
  };

  const handleExport = async (proforma) => {
    const fullProforma = await window.electronAPI.proformas.getById(proforma.id);
    const doc = await generateProformaPDF(fullProforma, parametres);
    doc.save(`Proforma_${fullProforma.numero.replace(/\//g, '-')}.pdf`);
  };

  const openModal = () => {
    setFormData({
      date: new Date().toISOString().split('T')[0],
      client_id: '',
      objet: 'Consommables informatiques',
      prestations: 0,
      remise: 0,
      lignes: []
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
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

  const { total_materiel_ht, prestations, remise, total_ht, tva, total_ttc } = calculateTotals();

  return (
    <div className="page fade-in">
      <div className="page-header">
        <div>
          <h1>Factures Proforma</h1>
          <p className="subtitle">Créez et gérez vos factures proforma</p>
        </div>
        <button className="btn btn-primary" onClick={openModal}>
          <Plus size={20} />
          Nouvelle proforma
        </button>
      </div>

      <div className="content-card">
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>N°</th>
                <th>Date</th>
                <th>Client</th>
                <th>Objet</th>
                <th>Montant TTC</th>
                <th>Statut</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {proformas.length === 0 ? (
                <tr>
                  <td colSpan="7" className="empty-state">
                    Aucune proforma enregistrée
                  </td>
                </tr>
              ) : (
                proformas.map((proforma) => (
                  <tr key={proforma.id}>
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
                          className="btn-icon btn-icon-success"
                          onClick={() => handlePrint(proforma)}
                          title="Imprimer"
                        >
                          <Printer size={16} />
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
        title="Nouvelle facture proforma"
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
              <select
                value={formData.client_id}
                onChange={(e) => setFormData({ ...formData, client_id: e.target.value })}
                required
              >
                <option value="">Sélectionner un client</option>
                {clients.map(client => (
                  <option key={client.id} value={client.id}>{client.nom}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>Objet *</label>
            <input
              type="text"
              value={formData.objet}
              onChange={(e) => setFormData({ ...formData, objet: e.target.value })}
              required
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Prestations (FCFA)</label>
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

          <div className="lignes-section">
            <div className="lignes-header">
              <h3>Lignes de la proforma</h3>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button type="button" className="btn btn-secondary btn-sm" onClick={handleAddLigne}>
                  <Plus size={16} />
                  Ajouter une ligne
                </button>
                <button type="button" className="btn btn-success btn-sm" onClick={() => setAddProductModalOpen(true)}>
                  <PackagePlus size={16} />
                  Nouveau produit
                </button>
              </div>
            </div>

            {formData.lignes.map((ligne, index) => (
              <div key={index} className="ligne-item">
                <div className="ligne-grid">
                  <div className="form-group">
                    <label>Produit</label>
                    <select
                      value={ligne.produit_id}
                      onChange={(e) => handleLigneChange(index, 'produit_id', e.target.value)}
                      required
                    >
                      <option value="">Sélectionner</option>
                      {produits.map(produit => (
                        <option key={produit.id} value={produit.id}>{produit.designation}</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Désignation</label>
                    <input
                      type="text"
                      value={ligne.designation}
                      onChange={(e) => handleLigneChange(index, 'designation', e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Unité</label>
                    <input
                      type="text"
                      value={ligne.unite}
                      onChange={(e) => handleLigneChange(index, 'unite', e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Quantité</label>
                    <input
                      type="number"
                      value={ligne.quantite}
                      onChange={(e) => handleLigneChange(index, 'quantite', e.target.value)}
                      min="0"
                      step="1"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Prix unitaire</label>
                    <input
                      type="number"
                      value={ligne.prix_unitaire}
                      onChange={(e) => handleLigneChange(index, 'prix_unitaire', e.target.value)}
                      min="0"
                      step="0.01"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Montant</label>
                    <input
                      type="text"
                      value={formatPrice(ligne.montant)}
                      readOnly
                      className="readonly"
                    />
                  </div>

                  <button
                    type="button"
                    className="btn-remove-ligne"
                    onClick={() => handleRemoveLigne(index)}
                    title="Supprimer"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="totaux-section">
            <div className="totaux-grid">
              <div className="totaux-item">
                <span>Total Matériel HT :</span>
                <strong>{formatPrice(total_materiel_ht)} FCFA</strong>
              </div>
              <div className="totaux-item">
                <span>Prestations :</span>
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
                <span>TVA (18%) :</span>
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
              Créer la proforma
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
                <span>TVA (18%) :</span>
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
              <label>Prix unitaire *</label>
              <input
                type="number"
                value={newProduct.prix_unitaire}
                onChange={(e) => setNewProduct({ ...newProduct, prix_unitaire: e.target.value })}
                min="0"
                step="0.01"
                required
              />
            </div>

            <div className="form-group">
              <label>Unité *</label>
              <input
                type="text"
                value={newProduct.unite}
                onChange={(e) => setNewProduct({ ...newProduct, unite: e.target.value })}
                required
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
    </div>
  );
};

export default Proformas;
