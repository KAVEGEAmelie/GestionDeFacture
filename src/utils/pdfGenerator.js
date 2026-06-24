import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { getLogoDataURL } from './logo';

// Affiche une ligne de texte centrée composée de segments [{ text, bold }],
// en réduisant la taille de police jusqu'à ce que le tout tienne dans maxWidth.
const drawCenteredRichText = (doc, segments, centerX, y, maxWidth, startSize, minSize) => {
  let fontSize = startSize;
  const totalWidth = () => {
    let w = 0;
    for (const seg of segments) {
      doc.setFont('helvetica', seg.bold ? 'bolditalic' : 'italic');
      w += doc.getTextWidth(seg.text);
    }
    return w;
  };
  doc.setFontSize(fontSize);
  while (totalWidth() > maxWidth && fontSize > minSize) {
    fontSize -= 0.25;
    doc.setFontSize(fontSize);
  }
  let x = centerX - totalWidth() / 2;
  for (const seg of segments) {
    doc.setFont('helvetica', seg.bold ? 'bolditalic' : 'italic');
    doc.text(seg.text, x, y);
    x += doc.getTextWidth(seg.text);
  }
};

// Fonction utilitaire pour formater les nombres avec des espaces insécables
const formatNumber = (number) => {
  if (number === null || number === undefined || number === '') return '0';
  // Convertir en nombre et formater avec des espaces insécables
  const num = parseFloat(number);
  if (isNaN(num)) return '0';
  
  // Arrondir à 2 décimales
  const rounded = Math.round(num * 100) / 100;
  
  // Séparer partie entière et décimale
  const parts = rounded.toString().split('.');
  const integerPart = parts[0];
  const decimalPart = parts[1] || '';
  
  // Ajouter des espaces insécables tous les 3 chiffres (de droite à gauche)
  let formattedInteger = '';
  for (let i = integerPart.length - 1, count = 0; i >= 0; i--, count++) {
    if (count > 0 && count % 3 === 0) {
      formattedInteger = '\u00A0' + formattedInteger; // Espace insécable
    }
    formattedInteger = integerPart[i] + formattedInteger;
  }
  
  // Retourner avec ou sans décimales
  if (decimalPart && parseInt(decimalPart) > 0) {
    return formattedInteger + ',' + decimalPart.padEnd(2, '0');
  }
  return formattedInteger;
};

