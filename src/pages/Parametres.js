import React, { useState, useEffect } from 'react';
import { Save, Download, Upload, Lock, ShieldCheck, ShieldOff } from 'lucide-react';
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

  // Sécurité (mot de passe de l'application)
  const [security, setSecurity] = useState({ enabled: false, hasPassword: false });
  const [pwdCurrent, setPwdCurrent] = useState('');
  const [pwdNew, setPwdNew] = useState('');
  const [pwdConfirm, setPwdConfirm] = useState('');
  const [isSavingPwd, setIsSavingPwd] = useState(false);

  useEffect(() => {
    loadParametres();
    loadSecurity();
  }, []);

  const loadParametres = async () => {
    const params = await window.electronAPI.parametres.getAll();
    setParametres(params);
  };

  const loadSecurity = async () => {
    try {
      const status = await window.electronAPI.security.getStatus();
      setSecurity(status);
    } catch (error) {
      // silencieux : la section sécurité reste à l'état par défaut
    }
  };

  const resetPwdFields = () => {
    setPwdCurrent('');
    setPwdNew('');
    setPwdConfirm('');
  };

  const handleSavePassword = async (e) => {
    e.preventDefault();
    if (pwdNew.length < 4) {
      toast.error('Le mot de passe doit contenir au moins 4 caractères.');
      return;
    }
    if (pwdNew !== pwdConfirm) {
      toast.error('Les deux mots de passe ne correspondent pas.');
      return;
    }
    setIsSavingPwd(true);
    try {
      await window.electronAPI.security.setPassword({
        currentPassword: pwdCurrent,
        newPassword: pwdNew,
      });
      toast.success(
        security.hasPassword
          ? 'Mot de passe mis à jour avec succès.'
          : 'Mot de passe activé avec succès.'
      );
      resetPwdFields();
      loadSecurity();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Erreur lors de l\'enregistrement du mot de passe.'));
    } finally {
      setIsSavingPwd(false);
    }
  };

  const handleDisablePassword = async () => {
    const ok = await confirm({
      title: 'Désactiver le mot de passe',
      message: 'L\'application ne sera plus protégée par mot de passe au démarrage. Continuer ?',
      confirmText: 'Désactiver',
      danger: true,
    });
    if (!ok) return;

    if (!pwdCurrent) {
      toast.error('Veuillez saisir le mot de passe actuel pour confirmer la désactivation.');
      return;
    }
    setIsSavingPwd(true);
    try {
      await window.electronAPI.security.disable(pwdCurrent);
      toast.success('Mot de passe désactivé.');
      resetPwdFields();
      loadSecurity();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Erreur lors de la désactivation du mot de passe.'));
    } finally {
      setIsSavingPwd(false);
    }
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
                <label>Slogan — ligne 1</label>
                <input
                  type="text"
                  value={parametres.entreprise_slogan1 || ''}
                  onChange={(e) => handleChange('entreprise_slogan1', e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>Slogan — ligne 2</label>
                <input
                  type="text"
                  value={parametres.entreprise_slogan2 || ''}
                  onChange={(e) => handleChange('entreprise_slogan2', e.target.value)}
                />
              </div>
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

            <div className="form-row">
              <div className="form-group">
                <label>Slogan pied de page — ligne 1</label>
                <input
                  type="text"
                  value={parametres.entreprise_slogan_pied1 || ''}
                  onChange={(e) => handleChange('entreprise_slogan_pied1', e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>Slogan pied de page — ligne 2</label>
                <input
                  type="text"
                  value={parametres.entreprise_slogan_pied2 || ''}
                  onChange={(e) => handleChange('entreprise_slogan_pied2', e.target.value)}
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

      <div className="content-card" style={{ marginTop: '1.5rem' }}>
        <div className="form" style={{ padding: '2rem' }}>
          <div className="form-section" style={{ marginBottom: 0 }}>
            <h3 className="form-section-title">
              <Lock size={18} style={{ verticalAlign: '-3px', marginRight: '0.4rem' }} />
              Sécurité — Mot de passe de l'application
            </h3>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                marginBottom: '1rem',
                fontSize: '0.9rem',
                fontWeight: 600,
                color: security.enabled ? '#16a34a' : '#6b7280',
              }}
            >
              {security.enabled ? <ShieldCheck size={18} /> : <ShieldOff size={18} />}
              {security.enabled
                ? 'Protection activée : un mot de passe est demandé au démarrage.'
                : 'Protection désactivée : aucun mot de passe n\'est demandé.'}
            </div>

            <p style={{ color: '#6b7280', fontSize: '0.875rem', marginBottom: '1rem' }}>
              {security.hasPassword
                ? 'Pour modifier ou désactiver le mot de passe, saisissez d\'abord le mot de passe actuel.'
                : 'Définissez un mot de passe pour protéger l\'accès à l\'application au démarrage (minimum 4 caractères).'}
            </p>

            <form onSubmit={handleSavePassword}>
              {security.hasPassword && (
                <div className="form-group">
                  <label>Mot de passe actuel</label>
                  <input
                    type="password"
                    value={pwdCurrent}
                    onChange={(e) => setPwdCurrent(e.target.value)}
                    autoComplete="current-password"
                    placeholder="••••••••"
                  />
                </div>
              )}

              <div className="form-row">
                <div className="form-group">
                  <label>{security.hasPassword ? 'Nouveau mot de passe' : 'Mot de passe'}</label>
                  <input
                    type="password"
                    value={pwdNew}
                    onChange={(e) => setPwdNew(e.target.value)}
                    autoComplete="new-password"
                    placeholder="••••••••"
                  />
                </div>

                <div className="form-group">
                  <label>Confirmer le mot de passe</label>
                  <input
                    type="password"
                    value={pwdConfirm}
                    onChange={(e) => setPwdConfirm(e.target.value)}
                    autoComplete="new-password"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
                <button type="submit" className="btn btn-primary" disabled={isSavingPwd}>
                  <ShieldCheck size={20} />
                  {isSavingPwd
                    ? 'Enregistrement...'
                    : security.hasPassword
                    ? 'Mettre à jour le mot de passe'
                    : 'Activer le mot de passe'}
                </button>

                {security.enabled && (
                  <button
                    type="button"
                    className="btn btn-danger"
                    onClick={handleDisablePassword}
                    disabled={isSavingPwd}
                  >
                    <ShieldOff size={20} />
                    Désactiver
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Parametres;
