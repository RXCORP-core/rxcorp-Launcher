/**
 * RXCORP Launcher - Update Publisher
 * Deploys built artifacts to the live update server on https://rxcorp.fr/launcher/update/
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const DIST_DIR = path.resolve(__dirname, '../dist');
const TARGET_UPDATE_DIR = '/var/www/landing/launcher/update';
const TARGET_EXE = '/var/www/landing/RXCORP-Launcher.exe';

console.log('==================================================');
console.log('       RXCORP LAUNCHER - PUBLICATION DE LA MAJ    ');
console.log('==================================================');

if (!fs.existsSync(DIST_DIR)) {
    console.error('[ERREUR] Dossier dist/ introuvable. Lancez npm run build:win d abord.');
    process.exit(1);
}

// 1. Ensure target directory exists
if (!fs.existsSync(TARGET_UPDATE_DIR)) {
    fs.mkdirSync(TARGET_UPDATE_DIR, { recursive: true });
}

// 2. Locate built files
const files = fs.readdirSync(DIST_DIR);
const ymlFile = files.find(f => f.endsWith('latest.yml'));
const exeFile = files.find(f => f.endsWith('.exe') && !f.startsWith('__uninstaller'));
const blockmapFile = files.find(f => f.endsWith('.blockmap'));

if (!ymlFile || !exeFile) {
    console.error('[ERREUR] Fichiers latest.yml ou .exe manquants dans dist/');
    process.exit(1);
}

console.log(`[1/4] Copie de ${ymlFile}...`);
fs.copyFileSync(path.join(DIST_DIR, ymlFile), path.join(TARGET_UPDATE_DIR, 'latest.yml'));

console.log(`[2/4] Copie de ${exeFile}...`);
fs.copyFileSync(path.join(DIST_DIR, exeFile), path.join(TARGET_UPDATE_DIR, exeFile));

// Also copy as direct download root
fs.copyFileSync(path.join(DIST_DIR, exeFile), TARGET_EXE);
fs.copyFileSync(path.join(DIST_DIR, exeFile), '/var/www/landing/RXCORP-Launcher-v2.exe');

const unpackedDir = path.join(DIST_DIR, 'win-unpacked');
if (fs.existsSync(unpackedDir)) {
    console.log('[3/4] Mise à jour du package portable RXCORP-Launcher-Portable.zip...');
    try {
        execSync(`cd "${unpackedDir}" && zip -r -q /var/www/landing/RXCORP-Launcher-Portable.zip .`);
    } catch (e) {
        console.warn('[AVERTISSEMENT] Erreur zip portable:', e.message);
    }
}

if (blockmapFile) {
    console.log(`[3b/4] Copie de ${blockmapFile} pour mises à jour différentielles rapides...`);
    fs.copyFileSync(path.join(DIST_DIR, blockmapFile), path.join(TARGET_UPDATE_DIR, blockmapFile));
}

console.log('[4/4] Ajustement des permissions web (www-data)...');
try {
    execSync(`chown -R www-data:www-data /var/www/landing/launcher /var/www/landing/*.exe /var/www/landing/*.zip`);
    execSync(`chmod -R 755 /var/www/landing/launcher`);
    execSync(`chmod 644 /var/www/landing/*.exe /var/www/landing/*.zip`);
} catch (e) {
    console.warn('[AVERTISSEMENT] Erreur chown/chmod:', e.message);
}

console.log('==================================================');
console.log('   ✅ MISE À JOUR DÉPLOYÉE AVEC SUCCÈS SUR LE CLOUD !');
console.log('   Flux de MAJ : https://rxcorp.fr/launcher/update/latest.yml');
console.log('   Téléchargement : https://rxcorp.fr/RXCORP-Launcher.exe');
console.log('==================================================');
