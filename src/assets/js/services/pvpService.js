/**
 * RXCORP Launcher - Elite PvP & Performance Client Service
 * Inspired by Soar Client, Cloud Client, and Frost Client
 * Features 1.8.9 (Legacy Spam-Click) and 1.20/1.21+ (Modern Shield & Crystal)
 */

const fs = require('fs');
const path = require('path');
const modrinthService = require('./modrinthService');
const instanceService = require('./instanceService');

class PvpService {
    constructor() {
        // Core PvP Standards (1.8.9 vs 1.21+ vs 1.7.10)
        this.profiles = [
            {
                id: '1.8.9',
                versionKey: '1.8.9',
                name: 'RX PvP 1.8.9 (Compétitif)',
                shortName: 'PvP 1.8.9 Compétitif',
                version: '1.8.9',
                loader: 'forge',
                style: 'Spam-click & Vitesse',
                tag: 'COMPÉTITION HISTORIQUE',
                accentColor: 'var(--primary)',
                description: 'Le standard mondial historique du PvP compétitif (BedWars, SkyWars, PotPvP, UHC, Practice). Zéro cooldown d\'attaque, combos rod/épée rapides, block-hitting et fluidité 1.8 maximale.',
                modes: ['BedWars', 'SkyWars', 'PotPvP', 'UHC', 'Practice'],
                servers: [
                    { name: 'Hypixel Network', ip: 'mc.hypixel.net', ping: '18ms', desc: 'BedWars, SkyWars, Duels' },
                    { name: 'Minemen Club', ip: 'play.minemen.club', ping: '14ms', desc: 'Ranked Practice & PotPvP' },
                    { name: 'PikaNetwork', ip: 'top.pika.host', ping: '22ms', desc: 'Practice & BedWars' }
                ]
            },
            {
                id: '1.21',
                versionKey: '1.21.1',
                name: 'RX PvP 1.21+ (Moderne)',
                shortName: 'PvP 1.21+ Moderne',
                version: '1.21.1',
                loader: 'fabric',
                style: 'Timing, Bouclier & Cristaux',
                tag: 'NOUVELLE GÉNÉRATION',
                accentColor: 'var(--cyan)',
                description: 'Le standard moderne du PvP Minecraft (Lifesteal, BoxPvP, PvP Survival, Maces). Timing d\'arme calculé, blocage au bouclier, crystal PvP, totems et moteur Sodium 200+ FPS.',
                modes: ['Lifesteal SMP', 'BoxPvP', 'PvP Survival', 'End Crystal', 'Maces'],
                servers: [
                    { name: 'DonutSMP', ip: 'donutsmp.net', ping: '19ms', desc: 'Lifesteal SMP N°1 Mondial' },
                    { name: 'PvP Land', ip: 'play.pvp.land', ping: '16ms', desc: 'Crystal & Shield Practice' },
                    { name: 'BoxPvP Network', ip: 'play.boxpvp.net', ping: '24ms', desc: 'BoxPvP & Mines Compétitives' }
                ]
            },
            {
                id: '1.20',
                versionKey: '1.20.4',
                name: 'RX PvP 1.20.4 (Tournois)',
                shortName: 'PvP 1.20.4 Tournois',
                version: '1.20.4',
                loader: 'fabric',
                style: 'Axe, Sword & Shield',
                tag: 'STANDARD E-SPORT 1.20',
                accentColor: '#38bdf8',
                description: 'La référence des tournois e-sport compétitifs modernes. Combats précis à la hache et au bouclier, fluidité Sodium et zéro latence d\'animation.',
                modes: ['Axe & Shield', 'Sword Duels', 'Hoplite Battle', 'SMP Practice'],
                servers: [
                    { name: 'Hoplite PvP', ip: 'play.hoplite.gg', ping: '16ms', desc: 'Battle Royale E-sport & Ranked' },
                    { name: 'MCHub Network', ip: 'mchub.com', ping: '26ms', desc: 'BoxPvP & Duels 1.20' }
                ]
            },
            {
                id: '1.16',
                versionKey: '1.16.5',
                name: 'RX PvP 1.16.5 (Netherite)',
                shortName: 'PvP 1.16.5 Netherite',
                version: '1.16.5',
                loader: 'fabric',
                style: 'Netherite & Manhunts',
                tag: 'NETHER UPDATE & MANHUNT',
                accentColor: '#f97316',
                description: 'L\'âge d\'or des Manhunts et du combat au Netherite. Maîtrise des ancres de réapparition (Respawn Anchors), lits explosifs et combos hache critique.',
                modes: ['Speedrun Manhunt', 'Anchor PvP', 'Netherite Duels', 'Factions 1.16'],
                servers: [
                    { name: 'PvP Temple', ip: 'pvptemple.com', ping: '22ms', desc: 'Manhunts & Ranked 1.16' },
                    { name: 'AstralPvP', ip: 'astralpvp.net', ping: '25ms', desc: 'Factions Netherite' }
                ]
            },
            {
                id: '1.12',
                versionKey: '1.12.2',
                name: 'RX PvP 1.12.2 (Anarchie)',
                shortName: 'PvP 1.12.2 Anarchie',
                version: '1.12.2',
                loader: 'forge',
                style: 'Anarchie & End Crystal',
                tag: 'ANARCHIE & 2B2T',
                accentColor: '#eab308',
                description: 'La référence mondiale des serveurs anarchie (2b2t) et du Crystal PvP originel 1.12 sans cooldown ni règles.',
                modes: ['2b2t Anarchie', 'Crystal PvP Originel', 'PvP Factions Moddé'],
                servers: [
                    { name: '2b2t Anarchy', ip: '2b2t.org', ping: '32ms', desc: 'Le plus vieux serveur anarchie' },
                    { name: 'Constantiam', ip: 'constantiam.net', ping: '28ms', desc: 'Anarchie 1.12 pure' }
                ]
            },
            {
                id: '1.7.10',
                versionKey: '1.7.10',
                name: 'RX PvP 1.7.10 (HCF Puriste)',
                shortName: 'PvP 1.7.10 HCF',
                version: '1.7.10',
                loader: 'forge',
                style: 'Factions à l\'ancienne / PotPvP',
                tag: 'HCF PURISTE',
                accentColor: 'var(--emerald)',
                description: 'Réservé aux puristes de la fluidité brute et des animations de hit à l\'ancienne (Hardcore Factions & PotPvP classique).',
                modes: ['Hardcore Factions (HCF)', 'Classic PotPvP'],
                servers: [
                    { name: 'VeltPvP HCF', ip: 'veltpvp.com', ping: '20ms', desc: 'Hardcore Factions' }
                ]
            }
        ];

        // Curated Mod Suite (Soar / Frost Client categorization)
        this.catalog = [
            // 1. PERFORMANCE & FPS
            {
                id: 'sodium',
                name: 'Sodium / Embeddium',
                description: 'Moteur de rendu moderne ultra-performant. Multiplie les FPS par 3 à 5 sans sacrifier la qualité.',
                category: 'Performance',
                icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
                slugFabric: 'sodium',
                slugForge: 'embeddium'
            },
            {
                id: 'lithium',
                name: 'Lithium / FerriteCore',
                description: 'Optimisation de la physique, de l\'IA et réduction massive de l\'empreinte mémoire RAM.',
                category: 'Performance',
                icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><line x1="9" y1="1" x2="9" y2="4"/><line x1="15" y1="1" x2="15" y2="4"/><line x1="9" y1="20" x2="9" y2="23"/><line x1="15" y1="20" x2="15" y2="23"/></svg>',
                slugFabric: 'lithium',
                slugForge: 'ferrite-core'
            },
            {
                id: 'culling',
                name: 'Entity Culling',
                description: 'Ne calcule pas les entités masquées par des blocs. Élimine les chutes de FPS dans les zones denses.',
                category: 'Performance',
                icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>',
                slugFabric: 'entityculling',
                slugForge: 'entityculling'
            },
            {
                id: 'modernfix',
                name: 'ModernFix (Anti-Stutter)',
                description: 'Corrige les fuites de mémoire et accélère le temps de chargement du client.',
                category: 'Performance',
                icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>',
                slugFabric: 'modernfix',
                slugForge: 'modernfix'
            },

            // 2. HUD & COMBOS TACTIQUES
            {
                id: 'appleskin',
                name: 'AppleSkin',
                description: 'Affichage de la saturation exacte et de la régénération de faim en temps réel.',
                category: 'HUD',
                icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>',
                slugFabric: 'appleskin',
                slugForge: 'appleskin'
            },
            {
                id: 'modmenu',
                name: 'Mod Menu & Config UI',
                description: 'Interface visuelle pour régler et configurer tous vos mods PvP directement en jeu.',
                category: 'HUD',
                icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>',
                slugFabric: 'modmenu',
                slugForge: 'catalogue'
            },

            // 3. VISUELS & CONFORT (QoL)
            {
                id: 'gamma',
                name: 'FullBright (Gamma 100%)',
                description: 'Vision nocturne claire permanente sans torches dans les grottes et arènes sombres.',
                category: 'Visuels',
                icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/></svg>',
                slugFabric: 'gamma-utils',
                slugForge: 'gamma-utils'
            },
            {
                id: 'zoomify',
                name: 'Zoomify (Zoom C Fluide)',
                description: 'Zoom fluide et personnalisable comme sur OptiFine avec transition cinématique (Touche C).',
                category: 'Visuels',
                icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
                slugFabric: 'zoomify',
                slugForge: 'zoomify'
            },
            {
                id: 'iris',
                name: 'Iris / Oculus (Shaders)',
                description: 'Support complet et ultra fluide des shaders graphiques avec Sodium actif.',
                category: 'Visuels',
                icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>',
                slugFabric: 'iris',
                slugForge: 'oculus'
            },
            {
                id: 'voicechat',
                name: 'Simple Voice Chat',
                description: 'Chat vocal de proximité immersif 3D directement intégré avec vos coéquipiers.',
                category: 'Visuels',
                icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>',
                slugFabric: 'simple-voice-chat',
                slugForge: 'simple-voice-chat'
            }
        ];
    }

