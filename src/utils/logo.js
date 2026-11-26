import logoImg from '../assets/logo.png';

let cachedLogo = null;
let cachedLogoKey = '';

const loadImageAsDataUrl = (src) =>
  new Promise((resolve) => {
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0);
          resolve({
            dataUrl: canvas.toDataURL('image/png'),
            width: img.naturalWidth,
            height: img.naturalHeight,
          });
        } catch {
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      img.src = src;
    } catch {
      resolve(null);
    }
  });

/**
 * Charge le logo de l'entreprise et le renvoie en Data URL (base64) PNG,
 * utilisable directement par jsPDF (doc.addImage).
 * Le résultat est mis en cache pour éviter de le recharger à chaque PDF.
 * Renvoie null si le logo ne peut pas être chargé (le PDF reste généré sans logo).
 */
export const getLogoDataURL = async (customLogoDataUrl = '') => {
  const source = customLogoDataUrl || logoImg;
  if (cachedLogo && cachedLogoKey === source) {
    return cachedLogo;
  }

  const loaded = await loadImageAsDataUrl(source);
  if (loaded) {
    cachedLogo = loaded;
    cachedLogoKey = source;
    return loaded;
  }

  if (source !== logoImg) {
    const fallback = await loadImageAsDataUrl(logoImg);
    if (fallback) {
      cachedLogo = fallback;
      cachedLogoKey = logoImg;
      return fallback;
    }
  }

  return null;
};
