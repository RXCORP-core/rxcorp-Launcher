/**
 * RXCORP Launcher - Instance Management Service
 * Handles multi-instances, modloaders (Forge, Fabric, NeoForge, Vanilla), and mod isolation
 */

const fs = require('fs');
const path = require('path');
const { app, shell } = require('electron');

class InstanceService {
    constructor() {
        this.baseDir = null;
    }

    /**
     * Get root directory for instances storage
     */
    getBaseDir() {
        if (!this.baseDir) {
            let home;
            if (process.env.APPDATA) {
                home = path.join(process.env.APPDATA, 'RXCORP-Launcher');
            } else {
                home = path.join(process.env.HOME || process.env.USERPROFILE || '.', '.rxcorp');
            }
            this.baseDir = path.join(home, 'instances');
            if (!fs.existsSync(this.baseDir)) {
                fs.mkdirSync(this.baseDir, { recursive: true });
            }
        }
        return this.baseDir;
    }

    /**
     * List all installed instances
     */
    getInstances() {
        const base = this.getBaseDir();
        if (!fs.existsSync(base)) return [];

        const entries = fs.readdirSync(base, { withFileTypes: true });
        const instances = [];

        for (const entry of entries) {
            if (entry.isDirectory()) {
                const configPath = path.join(base, entry.name, 'instance.json');
                if (fs.existsSync(configPath)) {
                    try {
                        const data = JSON.parse(fs.readFileSync(configPath, 'utf8'));
                        data.id = entry.name;
                        data.path = path.join(base, entry.name);
                        data.modsPath = path.join(data.path, 'mods');
                        
                        // Count mods
                        const modsPath = data.modsPath;
                        let modCount = 0;
                        if (fs.existsSync(modsPath)) {
                            modCount = fs.readdirSync(modsPath).filter(f => f.endsWith('.jar')).length;
                        }
                        data.modCount = modCount;

                        instances.push(data);
                    } catch (e) {
                        console.error(`Error loading instance ${entry.name}:`, e);
                    }
                }
            }
        }

        // Sort by last played date or created date
        instances.sort((a, b) => (b.lastPlayed || b.createdAt || 0) - (a.lastPlayed || a.createdAt || 0));
        return instances;
    }

    /**
     * Get single instance by ID
     */
    getInstance(id) {
        const base = this.getBaseDir();
        const instanceDir = path.join(base, id);
        const configPath = path.join(instanceDir, 'instance.json');

        if (!fs.existsSync(configPath)) return null;

        const data = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        data.id = id;
        data.path = instanceDir;
        data.modsPath = path.join(instanceDir, 'mods');
        return data;
    }

    /**
     * Create a new instance
     */
    createInstance({ name, version, loader = 'vanilla', loaderVersion = null, serverAddress = null, icon = null }) {
        const base = this.getBaseDir();
        const cleanSlug = (name || 'instance')
            .toLowerCase()
            .replace(/[^a-z0-9_-]/g, '-')
            .replace(/-+/g, '-');
        
        let id = cleanSlug;
        let counter = 1;
        while (fs.existsSync(path.join(base, id))) {
            id = `${cleanSlug}-${counter}`;
            counter++;
        }

        const instanceDir = path.join(base, id);
        fs.mkdirSync(instanceDir, { recursive: true });
        fs.mkdirSync(path.join(instanceDir, 'mods'), { recursive: true });
        fs.mkdirSync(path.join(instanceDir, 'config'), { recursive: true });

        const instanceData = {
            id,
            name: name || 'Nouvelle Instance',
            version: version || '1.21.1',
            loader: loader || 'vanilla', // vanilla, forge, fabric, neoforge
            loaderVersion: loaderVersion || null,
            serverAddress: serverAddress || null,
            icon: icon || 'cube',
            createdAt: Date.now(),
            lastPlayed: null,
            javaMemory: {
                min: 2,
                max: 4
            }
        };

        fs.writeFileSync(path.join(instanceDir, 'instance.json'), JSON.stringify(instanceData, null, 2), 'utf8');
        return this.getInstance(id);
    }

