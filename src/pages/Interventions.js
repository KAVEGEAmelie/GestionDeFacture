import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Eye, Edit2, Trash2, Printer, Download, FileCheck, RotateCcw, X } from 'lucide-react';
import Modal from '../components/modals/Modal';
import FilterBar from '../components/Filters/FilterBar';
import PeriodFilter from '../components/Filters/PeriodFilter';
import { inDateRange } from '../utils/dateFilters';
import {
  generateInterventionPDF,
  FIT_NATURE_OPTIONS,
  FIT_EQUIPEMENT_OPTIONS,
  FIT_TESTS_OPTIONS,
  FIT_BACKUP_OPTIONS,
  FIT_DONNEES_OPTIONS,
  FIT_SECURITE_OPTIONS,
  FIT_ETAT_FINAL_OPTIONS,
  FIT_EQUIP_FINAL_OPTIONS,
  FIT_ETAT_RECEPTION_OPTIONS,
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

const trim = (v) => String(v || '').trim();
const arr = (v) => (Array.isArray(v) ? v : []);

const buildDefaultForm = () => ({
  date: todayISO(),
  intervenant: '',
  client_nom: '',
  client_adresse: '',
  client_contact: '',
  marque_modele: '',
  num_serie: '',
  description_probleme: '',
  travaux_realises: '',
  materiels: [],
  statut_final: '',
  // Champs du modèle V11
  nature: [],
  equipements: [],
  accessoires: '',
  etat_reception: '',
  diagnostic: '',
  tests: [],
  backup_before: '',
  donnees: [],
  donnees_autres: '',
  securite: [],
  data_obs: '',
  equip_final: '',
  fin: '',
  duree: '',
  prochaine_action: '',
  recommandations: '',
  obs_client: '',
  // Anciens champs conservés pour ne pas perdre les données des fiches existantes
  heure_arrivee: '',
  heure_depart: '',
  interlocuteur: '',
  options_reseaux: [],
  options_maintenance: [],
  systeme_exploitation: '',
  vol_donnees: '',
  test_continuite: '',
  ping: '',
  debit_desc: '',
  debit_mont: '',
});

const toStoredRecord = (form) => {
  const details = {
    nature: arr(form.nature),
    equipements: arr(form.equipements),
    accessoires: trim(form.accessoires),
    etat_reception: form.etat_reception || '',
    diagnostic: trim(form.diagnostic),
    tests: arr(form.tests),
    backup_before: form.backup_before || '',
    donnees: arr(form.donnees),
    donnees_autres: trim(form.donnees_autres),
    securite: arr(form.securite),
    data_obs: trim(form.data_obs),
    equip_final: form.equip_final || '',
    fin: form.fin || '',
    duree: trim(form.duree),
    prochaine_action: trim(form.prochaine_action),
    recommandations: trim(form.recommandations),
    obs_client: trim(form.obs_client),
  };
  return {
    date: form.date,
    intervenant: trim(form.intervenant),
    heure_arrivee: trim(form.heure_arrivee),
    heure_depart: trim(form.heure_depart),
    client_nom: trim(form.client_nom),
    client_adresse: trim(form.client_adresse),
    client_contact: trim(form.client_contact),
    interlocuteur: trim(form.interlocuteur),
    options_reseaux: arr(form.options_reseaux),
    options_maintenance: arr(form.options_maintenance),
    marque_modele: trim(form.marque_modele),
    num_serie: trim(form.num_serie),
    systeme_exploitation: form.systeme_exploitation || '',
    vol_donnees: trim(form.vol_donnees),
    test_continuite: form.test_continuite || '',
    ping: trim(form.ping),
    debit_desc: trim(form.debit_desc),
    debit_mont: trim(form.debit_mont),
    description_probleme: trim(form.description_probleme),
    travaux_realises: trim(form.travaux_realises),
    materiels: arr(form.materiels).filter(
      (m) => m && ['designation', 'qte', 'etat', 'ref', 'garantie'].some((k) => trim(m[k]))
    ),
    statut_final: form.statut_final || '',
    ...details,
    details,
  };
};

const toForm = (record) => {
  const base = buildDefaultForm();
  const form = { ...base };
  Object.keys(base).forEach((key) => {
    if (record[key] !== undefined && record[key] !== null) form[key] = record[key];
  });
  form.date = record.date || todayISO();
  return form;
};

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
  const [produits, setProduits] = useState([]);
  const [techniciens, setTechniciens] = useState([]);
  const [sitesServices, setSitesServices] = useState([]);

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
        const [params, clientsData, interventionsData, produitsData, techniciensData, sitesData] = await Promise.all([
          window.electronAPI.parametres.getAll(),
          window.electronAPI.clients.getAll(),
          window.electronAPI.interventions.getAll(),
          window.electronAPI.produits.getAll(),
          window.electronAPI.listes ? window.electronAPI.listes.get('technicien') : Promise.resolve([]),
          window.electronAPI.listes ? window.electronAPI.listes.get('site_service') : Promise.resolve([]),
        ]);
        setParametres(params || {});
        setClients(clientsData || []);
        setInterventions(interventionsData || []);
        setProduits(produitsData || []);
        setTechniciens(techniciensData || []);
        setSitesServices(sitesData || []);
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

  const renderCheckGrid = (field, options) => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: '0 12px' }}>
      {options.map((label) => (
        <label key={label} style={checkboxRowStyle}>
          <input
            type="checkbox"
            checked={(formData[field] || []).includes(label)}
            onChange={() => toggleOption(field, label)}
          />
          {label}
        </label>
      ))}
    </div>
  );

  // Radio décochable : recliquer sur l'option sélectionnée la vide
  const renderRadioRow = (field, options) => (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0 16px' }}>
      {options.map((label) => (
        <label key={label} style={checkboxRowStyle}>
          <input
            type="radio"
            checked={formData[field] === label}
            onChange={() => {}}
            onClick={() => handleChange(field, formData[field] === label ? '' : label)}
          />
          {label}
        </label>
      ))}
    </div>
  );

  const addMateriel = () => {
    setFormData((prev) => ({
      ...prev,
      materiels: [...(prev.materiels || []), { designation: '', qte: '', etat: '', ref: '' }],
    }));
  };

  const updateMateriel = (index, key, value) => {
    setFormData((prev) => {
      const materiels = [...(prev.materiels || [])];
      materiels[index] = { ...materiels[index], [key]: value };
      return { ...prev, materiels };
    });
  };

  // Désignation liée aux produits : création immédiate si le produit n'existe pas
  const handlePieceDesignation = async (index, value, option) => {
    const designation = option?.label || value;
    updateMateriel(index, 'designation', designation);
    if (option?.custom && window.electronAPI?.produits) {
      try {
        await window.electronAPI.produits.create({ designation, prix_unitaire: 0, unite: 'Unité', description: '' });
        const data = await window.electronAPI.produits.getAll();
        setProduits(data || []);
        toast.success(`Produit « ${designation} » créé et ajouté à la liste des produits.`);
      } catch (error) {
        toast.error(getErrorMessage(error, 'Impossible de créer le produit.'));
      }
    }
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
      // Mémorise technicien et site/service pour les prochaines fiches
      if (window.electronAPI.listes) {
        if (payload.intervenant) {
          await window.electronAPI.listes.add('technicien', payload.intervenant);
          setTechniciens((prev) => (prev.includes(payload.intervenant) ? prev : [...prev, payload.intervenant].sort((a, b) => a.localeCompare(b, 'fr'))));
        }
        if (payload.client_adresse) {
          await window.electronAPI.listes.add('site_service', payload.client_adresse);
          setSitesServices((prev) => (prev.includes(payload.client_adresse) ? prev : [...prev, payload.client_adresse].sort((a, b) => a.localeCompare(b, 'fr'))));
        }
      }
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
                <label>Date intervention *</label>
                <input type="date" value={formData.date} onChange={(e) => handleChange('date', e.target.value)} />
              </div>
              <div className="form-group">
                <label>Technicien(s)</label>
                <SearchableSelect
                  options={techniciens.map((t) => ({ value: t, label: t }))}
                  value={formData.intervenant}
                  onChange={(val, option) => handleChange('intervenant', option?.label || val)}
                  placeholder="Choisir ou saisir un technicien"
                  noOptionsText="Aucun technicien — tapez le nom puis Entrée"
                  allowCustomValue
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Client / Structure *</label>
                <SearchableSelect
                  options={sortedClients.map((client) => ({ value: client.nom, label: client.nom }))}
                  value={formData.client_nom}
                  onChange={(clientNom, option) => handleClientSelect(option?.label || clientNom)}
                  placeholder="Rechercher un client"
                  noOptionsText="Aucun client correspondant"
                />
              </div>
              <div className="form-group">
                <label>Site / Service</label>
                <SearchableSelect
                  options={sitesServices.map((s) => ({ value: s, label: s }))}
                  value={formData.client_adresse}
                  onChange={(val, option) => handleChange('client_adresse', option?.label || val)}
                  placeholder="Choisir ou saisir un site / service"
                  noOptionsText="Aucun site — tapez-le puis Entrée"
                  allowCustomValue
                />
              </div>
              <div className="form-group">
                <label>Contact client</label>
                <input type="text" value={formData.client_contact} onChange={(e) => handleChange('client_contact', e.target.value)} placeholder="Ex : +228 90 00 00 00 / client@mail.com" />
              </div>
            </div>
          </section>

          <section className="form-section">
            <span className="form-section__eyebrow">1. Nature de la demande</span>
            {renderCheckGrid('nature', FIT_NATURE_OPTIONS)}
            <div className="form-group" style={{ marginTop: 10 }}>
              <label>Description de la demande / problème signalé</label>
              <textarea rows={3} value={formData.description_probleme} onChange={(e) => handleChange('description_probleme', e.target.value)} placeholder="Décrivez la demande ou le problème signalé..." />
            </div>
          </section>

          <section className="form-section">
            <span className="form-section__eyebrow">2. Équipement(s) / système(s) concerné(s)</span>
            {renderCheckGrid('equipements', FIT_EQUIPEMENT_OPTIONS)}
            <div className="form-row" style={{ marginTop: 10 }}>
              <div className="form-group">
                <label>Marque / Modèle</label>
                <input type="text" value={formData.marque_modele} onChange={(e) => handleChange('marque_modele', e.target.value)} />
              </div>
              <div className="form-group">
                <label>N° série / Inventaire</label>
                <input type="text" value={formData.num_serie} onChange={(e) => handleChange('num_serie', e.target.value)} />
              </div>
              <div className="form-group">
                <label>Accessoires reçus</label>
                <input type="text" value={formData.accessoires} onChange={(e) => handleChange('accessoires', e.target.value)} placeholder="Ex : câble d'alimentation, sacoche..." />
              </div>
            </div>
            <div className="form-group">
              <label>État réception</label>
              {renderRadioRow('etat_reception', FIT_ETAT_RECEPTION_OPTIONS)}
            </div>
          </section>

          <section className="form-section">
            <span className="form-section__eyebrow">3. Diagnostic / constat technique</span>
            <div className="form-group">
              <textarea rows={4} value={formData.diagnostic} onChange={(e) => handleChange('diagnostic', e.target.value)} placeholder="Constat technique détaillé... Les paragraphes seront respectés sur le PDF." />
            </div>
          </section>

          <section className="form-section">
            <span className="form-section__eyebrow">4. Travaux effectués</span>
            <div className="form-group">
              <textarea rows={4} value={formData.travaux_realises} onChange={(e) => handleChange('travaux_realises', e.target.value)} placeholder="Décrivez les travaux effectués..." />
            </div>
          </section>

          <section className="form-section">
            <span className="form-section__eyebrow">5. Pièces / consommables / matériel utilisés ou remplacés</span>
            {(formData.materiels || []).map((m, index) => (
              <div className="form-row" key={index} style={{ alignItems: 'flex-end' }}>
                <div className="form-group" style={{ flex: 3 }}>
                  <label>Désignation</label>
                  <SearchableSelect
                    options={produits.map((p) => ({ value: p.designation, label: p.designation }))}
                    value={m.designation || ''}
                    onChange={(val, option) => handlePieceDesignation(index, val, option)}
                    placeholder="Rechercher un produit existant"
                    noOptionsText="Aucun produit — tapez la désignation puis Entrée pour le créer"
                    allowCustomValue
                  />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Qté</label>
                  <input type="number" min="0" step="1" value={m.qte || ''} onChange={(e) => updateMateriel(index, 'qte', e.target.value)} />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>État</label>
                  <select value={m.etat || ''} onChange={(e) => updateMateriel(index, 'etat', e.target.value)}>
                    <option value="">—</option>
                    <option value="Neuf">Neuf</option>
                    <option value="Réutilisé">Réutilisé</option>
                    <option value="Occasion">Occasion</option>
                  </select>
                </div>
                <div className="form-group" style={{ flex: 2 }}>
                  <label>Observation / Référence</label>
                  <input type="text" value={m.ref || ''} onChange={(e) => updateMateriel(index, 'ref', e.target.value)} />
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
              Ajouter une pièce / un matériel
            </button>
          </section>

          <section className="form-section">
            <span className="form-section__eyebrow">6. Contrôles et tests après intervention</span>
            {renderCheckGrid('tests', FIT_TESTS_OPTIONS)}
          </section>

          <section className="form-section">
            <span className="form-section__eyebrow">7. Données, sauvegarde et sécurité</span>
            <div className="form-group">
              <label>Sauvegarde avant intervention</label>
              {renderRadioRow('backup_before', FIT_BACKUP_OPTIONS)}
            </div>
            <div className="form-group">
              <label>Données concernées</label>
              {renderCheckGrid('donnees', FIT_DONNEES_OPTIONS)}
              <input
                type="text"
                value={formData.donnees_autres}
                onChange={(e) => handleChange('donnees_autres', e.target.value)}
                placeholder="Autres données : préciser..."
                style={{ marginTop: 6 }}
              />
            </div>
            <div className="form-group">
              <label>Sécurité</label>
              {renderCheckGrid('securite', FIT_SECURITE_OPTIONS)}
            </div>
            <div className="form-group">
              <label>Observation sur les données / la sécurité</label>
              <textarea rows={3} value={formData.data_obs} onChange={(e) => handleChange('data_obs', e.target.value)} />
            </div>
          </section>

          <section className="form-section">
            <span className="form-section__eyebrow">8. État final de l'intervention</span>
            <div className="form-group">
              <label>Statut final</label>
              {renderRadioRow('statut_final', FIT_ETAT_FINAL_OPTIONS)}
            </div>
            <div className="form-group">
              <label>Équipement</label>
              {renderRadioRow('equip_final', FIT_EQUIP_FINAL_OPTIONS)}
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Fin de l'intervention</label>
                <input type="date" value={formData.fin} onChange={(e) => handleChange('fin', e.target.value)} />
              </div>
              <div className="form-group">
                <label>Durée</label>
                <SearchableSelect
                  options={['30 min', '45 min', '1h', '1h30', '2h', '2h30', '3h', '4h', 'Demi-journée', 'Journée complète', '2 jours', '3 jours', '1 semaine'].map((d) => ({ value: d, label: d }))}
                  value={formData.duree}
                  onChange={(val, option) => handleChange('duree', option?.label || val)}
                  placeholder="Choisir ou saisir une durée"
                  noOptionsText="Tapez la durée puis Entrée"
                  allowCustomValue
                />
              </div>
              <div className="form-group">
                <label>Prochaine action</label>
                <input type="text" value={formData.prochaine_action} onChange={(e) => handleChange('prochaine_action', e.target.value)} placeholder="Ex : retour avec la pièce commandée" />
              </div>
            </div>
          </section>

          <section className="form-section">
            <span className="form-section__eyebrow">9. Recommandations / travaux complémentaires</span>
            <div className="form-group">
              <textarea rows={3} value={formData.recommandations} onChange={(e) => handleChange('recommandations', e.target.value)} placeholder="Recommandations, travaux à prévoir..." />
            </div>
          </section>

          <section className="form-section">
            <span className="form-section__eyebrow">10. Validation du client / utilisateur</span>
            <div className="form-group">
              <label>Observation du client</label>
              <textarea rows={3} value={formData.obs_client} onChange={(e) => handleChange('obs_client', e.target.value)} />
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
