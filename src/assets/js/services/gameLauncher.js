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
                instance: instance.name,
                version: instance.version,
                detached: true,
                downloadFileMultiple: 6,
                loader: {
                    type: loaderType,
                    build: instance.loaderVersion || 'latest',
                    enable: loaderType !== 'none'
                },
                verify: false,
                ignored: ['mods', 'resourcepacks', 'shaderpacks', 'saves'],
                java: {
                    path: settings.javaPath || null
                },
                JVM_ARGS: [
                    '-XX:+UseG1GC',
                    '-XX:+ParallelRefProcEnabled',
                    '-XX:MaxGCPauseMillis=200',
                    '-XX:+UnlockExperimentalVMOptions',
                    '-XX:+DisableExplicitGC',
                    '-XX:+AlwaysPreTouch',
                    '-XX:G1NewSizePercent=30',
                    '-XX:G1MaxNewSizePercent=40',
                    '-XX:G1ReservePercent=20',
                    '-XX:G1HeapWastePercent=5',
                    '-XX:G1MixedGCCountTarget=4'
                ],
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

            onStatus('Préparation du lancement...');

            this.currentLaunch.Launch(launchOptions);

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
                onStatus('Application des patches...');
            });

            let gameStarted = false;
            this.currentLaunch.on('data', data => {
                const str = data.toString();
                if (!gameStarted) {
                    gameStarted = true;
                    onStatus('Minecraft est démarré ! Bon jeu.');
                    onGameStart();
                }
            });

            this.currentLaunch.on('close', code => {
                this.isRunning = false;
                this.currentLaunch = null;
                onStatus('Jeu fermé.');
                onGameClose(code);
            });

            this.currentLaunch.on('error', err => {
                this.isRunning = false;
                this.currentLaunch = null;
                onError(err);
            });

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
