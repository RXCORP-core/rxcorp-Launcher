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

const utilsDir = fs.existsSync(path.join(__dirname, 'utils'))
    ? path.join(__dirname, 'utils')
    : (fs.existsSync(path.join(__dirname, 'assets/js/utils')) 
        ? path.join(__dirname, 'assets/js/utils') 
        : path.join(__dirname, 'src/assets/js/utils'));
const i18n = require(path.join(utilsDir, 'i18n.js'));

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
        ramMax: 6,
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
                name: 'Mon Profil Local 1.21.4',
                version: '1.21.4',
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
        console.log('[RXCORP] Initializing Launcher 2.5...');
        this.initWindowControls();
        this.initI18n();
        this.initDribbbleShell();
        this.initModals();
        this.initSettings();
        this.initAccounts();
        this.initPelicanSync();
        this.initModDownloader();
        this.initLaunchDock();
        this.initUpdater();
        this.initWebAuth();
        this.initOnboardingWizard();

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

        // Default mode from store or home
        const hasPelican = store.get('hasPelicanServer') ?? (store.get('apiKey') ? true : false);
        this.updateRailOrder(hasPelican);
        const savedMode = store.get('activeDribbbleMode') || 'home';
        this.selectDribbbleMode(savedMode === 'pvp' ? 'home' : savedMode);

        // Connect 6 Behance Showcase Quick-Play Cards
        document.querySelectorAll('.game-card.card-quick-play').forEach(card => {
            card.addEventListener('click', (e) => {
                const targetType = card.dataset.targetType;
                const isBtnClick = e.target.closest('.card-action-btn');

                // Visual active highlight
                document.querySelectorAll('.game-card').forEach(c => c.classList.remove('active'));
                card.classList.add('active');

                if (targetType === 'cloud') {
                    this.selectDribbbleMode('home');
                    const cloudInst = this.getActiveInstanceForDomain('cloud');
                    if (cloudInst) {
                        this.setActiveInstanceForDomain('cloud', cloudInst.id);
                    }
                } else {
                    const loader = card.dataset.targetLoader || 'fabric';
                    const version = card.dataset.targetVersion || '1.21.4';
                    
                    // Find or create local instance matching this configuration
                    let matching = instanceService.getInstancesByDomain('local').find(i => 
                        (i.loader || '').toLowerCase() === loader.toLowerCase() && 
                        (i.version || '').includes(version)
                    );

                    if (!matching) {
                        matching = instanceService.createInstance({
                            name: `Profil ${loader.toUpperCase()} ${version}`,
                            version: version,
                            loader: loader,
                            domain: 'local'
                        });
                    }

                    this.selectDribbbleMode('home');
                    this.setActiveInstanceForDomain('local', matching.id);
                }

                this.updateDockInstancePill();

                // If user clicked directly on "JOUER" / "LANCER" button, launch the game!
                if (isBtnClick) {
                    document.getElementById('btn-launch-game')?.click();
                }
            });
        });

        // Card 6: Open mods store
        document.querySelector('.game-card.card-quick-mods')?.addEventListener('click', () => {
            this.selectDribbbleMode('modrinth');
        });
    }

    selectDribbbleMode(mode) {
        if (mode === 'pvp') mode = 'home';
        this.activeDribbbleMode = mode;
        store.set('activeDribbbleMode', mode);

        // Update active class on rail items
        document.querySelectorAll('.rail-item[data-view]').forEach(item => {
            item.classList.toggle('active', item.dataset.view === mode);
        });

        // Switch active view container
        this.switchView(mode);

        const hero = document.getElementById('dribbble-hero');
        const tagText = document.getElementById('hero-tag-text');
        const heroDot = document.querySelector('.hero-dot');
        const heroTitle = document.getElementById('hero-title');
        const heroDesc = document.getElementById('hero-desc');
        const playLabel = document.getElementById('hero-play-label');
        const secText = document.getElementById('hero-sec-text');

        if (mode === 'home') {
            const domain = this.getCurrentDomain();
            const inst = this.getActiveInstanceForDomain(domain);
            if (heroTitle) heroTitle.innerText = inst ? inst.name : (domain === 'cloud' ? 'RXCORP CLOUD' : 'MINECRAFT LOCAL');
            if (heroDesc) heroDesc.innerText = domain === 'cloud' 
                ? 'Infrastructure Cloud Pelican officielle avec synchronisation automatique de la whitelist et connexion 1-clic.'
                : 'Profil Minecraft local autonome haute performance (Fabric, Forge, NeoForge, Vanilla).';
            if (playLabel) playLabel.innerText = domain === 'cloud' ? 'JOUER (SERVEUR)' : 'LANCER (LOCAL)';
            if (secText) secText.innerText = domain === 'cloud' ? '⚡ Synchroniser les Mods' : '+ Nouveau Profil';
            this.updateDockInstancePill();
            this.renderDashboardLists();
        } else if (mode === 'cloud') {
            if (playLabel) playLabel.innerText = 'JOUER (SERVEUR)';
            this.loadCloudServers();
        } else if (mode === 'instances') {
            if (playLabel) playLabel.innerText = 'JOUER (LOCAL)';
            this.loadInstances();
        } else if (mode === 'modrinth') {
            if (typeof this.triggerModSearch === 'function') {
                this.triggerModSearch();
            }
        } else if (mode === 'settings' || mode === 'profile') {
            this.initSettings();
        }
    }

    renderDashboardLists() {
        // 1. Official Cloud Servers list
        const cloudList = document.getElementById('dashboard-cloud-list');
        if (cloudList) {
            if (!this.cloudServers || this.cloudServers.length === 0) {
                const hasPelican = store.get('hasPelicanServer') ?? (store.get('apiKey') ? true : false);
                cloudList.innerHTML = hasPelican ? `
                    <div style="font-size: 12px; color: var(--text-dim); text-align: center; padding: 24px 10px;">
                        Aucun serveur Pelican détecté sur votre compte.<br>
                        <a href="#" id="link-connect-cloud-dash" style="color: var(--primary); text-decoration: underline; font-weight: 600;">Se connecter au Panel Pelican ↗</a>
                    </div>
                ` : `
                    <div style="font-size: 12px; color: var(--text-dim); text-align: center; padding: 24px 10px;">
                        Mode Joueur Local actif.<br>
                        <span style="font-size: 11px; opacity: 0.85;">Le mode Cloud est en arrière-plan. Gérez vos profils locaux et mods librement.</span>
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
                                    <span class="dash-item-sub">MC ${inst.version || '1.21.4'} • ${loader} • ${inst.modCount || 0} mod(s)</span>
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
    // MULTI-LANGUAGE I18N SYSTEM
    // ==========================================
    initI18n() {
        // Initial application of active language
        i18n.applyTranslations();

        // Bind all language switch pills/buttons
        document.querySelectorAll('.lang-btn-switch').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const lang = btn.dataset.lang;
                if (lang) {
                    i18n.setLang(lang);
                    this.renderAccountsList();
                    this.updateDockInstancePill();
                    const readyText = i18n.t('ready_to_play');
                    this.updateDockStatus(readyText, 0);
                    const langNames = { fr: 'Français 🇫🇷', en: 'English 🇬🇧', es: 'Español 🇪🇸', de: 'Deutsch 🇩🇪', pt: 'Português 🇵🇹' };
                    this.showNotification('Langue / Language', `Interface : ${langNames[lang] || lang}`);
                }
            });
        });
    }

    // ==========================================
    // AUTO-UPDATER UI INTEGRATION
    // ==========================================
    initUpdater() {
        const updatePill = document.getElementById('update-pill');
        const updateText = document.getElementById('update-pill-text');
        const floatingBanner = document.getElementById('floating-update-pill');
        const floatingText = document.getElementById('floating-update-text');
        const floatingBtn = document.getElementById('btn-floating-update-action');
        const btnCheckUpdate = document.getElementById('btn-check-update');
        const feedbackCheck = document.getElementById('update-check-feedback');

        if (btnCheckUpdate) {
            btnCheckUpdate.addEventListener('click', () => {
                btnCheckUpdate.disabled = true;
                btnCheckUpdate.innerHTML = '<span>⏳ Recherche...</span>';
                if (feedbackCheck) feedbackCheck.textContent = 'Connexion au serveur...';
                ipcRenderer.send('check-for-update');
                setTimeout(() => {
                    if (btnCheckUpdate.disabled) {
                        btnCheckUpdate.disabled = false;
                        btnCheckUpdate.innerHTML = '<span>🔄 Vérifier les Mises à Jour</span>';
                    }
                }, 8000);
            });
        }

        if (floatingBtn) {
            floatingBtn.addEventListener('click', () => {
                ipcRenderer.send('install-update-now');
            });
        }

        ipcRenderer.on('updater-event', (event, data) => {
            console.log('[RXCORP Updater Event]', data);

            if (data.status === 'checking') {
                if (feedbackCheck) feedbackCheck.textContent = 'Vérification du cloud...';
            } else if (data.status === 'available') {
                const targetVer = data.version || '';
                if (updatePill) {
                    updatePill.style.display = 'inline-flex';
                    updatePill.style.borderColor = 'var(--cyan)';
                    updatePill.style.background = 'rgba(14, 165, 233, 0.15)';
                }
                if (updateText) {
                    updateText.style.color = 'var(--cyan)';
                    updateText.textContent = `⚡ Téléchargement v${targetVer}...`;
                }

                if (floatingBanner && floatingText && floatingBtn) {
                    floatingBanner.style.display = 'flex';
                    floatingBanner.style.borderColor = 'var(--cyan)';
                    floatingText.textContent = `⚡ Version v${targetVer} détectée ! Téléchargement en cours...`;
                    floatingBtn.textContent = 'Téléchargement...';
                    floatingBtn.disabled = true;
                }

                if (feedbackCheck) feedbackCheck.textContent = `Mise à jour v${targetVer} détectée !`;
                this.showNotification('Mise à jour disponible !', `Téléchargement de la version ${targetVer} en arrière-plan.`);
            } else if (data.status === 'downloading') {
                const pct = data.percent || 0;
                if (updatePill) updatePill.style.display = 'inline-flex';
                if (updateText) updateText.textContent = `📥 ${pct}%`;

                if (floatingBanner && floatingText) {
                    floatingBanner.style.display = 'flex';
                    floatingText.textContent = `📥 Téléchargement de la mise à jour : ${pct}%`;
                }
                if (feedbackCheck) feedbackCheck.textContent = `Téléchargement : ${pct}%`;
            } else if (data.status === 'ready') {
                const readyVer = data.version || '';
                if (updatePill) {
                    updatePill.style.display = 'inline-flex';
                    updatePill.style.borderColor = 'var(--emerald)';
                    updatePill.style.background = 'rgba(16, 185, 129, 0.2)';
                    updatePill.onclick = () => ipcRenderer.send('install-update-now');
                }
                if (updateText) {
                    updateText.style.color = 'var(--emerald)';
                    updateText.textContent = `🚀 Relancer pour v${readyVer}`;
                }

                if (floatingBanner && floatingText && floatingBtn) {
                    floatingBanner.style.display = 'flex';
                    floatingBanner.style.borderColor = 'var(--emerald)';
                    floatingText.textContent = `🚀 Version v${readyVer} prête ! Redémarrez pour installer.`;
                    floatingBtn.textContent = 'Redémarrer';
                    floatingBtn.disabled = false;
                    floatingBtn.style.background = 'var(--emerald)';
                    floatingBtn.style.borderColor = 'var(--emerald-light)';
                }

                if (feedbackCheck) feedbackCheck.textContent = `Version v${readyVer} prête !`;
                this.showNotification('Mise à jour prête ! 🚀', `La version ${readyVer} a été téléchargée. Cliquez pour redémarrer.`);
            } else if (data.status === 'not-available') {
                const currentV = data.version || data.currentVersion || '2.5.1';
                if (data.isManual) {
                    this.showNotification('À jour !', `Votre launcher est à la version la plus récente (v${currentV}).`);
                }
                if (feedbackCheck) feedbackCheck.textContent = `À jour (v${currentV})`;
                if (btnCheckUpdate) {
                    btnCheckUpdate.disabled = false;
                    btnCheckUpdate.innerHTML = '<span>✓ Vous êtes à jour</span>';
                    setTimeout(() => {
                        btnCheckUpdate.innerHTML = '<span>🔄 Vérifier les Mises à Jour</span>';
                    }, 4000);
                }
            } else if (data.status === 'error') {
                console.warn('[Updater Error]', data.error);
                if (feedbackCheck) feedbackCheck.textContent = `Erreur: ${data.error}`;
                if (data.isManual) {
                    this.showNotification('Erreur de mise à jour', `${data.error}`);
                }
                if (btnCheckUpdate) {
                    btnCheckUpdate.disabled = false;
                    btnCheckUpdate.innerHTML = '<span>🔄 Réessayer</span>';
                }
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

        // Update sidebar and rail active classes
        document.querySelectorAll('.nav-item, .rail-item').forEach(item => {
            item.classList.toggle('active', item.dataset.view === viewName);
        });

        // Update view containers
        document.querySelectorAll('.view-container').forEach(view => {
            view.classList.toggle('active', view.id === `view-${viewName}`);
        });

        // Trigger view-specific refreshes
        if (viewName === 'home') {
            this.renderDashboardLists();
            this.updateDockInstancePill();
        } else if (viewName === 'cloud') {
            this.loadCloudServers();
        } else if (viewName === 'instances') {
            this.loadInstances();
        } else if (viewName === 'modrinth') {
            if (typeof this.triggerModSearch === 'function') {
                this.triggerModSearch();
            }
        } else if (viewName === 'settings' || viewName === 'profile') {
            this.initSettings();
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
        this.updatePelicanSyncUI();
    }

    createServerCard(server) {
        const card = document.createElement('div');
        card.className = 'server-card';
        card.id = `server-card-${server.id}`;

        card.innerHTML = `
            <div class="server-card-top">
                <div class="server-name-box">
                    <h3 class="server-name">${server.name}</h3>
                    <div class="server-address" title="Cliquer pour copier l'adresse">
                        <span>${server.ip}:${server.port}</span>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:11px; height:11px; opacity:0.7;"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                    </div>
                </div>
                <div class="server-badge online" id="badge-${server.id}">
                    <span class="badge-text">● En Ligne</span>
                </div>
            </div>

            <div class="server-stats-row">
                <div class="stat-item">
                    <span class="stat-label">RAM ALLOUÉE</span>
                    <span class="stat-value">${server.limits.memory > 0 ? (server.limits.memory / 1024).toFixed(1) + ' GB' : 'Illimitée'}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">RAM UTILISÉE</span>
                    <span class="stat-value" id="ram-used-${server.id}">-</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">CHARGE CPU</span>
                    <span class="stat-value" id="cpu-used-${server.id}">-</span>
                </div>
            </div>

            <div class="server-mods-preview" id="mods-preview-${server.id}" style="margin-top: 6px; margin-bottom: 6px; padding: 10px 14px; background: rgba(0,0,0,0.25); border-radius: 8px; border: 1px solid var(--border-subtle); font-size: 11px; display: flex; align-items: center; justify-content: space-between; gap: 8px;">
                <div style="display: flex; align-items: center; gap: 8px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 14px; height: 14px; stroke: var(--primary); flex-shrink: 0;"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
                    <span id="mods-summary-${server.id}" style="color: var(--text-dim); overflow: hidden; text-overflow: ellipsis;">Détection des mods...</span>
                </div>
                <span class="rx-tag" id="mods-count-${server.id}" style="font-size: 10px; padding: 3px 8px; border-radius: 4px; flex-shrink: 0; background: rgba(255,255,255,0.06); color: var(--text-muted); border: 1px solid var(--border-subtle);">-</span>
            </div>

            <div class="server-actions">
                <button class="rx-btn rx-btn-primary btn-join-server" style="flex: 1.3; font-weight: 700;" data-id="${server.id}">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><polygon points="6 3 20 12 6 21 6 3"></polygon></svg>
                    <span>Rejoindre</span>
                </button>
                <button class="rx-btn rx-btn-secondary btn-sync-mods" title="Télécharger les mods du serveur" style="flex: 1; font-weight: 600;" data-id="${server.id}">
                    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
                    <span>Sync Mods</span>
                </button>
                <button class="rx-btn rx-btn-secondary btn-open-panel" title="Gérer sur le Panel" style="padding: 9px 12px;" data-id="${server.id}">
                    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
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
                    badge.innerHTML = '<span class="badge-text">● En Ligne</span>';
                } else if (state === 'starting') {
                    badge.className = 'server-badge starting';
                    badge.innerHTML = '<span class="badge-text">● Démarrage...</span>';
                } else {
                    badge.className = 'server-badge offline';
                    badge.innerHTML = '<span class="badge-text">● Hors-Ligne</span>';
                }

                const ramMb = (res.resources.resources.memory_bytes / (1024 * 1024)).toFixed(0);
                ramValue.innerText = `${ramMb} MB`;
                cpuValue.innerText = `${res.resources.resources.cpu_absolute.toFixed(1)}%`;
            } else {
                badge.className = 'server-badge offline';
                badge.innerHTML = '<span class="badge-text">● Hors-Ligne</span>';
                ramValue.innerText = '-';
                cpuValue.innerText = '0%';
            }
        } catch (_) {
            badge.className = 'server-badge offline';
            badge.innerHTML = '<span class="badge-text">● Hors-Ligne</span>';
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
        // Auto-sync player to server whitelist before joining if credentials available
        if (account && apiKey) {
            try {
                await pelicanService.syncPlayerToServer(server.id, account, apiKey, panelUrl);
            } catch (_) {}
        }

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
    // PELICAN ⟷ MICROSOFT SYNC SYSTEM
    // ==========================================
    initPelicanSync() {
        const btnDashboardSync = document.getElementById('btn-sync-microsoft-pelican');
        const btnCloudSync = document.getElementById('btn-sync-cloud-account');
        const btnSettingsSync = document.getElementById('btn-sync-settings-action');

        const triggerSync = () => this.handlePelicanSync(false);

        btnDashboardSync?.addEventListener('click', triggerSync);
        btnCloudSync?.addEventListener('click', triggerSync);
        btnSettingsSync?.addEventListener('click', triggerSync);

        this.updatePelicanSyncUI();
    }

    async handlePelicanSync(silent = false) {
        const account = this.getActiveAccount();
        if (!account || !account.name) {
            if (!silent) this.showNotification('Compte requis', 'Sélectionnez un compte Minecraft actif avant de synchroniser.');
            return;
        }

        const isMicrosoft = account.meta?.type === 'Xbox' || (account.access_token && account.access_token !== 'null');
        if (!isMicrosoft && !silent) {
            const proceed = confirm(`Le compte actif "${account.name}" est un compte hors-ligne. Les serveurs Pelican officiels requièrent un compte Microsoft.\n\nVoulez-vous quand même synchroniser ce pseudo sur vos serveurs Pelican ?`);
            if (!proceed) return;
        }

        const apiKey = store.get('apiKey');
        const panelUrl = store.get('panelUrl') || 'https://panel.rxcorp.fr';

        if (!apiKey) {
            if (!silent) {
                this.showNotification('Clé API manquante', 'Renseignez votre Clé API Pelican dans les Paramètres.');
                this.selectDribbbleMode('settings');
            }
            return;
        }

        const syncBtns = [
            document.getElementById('btn-sync-microsoft-pelican'),
            document.getElementById('btn-sync-cloud-account'),
            document.getElementById('btn-sync-settings-action')
        ];

        syncBtns.forEach(btn => {
            if (btn) {
                btn.disabled = true;
                btn.dataset.prevHtml = btn.innerHTML;
                btn.innerHTML = '<span>Synchronisation...</span>';
            }
        });

        try {
            this.updateDockStatus(`Synchronisation de ${account.name} avec Pelican...`);
            const res = await pelicanService.syncMicrosoftAccountToAllServers(account, apiKey, panelUrl, (prog) => {
                this.updateDockStatus(prog.message || 'Synchronisation Pelican...');
            });

            if (res.success) {
                store.set('pelicanMicrosoftSync', {
                    playerName: account.name,
                    playerUuid: account.uuid,
                    syncedAt: Date.now(),
                    syncedServers: res.syncedCount
                });
                this.showNotification('Synchronisation Réussie', `Compte ${account.name} synchronisé sur ${res.syncedCount} serveur(s) Pelican !`);
            } else {
                if (!silent) this.showNotification('Erreur Pelican', res.error || 'Aucun serveur synchronisé');
            }
        } catch (err) {
            console.error('[Pelican Sync Error]:', err);
            if (!silent) this.showNotification('Erreur de synchronisation', err.message);
        } finally {
            syncBtns.forEach(btn => {
                if (btn) {
                    btn.disabled = false;
                    if (btn.dataset.prevHtml) btn.innerHTML = btn.dataset.prevHtml;
                }
            });
            this.updateDockStatus('Prêt à jouer', 0);
            this.updatePelicanSyncUI();
        }
    }

    updatePelicanSyncUI() {
        const account = this.getActiveAccount();
        const syncData = store.get('pelicanMicrosoftSync');

        const isSynced = syncData && account && syncData.playerName && syncData.playerName.toLowerCase() === account.name.toLowerCase();

        // 1. Dashboard Banner Card 1
        const bannerText = document.getElementById('sync-banner-text');
        const bannerDot = document.getElementById('sync-banner-dot');
        const btnBannerText = document.getElementById('btn-sync-text');

        if (bannerText && bannerDot) {
            if (isSynced) {
                bannerDot.style.background = 'var(--emerald)';
                bannerDot.style.boxShadow = '0 0 8px var(--emerald)';
                const dateStr = syncData.syncedAt ? new Date(syncData.syncedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
                bannerText.innerHTML = `Compte <strong>${account.name}</strong> synchronisé (${syncData.syncedServers || 0} serveurs • ${dateStr})`;
                if (btnBannerText) btnBannerText.innerText = 'Re-sync';
            } else if (account) {
                bannerDot.style.background = 'var(--amber)';
                bannerDot.style.boxShadow = '0 0 8px var(--amber)';
                bannerText.innerHTML = `Compte <strong>${account.name}</strong> non synchronisé sur Pelican`;
                if (btnBannerText) btnBannerText.innerText = 'Synchroniser';
            } else {
                bannerDot.style.background = 'var(--text-dim)';
                bannerDot.style.boxShadow = 'none';
                bannerText.innerText = 'Connectez un compte pour synchroniser avec Pelican';
                if (btnBannerText) btnBannerText.innerText = 'Connexion';
            }
        }

        // 2. View Cloud Box
        const avatarElem = document.getElementById('sync-player-avatar');
        const titleElem = document.getElementById('sync-box-title');
        const subElem = document.getElementById('sync-box-sub');
        const statusBadge = document.getElementById('sync-badge-status');
        const btnCloudText = document.getElementById('btn-sync-cloud-text');

        if (avatarElem && account) {
            avatarElem.src = `https://mc-heads.net/avatar/${account.name}/36`;
            avatarElem.onerror = () => { avatarElem.src = 'assets/images/icon/icon.png'; };
        }

        if (titleElem && subElem) {
            if (isSynced) {
                titleElem.innerHTML = `Compte Microsoft <span style="color: var(--emerald);">Synchronisé</span> : ${account.name}`;
                subElem.innerText = `Votre joueur est autorisé sur la whitelist de vos serveurs Pelican Cloud (${syncData.syncedServers || 0} serveurs).`;
                if (statusBadge) statusBadge.style.background = 'var(--emerald)';
                if (btnCloudText) btnCloudText.innerText = 'Re-synchroniser Whitelist';
            } else if (account) {
                titleElem.innerHTML = `Compte Microsoft Détecté : ${account.name}`;
                subElem.innerText = `Cliquez pour propager automatiquement la whitelist de ${account.name} sur tous vos serveurs Pelican.`;
                if (statusBadge) statusBadge.style.background = 'var(--amber)';
                if (btnCloudText) btnCloudText.innerText = 'Synchroniser Whitelist';
            } else {
                titleElem.innerText = 'Aucun compte Minecraft actif';
                subElem.innerText = 'Connectez votre compte Microsoft pour synchroniser automatiquement vos serveurs.';
                if (statusBadge) statusBadge.style.background = 'var(--text-dim)';
            }
        }

        // 3. Settings Card
        const settingsIndicator = document.getElementById('sync-settings-indicator');
        const settingsDesc = document.getElementById('sync-settings-desc');
        const btnSettings = document.getElementById('btn-sync-settings-action');

        if (settingsIndicator && settingsDesc) {
            if (isSynced) {
                settingsIndicator.style.background = 'var(--emerald)';
                settingsIndicator.style.boxShadow = '0 0 6px var(--emerald)';
                settingsDesc.innerHTML = `Compte <strong>${account.name}</strong> synchronisé avec succès sur Pelican Cloud.`;
                if (btnSettings) btnSettings.innerText = 'Re-sync';
            } else if (account) {
                settingsIndicator.style.background = 'var(--amber)';
                settingsIndicator.style.boxShadow = '0 0 6px var(--amber)';
                settingsDesc.innerHTML = `Compte <strong>${account.name}</strong> prêt à être synchronisé sur vos serveurs Pelican.`;
                if (btnSettings) btnSettings.innerText = 'Synchroniser';
            } else {
                settingsIndicator.style.background = 'var(--text-dim)';
                settingsIndicator.style.boxShadow = 'none';
                settingsDesc.innerText = 'Connectez un compte Microsoft pour activer la liaison automatique Pelican.';
            }
        }
    }

    // ==========================================
    // INSTANCES MANAGEMENT (LOCAL PROFILES)
    // ==========================================
    async loadInstances() {
        // Ensure standard starter instances exist so the grid is populated naturally
        instanceService.ensureDefaultProfiles();

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
                        card.classList.add('active-local-card');
                    }

                    const loaderStr = (inst.loader || 'fabric').toUpperCase();
                    
                    // Determine icon based on loader / name
                    let iconMarkup = '<div style="font-size: 20px; width: 38px; height: 38px; border-radius: 8px; background: rgba(255,255,255,0.06); display: flex; align-items: center; justify-content: center;">📦</div>';
                    if (loaderStr.includes('VANILLA') || (inst.name && inst.name.toLowerCase().includes('vanilla'))) {
                        iconMarkup = `
                            <div style="width: 38px; height: 38px; min-width: 38px; border-radius: 8px; background: linear-gradient(135deg, #15803d 0%, #854d0e 45%, #713f12 100%); display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 10px rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1);">
                                <span style="font-size: 18px;" title="Bloc de Terre (Vanilla)">🌱</span>
                            </div>
                        `;
                    } else if (loaderStr.includes('FABRIC')) {
                        iconMarkup = `
                            <div style="width: 38px; height: 38px; min-width: 38px; border-radius: 8px; background: linear-gradient(135deg, #e0e7ff 0%, #a5b4fc 100%); display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 10px rgba(99,102,241,0.25); border: 1px solid rgba(255,255,255,0.2);">
                                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#4338ca" stroke-width="2.2"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                            </div>
                        `;
                    } else if (loaderStr.includes('FORGE')) {
                        iconMarkup = `
                            <div style="width: 38px; height: 38px; min-width: 38px; border-radius: 8px; background: linear-gradient(135deg, #334155 0%, #1e293b 100%); display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 10px rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.15);">
                                <span style="font-size: 18px;" title="Forge (Enclume / Marteau)">⚒️</span>
                            </div>
                        `;
                    }

                    card.innerHTML = `
                        <div class="server-card-top">
                            <div style="display: flex; align-items: center; gap: 10px; overflow: hidden;">
                                ${iconMarkup}
                                <div class="server-name-box">
                                    <h3 class="server-name" title="${inst.name}">${inst.name}</h3>
                                    <span style="font-size: 11px; color: var(--text-dim);">Minecraft ${inst.version || '1.21.4'} • ${loaderStr}</span>
                                </div>
                            </div>
                            <div style="display: flex; align-items: center; gap: 6px;">
                                ${isCurrentLocal ? '<span class="instance-active-badge">✔ Actif</span>' : ''}
                                <button class="icon-tool-btn btn-rename-instance" data-id="${inst.id}" data-name="${inst.name}" title="Renommer">✏️</button>
                                <button class="icon-tool-btn btn-delete-instance" data-id="${inst.id}" title="Supprimer">🗑️</button>
                            </div>
                        </div>

                        <div class="server-stats-row">
                            <div class="stat-item">
                                <span class="stat-label">VERSION</span>
                                <span class="stat-value" style="color: var(--emerald-light);">${inst.version || '1.21.4'}</span>
                            </div>
                            <div class="stat-item">
                                <span class="stat-label">MODLOADER</span>
                                <span class="stat-value">${loaderStr}</span>
                            </div>
                            <div class="stat-item">
                                <span class="stat-label">MODS</span>
                                <span class="stat-value">${inst.modCount || 0} actif(s)</span>
                            </div>
                        </div>

                        <div class="server-actions">
                            <button class="rx-btn ${isCurrentLocal ? 'rx-btn-secondary' : 'rx-btn-primary'} btn-select-instance" style="flex: 1.2; font-weight: 700;" data-id="${inst.id}">
                                <span>${isCurrentLocal ? '✓ Profil Actif' : 'Sélectionner'}</span>
                            </button>
                            <button class="rx-btn rx-btn-secondary btn-folder-instance" title="Ouvrir le dossier dans l'explorateur" style="flex: 1; font-weight: 600;" data-id="${inst.id}">
                                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                                <span>Ouvrir ↗</span>
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

                    card.querySelector('.btn-rename-instance').addEventListener('click', () => {
                        const currentName = inst.name;
                        const newName = prompt('Entrez le nouveau nom pour ce profil :', currentName);
                        if (newName && newName.trim() && newName.trim() !== currentName) {
                            instanceService.renameInstance(inst.id, newName.trim());
                            this.loadInstances();
                            this.renderDashboardLists();
                            this.showNotification('Profil renommé', `Nouveau nom : ${newName.trim()}`);
                        }
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
                            this.showNotification('Profil supprimé', `Le profil "${inst.name}" a été supprimé.`);
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
                subElem.innerText = `Serveur Cloud RXCORP • ${inst.loader ? inst.loader.toUpperCase() : 'FORGE'}`;
            } else {
                subElem.innerText = `Profil Local • MC ${inst.version || '1.21.4'} • ${(inst.loader || 'fabric').toUpperCase()}`;
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

            let iconSrc = mod.iconUrl;
            const searchKey = `${mod.slug || ''} ${mod.title || ''}`.toLowerCase();
            if (!iconSrc || (iconSrc.includes('icon.png') && !iconSrc.includes('modrinth') && !iconSrc.includes('cursecdn'))) {
                if (searchKey.includes('sodium')) {
                    iconSrc = 'https://cdn.modrinth.com/data/AANobbMI/icon.png';
                } else if (searchKey.includes('iris')) {
                    iconSrc = 'https://cdn.modrinth.com/data/YL57xq9U/icon.png';
                } else if (searchKey.includes('distant') || searchKey.includes('horizon')) {
                    iconSrc = 'https://cdn.modrinth.com/data/u6msX0Oc/icon.png';
                } else if (searchKey.includes('fabric-api') || searchKey.includes('fabric api')) {
                    iconSrc = 'https://cdn.modrinth.com/data/P7dR8mSH/icon.png';
                } else if (searchKey.includes('appleskin')) {
                    iconSrc = 'https://cdn.modrinth.com/data/EsAfCjCV/icon.png';
                } else if (searchKey.includes('jei') || searchKey.includes('just enough')) {
                    iconSrc = 'https://cdn.modrinth.com/data/u6dRKJwZ/icon.png';
                } else {
                    iconSrc = 'assets/images/icon/icon.png';
                }
            }

            const rawDownloads = Number(mod.downloads) || 0;
            const downloadsFormatted = rawDownloads >= 1000000 
                ? (rawDownloads / 1000000).toFixed(1) + 'M' 
                : (rawDownloads >= 1000 ? (rawDownloads / 1000).toFixed(0) + 'k' : rawDownloads);

            const rawFollows = Number(mod.follows) || 0;
            const followsFormatted = rawFollows >= 1000
                ? (rawFollows / 1000).toFixed(1) + 'k'
                : rawFollows;

            const sourceBadge = this.activeModSource === 'curseforge' ? 'CurseForge' : 'Modrinth';
            const categories = (mod.categories || []).slice(0, 2);

            card.innerHTML = `
                <div>
                    <div class="mod-card-header">
                        <img class="mod-icon" src="${iconSrc}" alt="${mod.title}" onerror="this.onerror=null;this.src='assets/images/icon/icon.png'">
                        <div class="mod-info-box">
                            <div class="mod-title" title="${mod.title}">${mod.title}</div>
                            <div class="mod-author">par ${mod.author || 'Auteur inconnu'}</div>
                            <div class="mod-tags-row">
                                <span class="mod-tag-badge" style="color: ${this.activeModSource === 'curseforge' ? 'var(--amber)' : 'var(--emerald)'};">${sourceBadge}</span>
                                ${categories.map(c => `<span class="mod-tag-badge">${c}</span>`).join('')}
                            </div>
                        </div>
                    </div>
                    <div class="mod-desc" style="margin-top: 10px;" title="${mod.description || ''}">
                        ${mod.description || 'Aucune description fournie.'}
                    </div>
                </div>
                <div class="mod-footer">
                    <div class="mod-stats">
                        <span title="${rawDownloads} téléchargements">⬇ ${downloadsFormatted}</span>
                        <span title="${rawFollows} favoris">★ ${followsFormatted}</span>
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
                    this.showNotification('Profil requis', 'Sélectionnez un profil local cible avant d\'installer un mod.');
                    btn.disabled = false;
                    btn.innerHTML = '<span>📥 Installer</span>';
                    return;
                }

                try {
                    if (this.activeModSource === 'curseforge') {
                        const filesRes = await curseforgeService.getCompatibleVersions(mod.id, inst.version, inst.loader);
                        if (!filesRes.success || !filesRes.versions.length) {
                            this.showNotification('Incompatible', `Aucun fichier CurseForge pour MC ${inst.version} (${inst.loader})`);
                            btn.disabled = false;
                            btn.innerHTML = '<span>📥 Installer</span>';
                            return;
                        }
                        const file = filesRes.versions[0];
                        await curseforgeService.installMod(inst.modsPath, file.downloadUrl, file.fileName);
                    } else {
                        const versionsRes = await modrinthService.getCompatibleVersions(mod.slug, inst.version, inst.loader);
                        if (!versionsRes.success || !versionsRes.versions.length) {
                            this.showNotification('Incompatible', `Aucune version Modrinth pour MC ${inst.version} (${inst.loader})`);
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
                    this.showNotification('Erreur de téléchargement', err.message);
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
                this.showNotification('Aucun serveur', 'Sélectionnez un serveur Cloud Pelican ou connectez-vous.');
                this.openDrawer('cloud', 'SERVEURS PELICAN CLOUD');
            } else {
                this.showNotification('Aucun profil', 'Créez ou sélectionnez un profil local d\'abord.');
                this.openDrawer('instances', 'MES PROFILS & MODPACKS');
            }
            return;
        }

        this.activeInstance = targetInst;

        const launchBtn = document.getElementById('btn-launch-game');
        launchBtn.disabled = true;
        launchBtn.innerHTML = '<span>LANCEMENT...</span>';

        let ramMax = store.get('ramMax') || 6;
        if (ramMax > 100) ramMax = Math.round(ramMax / 1024);
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
                        this.showNotification('Erreur de lancement', err.message || String(err));
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
        const labelRam = document.getElementById('label-ram-max');
        const ramButtons = document.querySelectorAll('.ram-pill-btn');
        const inputJava = document.getElementById('input-java-path');
        const inputUrl = document.getElementById('settings-panel-url');
        const inputKey = document.getElementById('settings-panel-key');
        const inputCurseForge = document.getElementById('input-curseforge-key');
        const btnSave = document.getElementById('btn-save-settings');

        // Populate saved RAM
        let currentRam = store.get('ramMax') || 6;
        if (currentRam > 100) currentRam = Math.round(currentRam / 1024);
        if (![4, 6, 8, 16].includes(currentRam)) currentRam = 6;

        const updateRamUI = (val) => {
            currentRam = val;
            ramButtons.forEach(btn => {
                const btnVal = parseInt(btn.getAttribute('data-ram'), 10);
                btn.classList.toggle('active', btnVal === val);
            });
            if (labelRam) {
                labelRam.innerText = `${val} Go ${val === 6 ? '• (Recommandé)' : ''}`;
            }
        };

        ramButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const val = parseInt(btn.getAttribute('data-ram'), 10);
                if (val) {
                    updateRamUI(val);
                    store.set('ramMax', val);
                }
            });
        });

        updateRamUI(currentRam);

        if (inputJava) inputJava.value = store.get('javaPath') || '';
        if (inputUrl) inputUrl.value = store.get('panelUrl') || 'https://panel.rxcorp.fr';
        if (inputKey) inputKey.value = store.get('apiKey') || '';
        if (inputCurseForge) inputCurseForge.value = store.get('curseforgeApiKey') || '';

        // Mode Selection Handler (Cloud Server vs Local Player / Friends)
        this.initModeSelector();

        // Language Switcher Handler
        this.initLanguageSelector();

        btnSave?.addEventListener('click', () => {
            store.set('ramMax', currentRam);
            store.set('javaPath', inputJava ? inputJava.value.trim() : '');
            store.set('panelUrl', inputUrl ? inputUrl.value.trim() : '');
            store.set('apiKey', inputKey ? inputKey.value.trim() : '');

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
                this.showNotification('Clé manquante', 'Entrez une clé API Client valide.');
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
                this.showNotification('Connexion réussie !', `Connecté : ${res.user.username} (${res.user.email})`);
            } else {
                this.showNotification('Échec de connexion', res.error);
            }
        });

        // Disconnect panel button
        document.getElementById('btn-disconnect-panel')?.addEventListener('click', () => {
            store.set('apiKey', '');
            if (inputKey) inputKey.value = '';
            this.loadCloudServers();
            this.showNotification('Déconnecté', 'Vous avez été déconnecté du Panel Pelican.');
        });
    }

    initModeSelector() {
        const cardCloud = document.getElementById('card-mode-cloud');
        const cardLocal = document.getElementById('card-mode-local');
        const pelicanSettingsCard = document.getElementById('settings-card-pelican');

        const currentHasServer = store.get('hasPelicanServer') ?? (store.get('apiKey') ? true : false);

        const applyModeUI = (hasServer) => {
            if (cardCloud && cardLocal) {
                cardCloud.classList.toggle('active-cloud', hasServer);
                cardLocal.classList.toggle('active-local', !hasServer);
            }
            if (pelicanSettingsCard) {
                pelicanSettingsCard.style.opacity = hasServer ? '1' : '0.8';
            }
            this.updateRailOrder(hasServer);
        };

        applyModeUI(currentHasServer);

        cardCloud?.addEventListener('click', () => {
            store.set('hasPelicanServer', true);
            applyModeUI(true);
            this.showNotification('Mode Serveur RXCORP Cloud', 'Infrastructure Cloud et synchronisation Pelican activées au premier plan.');
        });

        cardLocal?.addEventListener('click', () => {
            store.set('hasPelicanServer', false);
            applyModeUI(false);
            if (this.activeDribbbleMode === 'cloud') {
                this.selectDribbbleMode('instances');
            }
            this.showNotification('Mode Joueur Indépendant', 'Mode local et catalogue de mods activés au premier plan. Mode Cloud discret.');
        });
    }

    initLanguageSelector() {
        const langBtns = document.querySelectorAll('.lang-btn');
        const currentLang = store.get('lang') || 'fr';

        langBtns.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.lang === currentLang);
            btn.addEventListener('click', () => {
                const chosenLang = btn.dataset.lang;
                store.set('lang', chosenLang);
                langBtns.forEach(b => b.classList.toggle('active', b.dataset.lang === chosenLang));
                this.showNotification('Langue mise à jour', chosenLang === 'fr' ? 'Langue définie sur Français 🇫🇷' : 'Language set to English 🇬🇧');
            });
        });
    }

    updateRailOrder(hasPelicanServer) {
        const railTop = document.querySelector('.dribbble-rail .rail-top');
        if (!railTop) return;
        const cloudBtn = railTop.querySelector('[data-view="cloud"]');
        const instBtn = railTop.querySelector('[data-view="instances"]');
        const modBtn = railTop.querySelector('[data-view="modrinth"]');
        if (!cloudBtn || !instBtn || !modBtn) return;

        if (hasPelicanServer) {
            cloudBtn.setAttribute('title', 'RX Cloud (Serveurs Officiels Pelican)');
            railTop.insertBefore(cloudBtn, instBtn);
            railTop.appendChild(modBtn);
        } else {
            cloudBtn.setAttribute('title', 'RX Cloud (Secondaire - Pas de serveur lié)');
            railTop.insertBefore(instBtn, cloudBtn);
            railTop.insertBefore(modBtn, cloudBtn);
        }
    }

    // ==========================================
    // ONBOARDING SETUP WIZARD (FIRST LAUNCH SIMPLE LOGIN)
    // ==========================================
    initOnboardingWizard() {
        const overlay = document.getElementById('page-onboarding');
        const btnOpen = document.getElementById('btn-open-config-wizard');
        const btnClose = document.getElementById('btn-close-onboard');
        const btnMicrosoft = document.getElementById('btn-onboard-microsoft');
        const inputUsername = document.getElementById('input-onboard-username');
        const btnConfirmOffline = document.getElementById('btn-onboard-confirm-offline');

        if (!overlay) return;

        // Check if user already configured an account
        const isConfigured = store.get('configured');
        const accounts = store.get('accounts') || [];
        const hasRealAccount = accounts.some(a => a.name && a.name !== 'Player');

        if (!isConfigured && !hasRealAccount) {
            overlay.style.display = 'flex';
            if (btnClose) btnClose.style.display = 'none';
        } else {
            overlay.style.display = 'none';
        }

        // Open config modal from top titlebar
        btnOpen?.addEventListener('click', () => {
            if (btnClose) btnClose.style.display = 'inline-flex';
            overlay.style.display = 'flex';
            if (inputUsername) inputUsername.focus();
        });

        // Close modal if user already has an account
        btnClose?.addEventListener('click', () => {
            overlay.style.display = 'none';
        });

        // Handle offline pseudo login
        const handleOfflineSubmit = () => {
            const val = (inputUsername?.value || '').trim();
            if (!val) {
                this.showNotification('Pseudo requis', 'Entrez un pseudo valide pour continuer.');
                return;
            }
            let accList = store.get('accounts') || [];
            // Remove placeholder 'Player'
            accList = accList.filter(a => a.name !== 'Player');
            if (!accList.some(a => a.name.toLowerCase() === val.toLowerCase())) {
                accList.push({
                    name: val,
                    uuid: 'offline-' + Date.now(),
                    meta: { type: 'Offline', online: false }
                });
            }
            store.set('accounts', accList);
            store.set('activeAccountName', val);
            store.set('configured', true);
            this.renderAccountsList();
            overlay.style.display = 'none';
            this.showNotification('Bienvenue', `Joueur ${val} prêt à jouer !`);
        };

        btnConfirmOffline?.addEventListener('click', handleOfflineSubmit);
        inputUsername?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') handleOfflineSubmit();
        });

        // Handle Pelican Web Auth
        document.getElementById('btn-onboard-web-auth')?.addEventListener('click', () => {
            this.showNotification('Connexion Web', 'Ouverture de votre navigateur pour validation...');
            ipcRenderer.send('start-web-auth');
        });

        // Handle Microsoft 1-Click login
        btnMicrosoft?.addEventListener('click', async () => {
            try {
                this.updateDockStatus(i18n.t('launching') || 'Connexion Microsoft en cours...');
                const client_id = "00000000402b5328";
                const auth = await ipcRenderer.invoke('Microsoft-window', client_id);
                if (auth && auth.name) {
                    let accList = store.get('accounts') || [];
                    accList = accList.filter(a => a.name !== 'Player');
                    const existingIdx = accList.findIndex(a => a.name.toLowerCase() === auth.name.toLowerCase());
                    if (existingIdx >= 0) {
                        accList[existingIdx] = auth;
                    } else {
                        accList.push(auth);
                    }
                    store.set('accounts', accList);
                    store.set('activeAccountName', auth.name);
                    store.set('configured', true);
                    this.renderAccountsList();
                    this.updatePelicanSyncUI();
                    overlay.style.display = 'none';
                    this.showNotification('Compte Microsoft Connecté', `Bienvenue ${auth.name} !`);

                    // Propagate to Pelican whitelist if configured
                    if (store.get('apiKey')) {
                        this.handlePelicanSync(true);
                    }
                }
            } catch (err) {
                this.showNotification('Erreur Microsoft', err.message);
            } finally {
                this.updateDockStatus(i18n.t('ready_to_play'), 0);
            }
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
                store.set('configured', true);
                const firstLaunchModal = document.getElementById('modal-first-launch');
                if (firstLaunchModal) firstLaunchModal.style.display = 'none';
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
                this.showNotification('Pseudo requis', 'Entrez un pseudo pour votre compte hors-ligne.');
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
                    this.updatePelicanSyncUI();
                    this.showNotification('Compte connecté', `Bienvenue ${auth.name} !`);

                    // Automatically propagate Microsoft account to Pelican server whitelist
                    if (store.get('apiKey')) {
                        this.handlePelicanSync(true);
                    }
                }
            } catch (err) {
                this.showNotification('Erreur Microsoft', err.message);
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
            const skinName = document.getElementById('settings-skin-name');
            const skinBody = document.getElementById('settings-skin-body');
            if (skinName) skinName.innerText = activeAccount.name;
            if (skinBody) {
                skinBody.src = `https://mc-heads.net/body/${activeAccount.name}/220`;
                skinBody.onerror = () => { skinBody.src = 'https://mc-heads.net/body/Steve/220'; };
            }
        }

        if (!list) return;
        const accounts = store.get('accounts') || [];

        if (accounts.length === 0) {
            list.innerHTML = `
                <div style="font-size: 12px; color: var(--text-dim); text-align: center; padding: 18px 10px; background: rgba(0,0,0,0.2); border-radius: var(--radius-md); border: 1px dashed var(--border-subtle);">
                    Aucun compte enregistré. Cliquez sur <strong>+ Compte Microsoft</strong> ou <strong>+ Pseudo libre</strong> pour ajouter votre joueur.
                </div>
            `;
            return;
        }

        list.innerHTML = accounts.map(acc => {
            const isActive = acc.name === activeAccount?.name;
            const isMicrosoft = acc.meta?.type === 'Xbox' || acc.access_token;
            return `
                <div class="clean-account-row ${isActive ? 'active' : ''}">
                    <div class="clean-account-left">
                        <img class="clean-account-avatar" src="https://mc-heads.net/avatar/${acc.name}/32" onerror="this.src='assets/images/icon/icon.png'">
                        <div>
                            <div class="clean-account-name">${acc.name}</div>
                            <div class="clean-account-type">${isMicrosoft ? 'Compte Microsoft Officiel' : 'Compte Hors-Ligne'}</div>
                        </div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        ${isActive 
                            ? '<span style="color: var(--emerald); font-size: 12px; font-weight: 700; padding: 4px 10px; background: rgba(16, 185, 129, 0.12); border-radius: 6px;">✓ Actif</span>'
                            : `<button class="rx-btn rx-btn-secondary btn-switch-account" data-name="${acc.name}" style="padding: 4px 10px; font-size: 11px;">Activer</button>`
                        }
                        <button class="rx-btn rx-btn-danger btn-delete-account" data-name="${acc.name}" title="Supprimer ce compte" style="padding: 4px 8px; font-size: 11px; min-width: unset;">✕</button>
                    </div>
                </div>
            `;
        }).join('');

        list.querySelectorAll('.btn-switch-account').forEach(btn => {
            btn.addEventListener('click', () => {
                store.set('activeAccountName', btn.dataset.name);
                this.renderAccountsList();
                this.updatePelicanSyncUI();
            });
        });

        list.querySelectorAll('.btn-delete-account').forEach(btn => {
            btn.addEventListener('click', () => {
                const name = btn.dataset.name;
                let accs = store.get('accounts') || [];
                accs = accs.filter(a => a.name !== name);
                store.set('accounts', accs);
                if (store.get('activeAccountName') === name) {
                    store.set('activeAccountName', accs[0] ? accs[0].name : '');
                }
                this.renderAccountsList();
                this.updatePelicanSyncUI();
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
                this.showNotification('Nom requis', 'Donnez un nom à votre profil avant de continuer.');
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
