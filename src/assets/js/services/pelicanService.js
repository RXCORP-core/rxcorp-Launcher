/**
 * RXCORP Launcher - Pelican Cloud API Service
 * Handles communication with Pelican Panel (panel.rxcorp.fr)
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { URL } = require('url');

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
                    language: data.attributes.language
                }
            };
        } catch (err) {
            return { success: false, error: err.message };
        }
    }

    /**
     * Get list of all servers owned by or shared with the user
     */
    async getServers(apiKey, panelUrl = this.defaultPanelUrl) {
        try {
            const url = `${panelUrl.replace(/\/+$/, '')}/api/client`;
            const res = await fetch(url, {
                method: 'GET',
                headers: this._getHeaders(apiKey)
            });

            if (!res.ok) {
                throw new Error(`Erreur API (${res.status}): ${await res.text()}`);
            }

            const json = await res.json();
            const servers = [];

            for (const item of (json.data || [])) {
                const attr = item.attributes;
                const allocations = attr.relationships?.allocations?.data || [];
                const defaultAlloc = allocations.find(a => a.attributes?.is_default) || allocations[0];

                let ip = 'node.rxcorp.fr';
                let port = 25565;

                if (defaultAlloc && defaultAlloc.attributes) {
                    ip = defaultAlloc.attributes.ip_alias || defaultAlloc.attributes.ip || ip;
                    port = defaultAlloc.attributes.port || port;
                }

                // Detect if it is a Minecraft server
                const invocation = (attr.invocation || '').toLowerCase();
                const dockerImage = (attr.docker_image || '').toLowerCase();
                const isMinecraft = invocation.includes('server.jar') || 
                                    invocation.includes('unix_args.txt') || 
                                    dockerImage.includes('yolks') || 
                                    dockerImage.includes('java') ||
                                    (attr.egg_features && attr.egg_features.includes('eula'));

                servers.push({
                    id: attr.identifier,
                    internalId: attr.internal_id,
                    uuid: attr.uuid,
                    name: attr.name,
                    description: attr.description || '',
                    node: attr.node,
                    isOwner: attr.server_owner,
                    ip: ip,
                    port: port,
                    limits: {
                        memory: attr.limits?.memory || 0,
                        cpu: attr.limits?.cpu || 0,
                        disk: attr.limits?.disk || 0
                    },
                    dockerImage: attr.docker_image,
                    isMinecraft: isMinecraft
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
     * Synchronize server mods to local instance /mods directory
     * 1. Inspects server mods
     * 2. Compares with local mods
     * 3. Downloads missing or updated mods
     */
    async syncModsToInstance(serverIdentifier, localModsDir, apiKey, panelUrl = this.defaultPanelUrl, progressCallback = () => {}) {
        if (!localModsDir) {
            throw new Error('Dossier de destination des mods introuvable pour cette instance.');
        }

        if (!fs.existsSync(localModsDir)) {
            fs.mkdirSync(localModsDir, { recursive: true });
        }

        progressCallback({ status: 'scan', message: 'Analyse des mods du serveur...' });
        const serverModsRes = await this.listServerMods(serverIdentifier, apiKey, panelUrl);
        if (!serverModsRes.success) {
            throw new Error(serverModsRes.error || 'Impossible de lister les mods du serveur');
        }

        const serverMods = serverModsRes.mods;
        const localFiles = fs.readdirSync(localModsDir).filter(f => f.endsWith('.jar'));

        // Determine which mods need to be downloaded
        const toDownload = [];
        for (const mod of serverMods) {
            const localFilePath = path.join(localModsDir, mod.name);
            if (!fs.existsSync(localFilePath)) {
                toDownload.push(mod);
            } else {
                const stat = fs.statSync(localFilePath);
                // If local size differs significantly from server size, redownload
                if (Math.abs(stat.size - mod.size) > 100) {
                    toDownload.push(mod);
                }
            }
        }

        progressCallback({ 
            status: 'found', 
            totalServerMods: serverMods.length, 
            toDownloadCount: toDownload.length,
            message: `${toDownload.length} mod(s) à télécharger sur ${serverMods.length} total.`
        });

        let downloadedCount = 0;
        for (const mod of toDownload) {
            progressCallback({
                status: 'downloading',
                modName: mod.name,
                current: downloadedCount + 1,
                total: toDownload.length,
                percent: 0,
                message: `Téléchargement de ${mod.name}...`
            });

            const dlRes = await this.getDownloadUrl(serverIdentifier, `/mods/${mod.name}`, apiKey, panelUrl);
            if (!dlRes.success || !dlRes.url) {
                console.error(`Impossible d'obtenir le lien pour ${mod.name}:`, dlRes.error);
                continue;
            }

            const destPath = path.join(localModsDir, mod.name);
            await this.downloadFile(dlRes.url, destPath, (loaded, total) => {
                const percent = Math.round((loaded / total) * 100);
                progressCallback({
                    status: 'downloading',
                    modName: mod.name,
                    current: downloadedCount + 1,
                    total: toDownload.length,
                    percent: percent,
                    message: `Téléchargement de ${mod.name} (${percent}%)`
                });
            });

            downloadedCount++;
        }

        progressCallback({ 
            status: 'completed', 
            downloadedCount,
            message: 'Synchronisation des mods terminée avec succès !' 
        });

        return {
            success: true,
            totalServerMods: serverMods.length,
            downloadedCount
        };
    }
}

module.exports = new PelicanService();
