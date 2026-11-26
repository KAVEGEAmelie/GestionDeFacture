/**
 * Génère le document commercial OFFRE_COMMERCIALE.pdf
 * Usage : node scripts/generate-offre-pdf.js
 */

const { jsPDF } = require('jspdf');
const path = require('path');

const NAVY = [15, 37, 87];
const NAVY_SOFT = [30, 58, 138];
const INK = [30, 41, 59];
const GREY = [100, 116, 139];
const RED = [214, 30, 24];
const BOX_BG = [241, 245, 249];
const WHITE = [255, 255, 255];

const doc = new jsPDF();
const pageWidth = doc.internal.pageSize.getWidth();
const pageHeight = doc.internal.pageSize.getHeight();
const M = 16; // marge
const W = pageWidth - M * 2;
let y = 0;

const setColor = (c) => doc.setTextColor(c[0], c[1], c[2]);

function newPage() {
  doc.addPage();
  drawFrame();
  y = M + 6;
}

function ensure(h) {
  if (y + h > pageHeight - 22) newPage();
}

function drawFrame() {
  doc.setDrawColor(NAVY[0], NAVY[1], NAVY[2]);
  doc.setLineWidth(0.6);
  doc.rect(8, 8, pageWidth - 16, pageHeight - 16, 'S');
}

