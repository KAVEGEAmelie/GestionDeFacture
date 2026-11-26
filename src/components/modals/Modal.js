import React, { useState, useEffect } from 'react';
import { X, Maximize2, Minimize2, Minus } from 'lucide-react';
import './Modal.css';

const Modal = ({ isOpen, onClose, title, children, size = 'medium' }) => {
  const [maximized, setMaximized] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  // Réinitialiser l'état à chaque ouverture
  useEffect(() => {
    if (isOpen) {
      setMaximized(false);
      setCollapsed(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const contentClass = [
    'modal-content',
    `modal-${size}`,
    maximized ? 'modal-maximized' : '',
    collapsed ? 'modal-collapsed' : ''
  ].filter(Boolean).join(' ');

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className={contentClass} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{title}</h2>
          <div className="modal-window-controls">
            <button
              type="button"
              className="modal-win-btn"
              onClick={() => setCollapsed((c) => !c)}
              title={collapsed ? 'Déplier' : 'Réduire'}
            >
              <Minus size={16} />
            </button>
            <button
              type="button"
              className="modal-win-btn"
              onClick={() => {
                setMaximized((m) => !m);
                setCollapsed(false);
              }}
              title={maximized ? 'Rétrécir' : 'Agrandir'}
            >
              {maximized ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
            <button type="button" className="modal-close" onClick={onClose} title="Fermer">
              <X size={20} />
            </button>
          </div>
        </div>
        <div className="modal-body">
          {children}
        </div>
      </div>
    </div>
  );
};

export default Modal;
