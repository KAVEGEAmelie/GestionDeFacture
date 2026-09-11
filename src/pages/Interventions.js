import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Eye, Edit2, Trash2, Printer, Download, FileCheck, RotateCcw, X } from 'lucide-react';
import Modal from '../components/modals/Modal';
import FilterBar from '../components/Filters/FilterBar';
import PeriodFilter from '../components/Filters/PeriodFilter';
import { inDateRange } from '../utils/dateFilters';
import {
  generateInterventionPDF,
  FIT_OPTIONS_RESEAUX,
  FIT_OPTIONS_MAINTENANCE,
} from '../utils/pdfGenerator';
import { useToast } from '../components/Toast/ToastProvider';
import { useConfirm } from '../components/ConfirmDialog/ConfirmProvider';
import { getErrorMessage } from '../utils/errors';
import { matchesWordPrefix } from '../utils/search';
import SearchableSelect from '../components/Inputs/SearchableSelect';
import './Clients.css';
import './Proformas.css';
import './RapportsModal.css';

const todayISO = () => new Date().toISOString().split('T')[0];

const OS_OPTIONS = [
  { value: 'Windows', label: 'Windows' },
  { value: 'Linux', label: 'Linux' },
  { value: 'Autre', label: 'Autre' },
];
const TEST_OPTIONS = [
  { value: 'Conforme', label: 'Conforme' },
  { value: 'Non conforme', label: 'Non conforme' },
];
const STATUT_OPTIONS = [
  { value: 'Résolu', label: 'Résolu' },
  { value: 'Partiellement résolu', label: 'Partiellement résolu' },
  { value: 'Non résolu', label: 'Non résolu (Nouvelle intervention requise)' },
];

const buildDefaultForm = () => ({
  date: todayISO(),
  intervenant: '',
  heure_arrivee: '',
  heure_depart: '',
  client_nom: '',
  client_adresse: '',
  client_contact: '',
  interlocuteur: '',
  options_reseaux: [],
  options_maintenance: [],
  marque_modele: '',
  num_serie: '',
  systeme_exploitation: '',
  vol_donnees: '',
  test_continuite: '',
  ping: '',
  debit_desc: '',
  debit_mont: '',
  description_probleme: '',
  travaux_realises: '',
  materiels: [],
  statut_final: '',
});

const toStoredRecord = (form) => ({
  date: form.date,
  intervenant: (form.intervenant || '').trim(),
  heure_arrivee: (form.heure_arrivee || '').trim(),
  heure_depart: (form.heure_depart || '').trim(),
  client_nom: (form.client_nom || '').trim(),
  client_adresse: (form.client_adresse || '').trim(),
  client_contact: (form.client_contact || '').trim(),
  interlocuteur: (form.interlocuteur || '').trim(),
  options_reseaux: Array.isArray(form.options_reseaux) ? form.options_reseaux : [],
  options_maintenance: Array.isArray(form.options_maintenance) ? form.options_maintenance : [],
  marque_modele: (form.marque_modele || '').trim(),
  num_serie: (form.num_serie || '').trim(),
  systeme_exploitation: form.systeme_exploitation || '',
  vol_donnees: (form.vol_donnees || '').trim(),
  test_continuite: form.test_continuite || '',
  ping: (form.ping || '').trim(),
  debit_desc: (form.debit_desc || '').trim(),
  debit_mont: (form.debit_mont || '').trim(),
  description_probleme: (form.description_probleme || '').trim(),
  travaux_realises: (form.travaux_realises || '').trim(),
  materiels: (Array.isArray(form.materiels) ? form.materiels : []).filter(
    (m) => m && (String(m.designation || '').trim() || String(m.qte || '').trim() || String(m.garantie || '').trim())
  ),
  statut_final: form.statut_final || '',
});

const toForm = (record) => ({
  date: record.date || todayISO(),
  intervenant: record.intervenant || '',
  heure_arrivee: record.heure_arrivee || '',
  heure_depart: record.heure_depart || '',
  client_nom: record.client_nom || '',
  client_adresse: record.client_adresse || '',
  client_contact: record.client_contact || '',
  interlocuteur: record.interlocuteur || '',
  options_reseaux: Array.isArray(record.options_reseaux) ? record.options_reseaux : [],
  options_maintenance: Array.isArray(record.options_maintenance) ? record.options_maintenance : [],
  marque_modele: record.marque_modele || '',
  num_serie: record.num_serie || '',
  systeme_exploitation: record.systeme_exploitation || '',
  vol_donnees: record.vol_donnees || '',
  test_continuite: record.test_continuite || '',
  ping: record.ping || '',
  debit_desc: record.debit_desc || '',
  debit_mont: record.debit_mont || '',
  description_probleme: record.description_probleme || '',
  travaux_realises: record.travaux_realises || '',
  materiels: Array.isArray(record.materiels) ? record.materiels : [],
  statut_final: record.statut_final || '',
});

const checkboxRowStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '4px 0',
  cursor: 'pointer',
  fontSize: 14,
};

const Interventions = () => {
  const toast = useToast();
  const confirm = useConfirm();

  const [parametres, setParametres] = useState({});
  const [clients, setClients] = useState([]);
  const [interventions, setInterventions] = useState([]);

  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'date', direction: 'desc' });
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editingNumero, setEditingNumero] = useState('');
  const [formData, setFormData] = useState(() => buildDefaultForm());
  const initialFormRef = useRef(null);

  const sortedClients = useMemo(() => {
    return [...clients].sort((a, b) =>
      String(a.nom || '').localeCompare(String(b.nom || ''), 'fr', { sensitivity: 'base' })
    );
  }, [clients]);

  useEffect(() => {
    (async () => {
      try {
        if (!window.electronAPI?.interventions) {
          toast.error("Module fiches d'intervention indisponible : fermez complètement l'application puis relancez-la.");
          return;
        }
        const [params, clientsData, interventionsData] = await Promise.all([
          window.electronAPI.parametres.getAll(),
          window.electronAPI.clients.getAll(),
          window.electronAPI.interventions.getAll(),
        ]);
        setParametres(params || {});
        setClients(clientsData || []);
        setInterventions(interventionsData || []);
      } catch (error) {
        toast.error(getErrorMessage(error, 'Impossible de charger les données.'));
      }
    })();
  }, [toast]);

  const formatDate = (value) => (value ? new Date(value).toLocaleDateString('fr-FR') : '-');

  const filteredInterventions = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return interventions.filter((f) => {
      const matchSearch =
        !term ||
        matchesWordPrefix(f.numero, term) ||
        matchesWordPrefix(f.client_nom, term) ||
        matchesWordPrefix(f.intervenant, term) ||
        matchesWordPrefix(f.interlocuteur, term);
      const matchDate = inDateRange(f.date, dateFrom, dateTo);
      return matchSearch && matchDate;
    });
  }, [interventions, searchTerm, dateFrom, dateTo]);

  const sortedFilteredInterventions = useMemo(() => {
    const items = [...filteredInterventions];
    const { key, direction } = sortConfig;
    const factor = direction === 'asc' ? 1 : -1;
    return items.sort((a, b) => {
      if (key === 'date') {
        return ((new Date(a.date).getTime() || 0) - (new Date(b.date).getTime() || 0)) * factor;
      }
      return String(a[key] || '').localeCompare(String(b[key] || ''), 'fr', { sensitivity: 'base' }) * factor;
    });
  }, [filteredInterventions, sortConfig]);

  const toggleSort = (key) => {
    setSortConfig((prev) =>
      prev.key === key
        ? { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
        : { key, direction: key === 'date' ? 'desc' : 'asc' }
    );
  };

  const sortMark = (key) => {
    if (sortConfig.key !== key) return ' ↕';
    return sortConfig.direction === 'asc' ? ' ↑' : ' ↓';
  };

  const activeCount = dateFrom || dateTo ? 1 : 0;

  const resetFilters = () => {
    setDateFrom('');
    setDateTo('');
  };

  const openCreateModal = () => {
    const fresh = buildDefaultForm();
    setEditingId(null);
    setEditingNumero('');
    setFormData(fresh);
    initialFormRef.current = JSON.stringify(fresh);
    setIsModalOpen(true);
  };

  const openEditModal = (item) => {
    const loaded = toForm(item);
    setEditingId(item.id);
    setEditingNumero(item.numero || '');
    setFormData(loaded);
    initialFormRef.current = JSON.stringify(loaded);
    setIsModalOpen(true);
  };

  const closeModal = async () => {
    const current = JSON.stringify(formData);
    if (initialFormRef.current !== null && current !== initialFormRef.current) {
      const ok = await confirm({
        title: 'Quitter sans enregistrer ?',
        message: 'Des modifications non enregistrées seront perdues.',
        confirmText: 'Quitter sans enregistrer',
        danger: true,
      });
      if (!ok) return;
    }
    setIsModalOpen(false);
    setEditingId(null);
    setEditingNumero('');
    initialFormRef.current = null;
  };

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleClientSelect = (clientNom) => {
    const client = clients.find((c) => c.nom === clientNom);
    setFormData((prev) => ({
      ...prev,
      client_nom: clientNom || '',
      client_adresse: client ? (client.adresse || '') : prev.client_adresse,
      client_contact: client
        ? [client.telephone, client.email].filter(Boolean).join(' / ')
        : prev.client_contact,
    }));
  };

  const toggleOption = (field, label) => {
    setFormData((prev) => {
      const list = Array.isArray(prev[field]) ? prev[field] : [];
      return {
        ...prev,
        [field]: list.includes(label) ? list.filter((l) => l !== label) : [...list, label],
      };
    });
  };

  const [customInputs, setCustomInputs] = useState({ options_reseaux: '', options_maintenance: '' });

  const customOptions = (field) => {
    const fixed = field === 'options_reseaux' ? FIT_OPTIONS_RESEAUX : FIT_OPTIONS_MAINTENANCE;
    return (formData[field] || []).filter((l) => !fixed.includes(l));
  };

  const addCustomOption = (field) => {
    const value = (customInputs[field] || '').trim();
    if (!value) return;
    const fixed = field === 'options_reseaux' ? FIT_OPTIONS_RESEAUX : FIT_OPTIONS_MAINTENANCE;
    // Si la saisie correspond à une option standard, on coche celle-ci au lieu de dupliquer
    const existing = fixed.find((l) => l.toLowerCase() === value.toLowerCase());
    const label = existing || value;
    setFormData((prev) => {
      const list = Array.isArray(prev[field]) ? prev[field] : [];
      if (list.some((l) => l.toLowerCase() === label.toLowerCase())) return prev;
      return { ...prev, [field]: [...list, label] };
    });
    setCustomInputs((prev) => ({ ...prev, [field]: '' }));
  };

  const renderCustomOptionInput = (field) => (
    <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
      <input
        type="text"
        value={customInputs[field]}
        onChange={(e) => setCustomInputs((prev) => ({ ...prev, [field]: e.target.value }))}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            addCustomOption(field);
          }
        }}
        placeholder="Autre : préciser puis Entrée..."
      />
      <button type="button" className="btn btn-secondary" title="Ajouter l'option" onClick={() => addCustomOption(field)}>
        <Plus size={16} />
      </button>
    </div>
  );

  const addMateriel = () => {
    setFormData((prev) => ({
      ...prev,
      materiels: [...(prev.materiels || []), { designation: '', qte: '', garantie: '' }],
    }));
  };

  const updateMateriel = (index, key, value) => {
    setFormData((prev) => {
      const materiels = [...(prev.materiels || [])];
      materiels[index] = { ...materiels[index], [key]: value };
      return { ...prev, materiels };
    });
  };

  const removeMateriel = (index) => {
    setFormData((prev) => ({
      ...prev,
      materiels: (prev.materiels || []).filter((_, i) => i !== index),
    }));
  };

  const resetForm = async () => {
    const ok = await confirm({
      title: 'Réinitialiser le formulaire',
      message: 'Voulez-vous remettre le formulaire à zéro ?',
      confirmText: 'Réinitialiser',
      danger: false,
    });
    if (!ok) return;
    const fresh = buildDefaultForm();
    setFormData(fresh);
    initialFormRef.current = JSON.stringify(fresh);
  };

  const handleSave = async (e) => {
    e.preventDefault();

    const payload = toStoredRecord(formData);
    if (!payload.client_nom) {
      toast.error('Veuillez renseigner le client / entreprise.');
      return;
    }
    if (!payload.date) {
      toast.error("Veuillez renseigner la date de l'intervention.");
      return;
    }

    try {
      if (editingId) {
        await window.electronAPI.interventions.update(editingId, payload);
        toast.success('Fiche d\'intervention mise à jour.');
      } else {
        await window.electronAPI.interventions.create(payload);
        toast.success('Fiche d\'intervention créée.');
      }
      const updated = await window.electronAPI.interventions.getAll();
      setInterventions(updated || []);
    } catch (error) {
      toast.error(getErrorMessage(error, 'Erreur lors de l\'enregistrement.'));
      return;
    }

    setIsModalOpen(false);
    setEditingId(null);
    setEditingNumero('');
    initialFormRef.current = null;
  };

  const handleDelete = async (id) => {
    const ok = await confirm({
      title: 'Supprimer la fiche',
      message: 'Êtes-vous sûr de vouloir supprimer cette fiche d\'intervention ?',
      confirmText: 'Supprimer',
      danger: true,
    });
    if (!ok) return;

    try {
      await window.electronAPI.interventions.delete(id);
      const updated = await window.electronAPI.interventions.getAll();
      setInterventions(updated || []);
      toast.success('Fiche supprimée.');
    } catch (error) {
      toast.error(getErrorMessage(error, 'Erreur lors de la suppression.'));
    }
  };

  const exportPdf = async (item, print = false, preview = false) => {
    try {
      const doc = await generateInterventionPDF(item, parametres);
      if (print) {
        doc.autoPrint();
        window.open(doc.output('bloburl'), '_blank');
      } else if (preview) {
        window.open(doc.output('bloburl'), '_blank');
      } else {
        doc.save(`Fiche_Intervention_${String(item.numero || 'FIT').replace(/\//g, '-')}.pdf`);
        toast.success('PDF téléchargé.');
      }
    } catch (error) {
      toast.error(getErrorMessage(error, 'Erreur lors de la génération du PDF.'));
    }
  };

  return (
    <div className="page fade-in">
      <div className="page-header">
        <div>
          <h1>Fiches d'intervention technique</h1>
          <p className="subtitle">Remplissez et imprimez vos fiches d'intervention sur l'entête de l'entreprise.</p>
        </div>
        <div className="header-actions">
          <button className="btn btn-primary" onClick={openCreateModal}>
            <Plus size={18} />
            Nouvelle fiche
          </button>
        </div>
      </div>

      <div className="content-card">
        <FilterBar
          searchValue={searchTerm}
          onSearchChange={setSearchTerm}
          searchPlaceholder="Rechercher par numéro, client, intervenant..."
          activeCount={activeCount}
          onReset={resetFilters}
        >
          <PeriodFilter
            label="Date de l'intervention"
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
                <th onClick={() => toggleSort('numero')} style={{ cursor: 'pointer' }}>N°{sortMark('numero')}</th>
                <th onClick={() => toggleSort('date')} style={{ cursor: 'pointer' }}>Date{sortMark('date')}</th>
                <th onClick={() => toggleSort('client_nom')} style={{ cursor: 'pointer' }}>Client{sortMark('client_nom')}</th>
                <th onClick={() => toggleSort('intervenant')} style={{ cursor: 'pointer' }}>Intervenant{sortMark('intervenant')}</th>
                <th onClick={() => toggleSort('statut_final')} style={{ cursor: 'pointer' }}>Statut{sortMark('statut_final')}</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedFilteredInterventions.length === 0 ? (
                <tr>
                  <td colSpan="6" className="empty-state">
                    Aucune fiche d'intervention enregistrée pour le moment.
                  </td>
                </tr>
              ) : (
                sortedFilteredInterventions.map((item) => (
                  <tr key={item.id}>
                    <td className="font-semibold">{item.numero || '-'}</td>
                    <td>{formatDate(item.date)}</td>
                    <td>{item.client_nom || '-'}</td>
                    <td>{item.intervenant || '-'}</td>
                    <td>{item.statut_final || '-'}</td>
                    <td style={{ textAlign: 'right' }}>
                      <div className="action-buttons">
                        <button className="btn-icon btn-icon-primary" title="Aperçu" onClick={() => exportPdf(item, false, true)}>
                          <Eye size={15} />
                        </button>
                        <button className="btn-icon btn-icon-edit" title="Modifier" onClick={() => openEditModal(item)}>
                          <Edit2 size={15} />
                        </button>
                        <button className="btn-icon btn-icon-success" title="Imprimer" onClick={() => exportPdf(item, true)}>
                          <Printer size={15} />
                        </button>
                        <button className="btn-icon btn-icon-info" title="Exporter PDF" onClick={() => exportPdf(item, false)}>
                          <Download size={15} />
                        </button>
                        <button className="btn-icon btn-icon-danger" title="Supprimer" onClick={() => handleDelete(item.id)}>
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        title={editingId ? `Modifier la fiche ${editingNumero}` : "Nouvelle fiche d'intervention technique"}
        size="xlarge"
      >
        <form className="form rapports-form" onSubmit={handleSave}>
          <section className="form-section">
            <span className="form-section__eyebrow">Informations générales</span>
            <div className="form-row">
              <div className="form-group">
                <label>N° Intervention</label>
                <input type="text" value={editingNumero || 'Généré automatiquement'} readOnly />
              </div>
              <div className="form-group">
                <label>Date *</label>
                <input type="date" value={formData.date} onChange={(e) => handleChange('date', e.target.value)} />
              </div>
              <div className="form-group">
                <label>Intervenant</label>
                <input type="text" value={formData.intervenant} onChange={(e) => handleChange('intervenant', e.target.value)} placeholder="Nom du technicien" />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Heure d'arrivée</label>
                <input type="time" value={formData.heure_arrivee} onChange={(e) => handleChange('heure_arrivee', e.target.value)} />
              </div>
              <div className="form-group">
                <label>Heure de départ</label>
                <input type="time" value={formData.heure_depart} onChange={(e) => handleChange('heure_depart', e.target.value)} />
              </div>
            </div>
          </section>

          <section className="form-section">
            <span className="form-section__eyebrow">Client</span>
            <div className="form-row">
              <div className="form-group">
                <label>Nom / Entreprise *</label>
                <SearchableSelect
                  options={sortedClients.map((client) => ({ value: client.nom, label: client.nom }))}
                  value={formData.client_nom}
                  onChange={(clientNom, option) => handleClientSelect(option?.label || clientNom)}
                  placeholder="Rechercher un client"
                  noOptionsText="Aucun client correspondant"
                />
              </div>
              <div className="form-group">
                <label>Adresse client</label>
                <input type="text" value={formData.client_adresse} onChange={(e) => handleChange('client_adresse', e.target.value)} placeholder="Adresse du site d'intervention" />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Tél / E-mail</label>
                <input type="text" value={formData.client_contact} onChange={(e) => handleChange('client_contact', e.target.value)} placeholder="Ex : +228 90 00 00 00 / client@mail.com" />
              </div>
              <div className="form-group">
                <label>Interlocuteur</label>
                <input type="text" value={formData.interlocuteur} onChange={(e) => handleChange('interlocuteur', e.target.value)} placeholder="Personne rencontrée sur place" />
              </div>
            </div>
          </section>

          <section className="form-section">
            <span className="form-section__eyebrow">Type d'intervention & composants concernés</span>
            <div className="form-row">
              <div className="form-group">
                <label>Option A : Réseaux & Télécoms</label>
                {FIT_OPTIONS_RESEAUX.map((label) => (
                  <label key={label} style={checkboxRowStyle}>
                    <input
                      type="checkbox"
                      checked={formData.options_reseaux.includes(label)}
                      onChange={() => toggleOption('options_reseaux', label)}
                    />
                    {label}
                  </label>
                ))}
                {customOptions('options_reseaux').map((label) => (
                  <label key={label} style={checkboxRowStyle}>
                    <input
                      type="checkbox"
                      checked
                      onChange={() => toggleOption('options_reseaux', label)}
                    />
                    {label} <span style={{ color: '#888', fontSize: 12 }}>(ajoutée)</span>
                  </label>
                ))}
                {renderCustomOptionInput('options_reseaux')}
              </div>
              <div className="form-group">
                <label>Option D : Maintenance Informatique</label>
                {FIT_OPTIONS_MAINTENANCE.map((label) => (
                  <label key={label} style={checkboxRowStyle}>
                    <input
                      type="checkbox"
                      checked={formData.options_maintenance.includes(label)}
                      onChange={() => toggleOption('options_maintenance', label)}
                    />
                    {label}
                  </label>
                ))}
                {customOptions('options_maintenance').map((label) => (
                  <label key={label} style={checkboxRowStyle}>
                    <input
                      type="checkbox"
                      checked
                      onChange={() => toggleOption('options_maintenance', label)}
                    />
                    {label} <span style={{ color: '#888', fontSize: 12 }}>(ajoutée)</span>
                  </label>
                ))}
                {renderCustomOptionInput('options_maintenance')}
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Marque / Modèle</label>
                <input type="text" value={formData.marque_modele} onChange={(e) => handleChange('marque_modele', e.target.value)} />
              </div>
              <div className="form-group">
                <label>N° Série</label>
                <input type="text" value={formData.num_serie} onChange={(e) => handleChange('num_serie', e.target.value)} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Système d'exploitation</label>
                <SearchableSelect
                  options={OS_OPTIONS}
                  value={formData.systeme_exploitation}
                  onChange={(value) => handleChange('systeme_exploitation', value)}
                  placeholder="Windows / Linux / Autre"
                  noOptionsText="Aucun système"
                />
              </div>
              <div className="form-group">
                <label>Vol. Données (Go)</label>
                <input type="text" value={formData.vol_donnees} onChange={(e) => handleChange('vol_donnees', e.target.value)} placeholder="Ex : 500" />
              </div>
            </div>
          </section>

          <section className="form-section">
            <span className="form-section__eyebrow">Mesures, tests qualité & diagnostic</span>
            <div className="form-row">
              <div className="form-group">
                <label>Test Continuité / Recette</label>
                <SearchableSelect
                  options={TEST_OPTIONS}
                  value={formData.test_continuite}
                  onChange={(value) => handleChange('test_continuite', value)}
                  placeholder="Conforme / Non conforme"
                  noOptionsText="Aucun résultat"
                />
              </div>
              <div className="form-group">
                <label>Ping (ms)</label>
                <input type="text" value={formData.ping} onChange={(e) => handleChange('ping', e.target.value)} placeholder="Ex : 12" />
              </div>
              <div className="form-group">
                <label>Débit descendant (Mbps)</label>
                <input type="text" value={formData.debit_desc} onChange={(e) => handleChange('debit_desc', e.target.value)} placeholder="Ex : 95" />
              </div>
              <div className="form-group">
                <label>Débit montant (Mbps)</label>
                <input type="text" value={formData.debit_mont} onChange={(e) => handleChange('debit_mont', e.target.value)} placeholder="Ex : 40" />
              </div>
            </div>
            <div className="form-group">
              <label>Description du problème / Symptômes constatés</label>
              <textarea rows={3} value={formData.description_probleme} onChange={(e) => handleChange('description_probleme', e.target.value)} placeholder="Décrivez le problème constaté..." />
            </div>
            <div className="form-group">
              <label>Travaux réalisés & Solutions apportées</label>
              <textarea rows={3} value={formData.travaux_realises} onChange={(e) => handleChange('travaux_realises', e.target.value)} placeholder="Décrivez les travaux effectués..." />
            </div>
          </section>

          <section className="form-section">
            <span className="form-section__eyebrow">Matériels / pièces de rechange remplacées</span>
            {(formData.materiels || []).map((m, index) => (
              <div className="form-row" key={index} style={{ alignItems: 'flex-end' }}>
                <div className="form-group" style={{ flex: 3 }}>
                  <label>Désignation / Référence composant</label>
                  <input type="text" value={m.designation || ''} onChange={(e) => updateMateriel(index, 'designation', e.target.value)} />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Qté</label>
                  <input type="text" value={m.qte || ''} onChange={(e) => updateMateriel(index, 'qte', e.target.value)} />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Garantie (mois)</label>
                  <input type="text" value={m.garantie || ''} onChange={(e) => updateMateriel(index, 'garantie', e.target.value)} />
                </div>
                <button
                  type="button"
                  className="btn-icon btn-icon-danger"
                  title="Retirer la ligne"
                  style={{ marginBottom: 8 }}
                  onClick={() => removeMateriel(index)}
                >
                  <X size={15} />
                </button>
              </div>
            ))}
            <button type="button" className="btn btn-secondary" onClick={addMateriel}>
              <Plus size={16} />
              Ajouter un matériel
            </button>
          </section>

          <section className="form-section">
            <span className="form-section__eyebrow">Clôture</span>
            <div className="form-group">
              <label>Statut final</label>
              <SearchableSelect
                options={STATUT_OPTIONS}
                value={formData.statut_final}
                onChange={(value) => handleChange('statut_final', value)}
                placeholder="Résolu / Partiellement résolu / Non résolu"
                noOptionsText="Aucun statut"
              />
            </div>
          </section>

          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={closeModal}>
              Annuler
            </button>
            <button type="button" className="btn btn-secondary" onClick={resetForm}>
              <RotateCcw size={18} />
              Réinitialiser
            </button>
            <button
              type="button"
              className="btn btn-success"
              onClick={() => exportPdf({ ...toStoredRecord(formData), numero: editingNumero }, true)}
            >
              <Printer size={18} />
              Imprimer
            </button>
            <button type="submit" className="btn btn-primary">
              <FileCheck size={18} />
              {editingId ? 'Enregistrer' : 'Créer la fiche'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Interventions;
