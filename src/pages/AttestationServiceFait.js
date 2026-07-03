import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Eye, Edit2, Trash2, Printer, Download, FileCheck, RotateCcw } from 'lucide-react';
import Modal from '../components/modals/Modal';
import FilterBar from '../components/Filters/FilterBar';
import PeriodFilter from '../components/Filters/PeriodFilter';
import { inDateRange } from '../utils/dateFilters';
import { generateAttestationPDF } from '../utils/pdfGenerator';
import { useToast } from '../components/Toast/ToastProvider';
import { useConfirm } from '../components/ConfirmDialog/ConfirmProvider';
import { getErrorMessage } from '../utils/errors';
import { matchesWordPrefix } from '../utils/search';
import SearchableSelect from '../components/Inputs/SearchableSelect';
import './Clients.css';
import './Proformas.css';
import './RapportsModal.css';

const LEGACY_STORAGE_KEY = 'attestations_service_fait_v1';

const todayISO = () => new Date().toISOString().split('T')[0];
const makeRef = () => `ASF-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Date.now().toString().slice(-4)}`;
const ALIGN_OPTIONS = [
  { value: 'left', label: 'Gauche' },
  { value: 'center', label: 'Centré' },
  { value: 'right', label: 'Droite' },
  { value: 'justify', label: 'Justifié' },
];
const LIST_MODE_OPTIONS = [
  { value: 'bullets', label: 'Pointillés (puces)' },
  { value: 'plain', label: 'Texte normal' },
];

const normalizeAlign = (value, fallback = 'left') => {
  const allowed = new Set(['left', 'center', 'right', 'justify']);
  return allowed.has(value) ? value : fallback;
};

const normalizeListMode = (value, fallback = 'bullets') => {
  const allowed = new Set(['bullets', 'plain']);
  return allowed.has(value) ? value : fallback;
};

const splitTravauxInput = (value) => {
  const source = String(value || '').replace(/\r/g, '');
  if (!source.trim()) return [];

  return source
    .split('\n')
    .flatMap((line) =>
      line
        .replace(/[;,]\s*[•]\s*/g, '\n• ')
        .replace(/\s+[•]\s*/g, '\n• ')
        .split('\n')
    )
    .map((line) => line.replace(/^[-•*]\s*/, '').replace(/^[,;]+/, '').trim())
    .filter(Boolean);
};

