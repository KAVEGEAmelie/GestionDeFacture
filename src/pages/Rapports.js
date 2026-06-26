import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Plus,
  Trash2,
  Printer,
  Download,
  Edit2,
  Eye,
  Stamp,
  ClipboardList,
  GripVertical,
  ChevronUp,
  ChevronDown,
  Lightbulb,
  List,
  Type,
  FileText,
  Upload
} from 'lucide-react';
import mammoth from 'mammoth';
import Modal from '../components/modals/Modal';
import FilterBar from '../components/Filters/FilterBar';
import PeriodFilter from '../components/Filters/PeriodFilter';
import { inDateRange } from '../utils/dateFilters';
import { generateRapportPDF } from '../utils/pdfGenerator';
import { useToast } from '../components/Toast/ToastProvider';
import { useConfirm } from '../components/ConfirmDialog/ConfirmProvider';
import { getErrorMessage } from '../utils/errors';
import { matchesWordPrefix } from '../utils/search';
import useBulkSelection, { bulkDelete } from '../hooks/useBulkSelection';
import SearchableSelect from '../components/Inputs/SearchableSelect';
import './Clients.css';
import './Proformas.css';
import './RapportsModal.css';

const emptySection = () => ({ titre: '', contenu: '' });

const Rapports = () => {
  const toast = useToast();
  const confirm = useConfirm();

  const [rapports, setRapports] = useState([]);
  const [parametres, setParametres] = useState({});
  const [clients, setClients] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'date', direction: 'desc' });
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRapport, setEditingRapport] = useState(null);

  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    titre: '',
    client_id: '',
    client_nom: '',
    lieu: '',
    objet: '',
    avec_cachet: false,
    sections: [emptySection()]
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [rapportsData, parametresData, clientsData] = await Promise.all([
      window.electronAPI.rapports.getAll(),
      window.electronAPI.parametres.getAll(),
      window.electronAPI.clients.getAll()
    ]);
    setRapports(rapportsData);
    setParametres(parametresData);
    setClients(clientsData);
  };

  const sortedClients = useMemo(() => {
    return [...clients].sort((a, b) =>
      String(a.nom || '').localeCompare(String(b.nom || ''), 'fr', { sensitivity: 'base' })
    );
  }, [clients]);

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return '-';
    return d.toLocaleDateString('fr-FR');
  };

  // ---- Sections dynamiques ----
  const addSection = () => {
    setFormData({ ...formData, sections: [...formData.sections, emptySection()] });
  };

  const removeSection = (index) => {
    const sections = formData.sections.filter((_, i) => i !== index);
    setFormData({ ...formData, sections: sections.length ? sections : [emptySection()] });
  };

  const updateSection = (index, field, value) => {
    const sections = [...formData.sections];
    sections[index] = { ...sections[index], [field]: value };
    setFormData({ ...formData, sections });
  };

  const moveSection = (index, direction) => {
    const target = index + direction;
    if (target < 0 || target >= formData.sections.length) return;
    const sections = [...formData.sections];
    [sections[index], sections[target]] = [sections[target], sections[index]];
    setFormData({ ...formData, sections });
  };

  // Références vers les textareas pour insérer le formatage au curseur
  const textareaRefs = useRef([]);

  // Applique un formatage (puce ou sous-titre) sur la ligne courante du champ
  const applyFormat = (index, type) => {
    const ta = textareaRefs.current[index];
    const content = formData.sections[index]?.contenu || '';
    const caret = ta ? ta.selectionStart : content.length;
    const caretEnd = ta ? ta.selectionEnd : content.length;

    const lineStart = content.lastIndexOf('\n', caret - 1) + 1;
    const nextBreak = content.indexOf('\n', caretEnd);
    const lineEnd = nextBreak === -1 ? content.length : nextBreak;
    const line = content.slice(lineStart, lineEnd);

    let newContent = content;
    let newCaret = caret;

    if (type === 'bullet') {
      // Bascule la puce en début de ligne
      if (/^\s*(•|-)\s+/.test(line)) {
        const stripped = line.replace(/^(\s*)(•|-)\s+/, '$1');
        newContent = content.slice(0, lineStart) + stripped + content.slice(lineEnd);
        newCaret = Math.max(lineStart, caret - 2);
      } else {
        newContent = content.slice(0, lineStart) + '• ' + line + content.slice(lineEnd);
        newCaret = caret + 2;
      }
    } else if (type === 'subtitle') {
      // S'assure que la ligne se termine par « : »
      const trimmedRight = line.replace(/\s+$/, '');
      if (trimmedRight.endsWith(':')) {
        const stripped = trimmedRight.replace(/\s*:$/, '');
        newContent = content.slice(0, lineStart) + stripped + content.slice(lineEnd);
        newCaret = lineStart + stripped.length;
      } else {
        newContent = content.slice(0, lineStart) + trimmedRight + ' :' + content.slice(lineEnd);
        newCaret = lineStart + trimmedRight.length + 2;
      }
    }

    updateSection(index, 'contenu', newContent);
    requestAnimationFrame(() => {
      if (ta) {
        ta.focus();
        ta.setSelectionRange(newCaret, newCaret);
      }
    });
  };

  // ---- Import d'un document Word (.docx) ----
  const fileInputRef = useRef(null);
  const [importing, setImporting] = useState(false);

  // Instantané du formulaire à l'ouverture, pour détecter les modifications non enregistrées
  const initialFormRef = useRef(null);

  // Décode les entités HTML (&amp;, &eacute;, etc.) en texte normal
  const decodeEntities = (str) => {
    if (!str) return '';
    const el = document.createElement('textarea');
    el.innerHTML = str;
    return el.value;
  };

  // Transforme le HTML produit par mammoth en sections {titre, contenu}
  const parseHtmlToSections = (html) => {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const nodes = Array.from(doc.body.children);

    const sections = [];
    let current = null;
    let intro = []; // paragraphes avant le 1er titre

    const pushLine = (line) => {
      const clean = (line || '').replace(/\s+/g, ' ').trim();
      if (!clean) return;
      if (current) {
        current.contenu.push(clean);
      } else {
        intro.push(clean);
      }
    };

    nodes.forEach((node) => {
      const tag = node.tagName.toLowerCase();
      const text = decodeEntities(node.textContent || '').replace(/\s+/g, ' ').trim();

      if (/^h[1-6]$/.test(tag)) {
        // Nouveau titre de section
        if (current) sections.push(current);
        current = { titre: text.replace(/\s*:\s*$/, ''), contenu: [] };
      } else if (tag === 'ul' || tag === 'ol') {
        // Listes → puces
        Array.from(node.querySelectorAll('li')).forEach((li) => {
          const liText = decodeEntities(li.textContent || '').replace(/\s+/g, ' ').trim();
          if (liText) pushLine(`• ${liText}`);
        });
      } else if (tag === 'p' || tag === 'div') {
        // Détecte une fin par « : » → sous-titre (laissé tel quel, géré au rendu PDF)
        if (text) pushLine(text);
      } else if (text) {
        pushLine(text);
      }
    });

    if (current) sections.push(current);

    // Convertit les tableaux de lignes en chaînes
    const result = sections.map((s) => ({
      titre: s.titre,
      contenu: s.contenu.join('\n')
    }));

    // Si du texte existait avant le 1er titre, on crée une section d'intro
    if (intro.length) {
      result.unshift({ titre: 'Introduction', contenu: intro.join('\n') });
    }

    return result;
  };

  const handleImportClick = () => {
    if (fileInputRef.current) fileInputRef.current.click();
  };

  const handleWordFile = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = ''; // permet de réimporter le même fichier
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.docx')) {
      toast.error('Format non supporté. Veuillez choisir un fichier Word « .docx ».');
      return;
    }

    setImporting(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const { value: html } = await mammoth.convertToHtml({ arrayBuffer });
      const sections = parseHtmlToSections(html);
      const hasTables = /<table[\s>]/i.test(html);

      if (!sections.length) {
        toast.error('Aucun contenu exploitable n’a été trouvé dans ce document.');
        return;
      }

      const hasHeadings = sections.some((s) => s.titre && s.titre !== 'Introduction');
      const titreAuto = file.name.replace(/\.docx$/i, '').replace(/[_-]+/g, ' ').trim();

      setFormData((prev) => ({
        ...prev,
        titre: prev.titre || titreAuto,
        sections
      }));

      if (hasHeadings) {
        toast.success(`${sections.length} section(s) importée(s) depuis « ${file.name} ».`);
      } else {
        toast.success(
          `Contenu importé depuis « ${file.name} ». Aucun titre détecté : découpez les sections manuellement.`
        );
      }

      if (hasTables) {
        toast.warning(
          'Ce document contient un ou plusieurs tableaux qui n’ont pas été importés. Ajoutez ces données manuellement.'
        );
      }
    } catch (err) {
      toast.error('Impossible de lire ce document Word. Vérifiez qu’il s’agit bien d’un « .docx » valide.');
    } finally {
      setImporting(false);
    }
  };


  const openModal = () => {
    setEditingRapport(null);
    const fresh = {
      date: new Date().toISOString().split('T')[0],
      titre: '',
      client_id: '',
      client_nom: '',
      lieu: '',
      objet: '',
      avec_cachet: false,
      sections: [emptySection()]
    };
    setFormData(fresh);
    initialFormRef.current = JSON.stringify(fresh);
    setIsModalOpen(true);
  };

  const closeModal = async () => {
    // Avertit si des modifications non enregistrées existent
    const current = JSON.stringify(formData);
    if (initialFormRef.current !== null && current !== initialFormRef.current) {
      const quitter = await confirm({
        title: 'Quitter sans enregistrer ?',
        message:
          'Des modifications non enregistrées seront perdues. Voulez-vous vraiment fermer ce formulaire ?',
        confirmText: 'Quitter sans enregistrer',
        danger: true
      });
      if (!quitter) return;
    }
    initialFormRef.current = null;
    setIsModalOpen(false);
    setEditingRapport(null);
  };

  const handleEdit = async (rapport) => {
    const full = await window.electronAPI.rapports.getById(rapport.id);
    setEditingRapport(full);
    const loaded = {
      date: full.date ? full.date.split('T')[0] : new Date().toISOString().split('T')[0],
      titre: full.titre || '',
      client_id: full.client_id ? String(full.client_id) : '',
      client_nom: full.client_nom || '',
      lieu: full.lieu || '',
      objet: full.objet || '',
      avec_cachet: full.avec_cachet === 1,
      sections: Array.isArray(full.sections) && full.sections.length ? full.sections : [emptySection()]
    };
    setFormData(loaded);
    initialFormRef.current = JSON.stringify(loaded);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.titre.trim()) {
      toast.error('Le titre du rapport est obligatoire.');
      return;
    }

    const sections = formData.sections
      .map((s) => ({ titre: (s.titre || '').trim(), contenu: (s.contenu || '').trim() }))
      .filter((s) => s.titre || s.contenu);

    const data = {
      date: formData.date,
      titre: formData.titre.trim(),
      client_id: formData.client_id || null,
      client_nom: (clients.find((c) => String(c.id) === String(formData.client_id))?.nom || '').trim(),
      lieu: formData.lieu.trim(),
      objet: formData.objet.trim(),
      avec_cachet: formData.avec_cachet,
      sections
    };

    try {
      if (editingRapport) {
        await window.electronAPI.rapports.update(editingRapport.id, data);
        toast.success('Rapport mis à jour avec succès.');
      } else {
        await window.electronAPI.rapports.create(data);
        toast.success('Rapport créé avec succès.');
      }
      await loadData();
      initialFormRef.current = null;
      closeModal();
    } catch (error) {
      toast.error(getErrorMessage(error, "Erreur lors de l'enregistrement du rapport."));
    }
  };

  const handleDelete = async (id) => {
    const ok = await confirm({
      title: 'Supprimer le rapport',
      message: 'Voulez-vous vraiment supprimer ce rapport ? Cette action est irréversible.',
      confirmText: 'Supprimer',
      danger: true
    });
    if (!ok) return;
    try {
      await window.electronAPI.rapports.delete(id);
      await loadData();
      toast.success('Rapport supprimé.');
    } catch (error) {
      toast.error(getErrorMessage(error, 'Erreur lors de la suppression du rapport.'));
    }
  };

  const handlePrint = async (rapport) => {
    const full = await window.electronAPI.rapports.getById(rapport.id);
    const doc = await generateRapportPDF(full, parametres);
    doc.autoPrint();
    window.open(doc.output('bloburl'), '_blank');
  };

  const handleView = async (rapport) => {
    const full = await window.electronAPI.rapports.getById(rapport.id);
    const doc = await generateRapportPDF(full, parametres);
    window.open(doc.output('bloburl'), '_blank');
  };

  const handleExport = async (rapport) => {
    const full = await window.electronAPI.rapports.getById(rapport.id);
    const doc = await generateRapportPDF(full, parametres);
    doc.save(`Rapport_${(full.numero || '').replace(/\//g, '-')}.pdf`);
  };

  // ---- Filtres ----
  const filteredRapports = rapports.filter((r) => {
    const term = searchTerm.toLowerCase();
    const matchSearch =
      term === '' ||
      matchesWordPrefix(r.numero, term) ||
      matchesWordPrefix(r.titre, term) ||
      matchesWordPrefix(r.client_nom, term) ||
      matchesWordPrefix(r.objet, term);
    const matchDate = inDateRange(r.date, dateFrom, dateTo);
    return matchSearch && matchDate;
  });

  const sortedFilteredRapports = useMemo(() => {
    const items = [...filteredRapports];
    const { key, direction } = sortConfig;
    const factor = direction === 'asc' ? 1 : -1;
    return items.sort((a, b) => {
      if (key === 'date') {
        return ((new Date(a.date).getTime() || 0) - (new Date(b.date).getTime() || 0)) * factor;
      }
      return String(a[key] || '').localeCompare(String(b[key] || ''), 'fr', { sensitivity: 'base' }) * factor;
    });
  }, [filteredRapports, sortConfig]);

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

  const selection = useBulkSelection(sortedFilteredRapports);
  const handleBulkDelete = () =>
    bulkDelete({
      ids: selection.selectedIds,
      deleteFn: (id) => window.electronAPI.rapports.delete(id),
      confirm,
      toast,
      reload: loadData,
      clear: selection.clear,
      labels: { confirmTitle: 'Supprimer les rapports', singular: 'rapport', plural: 'rapports' }
    });

  return (
    <div className="page fade-in">
      <div className="page-header">
        <div>
          <h1>Rapports techniques</h1>
          <p className="subtitle">Rédigez, imprimez et archivez vos rapports d'intervention</p>
        </div>
        <div className="header-actions">
          {selection.count > 0 && (
            <button className="btn btn-danger bulk-delete-btn" onClick={handleBulkDelete}>
              <Trash2 size={18} />
              Supprimer la sélection ({selection.count})
            </button>
          )}
          <button className="btn btn-primary" onClick={openModal}>
            <Plus size={18} />
            Nouveau rapport
          </button>
        </div>
      </div>

      <div className="content-card">
        <FilterBar
          searchValue={searchTerm}
          onSearchChange={setSearchTerm}
          searchPlaceholder="Rechercher par numéro, titre, client ou objet..."
          activeCount={activeCount}
          onReset={resetFilters}
        >
          <PeriodFilter
            label="Date du rapport"
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
                <th className="select-col">
                  <input
                    type="checkbox"
                    checked={selection.allSelected}
                    onChange={selection.toggleAll}
                    title="Tout sélectionner"
                  />
                </th>
                <th onClick={() => toggleSort('numero')} style={{ cursor: 'pointer' }}>N°{sortMark('numero')}</th>
                <th onClick={() => toggleSort('date')} style={{ cursor: 'pointer' }}>Date{sortMark('date')}</th>
                <th onClick={() => toggleSort('titre')} style={{ cursor: 'pointer' }}>Titre{sortMark('titre')}</th>
                <th onClick={() => toggleSort('client_nom')} style={{ cursor: 'pointer' }}>Client{sortMark('client_nom')}</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedFilteredRapports.length === 0 ? (
                <tr>
                  <td colSpan="6" className="empty-state">
                    {searchTerm
                      ? 'Aucun rapport ne correspond à votre recherche'
                      : 'Aucun rapport enregistré pour le moment'}
                  </td>
                </tr>
              ) : (
                sortedFilteredRapports.map((rapport) => (
                  <tr key={rapport.id}>
                    <td className="select-col">
                      <input
                        type="checkbox"
                        checked={selection.isSelected(rapport.id)}
                        onChange={() => selection.toggle(rapport.id)}
                        title="Sélectionner"
                      />
                    </td>
                    <td className="font-semibold">{rapport.numero}</td>
                    <td>{formatDate(rapport.date)}</td>
                    <td>{rapport.titre}</td>
                    <td>{rapport.client_nom || '-'}</td>
                    <td style={{ textAlign: 'right' }}>
                      <div className="action-buttons">
                        <button
                          className="btn-icon btn-icon-primary"
                          onClick={() => handleView(rapport)}
                          title="Aperçu"
                          aria-label="Aperçu du rapport"
                        >
                          <Eye size={15} />
                        </button>
                        <button
                          className="btn-icon btn-icon-edit"
                          onClick={() => handleEdit(rapport)}
                          title="Modifier"
                          aria-label="Modifier le rapport"
                        >
                          <Edit2 size={15} />
                        </button>
                        <button
                          className="btn-icon btn-icon-success"
                          onClick={() => handlePrint(rapport)}
                          title="Imprimer"
                          aria-label="Imprimer le rapport"
                        >
                          <Printer size={15} />
                        </button>
                        <button
                          className="btn-icon btn-icon-info"
                          onClick={() => handleExport(rapport)}
                          title="Exporter en PDF"
                          aria-label="Exporter en PDF"
                        >
                          <Download size={15} />
                        </button>
                        <button
                          className="btn-icon btn-icon-danger"
                          onClick={() => handleDelete(rapport.id)}
                          title="Supprimer"
                          aria-label="Supprimer le rapport"
                        >
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

      {/* ============================================================
          MODAL — Création / Édition d'un rapport
          Structure : 3 sections sémantiques (Infos / Options / Contenu)
          ============================================================ */}
      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        title={editingRapport ? `Modifier le rapport ${editingRapport.numero}` : 'Nouveau rapport technique'}
        size="xlarge"
      >
        <form onSubmit={handleSubmit} className="form rapports-form">

          {/* ─── SECTION 1 : INFORMATIONS GÉNÉRALES ─── */}
          <section className="form-section">
            <span className="form-section__eyebrow">Informations générales</span>

            {/* Champ titre en mode HERO */}
            <div className="form-group form-group--hero">
              <label>
                Titre du rapport
                <span className="form-required" aria-hidden="true">*</span>
              </label>
              <input
                type="text"
                value={formData.titre}
                onChange={(e) => setFormData({ ...formData, titre: e.target.value })}
                placeholder="Rapport technique d'intervention et de diagnostic du réseau informatique"
                required
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>
                  Date
                  <span className="form-required" aria-hidden="true">*</span>
                </label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Lieu</label>
                <input
                  type="text"
                  value={formData.lieu}
                  onChange={(e) => setFormData({ ...formData, lieu: e.target.value })}
                  placeholder="Ex : Vogan"
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Client / Destinataire</label>
                <SearchableSelect
                  options={sortedClients.map((client) => ({ value: String(client.id), label: client.nom }))}
                  value={formData.client_id}
                  onChange={(clientId) => setFormData((prev) => ({ ...prev, client_id: clientId }))}
                  placeholder="Rechercher un client"
                  noOptionsText="Aucun client correspondant"
                />
              </div>
              <div className="form-group">
                <label>Objet</label>
                <input
                  type="text"
                  value={formData.objet}
                  onChange={(e) => setFormData({ ...formData, objet: e.target.value })}
                  placeholder="Ex : Diagnostic du réseau informatique"
                />
              </div>
            </div>
          </section>

          {/* ─── SECTION 2 : OPTIONS ─── */}
          <section className="form-section">
            <span className="form-section__eyebrow">Options</span>

            <div className="options-grid">
              <label
                className={`option-card ${formData.avec_cachet ? 'is-active' : ''} ${
                  !parametres.signature_image ? 'is-disabled' : ''
                }`}
              >
                <span className="option-card__icon">
                  <Stamp size={22} />
                </span>
                <span className="option-card__body">
                  <span className="option-card__title">Cachet &amp; signature</span>
                  <span className={`option-card__desc ${!parametres.signature_image ? 'is-warning' : ''}`}>
                    {parametres.signature_image
                      ? 'Appliquer le cachet et la signature sur ce rapport.'
                      : "Importez d'abord une image dans Paramètres pour activer cette option."}
                  </span>
                </span>
                <span className="switch">
                  <input
                    type="checkbox"
                    checked={formData.avec_cachet}
                    disabled={!parametres.signature_image}
                    onChange={(e) => setFormData({ ...formData, avec_cachet: e.target.checked })}
                  />
                  <span className="switch__track">
                    <span className="switch__thumb" />
                  </span>
                </span>
              </label>
            </div>
          </section>

          {/* ─── SECTION 3 : CONTENU DU RAPPORT ─── */}
          <section className="form-section">
            <div className="form-section__header">
              <span className="form-section__eyebrow">
                Contenu du rapport
                {formData.sections.length > 0 && (
                  <span className="form-section__count">{formData.sections.length}</span>
                )}
              </span>
              <div className="form-section__actions">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".docx"
                  style={{ display: 'none' }}
                  onChange={handleWordFile}
                />
                <button
                  type="button"
                  className="btn btn-import btn-sm"
                  onClick={handleImportClick}
                  disabled={importing}
                  title="Importer le contenu depuis un fichier Word (.docx)"
                >
                  <Upload size={16} />
                  {importing ? 'Import en cours…' : 'Importer un Word'}
                </button>
                <button type="button" className="btn btn-secondary btn-sm" onClick={addSection}>
                  <Plus size={16} />
                  Ajouter une section
                </button>
              </div>
            </div>

            <div className="form-tip">
              <Lightbulb size={16} className="form-tip__icon" />
              <span>
                <strong>Astuce de mise en forme :</strong> commencez une ligne par
                <strong> « - »</strong> ou <strong>« • »</strong> pour créer une puce. Une ligne se terminant
                par <strong>« : »</strong> sera mise en évidence comme sous-titre. Vous pouvez aussi
                <strong> importer un document Word</strong> pour pré-remplir les sections automatiquement.
              </span>
            </div>

            {formData.sections.length === 0 && (
              <div className="sections-empty">
                <FileText size={26} />
                <p>Aucune section pour l'instant.</p>
                <button type="button" className="btn btn-secondary btn-sm" onClick={addSection}>
                  <Plus size={16} />
                  Créer la première section
                </button>
              </div>
            )}

            {formData.sections.map((section, index) => (
              <div key={index} className="rapport-section">
                <div className="rapport-section__head">
                  <span className="rapport-section__num" title={`Section ${index + 1}`}>
                    <GripVertical size={13} />
                    {index + 1}
                  </span>
                  <input
                    type="text"
                    className="rapport-section__title"
                    value={section.titre}
                    onChange={(e) => updateSection(index, 'titre', e.target.value)}
                    placeholder="Titre de la section (ex : Constats)"
                  />
                  <div className="rapport-section__actions">
                    <button
                      type="button"
                      className="btn-icon"
                      onClick={() => moveSection(index, -1)}
                      disabled={index === 0}
                      title="Monter"
                      aria-label="Déplacer la section vers le haut"
                    >
                      <ChevronUp size={16} />
                    </button>
                    <button
                      type="button"
                      className="btn-icon"
                      onClick={() => moveSection(index, 1)}
                      disabled={index === formData.sections.length - 1}
                      title="Descendre"
                      aria-label="Déplacer la section vers le bas"
                    >
                      <ChevronDown size={16} />
                    </button>
                    <button
                      type="button"
                      className="btn-icon btn-icon-danger"
                      onClick={() => removeSection(index)}
                      title="Supprimer la section"
                      aria-label="Supprimer cette section"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                {/* Barre d'outils de mise en forme */}
                <div className="rapport-section__toolbar">
                  <button
                    type="button"
                    className="format-btn"
                    onClick={() => applyFormat(index, 'bullet')}
                    title="Transformer la ligne en puce"
                  >
                    <List size={14} />
                    Puce
                  </button>
                  <button
                    type="button"
                    className="format-btn"
                    onClick={() => applyFormat(index, 'subtitle')}
                    title="Transformer la ligne en sous-titre"
                  >
                    <Type size={14} />
                    Sous-titre
                  </button>
                </div>

                <textarea
                  ref={(el) => (textareaRefs.current[index] = el)}
                  className="rapport-section__body"
                  value={section.contenu}
                  onChange={(e) => updateSection(index, 'contenu', e.target.value)}
                  placeholder={'Décrivez cette section…\n\nExemple :\nÉtat des lieux :\n• Premier constat\n• Second constat'}
                  rows={6}
                />
              </div>
            ))}
          </section>

          {/* ─── FOOTER ANCRÉ ─── */}
          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={closeModal}>
              Annuler
            </button>
            <button type="submit" className="btn btn-primary">
              <ClipboardList size={18} />
              {editingRapport ? 'Enregistrer les modifications' : 'Créer le rapport'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Rapports;