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
                details: activity.details || 'Launcher RXCORP',
                state: activity.state || 'En attente',
                largeImageKey: activity.largeImageKey || 'logo',
                largeImageText: activity.largeImageText || 'RXCORP - Launcher & Cloud Minecraft',
                smallImageKey: activity.smallImageKey || 'icon',
                smallImageText: activity.smallImageText || 'v2.1',
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
            details: 'Menu Principal',
            state: 'En attente dans le launcher',
            largeImageKey: 'logo',
            largeImageText: 'RXCORP - Launcher & Cloud Minecraft',
            smallImageKey: 'icon',
            smallImageText: 'En attente',
            startTimestamp: this.startTimestamp,
            buttons: [
                { label: 'Site Officiel', url: 'https://rxcorp.fr' }
            ]
        });
    }

    setLaunching() {
        this.setActivity({
            details: 'Lancement du jeu',
            state: 'Synchronisation des mods & ressources...',
            largeImageKey: 'logo',
            largeImageText: 'RXCORP - Launcher & Cloud Minecraft',
            smallImageKey: 'icon',
            smallImageText: 'Chargement...',
            startTimestamp: Date.now(),
            buttons: [
                { label: 'Site Officiel', url: 'https://rxcorp.fr' }
            ]
        });
    }

    setPlaying(instanceName = 'RX Serv') {
        this.setActivity({
            details: 'En jeu sur Minecraft',
            state: `Profil : ${instanceName}`,
            largeImageKey: 'logo',
            largeImageText: 'RXCORP - Launcher & Cloud Minecraft',
            smallImageKey: 'icon',
            smallImageText: 'En jeu',
            startTimestamp: Date.now(),
            buttons: [
                { label: 'Site Officiel', url: 'https://rxcorp.fr' }
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