// Fonction utilitaire pour convertir un nombre en lettres (français)
const nombreEnLettres = (nombre) => {
  const unites = ['', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf'];
  const dixaines = ['', 'dix', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante', 'soixante-dix', 'quatre-vingt', 'quatre-vingt-dix'];
  const special = ['dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize'];
  
  const convertirNombreMoins1000 = (n) => {
    if (n === 0) return '';
    if (n < 10) return unites[n];
    if (n >= 10 && n < 17) return special[n - 10];
    if (n === 17) return 'dix-sept';
    if (n === 18) return 'dix-huit';
    if (n === 19) return 'dix-neuf';
    if (n >= 20 && n < 100) {
      const diz = Math.floor(n / 10);
      const un = n % 10;
      if (n === 71) return 'soixante et onze';
      if (n >= 70 && n < 80) return 'soixante-' + convertirNombreMoins1000(n - 60);
      if (n === 80) return 'quatre-vingts';
      if (n > 80 && n < 90) return 'quatre-vingt-' + unites[un];
      if (n >= 90) return 'quatre-vingt-' + convertirNombreMoins1000(n - 80);
      return dixaines[diz] + (un > 0 ? (un === 1 && diz !== 8 ? ' et ' : '-') + unites[un] : '');
    }
    if (n >= 100) {
      const cent = Math.floor(n / 100);
      const reste = n % 100;
      return (cent === 1 ? 'cent' : unites[cent] + ' cent' + (cent > 1 && reste === 0 ? 's' : '')) +
             (reste > 0 ? ' ' + convertirNombreMoins1000(reste) : '');
    }
    return '';
  };

  const convertirNombre = (n) => {
    if (n === 0) return 'zéro';
    
    const millions = Math.floor(n / 1000000);
    const milliers = Math.floor((n % 1000000) / 1000);
    const centaines = n % 1000;
    
    let resultat = '';
    
    if (millions > 0) {
      resultat += (millions === 1 ? 'un million' : convertirNombreMoins1000(millions) + ' millions');
    }
    
    if (milliers > 0) {
      if (resultat) resultat += ' ';
      resultat += (milliers === 1 ? 'mille' : convertirNombreMoins1000(milliers) + ' mille');
    }
    
    if (centaines > 0) {
      if (resultat) resultat += ' ';
      resultat += convertirNombreMoins1000(centaines);
    }
    
    return resultat.charAt(0).toUpperCase() + resultat.slice(1);
  };

  const partieEntiere = Math.floor(nombre);
  const partieDecimale = Math.round((nombre - partieEntiere) * 100);
  
  let resultat = convertirNombre(partieEntiere);
  if (partieDecimale > 0) {
    resultat += ' virgule ' + convertirNombre(partieDecimale);
  }
  
  return resultat;
};

// Palette de couleurs de la charte In-Tel Services
const COLORS = {
  navy: [13, 42, 92],        // Bleu marine principal (titres, en-têtes)
  navySoft: [28, 86, 158],   // Bleu accent (valeurs, totaux)
  red: [214, 30, 24],        // Rouge (numéro, date, remise)
  ink: [55, 60, 70],         // Texte courant
  grey: [120, 125, 135],     // Texte secondaire
  boxBg: [240, 244, 250],    // Fond clair des encadrés / lignes alternées
  line: [205, 212, 224],     // Lignes fines
  white: [255, 255, 255]
};

const MARGIN = 12; // marge intérieure du contenu

// Trace un chemin polygonal fermé et rempli (utilitaire icônes)
const fillPoly = (doc, pts) => {
  const rel = [];
  for (let i = 1; i < pts.length; i++) {
    rel.push([pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]]);
  }
  doc.lines(rel, pts[0][0], pts[0][1], [1, 1], 'F', true);
};

// --- Petits pictogrammes des coordonnées (centre = x,y) ---
const iconPin = (doc, x, y) => {
  doc.setFillColor(...COLORS.navy);
  doc.circle(x, y - 0.5, 1.15, 'F');
  doc.triangle(x - 1.1, y - 0.1, x + 1.1, y - 0.1, x, y + 1.7, 'F');
  doc.setFillColor(...COLORS.white);
  doc.circle(x, y - 0.5, 0.42, 'F');
};
const iconPhone = (doc, x, y) => {
  doc.setFillColor(...COLORS.navy);
  doc.roundedRect(x - 1, y - 1.7, 2, 3.4, 0.4, 0.4, 'F');
  doc.setFillColor(...COLORS.white);
  doc.rect(x - 0.55, y - 1.15, 1.1, 2, 'F');
};
const iconMail = (doc, x, y) => {
  doc.setFillColor(...COLORS.navy);
  doc.rect(x - 1.7, y - 1.15, 3.4, 2.3, 'F');
  doc.setDrawColor(...COLORS.white);
  doc.setLineWidth(0.25);
  doc.line(x - 1.7, y - 1.15, x, y + 0.15);
  doc.line(x + 1.7, y - 1.15, x, y + 0.15);
};

// --- Cadre extérieur de la page ---
const drawPageFrame = (doc) => {
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  doc.setDrawColor(...COLORS.line);
  doc.setLineWidth(0.6);
  doc.roundedRect(6, 6, w - 12, h - 12, 3, 3, 'S');
};

// --- En-tête commun (logo + identité + coordonnées + RCCM/NIF + filet) ---
const drawHeader = async (doc, parametres, options = {}) => {
  const pageWidth = doc.internal.pageSize.getWidth();
  const contentLeft = MARGIN;
  const rightX = pageWidth - MARGIN;

  // LOGO
  const logo = await getLogoDataURL();
  let textX = contentLeft;
  if (logo) {
    const logoW = 30;
    const logoH = (logo.height / logo.width) * logoW;
    doc.addImage(logo.dataUrl, 'PNG', contentLeft, 9, logoW, logoH);
    textX = contentLeft + logoW + 6;
  }

  // Nom de l'entreprise
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(25);
  doc.setTextColor(...COLORS.navy);
  doc.text(`${parametres.entreprise_nom || 'IN-TEL SERVICES'}`, textX, 19);

  // Slogan (2 lignes)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...COLORS.navySoft);
  doc.text(`${parametres.entreprise_slogan1 || 'Solutions Réseaux • Télécommunications'}`, textX, 26.5);
  doc.text(`${parametres.entreprise_slogan2 || 'Sécurité Électronique • Énergie'}`, textX, 32);

  // Coordonnées avec icônes
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.ink);
  const cY = 38.5;
  const gap = 5;
  iconPin(doc, textX + 1.5, cY - 1);
  doc.text(`${parametres.entreprise_adresse || 'Bè-Klikamé, Lomé – TOGO'}`, textX + 5, cY);
  iconPhone(doc, textX + 1.5, cY + gap - 1);
  const tel = parametres.entreprise_tel || '+228 90 00 00 00';
  const cel = parametres.entreprise_cel || '99 00 00 00';
  doc.text(`${tel} / ${cel}`, textX + 5, cY + gap);
  iconMail(doc, textX + 1.5, cY + gap * 2 - 1);
  doc.text(`${parametres.entreprise_email || 'contact@intelservices.tg'}`, textX + 5, cY + gap * 2);

  // Séparateur vertical + bloc RCCM / NIF à droite
  const dividerX = pageWidth - 70;
  doc.setDrawColor(...COLORS.line);
  doc.setLineWidth(0.5);
  doc.line(dividerX, 14, dividerX, 49);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.ink);
  if (options.vignette) {
    // RCCM / NIF remontés pour laisser place au carré "vignette" en dessous
    doc.text(`RCCM : ${parametres.entreprise_rccm || 'TG-LOM-2020-B-12345'}`, dividerX + 4, 20);
    doc.text(`NIF : ${parametres.entreprise_nif || '1001304567'}`, dividerX + 4, 26);
    // Carré "vignette" (emplacement du timbre fiscal), centré dans le bloc droit
    const vSize = 20; // 2 cm × 2 cm
    const vX = dividerX + (rightX - dividerX - vSize) / 2;
    const vY = 28;
    doc.setDrawColor(...COLORS.navySoft);
    doc.setLineWidth(0.5);
    doc.setLineDashPattern([1.2, 1.2], 0);
    doc.rect(vX, vY, vSize, vSize, 'S');
    doc.setLineDashPattern([], 0);
  } else {
    doc.text(`RCCM : ${parametres.entreprise_rccm || 'TG-LOM-2020-B-12345'}`, dividerX + 4, 27);
    doc.text(`NIF : ${parametres.entreprise_nif || '1001304567'}`, dividerX + 4, 33);
  }

  // Filet horizontal épais
  const ruleY = 53;
  doc.setDrawColor(...COLORS.navy);
  doc.setLineWidth(1.1);
  doc.line(contentLeft, ruleY, rightX, ruleY);

  return { contentLeft, rightX, headerBottom: ruleY };
};

// --- Titre centré avec traits décoratifs ---
const drawTitle = (doc, title, y) => {
  const pageWidth = doc.internal.pageSize.getWidth();
  const cx = pageWidth / 2;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(24);
  doc.setTextColor(...COLORS.navy);
  doc.text(title, cx, y, { align: 'center' });
  const halfW = doc.getTextWidth(title) / 2;
  doc.setDrawColor(...COLORS.navy);
  doc.setLineWidth(0.8);
  const lineY = y - 2.5;
  doc.line(MARGIN + 6, lineY, cx - halfW - 8, lineY);
  doc.line(cx + halfW + 8, lineY, pageWidth - MARGIN - 6, lineY);
  return y + 6;
};

// --- Numéro + date (centré, aligné en 3 colonnes : label | : | valeur) ---
const drawNumDate = (doc, { label, numero, date, centerX, rightX, y }) => {
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');

  const colonGap = 2.5;   // espace label -> ":"
  const afterColon = 3;   // espace ":" -> valeur
  const colonW = doc.getTextWidth(':');

  // Dessine un couple "label : valeur" en colonnes fixes
  const drawPair = (lbl, val, labelRightX, yy) => {
    const colonX = labelRightX + colonGap;
    const valueX = colonX + colonW + afterColon;
    doc.setTextColor(...COLORS.navy);
    doc.text(lbl, labelRightX, yy, { align: 'right' });
    doc.text(':', colonX, yy);
    doc.setTextColor(...COLORS.red);
    doc.text(`${val}`, valueX, yy);
  };

  // N° centré autour de centerX (ligne 1)
  const numLabelW = doc.getTextWidth(label);
  const numValueW = doc.getTextWidth(`${numero}`);
  const numTotalW = numLabelW + colonGap + colonW + afterColon + numValueW;
  const numLabelRightX = centerX - numTotalW / 2 + numLabelW;
  drawPair(label, numero, numLabelRightX, y);

  // Date à droite, sur une LIGNE SÉPARÉE en dessous (alignée bord droit du box Objet)
  const dateLabelW = doc.getTextWidth('Date');
  const dateValueW = doc.getTextWidth(`${date}`);
  const dateValueX = rightX - 12 - dateValueW;
  const dateLabelRightX = dateValueX - afterColon - colonW - colonGap + dateLabelW;
  drawPair('Date', date, dateLabelRightX, y + 9);

  return y + 9;
};

