// Extrait un message d'erreur lisible à partir d'une erreur, y compris les
// erreurs remontées par les handlers IPC d'Electron (qui préfixent le message).
export const getErrorMessage = (error, fallback = 'Une erreur est survenue.') => {
  if (!error) return fallback;
  const raw = error.message || String(error);
  const idx = raw.lastIndexOf('Error: ');
  const message = idx >= 0 ? raw.slice(idx + 'Error: '.length).trim() : raw.trim();
  return message || fallback;
};
