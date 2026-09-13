/**
 * RXCORP Launcher - PvP & Performance Mods Service
 * Curated list and one-click installer for PvP & FPS Boost mods
 */

const fs = require('fs');
const path = require('path');
const modrinthService = require('./modrinthService');
const instanceService = require('./instanceService');

class PvpService {
    constructor() {
        this.catalog = [
            {
                id: 'sodium',
                name: 'Sodium / Embeddium',
                description: 'Moteur de rendu moderne ultra-performant. Multiplie les FPS par 3 à 5.',
                category: 'Performance',
                icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
                slugFabric: 'sodium',
                slugForge: 'embeddium'
            },
            {
                id: 'lithium',
                name: 'Lithium / FerriteCore',
                description: 'Optimisation de la physique, de l\'IA des mobs et réduction massive de l\'usage RAM.',
                category: 'Performance',
                icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><line x1="9" y1="1" x2="9" y2="4"/><line x1="15" y1="1" x2="15" y2="4"/><line x1="9" y1="20" x2="9" y2="23"/><line x1="15" y1="20" x2="15" y2="23"/></svg>',
                slugFabric: 'lithium',
                slugForge: 'ferrite-core'
            },
            {
                id: 'iris',
                name: 'Iris / Oculus (Shaders)',
                description: 'Support complet et optimisé des shaders graphiques avec Sodium.',
                category: 'Graphismes',
                icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>',
                slugFabric: 'iris',
                slugForge: 'oculus'
            },
            {
                id: 'zoomify',
                name: 'Zoomify (Zoom C)',
                description: 'Zoom fluide et personnalisable comme sur OptiFine (Touche C).',
                category: 'PvP & QoL',
                icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
                slugFabric: 'zoomify',
                slugForge: 'zoomify'
            },
            {
                id: 'appleskin',
                name: 'AppleSkin',
                description: 'Affichage de la saturation exacte et de la régénération de faim.',
                category: 'HUD',
                icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>',
                slugFabric: 'appleskin',
                slugForge: 'appleskin'
            },
            {
                id: 'gamma',
                name: 'FullBright (Gamma Boost)',
                description: 'Vision nocturne claire permanente dans les grottes et la nuit.',
                category: 'PvP & QoL',
                icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/></svg>',
                slugFabric: 'gamma-utils',
                slugForge: 'gamma-utils'
            },
            {
                id: 'voicechat',
                name: 'Simple Voice Chat',
                description: 'Chat vocal de proximité immersif 3D directement en jeu.',
                category: 'Multijoueur',
                icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>',
                slugFabric: 'simple-voice-chat',
                slugForge: 'simple-voice-chat'
            }
        ];
    }

    getCatalog() {
        return this.catalog;
    }

    /**
     * Check which PvP mods are currently installed in the selected instance
     */
    checkInstalledMods(instanceId) {
        const inst = instanceService.getInstance(instanceId);
        if (!inst || !fs.existsSync(inst.modsPath)) return {};

        const files = fs.readdirSync(inst.modsPath).map(f => f.toLowerCase());
        const status = {};

        for (const mod of this.catalog) {
            const fabricSlug = mod.slugFabric.toLowerCase();
            const forgeSlug = mod.slugForge.toLowerCase();

            const installed = files.some(f => 
                (f.includes(fabricSlug) || f.includes(forgeSlug)) && 
                (f.endsWith('.jar') || f.endsWith('.jar.disabled'))
            );
            const isEnabled = files.some(f => 
                (f.includes(fabricSlug) || f.includes(forgeSlug)) && 
                f.endsWith('.jar')
            );

            status[mod.id] = {
                installed: installed,
                enabled: isEnabled
            };
        }

        return status;
    }

    /**
     * Install a curated PvP mod into an instance from Modrinth
     */
    async installMod(instanceId, modId, onProgress) {
        const inst = instanceService.getInstance(instanceId);
        if (!inst) throw new Error('Instance introuvable');

        const modInfo = this.catalog.find(m => m.id === modId);
        if (!modInfo) throw new Error('Mod non répertorié');

        const isForge = inst.loader === 'forge' || inst.loader === 'neoforge';
        const targetSlug = isForge ? modInfo.slugForge : modInfo.slugFabric;

        onProgress && onProgress({ status: 'searching', message: `Recherche de ${modInfo.name}...` });
        const versionsRes = await modrinthService.getCompatibleVersions(targetSlug, inst.version, inst.loader);

        if (!versionsRes.success || !versionsRes.versions.length) {
            throw new Error(`Aucune version compatible trouvée pour MC ${inst.version} (${inst.loader})`);
        }

        const bestVersion = versionsRes.versions[0];
        if (!bestVersion.downloadUrl || !bestVersion.fileName) {
            throw new Error('Fichier de téléchargement indisponible');
        }

        onProgress && onProgress({ status: 'downloading', message: `Téléchargement de ${bestVersion.fileName}...` });
        await modrinthService.installMod(inst.modsPath, bestVersion.downloadUrl, bestVersion.fileName, (loaded, total) => {
            const percent = Math.round((loaded / total) * 100);
            onProgress && onProgress({ 
                status: 'downloading', 
                percent, 
                message: `Téléchargement ${percent}%` 
            });
        });

        return { success: true, fileName: bestVersion.fileName };
    }

    /**
     * Remove a PvP mod from an instance
     */
    removeMod(instanceId, modId) {
        const inst = instanceService.getInstance(instanceId);
        if (!inst || !fs.existsSync(inst.modsPath)) return false;

        const modInfo = this.catalog.find(m => m.id === modId);
        if (!modInfo) return false;

        const fabricSlug = modInfo.slugFabric.toLowerCase();
        const forgeSlug = modInfo.slugForge.toLowerCase();

        const files = fs.readdirSync(inst.modsPath);
        let removed = false;

        for (const file of files) {
            const lower = file.toLowerCase();
            if ((lower.includes(fabricSlug) || lower.includes(forgeSlug)) && (lower.endsWith('.jar') || lower.endsWith('.jar.disabled'))) {
                fs.unlinkSync(path.join(inst.modsPath, file));
                removed = true;
            }
        }

        return removed;
    }
}

module.exports = new PvpService();
