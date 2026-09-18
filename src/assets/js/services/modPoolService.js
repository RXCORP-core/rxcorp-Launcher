/**
 * RXCORP Launcher - Link-Sync Central Mod Pool Service
 * Manages shared mod storage and NTFS hardlinks across instances
 * Zero duplication, instant sync, and jar integrity validation
 */

const fs = require('fs');
const path = require('path');

class ModPoolService {
    constructor() {
        this.poolDir = null;
    }

    /**
     * Get or create the shared mods pool directory
     * Always located on the same drive/partition as instances to guarantee NTFS hardlinks
     */
    getPoolDir() {
        if (!this.poolDir) {
            let baseParent;
            if (process.env.APPDATA) {
                baseParent = path.join(process.env.APPDATA, 'RXCORP-Launcher');
            } else {
                baseParent = path.join(process.env.HOME || process.env.USERPROFILE || '.', '.rxcorp');
            }
            this.poolDir = path.join(baseParent, 'shared_mods_pool');
            if (!fs.existsSync(this.poolDir)) {
                fs.mkdirSync(this.poolDir, { recursive: true });
            }
        }
        return this.poolDir;
    }

    /**
     * Validate that a file is a clean and uncorrupted JAR/ZIP archive
     */
    isJarValid(filePath) {
        try {
            if (!fs.existsSync(filePath)) return false;
            const stat = fs.statSync(filePath);
            if (stat.size < 100) return false;

            const fd = fs.openSync(filePath, 'r');
            const buffer = Buffer.alloc(4);
            fs.readSync(fd, buffer, 0, 4, 0);
            fs.closeSync(fd);

            // Check PK\x03\x04 magic number
            return buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04;
        } catch (_) {
            return false;
        }
    }

    /**
     * Check if a mod already exists in the central pool with valid integrity
     */
    hasModInPool(modName, expectedSize = 0) {
        const poolPath = path.join(this.getPoolDir(), modName);
        if (!fs.existsSync(poolPath)) return false;
        if (!this.isJarValid(poolPath)) return false;

        if (expectedSize > 0) {
            const stat = fs.statSync(poolPath);
            if (Math.abs(stat.size - expectedSize) > 100) {
                return false;
            }
        }
        return true;
    }

    /**
     * Store a verified mod in the central pool
     */
    storeModInPool(modName, tempFilePath) {
        if (!this.isJarValid(tempFilePath)) {
            throw new Error(`Le fichier ${modName} est corrompu ou n'est pas une archive JAR valide.`);
        }

        const destPoolPath = path.join(this.getPoolDir(), modName);
        if (fs.existsSync(destPoolPath)) {
            try { fs.unlinkSync(destPoolPath); } catch (_) {}
        }

        try {
            fs.renameSync(tempFilePath, destPoolPath);
        } catch (_) {
            fs.copyFileSync(tempFilePath, destPoolPath);
            try { fs.unlinkSync(tempFilePath); } catch (_) {}
        }

        return destPoolPath;
    }

    /**
     * Link a mod from the central pool to an instance's mods directory
     * Uses NTFS hardlink (0 bytes additional disk usage) with graceful copy fallback
     */
    linkModToInstance(modName, instanceModsDir) {
        if (!fs.existsSync(instanceModsDir)) {
            fs.mkdirSync(instanceModsDir, { recursive: true });
        }

        const poolFile = path.join(this.getPoolDir(), modName);
        const targetFile = path.join(instanceModsDir, modName);

        if (!fs.existsSync(poolFile)) {
            throw new Error(`Mod ${modName} introuvable dans le pool central.`);
        }

        // If target file already exists, check if it already shares inode with pool file
        if (fs.existsSync(targetFile)) {
            try {
                const statTarget = fs.statSync(targetFile);
                const statPool = fs.statSync(poolFile);
                if (statTarget.ino && statTarget.ino === statPool.ino) {
                    return { success: true, method: 'already-linked', file: modName };
                }
                fs.unlinkSync(targetFile);
            } catch (_) {}
        }

        // Attempt NTFS / POSIX Hardlink (zero additional disk space)
        try {
            fs.linkSync(poolFile, targetFile);
            return { success: true, method: 'hardlink', file: modName };
        } catch (linkErr) {
            console.warn(`[Link-Sync] Hardlink impossible pour ${modName}, fallback copie:`, linkErr.message);
            try {
                fs.copyFileSync(poolFile, targetFile);
                return { success: true, method: 'copy', file: modName };
            } catch (copyErr) {
                throw new Error(`Impossible d'injecter le mod ${modName}: ${copyErr.message}`);
            }
        }
    }

    /**
     * Remove obsolete mods from instance that are not present on the server
     * Note: Does NOT delete from central pool, preserving global cache
     */
    cleanInstanceMods(serverModNamesSet, instanceModsDir) {
        if (!fs.existsSync(instanceModsDir)) return [];
        const localFiles = fs.readdirSync(instanceModsDir).filter(f => f.endsWith('.jar'));
        const removed = [];

        for (const file of localFiles) {
            if (!serverModNamesSet.has(file)) {
                const filePath = path.join(instanceModsDir, file);
                try {
                    fs.unlinkSync(filePath);
                    removed.push(file);
                } catch (e) {
                    console.warn(`[Link-Sync] Impossible de retirer ${file}:`, e);
                }
            }
        }
        return removed;
    }

    /**
     * Calculate disk savings across instances using the pool
     */
    calculateSavings(instancesBaseDir) {
        try {
            const pool = this.getPoolDir();
            if (!fs.existsSync(pool)) return { poolCount: 0, poolBytes: 0, savedBytes: 0 };

            const poolFiles = fs.readdirSync(pool).filter(f => f.endsWith('.jar'));
            let poolBytes = 0;
            const poolInos = new Map();

            for (const f of poolFiles) {
                const stat = fs.statSync(path.join(pool, f));
                poolBytes += stat.size;
                if (stat.ino) {
                    poolInos.set(stat.ino, { size: stat.size, links: stat.nlink || 1 });
                }
            }

            let savedBytes = 0;
            for (const [_, info] of poolInos) {
                if (info.links > 1) {
                    savedBytes += info.size * (info.links - 1);
                }
            }

            return {
                poolCount: poolFiles.length,
                poolBytes,
                savedBytes
            };
        } catch (_) {
            return { poolCount: 0, poolBytes: 0, savedBytes: 0 };
        }
    }
}

module.exports = new ModPoolService();
