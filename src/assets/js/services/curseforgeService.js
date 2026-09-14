/**
 * RXCORP Launcher - CurseForge Integration Service
 * Browse, search and install mods from CurseForge API (https://api.curseforge.com)
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

let Store = null;
let store = null;
try {
    Store = require('electron-store');
    store = new Store();
} catch (e) {}

const OFFICIAL_CF_KEY = '$2a$10$WiePrlPNrhm64t5neMiRGul2uculPVwZo56ZU0A1qZos02AChjqMa';

class CurseForgeService {
    constructor() {
        this.baseUrl = 'https://api.curseforge.com/v1';
        this.gameId = 432; // Minecraft
        this.classIdMods = 6; // Minecraft Mods
    }

    getApiKey() {
        const custom = store ? store.get('curseforgeApiKey') : '';
        return (custom && custom.trim()) ? custom.trim() : OFFICIAL_CF_KEY;
    }

    setApiKey(key) {
        if (store) {
            store.set('curseforgeApiKey', key ? key.trim() : '');
        }
    }

    _getHeaders() {
        const key = this.getApiKey();
        return {
            'Accept': 'application/json',
            'x-api-key': key
        };
    }

    _mapLoader(loader) {
        if (!loader) return 0;
        const l = loader.toLowerCase();
        if (l === 'forge') return 1;
        if (l === 'fabric') return 4;
        if (l === 'neoforge') return 6;
        return 0;
    }

    /**
     * Search mods on CurseForge
     */
    async searchMods({ query = '', version = null, loader = null, categoryId = null, limit = 20 }) {
        const apiKey = this.getApiKey();
        if (!apiKey) {
            return {
                success: false,
                needApiKey: true,
                error: 'Clé API CurseForge requise. Renseignez votre clé dans les Paramètres pour rechercher sur CurseForge.',
                mods: []
            };
        }

        try {
            const params = new URLSearchParams({
                gameId: this.gameId.toString(),
                classId: this.classIdMods.toString(),
                pageSize: limit.toString(),
                sortField: '2', // Popularity
                sortOrder: 'desc'
            });

            if (query && query.trim()) {
                params.append('searchFilter', query.trim());
            }
            if (version) {
                params.append('gameVersion', version);
            }
            if (loader && loader !== 'vanilla') {
                const loaderType = this._mapLoader(loader);
                if (loaderType > 0) {
                    params.append('modLoaderType', loaderType.toString());
                }
            }
            if (categoryId) {
                params.append('categoryId', categoryId.toString());
            }

            const url = `${this.baseUrl}/mods/search?${params.toString()}`;
            const res = await fetch(url, { headers: this._getHeaders() });

            if (!res.ok) {
                if (res.status === 403 || res.status === 401) {
                    return {
                        success: false,
                        needApiKey: true,
                        error: 'Clé API CurseForge invalide ou expirée.',
                        mods: []
                    };
                }
                throw new Error(`Erreur API CurseForge (${res.status})`);
            }

            const data = await res.json();
            const hits = data.data || [];

            return {
                success: true,
                totalHits: data.pagination?.totalCount || hits.length,
                mods: hits.map(hit => ({
                    id: hit.id,
                    slug: hit.slug,
                    title: hit.name,
                    description: hit.summary || '',
                    iconUrl: hit.logo?.thumbnailUrl || hit.logo?.url || 'assets/images/icon/icon.png',
                    author: (hit.authors && hit.authors[0]) ? hit.authors[0].name : 'Inconnu',
                    downloads: hit.downloadCount || 0,
                    follows: hit.thumbsUpCount || 0,
                    categories: (hit.categories || []).map(c => c.name),
                    source: 'curseforge'
                }))
            };
        } catch (err) {
            console.error('[CurseForge Search Error]:', err);
            return { success: false, error: err.message, mods: [] };
        }
    }

    /**
     * Get compatible files for a mod
     */
    async getCompatibleVersions(modId, mcVersion = null, loader = null) {
        const apiKey = this.getApiKey();
        if (!apiKey) {
            return { success: false, error: 'Clé API requise', versions: [] };
        }

        try {
            const params = new URLSearchParams();
            if (mcVersion) params.append('gameVersion', mcVersion);
            if (loader && loader !== 'vanilla') {
                const loaderType = this._mapLoader(loader);
                if (loaderType > 0) params.append('modLoaderType', loaderType.toString());
            }

            const url = `${this.baseUrl}/mods/${modId}/files?${params.toString()}`;
            const res = await fetch(url, { headers: this._getHeaders() });

            if (!res.ok) {
                throw new Error(`Erreur récupération fichiers CurseForge (${res.status})`);
            }

            const data = await res.json();
            const files = data.data || [];

            return {
                success: true,
                versions: files.map(f => {
                    let downloadUrl = f.downloadUrl;
                    if (!downloadUrl && f.id && f.fileName) {
                        const part1 = Math.floor(f.id / 1000);
                        const part2 = f.id % 1000;
                        downloadUrl = `https://edge.forgecdn.net/files/${part1}/${part2}/${encodeURIComponent(f.fileName)}`;
                    }
                    return {
                        id: f.id,
                        name: f.displayName,
                        versionNumber: f.fileName,
                        fileName: f.fileName,
                        downloadUrl,
                        gameVersions: f.gameVersions
                    };
                })
            };
        } catch (err) {
            console.error('[CurseForge Files Error]:', err);
            return { success: false, error: err.message, versions: [] };
        }
    }

    /**
     * Download and install mod file to target directory
     */
    async installMod(targetModsDir, downloadUrl, fileName) {
        if (!fs.existsSync(targetModsDir)) {
            fs.mkdirSync(targetModsDir, { recursive: true });
        }

        const dest = path.join(targetModsDir, fileName);

        return new Promise((resolve, reject) => {
            const client = downloadUrl.startsWith('https') ? https : http;
            const request = client.get(downloadUrl, (res) => {
                if (res.statusCode === 301 || res.statusCode === 302) {
                    return this.installMod(targetModsDir, res.headers.location, fileName)
                        .then(resolve)
                        .catch(reject);
                }

                if (res.statusCode !== 200) {
                    return reject(new Error(`Téléchargement échoué (${res.statusCode})`));
                }

                const fileStream = fs.createWriteStream(dest);
                res.pipe(fileStream);

                fileStream.on('finish', () => {
                    fileStream.close();
                    resolve(dest);
                });

                fileStream.on('error', (err) => {
                    fs.unlink(dest, () => {});
                    reject(err);
                });
            });

            request.on('error', (err) => {
                reject(err);
            });
        });
    }
}

module.exports = new CurseForgeService();