// --- Encadré Client (titre au-dessus + box label : valeur) ---
const drawClientBox = (doc, x, y, w, client, options = {}) => {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...COLORS.navy);
  doc.text('Client :', x, y);

  const rows = [];
  rows.push(['Structure', client.client_nom || '']);
  if (options.simple) {
    if (client.client_adresse) rows.push(['Adresse', client.client_adresse]);
    if (client.client_telephone) rows.push(['Contact', client.client_telephone]);
  } else {
    if (client.client_adresse) rows.push(['Adresse', client.client_adresse]);
    if (client.client_telephone) rows.push(['Téléphone', client.client_telephone]);
    if (client.client_email) rows.push(['Email', client.client_email]);
    if (client.client_nif) rows.push(['NIF', client.client_nif]);
  }

  const boxY = y + 3;
  const rowH = 7;
  const boxH = rows.length * rowH + 4;
  doc.setDrawColor(...COLORS.line);
  doc.setFillColor(...COLORS.white);
  doc.setLineWidth(0.5);
  doc.roundedRect(x, boxY, w, boxH, 2, 2, 'S');

  doc.setFontSize(9.5);
  let ry = boxY + 7;
  rows.forEach(([label, value]) => {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.navy);
    doc.text(label, x + 5, ry);
    doc.setTextColor(...COLORS.ink);
    doc.text(':', x + 32, ry);
    doc.setFont('helvetica', 'normal');
    doc.text(`${value}`, x + 36, ry);
    ry += rowH;
  });
  return boxY + boxH;
};

// --- Encadré Objet (titre au-dessus + box texte) ---
const drawObjetBox = (doc, x, y, w, objet, minH) => {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...COLORS.navy);
  doc.text('Objet :', x, y);

  const boxY = y + 3;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(...COLORS.ink);
  const lines = doc.splitTextToSize(`${objet || ''}`, w - 10);
  const boxH = Math.max(minH || 0, lines.length * 5 + 8);
  doc.setDrawColor(...COLORS.line);
  doc.setLineWidth(0.5);
  doc.roundedRect(x, boxY, w, boxH, 2, 2, 'S');
  doc.text(lines, x + 5, boxY + 7);
  return boxY + boxH;
};

// --- Tableau des totaux (à droite) avec barre TOTAL TTC ---
const drawTotals = (doc, x, y, w, data, tauxTVA) => {
  doc.setFontSize(9.5);
  let ry = y + 5;
  const lineH = 6.5;
  const row = (label, value, opts = {}) => {
    doc.setFont('helvetica', opts.bold ? 'bold' : 'normal');
    doc.setTextColor(...(opts.color || COLORS.ink));
    doc.text(label, x + 2, ry);
    doc.text(`${value}`, x + w - 2, ry, { align: 'right' });
    ry += lineH;
  };
  row('TOTAL MATÉRIEL HT', formatNumber(data.total_materiel_ht || 0));
  row('PRESTATIONS', formatNumber(data.prestations || 0));
  if (data.remise > 0) {
    row('REMISE', '- ' + formatNumber(data.remise), { color: COLORS.red });
  }
  // séparateur
  doc.setDrawColor(...COLORS.line);
  doc.setLineWidth(0.4);
  doc.line(x, ry - lineH + 2.5, x + w, ry - lineH + 2.5);
  row('TOTAL HT', formatNumber(data.total_ht), { bold: true, color: COLORS.navySoft });
  const tauxAffiche = data.tva && data.tva > 0 ? tauxTVA : 0;
  row(`TVA (${tauxAffiche}%)`, formatNumber(data.tva || 0), { color: COLORS.ink });

  // Barre TOTAL TTC
  const barH = 9;
  doc.setFillColor(...COLORS.navy);
  doc.rect(x, ry - 4, w, barH, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...COLORS.white);
  doc.text('TOTAL TTC', x + 3, ry + 2);
  doc.text(`${formatNumber(data.total_ttc)}`, x + w - 3, ry + 2, { align: 'right' });
  return ry + 5;
};

// --- Encadré "somme en lettres" (à gauche) ---
const drawAmountInWords = (doc, x, y, w, h, intro, montantTTC) => {
  doc.setDrawColor(...COLORS.navy);
  doc.setLineWidth(0.5);
  doc.roundedRect(x, y, w, h, 2, 2, 'S');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(...COLORS.navySoft);
  doc.text(intro, x + 5, y + 8);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...COLORS.navy);
  const phrase = `${nombreEnLettres(montantTTC)} (${formatNumber(montantTTC)}) Francs CFA TTC.`;
  const lines = doc.splitTextToSize(phrase, w - 10);
  doc.text(lines, x + 5, y + 16);
};

// --- Signature (à droite, sous les totaux) ---
const drawSignature = (doc, centerX, y, parametres = {}, withCachet = false) => {
  const titre = parametres.signataire_titre || 'Le Directeur,';
  const nom = parametres.signataire_nom || 'Koffi KAVEGE';
  const img = parametres.signature_image;

  const titreY = y + 2;
  const nomY = y + 13;

  // 1) Cachet/signature dessiné EN PREMIER (en dessous) pour que le texte
  //    reste lisible par-dessus, même si le scan a un fond blanc opaque.
  if (withCachet && img) {
    try {
      const props = doc.getImageProperties(img);
      const maxW = 40;
      const maxH = 28;
      let w = maxW;
      let h = (props.height / props.width) * w;
      if (h > maxH) {
        h = maxH;
        w = (props.width / props.height) * h;
      }
      const cx = centerX + 12;
      const cyCenter = (y + nomY) / 2 + 1;
      doc.addImage(img, cx - w / 2, cyCenter - h / 2, w, h);
    } catch (e) {
      // image invalide : on garde uniquement le texte ci-dessous
    }
  }

  // 2) Titre par-dessus le cachet
  doc.setFont('helvetica', 'bolditalic');
  doc.setFontSize(10);
  doc.setTextColor(...COLORS.navy);
  doc.text(titre, centerX, titreY, { align: 'center' });

  // 3) Nom par-dessus le cachet
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.navy);
  doc.text(nom, centerX, nomY, { align: 'center' });
};

