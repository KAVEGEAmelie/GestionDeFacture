const normalizeText = (value) =>
  String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

export const matchesWordPrefix = (value, term) => {
  const normalizedTerm = normalizeText(term).trim();
  if (!normalizedTerm) return true;

  const text = normalizeText(value);
  if (!text) return false;

  if (text.startsWith(normalizedTerm)) return true;

  const words = text.split(/[^a-z0-9]+/i).filter(Boolean);
  return words.some((word) => word.startsWith(normalizedTerm));
};
