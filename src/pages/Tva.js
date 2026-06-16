import React, { useState, useEffect } from 'react';
import { Landmark, Wallet, CheckCircle, Send } from 'lucide-react';
import { useToast } from '../components/Toast/ToastProvider';
import { useConfirm } from '../components/ConfirmDialog/ConfirmProvider';
import { getErrorMessage } from '../utils/errors';
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
    nbNonVersee: 0,
    tvaVersee: 0,
    nbVersee: 0,
    aVerser: [],
    versees: []
  });
  const [selected, setSelected] = useState([]);
  const [activeTab, setActiveTab] = useState('a_verser');

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    if (!window.electronAPI || !window.electronAPI.tva) {
      toast.error("Module TVA indisponible. Veuillez redémarrer l'application.");
      return;
    }
    const data = await window.electronAPI.tva.getStats();
    setStats(data);
    setSelected([]);
  };

  const toggleSelect = (id) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selected.length === stats.aVerser.length) {
      setSelected([]);
    } else {
      setSelected(stats.aVerser.map((f) => f.id));
    }
  };

  const totalSelectionne = stats.aVerser
    .filter((f) => selected.includes(f.id))
    .reduce((sum, f) => sum + (f.tva || 0), 0);

  const handleVerser = async () => {
    if (selected.length === 0) {
      toast.error('Sélectionnez au moins une facture.');
      return;
    }
    const ok = await confirm({
      title: 'Verser la TVA à l\'OTR',
      message: `Confirmer le versement à l'OTR de la TVA de ${selected.length} facture(s), soit ${formatFCFA(totalSelectionne)} ? Cette action marquera ces TVA comme versées.`,
      confirmText: 'Confirmer le versement',
    });
    if (!ok) return;
    try {
      const res = await window.electronAPI.tva.verser(selected);
      toast.success(`TVA versée pour ${res.count} facture(s).`);
      loadStats();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Erreur lors du versement de la TVA.'));
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
            <h3 className="stat-label">TVA à reverser à l'OTR</h3>
            <p className="stat-value" style={{ fontSize: '1.4rem' }}>{formatFCFA(stats.tvaNonVersee)}</p>
            <small style={{ color: '#6b7280' }}>{stats.nbNonVersee} facture(s) payée(s)</small>
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
        <div className="tva-tabs">
          <button
            className={`tva-tab ${activeTab === 'a_verser' ? 'active' : ''}`}
            onClick={() => setActiveTab('a_verser')}
          >
            TVA à reverser ({stats.nbNonVersee})
          </button>
          <button
            className={`tva-tab ${activeTab === 'versee' ? 'active' : ''}`}
            onClick={() => setActiveTab('versee')}
          >
            TVA versée ({stats.nbVersee})
          </button>
        </div>

        {activeTab === 'a_verser' ? (
          <>
            {stats.aVerser.length > 0 && (
              <div className="tva-actions-bar">
                <span>
                  {selected.length} sélectionnée(s) — TVA : <strong>{formatFCFA(totalSelectionne)}</strong>
                </span>
                <button className="btn btn-primary btn-sm" onClick={handleVerser} disabled={selected.length === 0}>
                  <Send size={16} />
                  Verser à l'OTR
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
                        checked={stats.aVerser.length > 0 && selected.length === stats.aVerser.length}
                        onChange={toggleSelectAll}
                      />
                    </th>
                    <th>N° Facture</th>
                    <th>Client</th>
                    <th>Date paiement</th>
                    <th>Montant TTC</th>
                    <th>TVA</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.aVerser.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="empty-state">
                        Aucune TVA en attente de versement
                      </td>
                    </tr>
                  ) : (
                    stats.aVerser.map((f) => (
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
                        <td className="font-semibold">{formatFCFA(f.tva)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>N° Facture</th>
                  <th>Client</th>
                  <th>Date versement</th>
                  <th>Montant TTC</th>
                  <th>TVA versée</th>
                </tr>
              </thead>
              <tbody>
                {stats.versees.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="empty-state">
                      Aucune TVA versée pour le moment
                    </td>
                  </tr>
                ) : (
                  stats.versees.map((f) => (
                    <tr key={f.id}>
                      <td className="font-semibold">{f.numero}</td>
                      <td>{f.client_nom}</td>
                      <td>{formatDate(f.date_versement_tva)}</td>
                      <td>{formatFCFA(f.total_ttc)}</td>
                      <td className="font-semibold">{formatFCFA(f.tva)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default Tva;