function sectionTitle(txt) {
  ensure(16);
  y += 4;
  doc.setFillColor(NAVY[0], NAVY[1], NAVY[2]);
  doc.roundedRect(M, y - 5.5, W, 9, 1.5, 1.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  setColor(WHITE);
  doc.text(txt, M + 4, y + 0.5);
  y += 9;
}

function subTitle(txt) {
  ensure(10);
  y += 2;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  setColor(NAVY_SOFT);
  doc.text(txt, M + 2, y);
  y += 6;
}

function bullet(txt, bold = false) {
  doc.setFont('helvetica', bold ? 'bold' : 'normal');
  doc.setFontSize(9.5);
  setColor(INK);
  const lines = doc.splitTextToSize(txt, W - 12);
  ensure(lines.length * 4.8 + 1);
  doc.setFillColor(NAVY[0], NAVY[1], NAVY[2]);
  doc.circle(M + 5, y - 1.2, 0.8, 'F');
  doc.text(lines, M + 9, y);
  y += lines.length * 4.8 + 1;
}

function paragraph(txt, opts = {}) {
  doc.setFont('helvetica', opts.bold ? 'bold' : 'normal');
  doc.setFontSize(opts.size || 9.5);
  setColor(opts.color || INK);
  const lines = doc.splitTextToSize(txt, W - 4);
  ensure(lines.length * 5 + 2);
  doc.text(lines, opts.center ? pageWidth / 2 : M + 2, y, opts.center ? { align: 'center' } : {});
  y += lines.length * 5 + 2;
}

// ═════════ PAGE 1 ═════════
drawFrame();

// En-tête entreprise
doc.setFillColor(NAVY[0], NAVY[1], NAVY[2]);
doc.rect(8, 8, pageWidth - 16, 34, 'F');
doc.setFont('helvetica', 'bold');
doc.setFontSize(20);
setColor(WHITE);
doc.text('INTEGRAL SYSTEM', pageWidth / 2, 22, { align: 'center' });
doc.setFont('helvetica', 'normal');
doc.setFontSize(9);
doc.text('Développement de logiciels  •  Solutions de gestion pour entreprises', pageWidth / 2, 29, { align: 'center' });
doc.setFontSize(8.5);
doc.text('Tél : +228 92 23 60 69   |   Email : ameliekavege8@gmail.com   |   Lomé - TOGO', pageWidth / 2, 36, { align: 'center' });

y = 54;

// Titre du document
doc.setFont('helvetica', 'bold');
doc.setFontSize(17);
setColor(NAVY);
doc.text('OFFRE COMMERCIALE', pageWidth / 2, y, { align: 'center' });
y += 7;
doc.setFontSize(13);
setColor(RED);
doc.text('LOGICIEL « GESTION FACTURATION »', pageWidth / 2, y, { align: 'center' });
y += 5;
doc.setDrawColor(NAVY[0], NAVY[1], NAVY[2]);
doc.setLineWidth(0.7);
doc.line(pageWidth / 2 - 45, y, pageWidth / 2 + 45, y);
y += 9;

paragraph(
  "Gestion Facturation est une application professionnelle installée sur votre ordinateur, qui fonctionne 100 % hors ligne (aucune connexion Internet nécessaire). Elle centralise toute votre activité commerciale : clients, produits, proformas, factures, bordereaux de livraison, suivi de la TVA à reverser à l'OTR, attestations et rapports — le tout en conformité avec les usages togolais (TVA 18 %, FCFA, montants en lettres).",
  { size: 10 }
);

paragraph(
  "Pourquoi investir dans Gestion Facturation ? Fini les factures Word/Excel sources d'erreurs : vos documents sont numérotés automatiquement, calculés sans erreur, imprimés à vos couleurs en quelques secondes. Vous gagnez du temps, vous renvoyez une image professionnelle à vos clients, vous savez à tout moment qui vous doit de l'argent et combien de TVA reverser à l'OTR. Vos données restent chez vous, en sécurité, même sans Internet.",
  { size: 10 }
);

sectionTitle('TOUT CE QUI EST INCLUS DANS VOTRE LICENCE');

subTitle('Gestion commerciale complète');
bullet('Clients : fiches complètes (NIF, adresse, contacts), recherche rapide');
bullet('Produits & services : catalogue avec prix, unités personnalisables, anti-doublons');
bullet('Factures proforma : création rapide, numérotation automatique, TVA optionnelle par client');
bullet('Factures définitives : conversion automatique depuis la proforma, suivi des paiements');
bullet('Bordereaux de livraison : depuis une proforma/facture ou créés librement ; regroupement de plusieurs bordereaux en une proforma');
bullet('Attestations de service fait et rapports techniques personnalisables');

subTitle('Suivi TVA / OTR intégré');
bullet('Calcul automatique de la TVA (18 % ou taux personnalisé)');
bullet('Suivi des TVA à reverser à l\'OTR et des TVA déjà versées (annulation possible)');
bullet('Rapports TVA exportables en PDF et Excel');

subTitle('Documents PDF professionnels');
bullet('En-tête à VOS couleurs : logo, slogans, RCCM, NIF, coordonnées');
bullet('Montants en lettres automatiques (conformité administrative)');
bullet('Cachet et signature scannés intégrables — impression directe ou export PDF');

subTitle('Tableau de bord & sécurité');
bullet('Chiffre d\'affaires, factures impayées, statistiques en temps réel');
bullet('Mot de passe d\'accès — données stockées uniquement sur VOTRE ordinateur');
bullet('Sauvegarde et restauration de vos données en un clic');

subTitle('Services inclus à l\'achat');
bullet('Installation sur votre ordinateur', true);
bullet('Personnalisation complète : logo, nom, slogans, RCCM/NIF, signature/cachet, compteurs', true);
bullet('Formation à l\'utilisation + assistance au démarrage (téléphone/WhatsApp)', true);

// ═════════ TARIFS ═════════
sectionTitle('TARIFS');

ensure(34);
// Tableau tarifs
const rowH = 11;
doc.setDrawColor(NAVY[0], NAVY[1], NAVY[2]);
doc.setLineWidth(0.3);

// Ligne 1
doc.setFillColor(BOX_BG[0], BOX_BG[1], BOX_BG[2]);
doc.rect(M, y - 4, W - 48, rowH, 'FD');
doc.rect(M + W - 48, y - 4, 48, rowH, 'FD');
doc.setFont('helvetica', 'bold');
doc.setFontSize(10);
setColor(INK);
doc.text('Licence Gestion Facturation (tout inclus ci-dessus)', M + 3, y + 2.5);
setColor(NAVY);
doc.setFontSize(12);
doc.text('200 000 FCFA', M + W - 24, y + 2.5, { align: 'center' });
y += rowH;

// Ligne 2
doc.setFillColor(255, 255, 255);
doc.rect(M, y - 4, W - 48, rowH, 'FD');
doc.rect(M + W - 48, y - 4, 48, rowH, 'FD');
doc.setFont('helvetica', 'normal');
doc.setFontSize(10);
setColor(INK);
doc.text('Modification ou ajout personnalisé (par demande)', M + 3, y + 2.5);
doc.setFont('helvetica', 'bold');
setColor(NAVY);
doc.setFontSize(12);
doc.text('10 000 FCFA', M + W - 24, y + 2.5, { align: 'center' });
y += rowH + 3;

paragraph('Les prix sont fixes et NON NÉGOCIABLES.', { bold: true, color: RED, size: 10.5, center: true });

paragraph(
  'Exemples de modifications personnalisées (10 000 FCFA / demande) : champ spécifique sur vos factures, présentation d\'un document PDF, type de rapport particulier, texte ou mention légale. Les demandes de grande ampleur (nouveau module complet) font l\'objet d\'un devis séparé.',
  { size: 9, color: GREY }
);

// ═════════ CONDITIONS ═════════
sectionTitle('CONDITIONS DE LICENCE');
bullet('Essai gratuit de 18 jours : testez toutes les fonctionnalités sans engagement');
bullet('Licence valable à vie, pour un (1) ordinateur');
bullet('Activation liée à votre machine : communiquez-nous l\'identifiant affiché dans l\'application, vous recevez votre code d\'activation immédiatement après paiement');
bullet('En cas de changement d\'ordinateur ou de panne, contactez-nous pour le transfert de votre licence');

// ═════════ COMMANDER ═════════
sectionTitle('POUR COMMANDER');
bullet('1. Contactez INTEGRAL SYSTEM au +228 92 23 60 69 ou par email : ameliekavege8@gmail.com', true);
bullet('2. Nous installons et personnalisons l\'application chez vous');
bullet('3. Vous profitez de vos 18 jours d\'essai gratuit');
bullet('4. Après paiement, votre licence est activée définitivement');

// Pied de page sur toutes les pages
const totalPages = doc.internal.getNumberOfPages();
for (let p = 1; p <= totalPages; p++) {
  doc.setPage(p);
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  setColor(GREY);
  doc.text(
    'INTEGRAL SYSTEM — Des logiciels sur mesure pour la gestion de votre entreprise.',
    pageWidth / 2,
    pageHeight - 12,
    { align: 'center' }
  );
}

const outPath = path.join(__dirname, '..', 'OFFRE_COMMERCIALE.pdf');
require('fs').writeFileSync(outPath, Buffer.from(doc.output('arraybuffer')));
console.log(`✅ PDF généré : ${outPath}`);
