import jsPDF from 'jspdf';
import 'jspdf-autotable';

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

// Génération PDF Proforma
export const generateProformaPDF = async (proforma, parametres) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  let yPos = 15;

  // EN-TÊTE - Titre "In-Tel Services" à gauche
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 51, 102); // Bleu marine pour "In-Tel"
  doc.text('In-Tel ', 15, yPos);
  
  // "Services" en vert
  doc.setTextColor(0, 128, 0);
  doc.text('Services', 37, yPos);

  // Encadré à droite avec les services - AGRANDI
  const rightX = pageWidth - 15;
  const boxLeft = pageWidth - 78;
  const boxTop = yPos - 7;
  doc.setDrawColor(255, 140, 0); // Orange
  doc.setLineWidth(0.8);
  doc.rect(boxLeft, boxTop, 63, 22);
  
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 0, 0);
  doc.text('Services & Intégration Réseau - Maintenance', rightX - 2, yPos - 3, { align: 'right' });
  doc.text('Télécommunication - Audit - Conseil Système', rightX - 2, yPos + 1.5, { align: 'right' });
  doc.text('de Sécurité -Vente de Matériels Informatique -', rightX - 2, yPos + 6, { align: 'right' });
  doc.text('Formation', rightX - 2, yPos + 10.5, { align: 'right' });

  yPos += 8;

  // Coordonnées sous le titre
  doc.setFontSize(7);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(0, 0, 0);
  doc.text(`20 Av. du RPT Face le Grand Collège du Plateau 04BP Lomé-TOGO`, 15, yPos);
  yPos += 3.5;
  doc.text(`Tél. (+228) 22 22 14 54 – Cel. 90 11 66 86/99 32 98 98`, 15, yPos);
  yPos += 3.5;
  doc.text(`E-Mail: infos_its@yahoo.fr`, 15, yPos);

  yPos += 6;

  // Ligne de séparation horizontale avec point bleu à droite
  doc.setDrawColor(0, 51, 102); // Bleu marine
  doc.setLineWidth(1);
  doc.line(15, yPos, pageWidth - 15, yPos);
  // Point bleu à droite de la ligne
  doc.setFillColor(0, 51, 102);
  doc.circle(pageWidth - 15, yPos, 2, 'F');

  yPos += 8;

  // Bloc d'informations administratives à gauche
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text(`RCCM :`, 15, yPos);
  doc.setFont('helvetica', 'normal');
  doc.text(`${parametres.entreprise_rccm || 'TG-LOM 2013 A 6170'}`, 28, yPos);
  
  yPos += 4;
  doc.setFont('helvetica', 'bold');
  doc.text(`NIF :`, 15, yPos);
  doc.setFont('helvetica', 'normal');
  doc.text(`${parametres.entreprise_nif || '1000278436'}`, 24, yPos);
  
  yPos += 4;
  doc.setFont('helvetica', 'bold');
  doc.text(`TEL.`, 15, yPos);
  doc.setFont('helvetica', 'normal');
  doc.text(`${parametres.entreprise_tel || '+228 22 51 66 86'} ${parametres.entreprise_cel || 'CEL. 90 11 66 86'}`, 24, yPos);
  
  yPos += 4;
  doc.text(`04BP144 LOME ADIDOGOME-TOGO`, 15, yPos);
  
  yPos += 4;
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 51, 102); // Bleu marine comme un lien
  doc.text(`E-Mail`, 15, yPos);
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'normal');
  doc.text(`${parametres.entreprise_email || 'infos_its@gmail.com'}`, 26, yPos);
  
  yPos += 4;
  doc.text(`UTB N° ${parametres.entreprise_utb || '010350245170210119'}`, 15, yPos);

  // PROFORMA au centre - DESCENDU
  yPos -= 16; // Position ajustée pour descendre le titre
  doc.setFontSize(26);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 51, 102); // Bleu marine
  doc.text('PROFORMA', pageWidth / 2, yPos, { align: 'center' });
  
  yPos += 8;
  
  // Numéro en rouge SOUS PROFORMA
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 0, 0);
  doc.text(`N° ${proforma.numero}`, pageWidth / 2, yPos, { align: 'center' });

  // Date à droite - DESCENDUE au niveau du numéro
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 0, 0);
  const dateStr = new Date(proforma.date).toLocaleDateString('fr-FR');
  doc.text(`Date:  ${dateStr}`, rightX, yPos, { align: 'right' });

  yPos += 12;

  // Section Client à droite
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 255);
  doc.text('Client', rightX - 50, yPos);
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 0, 0);
  doc.text(`Nom       :  ${proforma.client_nom}`, rightX - 50, yPos + 6);
  doc.text(`Adresse  :  ${proforma.client_adresse || ''}`, rightX - 50, yPos + 11);

  yPos += 20;

  // Objet
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(`Objet`, 15, yPos);
  doc.setFont('helvetica', 'italic');
  doc.text(`: ${proforma.objet}`, 26, yPos);

  yPos += 8;

  // Tableau des lignes
  const tableData = proforma.lignes.map((ligne, index) => [
    index + 1,
    ligne.designation,
    ligne.unite,
    ligne.quantite,
    formatNumber(ligne.prix_unitaire),
    formatNumber(ligne.montant)
  ]);

  doc.autoTable({
    startY: yPos,
    head: [['Réf', 'Désignation', 'Unité', 'Quantité', 'Prix Unitaire', 'Montant']],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: [200, 200, 200],
      textColor: [0, 0, 0],
      fontStyle: 'bold',
      fontSize: 8
    },
    bodyStyles: {
      fontSize: 8
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 70 },
      2: { cellWidth: 20, halign: 'center' },
      3: { cellWidth: 20, halign: 'center' },
      4: { cellWidth: 30, halign: 'right' },
      5: { cellWidth: 30, halign: 'right' }
    },
    margin: { left: 15, right: 15 }
  });

  yPos = doc.lastAutoTable.finalY + 5;

  // Signature à gauche
  const signatureYPos = yPos;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'italic');
  doc.text('Le Directeur,', 15, signatureYPos);
  doc.setFont('helvetica', 'bold');
  doc.text('Koffi KAVEGE', 15, signatureYPos + 15);

  // Tableau des totaux à droite
  const tauxTVA = parametres.tva_taux || 18;
  const totauxData = [
    ['TOTAL MAT HT.', formatNumber(proforma.total_materiel_ht || 0)],
    ['Prestations', formatNumber(proforma.prestations || 0)],
    ['Remise', proforma.remise > 0 ? '- ' + formatNumber(proforma.remise) : ''],
    ['TOTAL HT', formatNumber(proforma.total_ht)],
    [`TVA ${tauxTVA}%`, formatNumber(proforma.tva)],
    ['TOTAL TTC', formatNumber(proforma.total_ttc)]
  ];

  doc.autoTable({
    startY: yPos,
    body: totauxData,
    theme: 'grid',
    tableWidth: 95,
    margin: { left: pageWidth - 110 },
    styles: {
      fontSize: 9,
      cellPadding: 2,
      lineColor: [0, 0, 0],
      lineWidth: 0.5
    },
    columnStyles: {
      0: { 
        cellWidth: 50, 
        fontStyle: 'bold',
        halign: 'left'
      },
      1: { 
        cellWidth: 45, 
        halign: 'right'
      }
    },
    didParseCell: function(data) {
      // Dernière ligne en gras et avec fond jaune
      if (data.row.index === 5) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fillColor = [255, 255, 0];
      }
    }
  });

  // Pied de page avec cadre
  yPos = pageHeight - 25;
  doc.setFontSize(7);
  doc.setFont('helvetica', 'italic');
  const montantEnLettres = nombreEnLettres(proforma.total_ttc);
  const piedPage = `Arrpetée la Présente Facture Proforma à la Somme de: ${montantEnLettres} (${formatNumber(proforma.total_ttc)}) Francs CFA TTC.`;
  
  // Encadré pour le pied de page
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.5);
  doc.rect(15, yPos - 3, pageWidth - 30, 10);
  
  const splitText = doc.splitTextToSize(piedPage, pageWidth - 35);
  doc.text(splitText, 17, yPos);

  return doc;
};