// --- Icône de service (cercle bleu + glyphe blanc) ---
const drawServiceIcon = (doc, cx, cy, r, type) => {
  // Pastille ronde bleu marine
  doc.setFillColor(...COLORS.navy);
  doc.circle(cx, cy, r, 'F');

  const white = COLORS.white;
  const navy = COLORS.navy;

  if (type === 'camera') {
    // Corps de la caméra
    doc.setFillColor(...white);
    doc.roundedRect(cx - 2.3, cy - 1.1, 4.6, 2.9, 0.5, 0.5, 'F');
    // Bossage du viseur
    doc.rect(cx - 1.3, cy - 1.9, 1.7, 0.9, 'F');
    // Objectif
    doc.setFillColor(...navy);
    doc.circle(cx + 0.1, cy + 0.35, 0.95, 'F');
    doc.setFillColor(...white);
    doc.circle(cx + 0.1, cy + 0.35, 0.4, 'F');
    // Flash
    doc.setFillColor(...navy);
    doc.circle(cx - 1.6, cy - 0.2, 0.32, 'F');
  } else if (type === 'network') {
    // Liens entre les nœuds
    doc.setDrawColor(...white);
    doc.setLineWidth(0.4);
    doc.line(cx, cy - 1.7, cx - 2, cy + 1.6);
    doc.line(cx, cy - 1.7, cx + 2, cy + 1.6);
    doc.line(cx - 2, cy + 1.6, cx + 2, cy + 1.6);
    // Nœuds
    doc.setFillColor(...white);
    doc.circle(cx, cy - 1.7, 0.95, 'F');       // haut
    doc.circle(cx - 2, cy + 1.6, 0.95, 'F');   // bas gauche
    doc.circle(cx + 2, cy + 1.6, 0.95, 'F');   // bas droite
  } else if (type === 'antenna') {
    // Wifi : point de base + 2 arcs (chevrons)
    doc.setFillColor(...white);
    doc.circle(cx, cy + 1.9, 0.75, 'F');
    doc.setDrawColor(...white);
    doc.setLineWidth(0.5);
    // arc intérieur
    doc.line(cx - 1.3, cy + 0.5, cx, cy - 0.4);
    doc.line(cx, cy - 0.4, cx + 1.3, cy + 0.5);
    // arc extérieur
    doc.line(cx - 2.3, cy - 0.1, cx, cy - 2);
    doc.line(cx, cy - 2, cx + 2.3, cy - 0.1);
  } else if (type === 'energy') {
    // Éclair
    doc.setFillColor(...white);
    fillPoly(doc, [
      [cx + 0.7, cy - 2.6],
      [cx - 2, cy + 0.5],
      [cx - 0.2, cy + 0.5],
      [cx - 0.7, cy + 2.6],
      [cx + 2, cy - 0.5],
      [cx + 0.2, cy - 0.5]
    ]);
  }
};

// --- Pied de page commun (sceau + slogan + icônes + décor d'angle) ---
const drawFooter = (doc, parametres = {}) => {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const baseY = pageHeight - 15;

  // Filet de séparation au-dessus du pied de page
  doc.setDrawColor(...COLORS.line);
  doc.setLineWidth(0.4);
  doc.line(MARGIN, pageHeight - 24, pageWidth - MARGIN, pageHeight - 24);

  // Petit décor d'angle discret en bas à droite
  doc.setFillColor(...COLORS.navySoft);
  fillPoly(doc, [
    [pageWidth - 6, pageHeight - 6],
    [pageWidth - 30, pageHeight - 6],
    [pageWidth - 6, pageHeight - 22]
  ]);
  doc.setFillColor(...COLORS.navy);
  fillPoly(doc, [
    [pageWidth - 6, pageHeight - 6],
    [pageWidth - 18, pageHeight - 6],
    [pageWidth - 6, pageHeight - 14]
  ]);

  // Sceau (médaille) à gauche
  const sealX = MARGIN + 4;
  doc.setFillColor(...COLORS.navy);
  doc.circle(sealX, baseY, 3.4, 'F');
  doc.setFillColor(...COLORS.white);
  doc.circle(sealX, baseY - 0.3, 1.2, 'F');
  doc.setFillColor(...COLORS.navy);
  doc.circle(sealX, baseY - 0.3, 0.5, 'F');
  doc.setFillColor(...COLORS.navy);
  doc.triangle(sealX - 1.7, baseY + 2, sealX - 0.4, baseY + 2, sealX - 1.05, baseY + 4.5, 'F');
  doc.triangle(sealX + 0.4, baseY + 2, sealX + 1.7, baseY + 2, sealX + 1.05, baseY + 4.5, 'F');

  // Slogan
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.navy);
  doc.text(`${parametres.entreprise_slogan_pied1 || 'Votre partenaire en réseaux informatiques,'}`, sealX + 8, baseY - 1.5);
  doc.text(`${parametres.entreprise_slogan_pied2 || 'télécommunications et sécurité électronique.'}`, sealX + 8, baseY + 3);

  // 4 icônes de services à droite (avant le décor d'angle)
  const r = 3.6;
  const startX = 140;
  const step = 11;
  const types = ['camera', 'network', 'antenna', 'energy'];
  types.forEach((t, i) => {
    drawServiceIcon(doc, startX + i * step, baseY, r, t);
  });
};

// --- Date au format long français : "19 Juin 2026" ---
const formatDateLong = (dateInput) => {
  const d = new Date(dateInput);
  if (Number.isNaN(d.getTime())) return '';
  const mois = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
  return `${d.getDate()} ${mois[d.getMonth()]} ${d.getFullYear()}`;
};

// --- N° et Date empilés et alignés à droite (libellés/colonnes calés) ---
const drawNumDateRight = (doc, { label = 'N°', numero, date, rightX, y }) => {
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  const colonGap = 2.5;
  const afterColon = 3;
  const colonW = doc.getTextWidth(':');
  const maxValueW = Math.max(doc.getTextWidth(`${numero}`), doc.getTextWidth(`${date}`));
  const valueX = rightX - maxValueW;
  const colonX = valueX - afterColon - colonW;
  const labelRightX = colonX - colonGap;

  const drawPair = (lbl, val, yy) => {
    doc.setTextColor(...COLORS.navy);
    doc.text(lbl, labelRightX, yy, { align: 'right' });
    doc.text(':', colonX, yy);
    doc.setTextColor(...COLORS.red);
    doc.text(`${val}`, valueX, yy);
  };

  drawPair(label, numero, y);
  drawPair('Date', date, y + 8);
  return y + 8;
};

// --- Encadré "Conditions de paiement" (bas de la facture) ---
const drawConditionsBox = (doc, x, y, w) => {
  const h = 24;
  doc.setDrawColor(...COLORS.line);
  doc.setLineWidth(0.5);
  doc.roundedRect(x, y, w, h, 2, 2, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(...COLORS.navy);
  doc.text('CONDITIONS DE PAIEMENT', x + 5, y + 7);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.ink);
  doc.text('Paiement comptant ou par virement bancaire.', x + 5, y + 14);
  doc.text('Échéance :  ____ / ____ / ________', x + 5, y + 20);
  return y + h;
};

