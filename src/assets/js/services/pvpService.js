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
                icon: '⚡',
                slugFabric: 'sodium',
                slugForge: 'embeddium'
            },
            {
                id: 'lithium',
                name: 'Lithium / FerriteCore',
                description: 'Optimisation de la physique, de l\'IA des mobs et réduction massive de l\'usage RAM.',
                category: 'Performance',
                icon: '🔋',
                slugFabric: 'lithium',
                slugForge: 'ferrite-core'
            },
            {
                id: 'iris',
                name: 'Iris / Oculus (Shaders)',
                description: 'Support complet et optimisé des shaders graphiques avec Sodium.',
                category: 'Graphismes',
                icon: '✨',
                slugFabric: 'iris',
                slugForge: 'oculus'
            },
            {
                id: 'zoomify',
                name: 'Zoomify (Zoom C)',
                description: 'Zoom fluide et personnalisable comme sur OptiFine (Touche C).',
                category: 'PvP & QoL',
                icon: '🔍',
                slugFabric: 'zoomify',
                slugForge: 'zoomify'
            },
            {
                id: 'appleskin',
                name: 'AppleSkin',
                description: 'Affichage de la saturation exacte et de la régénération de faim.',
                category: 'HUD',
                icon: '🍎',
                slugFabric: 'appleskin',
                slugForge: 'appleskin'
            },
            {
                id: 'gamma',
                name: 'FullBright (Gamma Boost)',
                description: 'Vision nocturne claire permanente dans les grottes et la nuit.',
                category: 'PvP & QoL',
                icon: '💡',
                slugFabric: 'gamma-utils',
                slugForge: 'gamma-utils'
            },
            {
                id: 'voicechat',
                name: 'Simple Voice Chat',
                description: 'Chat vocal de proximité immersif 3D directement en jeu.',
                category: 'Multijoueur',
                icon: '🎙️',
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