// Génération PDF Facture (similaire à Proforma)
export const generateFacturePDF = async (facture, parametres) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  let yPos = 15;

  // EN-TÊTE - Titre "In-Tel Services" à gauche
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 51, 102); // Bleu marine pour "In-Tel"
  doc.text('In-Tel ', 15, yPos);
  
  // "Services" en vert
  doc.setTextColor(0, 128, 0);
  doc.text('Services', 37, yPos);

  // Encadré à droite avec les services - AGRANDI
  const rightX = pageWidth - 15;
  const boxLeft = pageWidth - 78;
  const boxTop = yPos - 7;
  doc.setDrawColor(255, 140, 0); // Orange
  doc.setLineWidth(0.8);
  doc.rect(boxLeft, boxTop, 63, 22);
  
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 0, 0);
  doc.text('Services & Intégration Réseau - Maintenance', rightX - 2, yPos - 3, { align: 'right' });
  doc.text('Télécommunication - Audit - Conseil Système', rightX - 2, yPos + 1.5, { align: 'right' });
  doc.text('de Sécurité -Vente de Matériels Informatique -', rightX - 2, yPos + 6, { align: 'right' });
  doc.text('Formation', rightX - 2, yPos + 10.5, { align: 'right' });

  yPos += 8;

  // Coordonnées sous le titre
  doc.setFontSize(7);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(0, 0, 0);
  doc.text(`20 Av. du RPT Face le Grand Collège du Plateau 04BP Lomé-TOGO`, 15, yPos);
  yPos += 3.5;
  doc.text(`Tél. (+228) 22 22 14 54 – Cel. 90 11 66 86/99 32 98 98`, 15, yPos);
  yPos += 3.5;
  doc.text(`E-Mail: infos_its@yahoo.fr`, 15, yPos);

  yPos += 6;

  // Ligne de séparation horizontale avec point bleu à droite
  doc.setDrawColor(0, 51, 102); // Bleu marine
  doc.setLineWidth(1);
  doc.line(15, yPos, pageWidth - 15, yPos);
  // Point bleu à droite de la ligne
  doc.setFillColor(0, 51, 102);
  doc.circle(pageWidth - 15, yPos, 2, 'F');

  yPos += 8;

  // Bloc d'informations administratives à gauche
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text(`RCCM :`, 15, yPos);
  doc.setFont('helvetica', 'normal');
  doc.text(`${parametres.entreprise_rccm || 'TG-LOM 2013 A 6170'}`, 28, yPos);
  
  yPos += 4;
  doc.setFont('helvetica', 'bold');
  doc.text(`NIF :`, 15, yPos);
  doc.setFont('helvetica', 'normal');
  doc.text(`${parametres.entreprise_nif || '1000278436'}`, 24, yPos);
  
  yPos += 4;
  doc.setFont('helvetica', 'bold');
  doc.text(`TEL.`, 15, yPos);
  doc.setFont('helvetica', 'normal');
  doc.text(`${parametres.entreprise_tel || '+228 22 51 66 86'} ${parametres.entreprise_cel || 'CEL. 90 11 66 86'}`, 24, yPos);
  
  yPos += 4;
  doc.text(`04BP144 LOME ADIDOGOME-TOGO`, 15, yPos);
  
  yPos += 4;
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 51, 102); // Bleu marine comme un lien
  doc.text(`E-Mail`, 15, yPos);
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'normal');
  doc.text(`${parametres.entreprise_email || 'infos_its@gmail.com'}`, 26, yPos);
  
  yPos += 4;
  doc.text(`UTB N° ${parametres.entreprise_utb || '010350245170210119'}`, 15, yPos);

  // FACTURE au centre - DESCENDU
  yPos -= 16; // Position ajustée pour descendre le titre
  doc.setFontSize(26);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 51, 102); // Bleu marine
  doc.text('FACTURE', pageWidth / 2, yPos, { align: 'center' });
  
  yPos += 8;
  
  // Numéro en rouge SOUS FACTURE
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 0, 0);
  doc.text(`N° ${facture.numero}`, pageWidth / 2, yPos, { align: 'center' });

  // Cadre carré de vignette en haut à droite (au-dessus de la date)
  const vignetteSize = 15; // Carré de 15x15mm
  const vignetteX = rightX - vignetteSize;
  const vignetteY = yPos - 15; // Descendre le carré
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.5);
  doc.rect(vignetteX, vignetteY, vignetteSize, vignetteSize);

  // Date à droite - juste en dessous du cadre
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 0, 0);
  const dateStr = new Date(facture.date).toLocaleDateString('fr-FR');
  doc.text(`Date:  ${dateStr}`, rightX, vignetteY + vignetteSize + 3, { align: 'right' });

  yPos += 12;

  // Section Client à droite
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 255);
  doc.text('Client', rightX - 50, yPos);
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 0, 0);
  doc.text(`Nom       :  ${facture.client_nom}`, rightX - 50, yPos + 6);
  doc.text(`Adresse  :  ${facture.client_adresse || ''}`, rightX - 50, yPos + 11);

  yPos += 20;

  // Objet
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(`Objet`, 15, yPos);
  doc.setFont('helvetica', 'italic');
  doc.text(`: ${facture.objet}`, 26, yPos);

  yPos += 8;

  const tableData = facture.lignes.map((ligne, index) => [
    index + 1,
    ligne.designation,
    ligne.unite,
    ligne.quantite,
    formatNumber(ligne.prix_unitaire),
    formatNumber(ligne.montant)
  ]);

  doc.autoTable({
    startY: yPos,
    head: [['Réf', 'Désignation', 'Unité', 'Quantité', 'Prix Unitaire', 'Montant']],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: [200, 200, 200],
      textColor: [0, 0, 0],
      fontStyle: 'bold',
      fontSize: 8
    },
    bodyStyles: {
      fontSize: 8
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 70 },
      2: { cellWidth: 20, halign: 'center' },
      3: { cellWidth: 20, halign: 'center' },
      4: { cellWidth: 30, halign: 'right' },
      5: { cellWidth: 30, halign: 'right' }
    },
    margin: { left: 15, right: 15 }
  });

  yPos = doc.lastAutoTable.finalY + 5;

  // Signature à gauche
  const signatureYPos = yPos;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'italic');
  doc.text('Le Directeur,', 15, signatureYPos);
  doc.setFont('helvetica', 'bold');
  doc.text('Koffi KAVEGE', 15, signatureYPos + 15);

  // Tableau des totaux à droite
  const tauxTVA = parametres.tva_taux || 18;
  const totauxData = [
    ['TOTAL MAT HT.', formatNumber(facture.total_materiel_ht || 0)],
    ['Prestations', formatNumber(facture.prestations || 0)],
    ['Remise', facture.remise > 0 ? '- ' + formatNumber(facture.remise) : ''],
    ['TOTAL HT', formatNumber(facture.total_ht)],
    [`TVA ${tauxTVA}%`, formatNumber(facture.tva)],
    ['TOTAL TTC', formatNumber(facture.total_ttc)]
  ];

  doc.autoTable({
    startY: yPos,
    body: totauxData,
    theme: 'grid',
    tableWidth: 95,
    margin: { left: pageWidth - 110 },
    styles: {
      fontSize: 9,
      cellPadding: 2,
      lineColor: [0, 0, 0],
      lineWidth: 0.5
    },
    columnStyles: {
      0: { 
        cellWidth: 50, 
        fontStyle: 'bold',
        halign: 'left'
      },
      1: { 
        cellWidth: 45, 
        halign: 'right'
      }
    },
    didParseCell: function(data) {
      // Dernière ligne en gras et avec fond jaune
      if (data.row.index === 5) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fillColor = [255, 255, 0];
      }
    }
  });

  // Pied de page avec cadre
  yPos = pageHeight - 25;
  doc.setFontSize(7);
  doc.setFont('helvetica', 'italic');
  const montantEnLettres = nombreEnLettres(facture.total_ttc);
  const piedPage = `Arrpetée la Présente Facture Proforma à la Somme de: ${montantEnLettres} (${formatNumber(facture.total_ttc)}) Francs CFA TTC.`;
  
  // Encadré pour le pied de page
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.5);
  doc.rect(15, yPos - 3, pageWidth - 30, 10);
  
  const splitText = doc.splitTextToSize(piedPage, pageWidth - 35);
  doc.text(splitText, 17, yPos);

  return doc;
};

