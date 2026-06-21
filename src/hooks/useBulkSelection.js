import { useState, useMemo } from 'react';
import { getErrorMessage } from '../utils/errors';

// Gère la sélection multiple d'une liste d'éléments (cases à cocher + "tout sélectionner").
export default function useBulkSelection(items, getId = (i) => i.id) {
  const [selectedIds, setSelectedIds] = useState([]);

  const visibleIds = useMemo(() => (items || []).map(getId), [items, getId]);

  const toggle = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleAll = () => {
    setSelectedIds((prev) => {
      const allOn = visibleIds.length > 0 && visibleIds.every((id) => prev.includes(id));
      return allOn
        ? prev.filter((id) => !visibleIds.includes(id))
        : Array.from(new Set([...prev, ...visibleIds]));
    });
  };

  const clear = () => setSelectedIds([]);
  const isSelected = (id) => selectedIds.includes(id);
  const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));

  // Ne garder que les ids encore visibles (après filtrage/rechargement).
  const selectedVisible = selectedIds.filter((id) => visibleIds.includes(id));

  return {
    selectedIds: selectedVisible,
    count: selectedVisible.length,
    toggle,
    toggleAll,
    clear,
    isSelected,
    allSelected,
  };
}

// Supprime en lot une liste d'ids en appelant deleteFn pour chacun,
// puis affiche un résumé (succès / échecs) et recharge la liste.
export async function bulkDelete({ ids, deleteFn, confirm, toast, reload, clear, labels }) {
  if (!ids || ids.length === 0) return;
  const n = ids.length;
  const noun = n > 1 ? labels.plural : labels.singular;
  const ok = await confirm({
    title: labels.confirmTitle || 'Supprimer la sélection',
    message: `Êtes-vous sûr de vouloir supprimer ${n} ${noun} ? Cette action est irréversible.`,
    confirmText: 'Supprimer',
    danger: true,
  });
  if (!ok) return;

  let success = 0;
  let firstError = '';
  for (const id of ids) {
    try {
      await deleteFn(id);
      success += 1;
    } catch (error) {
      if (!firstError) firstError = getErrorMessage(error, 'Erreur lors de la suppression.');
    }
  }

  if (success > 0) {
    toast.success(`${success} ${success > 1 ? labels.plural : labels.singular} supprimé(e)(s).`);
  }
  const failed = n - success;
  if (failed > 0) {
    toast.error(`${failed} non supprimé(e)(s)${firstError ? ' : ' + firstError : '.'}`);
  }

  if (clear) clear();
  if (reload) reload();
}
