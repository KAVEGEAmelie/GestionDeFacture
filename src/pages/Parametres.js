import React, { useState, useEffect } from 'react';
import { Save, Download, Upload } from 'lucide-react';
import { useToast } from '../components/Toast/ToastProvider';
import { useConfirm } from '../components/ConfirmDialog/ConfirmProvider';
import { getErrorMessage } from '../utils/errors';
import './Clients.css';

const anneeCourante = new Date().getFullYear();

const Parametres = () => {
  const toast = useToast();
  const confirm = useConfirm();
  const [parametres, setParametres] = useState({});
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadParametres();
  }, []);

  const loadParametres = async () => {
    const params = await window.electronAPI.parametres.getAll();
    setParametres(params);
  };

  const handleChange = (key, value) => {
    setParametres({
      ...parametres,
      [key]: value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      // Sauvegarder tous les paramètres
      for (const [key, value] of Object.entries(parametres)) {
        await window.electronAPI.parametres.update(key, value);
      }
      
      toast.success('Paramètres enregistrés avec succès.');
    } catch (error) {
      toast.error(getErrorMessage(error, 'Erreur lors de l\'enregistrement des paramètres.'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleBackup = async () => {
    try {
      const result = await window.electronAPI.database.backup();
      if (result.canceled) return;
      if (result.success) {
        toast.success('Sauvegarde enregistrée avec succès.');
      }
    } catch (error) {
      toast.error(getErrorMessage(error, 'Erreur lors de la sauvegarde.'));
    }
  };

  const handleRestore = async () => {
    const ok = await confirm({
      title: 'Restaurer une sauvegarde',
      message: 'Attention : la restauration remplacera toutes les données actuelles par celles de la sauvegarde. Cette action est irréversible. Continuer ?',
      confirmText: 'Restaurer',
      danger: true,
    });
    if (!ok) return;
    try {
      const result = await window.electronAPI.database.restore();
      if (result.canceled) return;
      if (result.success) {
        toast.success('Base restaurée avec succès.');
        loadParametres();
      }
    } catch (error) {
      toast.error(getErrorMessage(error, 'Erreur lors de la restauration.'));
    }
  };

  return (
    <div className="page fade-in">
      <div className="page-header">
        <div>
          <h1>Paramètres</h1>
          <p className="subtitle">Configurez les informations de votre entreprise</p>
        </div>
      </div>

      <div className="content-card">
        <form onSubmit={handleSubmit} className="form" style={{ padding: '2rem' }}>
          <div className="form-section">
            <h3 className="form-section-title">Informations de l'entreprise</h3>
            
            <div className="form-group">
              <label>Nom de l'entreprise</label>
              <input
                type="text"
                value={parametres.entreprise_nom || ''}
                onChange={(e) => handleChange('entreprise_nom', e.target.value)}
                required
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>RCCM</label>
                <input
                  type="text"
                  value={parametres.entreprise_rccm || ''}
                  onChange={(e) => handleChange('entreprise_rccm', e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>NIF</label>
                <input
                  type="text"
                  value={parametres.entreprise_nif || ''}
                  onChange={(e) => handleChange('entreprise_nif', e.target.value)}
                />
              </div>
            </div>

            <div className="form-group">
              <label>Adresse</label>
              <input
                type="text"
                value={parametres.entreprise_adresse || ''}
                onChange={(e) => handleChange('entreprise_adresse', e.target.value)}
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Téléphone</label>
                <input
                  type="text"
                  value={parametres.entreprise_tel || ''}
                  onChange={(e) => handleChange('entreprise_tel', e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>Cellulaire</label>
                <input
                  type="text"
                  value={parametres.entreprise_cel || ''}
                  onChange={(e) => handleChange('entreprise_cel', e.target.value)}
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Email</label>
                <input
                  type="email"
                  value={parametres.entreprise_email || ''}
                  onChange={(e) => handleChange('entreprise_email', e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>UTB</label>
                <input
                  type="text"
                  value={parametres.entreprise_utb || ''}
                  onChange={(e) => handleChange('entreprise_utb', e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="form-section">
            <h3 className="form-section-title">Paramètres de facturation</h3>
            
            <div className="form-group">
              <label>Taux de TVA (%)</label>
              <input
                type="number"
                value={parametres.tva_taux || '18'}
                onChange={(e) => handleChange('tva_taux', e.target.value)}
                min="0"
                max="100"
                step="0.01"
                required
              />
              <small style={{ color: '#6b7280', fontSize: '0.875rem', marginTop: '0.25rem' }}>
                Taux de TVA appliqué par défaut (actuellement: 18%)
              </small>
            </div>
          </div>

          <div className="form-section">
            <h3 className="form-section-title">Numérotation automatique</h3>
            
            <div className="form-row">
              <div className="form-group">
                <label>Compteur Proforma</label>
                <input
                  type="number"
                  value={parametres.proforma_compteur || '5'}
                  onChange={(e) => handleChange('proforma_compteur', e.target.value)}
                  min="0"
                  required
                />
                <small style={{ color: '#6b7280', fontSize: '0.875rem', marginTop: '0.25rem' }}>
                  Prochain numéro: {anneeCourante}/{String(parseInt(parametres.proforma_compteur || 5) + 1).padStart(5, '0')}-ITS
                </small>
              </div>

              <div className="form-group">
                <label>Compteur Facture</label>
                <input
                  type="number"
                  value={parametres.facture_compteur || '17'}
                  onChange={(e) => handleChange('facture_compteur', e.target.value)}
                  min="0"
                  required
                />
                <small style={{ color: '#6b7280', fontSize: '0.875rem', marginTop: '0.25rem' }}>
                  Prochain numéro: {anneeCourante}/{String(parseInt(parametres.facture_compteur || 17) + 1).padStart(5, '0')}-ITS
                </small>
              </div>
            </div>

            <div className="form-group">
              <label>Compteur Bordereau</label>
              <input
                type="number"
                value={parametres.bordereau_compteur || '4'}
                onChange={(e) => handleChange('bordereau_compteur', e.target.value)}
                min="0"
                required
              />
              <small style={{ color: '#6b7280', fontSize: '0.875rem', marginTop: '0.25rem' }}>
                Prochain numéro: {anneeCourante}/{String(parseInt(parametres.bordereau_compteur || 4) + 1).padStart(5, '0')}-ITS
              </small>
            </div>
          </div>

          <div className="form-section">
            <h3 className="form-section-title">Sauvegarde des données</h3>
            <p style={{ color: '#6b7280', fontSize: '0.875rem', marginBottom: '1rem' }}>
              Enregistrez régulièrement une copie de votre base pour ne rien perdre. La restauration remplacera toutes les données actuelles.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <button type="button" className="btn btn-secondary" onClick={handleBackup}>
                <Download size={20} />
                Sauvegarder la base
              </button>
              <button type="button" className="btn btn-secondary" onClick={handleRestore}>
                <Upload size={20} />
                Restaurer une sauvegarde
              </button>
            </div>
          </div>

          <div className="form-actions">
            <button 
              type="submit" 
              className="btn btn-primary"
              disabled={isSaving}
            >
              <Save size={20} />
              {isSaving ? 'Enregistrement...' : 'Enregistrer les paramètres'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Parametres;
