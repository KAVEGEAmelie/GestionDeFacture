import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Eye, Edit2, Trash2, Printer, Download, FileCheck, RotateCcw } from 'lucide-react';
import Modal from '../components/modals/Modal';
import FilterBar from '../components/Filters/FilterBar';
import PeriodFilter from '../components/Filters/PeriodFilter';
import { inDateRange } from '../utils/dateFilters';
import {
  generateInterventionPDF,
  FIT_CATEGORIE_OPTIONS,
  FIT_EQUIPEMENT_OPTIONS,
  FIT_TRAVAUX_OPTIONS,
  FIT_RESULTAT_OPTIONS,
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
  heure_arrivee: '',
  intervenant: '',
  client_nom: '',
  client_adresse: '',
  nom_demandeur: '',
  client_contact: '',
  categorie: [],
  equipements: [],
  marque_modele: '',
  num_serie: '',
  description_probleme: '',
  diagnostic: '',
  travaux_types: [],
  travaux_realises: '',
  materiels: '',
  statut_final: '',
  recommandations: '',
  fin: '',
});

const toStoredRecord = (form) => {
  const details = {
    categorie: arr(form.categorie),
    equipements: arr(form.equipements),
    nom_demandeur: trim(form.nom_demandeur),
    diagnostic: trim(form.diagnostic),
    travaux_types: arr(form.travaux_types),
    recommandations: trim(form.recommandations),
    fin: form.fin || '',
  };
  return {
    date: form.date,
    intervenant: trim(form.intervenant),
    heure_arrivee: trim(form.heure_arrivee),
    client_nom: trim(form.client_nom),
    client_adresse: trim(form.client_adresse),
    client_contact: trim(form.client_contact),
    marque_modele: trim(form.marque_modele),
    num_serie: trim(form.num_serie),
    description_probleme: trim(form.description_probleme),
    travaux_realises: trim(form.travaux_realises),
    materiels: trim(form.materiels),
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
  const [techniciens, setTechniciens] = useState([]);
  const [sitesServices, setSitesServices] = useState([]);
  const [categorieOptions, setCategorieOptions] = useState(FIT_CATEGORIE_OPTIONS);
  const [equipementOptions, setEquipementOptions] = useState(FIT_EQUIPEMENT_OPTIONS);
  const [newCategorie, setNewCategorie] = useState('');
  const [newEquipement, setNewEquipement] = useState('');

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
        const [params, clientsData, interventionsData, techniciensData, sitesData, categoriesData, equipementsData] = await Promise.all([
          window.electronAPI.parametres.getAll(),
          window.electronAPI.clients.getAll(),
          window.electronAPI.interventions.getAll(),
          window.electronAPI.listes ? window.electronAPI.listes.get('technicien') : Promise.resolve([]),
          window.electronAPI.listes ? window.electronAPI.listes.get('site_service') : Promise.resolve([]),
          window.electronAPI.listes ? window.electronAPI.listes.get('intervention_categorie') : Promise.resolve([]),
          window.electronAPI.listes ? window.electronAPI.listes.get('intervention_equipement') : Promise.resolve([]),
        ]);
        setParametres(params || {});
        setClients(clientsData || []);
        setInterventions(interventionsData || []);
        setTechniciens(techniciensData || []);
        setSitesServices(sitesData || []);
        setCategorieOptions((prev) => Array.from(new Set([...prev, ...(categoriesData || [])])));
        setEquipementOptions((prev) => Array.from(new Set([...prev, ...(equipementsData || [])])));
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
      client_contact: client ? (client.telephone || prev.client_contact) : prev.client_contact,
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

  // Ajoute un choix tapé à la volée : coché immédiatement + mémorisé pour les prochaines fiches
  const addCustomOption = async (field, categorieListe, rawValue, setOptions) => {
    const v = trim(rawValue);
    if (!v) return;
    setFormData((prev) => {
      const list = Array.isArray(prev[field]) ? prev[field] : [];
      return list.includes(v) ? prev : { ...prev, [field]: [...list, v] };
    });
    setOptions((prev) => (prev.includes(v) ? prev : [...prev, v]));
    if (window.electronAPI.listes) {
      try {
        await window.electronAPI.listes.add(categorieListe, v);
      } catch {
        // non bloquant
      }
    }
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
                <label>Heure</label>
                <input type="time" value={formData.heure_arrivee} onChange={(e) => handleChange('heure_arrivee', e.target.value)} />
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
          </section>

          <section className="form-section">
            <span className="form-section__eyebrow">1. Client / Service</span>
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
                <label>Service / Département</label>
                <SearchableSelect
                  options={sitesServices.map((s) => ({ value: s, label: s }))}
                  value={formData.client_adresse}
                  onChange={(val, option) => handleChange('client_adresse', option?.label || val)}
                  placeholder="Choisir ou saisir un service / département"
                  noOptionsText="Aucun service — tapez-le puis Entrée"
                  allowCustomValue
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Nom du demandeur</label>
                <input type="text" value={formData.nom_demandeur} onChange={(e) => handleChange('nom_demandeur', e.target.value)} />
              </div>
              <div className="form-group">
                <label>Tél.</label>
                <input type="text" value={formData.client_contact} onChange={(e) => handleChange('client_contact', e.target.value)} placeholder="Ex : +228 90 00 00 00" />
              </div>
            </div>
          </section>

          <section className="form-section">
            <span className="form-section__eyebrow">2. Équipement concerné</span>
            <div className="form-group">
              <label>Catégorie</label>
              {renderCheckGrid('categorie', categorieOptions)}
              <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                <input
                  type="text"
                  value={newCategorie}
                  onChange={(e) => setNewCategorie(e.target.value)}
                  placeholder="Autre catégorie : tapez puis Entrée"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addCustomOption('categorie', 'intervention_categorie', newCategorie, setCategorieOptions);
                      setNewCategorie('');
                    }
                  }}
                />
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    addCustomOption('categorie', 'intervention_categorie', newCategorie, setCategorieOptions);
                    setNewCategorie('');
                  }}
                >
                  <Plus size={14} />
                  Ajouter
                </button>
              </div>
            </div>
            <div className="form-group">
              <label>Équipement</label>
              {renderCheckGrid('equipements', equipementOptions)}
              <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                <input
                  type="text"
                  value={newEquipement}
                  onChange={(e) => setNewEquipement(e.target.value)}
                  placeholder="Autre équipement : tapez puis Entrée"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addCustomOption('equipements', 'intervention_equipement', newEquipement, setEquipementOptions);
                      setNewEquipement('');
                    }
                  }}
                />
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    addCustomOption('equipements', 'intervention_equipement', newEquipement, setEquipementOptions);
                    setNewEquipement('');
                  }}
                >
                  <Plus size={14} />
                  Ajouter
                </button>
              </div>
            </div>
            <div className="form-row" style={{ marginTop: 10 }}>
              <div className="form-group">
                <label>Marque / Modèle</label>
                <input type="text" value={formData.marque_modele} onChange={(e) => handleChange('marque_modele', e.target.value)} />
              </div>
              <div className="form-group">
                <label>N° série / Adresse IP</label>
                <input type="text" value={formData.num_serie} onChange={(e) => handleChange('num_serie', e.target.value)} />
              </div>
            </div>
          </section>

          <section className="form-section">
            <span className="form-section__eyebrow">3. Panne / demande</span>
            <div className="form-group">
              <textarea rows={3} value={formData.description_probleme} onChange={(e) => handleChange('description_probleme', e.target.value)} placeholder="Décrivez la panne ou la demande..." />
            </div>
          </section>

          <section className="form-section">
            <span className="form-section__eyebrow">4. Diagnostic</span>
            <div className="form-group">
              <textarea rows={3} value={formData.diagnostic} onChange={(e) => handleChange('diagnostic', e.target.value)} placeholder="Constat technique..." />
            </div>
          </section>

          <section className="form-section">
            <span className="form-section__eyebrow">5. Travaux effectués</span>
            {renderCheckGrid('travaux_types', FIT_TRAVAUX_OPTIONS)}
            <div className="form-group" style={{ marginTop: 10 }}>
              <label>Détails</label>
              <textarea rows={3} value={formData.travaux_realises} onChange={(e) => handleChange('travaux_realises', e.target.value)} placeholder="Décrivez les travaux effectués..." />
            </div>
          </section>

          <section className="form-section">
            <span className="form-section__eyebrow">6. Pièces / matériel utilisé</span>
            <div className="form-group">
              <textarea rows={3} value={formData.materiels} onChange={(e) => handleChange('materiels', e.target.value)} placeholder="Pièces, consommables ou matériel utilisés / remplacés..." />
            </div>
          </section>

          <section className="form-section">
            <span className="form-section__eyebrow">7. Résultat de l'intervention</span>
            <div className="form-group">
              {renderRadioRow('statut_final', FIT_RESULTAT_OPTIONS)}
            </div>
            <div className="form-group">
              <label>Recommandation / Observation</label>
              <textarea rows={3} value={formData.recommandations} onChange={(e) => handleChange('recommandations', e.target.value)} />
            </div>
          </section>

          <section className="form-section">
            <span className="form-section__eyebrow">8. Validation</span>
            <div className="form-group">
              <label>Date de clôture</label>
              <input type="date" value={formData.fin} onChange={(e) => handleChange('fin', e.target.value)} />
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
