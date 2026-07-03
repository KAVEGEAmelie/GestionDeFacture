import React, { useEffect, useState } from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Users, 
  Package, 
  FileText, 
  Receipt, 
  Truck,
  Landmark,
  ClipboardList,
  Megaphone,
  Settings 
} from 'lucide-react';
import './Layout.css';
import logo from '../assets/logo.png';

const Layout = () => {
  const [parametres, setParametres] = useState({});

  useEffect(() => {
    let mounted = true;
    const loadBranding = async () => {
      try {
        const params = await window.electronAPI.parametres.getAll();
        if (mounted) setParametres(params || {});
      } catch {
        // fallback silencieux sur les valeurs par défaut
      }
    };

    loadBranding();

    const handleSettingsUpdated = () => {
      loadBranding();
    };
    window.addEventListener('app:settings-updated', handleSettingsUpdated);

    return () => {
      mounted = false;
      window.removeEventListener('app:settings-updated', handleSettingsUpdated);
    };
  }, []);

  const displayLogo = parametres.entreprise_logo || logo;
  const companyName = parametres.entreprise_nom || 'In-Tel Services';
  const appSubtitle = parametres.application_sous_titre || 'Gestion Facturation';

  const menuItems = [
    { path: '/dashboard', icon: LayoutDashboard, label: 'Tableau de bord' },
    { path: '/clients', icon: Users, label: 'Clients' },
    { path: '/produits', icon: Package, label: 'Produits' },
    { path: '/appels-offres', icon: Megaphone, label: "Appels d'offre" },
    { path: '/proformas', icon: FileText, label: 'Proformas' },
    { path: '/factures', icon: Receipt, label: 'Factures' },
    { path: '/bordereaux', icon: Truck, label: 'Bordereaux' },
    { path: '/tva', icon: Landmark, label: 'TVA / OTR' },
    { path: '/rapports', icon: ClipboardList, label: 'Rapports' },
    { path: '/attestation-service-fait', icon: FileText, label: 'Attestation service fait' },
    { path: '/parametres', icon: Settings, label: 'Paramètres' }
  ];

  return (
    <div className="layout-container">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <img src={displayLogo} alt={companyName} className="sidebar-logo" />
          <div className="logo">
            <h2>{companyName}</h2>
            <p>{appSubtitle}</p>
          </div>
        </div>
        
        <nav className="sidebar-nav">
          {menuItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) => 
                  `nav-item ${isActive ? 'active' : ''}`
                }
              >
                <Icon size={20} />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <p className="version">v1.0.0</p>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;
