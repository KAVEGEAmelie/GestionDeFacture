import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import './ConfirmDialog.css';

const ConfirmContext = createContext(null);

export const useConfirm = () => {
  const ctx = useContext(ConfirmContext);
  if (!ctx) {
    throw new Error('useConfirm doit être utilisé à l\'intérieur d\'un ConfirmProvider');
  }
  return ctx;
};

const defaultState = {
  title: 'Confirmation',
  message: 'Êtes-vous sûr ?',
  confirmText: 'Confirmer',
  cancelText: 'Annuler',
  danger: false,
};

export const ConfirmProvider = ({ children }) => {
  const [state, setState] = useState(null);
  const resolver = useRef(null);

  const confirm = useCallback((options) => {
    const opts = typeof options === 'string' ? { message: options } : (options || {});
    setState({ ...defaultState, ...opts });
    return new Promise((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const close = useCallback((result) => {
    setState(null);
    if (resolver.current) {
      resolver.current(result);
      resolver.current = null;
    }
  }, []);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {state && (
        <div className="confirm-overlay" onClick={() => close(false)}>
          <div
            className="confirm-dialog"
            onClick={(e) => e.stopPropagation()}
            role="alertdialog"
            aria-modal="true"
          >
            <div className={`confirm-icon ${state.danger ? 'danger' : ''}`}>
              <AlertTriangle size={28} />
            </div>
            <h3 className="confirm-title">{state.title}</h3>
            <p className="confirm-message">{state.message}</p>
            <div className="confirm-actions">
              <button className="confirm-btn confirm-cancel" onClick={() => close(false)}>
                {state.cancelText}
              </button>
              <button
                className={`confirm-btn ${state.danger ? 'confirm-danger' : 'confirm-primary'}`}
                onClick={() => close(true)}
                autoFocus
              >
                {state.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
};
