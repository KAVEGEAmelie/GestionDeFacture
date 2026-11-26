import React, { useState, useRef, useEffect } from 'react';
import { Lock, Eye, EyeOff, LogIn } from 'lucide-react';
import { getErrorMessage } from '../../utils/errors';
import './LockScreen.css';

const LockScreen = ({ onUnlock }) => {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isChecking, setIsChecking] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!password) {
      setError('Veuillez saisir le mot de passe.');
      return;
    }
    setError('');
    setIsChecking(true);
    try {
      await window.electronAPI.security.verify(password);
      onUnlock();
    } catch (err) {
      setError(getErrorMessage(err, 'Mot de passe incorrect.'));
      setPassword('');
      inputRef.current?.focus();
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <div className="lock-screen">
      <form className="lock-card" onSubmit={handleSubmit}>
        <div className="lock-icon">
          <Lock size={32} />
        </div>
        <h1 className="lock-title">Application verrouillée</h1>
        <p className="lock-subtitle">Saisissez votre mot de passe pour continuer</p>

        <div className="lock-field">
          <input
            ref={inputRef}
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Mot de passe"
            autoComplete="current-password"
          />
          <button
            type="button"
            className="lock-toggle"
            onClick={() => setShowPassword((v) => !v)}
            tabIndex={-1}
            aria-label={showPassword ? 'Masquer' : 'Afficher'}
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>

        {error && <p className="lock-error">{error}</p>}

        <button type="submit" className="lock-submit" disabled={isChecking}>
          <LogIn size={18} />
          {isChecking ? 'Vérification...' : 'Déverrouiller'}
        </button>
      </form>
    </div>
  );
};

export default LockScreen;
