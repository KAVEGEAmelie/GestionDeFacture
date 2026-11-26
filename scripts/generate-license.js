/**
 * OUTIL VENDEUR — Génération de codes d'activation.
 *
 * ⚠️ À exécuter UNIQUEMENT sur TON ordinateur (jamais chez le client).
 *    Nécessite la clé privée license-keys/license-private.pem qui ne doit
 *    JAMAIS être distribuée avec l'application.
 *
 * Utilisation :
 *   node scripts/generate-license.js AAAA-BBBB-CCCC-DDDD
 *
 * Le client te communique son ID machine (affiché dans l'application),
 * tu exécutes cette commande, et tu lui envoies le code généré.
 * Ce code ne fonctionnera QUE sur son PC.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const machineId = (process.argv[2] || '').trim().toUpperCase();

if (!/^[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$/.test(machineId)) {
  console.error('\n❌ ID machine invalide ou manquant.');
  console.error('   Usage : node scripts/generate-license.js AAAA-BBBB-CCCC-DDDD\n');
  process.exit(1);
}

const privateKeyPath = path.join(__dirname, '..', 'license-keys', 'license-private.pem');

let privateKey;
try {
  privateKey = fs.readFileSync(privateKeyPath, 'utf8');
} catch {
  console.error(`\n❌ Clé privée introuvable : ${privateKeyPath}`);
  console.error('   Elle doit rester sur TON ordinateur uniquement.\n');
  process.exit(1);
}

const signature = crypto.sign('RSA-SHA256', Buffer.from(machineId, 'utf8'), privateKey);
const code = signature.toString('base64');

console.log('\n══════════════════════════════════════════════════');
console.log('  CODE D\'ACTIVATION GÉNÉRÉ');
console.log('══════════════════════════════════════════════════');
console.log(`\n  ID machine : ${machineId}\n`);
console.log('  Code à envoyer au client :\n');
console.log(code);
console.log('\n══════════════════════════════════════════════════');
console.log('  Ce code ne fonctionne QUE sur ce PC précis.');
console.log('══════════════════════════════════════════════════\n');
