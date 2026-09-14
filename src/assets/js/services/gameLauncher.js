/**
 * RXCORP Launcher - Minecraft Game Launch Service
 * Uses minecraft-java-core with multi-instance support and automatic server connection
 */

const path = require('path');
const fs = require('fs');
const { Launch } = require('minecraft-java-core');
const { app, ipcRenderer } = require('electron');

class GameLauncher {
    constructor() {
        this.currentLaunch = null;
        this.isRunning = false;
    }

    /**
     * Launch an instance
     * @param {Object} instance - The instance object
     * @param {Object} account - Authenticated account
     * @param {Object} settings - Launcher settings (RAM, Java path, screen size)
     * @param {Object} callbacks - Event callbacks (onProgress, onSpeed, onStatus, onGameStart, onGameClose, onError)
     */
    async launch(instance, account, settings = {}, callbacks = {}) {
        if (this.isRunning) {
            throw new Error('Un jeu est déjà en cours d\'exécution !');
        }

        const onProgress = callbacks.onProgress || (() => {});
        const onSpeed = callbacks.onSpeed || (() => {});
        const onStatus = callbacks.onStatus || (() => {});
        const onGameStart = callbacks.onGameStart || (() => {});
        const onGameClose = callbacks.onGameClose || (() => {});
        const onError = callbacks.onError || (() => {});

        try {
            this.isRunning = true;
            this.currentLaunch = new Launch();

            // Default RAM
            const minRam = (settings.ramMin || instance.javaMemory?.min || 2) * 1024;
            const maxRam = (settings.ramMax || instance.javaMemory?.max || 4) * 1024;

            // Loader config
            let loaderType = 'none';
            if (instance.loader === 'forge') loaderType = 'forge';
            else if (instance.loader === 'fabric') loaderType = 'fabric';
            else if (instance.loader === 'neoforge') loaderType = 'neoforge';

            // Server auto-connect arguments
            const gameArgs = [];
            if (instance.serverAddress) {
                const parts = instance.serverAddress.split(':');
                const host = parts[0];
                const port = parts[1] || '25565';
                gameArgs.push('--server', host, '--port', port);
            }

            // Fallback offline account if none provided
            const authenticator = account || {
                name: 'Player',
                uuid: '00000000-0000-0000-0000-000000000000',
                access_token: 'null',
                meta: { type: 'Mojang', online: false }
            };

            const launchOptions = {
                authenticator: authenticator,
                path: instance.path,
                version: instance.version || '26.2',
                detached: true,
                downloadFileMultiple: 6,
                loader: {
                    type: loaderType,
                    version: instance.version || '26.2',
                    build: instance.loaderVersion || 'latest',
                    enable: loaderType !== 'none'
                },
                verify: false,
                ignored: ['mods', 'resourcepacks', 'shaderpacks', 'saves'],
                java: {
                    path: settings.javaPath || null
                },
                JVM_ARGS: [],
                GAME_ARGS: gameArgs,
                screen: {
                    width: settings.screenWidth || 1280,
                    height: settings.screenHeight || 720
                },
                memory: {
                    min: `${minRam}M`,
                    max: `${maxRam}M`
                }
            };

            const recentLogs = [];

            this.currentLaunch.on('extract', extract => {
                onStatus('Extraction des composants...');
            });

            this.currentLaunch.on('progress', (progress, size) => {
                const percent = size > 0 ? Math.round((progress / size) * 100) : 0;
                onProgress(percent, progress, size);
                onStatus(`Téléchargement des fichiers (${percent}%)...`);
            });

            this.currentLaunch.on('check', (progress, size) => {
                const percent = size > 0 ? Math.round((progress / size) * 100) : 0;
                onProgress(percent, progress, size);
                onStatus(`Vérification des fichiers (${percent}%)...`);
            });

            this.currentLaunch.on('speed', speed => {
                const mbps = (speed / (1024 * 1024)).toFixed(2);
                onSpeed(mbps);
            });

            this.currentLaunch.on('patch', () => {
                onStatus('Application des patches du loader...');
            });

            const launchStartTime = Date.now();
            let gameStarted = false;
            let hasFatalError = false;

            this.currentLaunch.on('data', data => {
                const str = data.toString();
                recentLogs.push(str);
                if (recentLogs.length > 50) recentLogs.shift();
                console.log('[Minecraft]', str);

                if (str.includes('Exception in thread "main"') || 
                    str.includes('Minecraft has crashed!') ||
                    str.includes('A potential solution has been determined:') ||
                    str.includes('ModLoadingException')) {
                    hasFatalError = true;
                }

                if (!gameStarted) {
                    gameStarted = true;
                    onStatus('Minecraft est démarré ! Bon jeu.');
                    onGameStart();
                }
            });

            this.currentLaunch.on('close', () => {
                this.isRunning = false;
                this.currentLaunch = null;

                // Check if a NEW crash report was generated during THIS game session
                let newCrashContent = null;
                const crashReportsDir = path.join(instance.path, 'crash-reports');
                try {
                    if (fs.existsSync(crashReportsDir)) {
                        const crashFiles = fs.readdirSync(crashReportsDir)
                            .filter(f => f.endsWith('.txt'))
                            .map(f => {
                                const filePath = path.join(crashReportsDir, f);
                                const stat = fs.statSync(filePath);
                                return { name: f, path: filePath, mtime: stat.mtimeMs };
                            })
                            .filter(f => f.mtime >= launchStartTime - 3000)
                            .sort((a, b) => b.mtime - a.mtime);

                        if (crashFiles.length > 0) {
                            const content = fs.readFileSync(crashFiles[0].path, 'utf8');
                            const lines = content.split('\n').slice(0, 30).join('\n');
                            newCrashContent = `\n\n[Rapport de crash (${crashFiles[0].name})]:\n${lines}`;
                        }
                    }
                } catch (e) {
                    console.error('Error reading crash reports:', e);
                }

                // If no new crash report and no fatal error and game actually started, it's a normal close
                const isCrash = Boolean(newCrashContent || hasFatalError || (!gameStarted));

                if (isCrash) {
                    let crashDetail = newCrashContent || '';
                    if (!crashDetail && recentLogs.length > 0) {
                        crashDetail = `\n\n[Derniers logs]:\n${recentLogs.slice(-15).join('\n')}`;
                    }
                    console.error('[Minecraft Crash]', crashDetail);
                    onError(new Error(`Minecraft s'est arrêté de manière anormale.${crashDetail}`));
                } else {
                    onStatus('Jeu fermé.');
                    onGameClose();
                }
            });

            this.currentLaunch.on('error', err => {
                this.isRunning = false;
                this.currentLaunch = null;
                const msg = typeof err === 'object' ? (err.message || err.error || JSON.stringify(err)) : String(err);
                console.error('[Launcher Error]', msg);
                onError(new Error(msg));
            });

            onStatus('Préparation du lancement...');
            this.currentLaunch.Launch(launchOptions);

            return true;
        } catch (err) {
            this.isRunning = false;
            this.currentLaunch = null;
            onError(err);
            throw err;
        }
    }
}

module.exports = new GameLauncher();