// --- Encadré "Observations" (bordereau) ---
const drawObservationsBox = (doc, x, y, w, texte) => {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...COLORS.navy);
  doc.text('Observations :', x, y);

  const boxY = y + 3;
  const boxH = 14;
  doc.setDrawColor(...COLORS.line);
  doc.setLineWidth(0.5);
  doc.roundedRect(x, boxY, w, boxH, 2, 2, 'S');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(...COLORS.ink);
  const lines = doc.splitTextToSize(`${texte || ''}`, w - 10);
  doc.text(lines, x + 5, boxY + 7);
  return boxY + boxH;
};

// --- Bloc "Certification de livraison" (bordereau) ---
const drawCertification = (doc, x, rightX, y, annee) => {
  const w = rightX - x;
  const centerX = x + w / 2;

  // Titre centré
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...COLORS.navy);
  doc.text('CERTIFICATION DE LIVRAISON', centerX, y, { align: 'center' });

  // Texte "Je soussigné(e) ... certifie avoir reçu ..."
  let ty = y + 8;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...COLORS.ink);
  const intro = 'Je soussigné(e) ';
  const fin = ' certifie avoir reçu les matériels';
  doc.text(intro, x, ty);
  const introW = doc.getTextWidth(intro);
  const finW = doc.getTextWidth(fin);
  // ligne de pointillés entre l'intro et la fin
  doc.setDrawColor(...COLORS.line);
  doc.setLineWidth(0.4);
  doc.line(x + introW + 1, ty + 1, rightX - finW - 1, ty + 1);
  doc.text(fin, rightX - finW, ty);
  ty += 6;
  doc.text('mentionnés ci-dessus en bon état.', x, ty);

  // Deux cadres : LIVREUR / RÉCEPTIONNAIRE
  ty += 5;
  const gap = 8;
  const cadreW = (w - gap) / 2;
  const cadreH = 30;
  const drawCadre = (cx, titre, withCachet) => {
    doc.setDrawColor(...COLORS.line);
    doc.setLineWidth(0.5);
    doc.roundedRect(cx, ty, cadreW, cadreH, 2, 2, 'S');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(...COLORS.navy);
    doc.text(titre, cx + 5, ty + 7);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...COLORS.ink);
    doc.text('Nom :  ______________________', cx + 5, ty + 14);
    doc.text(`Date :  ____ / ____ / ${annee}`, cx + 5, ty + 20);
    if (withCachet) {
      doc.text('Signature & Cachet :', cx + 5, ty + 26);
      doc.setDrawColor(...COLORS.line);
      doc.rect(cx + cadreW - 33, ty + 21, 28, 7, 'S');
    } else {
      doc.text('Signature :  ________________', cx + 5, ty + 26);
    }
  };
  drawCadre(x, 'LIVREUR', false);
  drawCadre(x + cadreW + gap, 'RÉCEPTIONNAIRE', true);

  return ty + cadreH;
};

// Génération PDF Proforma
export const generateProformaPDF = async (proforma, parametres, options = {}) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const tauxTVA = parametres.tva_taux || 18;

  drawPageFrame(doc);
  const { contentLeft, rightX, headerBottom } = await drawHeader(doc, parametres);

  // Titre
  let yPos = drawTitle(doc, 'FACTURE PROFORMA', headerBottom + 11);

  // N° (centré sous le titre) / Date (décalée à droite)
  const dateStr = new Date(proforma.date).toLocaleDateString('fr-FR');
  drawNumDate(doc, { label: 'N°', numero: proforma.numero, date: dateStr, centerX: pageWidth / 2, rightX, y: yPos + 6 });

  // Client (gauche) + Objet (droite)
  const blockY = yPos + 24;
  const clientW = 92;
  const objetX = contentLeft + clientW + 8;
  const objetW = rightX - objetX;
  const clientBottom = drawClientBox(doc, contentLeft, blockY, clientW, proforma);
  const objetBottom = drawObjetBox(doc, objetX, blockY, objetW, proforma.objet, 0);

  yPos = Math.max(clientBottom, objetBottom) + 8;

  // Tableau des lignes
  const tableData = proforma.lignes.map((l, i) => [
    i + 1, l.designation, l.unite, l.quantite,
    formatNumber(l.prix_unitaire), formatNumber(l.montant)
  ]);
  const qteTotal = proforma.lignes.reduce((s, l) => s + (parseFloat(l.quantite) || 0), 0);

  doc.autoTable({
    startY: yPos,
    head: [['N°', 'DÉSIGNATION', 'UNITÉ', 'QTÉ', 'PRIX UNITAIRE\n(FCFA)', 'MONTANT\n(FCFA)']],
    body: tableData,
    foot: [[
      { content: 'TOTAL', colSpan: 3, styles: { halign: 'center' } },
      { content: formatNumber(qteTotal), styles: { halign: 'center' } },
      '', ''
    ]],
    theme: 'grid',
    headStyles: {
      fillColor: COLORS.navy, textColor: COLORS.white, fontStyle: 'bold',
      fontSize: 8.5, halign: 'center', valign: 'middle', cellPadding: 2.5
    },
    bodyStyles: { fontSize: 9, cellPadding: 2.2, textColor: COLORS.ink, valign: 'middle' },
    footStyles: {
      fillColor: COLORS.boxBg, textColor: COLORS.navy, fontStyle: 'bold', fontSize: 9.5
    },
    columnStyles: {
      0: { cellWidth: 12, halign: 'center' },
      1: { cellWidth: 70 },
      2: { cellWidth: 22, halign: 'center' },
      3: { cellWidth: 16, halign: 'center' },
      4: { cellWidth: 33, halign: 'right' },
      5: { cellWidth: 33, halign: 'right' }
    },
    styles: { lineColor: COLORS.line, lineWidth: 0.15 },
    margin: { left: MARGIN, right: MARGIN, bottom: 40 }
  });

  yPos = doc.lastAutoTable.finalY + 8;

  // Bloc bas : somme en lettres (gauche) + totaux (droite)
  const totalsW = 86;
  const totalsX = rightX - totalsW;
  const wordsW = totalsX - contentLeft - 8;
  const wordsH = 34;

  if (yPos + wordsH + 28 > pageHeight - 24) {
    doc.addPage();
    drawPageFrame(doc);
    yPos = 30;
  }

  drawAmountInWords(doc, contentLeft, yPos, wordsW, wordsH,
    'Arrêtée la présente facture proforma à la somme de :', proforma.total_ttc);

  const totalsBottom = drawTotals(doc, totalsX, yPos, totalsW, {
    total_materiel_ht: proforma.total_materiel_ht,
    prestations: proforma.prestations,
    remise: proforma.remise,
    total_ht: proforma.total_ht,
    tva: proforma.tva,
    total_ttc: proforma.total_ttc
  }, tauxTVA);

  // Signature centrée sous les totaux (un peu plus bas)
  drawSignature(doc, totalsX + totalsW / 2, Math.max(totalsBottom, yPos + wordsH) + 10, parametres, options.withCachet === true);

  // Pied de page commun
  drawFooter(doc, parametres);

  return doc;
};

