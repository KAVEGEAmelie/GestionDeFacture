import React, { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Clients from './pages/Clients';
import Produits from './pages/Produits';
// import AppelsOffres from './pages/AppelsOffres'; // ← désactivé temporairement
import Proformas from './pages/Proformas';
import Factures from './pages/Factures';
import Bordereaux from './pages/Bordereaux';
import Tva from './pages/Tva';
import Rapports from './pages/Rapports';
import AttestationServiceFait from './pages/AttestationServiceFait';
import Parametres from './pages/Parametres';
import LockScreen from './components/LockScreen/LockScreen';
import { ToastProvider } from './components/Toast/ToastProvider';
import { ConfirmProvider } from './components/ConfirmDialog/ConfirmProvider';
import './App.css';

function App() {
  // null = en cours de vérification, true = déverrouillé, false = verrouillé
  const [unlocked, setUnlocked] = useState(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const status = await window.electronAPI.security.getStatus();
        if (mounted) setUnlocked(!(status.enabled && status.hasPassword));
      } catch {
        // En cas d'erreur, ne pas bloquer l'accès à l'application
        if (mounted) setUnlocked(true);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // Pendant la vérification du statut, ne rien afficher
  if (unlocked === null) {
    return null;
  }

  // Application verrouillée : afficher l'écran de mot de passe
  if (!unlocked) {
    return <LockScreen onUnlock={() => setUnlocked(true)} />;
  }

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
              {/* <Route path="appels-offres" element={<AppelsOffres />} /> */} {/* ← désactivé temporairement */}
              <Route path="proformas" element={<Proformas />} />
              <Route path="factures" element={<Factures />} />
              <Route path="bordereaux" element={<Bordereaux />} />
              <Route path="tva" element={<Tva />} />
              <Route path="rapports" element={<Rapports />} />
              <Route path="attestation-service-fait" element={<AttestationServiceFait />} />
              <Route path="parametres" element={<Parametres />} />
            </Route>
          </Routes>
        </Router>
      </ConfirmProvider>
    </ToastProvider>
  );
}

export default App;
