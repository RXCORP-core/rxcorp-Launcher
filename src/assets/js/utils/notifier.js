/**
 * DeltaZone - Tactical Desktop Notifier
 * Monitors server news, mod updates, and system alerts
 */

const { ipcRenderer } = require('electron');
const nodeFetch = require('node-fetch');

export class Notifier {
    constructor() {
        this.checkInterval = 45 * 1000; // Verification toutes les 45 secondes
        this.apiBase = 'http://192.168.1.149:8088';
        this.isChecking = false;
    }

    send(title, body) {
        try {
            ipcRenderer.send('send-notification', { title, body });
        } catch (e) {
            console.error('[Notifier] Erreur envoi:', e);
        }
    }

    async init() {
        console.log('[Notifier] System de notifications tactique initialise');

        // Notification d'accueil si pas encore envoyee dans la session
        if (!sessionStorage.getItem('dz_welcomed')) {
            setTimeout(() => {
                this.send(
                    'TERMINAL DELTAZONE OPÉRATIONNEL',
                    'Veille active : Mises à jour des mods, transmissions radio et état du serveur surveillés.'
                );
                sessionStorage.setItem('dz_welcomed', 'true');
            }, 2500);
        }

        // Première vérification après chargement de l'interface
        setTimeout(() => this.checkAll(), 5000);

        // Surveillance périodique
        setInterval(() => this.checkAll(), this.checkInterval);
    }

    async checkAll() {
        if (this.isChecking) return;
        this.isChecking = true;

        try {
            await this.checkModUpdates();
        } catch (e) {
            console.warn('[Notifier] Erreur mods check:', e.message);
        }

        try {
            await this.checkNewsUpdates();
        } catch (e) {
            console.warn('[Notifier] Erreur news check:', e.message);
        }

        this.isChecking = false;
    }

    async checkModUpdates() {
        let url = `${this.apiBase}/instances?instance=deltazone-zombie`;
        let res = await nodeFetch(url, { timeout: 4000 }).then(r => r.json()).catch(() => null);
        if (!res || !res.value) return;

        let mods = res.value;
        let currentSignature = mods.map(m => `${m.path}:${m.hash || m.size || ''}`).sort().join(';');

        let savedSignature = localStorage.getItem('dz_mods_signature');

        if (savedSignature && savedSignature !== currentSignature) {
            let oldEntries = new Set(savedSignature.split(';'));
            let newOrUpdated = mods.filter(m => !oldEntries.has(`${m.path}:${m.hash || m.size || ''}`));

            let count = newOrUpdated.length;
            let modNames = newOrUpdated.map(m => m.path.replace('mods/', '')).slice(0, 2).join(', ');
            if (newOrUpdated.length > 2) modNames += ` (+${newOrUpdated.length - 2})`;

            this.send(
                'MODS ACTUALISÉS // DELTAZONE',
                count > 0 
                    ? `${count} mod(s) mis à jour sur le serveur : ${modNames}. Cliquez sur SURVIVRE pour synchroniser !`
                    : 'La liste des mods du serveur a été mise à jour ! Synchronisation disponible.'
            );
        }

        localStorage.setItem('dz_mods_signature', currentSignature);
    }

    async checkNewsUpdates() {
        let url = `${this.apiBase}/articles`;
        let res = await nodeFetch(url, { timeout: 4000 }).then(r => r.json()).catch(() => null);
        if (!res) return;

        let articles = Array.isArray(res) ? res : res.articles || [];
        if (!articles.length) return;

        let latest = articles[0];
        let newsKey = (latest.title || '') + '_' + (latest.publish_date || '');
        let savedKey = localStorage.getItem('dz_news_key');

        if (savedKey && savedKey !== newsKey) {
            let cleanText = (latest.content || '').replace(/<[^>]*>?/gm, '').trim().substring(0, 80);
            this.send(
                `TRANSMISSION RADIO // ${latest.title || 'ALERTE'}`,
                cleanText ? `${cleanText}...` : 'Nouveau rapport d\'urgence disponible sur le terminal.'
            );
        }

        localStorage.setItem('dz_news_key', newsKey);
    }
}

export default new Notifier();