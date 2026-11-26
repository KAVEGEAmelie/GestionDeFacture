import { useEffect, useMemo, useState } from 'react';

// Suggestions d'objets partagées entre les pages (stockées dans listes_choix).
// `extra` : objets déjà présents dans les documents chargés par la page.
const useObjetSuggestions = (extra = []) => {
  const [stored, setStored] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        if (window.electronAPI?.listes) {
          setStored((await window.electronAPI.listes.get('objet')) || []);
        }
      } catch { /* suggestions facultatives */ }
    })();
  }, []);

  const suggestions = useMemo(() => {
    const vus = new Set();
    const out = [];
    [...stored, ...extra].forEach((v) => {
      const s = String(v || '').trim();
      const cle = s.toLowerCase();
      if (!s || vus.has(cle)) return;
      vus.add(cle);
      out.push(s);
    });
    return out.sort((a, b) => a.localeCompare(b, 'fr'));
  }, [stored, extra]);

  const remember = async (valeur) => {
    const v = String(valeur || '').trim();
    if (!v) return;
    try {
      if (window.electronAPI?.listes) await window.electronAPI.listes.add('objet', v);
    } catch { /* suggestions facultatives */ }
    setStored((prev) => (prev.some((s) => s.toLowerCase() === v.toLowerCase()) ? prev : [...prev, v]));
  };

  return [suggestions, remember];
};

export default useObjetSuggestions;
