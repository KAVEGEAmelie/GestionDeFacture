// Régressions des migrations, remplacements de base et dépendances de paiement.
module.exports = async ({ test, h, assert, fs, path, situations, paidInvoice, count }) => {
  function makeLegacy(database) {
    database.pragma('foreign_keys = OFF');
    for (const table of ['proforma_lignes', 'facture_lignes']) {
      const sql = database.prepare('SELECT sql FROM sqlite_master WHERE name = ?').get(table).sql;
      const cols = database.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name).join(', ');
      database.exec(`ALTER TABLE ${table} RENAME TO ${table}_legacy`);
      database.exec(sql.replace('produit_id INTEGER,', 'produit_id INTEGER NOT NULL,'));
      database.exec(`INSERT INTO ${table} (${cols}) SELECT ${cols} FROM ${table}_legacy`);
      database.exec(`DROP TABLE ${table}_legacy`);
    }
    database.pragma('foreign_keys = ON');
  }
  async function snapshot(a, name = 'source.db') {
    const filePath = path.join(a.dir, name);
    a.dialogs.save = { canceled: false, filePath };
    await a.call('database:backup');
    return filePath;
  }
  const restore = (a, source) => {
    a.dialogs.open = { canceled: false, filePaths: [source] };
    return a.call('database:restore');
  };

  await test('Migration des deux tables : lignes, sections et descriptions conservées', a => {
    const f = h.fixture(a); const inv = h.facture(a, f);
    a.close();
    const legacy = new h.Database(a.dbPath);
    makeLegacy(legacy); legacy.close();
    a.init();
    for (const table of ['proforma_lignes', 'facture_lignes']) {
      const row = a.db.prepare(`SELECT * FROM ${table}`).get();
      assert.equal(row.description, 'Description détaillée');
      assert.equal(row.section_titre, 'Réseau');
      assert.equal(row.produit_id, f.produit);
      assert.equal(a.db.prepare(`PRAGMA table_info(${table})`).all().find(c => c.name === 'produit_id').notnull, 0);
    }
    assert.equal(a.call('factures:getById', inv.id).total_ttc, 129800);
    assert.equal(a.db.pragma('foreign_keys', { simple: true }), 1);
    assert.equal(a.db.pragma('foreign_key_check').length, 0);
  });
  await test('Restauration ancienne complète : migration de la copie et source préservée', async a => {
    h.facture(a, h.fixture(a));
    const source = await snapshot(a);
    const old = new h.Database(source);
    makeLegacy(old);
    old.exec('ALTER TABLE clients DROP COLUMN tva_applicable');
    old.exec('ALTER TABLE factures DROP COLUMN date_paiement');
    old.exec('ALTER TABLE facture_lignes DROP COLUMN description');
    old.close();
    const before = fs.readFileSync(source);
    a.call('clients:create', { ...h.clientData, nom: 'Après sauvegarde' });
    await restore(a, source);
    assert.equal(count(a, 'clients'), 1);
    assert.equal(a.db.prepare('PRAGMA table_info(clients)').all().some(c => c.name === 'tva_applicable'), true);
    assert.equal(a.call('factures:getAll').length, 1);
    assert.equal(a.db.prepare('SELECT section_titre FROM facture_lignes').get().section_titre, 'Réseau');
    assert.ok(fs.readFileSync(source).equals(before));
  });
  await test('Restauration : colonne obligatoire manquante rejetée sans perte', async a => {
    h.fixture(a); const source = await snapshot(a);
    const broken = new h.Database(source);
    broken.exec('ALTER TABLE produits RENAME COLUMN designation TO autre'); broken.close();
    await assert.rejects(() => restore(a, source), /produits.*designation/);
    assert.equal(count(a, 'clients'), 1); assert.equal(count(a, 'produits'), 1);
  });
  await test('Restauration : schéma facultatif incompatible rejeté après migration sur copie', async a => {
    h.fixture(a); const source = await snapshot(a);
    const broken = new h.Database(source); broken.exec('ALTER TABLE rapports DROP COLUMN titre'); broken.close();
    const before = fs.readFileSync(source);
    await assert.rejects(() => restore(a, source), /rapports.*titre/);
    assert.equal(count(a, 'clients'), 1);
    assert.ok(fs.readFileSync(source).equals(before));
  });
  await test('Restauration : références invalides rejetées sans remplacer la base', async a => {
    h.fixture(a); const source = await snapshot(a);
    const broken = new h.Database(source); broken.pragma('foreign_keys = OFF');
    broken.prepare("INSERT INTO proformas(numero,date,client_id,total_ht,tva,total_ttc) VALUES ('INVALIDE','2026-10-18',99999,1,0,1)").run();
    broken.close();
    await assert.rejects(() => restore(a, source), /références/);
    assert.equal(count(a, 'proformas'), 0); assert.equal(count(a, 'clients'), 1);
  });
  await test('Restauration : journal WAL inclus dans la copie', async a => {
    const source = h.createApp();
    try {
      source.db.pragma('journal_mode = WAL');
      source.db.pragma('wal_autocheckpoint = 0');
      source.call('clients:create', { ...h.clientData, nom: 'Client présent dans WAL' });
      assert.ok(fs.existsSync(source.dbPath + '-wal'));
      await restore(a, source.dbPath);
      assert.equal(a.call('clients:getAll')[0].nom, 'Client présent dans WAL');
    } finally { source.close(); }
  });
  await test('Restauration : échec du remplacement restaure la connexion et les données', async () => {
    const a = h.createApp({ fs: {
      renameSync(source, target) {
        if (source.endsWith('validated.db')) throw new Error('Déplacement interrompu pour le test');
        return fs.renameSync(source, target);
      },
    } });
    try {
      h.fixture(a); const source = await snapshot(a);
      a.call('clients:create', { ...h.clientData, nom: 'À conserver' });
      await assert.rejects(() => restore(a, source), /base précédente a été conservée/);
      assert.equal(count(a, 'clients'), 2);
      assert.ok(a.call('clients:getAll').some(c => c.nom === 'À conserver'));
      assert.equal(a.db.pragma('integrity_check', { simple: true }), 'ok');
    } finally { a.close(); }
  });
  await test('Conversion par bordereau : seconde facture refusée sans document partiel', a => {
    const p = h.proforma(a, h.fixture(a));
    a.call('factures:createFromProforma', p.id);
    const before = a.call('parametres:getAll');
    assert.throws(() => a.call('bordereaux:createFromProforma', p.id, true), /déjà/);
    assert.equal(count(a, 'factures'), 1); assert.equal(count(a, 'bordereaux'), 0);
    assert.equal(a.call('parametres:getAll').bordereau_compteur, before.bordereau_compteur);
  });
  await test('Conversion via bordereau puis conversion directe : doublon refusé', a => {
    const p = h.proforma(a, h.fixture(a)); a.call('bordereaux:createFromProforma', p.id, true);
    assert.throws(() => a.call('factures:createFromProforma', p.id), /déjà/);
    assert.equal(count(a, 'factures'), 1);
    a.call('bordereaux:createFromProforma', p.id, false);
    assert.equal(count(a, 'bordereaux'), 2);
  });
  await test('Conversion : facture existante retrouvée même si les marqueurs sont périmés', a => {
    const p = h.proforma(a, h.fixture(a)); a.call('factures:createFromProforma', p.id);
    a.db.prepare("UPDATE proformas SET statut = 'en_attente', facture_id = NULL WHERE id = ?").run(p.id);
    assert.throws(() => a.call('factures:createFromProforma', p.id), /déjà/);
    assert.equal(count(a, 'factures'), 1);
  });
  await test('Paiement global : annulation bloquée dès le lot OTR en cours', a => {
    const inv = paidInvoice(a); const lot = a.call('tva:verser', [inv.id]);
    assert.throws(() => a.call('factures:markUnpaid', inv.id), /OTR/);
    assert.equal(a.call('factures:getById', inv.id).statut_paiement, 'payee');
    a.call('tva:annulerVersement', lot.id); a.call('factures:markUnpaid', inv.id);
    assert.equal(a.call('factures:getById', inv.id).statut_paiement, 'non_payee');
  });
  await test('Situations : lot OTR en cours protège annulation et suppression', a => {
    const { inv, s95, s5 } = situations(a); a.call('factureSituations:markPaid', s95.id);
    const lot = a.call('tva:verser', [inv.id]);
    assert.throws(() => a.call('factureSituations:markUnpaid', s95.id), /OTR/);
    assert.throws(() => a.call('factureSituations:delete', s5.id), /OTR/);
    assert.equal(a.call('factureSituations:getByFacture', inv.id).length, 2);
    a.call('tva:annulerVersement', lot.id); a.call('factureSituations:markUnpaid', s95.id);
    assert.equal(a.call('factures:getById', inv.id).tva_declenchee, 0);
  });
  await test('Suppression facture : possible après annulation contrôlée du lot', a => {
    const inv = paidInvoice(a); const lot = a.call('tva:verser', [inv.id]);
    assert.throws(() => a.call('factures:delete', inv.id), /OTR/);
    a.call('tva:annulerVersement', lot.id); a.call('factures:delete', inv.id);
    assert.equal(count(a, 'factures'), 0); assert.equal(count(a, 'tva_versement_factures'), 0);
  });
  await test('Annulation du solde : date partielle et TVA de première tranche conservées', a => {
    const { inv, s95, s5 } = situations(a);
    a.call('factureSituations:markPaid', s95.id, '2026-10-10');
    a.call('factureSituations:markPaid', s5.id, '2026-10-15');
    a.call('factureSituations:markUnpaid', s5.id);
    const parent = a.call('factures:getById', inv.id);
    assert.equal(parent.statut_paiement, 'non_payee'); assert.equal(parent.date_paiement, '2026-10-10');
    assert.equal(parent.tva_declenchee, 1);
    assert.equal(a.call('tva:getStats').aVerser[0].tva_a_verser, 9900);
    a.call('factureSituations:markUnpaid', s95.id);
    assert.equal(a.call('factures:getById', inv.id).date_paiement, null);
    assert.equal(a.call('tva:getStats').aVerser.length, 0);
  });
  await test('Paiements saisis dans le désordre : date finale la plus récente', a => {
    const { inv, s95, s5 } = situations(a);
    a.call('factureSituations:markPaid', s5.id, '2026-10-15');
    a.call('factureSituations:markPaid', s95.id, '2026-10-10');
    const parent = a.call('factures:getById', inv.id);
    assert.equal(parent.statut_paiement, 'payee'); assert.equal(parent.date_paiement, '2026-10-15');
  });
  await test('Suppression tranche payée : refus puis annulation et suppression explicites', a => {
    const { inv, s95, s5 } = situations(a);
    a.call('factureSituations:markPaid', s95.id); a.call('factureSituations:markPaid', s5.id);
    assert.throws(() => a.call('factureSituations:delete', s5.id), /Annulez.*paiement/);
    assert.equal(a.call('factureSituations:getByFacture', inv.id).length, 2);
    a.call('factureSituations:markUnpaid', s5.id); a.call('factureSituations:delete', s5.id);
    assert.equal(a.call('factures:getById', inv.id).statut_paiement, 'non_payee');
    const [remaining] = a.call('factureSituations:getByFacture', inv.id);
    assert.equal(remaining.montant_ttc, 123310); assert.equal(remaining.tva, 19800);
  });
  await test('Suppression première tranche non payée : TVA réaffectée à la suivante', a => {
    const { inv, s95 } = situations(a); a.call('factureSituations:delete', s95.id);
    const [remaining] = a.call('factureSituations:getByFacture', inv.id);
    assert.equal(remaining.montant_ttc, 6490); assert.equal(remaining.tva, 6490);
    assert.equal(remaining.montant_ht, 0);
  });
  await test('Recalcul affectant une tranche payée : suppression annulée intégralement', a => {
    const { inv, s95, s5 } = situations(a); a.call('factureSituations:markPaid', s5.id);
    const before = JSON.stringify(a.call('factureSituations:getByFacture', inv.id));
    assert.throws(() => a.call('factureSituations:delete', s95.id), /Annulez.*paiement/);
    assert.equal(JSON.stringify(a.call('factureSituations:getByFacture', inv.id)), before);
  });
  await test('Suppression et recréation du solde : cumul exact sans écart', a => {
    const { inv, s5 } = situations(a); a.call('factureSituations:delete', s5.id);
    a.call('factureSituations:create', inv.id, 5);
    const rows = a.call('factureSituations:getByFacture', inv.id);
    assert.equal(rows.reduce((sum, row) => sum + row.montant_ttc, 0), 129800);
    assert.equal(rows.reduce((sum, row) => sum + row.tva, 0), 19800);
    rows.forEach(row => assert.equal(row.montant_ht + row.tva, row.montant_ttc));
  });
  await test('Suppression de toutes les situations : facture non payée et TVA retirée', a => {
    const { inv, s95, s5 } = situations(a);
    a.call('factureSituations:markPaid', s95.id); a.call('factureSituations:markUnpaid', s95.id);
    a.call('factureSituations:delete', s95.id); a.call('factureSituations:delete', s5.id);
    const parent = a.call('factures:getById', inv.id);
    assert.equal(parent.statut_paiement, 'non_payee'); assert.equal(parent.date_paiement, null); assert.equal(parent.tva_declenchee, 0);
  });
  await test('Mode prorata : montants et arrondis conservés lors des suppressions', a => {
    const inv = h.facture(a, h.fixture(a), { total_ht: 101, tva: 18, total_ttc: 119 });
    const first = a.call('factureSituations:create', inv.id, 33.33, 'prorata');
    a.call('factureSituations:create', inv.id, 33.33); a.call('factureSituations:create', inv.id, 33.34);
    const before = a.call('factureSituations:getByFacture', inv.id);
    assert.equal(before.reduce((sum, row) => sum + row.montant_ttc, 0), 119);
    assert.equal(before.reduce((sum, row) => sum + row.tva_a_verser, 0), 9);
    a.call('factureSituations:delete', first.id);
    const after = a.call('factureSituations:getByFacture', inv.id);
    assert.equal(after[1].montant_ttc, 40);
    after.forEach(row => assert.equal(row.montant_ht + row.tva, row.montant_ttc));
  });
  await test('Conversions demandées simultanément : une seule facture', async a => {
    const p = h.proforma(a, h.fixture(a));
    const results = await Promise.allSettled([
      a.api.factures.createFromProforma(p.id), a.api.factures.createFromProforma(p.id),
    ]);
    assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
    assert.equal(count(a, 'factures'), 1);
    assert.equal(a.call('parametres:getAll').facture_compteur, '1');
  });
  await test('Paiement global existant : pas de création de situations sans annulation', a => {
    const inv = paidInvoice(a);
    assert.throws(() => a.call('factureSituations:create', inv.id, 95), /Annulez.*paiement global/);
    assert.equal(count(a, 'facture_situations'), 0);
  });
  await test('Suppression facture : pas de contournement de la protection des tranches payées', a => {
    const { inv, s95 } = situations(a); a.call('factureSituations:markPaid', s95.id);
    assert.throws(() => a.call('factures:delete', inv.id), /Annulez.*paiement/);
    assert.equal(count(a, 'factures'), 1); assert.equal(count(a, 'facture_situations'), 2);
  });
  await test('Lot lié directement à une situation : parent et situation protégés', a => {
    const { inv, s95 } = situations(a); a.call('factureSituations:markPaid', s95.id);
    const lot = a.db.prepare("INSERT INTO tva_versements(numero,total_du) VALUES ('VT-SITUATION',9900)").run();
    a.db.prepare('INSERT INTO tva_versement_situations(versement_id,situation_id) VALUES (?,?)').run(lot.lastInsertRowid, s95.id);
    assert.throws(() => a.call('factureSituations:markUnpaid', s95.id), /OTR/);
    assert.throws(() => a.call('factures:delete', inv.id), /OTR/);
  });
  await test('TVA de situation déjà versée sans lot : annulation bloquée', a => {
    const { s95 } = situations(a); a.call('factureSituations:markPaid', s95.id);
    a.db.prepare('UPDATE facture_situations SET tva_versee = 1 WHERE id = ?').run(s95.id);
    assert.throws(() => a.call('factureSituations:markUnpaid', s95.id), /TVA/);
  });
};
