// Scénarios des corrections de novembre 2026 : totaux recalculés et arrondis
// côté serveur, taux de TVA figé par document, modification des factures
// protégée, liens bordereau ↔ facture, numérotation sans réutilisation,
// limitation des essais de mot de passe.
const fs = require('fs');
const path = require('path');

module.exports = async ({ test, h, assert, paidInvoice, count }) => {
  const ligne = (prix, quantite = 1) => ({ produit_id: null, designation: 'Ligne', unite: 'Unité', quantite, prix_unitaire: prix, montant: prix * quantite });

  await test('Totaux : recalculés par le serveur et arrondis au franc', a => {
    const p = h.proforma(a, h.fixture(a), {
      prestations: 0.4, remise: 0, total_materiel_ht: 1, total_ht: 1, tva: 0, total_ttc: 1,
      lignes: [ligne(334.33, 3)]
    });
    const full = a.call('proformas:getById', p.id);
    assert.equal(full.lignes[0].montant, 1003);
    assert.equal(full.total_materiel_ht, 1003);
    assert.equal(full.prestations, 0);
    assert.equal(full.total_ht, 1003);
    assert.equal(full.tva, 181);
    assert.equal(full.total_ttc, 1184);
    assert.equal(full.tva_taux, 18);
  });

  await test('Totaux : taux de TVA à 0 % respecté', a => {
    a.call('parametres:update', 'tva_taux', '0');
    const full = a.call('proformas:getById', h.proforma(a, h.fixture(a)).id);
    assert.equal(full.tva, 0); assert.equal(full.total_ttc, full.total_ht); assert.equal(full.tva_taux, 0);
  });

  await test('Totaux : remise supérieure au total et quantité négative refusées', a => {
    const f = h.fixture(a);
    assert.throws(() => h.proforma(a, f, { prestations: 0, remise: 200000 }), /remise/i);
    assert.throws(() => h.proforma(a, f, { lignes: [ligne(1000, -1)] }), /Quantité/);
    assert.throws(() => h.proforma(a, f, { lignes: undefined }), /Lignes/);
    assert.equal(count(a, 'proformas'), 0);
  });

  await test('Facture : modification refusée si payée ou engagée à l’OTR', a => {
    const inv = paidInvoice(a);
    const full = a.call('factures:getById', inv.id);
    assert.throws(() => a.call('factures:update', inv.id, { ...full, objet: 'Modifiée' }), /payée/);
    a.call('tva:verser', [inv.id]);
    a.db.prepare("UPDATE factures SET statut_paiement = 'non_payee' WHERE id = ?").run(inv.id);
    assert.throws(() => a.call('factures:update', inv.id, { ...full, objet: 'Modifiée' }), /OTR/);
    assert.equal(a.call('factures:getById', inv.id).objet, full.objet);
  });

  await test('Facture : taux figé à l’émission malgré un changement de paramètre', a => {
    const inv = h.facture(a, h.fixture(a));
    a.call('parametres:update', 'tva_taux', '20');
    const full = a.call('factures:getById', inv.id);
    a.call('factures:update', inv.id, { ...full, lignes: [ligne(200000)] });
    const apres = a.call('factures:getById', inv.id);
    assert.equal(apres.tva_taux, 18); assert.equal(apres.total_ht, 210000); assert.equal(apres.tva, 37800);
  });

  await test('Facture : modification recalcule les situations non payées', a => {
    const inv = h.facture(a, h.fixture(a));
    a.call('factureSituations:create', inv.id, 95); a.call('factureSituations:create', inv.id, 5);
    const full = a.call('factures:getById', inv.id);
    a.call('factures:update', inv.id, { ...full, prestations: 0, lignes: [ligne(200000)] });
    const situations = a.call('factureSituations:getByFacture', inv.id);
    assert.equal(situations.reduce((s, x) => s + x.montant_ttc, 0), 236000);
  });

  await test('Facture : modification refusée si elle change une situation payée', a => {
    const inv = h.facture(a, h.fixture(a));
    const s95 = a.call('factureSituations:create', inv.id, 95);
    a.call('factureSituations:markPaid', s95.id, '2026-10-20');
    const full = a.call('factures:getById', inv.id);
    assert.throws(() => a.call('factures:update', inv.id, { ...full, lignes: [ligne(200000)] }), /situations/);
    assert.equal(a.call('factures:getById', inv.id).total_ttc, 129800);
  });

  await test('Bordereaux multiples : la facture reste liée au bordereau restant', a => {
    const p = h.proforma(a, h.fixture(a));
    const premier = a.call('bordereaux:createFromProforma', p.id, true);
    const second = a.call('bordereaux:createFromProforma', p.id, false);
    a.call('bordereaux:delete', premier.bordereauId);
    assert.equal(a.call('factures:getById', premier.factureId).bordereau_id, second.bordereauId);
    a.call('bordereaux:delete', second.bordereauId);
    assert.equal(a.call('factures:getById', premier.factureId).bordereau_id, null);
    a.call('factures:delete', premier.factureId);
  });

  await test('Numérotation ASF et VT : numéro supprimé jamais réattribué', a => {
    const data = { client_nom: 'Client', travaux: [] };
    a.call('attestations:create', data); const deux = a.call('attestations:create', data);
    a.call('attestations:delete', deux.id);
    assert.equal(a.call('attestations:create', data).numero, 'ASF-0003');
    const lot = a.call('tva:verser', [paidInvoice(a).id]);
    assert.equal(lot.numero, 'VT-0001');
    a.call('tva:annulerVersement', lot.id);
    assert.equal(a.call('tva:verser', [a.call('factures:getAll')[0].id]).numero, 'VT-0002');
  });

  await test('Intervention : plusieurs services conservés, ancienne fiche lisible', a => {
    const services = ['Urgences', 'Pédiatrie', 'Radiologie'];
    const { id } = a.call('interventions:create', {
      date: '2026-11-20', client_nom: 'Hôpital', client_adresse: services.join(', '), details: { modele: 'simplifie', services }
    });
    const fiche = a.call('interventions:getById', id);
    assert.equal(JSON.stringify(fiche.services), JSON.stringify(services)); assert.equal(fiche.client_adresse, 'Urgences, Pédiatrie, Radiologie');
    const ancienne = a.call('interventions:create', { date: '2026-11-20', client_nom: 'Hôpital', client_adresse: 'Maternité', details: { modele: 'simplifie' } });
    const lue = a.call('interventions:getById', ancienne.id);
    assert.equal(lue.services, undefined); assert.equal(lue.client_adresse, 'Maternité');
  });

  await test('Avoir total : reprend la facture et la verrouille', a => {
    const inv = h.facture(a, h.fixture(a));
    const av = a.call('avoirs:create', inv.id, { type: 'total', date: '2026-10-20', motif: 'Erreur de client' });
    assert.equal(av.numero, 'AV-2026/00001-ITS');
    const full = a.call('avoirs:getById', av.id);
    assert.equal(full.total_ttc, 129800); assert.equal(full.prestations, 10000); assert.equal(full.lignes.length, 1);
    assert.equal(full.facture_numero, inv.numero); assert.equal(full.tva_taux, 18);
    assert.equal(a.call('factures:getAll')[0].total_avoirs, 129800);
    assert.throws(() => a.call('avoirs:create', inv.id, { type: 'total', motif: 'Encore' }), /partiel/);
    assert.throws(() => a.call('avoirs:create', inv.id, { type: 'partiel', motif: 'Encore', lignes: [ligne(1000)] }), /reste/);
    const facture = a.call('factures:getById', inv.id);
    assert.throws(() => a.call('factures:update', inv.id, { ...facture, objet: 'X' }), /avoirs/);
    assert.throws(() => a.call('factures:delete', inv.id), /avoirs/);
    assert.throws(() => a.call('factures:markPaid', inv.id, '2026-10-21'), /annulée par avoir/);
    assert.throws(() => a.call('factureSituations:create', inv.id, 50), /avoirs/);
    assert.equal(a.call('stats:getDashboard').caTotal, 0);
    a.call('avoirs:delete', av.id);
    a.call('factures:delete', inv.id);
  });

  await test('Avoir partiel : montants recalculés et plafonnés au reste de la facture', a => {
    const inv = h.facture(a, h.fixture(a));
    const av = a.call('avoirs:create', inv.id, { type: 'partiel', date: '2026-10-20', motif: 'Remise accordée', lignes: [ligne(50000), ligne(0)] });
    const full = a.call('avoirs:getById', av.id);
    assert.equal(full.total_ht, 50000); assert.equal(full.tva, 9000); assert.equal(full.total_ttc, 59000); assert.equal(full.lignes.length, 1);
    assert.throws(() => a.call('avoirs:create', inv.id, { type: 'partiel', motif: 'Trop', lignes: [ligne(61000)] }), /reste que 70800/);
    assert.equal(a.call('stats:getDashboard').caTotal, 129800 - 59000);
    assert.equal(a.call('tva:getStats').tvaAvoirs, 9000);
    a.call('factures:markPaid', inv.id, '2026-10-21');
  });

  await test('Avoir : motif obligatoire et date postérieure à la facture', a => {
    const inv = h.facture(a, h.fixture(a));
    assert.throws(() => a.call('avoirs:create', inv.id, { type: 'total', date: '2026-10-20', motif: ' ' }), /motif/);
    assert.throws(() => a.call('avoirs:create', inv.id, { type: 'total', date: '2026-10-01', motif: 'Erreur' }), /avant la facture/);
    assert.equal(count(a, 'avoirs'), 0);
  });

  await test('Second dossier de sauvegarde : choix, état et copie à la fermeture', async a => {
    h.fixture(a);
    a.dialogs.open = { canceled: false, filePaths: [a.documents] };
    await assert.rejects(() => a.call('database:choisirDossierSauvegarde'), /autre dossier/);
    const usb = path.join(a.dir, 'cle-usb'); fs.mkdirSync(usb);
    a.dialogs.open = { canceled: false, filePaths: [usb] };
    assert.equal((await a.call('database:choisirDossierSauvegarde')).dossier, usb);
    const cible = path.join(usb, 'GestionFacturation-Backups');
    assert.ok(fs.existsSync(path.join(cible, 'facturation-autosave.db')));
    const statut = a.call('database:getStatutSauvegarde');
    assert.equal(statut.secondaire.dossier, cible); assert.equal(statut.secondaire.accessible, true); assert.ok(statut.secondaire.derniere);
    a.close(); a.autoBackup(cible);
    const principal = path.join(a.documents, 'GestionFacturation-Backups');
    assert.equal(fs.readdirSync(principal).filter((f) => f.startsWith('facturation-backup-')).length, 1);
    assert.equal(fs.readdirSync(cible).filter((f) => f.startsWith('facturation-backup-')).length, 1);
    // Second dossier inaccessible : la sauvegarde principale se fait quand même
    const bloque = path.join(a.dir, 'fichier'); fs.writeFileSync(bloque, '');
    fs.rmSync(principal, { recursive: true });
    a.autoBackup(path.join(bloque, 'GestionFacturation-Backups'));
    assert.equal(fs.readdirSync(principal).length, 1);
  });

  await test('Second dossier de sauvegarde : retrait', async a => {
    const usb = path.join(a.dir, 'cle-usb'); fs.mkdirSync(usb);
    a.dialogs.open = { canceled: false, filePaths: [usb] };
    await a.call('database:choisirDossierSauvegarde');
    a.call('database:retirerDossierSauvegarde');
    assert.equal(a.call('database:getStatutSauvegarde').secondaire, null);
  });

  await test('Mot de passe : blocage temporaire après 5 échecs', a => {
    a.call('security:setPassword', { newPassword: 'abcd1234' });
    for (let i = 0; i < 5; i += 1) assert.throws(() => a.call('security:verify', 'faux'), /incorrect/);
    assert.throws(() => a.call('security:verify', 'abcd1234'), /Trop de tentatives/);
  });
};
