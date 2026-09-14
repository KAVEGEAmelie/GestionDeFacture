import React, { useState, useEffect, useMemo } from 'react';
import { Landmark, Wallet, CheckCircle, Send, FileDown, FileSpreadsheet, Printer, RotateCcw, Plus, Trash2, ChevronDown, ChevronUp, Coins } from 'lucide-react';
import * as XLSX from 'xlsx';
import FilterBar from '../components/Filters/FilterBar';
import PeriodFilter from '../components/Filters/PeriodFilter';
import Modal from '../components/modals/Modal';
import { inDateRange, inNumberRange } from '../utils/dateFilters';
import { useToast } from '../components/Toast/ToastProvider';
import { useConfirm } from '../components/ConfirmDialog/ConfirmProvider';
import { getErrorMessage } from '../utils/errors';
import { matchesWordPrefix } from '../utils/search';
import { generateTvaPDF } from '../utils/pdfGenerator';
import './Clients.css';
import './Proformas.css';
import './Dashboard.css';

const formatFCFA = (n) => new Intl.NumberFormat('fr-FR').format(Math.round(n || 0)) + ' FCFA';

const formatDate = (d) => (d ? new Date(d).toLocaleDateString('fr-FR') : '-');

const Tva = () => {
  const toast = useToast();
  const confirm = useConfirm();
  const [stats, setStats] = useState({
    tvaNonVersee: 0,
    tvaAVerser: 0,
    nbNonVersee: 0,
    tvaVersee: 0,
    nbVersee: 0,
    aVerser: [],
    versees: [],
    versements: []
  });
  const [selected, setSelected] = useState([]);
  const [activeTab, setActiveTab] = useState('a_verser');
  const [paiementModal, setPaiementModal] = useState(null);
  const [paiementForm, setPaiementForm] = useState({ montant: '', date: '', quittance: '', mode: '', note: '' });
  const [expandedVersements, setExpandedVersements] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [montantMin, setMontantMin] = useState('');
  const [montantMax, setMontantMax] = useState('');
  const [sortAVerser, setSortAVerser] = useState({ key: 'date_paiement', direction: 'desc' });
  const [sortVersees, setSortVersees] = useState({ key: 'date_versement_tva', direction: 'desc' });
  const [parametres, setParametres] = useState({});

  useEffect(() => {
    loadStats();
    loadParametres();
  }, []);

  const loadParametres = async () => {
    try {
      const params = await window.electronAPI.parametres.getAll();
      setParametres(params || {});
    } catch (error) {
      // en-tête du rapport utilisera les valeurs par défaut
    }
  };

  const loadStats = async () => {
    if (!window.electronAPI || !window.electronAPI.tva) {
      toast.error("Module TVA indisponible. Veuillez redémarrer l'application.");
      return;
    }
    const data = await window.electronAPI.tva.getStats();
    setStats(data);
    setSelected([]);
  };

  const matchCommon = (f) => {
    const term = searchTerm.toLowerCase().trim();
    const matchSearch =
      !term ||
      matchesWordPrefix(f.numero, term) ||
      matchesWordPrefix(f.client_nom, term);
    const matchMontant = inNumberRange(f.tva, montantMin, montantMax);
    return matchSearch && matchMontant;
  };

  const filteredAVerser = stats.aVerser.filter(
    (f) => matchCommon(f) && inDateRange(f.date_paiement, dateFrom, dateTo)
  );
  const filteredVersees = stats.versees.filter(
    (f) => matchCommon(f) && inDateRange(f.date_versement_tva, dateFrom, dateTo)
  );

  const sortRows = (rows, config) => {
    const items = [...rows];
    const factor = config.direction === 'asc' ? 1 : -1;
    return items.sort((a, b) => {
      if (config.key === 'date_paiement' || config.key === 'date_versement_tva') {
        return ((new Date(a[config.key]).getTime() || 0) - (new Date(b[config.key]).getTime() || 0)) * factor;
      }
      if (config.key === 'total_ttc' || config.key === 'tva') {
        return ((Number(a[config.key]) || 0) - (Number(b[config.key]) || 0)) * factor;
      }
      return String(a[config.key] || '').localeCompare(String(b[config.key] || ''), 'fr', { sensitivity: 'base' }) * factor;
    });
  };

  const sortedAVerser = useMemo(() => sortRows(filteredAVerser, sortAVerser), [filteredAVerser, sortAVerser]);
  const sortedVersees = useMemo(() => sortRows(filteredVersees, sortVersees), [filteredVersees, sortVersees]);

  const toggleSortAVerser = (key) => {
    setSortAVerser((prev) =>
      prev.key === key
        ? { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
        : { key, direction: key === 'date_paiement' ? 'desc' : 'asc' }
    );
  };

  const toggleSortVersees = (key) => {
    setSortVersees((prev) =>
      prev.key === key
        ? { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
        : { key, direction: key === 'date_versement_tva' ? 'desc' : 'asc' }
    );
  };

  const sortMarkAVerser = (key) => {
    if (sortAVerser.key !== key) return ' ↕';
    return sortAVerser.direction === 'asc' ? ' ↑' : ' ↓';
  };

  const sortMarkVersees = (key) => {
    if (sortVersees.key !== key) return ' ↕';
    return sortVersees.direction === 'asc' ? ' ↑' : ' ↓';
  };

  const activeCount =
    (dateFrom || dateTo ? 1 : 0) +
    (montantMin !== '' || montantMax !== '' ? 1 : 0);

  const resetFilters = () => {
    setDateFrom('');
    setDateTo('');
    setMontantMin('');
    setMontantMax('');
  };

  const toggleSelect = (id) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selected.length === sortedAVerser.length) {
      setSelected([]);
    } else {
      setSelected(sortedAVerser.map((f) => f.id));
    }
  };

  const totalSelectionne = filteredAVerser
    .filter((f) => selected.includes(f.id))
    .reduce((sum, f) => sum + (f.tva || 0), 0);

  const handleVerser = async () => {
    if (selected.length === 0) {
      toast.error('Sélectionnez au moins une facture.');
      return;
    }
    const ok = await confirm({
      title: 'Créer un versement OTR',
      message: `Créer un versement OTR pour ${selected.length} facture(s) ? TVA collectée : ${formatFCFA(totalSelectionne)} — à verser à l'OTR (50 %) : ${formatFCFA(totalSelectionne / 2)}. Vous pourrez ensuite enregistrer vos paiements au fur et à mesure.`,
      confirmText: 'Créer le versement',
    });
    if (!ok) return;
    try {
      const res = await window.electronAPI.tva.verser(selected);
      toast.success(`Versement ${res.numero} créé — à payer à l'OTR : ${formatFCFA(res.totalDu)}.`);
      setActiveTab('versements');
      loadStats();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Erreur lors de la création du versement.'));
    }
  };

  const openPaiement = (v) => {
    setPaiementForm({
      montant: String(Math.round(v.reste) || ''),
      date: new Date().toISOString().split('T')[0],
      quittance: '',
      mode: '',
      note: '',
    });
    setPaiementModal(v);
  };

  const handleAjouterPaiement = async (e) => {
    e.preventDefault();
    const montant = Number(paiementForm.montant);
    if (!montant || montant <= 0) {
      toast.error('Saisissez un montant valide.');
      return;
    }
    try {
      const res = await window.electronAPI.tva.ajouterPaiement(paiementModal.id, { ...paiementForm, montant });
      toast.success(
        res.solde
          ? `Versement ${paiementModal.numero} soldé — TVA marquée comme versée.`
          : `Paiement enregistré. Reste à payer : ${formatFCFA(res.reste)}.`
      );
      setPaiementModal(null);
      loadStats();
    } catch (error) {
      toast.error(getErrorMessage(error, "Erreur lors de l'enregistrement du paiement."));
    }
  };

  const handleSupprimerPaiement = async (v, p) => {
    const ok = await confirm({
      title: 'Supprimer ce paiement',
      message: `Supprimer le paiement de ${formatFCFA(p.montant)} du ${formatDate(p.date)} sur le versement ${v.numero} ?`,
      confirmText: 'Supprimer',
      danger: true,
    });
    if (!ok) return;
    try {
      await window.electronAPI.tva.supprimerPaiement(p.id);
      toast.success('Paiement supprimé.');
      loadStats();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Erreur lors de la suppression du paiement.'));
    }
  };

  const handleAnnulerLot = async (v) => {
    const ok = await confirm({
      title: 'Annuler le versement',
      message: `Annuler le versement ${v.numero} (dû : ${formatFCFA(v.total_du)}, déjà payé : ${formatFCFA(v.paye)}) ? Les paiements enregistrés seront effacés et les factures repasseront dans « TVA à reverser ».`,
      confirmText: 'Annuler le versement',
      danger: true,
    });
    if (!ok) return;
    try {
      await window.electronAPI.tva.annulerVersement(v.id);
      toast.success(`Versement ${v.numero} annulé.`);
      loadStats();
    } catch (error) {
      toast.error(getErrorMessage(error, "Erreur lors de l'annulation du versement."));
    }
  };

  const toggleExpand = (id) => {
    setExpandedVersements((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleAnnulerVersement = async (facture) => {
    const ok = await confirm({
      title: 'Annuler le versement TVA',
      message: `Annuler le versement de la TVA de la facture ${facture.numero} (${formatFCFA(facture.tva)}) ? Elle repassera dans la liste « TVA à reverser ».`,
      confirmText: 'Annuler le versement',
      danger: true,
    });
    if (!ok) return;
    try {
      await window.electronAPI.tva.annuler([facture.id]);
      toast.success(`Versement TVA annulé pour la facture ${facture.numero}.`);
      loadStats();
    } catch (error) {
      toast.error(getErrorMessage(error, "Erreur lors de l'annulation du versement."));
    }
  };

  // Construit le rapport (lignes + totaux) de l'onglet actif
  const buildRapport = () => {
    const estAVerser = activeTab === 'a_verser';
    const source = estAVerser ? filteredAVerser : filteredVersees;
    const lignes = source.map((f) => ({
      numero: f.numero,
      client: f.client_nom,
      date: estAVerser ? formatDate(f.date_paiement) : formatDate(f.date_versement_tva),
      total_ttc: f.total_ttc || 0,
      tva: f.tva || 0,
    }));
    const totalTtc = source.reduce((s, f) => s + (f.total_ttc || 0), 0);
    const totalTva = source.reduce((s, f) => s + (f.tva || 0), 0);
    return {
      estAVerser,
      titre: estAVerser ? 'RAPPORT TVA À REVERSER (OTR)' : 'RAPPORT TVA VERSÉE (OTR)',
      sousTitre: (dateFrom || dateTo)
        ? `Période : ${dateFrom ? formatDate(dateFrom) : '...'} au ${dateTo ? formatDate(dateTo) : '...'}`
        : 'Toutes périodes',
      dateLabel: estAVerser ? 'DATE PAIEMENT' : 'DATE VERSEMENT',
      lignes,
      totalTtc,
      totalTva,
    };
  };

  const handleExportPDF = async (impression = false) => {
    const rapport = buildRapport();
    if (rapport.lignes.length === 0) {
      toast.error('Aucune donnée à exporter.');
      return;
    }
    try {
      const doc = await generateTvaPDF(rapport, parametres);
      if (impression) {
        doc.autoPrint();
        window.open(doc.output('bloburl'), '_blank');
      } else {
        const suffixe = rapport.estAVerser ? 'a-reverser' : 'versee';
        doc.save(`Rapport_TVA_${suffixe}_${new Date().toISOString().slice(0, 10)}.pdf`);
        toast.success('Rapport PDF téléchargé.');
      }
    } catch (error) {
      toast.error(getErrorMessage(error, 'Erreur lors de la génération du PDF.'));
    }
  };

  const handleExportExcel = () => {
    const rapport = buildRapport();
    if (rapport.lignes.length === 0) {
      toast.error('Aucune donnée à exporter.');
      return;
    }
    try {
      const rows = rapport.lignes.map((l, i) => ({
        'N°': i + 1,
        'N° Facture': l.numero,
        'Client': l.client,
        [rapport.estAVerser ? 'Date paiement' : 'Date versement']: l.date,
        'Montant TTC (FCFA)': Math.round(l.total_ttc),
        'TVA (FCFA)': Math.round(l.tva),
      }));
      // Ligne de total
      rows.push({
        'N°': '',
        'N° Facture': '',
        'Client': '',
        [rapport.estAVerser ? 'Date paiement' : 'Date versement']: 'TOTAL',
        'Montant TTC (FCFA)': Math.round(rapport.totalTtc),
        'TVA (FCFA)': Math.round(rapport.totalTva),
      });
      const ws = XLSX.utils.json_to_sheet(rows);
      ws['!cols'] = [{ wch: 5 }, { wch: 16 }, { wch: 28 }, { wch: 16 }, { wch: 18 }, { wch: 16 }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, rapport.estAVerser ? 'TVA à reverser' : 'TVA versée');
      const suffixe = rapport.estAVerser ? 'a-reverser' : 'versee';
      XLSX.writeFile(wb, `Rapport_TVA_${suffixe}_${new Date().toISOString().slice(0, 10)}.xlsx`);
      toast.success('Rapport Excel téléchargé.');
    } catch (error) {
      toast.error(getErrorMessage(error, 'Erreur lors de la génération du fichier Excel.'));
    }
  };

  return (
    <div className="page fade-in">
      <div className="page-header">
        <div>
          <h1>Suivi de la TVA (OTR)</h1>
          <p className="subtitle">Gérez la TVA collectée et son reversement à l'Office Togolais des Recettes</p>
        </div>
      </div>

      {/* Indicateurs */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon" style={{ backgroundColor: '#fef3c7' }}>
            <Wallet size={24} color="#f59e0b" />
          </div>
          <div className="stat-content">
            <h3 className="stat-label">TVA collectée non versée</h3>
            <p className="stat-value" style={{ fontSize: '1.4rem' }}>{formatFCFA(stats.tvaNonVersee)}</p>
            <small style={{ color: '#6b7280' }}>{stats.nbNonVersee} facture(s) payée(s)</small>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ backgroundColor: '#fee2e2' }}>
            <Coins size={24} color="#dc2626" />
          </div>
          <div className="stat-content">
            <h3 className="stat-label">TVA à verser (50 %)</h3>
            <p className="stat-value" style={{ fontSize: '1.4rem' }}>{formatFCFA(stats.tvaNonVersee / 2)}</p>
            <small style={{ color: '#6b7280' }}>la moitié de la TVA collectée</small>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ backgroundColor: '#dcfce7' }}>
            <CheckCircle size={24} color="#10b981" />
          </div>
          <div className="stat-content">
            <h3 className="stat-label">TVA déjà versée</h3>
            <p className="stat-value" style={{ fontSize: '1.4rem' }}>{formatFCFA(stats.tvaVersee)}</p>
            <small style={{ color: '#6b7280' }}>{stats.nbVersee} facture(s)</small>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ backgroundColor: '#dbeafe' }}>
            <Landmark size={24} color="#2563eb" />
          </div>
          <div className="stat-content">
            <h3 className="stat-label">Total TVA collectée</h3>
            <p className="stat-value" style={{ fontSize: '1.4rem' }}>{formatFCFA(stats.tvaNonVersee + stats.tvaVersee)}</p>
            <small style={{ color: '#6b7280' }}>versée + à reverser</small>
          </div>
        </div>
      </div>

      {/* Onglets */}
      <div className="content-card">
        <FilterBar
          searchValue={searchTerm}
          onSearchChange={setSearchTerm}
          searchPlaceholder="Rechercher par numéro de facture ou client..."
          activeCount={activeCount}
          onReset={resetFilters}
        >
          <div className="filter-group">
            <label>Montant de TVA (FCFA)</label>
            <div className="filter-range">
              <input
                type="number"
                min="0"
                placeholder="Min"
                value={montantMin}
                onChange={(e) => setMontantMin(e.target.value)}
              />
              <span>—</span>
              <input
                type="number"
                min="0"
                placeholder="Max"
                value={montantMax}
                onChange={(e) => setMontantMax(e.target.value)}
              />
            </div>
          </div>

          <PeriodFilter
            label={activeTab === 'a_verser' ? 'Date de paiement' : 'Date de versement'}
            from={dateFrom}
            to={dateTo}
            onChange={(f, t) => {
              setDateFrom(f);
              setDateTo(t);
            }}
          />
        </FilterBar>

        <div className="tva-tabs">
          <button
            className={`tva-tab ${activeTab === 'a_verser' ? 'active' : ''}`}
            onClick={() => setActiveTab('a_verser')}
          >
            TVA à reverser ({stats.nbNonVersee})
          </button>
          <button
            className={`tva-tab ${activeTab === 'versements' ? 'active' : ''}`}
            onClick={() => setActiveTab('versements')}
          >
            Versements OTR ({(stats.versements || []).filter((v) => !v.solde).length})
          </button>
          <button
            className={`tva-tab ${activeTab === 'versee' ? 'active' : ''}`}
            onClick={() => setActiveTab('versee')}
          >
            TVA versée ({stats.nbVersee})
          </button>
          <div className="tva-export-actions">
            <button className="btn btn-secondary btn-sm" onClick={() => handleExportPDF(false)} title="Télécharger en PDF">
              <FileDown size={16} />
              PDF
            </button>
            <button className="btn btn-secondary btn-sm" onClick={handleExportExcel} title="Télécharger en Excel">
              <FileSpreadsheet size={16} />
              Excel
            </button>
            <button className="btn btn-secondary btn-sm" onClick={() => handleExportPDF(true)} title="Imprimer">
              <Printer size={16} />
              Imprimer
            </button>
          </div>
        </div>

        {activeTab === 'a_verser' ? (
          <>
            {sortedAVerser.length > 0 && (
              <div className="tva-actions-bar">
                <span>
                  {selected.length} sélectionnée(s) — TVA : <strong>{formatFCFA(totalSelectionne)}</strong> — à verser (50 %) : <strong style={{ color: '#dc2626' }}>{formatFCFA(totalSelectionne / 2)}</strong>
                </span>
                <button className="btn btn-primary btn-sm" onClick={handleVerser} disabled={selected.length === 0}>
                  <Send size={16} />
                  Créer un versement OTR
                </button>
              </div>
            )}
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ width: '40px' }}>
                      <input
                        type="checkbox"
                        checked={sortedAVerser.length > 0 && selected.length === sortedAVerser.length}
                        onChange={toggleSelectAll}
                      />
                    </th>
                    <th onClick={() => toggleSortAVerser('numero')} style={{ cursor: 'pointer' }}>N° Facture{sortMarkAVerser('numero')}</th>
                    <th onClick={() => toggleSortAVerser('client_nom')} style={{ cursor: 'pointer' }}>Client{sortMarkAVerser('client_nom')}</th>
                    <th onClick={() => toggleSortAVerser('date_paiement')} style={{ cursor: 'pointer' }}>Date paiement{sortMarkAVerser('date_paiement')}</th>
                    <th onClick={() => toggleSortAVerser('total_ttc')} style={{ cursor: 'pointer' }}>Montant TTC{sortMarkAVerser('total_ttc')}</th>
                    <th onClick={() => toggleSortAVerser('tva')} style={{ cursor: 'pointer' }}>TVA{sortMarkAVerser('tva')}</th>
                    <th>TVA à verser (50 %)</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedAVerser.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="empty-state">
                        Aucune TVA en attente de versement
                      </td>
                    </tr>
                  ) : (
                    sortedAVerser.map((f) => (
                      <tr key={f.id}>
                        <td>
                          <input
                            type="checkbox"
                            checked={selected.includes(f.id)}
                            onChange={() => toggleSelect(f.id)}
                          />
                        </td>
                        <td className="font-semibold">{f.numero}</td>
                        <td>{f.client_nom}</td>
                        <td>{formatDate(f.date_paiement)}</td>
                        <td>{formatFCFA(f.total_ttc)}</td>
                        <td>{formatFCFA(f.tva)}</td>
                        <td className="font-semibold" style={{ color: '#dc2626' }}>{formatFCFA(f.tva / 2)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        ) : activeTab === 'versements' ? (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: '36px' }}></th>
                  <th>N° Versement</th>
                  <th>Date</th>
                  <th>Factures</th>
                  <th>Total TVA</th>
                  <th>TVA à verser (50 %)</th>
                  <th>Quittance (50 %)</th>
                  <th>Payé</th>
                  <th>Reste à payer</th>
                  <th>Statut</th>
                  <th style={{ width: '220px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {(stats.versements || []).length === 0 ? (
                  <tr>
                    <td colSpan="11" className="empty-state">
                      Aucun versement OTR. Sélectionnez des factures dans « TVA à reverser » puis créez un versement.
                    </td>
                  </tr>
                ) : (
                  stats.versements.map((v) => (
                    <React.Fragment key={v.id}>
                      <tr>
                        <td>
                          <button
                            className="btn-icon"
                            title={expandedVersements.includes(v.id) ? 'Replier' : 'Voir le détail'}
                            onClick={() => toggleExpand(v.id)}
                          >
                            {expandedVersements.includes(v.id) ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          </button>
                        </td>
                        <td className="font-semibold">{v.numero}</td>
                        <td>{formatDate(v.date)}</td>
                        <td>{v.nb_factures}</td>
                        <td>{formatFCFA(v.total_tva ?? v.total_du * 2)}</td>
                        <td className="font-semibold" style={{ color: '#dc2626' }}>{formatFCFA(v.total_du)}</td>
                        <td style={{ color: '#92400e' }}>{formatFCFA(v.quittance ?? v.total_du)}</td>
                        <td style={{ color: '#10b981' }}>{formatFCFA(v.paye)}</td>
                        <td className="font-semibold" style={{ color: v.reste > 0 ? '#dc2626' : '#10b981' }}>{formatFCFA(v.reste)}</td>
                        <td>
                          <span
                            style={{
                              padding: '3px 10px',
                              borderRadius: 12,
                              fontSize: 12,
                              fontWeight: 600,
                              backgroundColor: v.solde ? '#dcfce7' : v.paye > 0 ? '#fef3c7' : '#fee2e2',
                              color: v.solde ? '#166534' : v.paye > 0 ? '#92400e' : '#991b1b',
                            }}
                          >
                            {v.solde ? 'Soldé' : v.paye > 0 ? 'Partiellement payé' : 'Non payé'}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: 6 }}>
                            {!v.solde && (
                              <button className="btn btn-primary btn-sm" onClick={() => openPaiement(v)} title="Enregistrer un paiement à l'OTR">
                                <Plus size={14} />
                                Paiement
                              </button>
                            )}
                            <button className="btn btn-secondary btn-sm" onClick={() => handleAnnulerLot(v)} title="Annuler ce versement (les factures redeviennent à reverser)">
                              <RotateCcw size={14} />
                              Annuler
                            </button>
                          </div>
                        </td>
                      </tr>
                      {expandedVersements.includes(v.id) && (
                        <tr>
                          <td colSpan="11" style={{ backgroundColor: '#f9fafb', padding: '12px 18px' }}>
                            <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap' }}>
                              <div style={{ minWidth: 260 }}>
                                <strong style={{ fontSize: 13 }}>Factures du lot</strong>
                                <ul style={{ margin: '6px 0 0', paddingLeft: 18, fontSize: 13 }}>
                                  {(v.factures || []).map((f) => (
                                    <li key={f.id}>
                                      {f.numero} — {f.client_nom || '-'} — TVA : {formatFCFA(f.tva)} (à verser : {formatFCFA(f.tva / 2)})
                                    </li>
                                  ))}
                                </ul>
                              </div>
                              <div style={{ flex: 1, minWidth: 320 }}>
                                <strong style={{ fontSize: 13 }}>Historique des paiements à l'OTR</strong>
                                {(v.paiements || []).length === 0 ? (
                                  <p style={{ margin: '6px 0 0', fontSize: 13, color: '#6b7280' }}>Aucun paiement enregistré pour le moment.</p>
                                ) : (
                                  <table style={{ marginTop: 6, fontSize: 13, borderCollapse: 'collapse', width: '100%' }}>
                                    <thead>
                                      <tr style={{ textAlign: 'left', color: '#6b7280' }}>
                                        <th style={{ padding: '4px 8px' }}>Date</th>
                                        <th style={{ padding: '4px 8px' }}>Montant</th>
                                        <th style={{ padding: '4px 8px' }}>Quittance</th>
                                        <th style={{ padding: '4px 8px' }}>Mode</th>
                                        <th style={{ padding: '4px 8px' }}>Note</th>
                                        <th></th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {v.paiements.map((p) => (
                                        <tr key={p.id} style={{ borderTop: '1px solid #e5e7eb' }}>
                                          <td style={{ padding: '4px 8px' }}>{formatDate(p.date)}</td>
                                          <td style={{ padding: '4px 8px', fontWeight: 600 }}>{formatFCFA(p.montant)}</td>
                                          <td style={{ padding: '4px 8px' }}>{p.quittance || '-'}</td>
                                          <td style={{ padding: '4px 8px' }}>{p.mode || '-'}</td>
                                          <td style={{ padding: '4px 8px' }}>{p.note || '-'}</td>
                                          <td style={{ padding: '4px 8px' }}>
                                            <button
                                              className="btn-icon btn-icon-danger"
                                              title="Supprimer ce paiement"
                                              onClick={() => handleSupprimerPaiement(v, p)}
                                            >
                                              <Trash2 size={14} />
                                            </button>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th onClick={() => toggleSortVersees('numero')} style={{ cursor: 'pointer' }}>N° Facture{sortMarkVersees('numero')}</th>
                  <th onClick={() => toggleSortVersees('client_nom')} style={{ cursor: 'pointer' }}>Client{sortMarkVersees('client_nom')}</th>
                  <th onClick={() => toggleSortVersees('date_versement_tva')} style={{ cursor: 'pointer' }}>Date versement{sortMarkVersees('date_versement_tva')}</th>
                  <th onClick={() => toggleSortVersees('total_ttc')} style={{ cursor: 'pointer' }}>Montant TTC{sortMarkVersees('total_ttc')}</th>
                  <th onClick={() => toggleSortVersees('tva')} style={{ cursor: 'pointer' }}>TVA versée{sortMarkVersees('tva')}</th>
                  <th style={{ width: '110px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedVersees.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="empty-state">
                      Aucune TVA versée pour le moment
                    </td>
                  </tr>
                ) : (
                  sortedVersees.map((f) => (
                    <tr key={f.id}>
                      <td className="font-semibold">{f.numero}</td>
                      <td>{f.client_nom}</td>
                      <td>{formatDate(f.date_versement_tva)}</td>
                      <td>{formatFCFA(f.total_ttc)}</td>
                      <td className="font-semibold">{formatFCFA(f.tva)}</td>
                      <td>
                        {f.numero_versement ? (
                          <span style={{ fontSize: 13, color: '#6b7280' }} title="Gérée via ce versement — annulez le versement pour revenir en arrière">
                            {f.numero_versement}
                          </span>
                        ) : (
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleAnnulerVersement(f)}
                            title="Annuler ce versement (la TVA redevient à reverser)"
                          >
                            <RotateCcw size={14} />
                            Annuler
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        isOpen={!!paiementModal}
        onClose={() => setPaiementModal(null)}
        title={paiementModal ? `Paiement OTR — ${paiementModal.numero}` : ''}
        size="small"
      >
        {paiementModal && (
          <form onSubmit={handleAjouterPaiement} className="form">
            <p style={{ margin: '0 0 12px', fontSize: 14 }}>
              Total dû : <strong>{formatFCFA(paiementModal.total_du)}</strong> — déjà payé : <strong style={{ color: '#10b981' }}>{formatFCFA(paiementModal.paye)}</strong> — reste : <strong style={{ color: '#dc2626' }}>{formatFCFA(paiementModal.reste)}</strong>
            </p>
            <div className="form-row">
              <div className="form-group">
                <label>Montant payé (FCFA) *</label>
                <input
                  type="number"
                  min="1"
                  value={paiementForm.montant}
                  onChange={(e) => setPaiementForm((p) => ({ ...p, montant: e.target.value }))}
                  required
                  autoFocus
                />
              </div>
              <div className="form-group">
                <label>Date du paiement</label>
                <input
                  type="date"
                  value={paiementForm.date}
                  onChange={(e) => setPaiementForm((p) => ({ ...p, date: e.target.value }))}
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>N° de quittance OTR</label>
                <input
                  type="text"
                  value={paiementForm.quittance}
                  onChange={(e) => setPaiementForm((p) => ({ ...p, quittance: e.target.value }))}
                  placeholder="Ex : Q-2026-004521"
                />
              </div>
              <div className="form-group">
                <label>Mode de paiement</label>
                <select
                  value={paiementForm.mode}
                  onChange={(e) => setPaiementForm((p) => ({ ...p, mode: e.target.value }))}
                >
                  <option value="">-- Choisir --</option>
                  <option value="Espèces">Espèces</option>
                  <option value="Chèque">Chèque</option>
                  <option value="Virement">Virement</option>
                  <option value="Mobile Money">Mobile Money</option>
                </select>
              </div>
            </div>
            <div className="form-group">
              <label>Note</label>
              <input
                type="text"
                value={paiementForm.note}
                onChange={(e) => setPaiementForm((p) => ({ ...p, note: e.target.value }))}
                placeholder="Commentaire libre..."
              />
            </div>
            <div className="form-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setPaiementModal(null)}>
                Annuler
              </button>
              <button type="submit" className="btn btn-primary">
                Enregistrer le paiement
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};

export default Tva;
