import React, { useState, useEffect } from 'react';
import { Eye, Trash2, Printer, Download } from 'lucide-react';
import Modal from '../components/modals/Modal';
import FilterBar from '../components/Filters/FilterBar';
import PeriodFilter from '../components/Filters/PeriodFilter';
import { inDateRange } from '../utils/dateFilters';
import { generateBordereauPDF } from '../utils/pdfGenerator';
import { useToast } from '../components/Toast/ToastProvider';
import { useConfirm } from '../components/ConfirmDialog/ConfirmProvider';
import { getErrorMessage } from '../utils/errors';
import './Clients.css';
import './Proformas.css';

const Bordereaux = () => {
  const toast = useToast();
  const confirm = useConfirm();
  const [bordereaux, setBordereaux] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [parametres, setParametres] = useState({});
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [selectedBordereau, setSelectedBordereau] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [bordereauxData, parametresData] = await Promise.all([
      window.electronAPI.bordereaux.getAll(),
      window.electronAPI.parametres.getAll()
    ]);
    setBordereaux(bordereauxData);
    setParametres(parametresData);
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
      (b.numero && b.numero.toLowerCase().includes(term)) ||
      (b.client_nom && b.client_nom.toLowerCase().includes(term));
    const matchDate = inDateRange(b.date, dateFrom, dateTo);
    return matchSearch && matchDate;
  });

  const activeCount = dateFrom || dateTo ? 1 : 0;

  const resetFilters = () => {
    setDateFrom('');
    setDateTo('');
  };

  return (
    <div className="page fade-in">
      <div className="page-header">
        <div>
          <h1>Bordereaux de Livraison</h1>
          <p className="subtitle">Gérez vos bordereaux de livraison</p>
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
                <th>N°</th>
                <th>Date</th>
                <th>Client</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredBordereaux.length === 0 ? (
                <tr>
                  <td colSpan="4" className="empty-state">
                    {searchTerm || activeCount > 0 ? 'Aucun bordereau trouvé' : 'Aucun bordereau enregistré'}
                  </td>
                </tr>
              ) : (
                filteredBordereaux.map((bordereau) => (
                  <tr key={bordereau.id}>
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
