import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './Dashboard.css';
import { Users, Package, FileText, Receipt, TrendingUp, Clock, BarChart3 } from 'lucide-react';

const MOIS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];

const formatFCFA = (n) => new Intl.NumberFormat('fr-FR').format(Math.round(n || 0)) + ' FCFA';

const Dashboard = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    clients: 0,
    produits: 0,
    proformas: 0,
    factures: 0
  });
  const [dashboard, setDashboard] = useState({
    caTotal: 0,
    caAnnee: 0,
    proformasEnAttente: 0,
    caParMois: Array(12).fill(0),
    topClients: [],
    annee: new Date().getFullYear()
  });

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    const [counts, dash] = await Promise.all([
      window.electronAPI.stats.getCounts(),
      window.electronAPI.stats.getDashboard()
    ]);
    setStats(counts);
    setDashboard(dash);
  };

  const maxMois = Math.max(...dashboard.caParMois, 1);
  const maxClient = Math.max(...dashboard.topClients.map((c) => c.total), 1);

  return (
    <div className="dashboard fade-in">
      <div className="page-header">
        <h1>Tableau de bord</h1>
        <p className="subtitle">Vue d'ensemble de votre activité</p>
      </div>

      <div className="stats-grid">
        <div className="stat-card" onClick={() => navigate('/clients')} style={{cursor: 'pointer'}}>
          <div className="stat-icon" style={{ backgroundColor: '#dbeafe' }}>
            <Users size={24} color="#2563eb" />
          </div>
          <div className="stat-content">
            <h3 className="stat-label">Clients</h3>
            <p className="stat-value">{stats.clients}</p>
          </div>
        </div>

        <div className="stat-card" onClick={() => navigate('/produits')} style={{cursor: 'pointer'}}>
          <div className="stat-icon" style={{ backgroundColor: '#fef3c7' }}>
            <Package size={24} color="#f59e0b" />
          </div>
          <div className="stat-content">
            <h3 className="stat-label">Produits</h3>
            <p className="stat-value">{stats.produits}</p>
          </div>
        </div>

        <div className="stat-card" onClick={() => navigate('/proformas')} style={{cursor: 'pointer'}}>
          <div className="stat-icon" style={{ backgroundColor: '#dcfce7' }}>
            <FileText size={24} color="#10b981" />
          </div>
          <div className="stat-content">
            <h3 className="stat-label">Proformas</h3>
            <p className="stat-value">{stats.proformas}</p>
          </div>
        </div>

        <div className="stat-card" onClick={() => navigate('/factures')} style={{cursor: 'pointer'}}>
          <div className="stat-icon" style={{ backgroundColor: '#fce7f3' }}>
            <Receipt size={24} color="#ec4899" />
          </div>
          <div className="stat-content">
            <h3 className="stat-label">Factures</h3>
            <p className="stat-value">{stats.factures}</p>
          </div>
        </div>
      </div>

      {/* Indicateurs financiers */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon" style={{ backgroundColor: '#dcfce7' }}>
            <TrendingUp size={24} color="#10b981" />
          </div>
          <div className="stat-content">
            <h3 className="stat-label">CA {dashboard.annee}</h3>
            <p className="stat-value" style={{ fontSize: '1.4rem' }}>{formatFCFA(dashboard.caAnnee)}</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ backgroundColor: '#dbeafe' }}>
            <BarChart3 size={24} color="#2563eb" />
          </div>
          <div className="stat-content">
            <h3 className="stat-label">CA total</h3>
            <p className="stat-value" style={{ fontSize: '1.4rem' }}>{formatFCFA(dashboard.caTotal)}</p>
          </div>
        </div>

        <div className="stat-card" onClick={() => navigate('/proformas')} style={{cursor: 'pointer'}}>
          <div className="stat-icon" style={{ backgroundColor: '#fef3c7' }}>
            <Clock size={24} color="#f59e0b" />
          </div>
          <div className="stat-content">
            <h3 className="stat-label">Proformas en attente</h3>
            <p className="stat-value">{dashboard.proformasEnAttente}</p>
          </div>
        </div>
      </div>

      {/* Graphique CA mensuel + Top clients */}
      <div className="dashboard-charts">
        <div className="chart-card">
          <h3 className="chart-title">Chiffre d'affaires mensuel {dashboard.annee}</h3>
          <div className="bar-chart">
            {dashboard.caParMois.map((val, i) => (
              <div className="bar-col" key={i} title={formatFCFA(val)}>
                <div className="bar-wrapper">
                  <div
                    className="bar"
                    style={{ height: `${(val / maxMois) * 100}%` }}
                  ></div>
                </div>
                <span className="bar-label">{MOIS[i]}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="chart-card">
          <h3 className="chart-title">Top 5 clients</h3>
          {dashboard.topClients.length === 0 ? (
            <p className="chart-empty">Aucune facture pour le moment</p>
          ) : (
            <div className="top-clients">
              {dashboard.topClients.map((c, i) => (
                <div className="top-client-row" key={i}>
                  <span className="top-client-name">{c.nom || 'Client supprimé'}</span>
                  <div className="top-client-bar-wrapper">
                    <div
                      className="top-client-bar"
                      style={{ width: `${(c.total / maxClient) * 100}%` }}
                    ></div>
                  </div>
                  <span className="top-client-value">{formatFCFA(c.total)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="welcome-section">
        <div className="welcome-card">
          <h2>Bienvenue dans votre application de gestion</h2>
          <p>
            Gérez facilement vos clients, produits et documents commerciaux (Proformas, Factures, Bordereaux).
          </p>
          <div className="quick-actions">
            <button className="btn btn-primary" onClick={() => navigate('/clients')}>
              Gérer les clients
            </button>
            <button className="btn btn-secondary" onClick={() => navigate('/proformas')}>
              Créer une proforma
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
