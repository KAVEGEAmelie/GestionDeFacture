import React from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Users, 
  Package, 
  FileText, 
  Receipt, 
  Truck,
  Landmark,
  Settings 
} from 'lucide-react';
import './Layout.css';

const Layout = () => {
  const menuItems = [
    { path: '/dashboard', icon: LayoutDashboard, label: 'Tableau de bord' },
    { path: '/clients', icon: Users, label: 'Clients' },
    { path: '/produits', icon: Package, label: 'Produits' },
    { path: '/proformas', icon: FileText, label: 'Proformas' },
    { path: '/factures', icon: Receipt, label: 'Factures' },
    { path: '/bordereaux', icon: Truck, label: 'Bordereaux' },
    { path: '/tva', icon: Landmark, label: 'TVA / OTR' },
    { path: '/parametres', icon: Settings, label: 'Paramètres' }
  ];

  return (
    <div className="layout-container">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="logo">
            <h2>In-Tel Services</h2>
            <p>Gestion Facturation</p>
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
