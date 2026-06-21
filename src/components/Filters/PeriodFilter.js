import React from 'react';
import { Calendar } from 'lucide-react';
import { getPresetRange } from '../../utils/dateFilters';

/**
 * Sélecteur de période réutilisable : raccourcis (ce mois, mois dernier…)
 * + plage manuelle « Du / Au ».
 * Props : label, from, to, onChange(from, to)
 */
const PeriodFilter = ({ label = 'Période', from, to, onChange }) => {
  const handlePreset = (preset) => {
    if (!preset) return;
    const range = getPresetRange(preset);
    onChange(range.from, range.to);
  };

  return (
    <div className="filter-group filter-period">
      <label>
        <Calendar size={15} /> {label}
      </label>
      <div className="filter-period-controls">
        <select
          className="filter-select"
          value=""
          onChange={(e) => handlePreset(e.target.value)}
        >
          <option value="">Période rapide…</option>
          <option value="aujourdhui">Aujourd'hui</option>
          <option value="7j">7 derniers jours</option>
          <option value="30j">30 derniers jours</option>
          <option value="ce_mois">Ce mois-ci</option>
          <option value="mois_dernier">Mois dernier</option>
          <option value="cette_annee">Cette année</option>
          <option value="annee_derniere">Année dernière</option>
        </select>
        <div className="filter-date">
          <span>Du</span>
          <input
            type="date"
            value={from}
            onChange={(e) => onChange(e.target.value, to)}
          />
        </div>
        <div className="filter-date">
          <span>Au</span>
          <input
            type="date"
            value={to}
            onChange={(e) => onChange(from, e.target.value)}
          />
        </div>
      </div>
    </div>
  );
};

export default PeriodFilter;
