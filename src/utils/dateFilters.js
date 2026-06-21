// Utilitaires de filtrage par date / période, partagés par toutes les pages.

// Convertit un objet Date en chaîne 'YYYY-MM-DD'
export const toISO = (d) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Retourne une plage de dates { from, to } pour un raccourci de période donné.
export const getPresetRange = (preset) => {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  switch (preset) {
    case 'aujourdhui':
      return { from: toISO(now), to: toISO(now) };
    case 'ce_mois':
      return { from: toISO(new Date(y, m, 1)), to: toISO(new Date(y, m + 1, 0)) };
    case 'mois_dernier':
      return { from: toISO(new Date(y, m - 1, 1)), to: toISO(new Date(y, m, 0)) };
    case 'cette_annee':
      return { from: toISO(new Date(y, 0, 1)), to: toISO(new Date(y, 11, 31)) };
    case 'annee_derniere':
      return { from: toISO(new Date(y - 1, 0, 1)), to: toISO(new Date(y - 1, 11, 31)) };
    case '7j': {
      const from = new Date(now);
      from.setDate(now.getDate() - 6);
      return { from: toISO(from), to: toISO(now) };
    }
    case '30j': {
      const from = new Date(now);
      from.setDate(now.getDate() - 29);
      return { from: toISO(from), to: toISO(now) };
    }
    default:
      return { from: '', to: '' };
  }
};

// Indique si une date (chaîne 'YYYY-MM-DD' ou datetime) est dans la plage [from, to].
export const inDateRange = (dateStr, from, to) => {
  if (!from && !to) return true;
  if (!dateStr) return false;
  const d = String(dateStr).slice(0, 10);
  if (from && d < from) return false;
  if (to && d > to) return false;
  return true;
};

// Indique si un nombre est dans la plage [min, max] (bornes vides ignorées).
export const inNumberRange = (value, min, max) => {
  const v = parseFloat(value) || 0;
  if (min !== '' && min !== null && min !== undefined && v < parseFloat(min)) return false;
  if (max !== '' && max !== null && max !== undefined && v > parseFloat(max)) return false;
  return true;
};