// Génération PDF Facture (similaire à Proforma)
// Génération PDF Facture (design moderne, dérivé de la proforma)
export const generateFacturePDF = async (facture, parametres) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const tauxTVA = parametres.tva_taux || 18;

  drawPageFrame(doc);
  const { contentLeft, rightX, headerBottom } = await drawHeader(doc, parametres, { vignette: true });

  // Titre
  let yPos = drawTitle(doc, 'FACTURE', headerBottom + 11);

  // N° (centré sous le titre) / Date (décalée à droite) — même disposition que la proforma
  const dateStr = formatDateLong(facture.date);
  drawNumDate(doc, { label: 'N°', numero: facture.numero, date: dateStr, centerX: pageWidth / 2, rightX, y: yPos + 6 });

  // Client (gauche)
  const blockY = yPos + 24;
  const clientW = 92;
  const clientBottom = drawClientBox(doc, contentLeft, blockY, clientW, facture);

  // Objet en ligne, sous l'encadré client
  let objetY = clientBottom + 7;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...COLORS.navy);
  doc.text('Objet :', contentLeft, objetY);
  const objetLabelW = doc.getTextWidth('Objet :  ');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...COLORS.ink);
  const objetLines = doc.splitTextToSize(`${facture.objet || ''}`, rightX - contentLeft - objetLabelW);
  doc.text(objetLines, contentLeft + objetLabelW, objetY);
  yPos = objetY + Math.max(6, objetLines.length * 5);

  // Tableau des lignes
  const tableData = facture.lignes.map((l, i) => [
    i + 1, l.designation, l.unite, l.quantite,
    formatNumber(l.prix_unitaire), formatNumber(l.montant)
  ]);
  const qteTotal = facture.lignes.reduce((s, l) => s + (parseFloat(l.quantite) || 0), 0);

  doc.autoTable({
    startY: yPos,
    head: [['N°', 'DÉSIGNATION', 'UNITÉ', 'QTÉ', 'PRIX UNIT.\n(FCFA)', 'MONTANT\n(FCFA)']],
    body: tableData,
    foot: [[
      { content: 'TOTAL QUANTITÉ', colSpan: 3, styles: { halign: 'center' } },
      { content: formatNumber(qteTotal), styles: { halign: 'center' } },
      '', ''
    ]],
    showFoot: 'lastPage',
    theme: 'grid',
    headStyles: {
      fillColor: COLORS.navy, textColor: COLORS.white, fontStyle: 'bold',
      fontSize: 8.5, halign: 'center', valign: 'middle', cellPadding: 2.5
    },
    bodyStyles: { fontSize: 9, cellPadding: 2.2, textColor: COLORS.ink, valign: 'middle' },
    footStyles: {
      fillColor: COLORS.boxBg, textColor: COLORS.navy, fontStyle: 'bold', fontSize: 9.5
    },
    columnStyles: {
      0: { cellWidth: 12, halign: 'center' },
      1: { cellWidth: 70 },
      2: { cellWidth: 22, halign: 'center' },
      3: { cellWidth: 16, halign: 'center' },
      4: { cellWidth: 33, halign: 'right' },
      5: { cellWidth: 33, halign: 'right' }
    },
    styles: { lineColor: COLORS.line, lineWidth: 0.15 },
    margin: { left: MARGIN, right: MARGIN, top: 18, bottom: 40 },
    // Sur chaque page (y compris les pages de continuation) : bordure + pied de page
    didDrawPage: () => { drawPageFrame(doc); drawFooter(doc, parametres); }
  });

  yPos = doc.lastAutoTable.finalY + 8;

  // Bloc bas : somme en lettres (gauche) + totaux (droite)
  const totalsW = 86;
  const totalsX = rightX - totalsW;
  const wordsW = totalsX - contentLeft - 8;
  const wordsH = 32;

  // Hauteur du bloc bas gauche (somme en lettres + conditions de paiement)
  const condGap = 6;
  const condH = 22;
  const blocBasH = wordsH + condGap + condH;
  if (yPos + blocBasH > pageHeight - 24) {
    doc.addPage();
    drawPageFrame(doc);
    drawFooter(doc, parametres);
    yPos = 30;
  }

  drawAmountInWords(doc, contentLeft, yPos, wordsW, wordsH,
    'Arrêtée la présente facture à la somme de :', facture.total_ttc);

  const totalsBottom = drawTotals(doc, totalsX, yPos, totalsW, {
    total_materiel_ht: facture.total_materiel_ht,
    prestations: facture.prestations,
    remise: facture.remise,
    total_ht: facture.total_ht,
    tva: facture.tva,
    total_ttc: facture.total_ttc
  }, tauxTVA);

  // Conditions de paiement (gauche, sous la somme en lettres)
  drawConditionsBox(doc, contentLeft, yPos + wordsH + condGap, wordsW);

  // Signature centrée sous les totaux
  drawSignature(doc, totalsX + totalsW / 2, Math.max(totalsBottom, yPos + wordsH) + 10, parametres);

  // (Le pied de page est dessiné sur chaque page via didDrawPage / la page de débordement)

  return doc;
};

