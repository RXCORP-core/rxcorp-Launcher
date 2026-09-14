/**
 * RXCORP Launcher - Master Application Controller
 * Handles UI interactions, services coordination and state management
 */

const { ipcRenderer, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const Store = require('electron-store');

// Services
const servicesDir = fs.existsSync(path.join(__dirname, 'services'))
    ? path.join(__dirname, 'services')
    : (fs.existsSync(path.join(__dirname, 'assets/js/services')) 
        ? path.join(__dirname, 'assets/js/services') 
        : path.join(__dirname, 'src/assets/js/services'));

const pelicanService = require(path.join(servicesDir, 'pelicanService.js'));
const instanceService = require(path.join(servicesDir, 'instanceService.js'));
const modrinthService = require(path.join(servicesDir, 'modrinthService.js'));
const pvpService = require(path.join(servicesDir, 'pvpService.js'));
const gameLauncher = require(path.join(servicesDir, 'gameLauncher.js'));

// Local storage
const store = new Store({
    defaults: {
        panelUrl: 'https://panel.rxcorp.fr',
        apiKey: '',
        activeInstanceId: null,
        ramMax: 4,
        javaPath: '',
        accounts: [
            {
                name: 'Player',
                uuid: '00000000-0000-0000-0000-000000000000',
                meta: { type: 'Mojang', online: false }
            }
        ],
        activeAccountName: 'Player'
    }
});

class RxcorpApp {
    constructor() {
        this.activeView = 'cloud';
        this.activeDribbbleMode = store.get('activeDribbbleMode') || 'cloud';
        this.activeCloudInstanceId = store.get('activeCloudInstanceId') || null;
        this.activePvpInstanceId = store.get('activePvpInstanceId') || null;
        this.activeLocalInstanceId = store.get('activeLocalInstanceId') || null;
        this.activeInstance = null;
        this.cloudServers = [];
        this.isSyncing = false;
    }

    /**
     * Get current active domain based on UI mode ('cloud' | 'pvp' | 'local')
     */
    getCurrentDomain() {
        if (this.activeDribbbleMode === 'cloud') return 'cloud';
        if (this.activeDribbbleMode === 'pvp') return 'pvp';
        return 'local';
    }

    /**
     * Get active instance for a given domain, with auto-fallback and auto-provisioning
     */
    getActiveInstanceForDomain(domain = null) {
        const d = domain || this.getCurrentDomain();
        let targetId = null;
        if (d === 'cloud') targetId = this.activeCloudInstanceId;
        else if (d === 'pvp') targetId = this.activePvpInstanceId;
        else targetId = this.activeLocalInstanceId;

        if (targetId) {
            const inst = instanceService.getInstance(targetId);
            if (inst && inst.domain === d) return inst;
        }

        // Fallback: search existing instances for this domain
        const domainList = instanceService.getInstancesByDomain(d);
        if (domainList.length > 0) {
            const chosen = domainList[0];
            this.setActiveInstanceForDomain(d, chosen.id, false);
            return chosen;
        }

        // Auto-provision if necessary
        if (d === 'pvp') {
            const pvpInst = pvpService.getOrCreatePvpProfile('1.21');
            if (pvpInst) {
                this.setActiveInstanceForDomain('pvp', pvpInst.id, false);
                return pvpInst;
            }
        }

        if (d === 'local' && instanceService.getLocalInstances().length === 0) {
            const localInst = instanceService.createInstance({
                name: 'Mon Profil Local',
                version: '1.21.1',
                loader: 'fabric',
                domain: 'local'
            });
            this.setActiveInstanceForDomain('local', localInst.id, false);
            return localInst;
        }

        return null;
    }

    /**
     * Set active instance for a specific domain
     */
    setActiveInstanceForDomain(domain, id, updatePill = true) {
        if (domain === 'cloud') {
            this.activeCloudInstanceId = id;
            store.set('activeCloudInstanceId', id);
        } else if (domain === 'pvp') {
            this.activePvpInstanceId = id;
            store.set('activePvpInstanceId', id);
        } else {
            this.activeLocalInstanceId = id;
            store.set('activeLocalInstanceId', id);
        }

        const inst = instanceService.getInstance(id);
        if (inst) {
            this.activeInstance = inst;
            store.set('activeInstanceId', id);
        }

        if (updatePill) {
            this.updateDockInstancePill();
        }
    }

    async init() {
        console.log('[RXCORP] Initializing Launcher 2.2 (Riot/Dribbble UI)...');
        this.initWindowControls();
        this.initDribbbleShell();
        this.initModals();
        this.initSettings();
        this.initAccounts();
        this.initModrinth();
        this.initPvP();
        this.initLaunchDock();
        this.initUpdater();
        this.initWebAuth();

        // Load initial instance
        await this.loadInstances();

        // Load cloud servers
        await this.loadCloudServers();

        console.log('[RXCORP] Launcher ready.');
    }

    // ==========================================
    // RIOT / DRIBBBLE STYLE UNIFIED SHELL
    // ==========================================
    initDribbbleShell() {
        const railItems = document.querySelectorAll('.rail-item[data-view]');
        railItems.forEach(item => {
            item.addEventListener('click', () => {
                const targetView = item.dataset.view;
                this.selectDribbbleMode(targetView);
            });
        });

        // Add instance button on left rail
        document.getElementById('btn-rail-add')?.addEventListener('click', () => {
            document.getElementById('modal-create-instance')?.classList.add('active');
        });

        // Drawer back button
        document.getElementById('btn-back-dashboard')?.addEventListener('click', () => {
            this.closeDrawer();
        });

        // Hero secondary button
        document.getElementById('btn-hero-secondary')?.addEventListener('click', () => {
            const mode = this.activeDribbbleMode || 'cloud';
            if (mode === 'cloud') this.openDrawer('cloud', 'SERVEURS PELICAN CLOUD');
            else if (mode === 'pvp') this.openDrawer('pvp', 'CONFIGURATION DU CLIENT PVP');
            else if (mode === 'instances') this.openDrawer('instances', 'MES PROFILS & INSTANCES');
            else if (mode === 'modrinth') this.openDrawer('modrinth', 'CATALOGUE MODRINTH');
            else if (mode === 'settings') this.openDrawer('settings', 'PARAMÈTRES & COMPTES');
        });

        // Tactical Cards buttons
        document.getElementById('btn-widget-activity')?.addEventListener('click', () => {
            this.showNotification('Activité de jeu', '18.4 heures de jeu enregistrées sur RXCORP cette semaine.');
        });

        document.getElementById('btn-widget-pvp')?.addEventListener('click', () => {
            this.selectDribbbleMode('pvp');
            this.openDrawer('pvp', 'CONFIGURATION DU CLIENT PVP');
        });

        document.getElementById('btn-widget-cloud')?.addEventListener('click', () => {
            this.selectDribbbleMode('cloud');
            this.openDrawer('cloud', 'SERVEURS PELICAN CLOUD');
        });

        // Default mode from store or cloud
        const savedMode = store.get('activeDribbbleMode') || 'cloud';
        this.selectDribbbleMode(savedMode);

        // Update RAM widget from saved store
        const ram = store.get('ramMax') || 4;
        const ramWidget = document.getElementById('widget-ram-text');
        if (ramWidget) ramWidget.innerText = `${ram}.0 GB`;
    }

    selectDribbbleMode(mode) {
        this.activeDribbbleMode = mode;
        store.set('activeDribbbleMode', mode);

        // Update active class on rail items
        document.querySelectorAll('.rail-item[data-view]').forEach(item => {
            item.classList.toggle('active', item.dataset.view === mode);
        });

        const hero = document.getElementById('dribbble-hero');
        const tagText = document.getElementById('hero-tag-text');
        const heroDot = document.querySelector('.hero-dot');
        const heroTitle = document.getElementById('hero-title');
        const heroDesc = document.getElementById('hero-desc');
        const playLabel = document.getElementById('hero-play-label');
        const secText = document.getElementById('hero-sec-text');

        // Reset hero theme classes
        hero?.classList.remove('hero-cloud', 'hero-pvp', 'hero-instances', 'hero-modrinth', 'hero-settings');

        if (mode === 'cloud') {
            hero?.classList.add('hero-cloud');
            if (tagText) tagText.innerText = 'OFFICIEL RXCORP • FORGE 26.2';
            if (heroDot) heroDot.style.background = 'var(--primary)';
            if (heroTitle) heroTitle.innerText = 'RXCORP CLOUD';
            if (heroDesc) heroDesc.innerText = 'Infrastructure Cloud Pelican officielle avec synchronisation automatique Forge 26.2 et mods vérifiés.';
            if (playLabel) playLabel.innerText = 'JOUER (SERVEUR)';
            if (secText) secText.innerText = '⚡ Liste des Serveurs';
            this.closeDrawer();
            this.updateDockInstancePill();
            this.loadCloudServers();
        } else if (mode === 'pvp') {
            hero?.classList.add('hero-pvp');
            if (tagText) tagText.innerText = 'CLIENT COMPÉTITIF • 144+ FPS';
            if (heroDot) heroDot.style.background = 'var(--cyan)';
            if (heroTitle) heroTitle.innerText = 'RX PVP CLIENT';
            if (heroDesc) heroDesc.innerText = 'Client e-sport autonome avec Sodium, Lithium, FerriteCore et ATH tactique de combat.';
            if (playLabel) playLabel.innerText = 'JOUER (PVP)';
            if (secText) secText.innerText = '🎯 Gérer les Mods PvP';
            this.closeDrawer();
            this.updateDockInstancePill();
            this.renderPvPMods();
        } else if (mode === 'instances') {
            hero?.classList.add('hero-instances');
            if (tagText) tagText.innerText = 'PROFILS LIBRES • MULTI-LOADER';
            if (heroDot) heroDot.style.background = 'var(--emerald)';
            if (heroTitle) heroTitle.innerText = 'MOD LOCAL & PROFILS';
            if (heroDesc) heroDesc.innerText = 'Gestionnaire d\'instances personnalisées indépendant du Cloud et du Client PvP (Vanilla, Fabric, Forge, NeoForge).';
            if (playLabel) playLabel.innerText = 'LANCER';
            if (secText) secText.innerText = '📦 Gérer les Profils';
            this.closeDrawer();
            this.updateDockInstancePill();
            this.loadInstances();
        } else if (mode === 'modrinth') {
            this.openDrawer('modrinth', 'CATALOGUE MODRINTH');
        } else if (mode === 'settings') {
            this.openDrawer('settings', 'CONFIGURATION DU SYSTÈME');
        }
    }

    openDrawer(viewName, title = '') {
        const drawer = document.getElementById('dribbble-views-drawer');
        const drawerTitle = document.getElementById('drawer-title');
        if (drawer) drawer.style.display = 'flex';
        if (drawerTitle && title) drawerTitle.innerText = title;

        this.switchView(viewName);
    }

    closeDrawer() {
        const drawer = document.getElementById('dribbble-views-drawer');
        if (drawer) drawer.style.display = 'none';
    }


    // ==========================================
    // WINDOW CONTROLS & TITLEBAR
    // ==========================================
    initWindowControls() {
        document.getElementById('btn-minimize')?.addEventListener('click', () => {
            ipcRenderer.send('main-window-minimize');
        });

        document.getElementById('btn-maximize')?.addEventListener('click', () => {
            ipcRenderer.send('main-window-maximize');
        });

        document.getElementById('btn-close')?.addEventListener('click', () => {
            ipcRenderer.send('main-window-close');
        });

        document.getElementById('link-create-key')?.addEventListener('click', (e) => {
            e.preventDefault();
            shell.openExternal('https://panel.rxcorp.fr/account/api');
        });
    }

    // ==========================================
    // AUTO-UPDATER UI INTEGRATION
    // ==========================================
    initUpdater() {
        const updatePill = document.getElementById('update-pill');
        const updateText = document.getElementById('update-pill-text');
        if (!updatePill || !updateText) return;

        ipcRenderer.on('updater-event', (event, data) => {
            console.log('[RXCORP Updater Event]', data);
            if (data.status === 'available') {
                updatePill.style.display = 'inline-flex';
                updateText.textContent = `⚡ Téléchargement v${data.version || ''}...`;
            } else if (data.status === 'downloading') {
                updatePill.style.display = 'inline-flex';
                updateText.textContent = `📥 Téléchargement: ${data.percent}%`;
            } else if (data.status === 'ready') {
                updatePill.style.display = 'inline-flex';
                updatePill.style.borderColor = '#10b981';
                updatePill.style.background = 'rgba(16, 185, 129, 0.2)';
                updateText.style.color = '#10b981';
                updateText.textContent = `🚀 Relancer pour appliquer v${data.version || ''}`;
                updatePill.onclick = () => {
                    ipcRenderer.send('install-update-now');
                };
            }
        });
    }

    // ==========================================
    // NAVIGATION (VIEW SWITCHING)
    // ==========================================
    initNavigation() {
        const navItems = document.querySelectorAll('.nav-item');
        navItems.forEach(item => {
            item.addEventListener('click', () => {
                const targetView = item.dataset.view;
                this.switchView(targetView);
            });
        });
    }

    switchView(viewName) {
        this.activeView = viewName;

        // Update sidebar active classes
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.toggle('active', item.dataset.view === viewName);
        });

        // Update view containers
        document.querySelectorAll('.view-container').forEach(view => {
            view.classList.toggle('active', view.id === `view-${viewName}`);
        });

        // Trigger view-specific refreshes
        if (viewName === 'cloud') {
            this.loadCloudServers();
        } else if (viewName === 'instances') {
            this.loadInstances();
        } else if (viewName === 'pvp') {
            this.renderPvPMods();
        }
    }

    // ==========================================
    // RXCORP CLOUD (PELICAN INTEGRATION)
    // ==========================================
    async loadCloudServers() {
        const apiKey = store.get('apiKey');
        const panelUrl = store.get('panelUrl') || 'https://panel.rxcorp.fr';

        const authCard = document.getElementById('cloud-auth-card');
        const grid = document.getElementById('cloud-servers-grid');
        const pillText = document.getElementById('cloud-pill-text');
        const pillDot = document.querySelector('#cloud-pill .status-dot');

        if (!apiKey) {
            authCard.style.display = 'block';
            grid.innerHTML = '';
            pillText.innerText = 'Non connecté';
            pillDot.className = 'status-dot offline';
            return;
        }

        authCard.style.display = 'none';
        pillText.innerText = 'Connexion...';
        pillDot.className = 'status-dot';

        grid.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-dim);">
                <span>Chargement de vos serveurs RXCORP...</span>
            </div>
        `;

        const res = await pelicanService.getServers(apiKey, panelUrl);
        if (!res.success) {
            authCard.style.display = 'block';
            grid.innerHTML = `
                <div class="rx-card" style="grid-column: 1/-1; border: 1px solid rgba(239, 68, 68, 0.4); background: rgba(239, 68, 68, 0.08); margin-bottom: 20px; text-align: center; padding: 20px;">
                    <p style="color: var(--danger); font-weight: 700; margin-bottom: 6px;">Session expirée ou non autorisée</p>
                    <p style="font-size: 13px; color: var(--text-dim); margin-bottom: 0;">Cliquez sur <strong>« Connexion en 1 Clic »</strong> ci-dessus pour associer votre compte automatiquement.</p>
                </div>
            `;
            pillText.innerText = 'Non connecté';
            pillDot.className = 'status-dot offline';
            return;
        }

        this.cloudServers = res.servers.filter(s => s.isMinecraft);
        pillText.innerText = `${this.cloudServers.length} Serveur(s)`;
        pillDot.className = 'status-dot online';

        if (this.cloudServers.length === 0) {
            grid.innerHTML = `
                <div class="rx-card" style="grid-column: 1/-1; text-align: center; padding: 40px;">
                    <p style="color: var(--text-muted); margin-bottom: 12px;">Aucun serveur Minecraft actif trouvé sur votre compte.</p>
                    <button class="rx-btn rx-btn-primary" onclick="shell.openExternal('https://billing.rxcorp.fr')">
                        Commander un serveur Minecraft
                    </button>
                </div>
            `;
            return;
        }

        grid.innerHTML = '';
        for (const server of this.cloudServers) {
            const card = this.createServerCard(server);
            grid.appendChild(card);
            // Fetch live status in background
            this.fetchServerLiveStatus(server, card);
        }
    }

    createServerCard(server) {
        const card = document.createElement('div');
        card.className = 'server-card';
        card.id = `server-card-${server.id}`;

        card.innerHTML = `
            <div class="server-card-top">
                <div class="server-name-box">
                    <h3>${server.name}</h3>
                    <div class="server-address" title="Cliquer pour copier">
                        <span>${server.ip}:${server.port}</span>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:11px; height:11px;"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                    </div>
                </div>
                <div class="server-badge offline" id="badge-${server.id}">
                    <span class="status-dot"></span>
                    <span class="badge-text">Vérification...</span>
                </div>
            </div>

            <div class="server-stats-row">
                <div class="stat-item">
                    <span class="stat-label">RAM Allouée</span>
                    <span class="stat-value">${server.limits.memory > 0 ? (server.limits.memory / 1024).toFixed(1) + ' GB' : 'Illimitée'}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">RAM Utilisée</span>
                    <span class="stat-value" id="ram-used-${server.id}">-</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">CPU</span>
                    <span class="stat-value" id="cpu-used-${server.id}">-</span>
                </div>
            </div>

            <div class="server-mods-preview" id="mods-preview-${server.id}" style="margin-top: 12px; margin-bottom: 12px; padding: 9px 12px; background: rgba(255,255,255,0.02); border-radius: 8px; border: 1px solid var(--border); font-size: 11px; display: flex; align-items: center; justify-content: space-between; gap: 8px;">
                <div style="display: flex; align-items: center; gap: 8px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 14px; height: 14px; stroke: var(--primary); flex-shrink: 0;"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
                    <span id="mods-summary-${server.id}" style="color: var(--text-dim); overflow: hidden; text-overflow: ellipsis;">Détection des mods...</span>
                </div>
                <span class="rx-tag" id="mods-count-${server.id}" style="font-size: 10px; padding: 2px 7px; flex-shrink: 0; background: rgba(255,255,255,0.05); color: var(--text-muted); border: 1px solid var(--border);">-</span>
            </div>

            <div class="server-actions">
                <button class="rx-btn rx-btn-primary btn-join-server" style="flex: 1;" data-id="${server.id}">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                    <span>Rejoindre</span>
                </button>
                <button class="rx-btn rx-btn-secondary btn-sync-mods" title="Télécharger les mods du serveur" data-id="${server.id}">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
                    <span>Sync Mods</span>
                </button>
                <button class="rx-btn rx-btn-secondary btn-open-panel" title="Gérer sur le Panel" data-id="${server.id}">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                </button>
            </div>
        `;

        // Click to copy address
        card.querySelector('.server-address').addEventListener('click', () => {
            navigator.clipboard.writeText(`${server.ip}:${server.port}`);
            this.showNotification('Adresse copiée !', `${server.ip}:${server.port} dans le presse-papier`);
        });

        // Join server button (Sync + Launch + Connect)
        card.querySelector('.btn-join-server').addEventListener('click', () => {
            this.handleJoinServer(server);
        });

        // Sync mods only button
        card.querySelector('.btn-sync-mods').addEventListener('click', () => {
            this.handleSyncServerMods(server);
        });

        // Open in panel button
        card.querySelector('.btn-open-panel').addEventListener('click', () => {
            shell.openExternal(`https://panel.rxcorp.fr/server/${server.id}`);
        });

        return card;
    }

    async fetchServerLiveStatus(server, card) {
        const apiKey = store.get('apiKey');
        const panelUrl = store.get('panelUrl');
        const res = await pelicanService.getServerResources(server.id, apiKey, panelUrl);

        const badge = card.querySelector(`#badge-${server.id}`);
        const badgeText = badge.querySelector('.badge-text');
        const ramValue = card.querySelector(`#ram-used-${server.id}`);
        const cpuValue = card.querySelector(`#cpu-used-${server.id}`);

        if (res.success && res.state === 'running') {
            badge.className = 'server-badge online';
            badgeText.innerText = 'En ligne';
            ramValue.innerText = `${(res.resources.memoryBytes / (1024 * 1024)).toFixed(0)} MB`;
            cpuValue.innerText = `${res.resources.cpuAbsolute}%`;
        } else if (res.state === 'starting') {
            badge.className = 'server-badge online';
            badgeText.innerText = 'Démarrage...';
        } else {
            badge.className = 'server-badge offline';
            badgeText.innerText = 'Hors-ligne';
            ramValue.innerText = '0 MB';
            cpuValue.innerText = '0%';
        }

        // Live mods detection
        try {
            const modsRes = await pelicanService.listServerMods(server.id, apiKey, panelUrl);
            const modsSummary = card.querySelector(`#mods-summary-${server.id}`);
            const modsCount = card.querySelector(`#mods-count-${server.id}`);
            if (modsSummary && modsCount) {
                if (modsRes.success && modsRes.mods && modsRes.mods.length > 0) {
                    const cleanNames = modsRes.mods.map(m => m.name.replace(/\.jar$/i, '').replace(/[-_]mc.*$/i, '')).join(', ');
                    modsSummary.innerText = cleanNames;
                    modsSummary.title = modsRes.mods.map(m => m.name).join('\n');
                    modsCount.innerText = `${modsRes.mods.length} mod(s)`;
                    modsCount.style.background = 'rgba(244, 63, 94, 0.15)';
                    modsCount.style.borderColor = 'rgba(244, 63, 94, 0.3)';
                    modsCount.style.color = '#f43f5e';
                } else {
                    modsSummary.innerText = 'Aucun mod requis (Vanilla)';
                    modsCount.innerText = 'Vanilla';
                    modsCount.style.background = 'rgba(255, 255, 255, 0.05)';
                    modsCount.style.borderColor = 'var(--border)';
                    modsCount.style.color = 'var(--text-muted)';
                }
            }
        } catch (_) {}
    }

    async handleSyncServerMods(server) {
        if (this.isSyncing) return;
        this.isSyncing = true;

        const apiKey = store.get('apiKey');
        const panelUrl = store.get('panelUrl');
        const instance = instanceService.getOrCreateServerInstance(server);
        const modsPath = instance.modsPath || (instance.path ? path.join(instance.path, 'mods') : path.join(instanceService.getBaseDir(), instance.id, 'mods'));

        this.updateDockStatus(`Synchronisation avec ${server.name}...`, 0);

        try {
            const result = await pelicanService.syncModsToInstance(
                server.id,
                modsPath,
                apiKey,
                panelUrl,
                (progress) => {
                    this.updateDockStatus(progress.message, progress.percent || 0);
                }
            );

            this.showNotification(
                'Synchronisation réussie',
                `${result.downloadedCount || 0} mod(s) synchronisé(s) avec succès pour ${server.name}.`
            );
            this.setActiveInstanceForDomain('cloud', instance.id);
            this.loadInstances();
        } catch (err) {
            console.error('[Sync error]:', err);
            this.showNotification('Erreur de synchronisation', err.message);
        } finally {
            this.isSyncing = false;
            setTimeout(() => this.updateDockStatus('Prêt à jouer', 0), 3000);
        }
    }

    async handleJoinServer(server) {
        // 1. Sync mods first
        await this.handleSyncServerMods(server);

        // 2. Select the server instance
        const instance = instanceService.getOrCreateServerInstance(server);
        this.setActiveInstanceForDomain('cloud', instance.id);
        this.selectDribbbleMode('cloud');

        // 3. Launch game with server auto-connect!
        await this.launchCurrentInstance();
    }

    // ==========================================
    // INSTANCES MANAGEMENT (STRICT DOMAIN ISOLATION)
    // ==========================================
    async loadInstances() {
        const localInstances = instanceService.getLocalInstances();
        const pvpInstances = instanceService.getPvpInstances();
        const cloudInstances = instanceService.getCloudInstances();

        const grid = document.getElementById('instances-grid');
        const selectTarget = document.getElementById('select-target-instance');
        const selectPvp = document.getElementById('select-pvp-instance');

        // Populate dropdowns with STRICT domain separation:
        // 1. PvP Select: ONLY PvP instances!
        if (selectPvp) {
            if (pvpInstances.length === 0) {
                // Ensure default profiles exist
                pvpService.getOrCreatePvpProfile('1.21');
                pvpService.getOrCreatePvpProfile('1.8.9');
                return this.loadInstances();
            }
            selectPvp.innerHTML = pvpInstances.map(i => {
                const isSel = (i.id === this.activePvpInstanceId) ? 'selected' : '';
                return `<option value="${i.id}" ${isSel}>${i.name}</option>`;
            }).join('');
        }

        // 2. Modrinth Target Select: local profiles and pvp profiles (never cloud servers!)
        if (selectTarget) {
            let options = '';
            if (localInstances.length > 0) {
                options += `<optgroup label="Profils Locaux Libres">` + localInstances.map(i => `<option value="${i.id}">${i.name} (${i.version} ${i.loader.toUpperCase()})</option>`).join('') + `</optgroup>`;
            }
            if (pvpInstances.length > 0) {
                options += `<optgroup label="RX PvP Client">` + pvpInstances.map(i => `<option value="${i.id}">${i.name} (${i.version})</option>`).join('') + `</optgroup>`;
            }
            if (!options) {
                options = `<option value="">Aucune instance disponible</option>`;
            }
            selectTarget.innerHTML = options;
        }

        // 3. Update current active instances per domain
        const curDomain = this.getCurrentDomain();
        this.activeInstance = this.getActiveInstanceForDomain(curDomain);
        this.updateDockInstancePill();
        if (typeof this.renderPvPVersions === 'function') {
            this.renderPvPVersions();
        }

        // 4. Populate Local Instances Grid (view-instances)
        if (!grid) return;
        grid.innerHTML = '';

        if (localInstances.length === 0) {
            grid.innerHTML = `
                <div style="grid-column: 1/-1; text-align: center; padding: 48px 24px; background: rgba(255, 255, 255, 0.02); border: 1px dashed var(--border); border-radius: 16px;">
                    <div style="font-size: 36px; margin-bottom: 12px;">📦</div>
                    <h3 style="font-size: 16px; font-weight: 700; color: var(--text-white); margin-bottom: 6px;">Aucun profil local personnalisé</h3>
                    <p style="font-size: 13px; color: var(--text-dim); max-width: 440px; margin: 0 auto 20px;">
                        Les profils locaux sont entièrement isolés du Cloud Pelican et du Client PvP. Créez un profil pour installer vos propres mods Vanilla, Fabric, Forge ou NeoForge en toute liberté.
                    </p>
                    <button class="rx-btn rx-btn-primary" id="btn-empty-create-local" style="display: inline-flex; align-items: center; gap: 8px; margin: 0 auto;">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 16px; height: 16px;"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                        <span>Créer un Profil Local</span>
                    </button>
                </div>
            `;
            grid.querySelector('#btn-empty-create-local')?.addEventListener('click', () => {
                document.getElementById('modal-create-instance')?.classList.add('active');
            });
            return;
        }

        for (const inst of localInstances) {
            const card = document.createElement('div');
            card.className = 'server-card';
            const isCurrentLocal = (inst.id === this.activeLocalInstanceId);
            if (isCurrentLocal) {
                card.style.borderColor = 'var(--emerald)';
                card.style.boxShadow = '0 0 16px rgba(16, 185, 129, 0.3)';
            }

            card.innerHTML = `
                <div class="server-card-top">
                    <div class="server-name-box">
                        <h3>${inst.name}</h3>
                        <span style="font-size: 12px; color: var(--text-dim);">Minecraft ${inst.version} • ${inst.loader.toUpperCase()}</span>
                    </div>
                    <div class="server-badge online" style="background: rgba(16, 185, 129, 0.15); color: #6ee7b7; border-color: rgba(16, 185, 129, 0.3);">
                        <span>${inst.modCount} Mod(s)</span>
                    </div>
                </div>

                <div class="server-stats-row">
                    <div class="stat-item">
                        <span class="stat-label">Domaine</span>
                        <span class="stat-value" style="color: var(--emerald);">LOCAL LIBRE</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Modloader</span>
                        <span class="stat-value">${inst.loader.toUpperCase()}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Dossier</span>
                        <span class="stat-value" style="font-size: 11px; cursor: pointer; color: var(--accent);" title="Ouvrir dans l'explorateur">Ouvrir ↗</span>
                    </div>
                </div>

                <div class="server-actions">
                    <button class="rx-btn ${isCurrentLocal ? 'rx-btn-secondary' : 'rx-btn-primary'} btn-select-instance" style="flex: 1;" data-id="${inst.id}">
                        <span>${isCurrentLocal ? '✓ Actif' : 'Sélectionner'}</span>
                    </button>
                    <button class="rx-btn rx-btn-secondary btn-folder-instance" title="Ouvrir le dossier" data-id="${inst.id}">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                    </button>
                    <button class="rx-btn rx-btn-danger btn-delete-instance" title="Supprimer l'instance" data-id="${inst.id}">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                    </button>
                </div>
            `;

            card.querySelector('.btn-select-instance').addEventListener('click', () => {
                this.setActiveInstanceForDomain('local', inst.id);
                this.loadInstances();
            });

            card.querySelector('.btn-folder-instance').addEventListener('click', () => {
                instanceService.openFolder(inst.id);
            });

            card.querySelector('.stat-value[style*="cursor: pointer"]').addEventListener('click', () => {
                instanceService.openFolder(inst.id);
            });

            card.querySelector('.btn-delete-instance').addEventListener('click', () => {
                if (confirm(`Voulez-vous vraiment supprimer le profil local "${inst.name}" ?`)) {
                    instanceService.deleteInstance(inst.id);
                    if (this.activeLocalInstanceId === inst.id) {
                        this.activeLocalInstanceId = null;
                        store.delete('activeLocalInstanceId');
                    }
                    this.loadInstances();
                }
            });

            grid.appendChild(card);
        }
    }

    selectInstance(id) {
        const inst = instanceService.getInstance(id);
        if (!inst) return;
        const domain = inst.domain || 'local';
        this.setActiveInstanceForDomain(domain, id);
        this.loadInstances();
        if (domain === 'pvp') {
            this.renderPvPMods();
        }
    }

    updateDockInstancePill() {
        const nameElem = document.getElementById('dock-instance-name');
        const subElem = document.getElementById('dock-instance-sub');
        if (!nameElem || !subElem) return;

        const curDomain = this.getCurrentDomain();
        const inst = this.getActiveInstanceForDomain(curDomain);

        if (inst) {
            nameElem.innerText = inst.name;
            if (inst.domain === 'cloud') {
                subElem.innerText = `Serveur Cloud RXCORP • Forge 26.2`;
            } else if (inst.domain === 'pvp') {
                subElem.innerText = `Client PvP • MC ${inst.version} • ${(inst.loader || 'fabric').toUpperCase()}`;
            } else {
                subElem.innerText = `Profil Local • MC ${inst.version} • ${(inst.loader || 'forge').toUpperCase()}`;
            }
        } else {
            if (curDomain === 'cloud') {
                nameElem.innerText = 'Aucun serveur Cloud';
                subElem.innerText = 'Sélectionnez un serveur Pelican';
            } else if (curDomain === 'pvp') {
                nameElem.innerText = 'RX PvP Client 1.21+';
                subElem.innerText = 'Client Compétitif Dédié';
            } else {
                nameElem.innerText = 'Aucun profil local';
                subElem.innerText = 'Cliquez pour créer un profil';
            }
        }
    }

    // ==========================================
    // MODRINTH MOD BROWSER
    // ==========================================
    initModrinth() {
        const searchInput = document.getElementById('input-mod-search');
        const searchBtn = document.getElementById('btn-search-mods');

        const doSearch = async () => {
            const query = searchInput.value;
            const targetInstId = document.getElementById('select-target-instance')?.value;
            const targetInst = targetInstId ? instanceService.getInstance(targetInstId) : this.activeInstance;

            const grid = document.getElementById('modrinth-mods-grid');
            grid.innerHTML = `
                <div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-dim);">
                    Recherche sur Modrinth en cours...
                </div>
            `;

            const res = await modrinthService.searchMods({
                query: query,
                version: targetInst?.version,
                loader: targetInst?.loader,
                limit: 24
            });

            if (!res.success || !res.mods.length) {
                grid.innerHTML = `
                    <div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-dim);">
                        Aucun mod trouvé pour cette recherche.
                    </div>
                `;
                return;
            }

            grid.innerHTML = '';
            for (const mod of res.mods) {
                const card = document.createElement('div');
                card.className = 'mod-card';

                const iconSrc = mod.iconUrl || 'assets/images/icon/icon.png';
                const downloadsFormatted = mod.downloads > 1000000 
                    ? (mod.downloads / 1000000).toFixed(1) + 'M' 
                    : (mod.downloads / 1000).toFixed(0) + 'k';

                card.innerHTML = `
                    <div class="mod-card-header">
                        <img class="mod-icon" src="${iconSrc}" alt="Mod icon" onerror="this.src='assets/images/icon/icon.png'">
                        <div class="mod-info-box">
                            <div class="mod-title">${mod.title}</div>
                            <div class="mod-author">par ${mod.author}</div>
                        </div>
                    </div>
                    <div class="mod-desc">${mod.description || 'Aucune description fournie.'}</div>
                    <div class="mod-footer">
                        <div class="mod-stats">
                            <span>⬇ ${downloadsFormatted}</span>
                            <span>★ ${mod.follows}</span>
                        </div>
                        <button class="rx-btn rx-btn-primary btn-install-mod" data-slug="${mod.slug}">
                            <span>📥 Installer</span>
                        </button>
                    </div>
                `;

                card.querySelector('.btn-install-mod').addEventListener('click', async (e) => {
                    const btn = e.currentTarget;
                    btn.disabled = true;
                    btn.innerText = 'Installation...';

                    const currentTargetId = document.getElementById('select-target-instance')?.value || this.activeInstance?.id;
                    const inst = instanceService.getInstance(currentTargetId);

                    try {
                        const versionsRes = await modrinthService.getCompatibleVersions(mod.slug, inst.version, inst.loader);
                        if (!versionsRes.success || !versionsRes.versions.length) {
                            alert(`Aucune version compatible avec MC ${inst.version} (${inst.loader})`);
                            btn.disabled = false;
                            btn.innerText = '📥 Installer';
                            return;
                        }

                        const file = versionsRes.versions[0];
                        await modrinthService.installMod(inst.modsPath, file.downloadUrl, file.fileName);
                        btn.innerText = '✓ Installé';
                        btn.classList.remove('rx-btn-primary');
                        btn.classList.add('rx-btn-secondary');
                        this.showNotification('Mod installé !', `${mod.title} ajouté à ${inst.name}`);
                        this.loadInstances();
                    } catch (err) {
                        alert('Erreur: ' + err.message);
                        btn.disabled = false;
                        btn.innerText = '📥 Installer';
                    }
                });

                grid.appendChild(card);
            }
        };

        searchBtn?.addEventListener('click', doSearch);
        searchInput?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') doSearch();
        });

        // Trigger initial search
        setTimeout(doSearch, 1000);
    }

    // ==========================================
    // PVP & COMPETITIVE CLIENT HUB (SOAR / LUNAR MULTI-VERSION STYLE)
    // ==========================================
    initPvP() {
        const selectPvp = document.getElementById('select-pvp-instance');
        selectPvp?.addEventListener('change', () => {
            if (selectPvp.value) {
                this.setActiveInstanceForDomain('pvp', selectPvp.value);
                this.renderPvPVersions();
                this.renderPvPMods();
            }
        });

        // Add custom PvP version button
        document.getElementById('btn-add-pvp-custom')?.addEventListener('click', () => {
            const ver = prompt('Entrez la version Minecraft pour le client PvP (ex: 1.20.4, 1.19.4, 1.18.2, 1.16.5, 1.8.9) :', '1.20.4');
            if (!ver || !ver.trim()) return;
            const cleanVer = ver.trim();
            const loader = (cleanVer.startsWith('1.8') || cleanVer.startsWith('1.7') || cleanVer.startsWith('1.12')) ? 'forge' : 'fabric';
            const inst = pvpService.createCustomPvpProfile({
                name: `RX PvP ${cleanVer} (${loader.toUpperCase()})`,
                version: cleanVer,
                loader: loader
            });
            this.setActiveInstanceForDomain('pvp', inst.id);
            this.loadInstances();
            this.renderPvPVersions();
            this.renderPvPMods();
            this.showNotification('Version PvP Créée', `${inst.name} est prête à être configurée.`);
        });

        // Soar / Frost style category tabs
        this.activePvPCategory = 'all';
        const tabBtns = document.querySelectorAll('.pvp-tab-btn');
        tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                tabBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const cat = btn.dataset.cat;
                this.activePvPCategory = cat;

                const modsGrid = document.getElementById('pvp-mods-grid');
                const serversGrid = document.getElementById('pvp-servers-grid');

                if (cat === 'servers') {
                    if (modsGrid) modsGrid.style.display = 'none';
                    if (serversGrid) {
                        serversGrid.style.display = 'grid';
                        this.renderPvPServers();
                    }
                } else {
                    if (serversGrid) serversGrid.style.display = 'none';
                    if (modsGrid) {
                        modsGrid.style.display = 'grid';
                        this.renderPvPMods();
                    }
                }
            });
        });

        // Initial render of all PvP versions
        this.renderPvPVersions();
    }

    renderPvPVersions() {
        const container = document.getElementById('pvp-standards-container');
        if (!container) return;

        const profiles = pvpService.getProfiles();
        const activeInst = this.getActiveInstanceForDomain('pvp');
        container.innerHTML = '';

        profiles.forEach(prof => {
            const isSelected = (activeInst?.pvpProfile === prof.id || activeInst?.version === prof.versionKey);
            const card = document.createElement('div');
            card.className = `pvp-standard-card card-${prof.id.replace(/\./g, '')} ${isSelected ? 'active-profile' : ''}`;
            if (isSelected) {
                card.style.borderColor = prof.accentColor;
                card.style.boxShadow = `0 0 20px ${prof.accentColor}44`;
            }

            const modesBadges = prof.modes.map(m => `<span class="pvp-mode-chip">${m}</span>`).join('');
            const serversNames = prof.servers.map(s => s.name).join(', ');

            card.innerHTML = `
                <div>
                    <div class="pvp-card-top">
                        <span class="pvp-badge" style="background: ${prof.accentColor}1a; border: 1px solid ${prof.accentColor}55; color: ${prof.accentColor};">
                            ${prof.tag}
                        </span>
                        <span class="pvp-version-tag">MC ${prof.versionKey}</span>
                    </div>
                    <h3 class="pvp-titan-title" style="font-size: 16px; margin-bottom: 2px;">${prof.name}</h3>
                    <div style="font-family: var(--font-mono); font-size: 11px; color: ${prof.accentColor}; margin-bottom: 8px; font-weight: 700;">
                        ${prof.style}
                    </div>
                    <p class="pvp-titan-desc" style="font-size: 12px; margin-bottom: 12px; line-height: 1.4;">
                        ${prof.description}
                    </p>
                    <div class="pvp-modes-tags" style="margin-bottom: 12px;">
                        ${modesBadges}
                    </div>
                    <div style="font-size: 11px; color: var(--text-dim); margin-bottom: 14px;">
                        Serveurs phares : <span style="color: #cbd5e1; font-weight: 600;">${serversNames}</span>
                    </div>
                </div>

                <div class="pvp-card-actions" style="display: flex; gap: 8px;">
                    <button class="rx-btn ${isSelected ? 'rx-btn-secondary' : 'rx-btn-primary'} btn-select-pvp-version" style="flex: 1; height: 36px; font-size: 12px; font-weight: 700;">
                        <span>${isSelected ? '✓ Sélectionné' : 'Sélectionner'}</span>
                    </button>
                    <button class="rx-btn rx-btn-cyan btn-launch-pvp-version" style="height: 36px; padding: 0 14px; font-weight: 800; font-size: 12px;" title="Lancer directement cette version">
                        <span>⚡ Jouer</span>
                    </button>
                </div>
            `;

            card.querySelector('.btn-select-pvp-version').addEventListener('click', async () => {
                const inst = pvpService.getOrCreatePvpProfile(prof.id);
                if (inst) {
                    await this.loadInstances();
                    this.setActiveInstanceForDomain('pvp', inst.id);
                    this.renderPvPVersions();
                    this.renderPvPMods();
                    this.showNotification('Version PvP Sélectionnée', `${prof.name} est maintenant active.`);
                }
            });

            card.querySelector('.btn-launch-pvp-version').addEventListener('click', async () => {
                const inst = pvpService.getOrCreatePvpProfile(prof.id);
                if (inst) {
                    await this.loadInstances();
                    this.setActiveInstanceForDomain('pvp', inst.id);
                    this.selectDribbbleMode('pvp');
                    this.renderPvPVersions();
                    this.renderPvPMods();
                    this.showNotification('Lancement de ' + prof.name, 'Démarrage du client PvP...');
                    this.launchCurrentInstance();
                }
            });

            container.appendChild(card);
        });
    }

    renderPvPMods() {
        const grid = document.getElementById('pvp-mods-grid');
        const selectPvp = document.getElementById('select-pvp-instance');
        
        let pvpInst = this.getActiveInstanceForDomain('pvp');
        if (!pvpInst) {
            pvpInst = pvpService.getOrCreatePvpProfile('1.21');
            if (pvpInst) this.setActiveInstanceForDomain('pvp', pvpInst.id);
        }

        const targetId = selectPvp?.value || pvpInst?.id;
        if (!grid || !targetId) return;

        let catalog = pvpService.getCatalog();
        if (this.activePvPCategory && this.activePvPCategory !== 'all' && this.activePvPCategory !== 'servers') {
            catalog = catalog.filter(m => m.category === this.activePvPCategory);
        }

        const installedStatus = pvpService.checkInstalledMods(targetId);

        grid.innerHTML = '';
        for (const item of catalog) {
            const status = installedStatus[item.id] || { installed: false, enabled: false };
            const card = document.createElement('div');
            card.className = 'pvp-card';

            card.innerHTML = `
                <div class="pvp-card-left">
                    <div class="pvp-icon-box">${item.icon}</div>
                    <div class="pvp-text">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <h4>${item.name}</h4>
                            <span class="perf-chip" style="font-size: 8.5px;">${item.category}</span>
                        </div>
                        <p>${item.description}</p>
                    </div>
                </div>
                <label class="switch">
                    <input type="checkbox" class="pvp-toggle" data-id="${item.id}" ${status.installed ? 'checked' : ''}>
                    <span class="slider"></span>
                </label>
            `;

            const checkbox = card.querySelector('.pvp-toggle');
            checkbox.addEventListener('change', async (e) => {
                const checked = e.target.checked;
                checkbox.disabled = true;

                try {
                    if (checked) {
                        this.updateDockStatus(`Installation de ${item.name}...`, 0);
                        await pvpService.installMod(targetId, item.id, (prog) => {
                            this.updateDockStatus(prog.message, prog.percent || 0);
                        });
                        this.showNotification('Mod PvP activé', `${item.name} installé dans RX PvP Client.`);
                    } else {
                        pvpService.removeMod(targetId, item.id);
                        this.showNotification('Mod PvP retiré', `${item.name} désinstallé de RX PvP Client.`);
                    }
                    this.loadInstances();
                } catch (err) {
                    alert('Erreur: ' + err.message);
                    e.target.checked = !checked;
                } finally {
                    checkbox.disabled = false;
                    this.updateDockStatus('Prêt à jouer', 0);
                }
            });

            grid.appendChild(card);
        }
    }

    renderPvPServers() {
        const grid = document.getElementById('pvp-servers-grid');
        if (!grid) return;

        const profiles = pvpService.getProfiles();
        grid.innerHTML = '';

        profiles.forEach(prof => {
            prof.servers.forEach(srv => {
                const card = document.createElement('div');
                card.className = 'pvp-server-card';
                card.innerHTML = `
                    <div>
                        <div class="srv-card-top">
                            <span class="srv-card-title">${srv.name}</span>
                            <span class="srv-card-ping">● ${srv.ping}</span>
                        </div>
                        <div class="srv-card-desc">${srv.desc}</div>
                        <div style="font-family: var(--font-mono); font-size: 11px; color: var(--text-white); margin-top: 6px;">${srv.ip}</div>
                    </div>
                    <div class="srv-card-actions">
                        <button class="rx-btn rx-btn-secondary btn-copy-ip" data-ip="${srv.ip}" style="flex: 1; height: 34px; font-size: 11.5px;">
                            <span>Copier IP</span>
                        </button>
                        <button class="rx-btn rx-btn-primary btn-join-srv" data-ip="${srv.ip}" data-version="${prof.versionKey}" style="flex: 1; height: 34px; font-size: 11.5px; font-weight: 700;">
                            <span>⚡ Rejoindre</span>
                        </button>
                    </div>
                `;

                card.querySelector('.btn-copy-ip').addEventListener('click', (e) => {
                    const ip = e.currentTarget.dataset.ip;
                    const { clipboard } = require('electron');
                    clipboard.writeText(ip);
                    e.currentTarget.innerHTML = '<span>✓ Copié !</span>';
                    setTimeout(() => { e.currentTarget.innerHTML = '<span>Copier IP</span>'; }, 2000);
                });

                card.querySelector('.btn-join-srv').addEventListener('click', async (e) => {
                    const ip = e.currentTarget.dataset.ip;
                    const ver = e.currentTarget.dataset.version;
                    const profileKey = ver.startsWith('1.8') ? '1.8.9' : (ver.startsWith('1.7') ? '1.7.10' : '1.21');
                    const inst = pvpService.getOrCreatePvpProfile(profileKey);
                    if (inst) {
                        inst.serverAddress = ip;
                        await this.loadInstances();
                        this.setActiveInstanceForDomain('pvp', inst.id);
                        this.selectDribbbleMode('pvp');
                        this.launchCurrentInstance();
                    }
                });

                grid.appendChild(card);
            });
        });
    }

    // ==========================================
    // GAME LAUNCH DOCK (DOMAIN-AWARE)
    // ==========================================
    initLaunchDock() {
        const launchBtn = document.getElementById('btn-launch-game');
        launchBtn?.addEventListener('click', () => {
            this.launchCurrentInstance();
        });

        document.getElementById('dock-instance-pill')?.addEventListener('click', () => {
            const domain = this.getCurrentDomain();
            if (domain === 'cloud') {
                this.openDrawer('cloud', 'SERVEURS PELICAN CLOUD');
            } else if (domain === 'pvp') {
                this.openDrawer('pvp', 'RX PVP CLIENT (COMPÉTITION)');
            } else {
                this.openDrawer('instances', 'MES PROFILS & INSTANCES LOCALES');
            }
        });
    }

    async launchCurrentInstance() {
        const targetInst = this.getActiveInstanceForDomain();
        if (!targetInst) {
            const domain = this.getCurrentDomain();
            if (domain === 'cloud') {
                alert('Veuillez sélectionner un serveur Cloud Pelican ou vous connecter à votre compte.');
                this.openDrawer('cloud', 'SERVEURS PELICAN CLOUD');
            } else if (domain === 'pvp') {
                alert('Initialisation du profil RX PvP Client...');
                const pvpInst = pvpService.getOrCreatePvpProfile('1.21');
                if (pvpInst) {
                    this.setActiveInstanceForDomain('pvp', pvpInst.id);
                    return this.launchCurrentInstance();
                }
            } else {
                alert('Veuillez d\'abord créer ou sélectionner un profil local.');
                this.openDrawer('instances', 'MES PROFILS & INSTANCES');
            }
            return;
        }

        this.activeInstance = targetInst;

        const launchBtn = document.getElementById('btn-launch-game');
        launchBtn.disabled = true;
        launchBtn.innerHTML = '<span>LANCEMENT...</span>';

        const ramMax = store.get('ramMax') || 4;
        const javaPath = store.get('javaPath') || null;
        const account = this.getActiveAccount();

        try {
            await gameLauncher.launch(
                this.activeInstance,
                account,
                {
                    ramMin: Math.max(1, Math.floor(ramMax / 2)),
                    ramMax: ramMax,
                    javaPath: javaPath
                },
                {
                    onStatus: (msg) => this.updateDockStatus(msg),
                    onProgress: (percent) => this.updateDockStatus(null, percent),
                    onSpeed: (speed) => console.log(`Speed: ${speed} MB/s`),
                    onGameStart: () => {
                        this.updateDockStatus('Minecraft est en cours d\'exécution...', 100);
                        launchBtn.innerHTML = '<span>EN JEU</span>';
                    },
                    onGameClose: () => {
                        this.updateDockStatus('Prêt à jouer', 0);
                        launchBtn.disabled = false;
                        launchBtn.innerHTML = '<svg viewBox="0 0 24 24"><polygon points="6 3 20 12 6 21 6 3"></polygon></svg><span id="hero-play-label">JOUER</span>';
                    },
                    onError: (err) => {
                        alert('Erreur lors du lancement du jeu:\n' + (err.message || err));
                        this.updateDockStatus('Erreur de lancement', 0);
                        launchBtn.disabled = false;
                        launchBtn.innerHTML = '<svg viewBox="0 0 24 24"><polygon points="6 3 20 12 6 21 6 3"></polygon></svg><span id="hero-play-label">JOUER</span>';
                    }
                }
            );
        } catch (err) {
            launchBtn.disabled = false;
            launchBtn.innerHTML = '<svg viewBox="0 0 24 24"><polygon points="6 3 20 12 6 21 6 3"></polygon></svg><span id="hero-play-label">JOUER</span>';
        }
    }

    updateDockStatus(message = null, percent = null) {
        const statusText = document.getElementById('dock-status');
        const progressContainer = document.getElementById('dock-progress-container');
        const progressFill = document.getElementById('dock-progress-fill');

        if (message !== null && statusText) {
            statusText.innerText = message;
        }

        if (percent !== null && progressContainer && progressFill) {
            if (percent > 0 && percent < 100) {
                progressContainer.style.display = 'block';
                progressFill.style.width = `${percent}%`;
            } else {
                progressContainer.style.display = 'none';
                progressFill.style.width = '0%';
            }
        }
    }

    // ==========================================
    // SETTINGS & ACCOUNTS
    // ==========================================
    initSettings() {
        const rangeRam = document.getElementById('range-ram-max');
        const labelRam = document.getElementById('label-ram-max');
        const inputJava = document.getElementById('input-java-path');
        const inputUrl = document.getElementById('settings-panel-url');
        const inputKey = document.getElementById('settings-panel-key');
        const btnSave = document.getElementById('btn-save-settings');

        // Populate saved values
        if (rangeRam) {
            rangeRam.value = store.get('ramMax') || 4;
            labelRam.innerText = `${rangeRam.value} GB`;
            const ramWidget = document.getElementById('widget-ram-text');
            if (ramWidget) ramWidget.innerText = `${rangeRam.value}.0 GB`;

            rangeRam.addEventListener('input', () => {
                labelRam.innerText = `${rangeRam.value} GB`;
                if (ramWidget) ramWidget.innerText = `${rangeRam.value}.0 GB`;
            });
        }

        if (inputJava) inputJava.value = store.get('javaPath') || '';
        if (inputUrl) inputUrl.value = store.get('panelUrl') || 'https://panel.rxcorp.fr';
        if (inputKey) inputKey.value = store.get('apiKey') || '';

        btnSave?.addEventListener('click', () => {
            store.set('ramMax', parseInt(rangeRam.value, 10));
            store.set('javaPath', inputJava.value.trim());
            store.set('panelUrl', inputUrl.value.trim());
            store.set('apiKey', inputKey.value.trim());

            const ramWidget = document.getElementById('widget-ram-text');
            if (ramWidget) ramWidget.innerText = `${rangeRam.value}.0 GB`;

            this.showNotification('Paramètres sauvegardés', 'Vos réglages ont été mis à jour.');
            this.loadCloudServers();
        });

        // Cloud login button on the cloud tab
        document.getElementById('btn-login-cloud')?.addEventListener('click', () => {
            const key = document.getElementById('input-panel-key').value.trim();
            const url = document.getElementById('input-panel-url').value.trim();

            if (!key) {
                alert('Veuillez entrer une clé API Client valide.');
                return;
            }

            store.set('apiKey', key);
            store.set('panelUrl', url);
            this.loadCloudServers();
        });

        // Test panel connection button
        document.getElementById('btn-test-panel')?.addEventListener('click', async () => {
            const key = inputKey.value.trim();
            const url = inputUrl.value.trim();
            const res = await pelicanService.testConnection(key, url);
            if (res.success) {
                alert(`Connexion réussie !\nConnecté en tant que: ${res.user.username} (${res.user.email})`);
            } else {
                alert(`Échec de connexion: ${res.error}`);
            }
        });

        // Disconnect panel button
        document.getElementById('btn-disconnect-panel')?.addEventListener('click', () => {
            store.set('apiKey', '');
            if (inputKey) inputKey.value = '';
            this.loadCloudServers();
            alert('Déconnecté du Panel.');
        });
    }

    // ==========================================
    // RXCORP CLOUD WEB SSO & DIRECT AUTH
    // ==========================================
    initWebAuth() {
        ipcRenderer.on('web-auth-success', (event, data) => {
            console.log('[RXCORP] Web Auth success received:', data);
            if (data.token) {
                store.set('apiKey', data.token);
                if (data.username) {
                    store.set('activeAccountName', data.username);
                    const accounts = store.get('accounts') || [];
                    if (!accounts.some(a => a.name === data.username)) {
                        accounts.push({
                            name: data.username,
                            uuid: 'offline-' + data.username,
                            meta: { type: 'RXCORP', online: false, email: data.email || '' }
                        });
                        store.set('accounts', accounts);
                    }
                }
                this.showNotification('Connexion Cloud Réussie', `Bienvenue ${data.username || ''} ! Vos serveurs sont prêts.`);
                this.renderAccountsList();
                this.loadCloudServers();
            }
        });

        // 1-Click Web SSO Button
        document.getElementById('btn-start-web-auth')?.addEventListener('click', () => {
            this.showNotification('Connexion Web', 'Ouverture de votre navigateur pour validation...');
            ipcRenderer.send('start-web-auth');
        });

        // Open Direct Login Modal
        document.getElementById('btn-open-direct-login')?.addEventListener('click', () => {
            this.openModal('modal-direct-login');
        });

        // Toggle Manual API Key Container
        document.getElementById('btn-toggle-manual-key')?.addEventListener('click', () => {
            const container = document.getElementById('manual-key-container');
            if (container) {
                container.style.display = container.style.display === 'none' ? 'block' : 'none';
            }
        });

        // Submit Direct Login Modal
        document.getElementById('btn-submit-direct-login')?.addEventListener('click', async () => {
            const login = document.getElementById('input-direct-login')?.value.trim();
            const password = document.getElementById('input-direct-password')?.value;
            const errBox = document.getElementById('direct-login-error');
            const btn = document.getElementById('btn-submit-direct-login');

            if (!login || !password) {
                if (errBox) {
                    errBox.textContent = 'Veuillez saisir votre identifiant et mot de passe.';
                    errBox.style.display = 'block';
                }
                return;
            }

            btn.disabled = true;
            btn.innerHTML = '<span>Connexion...</span>';
            if (errBox) errBox.style.display = 'none';

            try {
                const response = await fetch('https://panel.rxcorp.fr/api/launcher/direct-login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ login, password })
                });
                const resData = await response.json();

                if (resData.success && resData.token) {
                    store.set('apiKey', resData.token);
                    if (resData.user?.username) {
                        store.set('activeAccountName', resData.user.username);
                        const accounts = store.get('accounts') || [];
                        if (!accounts.some(a => a.name === resData.user.username)) {
                            accounts.push({
                                name: resData.user.username,
                                uuid: 'offline-' + resData.user.username,
                                meta: { type: 'RXCORP', online: false, email: resData.user.email || '' }
                            });
                            store.set('accounts', accounts);
                        }
                    }
                    this.closeModal('modal-direct-login');
                    this.showNotification('Connexion réussie', `Bienvenue ${resData.user?.username || ''} !`);
                    this.renderAccountsList();
                    this.loadCloudServers();
                } else {
                    if (errBox) {
                        errBox.textContent = resData.error || 'Identifiants invalides.';
                        errBox.style.display = 'block';
                    }
                }
            } catch (e) {
                if (errBox) {
                    errBox.textContent = 'Erreur de connexion : ' + e.message;
                    errBox.style.display = 'block';
                }
            } finally {
                btn.disabled = false;
                btn.innerHTML = '<span>Se connecter</span>';
            }
        });
    }

    initAccounts() {
        this.renderAccountsList();

        document.getElementById('btn-add-offline')?.addEventListener('click', () => {
            this.openModal('modal-add-offline');
        });

        document.getElementById('btn-confirm-add-offline')?.addEventListener('click', () => {
            const input = document.getElementById('input-offline-username');
            const username = (input.value || '').trim();
            if (!username) {
                alert('Veuillez entrer un pseudo.');
                return;
            }

            const accounts = store.get('accounts') || [];
            accounts.push({
                name: username,
                uuid: 'offline-' + Date.now(),
                meta: { type: 'Mojang', online: false }
            });

            store.set('accounts', accounts);
            store.set('activeAccountName', username);
            input.value = '';
            this.closeModal('modal-add-offline');
            this.renderAccountsList();
        });

        document.getElementById('btn-add-microsoft')?.addEventListener('click', async () => {
            try {
                this.updateDockStatus('Connexion Microsoft en cours...');
                const client_id = "00000000402b5328"; // Standard Minecraft Client ID
                const auth = await ipcRenderer.invoke('Microsoft-window', client_id);
                if (auth && auth.name) {
                    const accounts = store.get('accounts') || [];
                    accounts.push(auth);
                    store.set('accounts', accounts);
                    store.set('activeAccountName', auth.name);
                    this.renderAccountsList();
                    this.showNotification('Compte connecté', `Bienvenue ${auth.name} !`);
                }
            } catch (err) {
                alert('Erreur Microsoft: ' + err.message);
            } finally {
                this.updateDockStatus('Prêt à jouer', 0);
            }
        });
    }

    getActiveAccount() {
        const accounts = store.get('accounts') || [];
        const activeName = store.get('activeAccountName');
        const found = accounts.find(a => a.name === activeName) || accounts[0];
        if (found) return found;

        const cloudUser = store.get('user');
        if (cloudUser && cloudUser.username) {
            return {
                name: cloudUser.username,
                uuid: '00000000-0000-0000-0000-000000000000',
                access_token: 'null',
                meta: { type: 'Offline', online: false }
            };
        }
        return null;
    }

    renderAccountsList() {
        const list = document.getElementById('accounts-list');
        const activeAccount = this.getActiveAccount();
        const userNameElem = document.getElementById('user-name');

        if (userNameElem && activeAccount) {
            userNameElem.innerText = activeAccount.name;
        }

        if (!list) return;
        const accounts = store.get('accounts') || [];

        list.innerHTML = accounts.map(acc => {
            const isActive = acc.name === activeAccount?.name;
            return `
                <div style="display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; background: rgba(0,0,0,0.25); border-radius: var(--radius-md); border: 1px solid ${isActive ? 'var(--primary)' : 'var(--border-color)'};">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <img src="https://mc-heads.net/avatar/${acc.name}/24" style="width: 24px; height: 24px; border-radius: 4px;" onerror="this.src='assets/images/icon/icon.png'">
                        <div>
                            <div style="font-size: 13px; font-weight: 600; color: white;">${acc.name}</div>
                            <div style="font-size: 11px; color: var(--text-dim);">${acc.meta?.type === 'Xbox' ? 'Compte Microsoft Officiel' : 'Compte Hors-Ligne'}</div>
                        </div>
                    </div>
                    <div>
                        ${isActive 
                            ? '<span style="color: var(--primary); font-size: 12px; font-weight: 700;">Actif</span>'
                            : `<button class="rx-btn rx-btn-secondary btn-switch-account" data-name="${acc.name}" style="padding: 4px 10px; font-size: 11px;">Activer</button>`
                        }
                    </div>
                </div>
            `;
        }).join('');

        list.querySelectorAll('.btn-switch-account').forEach(btn => {
            btn.addEventListener('click', () => {
                store.set('activeAccountName', btn.dataset.name);
                this.renderAccountsList();
            });
        });
    }

    // ==========================================
    // MODALS HANDLING
    // ==========================================
    initModals() {
        document.querySelectorAll('[data-close]').forEach(btn => {
            btn.addEventListener('click', () => {
                const modalId = btn.dataset.close;
                this.closeModal(modalId);
            });
        });

        document.getElementById('btn-new-instance')?.addEventListener('click', () => {
            this.openModal('modal-create-instance');
        });

        document.getElementById('btn-confirm-create-instance')?.addEventListener('click', () => {
            const name = document.getElementById('input-new-name').value.trim();
            const version = document.getElementById('select-new-version').value;
            const loader = document.getElementById('select-new-loader').value;

            if (!name) {
                alert('Veuillez donner un nom à votre instance.');
                return;
            }

            const newInst = instanceService.createInstance({
                name: name,
                version: version,
                loader: loader,
                domain: 'local'
            });

            this.closeModal('modal-create-instance');
            document.getElementById('input-new-name').value = '';
            this.setActiveInstanceForDomain('local', newInst.id);
            this.selectDribbbleMode('instances');
            this.loadInstances();
            this.showNotification('Profil Local Créé', `"${name}" est prêt à être personnalisé.`);
        });
    }

    openModal(id) {
        document.getElementById(id)?.classList.add('active');
    }

    closeModal(id) {
        document.getElementById(id)?.classList.remove('active');
    }

    showNotification(title, body) {
        ipcRenderer.send('send-notification', { title, body });
    }
}

function bootstrap() {
    try {
        const app = new RxcorpApp();
        app.init();
    } catch (e) {
        console.error('[RXCORP Bootstrap Error]', e);
    }
}

if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', bootstrap);
} else {
    bootstrap();
}
