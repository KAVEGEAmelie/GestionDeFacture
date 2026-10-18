const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const h = require('./harness.cjs');
const results = [];
async function test(name, fn) {
  let a;
  try { a = h.createApp(); await fn(a); results.push({ name, status: 'PASS' }); console.log('PASS', name); }
  catch(e) { results.push({ name, status: 'FAIL', error: e.message, stack: e.stack }); console.log('FAIL', name, '—', e.message.split('\n')[0]); }
  finally { a?.close(); }
}
const count = (a,t) => a.db.prepare(`SELECT COUNT(*) n FROM ${t}`).get().n;
function paidInvoice(a) { const i=h.facture(a,h.fixture(a)); a.call('factures:markPaid',i.id,'2026-10-17'); return i; }
function situations(a) { const inv=h.facture(a,h.fixture(a)); return {inv,s95:a.call('factureSituations:create',inv.id,95),s5:a.call('factureSituations:create',inv.id,5)}; }
async function main() {
  await test('Initialisation : schéma, intégrité et clés étrangères', a=>{
    assert.equal(a.db.pragma('integrity_check',{simple:true}),'ok'); assert.equal(a.db.pragma('foreign_keys',{simple:true}),1);
    assert.equal(a.call('parametres:getAll').tva_taux,'18'); assert.equal(a.handlers.size,76);
  });
  await test('Clients : création, modification et suppression',a=>{
    const {id}=a.call('clients:create',h.clientData); a.call('clients:update',id,{...h.clientData,nom:'Client modifié'});
    assert.equal(a.call('clients:getById',id).nom,'Client modifié'); a.call('clients:delete',id); assert.equal(count(a,'clients'),0);
  });
  await test('Produits : création, modification et suppression',a=>{
    const data={designation:'Produit',prix_unitaire:500,unite:'Pièce',description:''}; const {id}=a.call('produits:create',data);
    a.call('produits:update',id,{...data,prix_unitaire:750}); assert.equal(a.call('produits:getById',id).prix_unitaire,750);
    a.call('produits:delete',id); assert.equal(count(a,'produits'),0);
  });
  await test('Proforma : sections, descriptions et montants conservés',a=>{
    const p=h.proforma(a,h.fixture(a)); const full=a.call('proformas:getById',p.id);
    assert.equal(full.total_ttc,129800); assert.equal(full.lignes[0].section_titre,'Réseau'); assert.equal(full.lignes[0].description,'Description détaillée');
  });
  await test('Proforma : lignes libres sans produit du catalogue',a=>{
    const p=h.proforma(a,h.fixture(a),{lignes:[{produit_id:null,designation:'Prestation libre',unite:'Forfait',quantite:1,prix_unitaire:100000,montant:100000}]});
    assert.equal(a.call('proformas:getById',p.id).lignes[0].produit_id,null);
  });
  await test('Proforma : modification et remplacement des lignes',a=>{
    const p=h.proforma(a,h.fixture(a)); const full=a.call('proformas:getById',p.id);
    a.call('proformas:update',p.id,{...full,objet:'Modifié',lignes:[{...full.lignes[0],designation:'Nouveau'}]});
    assert.equal(a.call('proformas:getById',p.id).lignes[0].designation,'Nouveau'); assert.equal(count(a,'proforma_lignes'),1);
  });
  await test('Transaction : échec de ligne annule document et compteur',a=>{
    const f=h.fixture(a); const before=a.call('parametres:getAll').proforma_compteur;
    assert.throws(()=>h.proforma(a,f,{lignes:[{designation:null,unite:'U',quantite:1,prix_unitaire:1,montant:1}]}));
    assert.equal(count(a,'proformas'),0); assert.equal(a.call('parametres:getAll').proforma_compteur,before);
  });
  await test('Numérotation : remise à zéro du compteur sans doublon',a=>{
    const f=h.fixture(a); const first=h.proforma(a,f); a.call('parametres:update','proforma_compteur','0'); assert.notEqual(h.proforma(a,f).numero,first.numero);
  });
  await test('Client et produit utilisés : suppression refusée',a=>{
    const f=h.fixture(a); h.proforma(a,f); assert.throws(()=>a.call('clients:delete',f.client)); assert.throws(()=>a.call('produits:delete',f.produit));
  });
  await test('Conversion proforma vers facture : copie et protection',a=>{
    const p=h.proforma(a,h.fixture(a)); const inv=a.call('factures:createFromProforma',p.id,'2026-10-17'); const full=a.call('factures:getById',inv.id);
    assert.equal(full.date,'2026-10-17'); assert.equal(full.total_ttc,129800); assert.equal(full.lignes[0].description,'Description détaillée');
    assert.equal(a.call('proformas:getById',p.id).statut,'facturee'); assert.throws(()=>a.call('proformas:update',p.id,{})); assert.throws(()=>a.call('proformas:delete',p.id));
  });
  await test('Conversion répétée : refuser une deuxième facture pour la même proforma',a=>{
    const p=h.proforma(a,h.fixture(a)); a.call('factures:createFromProforma',p.id); assert.throws(()=>a.call('factures:createFromProforma',p.id),/déjà|convert|factur/i);
  });
  await test('Facture antidatée : règle actuelle de numérotation conservée',a=>{
    const p=h.proforma(a,h.fixture(a),{date:'2025-12-31'}); const inv=a.call('factures:createFromProforma',p.id,'2025-12-31');
    assert.ok(inv.numero.startsWith(new Date().getFullYear()+'/'),`Numéro obtenu : ${inv.numero}`);
    assert.equal(a.call('factures:getById',inv.id).date,'2025-12-31');
  });
  await test('Facture : suppression libère la proforma et supprime les lignes',a=>{
    const inv=h.facture(a,h.fixture(a)); const full=a.call('factures:getById',inv.id); a.call('factures:delete',inv.id);
    assert.equal(count(a,'facture_lignes'),0); assert.equal(a.call('proformas:getById',full.proforma_id).statut,'en_attente');
  });
  await test('Bordereau depuis facture : copie et protection de suppression',a=>{
    const inv=h.facture(a,h.fixture(a)); const b=a.call('bordereaux:createFromFacture',inv.id);
    assert.equal(a.call('bordereaux:getById',b.id).lignes[0].section_titre,'Réseau'); assert.throws(()=>a.call('factures:delete',inv.id));
    a.call('bordereaux:delete',b.id); a.call('factures:delete',inv.id);
  });
  await test('Bordereau autonome : création, modification et validation',a=>{
    const f=h.fixture(a); assert.throws(()=>a.call('bordereaux:create',{client_id:f.client,lignes:[]}));
    const b=a.call('bordereaux:create',{client_id:f.client,date:'2026-10-18',lignes:[{designation:'Livraison',quantite:2}]});
    a.call('bordereaux:update',b.id,{client_id:f.client,date:'2026-10-17',lignes:[{designation:'Livraison modifiée',quantite:3}]}); assert.equal(a.call('bordereaux:getById',b.id).lignes[0].quantite,3);
  });
  await test('Paiement facture : date saisie, TVA déclenchée, annulation',a=>{
    const inv=paidInvoice(a); assert.equal(a.call('factures:getById',inv.id).date_paiement,'2026-10-17'); assert.equal(a.call('tva:getStats').aVerser.length,1);
    a.call('factures:markUnpaid',inv.id); assert.equal(a.call('tva:getStats').aVerser.length,0);
  });
  await test('Paiement facture : dates impossibles refusées',a=>{
    const inv=h.facture(a,h.fixture(a)); for(const date of ['2026-02-30','abc','2026-13-01']) assert.throws(()=>a.call('factures:markPaid',inv.id,date),/Date/);
  });
  await test('Situations 95/5 : montants et somme à 100 %',a=>{
    const {inv,s95,s5}=situations(a); assert.equal(s95.montant_ttc+s5.montant_ttc,129800); assert.equal(s95.tva+s5.tva,19800); assert.equal(s95.montant_ht+s95.tva,s95.montant_ttc);
    assert.throws(()=>a.call('factureSituations:create',inv.id,1)); assert.throws(()=>a.call('factures:markPaid',inv.id));
  });
  await test('Situations : arrondi de la dernière tranche exact',a=>{
    const inv=h.facture(a,h.fixture(a),{total_ht:101,tva:18,total_ttc:119}); const parts=[33.33,33.33,33.34].map(t=>a.call('factureSituations:create',inv.id,t));
    assert.equal(parts.reduce((s,p)=>s+p.montant_ttc,0),119); assert.equal(parts.reduce((s,p)=>s+p.tva,0),18);
  });
  await test('Situations : première tranche déclenche TVA, solde marque facture payée',a=>{
    const {inv,s95,s5}=situations(a); a.call('factureSituations:markPaid',s95.id,'2026-10-16'); assert.equal(a.call('tva:getStats').aVerser.length,1);
    assert.equal(a.call('factures:getById',inv.id).statut_paiement,'non_payee'); a.call('factureSituations:markPaid',s5.id,'2026-10-17'); assert.equal(a.call('factures:getById',inv.id).statut_paiement,'payee');
  });
  await test('Situations : annuler le solde remet la facture en impayée',a=>{
    const {inv,s95,s5}=situations(a); a.call('factureSituations:markPaid',s95.id); a.call('factureSituations:markPaid',s5.id); a.call('factureSituations:markUnpaid',s5.id);
    assert.equal(a.call('factures:getById',inv.id).statut_paiement,'non_payee');
  });
  await test('Situations : suppression de la dernière tranche payée protégée ou statut recalculé',a=>{
    const {inv,s95,s5}=situations(a); a.call('factureSituations:markPaid',s95.id); a.call('factureSituations:markPaid',s5.id);
    let refused=false; try{a.call('factureSituations:delete',s5.id);}catch{refused=true;}
    assert.ok(refused||a.call('factures:getById',inv.id).statut_paiement==='non_payee','Facture encore payée alors que sa tranche de solde a été supprimée');
  });
  await test('TVA : lot, paiement partiel, solde et annulation',a=>{
    const inv=paidInvoice(a); const lot=a.call('tva:verser',[inv.id]); assert.equal(lot.totalDu,9900);
    assert.equal(a.call('tva:ajouterPaiement',lot.id,{montant:4900,date:'2026-10-17'}).solde,false);
    assert.equal(a.call('tva:ajouterPaiement',lot.id,{montant:5000,date:'2026-10-18'}).solde,true);
    assert.equal(a.call('factures:getById',inv.id).tva_versee,1); assert.throws(()=>a.call('factures:markUnpaid',inv.id));
    a.call('tva:annulerVersement',lot.id); assert.equal(a.call('tva:getStats').aVerser.length,1);
  });
  await test('TVA : suppression du paiement rouvre le lot',a=>{
    const inv=paidInvoice(a); const lot=a.call('tva:verser',[inv.id]); a.call('tva:ajouterPaiement',lot.id,{montant:9900});
    const p=a.call('tva:getStats').versements[0].paiements[0]; a.call('tva:supprimerPaiement',p.id);
    assert.equal(a.call('factures:getById',inv.id).tva_versee,0); assert.equal(a.call('tva:getStats').versements[0].reste,9900);
  });
  await test('TVA soldée : empêcher annulation de la première situation',a=>{
    const {inv,s95}=situations(a); a.call('factureSituations:markPaid',s95.id); const lot=a.call('tva:verser',[inv.id]); a.call('tva:ajouterPaiement',lot.id,{montant:9900});
    assert.throws(()=>a.call('factureSituations:markUnpaid',s95.id),/TVA|OTR|lot/i);
  });
  await test('TVA : empêcher suppression de facture engagée dans un lot',a=>{
    const inv=paidInvoice(a); a.call('tva:verser',[inv.id]); assert.throws(()=>a.call('factures:delete',inv.id),/TVA|OTR|lot/i);
  });
  await test('Rapport technique : création, sections, modification et suppression',a=>{
    const f=h.fixture(a); const data={date:'2026-10-18',titre:'Rapport',client_id:f.client,objet:'Test',sections:[{titre:'Diagnostic',contenu:'Réseau rétabli'}]};
    const r=a.call('rapports:create',data); assert.equal(a.call('rapports:getById',r.id).sections[0].contenu,'Réseau rétabli');
    a.call('rapports:update',r.id,{...data,titre:'Modifié'}); assert.equal(a.call('rapports:getById',r.id).titre,'Modifié'); a.call('rapports:delete',r.id); assert.equal(count(a,'rapports'),0);
  });
  await test('Attestation : création, travaux, modification et suppression',a=>{
    const data={date:'2026-10-18',client_nom:'Client test',travaux:['Installation','Tests']}; const r=a.call('attestations:create',data);
    assert.equal(a.call('attestations:getById',r.id).travaux.length,2); a.call('attestations:update',r.id,{...data,travaux:['Validé']});
    assert.equal(a.call('attestations:getById',r.id).travaux[0],'Validé'); a.call('attestations:delete',r.id); assert.equal(count(a,'attestations'),0);
  });
  await test('Intervention : modèle V11, matériel et détails conservés',a=>{
    const data={date:'2026-10-18',intervenant:'Technicien test',client_nom:'Client test',materiels:[{designation:'Routeur',qte:'1'}],details:{modele:'v11',tests:['Ping'],diagnostic:'Câble défectueux'}};
    const r=a.call('interventions:create',data); const full=a.call('interventions:getById',r.id); assert.equal(full.modele,'v11'); assert.equal(full.materiels[0].designation,'Routeur');
    a.call('interventions:update',r.id,{...data,intervenant:'Autre technicien'}); assert.equal(a.call('interventions:getById',r.id).intervenant,'Autre technicien'); a.call('interventions:delete',r.id);
  });
  await test('Listes réutilisables : dédoublonnage',a=>{
    a.call('listes:add','technicien','Test'); a.call('listes:add','technicien','Test'); assert.equal(a.call('listes:get','technicien').length,1);
  });
  await test('Mot de passe : activation, vérification, changement et désactivation',a=>{
    a.call('security:setPassword',{newPassword:'abcd1234'}); assert.equal(a.call('security:getStatus').enabled,true); assert.throws(()=>a.call('security:verify','incorrect'));
    assert.equal(a.call('security:verify','abcd1234').success,true); assert.throws(()=>a.call('security:setPassword',{currentPassword:'incorrect',newPassword:'autre'}));
    a.call('security:setPassword',{currentPassword:'abcd1234',newPassword:'nouveau'}); a.call('security:disable','nouveau'); assert.equal(a.call('security:getStatus').hasPassword,false);
  });
  await test('Tableau de bord : compteurs et CA',a=>{
    h.facture(a,h.fixture(a)); assert.equal(a.call('stats:getCounts').factures,1); assert.equal(a.call('stats:getDashboard').caTotal,129800);
  });
  await test('Sauvegarde et restauration : conservation des données',async a=>{
    const f=h.fixture(a); const filePath=path.join(a.dir,'backup.db'); a.dialogs.save={canceled:false,filePath}; await a.call('database:backup');
    a.call('clients:update',f.client,{...h.clientData,nom:'Après sauvegarde'}); a.dialogs.open={canceled:false,filePaths:[filePath]}; await a.call('database:restore');
    assert.equal(a.call('clients:getById',f.client).nom,h.clientData.nom); assert.equal(a.db.pragma('integrity_check',{simple:true}),'ok');
  });
  await test('Restauration : fichier invalide refusé sans perte de données',async a=>{
    h.fixture(a); const file=path.join(a.dir,'invalid.db'); fs.writeFileSync(file,'Pas une base'); a.dialogs.open={canceled:false,filePaths:[file]};
    await assert.rejects(()=>a.call('database:restore'),/valide/); assert.equal(count(a,'clients'),1);
  });
  await test('Sauvegarde automatique : copie exploitable',a=>{
    h.fixture(a); a.close(); a.autoBackup(); const dir=path.join(a.documents,'GestionFacturation-Backups'); const files=fs.readdirSync(dir); assert.equal(files.length,1);
    const d=new h.Database(path.join(dir,files[0]),{readonly:true}); assert.equal(d.prepare('SELECT COUNT(*) n FROM clients').get().n,1); d.close();
  });
  await test('Migration ancienne base : produit_id NOT NULL devient nullable sans perte',()=>{
    const old=h.createApp({beforeInit:d=>d.exec(`CREATE TABLE proforma_lignes (id INTEGER PRIMARY KEY AUTOINCREMENT, proforma_id INTEGER NOT NULL, produit_id INTEGER NOT NULL, designation TEXT NOT NULL, unite TEXT NOT NULL, quantite REAL NOT NULL, prix_unitaire REAL NOT NULL, montant REAL NOT NULL, ordre INTEGER DEFAULT 0)`)});
    try{assert.equal(old.db.prepare('PRAGMA table_info(proforma_lignes)').all().find(c=>c.name==='produit_id').notnull,0);}finally{old.close();}
  });
  await test('Restauration base incomplète : refus avant remplacement',async a=>{
    h.fixture(a);
    const file=path.join(a.dir,'old.db'); const d=new h.Database(file); d.exec('CREATE TABLE parametres(cle TEXT PRIMARY KEY, valeur TEXT NOT NULL)'); d.close();
    a.dialogs.open={canceled:false,filePaths:[file]};
    await assert.rejects(()=>a.call('database:restore'),/invalide|manquantes/);
    assert.equal(a.call('clients:getAll')[0].nom,h.clientData.nom);
  });
  await test('Licence : essai isolé et rejet du code invalide',()=>{
    const l=h.createLicense(); l.license.recordRun(); const s=l.license.getStatus(); assert.equal(s.trialDays,18); assert.equal(s.blocked,false);
    assert.equal(l.license.activate('code-invalide').success,false); assert.ok(fs.existsSync(path.join(l.dir,'trial.dat')));
  });
  await test('Licence : expiration et détection du recul d’horloge',()=>{
    const l=h.createLicense(); l.license.recordRun(); l.advance(19*86400000); l.license.recordRun(); assert.equal(l.license.getStatus().expired,true);
    l.advance(-2*86400000); l.license.recordRun(); assert.equal(l.license.getStatus().clockTampered,true);
  });
  await require('./integrity.cjs')({test,h,assert,fs,path,situations,paidInvoice,count});
  const report=path.join(h.base,'results.json');
  fs.writeFileSync(report,JSON.stringify({date:new Date().toISOString(),base:h.base,runtime:process.versions,results},null,2));
  console.log('Rapport:',report);
  console.log('RESULT',JSON.stringify({pass:results.filter(r=>r.status==='PASS').length,fail:results.filter(r=>r.status==='FAIL').length}));
  if(results.some(r=>r.status==='FAIL')) process.exitCode=1;
}
main().catch(e=>{console.error(e);process.exitCode=2});
