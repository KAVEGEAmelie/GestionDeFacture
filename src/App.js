import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Clients from './pages/Clients';
import Produits from './pages/Produits';
import Proformas from './pages/Proformas';
import Factures from './pages/Factures';
import Bordereaux from './pages/Bordereaux';
import Parametres from './pages/Parametres';
import './App.css';

function App() {
  return (
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
          <Route path="parametres" element={<Parametres />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