    /**
     * Get or create instance specifically linked to a Pelican server
     */
    getOrCreateServerInstance(server) {
        const instances = this.getInstances();
        // Check if an instance with this server address or name exists
        const serverAddr = `${server.ip}:${server.port}`;
        let found = instances.find(i => i.serverAddress === serverAddr || i.name === `RX - ${server.name}`);

        if (found) {
            if (!found.path) found.path = path.join(this.getBaseDir(), found.id);
            if (!found.modsPath) found.modsPath = path.join(found.path, 'mods');

            // If the instance was created as vanilla, switch to forge so synced mods can run
            if (found.loader === 'vanilla') {
                found.loader = 'forge';
                try {
                    const cfgPath = path.join(found.path, 'instance.json');
                    if (fs.existsSync(cfgPath)) {
                        const raw = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
                        raw.loader = 'forge';
                        fs.writeFileSync(cfgPath, JSON.stringify(raw, null, 2), 'utf8');
                    }
                } catch (e) {
                    console.error('Failed to update instance.json loader:', e);
                }
            }
            return found;
        }

        // Auto-detect version & loader based on docker image or name (default to forge for Pelican servers)
        let version = '1.21.1';
        let loader = 'forge';
        const img = (server.dockerImage || '').toLowerCase();
        const name = (server.name || '').toLowerCase();

        if (img.includes('fabric') || name.includes('fabric')) {
            loader = 'fabric';
        } else if (img.includes('neoforge') || name.includes('neoforge')) {
            loader = 'neoforge';
        } else if (img.includes('forge') || name.includes('forge')) {
            loader = 'forge';
        }

        return this.createInstance({
            name: `RX - ${server.name}`,
            version: version,
            loader: loader,
            serverAddress: serverAddr,
            icon: 'server'
        });
    }

    /**
     * Delete an instance
     */
    deleteInstance(id) {
        const base = this.getBaseDir();
        const instanceDir = path.join(base, id);
        if (fs.existsSync(instanceDir)) {
            fs.rmSync(instanceDir, { recursive: true, force: true });
            return true;
        }
        return false;
    }

    /**
     * List all mods in an instance
     */
    getInstanceMods(id) {
        const inst = this.getInstance(id);
        if (!inst || !fs.existsSync(inst.modsPath)) return [];

        const files = fs.readdirSync(inst.modsPath);
        return files.filter(f => f.endsWith('.jar') || f.endsWith('.jar.disabled')).map(f => {
            const fullPath = path.join(inst.modsPath, f);
            const stats = fs.statSync(fullPath);
            const isEnabled = !f.endsWith('.disabled');
            const cleanName = isEnabled ? f : f.replace(/\.disabled$/, '');

            return {
                fileName: f,
                displayName: cleanName.replace(/\.jar$/, ''),
                sizeBytes: stats.size,
                sizeFormatted: (stats.size / (1024 * 1024)).toFixed(2) + ' MB',
                enabled: isEnabled,
                modifiedAt: stats.mtimeMs
            };
        });
    }

    /**
     * Toggle a mod ON/OFF
     */
    toggleMod(id, fileName) {
        const inst = this.getInstance(id);
        if (!inst) return false;

        const currentPath = path.join(inst.modsPath, fileName);
        if (!fs.existsSync(currentPath)) return false;

        let newPath;
        if (fileName.endsWith('.disabled')) {
            newPath = path.join(inst.modsPath, fileName.replace(/\.disabled$/, ''));
        } else {
            newPath = path.join(inst.modsPath, `${fileName}.disabled`);
        }

        fs.renameSync(currentPath, newPath);
        return true;
    }

    /**
     * Delete a mod from an instance
     */
    deleteMod(id, fileName) {
        const inst = this.getInstance(id);
        if (!inst) return false;

        const target = path.join(inst.modsPath, fileName);
        if (fs.existsSync(target)) {
            fs.unlinkSync(target);
            return true;
        }
        return false;
    }

    /**
     * Open instance folder in operating system explorer
     */
    openFolder(id) {
        const inst = this.getInstance(id);
        if (inst && fs.existsSync(inst.path)) {
            shell.openPath(inst.path);
            return true;
        }
        return false;
    }
}

module.exports = new InstanceService();
