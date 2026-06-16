import logoImg from '../assets/logo.png';

let cachedLogo = null;

/**
 * Charge le logo de l'entreprise et le renvoie en Data URL (base64) PNG,
 * utilisable directement par jsPDF (doc.addImage).
 * Le résultat est mis en cache pour éviter de le recharger à chaque PDF.
 * Renvoie null si le logo ne peut pas être chargé (le PDF reste généré sans logo).
 */
export const getLogoDataURL = () =>
  new Promise((resolve) => {
    if (cachedLogo) {
      resolve(cachedLogo);
      return;
    }

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
          cachedLogo = {
            dataUrl: canvas.toDataURL('image/png'),
            width: img.naturalWidth,
            height: img.naturalHeight
          };
          resolve(cachedLogo);
        } catch (e) {
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      img.src = logoImg;
    } catch (e) {
      resolve(null);
    }
  });
