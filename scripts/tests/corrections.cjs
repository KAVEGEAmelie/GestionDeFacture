// Scénarios des corrections de novembre 2026 : totaux recalculés et arrondis
// côté serveur, taux de TVA figé par document, modification des factures
// protégée, liens bordereau ↔ facture, numérotation sans réutilisation,
// limitation des essais de mot de passe.
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

  await test('Mot de passe : blocage temporaire après 5 échecs', a => {
    a.call('security:setPassword', { newPassword: 'abcd1234' });
    for (let i = 0; i < 5; i += 1) assert.throws(() => a.call('security:verify', 'faux'), /incorrect/);
    assert.throws(() => a.call('security:verify', 'abcd1234'), /Trop de tentatives/);
  });
};