// Génération PDF Bordereau
export const generateBordereauPDF = async (bordereau, parametres) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  let yPos = 15;

  // EN-TÊTE - Titre "In-Tel Services" à gauche
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 51, 102); // Bleu marine pour "In-Tel"
  doc.text('In-Tel ', 15, yPos);
  
  // "Services" en vert
  doc.setTextColor(0, 128, 0);
  doc.text('Services', 37, yPos);

  // Encadré à droite avec les services - AGRANDI
  const rightX = pageWidth - 15;
  const boxLeft = pageWidth - 78;
  const boxTop = yPos - 7;
  doc.setDrawColor(255, 140, 0); // Orange
  doc.setLineWidth(0.8);
  doc.rect(boxLeft, boxTop, 63, 22);
  
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 0, 0);
  doc.text('Services & Intégration Réseau - Maintenance', rightX - 2, yPos - 3, { align: 'right' });
  doc.text('Télécommunication - Audit - Conseil Système', rightX - 2, yPos + 1.5, { align: 'right' });
  doc.text('de Sécurité -Vente de Matériels Informatique -', rightX - 2, yPos + 6, { align: 'right' });
  doc.text('Formation', rightX - 2, yPos + 10.5, { align: 'right' });

  yPos += 8;

  // Coordonnées sous le titre
  doc.setFontSize(7);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(0, 0, 0);
  doc.text(`20 Av. du RPT Face le Grand Collège du Plateau 04BP Lomé-TOGO`, 15, yPos);
  yPos += 3.5;
  doc.text(`Tél. (+228) 22 22 14 54 – Cel. 90 11 66 86/99 32 98 98`, 15, yPos);
  yPos += 3.5;
  doc.text(`E-Mail: infos_its@yahoo.fr`, 15, yPos);

  yPos += 6;

  // Ligne de séparation horizontale avec point bleu à droite
  doc.setDrawColor(0, 51, 102); // Bleu marine
  doc.setLineWidth(1);
  doc.line(15, yPos, pageWidth - 15, yPos);
  // Point bleu à droite de la ligne
  doc.setFillColor(0, 51, 102);
  doc.circle(pageWidth - 15, yPos, 2, 'F');

  yPos += 8;

  // Bloc d'informations administratives à gauche
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text(`RCCM :`, 15, yPos);
  doc.setFont('helvetica', 'normal');
  doc.text(`${parametres.entreprise_rccm || 'TG-LOM 2013 A 6170'}`, 28, yPos);
  
  yPos += 4;
  doc.setFont('helvetica', 'bold');
  doc.text(`NIF :`, 15, yPos);
  doc.setFont('helvetica', 'normal');
  doc.text(`${parametres.entreprise_nif || '1000278436'}`, 24, yPos);
  
  yPos += 4;
  doc.setFont('helvetica', 'bold');
  doc.text(`TEL.`, 15, yPos);
  doc.setFont('helvetica', 'normal');
  doc.text(`${parametres.entreprise_tel || '+228 22 51 66 86'} ${parametres.entreprise_cel || 'CEL. 90 11 66 86'}`, 24, yPos);
  
  yPos += 4;
  doc.text(`04BP144 LOME ADIDOGOME-TOGO`, 15, yPos);
  
  yPos += 4;
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 51, 102); // Bleu marine comme un lien
  doc.text(`E-Mail`, 15, yPos);
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'normal');
  doc.text(`${parametres.entreprise_email || 'infos_its@gmail.com'}`, 26, yPos);
  
  yPos += 4;
  doc.text(`UTB N° ${parametres.entreprise_utb || '010350245170210119'}`, 15, yPos);

  // BORDEREAU DE LIVRAISON au centre - DESCENDU
  yPos -= 12; // Position ajustée pour descendre le titre
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 51, 102); // Bleu marine comme les autres documents
  doc.text('BORDEREAU DE LIVRAISON', pageWidth / 2, yPos, { align: 'center' });
  
  yPos += 8;
  
  // Numéro en rouge SOUS le titre
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 0, 0);
  doc.text(`N° ${bordereau.numero}`, pageWidth / 2, yPos, { align: 'center' });

  // Date à droite - DESCENDUE au niveau du numéro
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 0, 0);
  const dateStr = new Date(bordereau.date).toLocaleDateString('fr-FR');
  doc.text(`Date:  ${dateStr}`, rightX, yPos, { align: 'right' });

  yPos += 12;

  // Section Client à droite
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 255);
  doc.text('Client', rightX - 50, yPos);
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 0, 0);
  doc.text(`Nom       :  ${bordereau.client_nom}`, rightX - 50, yPos + 6);
  doc.text(`Adresse  :  ${bordereau.client_adresse || ''}`, rightX - 50, yPos + 11);

  yPos += 18;

  const tableData = bordereau.lignes.map((ligne, index) => [
    index + 1,
    ligne.designation,
    ligne.quantite
  ]);

  doc.autoTable({
    startY: yPos,
    head: [['Réf', 'Désignation', 'Quantité']],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: [200, 200, 200],
      textColor: [0, 0, 0],
      fontStyle: 'bold',
      fontSize: 8
    },
    bodyStyles: {
      fontSize: 8
    },
    columnStyles: {
      0: { cellWidth: 15, halign: 'center' },
      1: { cellWidth: 135 },
      2: { cellWidth: 25, halign: 'center' }
    },
    margin: { left: 15, right: 15 }
  });

  yPos = doc.lastAutoTable.finalY + 20;

  // Signatures avec cadres
  const sigYPos = yPos;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  
  // Cadre pour Le Fournisseur
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.5);
  doc.rect(15, sigYPos, 80, 30);
  doc.text('Le Fournisseur,', 17, sigYPos + 5);
  doc.setFont('helvetica', 'normal');
  doc.text('In-Tel Services', 17, sigYPos + 25);
  
  // Cadre pour Le Client
  doc.setFont('helvetica', 'bold');
  doc.rect(pageWidth - 95, sigYPos, 80, 30);
  doc.text('Le Client,', pageWidth - 93, sigYPos + 5);
  doc.setFont('helvetica', 'normal');
  doc.text(bordereau.client_nom, pageWidth - 93, sigYPos + 25);

  // Cadre pour le texte de propriété
  yPos = sigYPos + 40;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.5);
  doc.rect(15, yPos, pageWidth - 30, 15);
  
  const textePropriete = `ITS reste propriétaire de la marchandise livrée à compter du jour de la livraison jusqu'à complet paiement de l'intégralité de la facture.`;
  const splitText = doc.splitTextToSize(textePropriete, pageWidth - 36);
  doc.text(splitText, 17, yPos + 5);

  return doc;
};