// Génération PDF Bordereau (design moderne, cohérent avec proforma/facture)
export const generateBordereauPDF = async (bordereau, parametres) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  drawPageFrame(doc);
  const { contentLeft, rightX, headerBottom } = await drawHeader(doc, parametres);

  // Titre
  let yPos = drawTitle(doc, 'BORDEREAU DE LIVRAISON', headerBottom + 11);

  // BL N° (centré sous le titre) / Date (décalée à droite) — même disposition que proforma/facture
  const dateStr = formatDateLong(bordereau.date);
  drawNumDate(doc, { label: 'BL N°', numero: bordereau.numero, date: dateStr, centerX: pageWidth / 2, rightX, y: yPos + 6 });

  // Client (gauche)
  const blockY = yPos + 20;
  const clientW = 92;
  const clientBottom = drawClientBox(doc, contentLeft, blockY, clientW, bordereau, { simple: true });

  yPos = clientBottom + 6;

  // Tableau des lignes livrées
  const tableData = bordereau.lignes.map((l, i) => [
    i + 1, l.designation, l.quantite, ''
  ]);
  const qteTotal = bordereau.lignes.reduce((s, l) => s + (parseFloat(l.quantite) || 0), 0);

  doc.autoTable({
    startY: yPos,
    head: [['N°', 'DÉSIGNATION', 'QTÉ LIVRÉE', 'OBSERVATIONS']],
    body: tableData,
    foot: [[
      { content: 'TOTAL', colSpan: 2, styles: { halign: 'center' } },
      { content: formatNumber(qteTotal), styles: { halign: 'center' } },
      ''
    ]],
    showFoot: 'lastPage',
    theme: 'grid',
    headStyles: {
      fillColor: COLORS.navy, textColor: COLORS.white, fontStyle: 'bold',
      fontSize: 8.5, halign: 'center', valign: 'middle', cellPadding: 2.5
    },
    bodyStyles: { fontSize: 9, cellPadding: 2.0, textColor: COLORS.ink, valign: 'middle' },
    footStyles: {
      fillColor: COLORS.boxBg, textColor: COLORS.navy, fontStyle: 'bold', fontSize: 9.5
    },
    columnStyles: {
      0: { cellWidth: 12, halign: 'center' },
      1: { cellWidth: 96 },
      2: { cellWidth: 30, halign: 'center' },
      3: { cellWidth: 48 }
    },
    styles: { lineColor: COLORS.line, lineWidth: 0.15 },
    margin: { left: MARGIN, right: MARGIN, top: 18, bottom: 40 },
    // Sur chaque page (y compris les pages de continuation) : bordure + pied de page
    didDrawPage: () => { drawPageFrame(doc); drawFooter(doc, parametres); }
  });

  yPos = doc.lastAutoTable.finalY + 8;

  // Bloc bas (observations + certification) ancré au-dessus du pied de page,
  // tout en restant après le tableau. Passe à la page suivante si nécessaire.
  const obsH = 17;     // hauteur "Observations :" + encadré
  const certH = 50;    // hauteur du bloc "Certification de livraison"
  const gap = 6;
  const blocBasH = obsH + gap + certH;
  const footerTop = pageHeight - 24;
  let blocTop = Math.max(yPos, footerTop - 3 - blocBasH);
  if (blocTop + blocBasH > footerTop - 2) {
    doc.addPage();
    drawPageFrame(doc);
    drawFooter(doc, parametres);
    blocTop = Math.max(30, footerTop - 3 - blocBasH);
  }

  // Encadré Observations
  const obsBottom = drawObservationsBox(doc, contentLeft, blocTop, rightX - contentLeft,
    'Matériels livrés en bon état conformément au devis et à la commande du client.');

  // Bloc Certification de livraison
  const annee = new Date(bordereau.date).getFullYear() || new Date().getFullYear();
  drawCertification(doc, contentLeft, rightX, obsBottom + gap, annee);

  // (Le pied de page est dessiné sur chaque page via didDrawPage / la page de débordement)

  return doc;
};

// Génération PDF Rapport TVA (suivi OTR)
// rapport = { titre, sousTitre, dateLabel, lignes:[{numero, client, date, total_ttc, tva}], totalTtc, totalTva }
export const generateTvaPDF = async (rapport, parametres) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  drawPageFrame(doc);
  const { contentLeft, rightX, headerBottom } = await drawHeader(doc, parametres);

  // Titre
  let yPos = drawTitle(doc, rapport.titre || 'RAPPORT TVA', headerBottom + 11);

  // Sous-titre (type + période) centré
  if (rapport.sousTitre) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(10);
    doc.setTextColor(...COLORS.grey);
    doc.text(rapport.sousTitre, pageWidth / 2, yPos + 6, { align: 'center' });
    yPos += 6;
  }

  // Date d'édition à droite
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.ink);
  doc.text(`Édité le : ${formatDateLong(new Date())}`, rightX, yPos + 8, { align: 'right' });

  yPos += 14;

  // Tableau des factures
  const lignes = rapport.lignes || [];
  const tableData = lignes.map((l, i) => [
    i + 1,
    l.numero || '',
    l.client || '',
    l.date || '-',
    formatNumber(l.total_ttc),
    formatNumber(l.tva)
  ]);

  doc.autoTable({
    startY: yPos,
    head: [['N°', 'N° FACTURE', 'CLIENT', rapport.dateLabel || 'DATE', 'MONTANT TTC\n(FCFA)', 'TVA\n(FCFA)']],
    body: tableData,
    foot: [[
      { content: 'TOTAL', colSpan: 4, styles: { halign: 'right' } },
      { content: formatNumber(rapport.totalTtc), styles: { halign: 'right' } },
      { content: formatNumber(rapport.totalTva), styles: { halign: 'right' } }
    ]],
    theme: 'grid',
    headStyles: {
      fillColor: COLORS.navy, textColor: COLORS.white, fontStyle: 'bold',
      fontSize: 8.5, halign: 'center', valign: 'middle', cellPadding: 2.5
    },
    bodyStyles: { fontSize: 9, cellPadding: 2.2, textColor: COLORS.ink, valign: 'middle' },
    footStyles: {
      fillColor: COLORS.boxBg, textColor: COLORS.navy, fontStyle: 'bold', fontSize: 9.5
    },
    columnStyles: {
      0: { cellWidth: 12, halign: 'center' },
      1: { cellWidth: 38 },
      2: { cellWidth: 56 },
      3: { cellWidth: 30, halign: 'center' },
      4: { cellWidth: 26, halign: 'right' },
      5: { cellWidth: 24, halign: 'right' }
    },
    styles: { lineColor: COLORS.line, lineWidth: 0.15 },
    margin: { left: MARGIN, right: MARGIN, bottom: 30 },
    didDrawPage: () => { drawPageFrame(doc); }
  });

  // Pied de page commun
  drawFooter(doc, parametres);

  return doc;
};