const loadLegacyStoredAttestations = () => {
  try {
    const raw = window.localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const buildDefaultForm = (params = {}) => ({
  title: 'ATTESTION DE SERVICE FAIT',
  reference: makeRef(),
  date: '',
  lieu: '',
  client_nom: '',
  objet: '',
  intro: '',
  intro_align: 'justify',
  travaux: '',
  travaux_align: 'left',
  travaux_list_mode: 'bullets',
  conformite: '',
  conformite_align: 'justify',
  signataire_gauche: '',
  signataire_droite: '',
});

const toStoredRecord = (form, previous = {}) => ({
  ...previous,
  title: (form.title || '').trim(),
  reference: (form.reference || '').trim() || makeRef(),
  date: form.date,
  lieu: (form.lieu || '').trim(),
  client_nom: (form.client_nom || '').trim(),
  objet: (form.objet || '').trim(),
  intro: (form.intro || '').trim(),
  intro_align: normalizeAlign(form.intro_align, 'justify'),
  travaux: splitTravauxInput(form.travaux),
  travaux_align: normalizeAlign(form.travaux_align, 'left'),
  travaux_list_mode: normalizeListMode(form.travaux_list_mode, 'bullets'),
  conformite: (form.conformite || '').trim(),
  conformite_align: normalizeAlign(form.conformite_align, 'justify'),
  signataire_gauche: (form.signataire_gauche || '').trim(),
  signataire_droite: (form.signataire_droite || '').trim(),
});

const toForm = (record, params = {}) => ({
  title: record.title || 'ATTESTION DE SERVICE FAIT',
  reference: record.reference || makeRef(),
  date: record.date || '',
  lieu: record.lieu || '',
  client_nom: record.client_nom || '',
  objet: record.objet || '',
  intro: record.intro || '',
  intro_align: normalizeAlign(record.intro_align, 'justify'),
  travaux: Array.isArray(record.travaux) ? record.travaux.join('\n') : String(record.travaux || ''),
  travaux_align: normalizeAlign(record.travaux_align, 'left'),
  travaux_list_mode: normalizeListMode(record.travaux_list_mode, 'bullets'),
  conformite: record.conformite || '',
  conformite_align: normalizeAlign(record.conformite_align, 'justify'),
  signataire_gauche: record.signataire_gauche || '',
  signataire_droite: record.signataire_droite || '',
});

const AttestationServiceFait = () => {
  const toast = useToast();
  const confirm = useConfirm();

  const [parametres, setParametres] = useState({});
  const [clients, setClients] = useState([]);
  const [attestations, setAttestations] = useState([]);

  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'date', direction: 'desc' });
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
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
        const [params, clientsData, attestationsData] = await Promise.all([
          window.electronAPI.parametres.getAll(),
          window.electronAPI.clients.getAll(),
          window.electronAPI.attestations.getAll(),
        ]);

        let finalAttestations = attestationsData || [];
        if (finalAttestations.length === 0) {
          const legacyAttestations = loadLegacyStoredAttestations();
          if (legacyAttestations.length > 0) {
            for (const legacyItem of legacyAttestations) {
              await window.electronAPI.attestations.create({
                reference: legacyItem.reference || '',
                title: legacyItem.title || legacyItem.titre || 'ATTESTATION DE SERVICE FAIT',
                date: legacyItem.date || '',
                lieu: legacyItem.lieu || '',
                client_nom: legacyItem.client_nom || '',
                objet: legacyItem.objet || '',
                intro: legacyItem.intro || '',
                intro_align: normalizeAlign(legacyItem.intro_align, 'justify'),
                travaux: Array.isArray(legacyItem.travaux)
                  ? legacyItem.travaux
                  : splitTravauxInput(legacyItem.travaux || ''),
                travaux_align: normalizeAlign(legacyItem.travaux_align, 'left'),
                travaux_list_mode: normalizeListMode(legacyItem.travaux_list_mode, 'bullets'),
                conformite: legacyItem.conformite || '',
                conformite_align: normalizeAlign(legacyItem.conformite_align, 'justify'),
                signataire_gauche: legacyItem.signataire_gauche || '',
                signataire_droite: legacyItem.signataire_droite || '',
              });
            }
            finalAttestations = await window.electronAPI.attestations.getAll();
            toast.success(`${legacyAttestations.length} attestation(s) récupérée(s) depuis l'ancienne version.`);
          }
        }

        setParametres(params || {});
        setClients(clientsData || []);
        setAttestations(finalAttestations);
        setFormData(buildDefaultForm(params || {}));
      } catch (error) {
        toast.error(getErrorMessage(error, 'Impossible de charger les données.'));
      }
    })();
  }, [toast]);

  const formatDate = (value) => (value ? new Date(value).toLocaleDateString('fr-FR') : '-');

  const filteredAttestations = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return attestations.filter((a) => {
      const matchSearch =
        !term ||
        matchesWordPrefix(a.numero, term) ||
        matchesWordPrefix(a.reference, term) ||
        matchesWordPrefix(a.client_nom, term) ||
        matchesWordPrefix(a.objet, term);
      const matchDate = inDateRange(a.date, dateFrom, dateTo);
      return matchSearch && matchDate;
    });
  }, [attestations, searchTerm, dateFrom, dateTo]);

  const sortedFilteredAttestations = useMemo(() => {
    const items = [...filteredAttestations];
    const { key, direction } = sortConfig;
    const factor = direction === 'asc' ? 1 : -1;
    return items.sort((a, b) => {
      if (key === 'date') {
        return ((new Date(a.date).getTime() || 0) - (new Date(b.date).getTime() || 0)) * factor;
      }
      return String(a[key] || '').localeCompare(String(b[key] || ''), 'fr', { sensitivity: 'base' }) * factor;
    });
  }, [filteredAttestations, sortConfig]);

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
    const fresh = buildDefaultForm(parametres);
    setEditingId(null);
    setFormData(fresh);
    initialFormRef.current = JSON.stringify(fresh);
    setIsModalOpen(true);
  };

  const openEditModal = (item) => {
    const loaded = toForm(item, parametres);
    setEditingId(item.id);
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
    initialFormRef.current = null;
  };

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const resetForm = async () => {
    const ok = await confirm({
      title: 'Réinitialiser le formulaire',
      message: 'Voulez-vous remettre le modèle par défaut ?',
      confirmText: 'Réinitialiser',
      danger: false,
    });
    if (!ok) return;
    const fresh = buildDefaultForm(parametres);
    setFormData(fresh);
    initialFormRef.current = JSON.stringify(fresh);
  };

  const validateRecord = (record) => {
    if (!record.client_nom) {
      toast.error('Veuillez renseigner le client bénéficiaire.');
      return false;
    }
    if (!record.intro || !record.conformite || !record.travaux.length) {
      toast.error('Veuillez compléter introduction, travaux et conformité.');
      return false;
    }
    return true;
  };

  const handleSave = async (e) => {
    e.preventDefault();

    const payload = toStoredRecord(formData);
    if (!validateRecord(payload)) return;

    try {
      if (editingId) {
        await window.electronAPI.attestations.update(editingId, payload);
        toast.success('Attestation mise à jour.');
      } else {
        await window.electronAPI.attestations.create(payload);
        toast.success('Attestation créée.');
      }
      const updated = await window.electronAPI.attestations.getAll();
      setAttestations(updated || []);
    } catch (error) {
      toast.error(getErrorMessage(error, 'Erreur lors de l\'enregistrement.'));
      return;
    }

    setIsModalOpen(false);
    setEditingId(null);
    initialFormRef.current = null;
  };

  const handleDelete = async (id) => {
    const ok = await confirm({
      title: 'Supprimer l\'attestation',
      message: 'Êtes-vous sûr de vouloir supprimer cette attestation ?',
      confirmText: 'Supprimer',
      danger: true,
    });
    if (!ok) return;

    try {
      await window.electronAPI.attestations.delete(id);
      const updated = await window.electronAPI.attestations.getAll();
      setAttestations(updated || []);
      toast.success('Attestation supprimée.');
    } catch (error) {
      toast.error(getErrorMessage(error, 'Erreur lors de la suppression.'));
    }
  };

  const exportPdf = async (item, print = false, preview = false) => {
    try {
      const doc = await generateAttestationPDF(item, parametres);
      if (print) {
        doc.autoPrint();
        window.open(doc.output('bloburl'), '_blank');
      } else if (preview) {
        window.open(doc.output('bloburl'), '_blank');
      } else {
        doc.save(`Attestation_Service_Fait_${String(item.reference || item.numero || 'ASF').replace(/\//g, '-')}.pdf`);
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
          <h1>Attestation de service fait</h1>
          <p className="subtitle">Organisez vos attestations avec une mise en page propre et professionnelle.</p>
        </div>
        <div className="header-actions">
          <button className="btn btn-primary" onClick={openCreateModal}>
            <Plus size={18} />
            Nouvelle attestation
          </button>
        </div>
      </div>

      <div className="content-card">
        <FilterBar
          searchValue={searchTerm}
          onSearchChange={setSearchTerm}
          searchPlaceholder="Rechercher par numéro, référence, client ou objet..."
          activeCount={activeCount}
          onReset={resetFilters}
        >
          <PeriodFilter
            label="Date de l'attestation"
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
                <th onClick={() => toggleSort('reference')} style={{ cursor: 'pointer' }}>Référence{sortMark('reference')}</th>
                <th onClick={() => toggleSort('date')} style={{ cursor: 'pointer' }}>Date{sortMark('date')}</th>
                <th onClick={() => toggleSort('client_nom')} style={{ cursor: 'pointer' }}>Client{sortMark('client_nom')}</th>
                <th onClick={() => toggleSort('objet')} style={{ cursor: 'pointer' }}>Objet{sortMark('objet')}</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedFilteredAttestations.length === 0 ? (
                <tr>
                  <td colSpan="6" className="empty-state">
                    Aucune attestation enregistrée pour le moment.
                  </td>
                </tr>
              ) : (
                sortedFilteredAttestations.map((item) => (
                  <tr key={item.id}>
                    <td className="font-semibold">{item.numero || '-'}</td>
                    <td>{item.reference || '-'}</td>
                    <td>{formatDate(item.date)}</td>
                    <td>{item.client_nom || '-'}</td>
                    <td>{item.objet || '-'}</td>
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
        title={editingId ? 'Modifier l\'attestation' : 'Nouvelle attestation de service fait'}
        size="xlarge"
      >
        <form className="form rapports-form" onSubmit={handleSave}>
          <section className="form-section">
            <span className="form-section__eyebrow">Informations générales</span>
            <div className="form-row">
              <div className="form-group">
                <label>Titre</label>
                <input type="text" value={formData.title} onChange={(e) => handleChange('title', e.target.value)} placeholder="Ex : ATTESTATION DE SERVICE FAIT" />
              </div>
              <div className="form-group">
                <label>Référence</label>
                <input type="text" value={formData.reference} readOnly />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Date</label>
                <input type="date" value={formData.date} onChange={(e) => handleChange('date', e.target.value)} />
              </div>
              <div className="form-group">
                <label>Lieu</label>
                <input type="text" value={formData.lieu} onChange={(e) => handleChange('lieu', e.target.value)} placeholder="Ex : Lomé" />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Client bénéficiaire</label>
                <SearchableSelect
                  options={sortedClients.map((client) => ({ value: client.nom, label: client.nom }))}
                  value={formData.client_nom}
                  onChange={(clientNom, option) => handleChange('client_nom', option?.label || clientNom)}
                  placeholder="Rechercher un client"
                  noOptionsText="Aucun client correspondant"
                />
              </div>
              <div className="form-group">
                <label>Objet</label>
                <input type="text" value={formData.objet} onChange={(e) => handleChange('objet', e.target.value)} placeholder="Ex : Renforcement du pylône paratonnerre" />
              </div>
            </div>
          </section>

          <section className="form-section">
            <span className="form-section__eyebrow">Contenu de l'attestation</span>
            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                <label>Introduction</label>
                <div style={{ minWidth: 180, maxWidth: 220 }}>
                  <SearchableSelect
                    options={ALIGN_OPTIONS}
                    value={formData.intro_align}
                    onChange={(value) => handleChange('intro_align', value)}
                    placeholder="Alignement"
                    noOptionsText="Aucun alignement"
                  />
                </div>
              </div>
              <textarea rows={4} value={formData.intro} onChange={(e) => handleChange('intro', e.target.value)} placeholder="Ex : Nous soussignés, ... attestons par la présente que ..." />
            </div>

            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                <label>Travaux réalisés (une ligne = une puce)</label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  <div style={{ minWidth: 180, maxWidth: 220 }}>
                    <SearchableSelect
                      options={ALIGN_OPTIONS}
                      value={formData.travaux_align}
                      onChange={(value) => handleChange('travaux_align', value)}
                      placeholder="Alignement"
                      noOptionsText="Aucun alignement"
                    />
                  </div>
                  <div style={{ minWidth: 180, maxWidth: 260 }}>
                    <SearchableSelect
                      options={LIST_MODE_OPTIONS}
                      value={formData.travaux_list_mode}
                      onChange={(value) => handleChange('travaux_list_mode', value)}
                      placeholder="Style de liste"
                      noOptionsText="Aucun style"
                    />
                  </div>
                </div>
              </div>
              <textarea rows={8} value={formData.travaux} onChange={(e) => handleChange('travaux', e.target.value)} placeholder="Ex :\nRéalisation d'un massif en béton armé\nMise en place de poteaux et longrines\nTraitement anticorrosion" />
            </div>

            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                <label>Conformité des travaux</label>
                <div style={{ minWidth: 180, maxWidth: 220 }}>
                  <SearchableSelect
                    options={ALIGN_OPTIONS}
                    value={formData.conformite_align}
                    onChange={(value) => handleChange('conformite_align', value)}
                    placeholder="Alignement"
                    noOptionsText="Aucun alignement"
                  />
                </div>
              </div>
              <textarea rows={4} value={formData.conformite} onChange={(e) => handleChange('conformite', e.target.value)} placeholder="Ex : Les interventions ont été réalisées dans le respect des règles de l'art..." />
            </div>
          </section>

          <section className="form-section">
            <span className="form-section__eyebrow">Signataires</span>
            <div className="form-row">
              <div className="form-group">
                <label>Bloc signature gauche</label>
                <input
                  type="text"
                  value={formData.signataire_gauche}
                  onChange={(e) => handleChange('signataire_gauche', e.target.value)}
                  placeholder="Ex : Pour In-Tel Services"
                />
              </div>
              <div className="form-group">
                <label>Bloc signature droite</label>
                <input
                  type="text"
                  value={formData.signataire_droite}
                  onChange={(e) => handleChange('signataire_droite', e.target.value)}
                  placeholder="Ex : Pour Hôpital de Bè"
                />
              </div>
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
            <button type="button" className="btn btn-success" onClick={() => exportPdf(toStoredRecord(formData), true)}>
              <Printer size={18} />
              Imprimer
            </button>
            <button type="submit" className="btn btn-primary">
              <FileCheck size={18} />
              {editingId ? 'Enregistrer' : 'Créer l\'attestation'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default AttestationServiceFait;
