import React, { useState } from 'react';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import './FilterBar.css';

/**
 * Barre de recherche + panneau de filtres avancés repliable.
 * Props :
 *  - searchValue / onSearchChange : champ de recherche principal
 *  - searchPlaceholder : texte indicatif
 *  - children : contrôles de filtres avancés (affichés dans le panneau)
 *  - activeCount : nombre de filtres avancés actifs (badge)
 *  - onReset : callback de réinitialisation
 */
const FilterBar = ({
  searchValue,
  onSearchChange,
  searchPlaceholder = 'Rechercher...',
  children,
  activeCount = 0,
  onReset,
}) => {
  const [open, setOpen] = useState(false);

  return (
    <div className="filter-bar">
      <div className="filter-bar-main">
        <div className="search-bar filter-search">
          <Search size={20} />
          <input
            type="text"
            placeholder={searchPlaceholder}
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
          />
          {searchValue && (
            <button
              type="button"
              className="filter-clear-search"
              onClick={() => onSearchChange('')}
              title="Effacer la recherche"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {children && (
          <button
            type="button"
            className={`btn btn-filter ${open ? 'active' : ''}`}
            onClick={() => setOpen((o) => !o)}
          >
            <SlidersHorizontal size={18} />
            Filtres avancés
            {activeCount > 0 && <span className="filter-count">{activeCount}</span>}
          </button>
        )}

        {activeCount > 0 && onReset && (
          <button type="button" className="btn btn-reset" onClick={onReset}>
            <X size={16} />
            Réinitialiser
          </button>
        )}
      </div>

      {children && open && <div className="filter-panel">{children}</div>}
    </div>
  );
};

export default FilterBar;