// =====================================================================
//  RAPPORT TECHNIQUE (texte libre, sections numérotées, pagination auto)
// =====================================================================
export const generateRapportPDF = async (rapport, parametres = {}) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentWidth = pageWidth - MARGIN * 2;
  const bottomLimit = pageHeight - 30;

  // ═══════════════════════════════════════════════════
  // PAGE 1 : Entête + Titre centré + Rectangle infos
  // Le contenu du rapport commence TOUJOURS page 2
  // ═══════════════════════════════════════════════════
  drawPageFrame(doc);
  const header = await drawHeader(doc, parametres);
  drawFooter(doc, parametres);

  // — Référence discrète en haut à droite —
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.grey);
  doc.text(`Réf : ${rapport.numero || ''}`, header.rightX, header.headerBottom + 6, { align: 'right' });

  // — Titre bien centré verticalement dans la zone disponible —
  const titre = (rapport.titre || 'RAPPORT TECHNIQUE').toUpperCase();
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(...COLORS.navy);
  const titleLines = doc.splitTextToSize(titre, contentWidth - 10);

  // Zone disponible entre entête et bas de page
  const topZone = header.headerBottom + 10;
  const bottomZone = bottomLimit;
  // On place le titre au tiers supérieur de la zone disponible
  const titleZoneCenter = topZone + (bottomZone - topZone) * 0.35;
  const titleBlockH = titleLines.length * 9;
  let titleY = titleZoneCenter - titleBlockH / 2;

  titleLines.forEach((line) => {
    doc.text(line, pageWidth / 2, titleY, { align: 'center' });
    titleY += 9;
  });
  // Filet décoratif sous le titre
  const underlineY = titleY + 2;
  doc.setDrawColor(...COLORS.navy);
  doc.setLineWidth(0.7);
  doc.line(pageWidth / 2 - 35, underlineY, pageWidth / 2 + 35, underlineY);

  // — Rectangle infos en bas de la page 1 —
  const infos = [];
  if (rapport.client_nom) infos.push(['Client', rapport.client_nom]);
  infos.push(['Prestataire', parametres.entreprise_nom || 'IN-TEL SERVICES']);
  if (rapport.lieu) infos.push(['Lieu', rapport.lieu]);
  infos.push(['Date', formatDateLong(rapport.date)]);
  if (rapport.objet) infos.push(['Objet', rapport.objet]);

  const infoPad = 6;
  const labelW = 34;
  const infoLineH = 6.5;
  doc.setFontSize(10.5);
  const valueW = contentWidth - labelW - infoPad * 2;
  const infoRendered = infos.map(([label, value]) => {
    const lines = doc.splitTextToSize(String(value || ''), valueW);
    return { label, lines };
  });
  const totalInfoH = infoRendered.reduce((s, r) => s + r.lines.length * infoLineH, 0);
  const boxH = totalInfoH + infoPad * 2 + 4;

  const infoBoxY = bottomLimit - boxH - 6;
  doc.setFillColor(...COLORS.boxBg);
  doc.setDrawColor(...COLORS.line);
  doc.setLineWidth(0.5);
  doc.roundedRect(MARGIN, infoBoxY, contentWidth, boxH, 3, 3, 'FD');

  let infoY = infoBoxY + infoPad + 4;
  infoRendered.forEach(({ label, lines }) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(...COLORS.navy);
    doc.text(`${label} :`, MARGIN + infoPad, infoY);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...COLORS.ink);
    lines.forEach((line, i) => {
      doc.text(line, MARGIN + infoPad + labelW, infoY + i * infoLineH);
    });
    infoY += lines.length * infoLineH;
  });

  // ═══════════════════════════════════════════════════
  // PAGE 2+ : Contenu du rapport (sans entête)
  // ═══════════════════════════════════════════════════
  doc.addPage();
  drawPageFrame(doc);
  drawFooter(doc, parametres);
  let yPos = MARGIN + 12;

  // --- Helper : saut de page SANS en-tête (cadre + pied seulement) ---
  const ensureSpace = async (needed) => {
    if (yPos + needed > bottomLimit) {
      doc.addPage();
      drawPageFrame(doc);
      drawFooter(doc, parametres);
      yPos = MARGIN + 12;
    }
  };

  // --- Sections numérotées ---
  const sections = Array.isArray(rapport.sections) ? rapport.sections : [];
  let idx = 1;
  for (const section of sections) {
    if (!section || (!section.titre && !section.contenu)) continue;

    // Titre de section
    const heading = `${idx}. ${(section.titre || '').toUpperCase()}`;
    await ensureSpace(16);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11.5);
    doc.setTextColor(...COLORS.navy);
    const headingLines = doc.splitTextToSize(heading, contentWidth);
    headingLines.forEach((line) => {
      doc.text(line, MARGIN, yPos);
      yPos += 6;
    });
    doc.setDrawColor(...COLORS.line);
    doc.setLineWidth(0.3);
    doc.line(MARGIN, yPos - 3, MARGIN + contentWidth, yPos - 3);
    yPos += 3;

    // Corps de section
    const paragraphs = String(section.contenu || '').split('\n');
    for (const para of paragraphs) {
      const trimmed = para.trim();
      if (trimmed === '') { yPos += 2.5; continue; }

      const isBullet = /^(-|•|\*|–)\s+/.test(trimmed);
      const isSubHeading = !isBullet && trimmed.endsWith(':') && trimmed.length <= 70;
      let text = trimmed;
      let indent = 0;

      if (isBullet) {
        text = trimmed.replace(/^(-|•|\*|–)\s+/, '');
        indent = 6;
      }

      if (isSubHeading) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(...COLORS.navySoft);
      } else {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(...COLORS.ink);
      }

      const wrapped = doc.splitTextToSize(text, contentWidth - indent);
      for (let i = 0; i < wrapped.length; i++) {
        await ensureSpace(6);
        if (isBullet && i === 0) {
          doc.setFillColor(...COLORS.navySoft);
          doc.circle(MARGIN + 2, yPos - 1.4, 0.7, 'F');
        }
        doc.text(wrapped[i], MARGIN + indent, yPos);
        yPos += 5.4;
      }
      if (isSubHeading) yPos += 1;
    }
    yPos += 6;
    idx++;
  }

  // --- Clôture : lieu/date + « Pour … » + signature/cachet ---
  await ensureSpace(56);
  yPos += 8;
  const sigCenterX = pageWidth - MARGIN - 32;
  const closureX = sigCenterX;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10.5);
  doc.setTextColor(...COLORS.ink);
  const lieu = rapport.lieu || 'Lomé';
  doc.text(`Fait à ${lieu}, le ${formatDateLong(rapport.date)}.`, closureX, yPos, { align: 'center' });
  yPos += 8;
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.navy);
  doc.text(`Pour ${parametres.entreprise_nom || 'IN-TEL SERVICES'}`, closureX, yPos, { align: 'center' });

  const withCachet = rapport.avec_cachet === 1 || rapport.avec_cachet === true;
  drawSignature(doc, sigCenterX, yPos + 8, parametres, withCachet);

  // --- Numérotation « Page X / Y » sur toutes les pages ---
  const totalPages = doc.internal.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.grey);
    doc.text(`Page ${p} / ${totalPages}`, pageWidth / 2, pageHeight - 8, { align: 'center' });
  }

  return doc;
};
