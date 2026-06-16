import React from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Clients from './pages/Clients';
import Produits from './pages/Produits';
import Proformas from './pages/Proformas';
import Factures from './pages/Factures';
import Bordereaux from './pages/Bordereaux';
import Tva from './pages/Tva';
import Parametres from './pages/Parametres';
import { ToastProvider } from './components/Toast/ToastProvider';
import { ConfirmProvider } from './components/ConfirmDialog/ConfirmProvider';
import './App.css';

function App() {
  return (
    <ToastProvider>
      <ConfirmProvider>
        <Router>
          <Routes>
            <Route path="/" element={<Layout />}>
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="clients" element={<Clients />} />
              <Route path="produits" element={<Produits />} />
              <Route path="proformas" element={<Proformas />} />
              <Route path="factures" element={<Factures />} />
              <Route path="bordereaux" element={<Bordereaux />} />
              <Route path="tva" element={<Tva />} />
              <Route path="parametres" element={<Parametres />} />
            </Route>
          </Routes>
        </Router>
      </ConfirmProvider>
    </ToastProvider>
  );
}

export default App;
