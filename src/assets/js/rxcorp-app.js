/**
 * RXCORP Launcher - Master Application Controller
 * Handles UI interactions, services coordination and state management
 * Version 2.4.0
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
const curseforgeService = require(path.join(servicesDir, 'curseforgeService.js'));
const gameLauncher = require(path.join(servicesDir, 'gameLauncher.js'));

// Local storage
const store = new Store({
    defaults: {
        panelUrl: 'https://panel.rxcorp.fr',
        apiKey: '',
        curseforgeApiKey: '',
        activeInstanceId: null,
        activeCloudInstanceId: null,
        activeLocalInstanceId: null,
        activeDribbbleMode: 'cloud',
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
        this.activeLocalInstanceId = store.get('activeLocalInstanceId') || null;
        this.activeInstance = null;
        this.cloudServers = [];
        this.isSyncing = false;
        this.activeModSource = 'modrinth'; // 'modrinth' | 'curseforge'
        this.activeModCategory = '';
    }

    /**
     * Get current active domain based on UI mode ('cloud' | 'local')
     */
    getCurrentDomain() {
        return this.activeDribbbleMode === 'cloud' ? 'cloud' : 'local';
    }

    /**
     * Get active instance for a given domain, with auto-fallback and auto-provisioning
     */
    getActiveInstanceForDomain(domain = null) {
        const d = domain || this.getCurrentDomain();
        let targetId = (d === 'cloud') ? this.activeCloudInstanceId : this.activeLocalInstanceId;

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

        // Auto-provision a default local instance if none exists
        if (d === 'local') {
            const localInst = instanceService.createInstance({
                name: 'Mon Profil Local 26.2',
                version: '26.2',
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
        console.log('[RXCORP] Initializing Launcher 2.4...');
        this.initWindowControls();
        this.initDribbbleShell();
        this.initModals();
        this.initSettings();
        this.initAccounts();
        this.initModDownloader();
        this.initLaunchDock();
        this.initUpdater();
        this.initWebAuth();

        // Load initial instances
        await this.loadInstances();

        // Load cloud servers
        await this.loadCloudServers();

        // Initial Discord RPC state
        ipcRenderer.send('discord-rpc-idle');

        console.log('[RXCORP] Launcher ready.');
    }

    // ==========================================
    // UNIFIED SHELL NAVIGATION & DASHBOARD
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
            if (mode === 'cloud') {
                const curInst = this.getActiveInstanceForDomain('cloud');
                if (curInst && curInst.serverAddress) {
                    const server = this.cloudServers.find(s => `${s.ip}:${s.port}` === curInst.serverAddress);
                    if (server) {
                        this.handleSyncServerMods(server);
                        return;
                    }
                }
                this.openDrawer('cloud', 'SERVEURS PELICAN CLOUD');
            } else {
                document.getElementById('modal-create-instance')?.classList.add('active');
            }
        });

        // Dashboard Real Cards Buttons
        document.getElementById('btn-widget-cloud')?.addEventListener('click', () => {
            this.selectDribbbleMode('cloud');
            this.openDrawer('cloud', 'SERVEURS PELICAN CLOUD');
        });

        document.getElementById('btn-widget-instances')?.addEventListener('click', () => {
            this.selectDribbbleMode('instances');
            this.openDrawer('instances', 'MES PROFILS & MODPACKS');
        });

        // Default mode from store or cloud
        const savedMode = store.get('activeDribbbleMode') || 'cloud';
        this.selectDribbbleMode(savedMode === 'pvp' ? 'cloud' : savedMode);
    }

    selectDribbbleMode(mode) {
        if (mode === 'pvp') mode = 'cloud';
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
        hero?.classList.remove('hero-cloud', 'hero-instances', 'hero-modrinth', 'hero-settings');

        if (mode === 'cloud') {
            hero?.classList.add('hero-cloud');
            if (tagText) tagText.innerText = 'OFFICIEL RXCORP • SERVEUR CLOUD';
            if (heroDot) heroDot.style.background = 'var(--primary)';
            if (heroTitle) heroTitle.innerText = 'RXCORP CLOUD';
            if (heroDesc) heroDesc.innerText = 'Infrastructure Cloud Pelican officielle avec synchronisation automatique Forge 26.2 et connexion instantanée.';
            if (playLabel) playLabel.innerText = 'JOUER (SERVEUR)';
            if (secText) secText.innerText = '⚡ Synchroniser les Mods';
            this.closeDrawer();
            this.updateDockInstancePill();
            this.renderDashboardLists();
        } else if (mode === 'instances') {
            hero?.classList.add('hero-instances');
            if (tagText) tagText.innerText = 'PROFILS & MODPACKS LOCAUX';
            if (heroDot) heroDot.style.background = 'var(--cyan)';
            if (heroTitle) heroTitle.innerText = 'GESTIONNAIRE LOCAL';
            if (heroDesc) heroDesc.innerText = 'Profils et modpacks Minecraft locaux autonomes (Fabric, Forge, NeoForge, Vanilla).';
            if (playLabel) playLabel.innerText = 'JOUER (LOCAL)';
            if (secText) secText.innerText = '+ Nouveau Profil';
            this.closeDrawer();
            this.updateDockInstancePill();
            this.renderDashboardLists();
        } else if (mode === 'modrinth') {
            this.openDrawer('modrinth', 'TÉLÉCHARGEUR DE MODS');
        } else if (mode === 'settings') {
            this.openDrawer('settings', 'CONFIGURATION DU SYSTÈME');
        }
    }

    renderDashboardLists() {
        // 1. Official Cloud Servers list
        const cloudList = document.getElementById('dashboard-cloud-list');
        if (cloudList) {
            if (!this.cloudServers || this.cloudServers.length === 0) {
                cloudList.innerHTML = `
                    <div style="font-size: 12px; color: var(--text-dim); text-align: center; padding: 24px 10px;">
                        Aucun serveur Pelican détecté.<br>
                        <a href="#" id="link-connect-cloud-dash" style="color: var(--primary); text-decoration: underline; font-weight: 600;">Se connecter au Panel Pelican ↗</a>
                    </div>
                `;
                document.getElementById('link-connect-cloud-dash')?.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.openDrawer('cloud', 'SERVEURS PELICAN CLOUD');
                });
            } else {
                cloudList.innerHTML = this.cloudServers.map(srv => {
                    const isSelected = this.activeInstance?.serverAddress === `${srv.ip}:${srv.port}` || 
                                       (this.activeInstance?.name && this.activeInstance.name.includes(srv.name));
                    const isOnline = srv.status === 'online' || srv.status === 'running';
                    const ping = srv.ping || 18;
                    const players = srv.players ? `${srv.players.online}/${srv.players.max}` : (isOnline ? 'En ligne' : 'Prêt');
                    return `
                        <div class="dash-item-row ${isSelected ? 'active' : ''}">
                            <div class="dash-item-left">
                                <span class="srv-dot ${isOnline ? 'online' : 'offline'}"></span>
                                <div class="dash-item-info">
                                    <span class="dash-item-name">${srv.name}</span>
                                    <span class="dash-item-sub">${ping}ms • ${players} • ${srv.ip}:${srv.port}</span>
                                </div>
                            </div>
                            <div class="dash-item-actions">
                                <button class="dash-quick-btn btn-dash-select-server" data-name="${srv.name}">
                                    ${isSelected ? '✓ Actif' : 'Sélectionner'}
                                </button>
                            </div>
                        </div>
                    `;
                }).join('');

                cloudList.querySelectorAll('.btn-dash-select-server').forEach(btn => {
                    btn.addEventListener('click', async (e) => {
                        const srvName = e.currentTarget.dataset.name;
                        const srv = this.cloudServers.find(s => s.name === srvName);
                        if (srv) {
                            await this.selectCloudServer(srv);
                        }
                    });
                });
            }
        }

        // 2. Local Instances list
        const instList = document.getElementById('dashboard-instances-list');
        if (instList) {
            const locals = instanceService.getLocalInstances();
            if (locals.length === 0) {
                instList.innerHTML = `
                    <div style="font-size: 12px; color: var(--text-dim); text-align: center; padding: 24px 10px;">
                        Aucun profil local pour l'instant.<br>
                        <a href="#" id="link-create-inst-dash" style="color: var(--cyan); text-decoration: underline; font-weight: 600;">+ Créer un profil local ↗</a>
                    </div>
                `;
                document.getElementById('link-create-inst-dash')?.addEventListener('click', (e) => {
                    e.preventDefault();
                    document.getElementById('modal-create-instance')?.classList.add('active');
                });
            } else {
                instList.innerHTML = locals.map(inst => {
                    const isSelected = this.activeInstance?.id === inst.id;
                    const loader = (inst.loader || 'fabric').toUpperCase();
                    return `
                        <div class="dash-item-row ${isSelected ? 'active' : ''}">
                            <div class="dash-item-left">
                                <div style="font-size: 15px;">📦</div>
                                <div class="dash-item-info">
                                    <span class="dash-item-name">${inst.name}</span>
                                    <span class="dash-item-sub">MC ${inst.version || '26.2'} • ${loader} • ${inst.modCount || 0} mod(s)</span>
                                </div>
                            </div>
                            <div class="dash-item-actions">
                                <button class="dash-quick-btn btn-dash-select-instance" data-id="${inst.id}">
                                    ${isSelected ? '✓ Actif' : 'Choisir'}
                                </button>
                            </div>
                        </div>
                    `;
                }).join('');

                instList.querySelectorAll('.btn-dash-select-instance').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        const id = e.currentTarget.dataset.id;
                        this.selectDribbbleMode('instances');
                        this.setActiveInstanceForDomain('local', id);
                        this.renderDashboardLists();
                    });
                });
            }
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
        this.renderDashboardLists();
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

        document.getElementById('user-pill')?.addEventListener('click', () => {
            this.openDrawer('settings', 'CONFIGURATION & COMPTES');
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
        } else if (viewName === 'modrinth') {
            if (typeof this.triggerModSearch === 'function') {
                this.triggerModSearch();
            }
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
            if (authCard) authCard.style.display = 'block';
            if (grid) grid.innerHTML = '';
            if (pillText) pillText.innerText = 'Non connecté';
            if (pillDot) pillDot.className = 'status-dot offline';
            this.renderDashboardLists();
            return;
        }

        if (authCard) authCard.style.display = 'none';
        if (pillText) pillText.innerText = 'Connexion...';
        if (pillDot) pillDot.className = 'status-dot';

        if (grid) {
            grid.innerHTML = `
                <div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-dim);">
                    <span>Chargement de vos serveurs RXCORP...</span>
                </div>
            `;
        }

        const res = await pelicanService.getServers(apiKey, panelUrl);
        if (!res.success) {
            if (authCard) authCard.style.display = 'block';
            if (grid) {
                grid.innerHTML = `
                    <div class="rx-card" style="grid-column: 1/-1; border: 1px solid rgba(239, 68, 68, 0.4); background: rgba(239, 68, 68, 0.08); margin-bottom: 20px; text-align: center; padding: 20px;">
                        <p style="color: var(--danger); font-weight: 700; margin-bottom: 6px;">Session expirée ou non autorisée</p>
                        <p style="font-size: 13px; color: var(--text-dim); margin-bottom: 0;">Cliquez sur <strong>« Connexion en 1 Clic »</strong> ci-dessus pour associer votre compte automatiquement.</p>
                    </div>
                `;
            }
            if (pillText) pillText.innerText = 'Non connecté';
            if (pillDot) pillDot.className = 'status-dot offline';
            this.renderDashboardLists();
            return;
        }

        this.cloudServers = res.servers.filter(s => s.isMinecraft);
        if (pillText) pillText.innerText = `${this.cloudServers.length} Serveur(s)`;
        if (pillDot) pillDot.className = 'status-dot online';

        if (grid) {
            if (this.cloudServers.length === 0) {
                grid.innerHTML = `
                    <div class="rx-card" style="grid-column: 1/-1; text-align: center; padding: 40px;">
                        <p style="color: var(--text-muted); margin-bottom: 12px;">Aucun serveur Minecraft actif trouvé sur votre compte.</p>
                        <button class="rx-btn rx-btn-primary" onclick="shell.openExternal('https://billing.rxcorp.fr')">
                            Commander un serveur Minecraft
                        </button>
                    </div>
                `;
            } else {
                grid.innerHTML = '';
                for (const server of this.cloudServers) {
                    const card = this.createServerCard(server);
                    grid.appendChild(card);
                    this.fetchServerLiveStatus(server, card);
                }
            }
        }

        this.renderDashboardLists();
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

        card.querySelector('.btn-join-server').addEventListener('click', () => {
            this.handleJoinServer(server);
        });

        card.querySelector('.btn-sync-mods').addEventListener('click', () => {
            this.handleSyncServerMods(server);
        });

        card.querySelector('.btn-open-panel').addEventListener('click', () => {
            const panelUrl = store.get('panelUrl') || 'https://panel.rxcorp.fr';
            shell.openExternal(`${panelUrl}/server/${server.identifier}`);
        });

        return card;
    }

    async fetchServerLiveStatus(server, card) {
        const apiKey = store.get('apiKey');
        const panelUrl = store.get('panelUrl');
        const badge = card.querySelector(`#badge-${server.id}`);
        const ramValue = card.querySelector(`#ram-used-${server.id}`);
        const cpuValue = card.querySelector(`#cpu-used-${server.id}`);

        try {
            const res = await pelicanService.getServerResources(server.id, apiKey, panelUrl);
            if (res.success && res.resources) {
                const state = res.resources.current_state;
                if (state === 'running') {
                    badge.className = 'server-badge online';
                    badge.querySelector('.badge-text').innerText = 'En ligne';
                } else if (state === 'starting') {
                    badge.className = 'server-badge starting';
                    badge.querySelector('.badge-text').innerText = 'Démarrage...';
                } else {
                    badge.className = 'server-badge offline';
                    badge.querySelector('.badge-text').innerText = 'Arrêté';
                }

                const ramMb = (res.resources.resources.memory_bytes / (1024 * 1024)).toFixed(0);
                ramValue.innerText = `${ramMb} MB`;
                cpuValue.innerText = `${res.resources.resources.cpu_absolute.toFixed(1)}%`;
            }
        } catch (_) {
            badge.className = 'server-badge offline';
            badge.querySelector('.badge-text').innerText = 'Inaccessible';
            ramValue.innerText = '-';
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

    async selectCloudServer(server) {
        const instance = instanceService.getOrCreateServerInstance(server);
        this.setActiveInstanceForDomain('cloud', instance.id);
        this.selectDribbbleMode('cloud');
        this.showNotification('Serveur Sélectionné', `${server.name} est maintenant actif.`);
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
    // INSTANCES MANAGEMENT (LOCAL PROFILES)
    // ==========================================
    async loadInstances() {
        const localInstances = instanceService.getLocalInstances();
        const grid = document.getElementById('instances-grid');
        const selectTarget = document.getElementById('select-target-instance');

        // Mod target select dropdown:
        if (selectTarget) {
            let options = '';
            if (localInstances.length > 0) {
                options = localInstances.map(i => `<option value="${i.id}">${i.name} (${i.version} ${(i.loader || 'fabric').toUpperCase()})</option>`).join('');
            } else {
                options = `<option value="">Aucun profil local</option>`;
            }
            selectTarget.innerHTML = options;
        }

        // Active instance update
        const curDomain = this.getCurrentDomain();
        this.activeInstance = this.getActiveInstanceForDomain(curDomain);
        this.updateDockInstancePill();

        // Populate Local Instances Grid (view-instances)
        if (grid) {
            grid.innerHTML = '';
            if (localInstances.length === 0) {
                grid.innerHTML = `
                    <div class="rx-card" style="grid-column: 1/-1; text-align: center; padding: 40px;">
                        <p style="color: var(--text-muted); margin-bottom: 12px;">Aucun profil local pour le moment.</p>
                        <button class="rx-btn rx-btn-primary" id="btn-create-first-instance">
                            + Créer un Profil Local
                        </button>
                    </div>
                `;
                document.getElementById('btn-create-first-instance')?.addEventListener('click', () => {
                    this.openModal('modal-create-instance');
                });
            } else {
                for (const inst of localInstances) {
                    const card = document.createElement('div');
                    card.className = 'server-card';
                    const isCurrentLocal = (inst.id === this.activeLocalInstanceId);
                    if (isCurrentLocal) {
                        card.style.borderColor = 'var(--cyan)';
                        card.style.boxShadow = '0 0 16px rgba(0, 240, 255, 0.25)';
                    }

                    const loaderStr = (inst.loader || 'fabric').toUpperCase();
                    card.innerHTML = `
                        <div class="server-card-top">
                            <div class="server-name-box">
                                <h3>${inst.name}</h3>
                                <span style="font-size: 12px; color: var(--text-dim);">Minecraft ${inst.version || '26.2'} • ${loaderStr}</span>
                            </div>
                            <div class="server-badge online" style="background: rgba(0, 240, 255, 0.12); color: var(--cyan); border-color: rgba(0, 240, 255, 0.3);">
                                <span>${inst.modCount || 0} Mod(s)</span>
                            </div>
                        </div>

                        <div class="server-stats-row">
                            <div class="stat-item">
                                <span class="stat-label">Version</span>
                                <span class="stat-value" style="color: var(--cyan);">${inst.version || '26.2'}</span>
                            </div>
                            <div class="stat-item">
                                <span class="stat-label">Modloader</span>
                                <span class="stat-value">${loaderStr}</span>
                            </div>
                            <div class="stat-item">
                                <span class="stat-label">Dossier</span>
                                <span class="stat-value" style="font-size: 11px; cursor: pointer; color: var(--text-white);" title="Ouvrir dans l'explorateur">Ouvrir ↗</span>
                            </div>
                        </div>

                        <div class="server-actions">
                            <button class="rx-btn ${isCurrentLocal ? 'rx-btn-secondary' : 'rx-btn-primary'} btn-select-instance" style="flex: 1;" data-id="${inst.id}">
                                <span>${isCurrentLocal ? '✓ Actif' : 'Sélectionner'}</span>
                            </button>
                            <button class="rx-btn rx-btn-secondary btn-folder-instance" title="Ouvrir le dossier de mods" data-id="${inst.id}">
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
                        this.renderDashboardLists();
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
                            this.renderDashboardLists();
                        }
                    });

                    grid.appendChild(card);
                }
            }
        }

        this.renderDashboardLists();
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
            } else {
                subElem.innerText = `Profil Local • MC ${inst.version || '26.2'} • ${(inst.loader || 'fabric').toUpperCase()}`;
            }
        } else {
            if (curDomain === 'cloud') {
                nameElem.innerText = 'Aucun serveur Cloud';
                subElem.innerText = 'Sélectionnez un serveur Pelican';
            } else {
                nameElem.innerText = 'Aucun profil local';
                subElem.innerText = 'Cliquez pour créer un profil';
            }
        }
    }

    // ==========================================
    // MOD DOWNLOADER (MODRINTH & CURSEFORGE)
    // ==========================================
    initModDownloader() {
        const searchInput = document.getElementById('input-mod-search');
        const searchBtn = document.getElementById('btn-search-mods');
        const btnModrinth = document.getElementById('btn-source-modrinth');
        const btnCurseForge = document.getElementById('btn-source-curseforge');

        btnModrinth?.addEventListener('click', () => {
            this.activeModSource = 'modrinth';
            btnModrinth.classList.add('active');
            btnCurseForge?.classList.remove('active');
            this.triggerModSearch();
        });

        btnCurseForge?.addEventListener('click', () => {
            this.activeModSource = 'curseforge';
            btnCurseForge.classList.add('active');
            btnModrinth?.classList.remove('active');
            this.triggerModSearch();
        });

        const chips = document.querySelectorAll('.mod-chip');
        chips.forEach(chip => {
            chip.addEventListener('click', () => {
                chips.forEach(c => c.classList.remove('active'));
                chip.classList.add('active');
                this.activeModCategory = chip.dataset.cat || '';
                this.triggerModSearch();
            });
        });

        searchInput?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.triggerModSearch();
            }
        });

        searchBtn?.addEventListener('click', () => {
            this.triggerModSearch();
        });

        // Trigger initial mod list
        this.triggerModSearch();
    }

    async triggerModSearch() {
        const searchInput = document.getElementById('input-mod-search');
        const query = searchInput ? searchInput.value.trim() : '';
        const targetInstId = document.getElementById('select-target-instance')?.value;
        const targetInst = targetInstId ? instanceService.getInstance(targetInstId) : this.getActiveInstanceForDomain('local');

        const grid = document.getElementById('modrinth-mods-grid');
        if (!grid) return;

        grid.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-dim);">
                Recherche de mods sur ${this.activeModSource === 'curseforge' ? 'CurseForge' : 'Modrinth'}...
            </div>
        `;

        let res = null;

        if (this.activeModSource === 'curseforge') {
            res = await curseforgeService.searchMods({
                query: query,
                version: targetInst?.version,
                loader: targetInst?.loader,
                limit: 24
            });

            if (res.needApiKey) {
                grid.innerHTML = `
                    <div class="rx-card" style="grid-column: 1/-1; padding: 30px; text-align: center; max-width: 480px; margin: 20px auto;">
                        <div style="font-size: 24px; margin-bottom: 8px;">🔑</div>
                        <h3 style="color: #fff; margin-bottom: 8px;">Clé API CurseForge requise</h3>
                        <p style="font-size: 12.5px; color: var(--text-dim); margin-bottom: 16px;">
                            CurseForge requiert une clé API personnelle. Entrez votre clé ci-dessous ou utilisez <strong>Modrinth</strong> (sans clé).
                        </p>
                        <input id="input-inline-curseforge" type="password" class="form-input" placeholder="$2a$10$..." style="margin-bottom: 12px;">
                        <button id="btn-save-inline-curseforge" class="rx-btn rx-btn-primary" style="width: 100%;">
                            Enregistrer la clé CurseForge
                        </button>
                    </div>
                `;
                document.getElementById('btn-save-inline-curseforge')?.addEventListener('click', () => {
                    const key = document.getElementById('input-inline-curseforge')?.value.trim();
                    if (key) {
                        curseforgeService.setApiKey(key);
                        this.showNotification('Clé sauvegardée', 'Recherche CurseForge activée.');
                        this.triggerModSearch();
                    }
                });
                return;
            }
        } else {
            res = await modrinthService.searchMods({
                query: query,
                version: targetInst?.version,
                loader: targetInst?.loader,
                category: this.activeModCategory || null,
                limit: 24
            });
        }

        if (!res.success || !res.mods || !res.mods.length) {
            grid.innerHTML = `
                <div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-dim);">
                    ${res.error || 'Aucun mod trouvé pour cette recherche.'}
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

            const sourceBadge = this.activeModSource === 'curseforge' ? 'CurseForge' : 'Modrinth';

            card.innerHTML = `
                <div>
                    <div class="mod-card-header">
                        <img class="mod-icon" src="${iconSrc}" alt="Mod icon" onerror="this.src='assets/images/icon/icon.png'">
                        <div class="mod-info-box">
                            <div class="mod-title" title="${mod.title}">${mod.title}</div>
                            <div class="mod-author">par ${mod.author}</div>
                            <div class="mod-tags-row">
                                <span class="mod-tag-badge" style="color: ${this.activeModSource === 'curseforge' ? 'var(--amber)' : 'var(--emerald)'};">${sourceBadge}</span>
                                ${(mod.categories || []).slice(0, 2).map(c => `<span class="mod-tag-badge">${c}</span>`).join('')}
                            </div>
                        </div>
                    </div>
                    <div class="mod-desc" style="margin-top: 10px;" title="${mod.description || ''}">
                        ${mod.description || 'Aucune description fournie.'}
                    </div>
                </div>
                <div class="mod-footer">
                    <div class="mod-stats">
                        <span>⬇ ${downloadsFormatted}</span>
                        <span>★ ${mod.follows || 0}</span>
                    </div>
                    <button class="rx-btn rx-btn-primary btn-install-mod" data-id="${mod.id || mod.slug}" data-source="${this.activeModSource}">
                        <span>📥 Installer</span>
                    </button>
                </div>
            `;

            card.querySelector('.btn-install-mod').addEventListener('click', async (e) => {
                const btn = e.currentTarget;
                btn.disabled = true;
                btn.innerHTML = '<span>Installation...</span>';

                const currentTargetId = document.getElementById('select-target-instance')?.value || this.activeInstance?.id;
                const inst = instanceService.getInstance(currentTargetId) || this.getActiveInstanceForDomain('local');

                if (!inst) {
                    alert('Veuillez sélectionner un profil local cible avant d\'installer un mod.');
                    btn.disabled = false;
                    btn.innerHTML = '<span>📥 Installer</span>';
                    return;
                }

                try {
                    if (this.activeModSource === 'curseforge') {
                        const filesRes = await curseforgeService.getCompatibleVersions(mod.id, inst.version, inst.loader);
                        if (!filesRes.success || !filesRes.versions.length) {
                            alert(`Aucun fichier CurseForge compatible avec MC ${inst.version} (${inst.loader})`);
                            btn.disabled = false;
                            btn.innerHTML = '<span>📥 Installer</span>';
                            return;
                        }
                        const file = filesRes.versions[0];
                        await curseforgeService.installMod(inst.modsPath, file.downloadUrl, file.fileName);
                    } else {
                        const versionsRes = await modrinthService.getCompatibleVersions(mod.slug, inst.version, inst.loader);
                        if (!versionsRes.success || !versionsRes.versions.length) {
                            alert(`Aucune version Modrinth compatible avec MC ${inst.version} (${inst.loader})`);
                            btn.disabled = false;
                            btn.innerHTML = '<span>📥 Installer</span>';
                            return;
                        }
                        const file = versionsRes.versions[0];
                        await modrinthService.installMod(inst.modsPath, file.downloadUrl, file.fileName);
                    }

                    btn.innerHTML = '<span>✓ Installé</span>';
                    btn.classList.remove('rx-btn-primary');
                    btn.classList.add('rx-btn-secondary');
                    this.showNotification('Mod installé !', `« ${mod.title} » a été ajouté à ${inst.name}.`);
                    this.loadInstances();
                } catch (err) {
                    alert('Erreur lors du téléchargement : ' + err.message);
                    btn.disabled = false;
                    btn.innerHTML = '<span>📥 Installer</span>';
                }
            });

            grid.appendChild(card);
        }
    }

    // ==========================================
    // GAME LAUNCH DOCK
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
            } else {
                this.openDrawer('instances', 'MES PROFILS & MODPACKS');
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
            } else {
                alert('Veuillez d\'abord créer ou sélectionner un profil local.');
                this.openDrawer('instances', 'MES PROFILS & MODPACKS');
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

        // Discord RPC Launching Event
        ipcRenderer.send('discord-rpc-launching', targetInst.name);

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
                        // Discord RPC In-Game
                        ipcRenderer.send('discord-rpc-playing', targetInst.name);
                    },
                    onGameClose: () => {
                        this.updateDockStatus('Prêt à jouer', 0);
                        launchBtn.disabled = false;
                        launchBtn.innerHTML = '<svg viewBox="0 0 24 24"><polygon points="6 3 20 12 6 21 6 3"></polygon></svg><span id="hero-play-label">JOUER</span>';
                        // Discord RPC Idle
                        ipcRenderer.send('discord-rpc-idle');
                    },
                    onError: (err) => {
                        alert('Erreur lors du lancement du jeu:\n' + (err.message || err));
                        this.updateDockStatus('Erreur de lancement', 0);
                        launchBtn.disabled = false;
                        launchBtn.innerHTML = '<svg viewBox="0 0 24 24"><polygon points="6 3 20 12 6 21 6 3"></polygon></svg><span id="hero-play-label">JOUER</span>';
                        // Discord RPC Idle
                        ipcRenderer.send('discord-rpc-idle');
                    }
                }
            );
        } catch (err) {
            launchBtn.disabled = false;
            launchBtn.innerHTML = '<svg viewBox="0 0 24 24"><polygon points="6 3 20 12 6 21 6 3"></polygon></svg><span id="hero-play-label">JOUER</span>';
            ipcRenderer.send('discord-rpc-idle');
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
        const inputCurseForge = document.getElementById('input-curseforge-key');
        const btnSave = document.getElementById('btn-save-settings');

        // Populate saved values
        if (rangeRam) {
            rangeRam.value = store.get('ramMax') || 4;
            labelRam.innerText = `${rangeRam.value} GB`;

            rangeRam.addEventListener('input', () => {
                labelRam.innerText = `${rangeRam.value} GB`;
            });
        }

        if (inputJava) inputJava.value = store.get('javaPath') || '';
        if (inputUrl) inputUrl.value = store.get('panelUrl') || 'https://panel.rxcorp.fr';
        if (inputKey) inputKey.value = store.get('apiKey') || '';
        if (inputCurseForge) inputCurseForge.value = store.get('curseforgeApiKey') || '';

        btnSave?.addEventListener('click', () => {
            store.set('ramMax', parseInt(rangeRam.value, 10));
            store.set('javaPath', inputJava.value.trim());
            store.set('panelUrl', inputUrl.value.trim());
            store.set('apiKey', inputKey.value.trim());

            if (inputCurseForge) {
                curseforgeService.setApiKey(inputCurseForge.value.trim());
            }

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
        const userAvatarElem = document.getElementById('user-avatar');

        if (activeAccount) {
            if (userNameElem) userNameElem.innerText = activeAccount.name;
            if (userAvatarElem) {
                userAvatarElem.src = `https://mc-heads.net/avatar/${activeAccount.name}/32`;
                userAvatarElem.onerror = () => { userAvatarElem.src = 'assets/images/icon/icon.png'; };
            }
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
