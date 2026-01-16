import React, { useState, useEffect } from 'react';
import { Eye, Trash2, FileCheck, Truck, Printer, Download } from 'lucide-react';
import Modal from '../components/modals/Modal';
import { generateFacturePDF } from '../utils/pdfGenerator';
import './Clients.css';
import './Proformas.css';
import { useNavigate } from 'react-router-dom';

const Factures = () => {
  const navigate = useNavigate();
  const [factures, setFactures] = useState([]);
  const [proformas, setProformas] = useState([]);
  const [parametres, setParametres] = useState({});
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [convertModalOpen, setConvertModalOpen] = useState(false);
  const [selectedFacture, setSelectedFacture] = useState(null);

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
    try {
      await window.electronAPI.factures.createFromProforma(proformaId);
      alert('Facture créée avec succès !');
      loadData();
      setConvertModalOpen(false);
    } catch (error) {
      alert('Erreur lors de la création de la facture');
    }
  };

  const handleView = async (facture) => {
    const fullFacture = await window.electronAPI.factures.getById(facture.id);
    setSelectedFacture(fullFacture);
    setViewModalOpen(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer cette facture ?')) {
      await window.electronAPI.factures.delete(id);
      loadData();
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
    if (window.confirm('Créer un bordereau de livraison pour cette facture ?')) {
      try {
        await window.electronAPI.bordereaux.createFromFacture(factureId);
        alert('Bordereau créé avec succès !');
        navigate('/bordereaux');
      } catch (error) {
        alert('Erreur lors de la création du bordereau');
      }
    }
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('fr-FR').format(price);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('fr-FR');
  };

  return (
    <div className="page fade-in">
      <div className="page-header">
        <div>
          <h1>Factures Définitives</h1>
          <p className="subtitle">Gérez vos factures définitives</p>
        </div>
        <button className="btn btn-primary" onClick={() => setConvertModalOpen(true)}>
          <FileCheck size={20} />
          Convertir une proforma
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
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {factures.length === 0 ? (
                <tr>
                  <td colSpan="6" className="empty-state">
                    Aucune facture enregistrée
                  </td>
                </tr>
              ) : (
                factures.map((facture) => (
                  <tr key={facture.id}>
                    <td className="font-semibold">{facture.numero}</td>
                    <td>{formatDate(facture.date)}</td>
                    <td>{facture.client_nom}</td>
                    <td>{facture.objet}</td>
                    <td>{formatPrice(facture.total_ttc)} FCFA</td>
                    <td>
                      <div className="action-buttons">
                        <button
                          className="btn-icon btn-icon-primary"
                          onClick={() => handleView(facture)}
                          title="Voir"
                        >
                          <Eye size={16} />
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
                {proformas.map((proforma) => (
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
              </tbody>
            </table>
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
                <span>TVA (18%) :</span>
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
