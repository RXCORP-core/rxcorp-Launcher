const DiscordRPC = require('discord-rpc');

class DiscordManager {
    constructor() {
        this.clientId = '1546525834381238393';
        this.client = null;
        this.connected = false;
        this.startTimestamp = Date.now();
        this.currentActivity = null;
        this.reconnectTimeout = null;
    }

    init() {
        if (this.client) return;
        try {
            DiscordRPC.register(this.clientId);
        } catch (e) {
            console.warn('[Discord RPC] Enregistrement protocole ignore:', e.message);
        }

        this.connect();
    }

    connect() {
        if (this.connected) return;
        this.client = new DiscordRPC.Client({ transport: 'ipc' });

        this.client.on('ready', () => {
            this.connected = true;
            console.log(`[Discord RPC] Connecte a Discord en tant que ${this.client.user.username}`);
            if (this.currentActivity) {
                this.setActivity(this.currentActivity);
            } else {
                this.setIdle();
            }
        });

        this.client.on('error', (err) => {
            console.warn('[Discord RPC] Erreur de communication:', err.message);
        });

        this.client.on('disconnected', () => {
            this.connected = false;
            console.log('[Discord RPC] Deconnecte de Discord. Nouvelle tentative dans 30s...');
            this.scheduleReconnect();
        });

        this.client.login({ clientId: this.clientId }).catch((err) => {
            this.connected = false;
            console.log('[Discord RPC] Discord n\'est pas ouvert ou inaccessible (' + err.message + '). Reconnexion dans 30s...');
            this.scheduleReconnect();
        });
    }

    scheduleReconnect() {
        if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
        this.reconnectTimeout = setTimeout(() => {
            this.connect();
        }, 30000);
    }

    setActivity(activity) {
        this.currentActivity = activity;
        if (!this.connected || !this.client) return;

        try {
            const data = {
                details: activity.details || 'Terminal Tactique DeltaZone',
                state: activity.state || 'Survie Zombie 1.20.1',
                largeImageKey: activity.largeImageKey || 'logo',
                largeImageText: activity.largeImageText || 'DeltaZone - Serveur Post-Apocalyptique',
                smallImageKey: activity.smallImageKey || 'icon',
                smallImageText: activity.smallImageText || 'v1.20.1',
                instance: false,
            };

            if (activity.startTimestamp) {
                data.startTimestamp = activity.startTimestamp;
            }

            if (activity.buttons && Array.isArray(activity.buttons) && activity.buttons.length > 0) {
                data.buttons = activity.buttons.slice(0, 2);
            }

            this.client.setActivity(data).then(() => {
                console.log(`[Discord RPC] Activité mise à jour : "${data.details}" | Image: "${data.largeImageKey}"`);
            }).catch((err) => {
                console.warn('[Discord RPC] Impossible de definir l\'activite:', err.message);
            });
        } catch (err) {
            console.error('[Discord RPC] Exception setActivity:', err);
        }
    }

    setIdle() {
        this.setActivity({
            details: 'Survie dans le bunker',
            state: 'Menu Principal // Prêt au combat',
            largeImageKey: 'logo',
            largeImageText: 'DeltaZone - Serveur Minecraft Zombie',
            smallImageKey: 'icon',
            smallImageText: 'En attente',
            startTimestamp: this.startTimestamp,
            buttons: [
                { label: 'Rejoindre le Discord', url: 'https://discord.gg/deltazone' }
            ]
        });
    }

    setLaunching() {
        this.setActivity({
            details: 'Préparation du paquetage',
            state: 'Synchronisation des mods & ressources...',
            largeImageKey: 'logo',
            largeImageText: 'DeltaZone - Serveur Minecraft Zombie',
            smallImageKey: 'icon',
            smallImageText: 'Chargement...',
            startTimestamp: Date.now(),
            buttons: [
                { label: 'Rejoindre le Discord', url: 'https://discord.gg/deltazone' }
            ]
        });
    }

    setPlaying(instanceName = 'Secteur-04') {
        this.setActivity({
            details: 'Zone Infectée // Survie en cours',
            state: `Instance: ${instanceName} (Touche [M] pour le PDA)`,
            largeImageKey: 'logo',
            largeImageText: 'DeltaZone - Apocalypse Zombie',
            smallImageKey: 'icon',
            smallImageText: 'En Survie',
            startTimestamp: Date.now(),
            buttons: [
                { label: 'Rejoindre le Discord', url: 'https://discord.gg/deltazone' }
            ]
        });
    }

    destroy() {
        if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
        if (this.client) {
            try {
                this.client.destroy();
            } catch (e) {}
            this.client = null;
            this.connected = false;
        }
    }
}

module.exports = new DiscordManager();