    getProfiles() {
        return this.profiles;
    }

    getCatalog() {
        return this.catalog;
    }

    /**
     * List all dedicated PvP client instances
     */
    getPvpInstances() {
        return instanceService.getPvpInstances();
    }

    /**
     * Get or create a dedicated PvP profile instance in 1-click
     */
    getOrCreatePvpProfile(profileId) {
        const prof = this.profiles.find(p => p.id === profileId);
        if (!prof) return null;

        const pvpInstances = instanceService.getPvpInstances();
        let found = pvpInstances.find(i => i.pvpProfile === profileId || (i.version === prof.versionKey && i.domain === 'pvp'));

        if (!found) {
            // Also check legacy instances
            const allInstances = instanceService.getInstances();
            found = allInstances.find(i => i.version === prof.versionKey && (i.name.includes('PvP') || i.name.includes(prof.shortName)));
        }

        if (found) {
            if (found.domain !== 'pvp' || !found.pvpProfile) {
                found.domain = 'pvp';
                found.pvpProfile = prof.id;
                try {
                    const cfgPath = path.join(instanceService.getBaseDir(), found.id, 'instance.json');
                    if (fs.existsSync(cfgPath)) {
                        const raw = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
                        raw.domain = 'pvp';
                        raw.pvpProfile = prof.id;
                        fs.writeFileSync(cfgPath, JSON.stringify(raw, null, 2), 'utf8');
                    }
                } catch (e) {}
            }
            return found;
        }

        found = instanceService.createInstance({
            name: prof.name,
            version: prof.versionKey,
            loader: prof.loader,
            icon: profileId === '1.8.9' ? 'sword' : (profileId === '1.7.10' ? 'zap' : 'shield'),
            domain: 'pvp',
            pvpProfile: prof.id
        });

        return found;
    }

    /**
     * Create a custom PvP client instance for any Minecraft version
     */
    createCustomPvpProfile({ name, version, loader = 'fabric' }) {
        return instanceService.createInstance({
            name: name || `RX PvP ${version}`,
            version: version,
            loader: loader,
            icon: 'shield',
            domain: 'pvp',
            pvpProfile: version
        });
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
