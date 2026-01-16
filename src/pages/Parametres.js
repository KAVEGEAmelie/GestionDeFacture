import React, { useState, useEffect } from 'react';
import { Save } from 'lucide-react';
import './Clients.css';

const Parametres = () => {
  const [parametres, setParametres] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');

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
    setMessage('');

    try {
      // Sauvegarder tous les paramètres
      for (const [key, value] of Object.entries(parametres)) {
        await window.electronAPI.parametres.update(key, value);
      }
      
      setMessage('Paramètres enregistrés avec succès');
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      setMessage('Erreur lors de l\'enregistrement');
    } finally {
      setIsSaving(false);
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
                  Prochain numéro: 2025/{String(parseInt(parametres.proforma_compteur || 5) + 1).padStart(5, '0')}-ITS
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
                  Prochain numéro: 2025/{String(parseInt(parametres.facture_compteur || 17) + 1).padStart(5, '0')}-ITS
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
                Prochain numéro: 2025/{String(parseInt(parametres.bordereau_compteur || 4) + 1).padStart(5, '0')}-ITS
              </small>
            </div>
          </div>

          {message && (
            <div className={`alert ${message.includes('succès') ? 'alert-success' : 'alert-error'}`}>
              {message}
            </div>
          )}

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
