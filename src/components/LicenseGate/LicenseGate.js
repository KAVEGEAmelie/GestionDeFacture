import React, { useState, useEffect } from 'react';
import { ShieldAlert, KeyRound, Copy, CheckCircle } from 'lucide-react';
import './LicenseGate.css';

/**
 * Porte de licence : vérifie le statut au démarrage.
 * - Si l'application n'est pas bloquée (essai en cours, activée, ou
 *   blocage désactivé) : affiche l'application normalement.
 * - Si bloquée (essai expiré sans activation) : écran plein de blocage
 *   avec l'ID machine et la saisie du code d'activation.
 */
const LicenseGate = ({ children }) => {
  // null = vérification en cours
  const [status, setStatus] = useState(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [activating, setActivating] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const s = await window.electronAPI.license.getStatus();
        if (mounted) setStatus(s);
      } catch {
        // API indisponible : ne pas bloquer l'application
        if (mounted) setStatus({ blocked: false });
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const handleActivate = async (e) => {
    e.preventDefault();
    setError('');
    if (!code.trim()) {
      setError('Veuillez saisir le code d\'activation.');
      return;
    }
    setActivating(true);
    try {
      const res = await window.electronAPI.license.activate(code.trim());
      if (res.success) {
        const s = await window.electronAPI.license.getStatus();
        setStatus(s);
      } else {
        setError(res.message || 'Code invalide.');
      }
    } catch {
      setError('Erreur lors de l\'activation. Réessayez.');
    } finally {
      setActivating(false);
    }
  };

  const copyMachineId = async () => {
    try {
      await navigator.clipboard.writeText(status.machineId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // le clic-droit copier reste possible
    }
  };

  // Vérification en cours
  if (status === null) return null;

  // Application non bloquée : passage normal
  if (!status.blocked) return children;

  // ── Écran de blocage ──
  return (
    <div className="license-gate">
      <div className="license-gate__card">
        <div className="license-gate__icon">
          <ShieldAlert size={44} />
        </div>
        <h1>Période d'essai expirée</h1>
        <p className="license-gate__msg">
          {status.clockTampered
            ? 'Une anomalie de date a été détectée sur cet ordinateur.'
            : `Votre période d'essai de ${status.trialDays} jours est terminée.`}
          <br />
          Pour continuer à utiliser <strong>Gestion Facturation</strong>,
          veuillez activer votre licence.
        </p>

        <div className="license-gate__machine">
          <span className="license-gate__machine-label">ID de cet ordinateur</span>
          <div className="license-gate__machine-row">
            <code>{status.machineId}</code>
            <button type="button" onClick={copyMachineId} title="Copier l'ID">
              {copied ? <CheckCircle size={18} /> : <Copy size={18} />}
            </button>
          </div>
          <small>
            Communiquez cet identifiant à IN-TEL SERVICES pour recevoir votre
            code d'activation.
          </small>
        </div>

        <form onSubmit={handleActivate} className="license-gate__form">
          <label>
            <KeyRound size={16} />
            Code d'activation
          </label>
          <textarea
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Collez ici le code reçu…"
            rows={4}
            spellCheck={false}
          />
          {error && <div className="license-gate__error">{error}</div>}
          <button type="submit" disabled={activating}>
            {activating ? 'Vérification…' : 'Activer ma licence'}
          </button>
        </form>

        <p className="license-gate__contact">
          Contact : IN-TEL SERVICES — +228 22 51 66 86 / 90 11 66 86
        </p>
      </div>
    </div>
  );
};

export default LicenseGate;
