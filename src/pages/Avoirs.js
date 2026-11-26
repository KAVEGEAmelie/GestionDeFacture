import React, { useEffect, useMemo, useState } from 'react';
import { Printer, Download, Trash2 } from 'lucide-react';
import FilterBar from '../components/Filters/FilterBar';
import PeriodFilter from '../components/Filters/PeriodFilter';
import { inDateRange } from '../utils/dateFilters';
import { generateAvoirPDF } from '../utils/pdfGenerator';
import { useToast } from '../components/Toast/ToastProvider';
import { useConfirm } from '../components/ConfirmDialog/ConfirmProvider';
import { getErrorMessage } from '../utils/errors';
import { matchesWordPrefix } from '../utils/search';
import './Clients.css';
import './Proformas.css';

// Liste des avoirs (factures d'avoir). Ils se créent depuis la page
// Factures, sur la facture à annuler en tout ou partie.
const Avoirs = () => {
  const toast = useToast();
  const confirm = useConfirm();
  const [avoirs, setAvoirs] = useState([]);
  const [parametres, setParametres] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const loadData = async () => {
    try {
      const [avoirsData, parametresData] = await Promise.all([
        window.electronAPI.avoirs.getAll(),
        window.electronAPI.parametres.getAll(),
      ]);
      setAvoirs(avoirsData || []);
      setParametres(parametresData || {});
    } catch (error) {
      toast.error(getErrorMessage(error, 'Erreur lors du chargement des avoirs.'));
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const formatPrice = (price) => new Intl.NumberFormat('fr-FR').format(price || 0);
  const formatDate = (dateString) => new Date(dateString).toLocaleDateString('fr-FR');

  const avoirsFiltres = useMemo(() => avoirs.filter((a) => {
    const term = searchTerm.trim();
    const matchSearch = !term
      || matchesWordPrefix(a.numero, term)
      || matchesWordPrefix(a.facture_numero, term)
      || matchesWordPrefix(a.client_nom, term)
      || matchesWordPrefix(a.motif, term);
    return matchSearch && inDateRange(a.date, dateFrom, dateTo);
  }), [avoirs, searchTerm, dateFrom, dateTo]);

  const totalFiltre = avoirsFiltres.reduce((sum, a) => sum + (a.total_ttc || 0), 0);
  const activeCount = dateFrom || dateTo ? 1 : 0;

  const genererPDF = async (avoir) => {
    const full = await window.electronAPI.avoirs.getById(avoir.id);
    if (!full) {
      toast.error('Avoir introuvable. La liste va être actualisée.');
      loadData();
      return null;
    }
    return { full, doc: await generateAvoirPDF(full, parametres) };
  };

  const handlePrint = async (avoir) => {
    const res = await genererPDF(avoir);
    if (!res) return;
    res.doc.autoPrint();
    window.open(res.doc.output('bloburl'), '_blank');
  };

  const handleExport = async (avoir) => {
    const res = await genererPDF(avoir);
    if (!res) return;
    res.doc.save(`Avoir_${res.full.numero.replace(/\//g, '-')}.pdf`);
  };

  const handleDelete = async (avoir) => {
    const ok = await confirm({
      title: "Supprimer l'avoir",
      message: `Supprimer l'avoir ${avoir.numero} ? La facture ${avoir.facture_numero} retrouvera son montant. Ne le faites que si l'avoir n'a pas été remis au client : son numéro ne sera pas réattribué.`,
      confirmText: 'Supprimer',
      danger: true,
    });
    if (!ok) return;
    try {
      await window.electronAPI.avoirs.delete(avoir.id);
      toast.success(`Avoir ${avoir.numero} supprimé.`);
      loadData();
    } catch (error) {
      toast.error(getErrorMessage(error, "Erreur lors de la suppression de l'avoir."));
    }
  };

  return (
    <div className="page fade-in">
      <div className="page-header">
        <div>
          <h1>Avoirs</h1>
          <p className="subtitle">
            Annulations totales ou partielles de factures. Pour créer un avoir, ouvrez la page Factures
            et cliquez sur l'icône rouge de la facture concernée.
          </p>
        </div>
      </div>

      <div className="content-card">
        <FilterBar
          searchValue={searchTerm}
          onSearchChange={setSearchTerm}
          searchPlaceholder="Rechercher par numéro, facture, client ou motif..."
          activeCount={activeCount}
          onReset={() => { setDateFrom(''); setDateTo(''); }}
        >
          <PeriodFilter
            label="Date de l'avoir"
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
                <th>Facture</th>
                <th>Client</th>
                <th>Motif</th>
                <th>Type</th>
                <th>Montant TTC</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {avoirsFiltres.length === 0 ? (
                <tr>
                  <td colSpan="8" className="empty-state">
                    {searchTerm || activeCount > 0 ? 'Aucun avoir trouvé' : 'Aucun avoir enregistré'}
                  </td>
                </tr>
              ) : (
                avoirsFiltres.map((avoir) => (
                  <tr key={avoir.id}>
                    <td className="font-semibold">{avoir.numero}</td>
                    <td>{formatDate(avoir.date)}</td>
                    <td>{avoir.facture_numero}</td>
                    <td>{avoir.client_nom}</td>
                    <td>{avoir.motif}</td>
                    <td>
                      <span className={`badge ${avoir.type === 'total' ? 'badge-danger' : 'badge-warning'}`}>
                        {avoir.type === 'total' ? 'Total' : 'Partiel'}
                      </span>
                    </td>
                    <td>- {formatPrice(avoir.total_ttc)} FCFA</td>
                    <td>
                      <div className="action-buttons">
                        <button className="btn-icon btn-icon-success" onClick={() => handlePrint(avoir)} title="Imprimer">
                          <Printer size={16} />
                        </button>
                        <button className="btn-icon btn-icon-primary" onClick={() => handleExport(avoir)} title="Télécharger le PDF">
                          <Download size={16} />
                        </button>
                        <button className="btn-icon btn-icon-danger" onClick={() => handleDelete(avoir)} title="Supprimer">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {avoirsFiltres.length > 0 && (
              <tfoot>
                <tr>
                  <td colSpan="6" style={{ textAlign: 'right', fontWeight: 600 }}>Total des avoirs affichés</td>
                  <td style={{ fontWeight: 600 }}>- {formatPrice(totalFiltre)} FCFA</td>
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
};

export default Avoirs;
