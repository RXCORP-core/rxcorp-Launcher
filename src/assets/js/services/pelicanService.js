/**
 * RXCORP Launcher - Pelican Cloud API Service
 * Handles communication with Pelican Panel (panel.rxcorp.fr)
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { URL } = require('url');
const modPoolService = require('./modPoolService');

class PelicanService {
    constructor() {
        this.defaultPanelUrl = 'https://panel.rxcorp.fr';
    }

    /**
     * Get headers for Pelican Client API
     */
    _getHeaders(apiKey) {
        return {
            'Authorization': `Bearer ${apiKey.trim()}`,
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'User-Agent': 'RXCORP-Launcher/2.0'
        };
    }

    /**
     * Test connection and retrieve current authenticated user info
     */
    async testConnection(apiKey, panelUrl = this.defaultPanelUrl) {
        try {
            const url = `${panelUrl.replace(/\/+$/, '')}/api/client/account`;
            const res = await fetch(url, {
                method: 'GET',
                headers: this._getHeaders(apiKey)
            });

            if (!res.ok) {
                const text = await res.text();
                return { success: false, status: res.status, error: text || 'Clé API invalide ou accès refusé' };
            }

            const data = await res.json();
            return {
                success: true,
                user: {
                    id: data.attributes.id,
                    username: data.attributes.username,
                    email: data.attributes.email,
                    language: data.attributes.language,
                    admin: data.attributes.admin || data.attributes.root_admin || false
                }
            };
        } catch (err) {
            return { success: false, error: err.message };
        }
    }

    /**
     * Get list of all servers owned by or shared with the user
     */
    async getServers(apiKey, panelUrl = this.defaultPanelUrl, adminAll = false) {
        try {
            const baseUrl = panelUrl.replace(/\/+$/, '');
            const endpoint = adminAll ? `${baseUrl}/api/client?type=admin-all` : `${baseUrl}/api/client`;
            let res = await fetch(endpoint, {
                method: 'GET',
                headers: this._getHeaders(apiKey)
            });

            if (!res.ok) {
                throw new Error(`Erreur API (${res.status}): ${await res.text()}`);
            }

            let json = await res.json();
            let dataList = json.data || [];

            // If empty and adminAll was not explicitly false, try admin-all as fallback in case user is an administrator
            if (dataList.length === 0 && adminAll === 'auto') {
                try {
                    const adminRes = await fetch(`${baseUrl}/api/client?type=admin-all`, {
                        method: 'GET',
                        headers: this._getHeaders(apiKey)
                    });
                    if (adminRes.ok) {
                        const adminJson = await adminRes.json();
                        if (adminJson.data && adminJson.data.length > 0) {
                            dataList = adminJson.data;
                        }
                    }
                } catch (_) {}
            }

            const servers = [];

            for (const item of dataList) {
                const attr = item.attributes;
                const allocations = attr.relationships?.allocations?.data || [];
                const defaultAlloc = allocations.find(a => a.attributes?.is_default) || allocations[0];

                let ip = 'node.rxcorp.fr';
                let port = 25565;

                if (defaultAlloc && defaultAlloc.attributes) {
                    const allocIp = defaultAlloc.attributes.ip_alias || defaultAlloc.attributes.ip;
                    if (allocIp && allocIp !== '0.0.0.0' && allocIp !== '127.0.0.1') {
                        ip = allocIp;
                    } else {
                        ip = 'node.rxcorp.fr';
                    }
                    port = defaultAlloc.attributes.port || port;
                }

                // Detect MC Version and Loader from Egg Variables
                let mcVersion = '1.21.4';
                let detectedLoader = 'vanilla';
                const variables = attr.relationships?.variables?.data || [];
                for (const v of variables) {
                    const env = v.attributes?.env_variable;
                    const val = v.attributes?.server_value || v.attributes?.default_value;
                    if (env === 'MC_VERSION' && val && val !== 'latest') {
                        mcVersion = val;
                    }
                    if (env === 'NEOFORGE_VERSION' && val) {
                        detectedLoader = 'neoforge';
                    }
                    if (env === 'FABRIC_VERSION' && val) {
                        detectedLoader = 'fabric';
                    }
                    if (env === 'FORGE_VERSION' && val) {
                        detectedLoader = 'forge';
                    }
                }

                const invocation = (attr.invocation || '').toLowerCase();
                const dockerImage = (attr.docker_image || '').toLowerCase();
                const srvName = (attr.name || '').toLowerCase();
                const allocNotes = (defaultAlloc?.attributes?.notes || '').toLowerCase();

                // FiveM Detection
                const isFiveM = invocation.includes('cfx') || 
                                invocation.includes('fxserver') || 
                                invocation.includes('fivem') || 
                                srvName.includes('fivem') ||
                                allocNotes.includes('fivem') ||
                                variables.some(v => (v.attributes?.env_variable || '').toLowerCase().includes('fivem'));

                // Minecraft Detection
                const hasMcVars = variables.some(v => (v.attributes?.env_variable || '').includes('MC_VERSION'));
                const isMinecraft = !isFiveM && (
                                    invocation.includes('server.jar') || 
                                    invocation.includes('unix_args.txt') || 
                                    invocation.includes('run.sh') ||
                                    dockerImage.includes('yolks') || 
                                    dockerImage.includes('java') ||
                                    hasMcVars ||
                                    (attr.egg_features && attr.egg_features.includes('eula')) ||
                                    srvName.includes('minecraft'));

                let gameType = 'other';
                if (isFiveM) gameType = 'fivem';
                else if (isMinecraft) gameType = 'minecraft';

                servers.push({
                    id: attr.identifier,
                    identifier: attr.identifier,
                    internalId: attr.internal_id,
                    uuid: attr.uuid,
                    name: attr.name,
                    description: attr.description || '',
                    node: attr.node,
                    isOwner: attr.server_owner,
                    ip: ip,
                    port: port,
                    version: mcVersion,
                    loader: detectedLoader,
                    gameType: gameType,
                    isMinecraft: isMinecraft,
                    isFiveM: isFiveM,
                    limits: {
                        memory: attr.limits?.memory || 0,
                        cpu: attr.limits?.cpu || 0,
                        disk: attr.limits?.disk || 0
                    },
                    dockerImage: attr.docker_image
                });
            }

            return { success: true, servers };
        } catch (err) {
            return { success: false, error: err.message, servers: [] };
        }
    }

    /**
     * Get real-time resources and status of a specific server
     */
    async getServerResources(identifier, apiKey, panelUrl = this.defaultPanelUrl) {
        try {
            const url = `${panelUrl.replace(/\/+$/, '')}/api/client/servers/${identifier}/resources`;
            const res = await fetch(url, {
                method: 'GET',
                headers: this._getHeaders(apiKey)
            });

            if (!res.ok) {
                return { success: false, status: 'offline', current_state: 'offline' };
            }

            const json = await res.json();
            const attr = json.attributes || {};

            return {
                success: true,
                state: attr.current_state || 'offline', // running, offline, starting, stopping
                isSuspended: attr.is_suspended || false,
                resources: {
                    memoryBytes: attr.resources?.memory_bytes || 0,
                    cpuAbsolute: (attr.resources?.cpu_absolute || 0).toFixed(1),
                    diskBytes: attr.resources?.disk_bytes || 0,
                    uptimeMs: attr.resources?.uptime || 0
                }
            };
        } catch (err) {
            return { success: false, state: 'offline', error: err.message };
        }
    }

    /**
     * List all mods installed in /mods on the server
     */
    async listServerMods(identifier, apiKey, panelUrl = this.defaultPanelUrl) {
        try {
            const url = `${panelUrl.replace(/\/+$/, '')}/api/client/servers/${identifier}/files/list?directory=%2Fmods`;
            const res = await fetch(url, {
                method: 'GET',
                headers: this._getHeaders(apiKey)
            });

            if (!res.ok) {
                // If directory does not exist or empty
                return { success: true, mods: [] };
            }

            const json = await res.json();
            const files = (json.data || [])
                .map(item => item.attributes)
                .filter(f => f.is_file && f.name.endsWith('.jar'));

            return {
                success: true,
                mods: files.map(f => ({
                    name: f.name,
                    size: f.size,
                    modifiedAt: f.modified_at
                }))
            };
        } catch (err) {
            return { success: false, error: err.message, mods: [] };
        }
    }

    /**
     * Get a signed download URL for a file from the server
     */
    async getDownloadUrl(identifier, filePath, apiKey, panelUrl = this.defaultPanelUrl) {
        try {
            const encodedPath = encodeURIComponent(filePath);
            const url = `${panelUrl.replace(/\/+$/, '')}/api/client/servers/${identifier}/files/download?file=${encodedPath}`;
            const res = await fetch(url, {
                method: 'GET',
                headers: this._getHeaders(apiKey)
            });

            if (!res.ok) {
                throw new Error(`Échec de récupération du lien de téléchargement (${res.status})`);
            }

            const json = await res.json();
            return { success: true, url: json.attributes?.url };
        } catch (err) {
            return { success: false, error: err.message };
        }
    }

    /**
     * Download a file directly from Wings signed URL to local destination
     */
    async downloadFile(downloadUrl, destPath, onProgress) {
        return new Promise((resolve, reject) => {
            const urlObj = new URL(downloadUrl);
            const client = urlObj.protocol === 'http:' ? http : https;

            const req = client.get(downloadUrl, {
                headers: {
                    'User-Agent': 'RXCORP-Launcher/2.0'
                }
            }, (res) => {
                if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                    res.resume();
                    return this.downloadFile(res.headers.location, destPath, onProgress).then(resolve).catch(reject);
                }

                if (res.statusCode < 200 || res.statusCode >= 300) {
                    res.resume();
                    return reject(new Error(`Erreur lors du téléchargement (${res.statusCode} ${res.statusMessage || ''})`));
                }

                const totalBytes = parseInt(res.headers['content-length'] || '0', 10);
                const fileStream = fs.createWriteStream(destPath);
                let downloadedBytes = 0;

                res.on('data', (chunk) => {
                    downloadedBytes += chunk.length;
                    if (onProgress && totalBytes > 0) {
                        onProgress(downloadedBytes, totalBytes);
                    }
                });

                res.pipe(fileStream);

                fileStream.on('finish', () => {
                    fileStream.close(() => resolve());
                });

                fileStream.on('error', (err) => {
                    try { if (fs.existsSync(destPath)) fs.unlinkSync(destPath); } catch (_) {}
                    reject(err);
                });
            });

            req.on('error', (err) => {
                try { if (fs.existsSync(destPath)) fs.unlinkSync(destPath); } catch (_) {}
                reject(err);
            });
        });
    }

    /**
     * Synchronize server mods to local instance /mods directory using Link-Sync
     * 1. Inspects server mods
     * 2. Checks central mod pool (instant 0 ms hardlinks for cached mods)
     * 3. Downloads missing mods with integrity validation
     * 4. Cleans obsolete mods from instance
     */
    async syncModsToInstance(serverIdentifier, localModsDir, apiKey, panelUrl = this.defaultPanelUrl, progressCallback = () => {}) {
        if (!localModsDir) {
            throw new Error('Dossier de destination des mods introuvable pour cette instance.');
        }

        if (!fs.existsSync(localModsDir)) {
            fs.mkdirSync(localModsDir, { recursive: true });
        }

        progressCallback({ status: 'scan', percent: 5, message: 'Analyse des mods du serveur Pelican...' });
        const serverModsRes = await this.listServerMods(serverIdentifier, apiKey, panelUrl);
        if (!serverModsRes.success) {
            throw new Error(serverModsRes.error || 'Impossible de lister les mods du serveur');
        }

        const serverMods = serverModsRes.mods || [];
        const serverModNamesSet = new Set(serverMods.map(m => m.name));

        // Clean obsolete mods from instance (preserved in pool)
        const removedMods = modPoolService.cleanInstanceMods(serverModNamesSet, localModsDir);

        let alreadyLinkedCount = 0;
        let poolLinkedCount = 0;
        const toDownload = [];

        // Determine what is already up to date, what can be linked from pool, and what must be downloaded
        for (const mod of serverMods) {
            const localFilePath = path.join(localModsDir, mod.name);

            if (fs.existsSync(localFilePath) && modPoolService.isJarValid(localFilePath)) {
                const statLocal = fs.statSync(localFilePath);
                if (Math.abs(statLocal.size - mod.size) <= 100) {
                    alreadyLinkedCount++;
                    continue;
                }
            }

            // Check if it exists in central pool
            if (modPoolService.hasModInPool(mod.name, mod.size)) {
                try {
                    modPoolService.linkModToInstance(mod.name, localModsDir);
                    poolLinkedCount++;
                    progressCallback({
                        status: 'linking',
                        modName: mod.name,
                        message: `Liaison instantanée de ${mod.name} (Link-Sync)`
                    });
                    continue;
                } catch (_) {}
            }

            toDownload.push(mod);
        }

        progressCallback({
            status: 'plan',
            percent: 25,
            totalServerMods: serverMods.length,
            alreadyUpToDate: alreadyLinkedCount,
            linkedFromPool: poolLinkedCount,
            toDownloadCount: toDownload.length,
            removedCount: removedMods.length,
            message: toDownload.length === 0 
                ? `${serverMods.length} mod(s) prêts (${poolLinkedCount} lié(s) instantanément).`
                : `${toDownload.length} mod(s) à télécharger (${poolLinkedCount} lié(s) depuis le cache).`
        });

        let downloadedCount = 0;
        const tempDownloadDir = path.join(modPoolService.getPoolDir(), '.temp');
        if (!fs.existsSync(tempDownloadDir)) {
            fs.mkdirSync(tempDownloadDir, { recursive: true });
        }

        for (let i = 0; i < toDownload.length; i++) {
            const mod = toDownload[i];
            const currentStep = i + 1;
            const stepPercent = Math.round(25 + ((currentStep - 1) / toDownload.length) * 70);

            progressCallback({
                status: 'downloading',
                modName: mod.name,
                current: currentStep,
                total: toDownload.length,
                percent: stepPercent,
                message: `Téléchargement de ${mod.name}...`
            });

            const dlRes = await this.getDownloadUrl(serverIdentifier, `/mods/${mod.name}`, apiKey, panelUrl);
            if (!dlRes.success || !dlRes.url) {
                console.error(`Impossible d'obtenir le lien pour ${mod.name}:`, dlRes.error);
                continue;
            }

            const tempDestPath = path.join(tempDownloadDir, `temp_${Date.now()}_${mod.name}`);
            try {
                await this.downloadFile(dlRes.url, tempDestPath, (loaded, total) => {
                    const filePct = Math.round((loaded / total) * 100);
                    const overallPct = Math.round(25 + ((i + (loaded / total)) / toDownload.length) * 70);
                    progressCallback({
                        status: 'downloading',
                        modName: mod.name,
                        current: currentStep,
                        total: toDownload.length,
                        percent: Math.min(overallPct, 95),
                        filePercent: filePct,
                        message: `Téléchargement de ${mod.name} (${filePct}%)`
                    });
                });

                // Anti-conflict verification: check JAR integrity before storing in pool
                if (!modPoolService.isJarValid(tempDestPath)) {
                    console.error(`[Link-Sync] Fichier corrompu ou invalide reçu pour ${mod.name}`);
                    try { fs.unlinkSync(tempDestPath); } catch (_) {}
                    continue;
                }

                // Add to central pool
                modPoolService.storeModInPool(mod.name, tempDestPath);

                // Link to instance
                modPoolService.linkModToInstance(mod.name, localModsDir);
                downloadedCount++;
            } catch (dlErr) {
                console.error(`[Link-Sync] Erreur lors du téléchargement de ${mod.name}:`, dlErr);
                try { if (fs.existsSync(tempDestPath)) fs.unlinkSync(tempDestPath); } catch (_) {}
            }
        }

        progressCallback({
            status: 'completed',
            percent: 100,
            totalServerMods: serverMods.length,
            alreadyUpToDate: alreadyLinkedCount,
            linkedFromPool: poolLinkedCount,
            downloadedCount: downloadedCount,
            removedCount: removedMods.length,
            message: 'Synchronisation Link-Sync terminée avec succès !'
        });

        return {
            success: true,
            totalServerMods: serverMods.length,
            alreadyUpToDate: alreadyLinkedCount,
            linkedFromPool: poolLinkedCount,
            downloadedCount: downloadedCount,
            removedCount: removedMods.length
        };
    }

    /**
     * Send console command to a Pelican server
     */
    async sendCommand(identifier, command, apiKey, panelUrl = this.defaultPanelUrl) {
        try {
            const url = `${panelUrl.replace(/\/+$/, '')}/api/client/servers/${identifier}/command`;
            const res = await fetch(url, {
                method: 'POST',
                headers: this._getHeaders(apiKey),
                body: JSON.stringify({ command: command.trim() })
            });

            if (res.status === 204 || res.status === 200) {
                return { success: true };
            }
            const text = await res.text();
            return { success: false, status: res.status, error: text || 'Erreur exécution commande' };
        } catch (err) {
            return { success: false, error: err.message };
        }
    }

    /**
     * Read raw file contents from server
     */
    async getFileContents(identifier, filePath, apiKey, panelUrl = this.defaultPanelUrl) {
        try {
            const encodedPath = encodeURIComponent(filePath);
            const url = `${panelUrl.replace(/\/+$/, '')}/api/client/servers/${identifier}/files/contents?file=${encodedPath}`;
            const res = await fetch(url, {
                method: 'GET',
                headers: this._getHeaders(apiKey)
            });

            if (!res.ok) {
                return { success: false, status: res.status };
            }
            const content = await res.text();
            return { success: true, content };
        } catch (err) {
            return { success: false, error: err.message };
        }
    }

    /**
     * Write raw file contents to server
     */
    async writeFileContents(identifier, filePath, content, apiKey, panelUrl = this.defaultPanelUrl) {
        try {
            const encodedPath = encodeURIComponent(filePath);
            const url = `${panelUrl.replace(/\/+$/, '')}/api/client/servers/${identifier}/files/write?file=${encodedPath}`;
            const headers = this._getHeaders(apiKey);
            headers['Content-Type'] = 'text/plain';

            const payload = typeof content === 'string' ? content : JSON.stringify(content, null, 2);
            const res = await fetch(url, {
                method: 'POST',
                headers: headers,
                body: payload
            });

            if (res.status === 204 || res.status === 200) {
                return { success: true };
            }
            return { success: false, status: res.status };
        } catch (err) {
            return { success: false, error: err.message };
        }
    }

    /**
     * Format a 32-char UUID into standard 8-4-4-4-12 Minecraft format
     */
    _formatUuid(uuid) {
        if (!uuid) return '';
        const cleaned = uuid.replace(/-/g, '');
        if (cleaned.length === 32) {
            return cleaned.replace(/^(\w{8})(\w{4})(\w{4})(\w{4})(\w{12})$/, '$1-$2-$3-$4-$5');
        }
        return uuid;
    }

    /**
     * Synchronize a player's Microsoft account to a specific Pelican Minecraft server
     * 1. Sends console command `whitelist add <name>` & `whitelist reload`
     * 2. Also updates `whitelist.json` file directly on disk to guarantee permanent access even if server is offline
     */
    async syncPlayerToServer(identifier, account, apiKey, panelUrl = this.defaultPanelUrl) {
        const playerName = account.name;
        const playerUuid = this._formatUuid(account.uuid || '');
        const results = {
            commandSent: false,
            fileUpdated: false,
            server: identifier
        };

        // 1. Try sending console command (if server is running)
        try {
            const cmdRes = await this.sendCommand(identifier, `whitelist add ${playerName}`, apiKey, panelUrl);
            if (cmdRes.success) {
                results.commandSent = true;
                await this.sendCommand(identifier, 'whitelist reload', apiKey, panelUrl);
            }
        } catch (e) {
            console.warn(`[Pelican Sync] Commande console ignorée pour ${identifier}:`, e);
        }

        // 2. Direct file synchronization of whitelist.json (works online & offline)
        try {
            const fileRes = await this.getFileContents(identifier, 'whitelist.json', apiKey, panelUrl);
            let whitelist = [];
            if (fileRes.success && fileRes.content) {
                try {
                    whitelist = JSON.parse(fileRes.content);
                } catch (_) {
                    whitelist = [];
                }
            }

            if (!Array.isArray(whitelist)) whitelist = [];

            const exists = whitelist.some(entry => 
                (entry.name && entry.name.toLowerCase() === playerName.toLowerCase()) ||
                (playerUuid && entry.uuid && entry.uuid === playerUuid)
            );

            if (!exists) {
                whitelist.push({
                    uuid: playerUuid,
                    name: playerName
                });
                const writeRes = await this.writeFileContents(identifier, 'whitelist.json', whitelist, apiKey, panelUrl);
                if (writeRes.success) {
                    results.fileUpdated = true;
                }
            } else {
                results.fileUpdated = true;
            }
        } catch (e) {
            console.warn(`[Pelican Sync] Écriture de whitelist.json ignorée pour ${identifier}:`, e);
        }

        return {
            success: results.commandSent || results.fileUpdated,
            results
        };
    }

    /**
     * Synchronize Microsoft account across all user's Pelican Minecraft servers
     */
    async syncMicrosoftAccountToAllServers(account, apiKey, panelUrl = this.defaultPanelUrl, onProgress = () => {}) {
        if (!account || !account.name) {
            return { success: false, error: 'Compte Microsoft invalide ou non connecté' };
        }

        onProgress({ status: 'fetching', message: 'Recherche des serveurs Pelican Cloud...' });
        const serversRes = await this.getServers(apiKey, panelUrl);
        if (!serversRes.success || !serversRes.servers.length) {
            return { success: false, error: serversRes.error || 'Aucun serveur Pelican détecté sur votre compte' };
        }

        const mcServers = serversRes.servers.filter(s => s.isMinecraft !== false);
        if (!mcServers.length) {
            return { success: false, error: 'Aucun serveur Minecraft détecté sur votre compte Pelican' };
        }

        let syncedCount = 0;
        const details = [];

        for (const srv of mcServers) {
            onProgress({ 
                status: 'syncing', 
                serverName: srv.name, 
                message: `Synchronisation de ${account.name} sur ${srv.name}...` 
            });

            const syncRes = await this.syncPlayerToServer(srv.id, account, apiKey, panelUrl);
            if (syncRes.success) {
                syncedCount++;
            }
            details.push({
                serverName: srv.name,
                serverId: srv.id,
                success: syncRes.success
            });
        }

        onProgress({
            status: 'done',
            syncedCount,
            total: mcServers.length,
            message: `Compte synchronisé sur ${syncedCount}/${mcServers.length} serveur(s) Pelican !`
        });

        return {
            success: syncedCount > 0,
            syncedCount,
            totalServers: mcServers.length,
            details,
            playerName: account.name,
            playerUuid: account.uuid
        };
    }
}

module.exports = new PelicanService();
