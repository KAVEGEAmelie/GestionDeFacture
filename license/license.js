/**
 * Module de licence — processus principal Electron.
 *
 * Fonctionnalités :
 *  - Empreinte machine unique (ID machine) liée au matériel du PC
 *  - Suivi de la période d'essai (18 jours) avec stockage redondant
 *    (2 emplacements) pour résister à la désinstallation/réinstallation
 *  - Détection de recul d'horloge (anti-triche)
 *  - Activation par code signé RSA : le code n'est valable QUE pour
 *    l'ID machine du PC où il est saisi (impossible de le partager)
 *
 * ⚠️ INTERRUPTEUR PRINCIPAL : TRIAL_ENFORCEMENT
 *    false = tout est suivi/enregistré mais l'application NE SE BLOQUE PAS
 *    true  = blocage effectif après 18 jours sans activation
 */

const { app } = require('electron');
const os = require('os');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

// ═══════════════════════════════════════════════════════════════════
//  CONFIGURATION
// ═══════════════════════════════════════════════════════════════════

// ⚠️ Passer à true pour activer le blocage après la période d'essai.
const TRIAL_ENFORCEMENT = false;

// Durée de la période d'essai (jours)
const TRIAL_DAYS = 18;

// Clé publique RSA embarquée : sert UNIQUEMENT à vérifier les codes
// d'activation. La clé privée (qui signe) reste chez le vendeur.
const PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAzkFxeE5EQytFog0pKPZ/
+ytaiAZxohrA63E3A2QcGi76+o9X47HW5FDXJ47hPZNO0r3wOlxe8V3BY4pxlrdo
dPb/Q1tlB6ryMASeUx5VhfJEpw9Lu0ksQL5IXn2hDjxGfZYC2kA/4gU0qHycoA6w
80SSPE5s9LmuzeOJOKqhgBBFMyVQYli2CnAnk/sD5wI71Zs8F8uQDBjz9oOezBAz
BkIuGYnX6kusO5ka0jJ6tt2BIt/eTobtoflZ8OfSSrH8ktWdumUAAn7qwkh6af7o
ol3GphyWEQgrbDSVIorYbe9s5/WPTxup3dpMHKWzmcbn/beESSTuLfvtXQSsaN6H
FQIDAQAB
-----END PUBLIC KEY-----`;

// Secret HMAC pour signer les fichiers d'essai (empêche l'édition manuelle).
// Niveau d'obfuscation suffisant pour le grand public.
const HMAC_SECRET = 'its-facturation-2026-Kv9#mR2pLx7@qW4z';

// ═══════════════════════════════════════════════════════════════════
//  EMPREINTE MACHINE
// ═══════════════════════════════════════════════════════════════════

function safeExec(cmd) {
  try {
    return execSync(cmd, { timeout: 4000, windowsHide: true }).toString().trim();
  } catch {
    return '';
  }
}

/**
 * Identifiant matériel brut, le plus stable possible selon l'OS.
 */
function getRawHardwareId() {
  const parts = [];

  if (process.platform === 'win32') {
    // MachineGuid : généré à l'installation de Windows, survit aux
    // désinstallations de logiciels. Très stable.
    const guid = safeExec(
      'reg query "HKLM\\SOFTWARE\\Microsoft\\Cryptography" /v MachineGuid'
    );
    const m = guid.match(/MachineGuid\s+REG_SZ\s+(.+)/i);
    if (m) parts.push(m[1].trim());

    // Numéro de série du BIOS (complémentaire)
    const bios = safeExec('wmic bios get serialnumber');
    const biosLine = bios.split('\n').map((l) => l.trim()).filter((l) => l && !/serialnumber/i.test(l))[0];
    if (biosLine && biosLine !== 'To be filled by O.E.M.') parts.push(biosLine);
  } else if (process.platform === 'linux') {
    try {
      parts.push(fs.readFileSync('/etc/machine-id', 'utf8').trim());
    } catch { /* ignore */ }
  } else if (process.platform === 'darwin') {
    const uuid = safeExec("ioreg -rd1 -c IOPlatformExpertDevice | awk -F'\"' '/IOPlatformUUID/{print $4}'");
    if (uuid) parts.push(uuid);
  }

  // Filet de sécurité si rien n'a fonctionné
  if (parts.length === 0) {
    parts.push(os.hostname(), os.arch(), String(os.cpus().length), os.cpus()[0]?.model || '');
  }

  return parts.join('|');
}

let cachedMachineId = null;

/**
 * ID machine lisible : AAAA-BBBB-CCCC-DDDD (affiché à l'utilisateur,
 * transmis au vendeur pour générer le code d'activation).
 */
function getMachineId() {
  if (cachedMachineId) return cachedMachineId;
  const hash = crypto.createHash('sha256').update(getRawHardwareId()).digest('hex').toUpperCase();
  cachedMachineId = [
    hash.slice(0, 4),
    hash.slice(4, 8),
    hash.slice(8, 12),
    hash.slice(12, 16),
  ].join('-');
  return cachedMachineId;
}

// ═══════════════════════════════════════════════════════════════════
//  STOCKAGE REDONDANT DE L'ESSAI (anti réinstallation)
// ═══════════════════════════════════════════════════════════════════

function hmacSign(payload) {
  return crypto.createHmac('sha256', HMAC_SECRET).update(payload).digest('hex');
}

/**
 * Emplacements de stockage :
 *  1. userData (supprimé si l'utilisateur efface les données de l'app)
 *  2. dossier personnel, nom discret (survit à la désinstallation NSIS)
 */
function getTrialStorePaths() {
  return [
    path.join(app.getPath('userData'), 'trial.dat'),
    path.join(os.homedir(), '.its-syscache.dat'),
  ];
}

function readTrialStore(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const { data, sig } = JSON.parse(raw);
    if (hmacSign(data) !== sig) return null; // fichier falsifié
    const parsed = JSON.parse(Buffer.from(data, 'base64').toString('utf8'));
    if (parsed.machineId !== getMachineId()) return null; // copié d'un autre PC
    return parsed;
  } catch {
    return null;
  }
}

function writeTrialStore(filePath, payload) {
  try {
    const data = Buffer.from(JSON.stringify(payload)).toString('base64');
    fs.writeFileSync(filePath, JSON.stringify({ data, sig: hmacSign(data) }), 'utf8');
  } catch {
    // un emplacement inaccessible n'est pas bloquant
  }
}

/**
 * Consolide les enregistrements des différents emplacements :
 *  - date d'installation : la PLUS ANCIENNE trouvée (anti-réinstallation)
 *  - dernier lancement : le PLUS RÉCENT trouvé (anti recul d'horloge)
 */
function loadTrialState() {
  const stores = getTrialStorePaths().map(readTrialStore).filter(Boolean);
  if (stores.length === 0) return null;
  return {
    installDate: Math.min(...stores.map((s) => s.installDate)),
    lastRun: Math.max(...stores.map((s) => s.lastRun)),
    clockTampered: stores.some((s) => s.clockTampered === true),
  };
}

function saveTrialState(state) {
  const payload = { ...state, machineId: getMachineId() };
  getTrialStorePaths().forEach((p) => writeTrialStore(p, payload));
}

/**
 * À appeler à CHAQUE démarrage : initialise l'essai au premier lancement,
 * met à jour la date de dernier lancement, détecte le recul d'horloge.
 */
function recordRun() {
  const now = Date.now();
  let state = loadTrialState();

  if (!state) {
    state = { installDate: now, lastRun: now, clockTampered: false };
  } else {
    // Horloge reculée de plus d'une heure par rapport au dernier lancement
    if (now < state.lastRun - 60 * 60 * 1000) {
      state.clockTampered = true;
    }
    state.lastRun = Math.max(state.lastRun, now);
  }

  saveTrialState(state);
  return state;
}

// ═══════════════════════════════════════════════════════════════════
//  ACTIVATION (code signé RSA lié à l'ID machine)
// ═══════════════════════════════════════════════════════════════════

function getLicenseFilePath() {
  return path.join(app.getPath('userData'), 'license.dat');
}

/**
 * Vérifie qu'un code d'activation (signature base64) correspond bien
 * à l'ID machine de CE PC, avec la clé publique embarquée.
 */
function verifyActivationCode(code) {
  try {
    const signature = Buffer.from(String(code).replace(/\s+/g, ''), 'base64');
    return crypto.verify(
      'RSA-SHA256',
      Buffer.from(getMachineId(), 'utf8'),
      PUBLIC_KEY,
      signature
    );
  } catch {
    return false;
  }
}

function isActivated() {
  try {
    const raw = fs.readFileSync(getLicenseFilePath(), 'utf8');
    const { code } = JSON.parse(raw);
    return verifyActivationCode(code);
  } catch {
    return false;
  }
}

/**
 * Tente d'activer avec le code fourni. Si valide, l'enregistre.
 */
function activate(code) {
  if (!verifyActivationCode(code)) {
    return { success: false, message: "Code d'activation invalide pour cet ordinateur." };
  }
  fs.writeFileSync(
    getLicenseFilePath(),
    JSON.stringify({ code: String(code).replace(/\s+/g, ''), activatedAt: Date.now() }),
    'utf8'
  );
  return { success: true };
}

// ═══════════════════════════════════════════════════════════════════
//  STATUT GLOBAL
// ═══════════════════════════════════════════════════════════════════

function getStatus() {
  const state = loadTrialState() || recordRun();
  const activated = isActivated();

  const msPerDay = 24 * 60 * 60 * 1000;
  const daysUsed = Math.floor((Date.now() - state.installDate) / msPerDay);
  const daysLeft = Math.max(0, TRIAL_DAYS - daysUsed);
  const expired = daysUsed >= TRIAL_DAYS;

  // Bloqué seulement si : pas activé ET (essai expiré OU horloge trafiquée)
  // ET l'application du blocage est activée (interrupteur).
  const blocked = TRIAL_ENFORCEMENT && !activated && (expired || state.clockTampered);

  return {
    machineId: getMachineId(),
    activated,
    trialDays: TRIAL_DAYS,
    daysUsed,
    daysLeft,
    expired,
    clockTampered: state.clockTampered,
    enforcementEnabled: TRIAL_ENFORCEMENT,
    blocked,
  };
}

module.exports = {
  TRIAL_ENFORCEMENT,
  TRIAL_DAYS,
  getMachineId,
  recordRun,
  getStatus,
  activate,
};
