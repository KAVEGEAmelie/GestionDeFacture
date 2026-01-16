import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './Dashboard.css';
import { Users, Package, FileText, Receipt } from 'lucide-react';

const Dashboard = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    clients: 0,
    produits: 0,
    proformas: 0,
    factures: 0
  });

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    const counts = await window.electronAPI.stats.getCounts();
    setStats(counts);
  };

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
