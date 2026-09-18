/**
 * RXCORP Launcher - i18n Translation System
 * Provides multi-language support (French & English)
 */

const Store = require('electron-store');
const store = new Store();

const translations = {
    fr: {
        // Titlebar & Status
        brand_title: "RXCORP",
        cloud_sync_ok: "RXCORP CLOUD • SYNCHRONISÉ",
        cloud_sync_local: "MODE JOUEUR LOCAL",
        update_available: "MAJ DISPONIBLE",
        config_btn: "Configuration",
        ready_to_play: "Prêt à jouer",
        launching: "Lancement du jeu...",
        downloading: "Téléchargement...",

        // Left Navigation Rail Tooltips
        nav_home: "Accueil & Actualités",
        nav_cloud: "Serveurs Cloud Pelican",
        nav_instances: "Profils & Modpacks Locaux",
        nav_mods: "Catalogue Mods & Shaders",
        nav_settings: "Paramètres & Whitelist",
        nav_add_instance: "Nouveau Profil Local",

        // Home View - Showcase
        hero_tag_cloud: "OFFICIEL RXCORP • SERVEUR CLOUD",
        hero_tag_local: "PROFIL LOCAL • MINECRAFT",
        hero_title_cloud: "RXCORP CLOUD & SURVIE",
        hero_desc_cloud: "Infrastructure Cloud Pelican officielle avec synchronisation automatique de la whitelist et connexion instantanée.",
        hero_title_local: "GESTIONNAIRE LOCAL",
        hero_desc_local: "Profils et modpacks Minecraft locaux autonomes (Fabric, Forge, NeoForge, Vanilla).",
        play_btn: "JOUER",
        play_btn_local: "LANCER",
        sync_mods_btn: "Synchroniser les Mods",
        create_profile_btn: "+ Nouveau Profil",

        // Home View - News
        news_section_title: "ACTUALITÉS & ÉVÉNEMENTS",
        news_view_all: "Site Web ↗",
        news_1_tag: "MAJ SERVEUR",
        news_1_date: "14 Septembre 2026",
        news_1_title: "Ouverture de la Saison Survie 1.21.4",
        news_1_desc: "Découvrez les nouvelles zones et profitez de la synchronisation automatique de votre whitelist.",
        news_2_tag: "OPTIMISATION",
        news_2_date: "12 Septembre 2026",
        news_2_title: "Pack de Shaders & Sodium",
        news_2_desc: "Plus de 140 FPS garantis avec notre sélection de mods d'optimisation intégrés au launcher.",
        news_3_tag: "COMMUNAUTÉ",
        news_3_date: "10 Septembre 2026",
        news_3_title: "Rejoignez le Discord Communautaire",
        news_3_desc: "Événements hebdomadaires, annonces de tournois et support technique en direct.",

        // First Launch Modal
        welcome_title: "Bienvenue sur RXCORP Launcher",
        welcome_sub: "Choisissez votre mode de connexion pour commencer votre aventure :",
        login_microsoft_btn: "Connexion Compte Microsoft",
        login_microsoft_sub: "Ouvre votre navigateur pour une connexion officielle sécurisée",
        login_pelican_web_btn: "Lier mon compte Panel RXCORP",
        login_pelican_web_sub: "Ouvre le navigateur web pour synchroniser vos serveurs Cloud",
        login_offline_title: "Mode Hors-ligne (Pseudo Libre)",
        login_offline_placeholder: "Entrez votre pseudo (ex: Salem, Steve...)",
        login_offline_btn: "Jouer en Hors-ligne",
        login_terms: "Non affilié à Mojang, AB. Tous droits réservés.",

        // Cloud View
        cloud_title: "Serveurs Pelican Cloud",
        cloud_subtitle: "Infrastructure officielle RXCORP • Whitelist synchronisée et connexion 1-clic",
        cloud_refresh: "Rafraîchir",
        sync_detected: "Compte Détecté",
        sync_btn: "Synchroniser Whitelist",
        sync_active: "Whitelist Synchronisée",
        srv_online: "En ligne",
        srv_offline: "Hors-ligne",
        srv_connect: "Rejoindre",

        // Instances View
        instances_title: "Mes Profils & Modpacks Locaux",
        instances_subtitle: "Gérez vos installations autonomes de Minecraft (Fabric, Forge, NeoForge, Vanilla)",
        new_instance_btn: "Nouveau Profil",
        launch_instance: "Lancer",

        // Mods View
        mods_title: "Catalogue Mods & Shaders",
        mods_subtitle: "Recherchez et installez vos mods depuis Modrinth et CurseForge",
        mods_search_placeholder: "Rechercher un mod, shader, pack (Sodium, Iris, Create...)",
        mods_search_btn: "Rechercher",
        install_btn: "Installer",

        // Settings View
        settings_title: "Configuration du Système",
        settings_subtitle: "Comptes, synchronisation Pelican, whitelist et mémoire RAM",
        save_settings_btn: "Sauvegarder les Paramètres",
        account_section: "Compte Minecraft & Authentification",
        ram_section: "Allocation Mémoire RAM",
        java_section: "Java & APIs",
        pelican_section: "Synchronisation Panel Pelican & Whitelist",
        language_section: "Langue du Launcher",
        skin_ready: "Prêt pour Minecraft 1.21.4"
    },
    en: {
        // Titlebar & Status
        brand_title: "RXCORP",
        cloud_sync_ok: "RXCORP CLOUD • SYNCED",
        cloud_sync_local: "LOCAL PLAYER MODE",
        update_available: "UPDATE READY",
        config_btn: "Settings",
        ready_to_play: "Ready to play",
        launching: "Launching game...",
        downloading: "Downloading...",

        // Left Navigation Rail Tooltips
        nav_home: "Home & News",
        nav_cloud: "Pelican Cloud Servers",
        nav_instances: "Local Profiles & Modpacks",
        nav_mods: "Mods & Shaders Store",
        nav_settings: "Settings & Whitelist",
        nav_add_instance: "New Local Profile",

        // Home View - Showcase
        hero_tag_cloud: "OFFICIAL RXCORP • CLOUD SERVER",
        hero_tag_local: "LOCAL PROFILE • MINECRAFT",
        hero_title_cloud: "RXCORP CLOUD & SURVIVAL",
        hero_desc_cloud: "Official Pelican Cloud infrastructure with automatic whitelist sync and 1-click connect.",
        hero_title_local: "LOCAL MANAGER",
        hero_desc_local: "Standalone local Minecraft profiles and modpacks (Fabric, Forge, NeoForge, Vanilla).",
        play_btn: "PLAY",
        play_btn_local: "LAUNCH",
        sync_mods_btn: "Sync Server Mods",
        create_profile_btn: "+ New Profile",

        // Home View - News
        news_section_title: "NEWS & RECENT EVENTS",
        news_view_all: "Website ↗",
        news_1_tag: "SERVER UPDATE",
        news_1_date: "September 14, 2026",
        news_1_title: "Survival 1.21.4 Season Launch",
        news_1_desc: "Explore new biomes and enjoy automated Microsoft whitelist sync on our servers.",
        news_2_tag: "OPTIMIZATION",
        news_2_date: "September 12, 2026",
        news_2_title: "Sodium & Shaders Boost Pack",
        news_2_desc: "140+ FPS guaranteed with our built-in performance optimization presets.",
        news_3_tag: "COMMUNITY",
        news_3_date: "September 10, 2026",
        news_3_title: "Join the Official Discord Community",
        news_3_desc: "Weekly events, build contests, and 24/7 technical live assistance.",

        // First Launch Modal
        welcome_title: "Welcome to RXCORP Launcher",
        welcome_sub: "Choose your authentication method to start your journey:",
        login_microsoft_btn: "Login with Microsoft",
        login_microsoft_sub: "Opens your web browser for a secure 1-click login",
        login_pelican_web_btn: "Link RXCORP Panel Account",
        login_pelican_web_sub: "Opens browser to sync your Pelican Cloud servers",
        login_offline_title: "Offline Mode (Free Username)",
        login_offline_placeholder: "Enter your username (e.g. Salem, Steve...)",
        login_offline_btn: "Play in Offline Mode",
        login_terms: "Not affiliated with Mojang, AB. All rights reserved.",

        // Cloud View
        cloud_title: "Pelican Cloud Servers",
        cloud_subtitle: "Official RXCORP servers • Auto-whitelist sync and 1-click join",
        cloud_refresh: "Refresh",
        sync_detected: "Account Detected",
        sync_btn: "Sync Whitelist",
        sync_active: "Whitelist Synced",
        srv_online: "Online",
        srv_offline: "Offline",
        srv_connect: "Join Server",

        // Instances View
        instances_title: "Local Profiles & Modpacks",
        instances_subtitle: "Manage your standalone Minecraft installs (Fabric, Forge, NeoForge, Vanilla)",
        new_instance_btn: "New Profile",
        launch_instance: "Launch",

        // Mods View
        mods_title: "Mods & Shaders Store",
        mods_subtitle: "Search and install mods from Modrinth and CurseForge in 1 click",
        mods_search_placeholder: "Search mods, shaders, resource packs (Sodium, Iris, Create...)",
        mods_search_btn: "Search",
        install_btn: "Install",

        // Settings View
        settings_title: "System Configuration",
        settings_subtitle: "Accounts, Pelican sync, whitelist and RAM allocation",
        save_settings_btn: "Save Settings",
        account_section: "Minecraft Account & Authentication",
        ram_section: "RAM Memory Allocation",
        java_section: "Java & APIs",
        pelican_section: "Pelican Panel & Whitelist Sync",
        language_section: "Launcher Language",
        skin_ready: "Ready for Minecraft 1.21.4"
    },
    es: {
        // Titlebar & Status
        brand_title: "RXCORP",
        cloud_sync_ok: "RXCORP CLOUD • SINCRONIZADO",
        cloud_sync_local: "MODO JUGADOR LOCAL",
        update_available: "ACT. DISPONIBLE",
        config_btn: "Configurar",
        ready_to_play: "Listo para jugar",
        launching: "Lanzando el juego...",
        downloading: "Descargando...",

        // Left Navigation Rail Tooltips
        nav_home: "Inicio y Noticias",
        nav_cloud: "Servidores Cloud Pelican",
        nav_instances: "Perfiles & Modpacks Locales",
        nav_mods: "Tienda de Mods & Shaders",
        nav_settings: "Ajustes & Whitelist",
        nav_add_instance: "Nuevo Perfil Local",

        // Home View
        hero_tag_cloud: "OFICIAL RXCORP • SERVIDOR CLOUD",
        hero_tag_local: "PERFIL LOCAL • MINECRAFT",
        hero_title_cloud: "RXCORP CLOUD & SUPERVIVENCIA",
        hero_desc_cloud: "Infraestructura Cloud Pelican oficial con sincronización automática de whitelist y conexión instantánea.",
        hero_title_local: "GESTOR LOCAL",
        hero_desc_local: "Perfiles y modpacks locales de Minecraft (Fabric, Forge, NeoForge, Vanilla).",
        play_btn: "JUGAR",
        play_btn_local: "LANZAR",
        sync_mods_btn: "Sincronizar Mods",
        create_profile_btn: "+ Nuevo Perfil",

        // News
        news_section_title: "NOTICIAS & EVENTOS",
        news_view_all: "Sitio Web ↗",
        news_1_tag: "ACT. SERVIDOR",
        news_1_date: "14 Septiembre 2026",
        news_1_title: "Apertura Temporada Supervivencia 1.21.4",
        news_1_desc: "Explora nuevas zonas y disfruta de la sincronización automática de tu whitelist.",
        news_2_tag: "OPTIMIZACIÓN",
        news_2_date: "12 Septiembre 2026",
        news_2_title: "Pack de Shaders & Sodium",
        news_2_desc: "Más de 140 FPS garantizados con nuestra selección de mods de optimización.",
        news_3_tag: "COMUNIDAD",
        news_3_date: "10 Septiembre 2026",
        news_3_title: "Únete al Discord Oficial",
        news_3_desc: "Eventos semanales, torneos y soporte técnico en directo.",

        // First Launch Modal
        welcome_title: "Bienvenido a RXCORP Launcher",
        welcome_sub: "Elige tu método de autenticación para comenzar:",
        login_microsoft_btn: "Iniciar sesión con Microsoft",
        login_microsoft_sub: "Abre tu navegador para un inicio de sesión seguro",
        login_pelican_web_btn: "Vincular cuenta Panel RXCORP",
        login_pelican_web_sub: "Abre el navegador para sincronizar servidores Cloud",
        login_offline_title: "Modo Sin Conexión (Nombre libre)",
        login_offline_placeholder: "Introduce tu nombre (ej: Salem, Steve...)",
        login_offline_btn: "Jugar Sin Conexión",
        login_terms: "No afiliado a Mojang, AB. Todos los derechos reservados.",

        // Cloud
        cloud_title: "Servidores Cloud Pelican",
        cloud_subtitle: "Servidores oficiales RXCORP • Whitelist auto y conexión 1-clic",
        cloud_refresh: "Actualizar",
        sync_detected: "Cuenta Detectada",
        sync_btn: "Sincronizar Whitelist",
        sync_active: "Whitelist Sincronizada",
        srv_online: "En línea",
        srv_offline: "Sin conexión",
        srv_connect: "Unirse",

        // Instances
        instances_title: "Mis Perfiles & Modpacks",
        instances_subtitle: "Gestiona tus instalaciones de Minecraft (Fabric, Forge, NeoForge, Vanilla)",
        new_instance_btn: "Nuevo Perfil",
        launch_instance: "Lanzar",

        // Mods
        mods_title: "Tienda de Mods & Shaders",
        mods_subtitle: "Busca e instala mods desde Modrinth y CurseForge",
        mods_search_placeholder: "Buscar mods, shaders, paquetes (Sodium, Iris, Create...)",
        mods_search_btn: "Buscar",
        install_btn: "Instalar",

        // Settings
        settings_title: "Configuración del Sistema",
        settings_subtitle: "Cuentas, sincronización Pelican, whitelist y RAM",
        save_settings_btn: "Guardar Ajustes",
        account_section: "Cuenta Minecraft & Autenticación",
        ram_section: "Asignación de Memoria RAM",
        java_section: "Java & APIs",
        pelican_section: "Panel Pelican & Sincronización",
        language_section: "Idioma del Launcher",
        skin_ready: "Listo para Minecraft 1.21.4"
    },
    de: {
        // Titlebar & Status
        brand_title: "RXCORP",
        cloud_sync_ok: "RXCORP CLOUD • SYNCHRONISIERT",
        cloud_sync_local: "LOKALER SPIELER MODUS",
        update_available: "UPDATE VERFÜGBAR",
        config_btn: "Einstellungen",
        ready_to_play: "Bereit zum Spielen",
        launching: "Spiel wird gestartet...",
        downloading: "Wird heruntergeladen...",

        // Navigation
        nav_home: "Start & Neuigkeiten",
        nav_cloud: "Pelican Cloud Server",
        nav_instances: "Lokale Profile & Modpacks",
        nav_mods: "Mods & Shader Katalog",
        nav_settings: "Einstellungen & Whitelist",
        nav_add_instance: "Neues lokales Profil",

        // Home
        hero_tag_cloud: "OFFIZIEL RXCORP • CLOUD SERVER",
        hero_tag_local: "LOKALES PROFIL • MINECRAFT",
        hero_title_cloud: "RXCORP CLOUD & ÜBERLEBEN",
        hero_desc_cloud: "Offizielle Pelican Cloud Infrastruktur mit automatischer Whitelist-Synchronisation.",
        hero_title_local: "LOKALER MANAGER",
        hero_desc_local: "Lokale Minecraft Profile und Modpacks (Fabric, Forge, NeoForge, Vanilla).",
        play_btn: "SPIELEN",
        play_btn_local: "STARTEN",
        sync_mods_btn: "Mods synchronisieren",
        create_profile_btn: "+ Neues Profil",

        // News
        news_section_title: "NEUIGKEITEN & EVENTS",
        news_view_all: "Webseite ↗",
        news_1_tag: "SERVER UPDATE",
        news_1_date: "14. September 2026",
        news_1_title: "Start der Überlebenssaison 1.21.4",
        news_1_desc: "Erkunde neue Gebiete und genieße die automatische Whitelist-Synchronisation.",
        news_2_tag: "OPTIMIERUNG",
        news_2_date: "12. September 2026",
        news_2_title: "Sodium & Shader Paket",
        news_2_desc: "Über 140 FPS garantiert mit unserem integrierten Optimierungspaket.",
        news_3_tag: "COMMUNITY",
        news_3_date: "10. September 2026",
        news_3_title: "Tritt dem Discord bei",
        news_3_desc: "Wöchentliche Events, Turniere und Live-Support.",

        // First Launch Modal
        welcome_title: "Willkommen bei RXCORP Launcher",
        welcome_sub: "Wähle deine Authentifizierungsmethode:",
        login_microsoft_btn: "Mit Microsoft anmelden",
        login_microsoft_sub: "Öffnet deinen Browser für sicheres 1-Klick-Login",
        login_pelican_web_btn: "RXCORP Panel-Konto verknüpfen",
        login_pelican_web_sub: "Öffnet den Browser zur Synchronisierung deiner Cloud-Server",
        login_offline_title: "Offline-Modus (Freier Benutzername)",
        login_offline_placeholder: "Benutzername eingeben (z.B. Salem, Steve...)",
        login_offline_btn: "Offline spielen",
        login_terms: "Nicht mit Mojang, AB. verbunden. Alle Rechte vorbehalten.",

        // Cloud
        cloud_title: "Pelican Cloud Server",
        cloud_subtitle: "Offizielle RXCORP Server • Auto-Whitelist und 1-Klick-Beitritt",
        cloud_refresh: "Aktualisieren",
        sync_detected: "Konto erkannt",
        sync_btn: "Whitelist synchronisieren",
        sync_active: "Whitelist synchronisiert",
        srv_online: "Online",
        srv_offline: "Offline",
        srv_connect: "Beitreten",

        // Instances
        instances_title: "Meine Profile & Modpacks",
        instances_subtitle: "Verwalte deine Minecraft-Installationen (Fabric, Forge, NeoForge, Vanilla)",
        new_instance_btn: "Neues Profil",
        launch_instance: "Starten",

        // Mods
        mods_title: "Mods & Shader Shop",
        mods_subtitle: "Suche und installiere Mods von Modrinth und CurseForge",
        mods_search_placeholder: "Mods suchen (Sodium, Iris, Create...)",
        mods_search_btn: "Suchen",
        install_btn: "Installieren",

        // Settings
        settings_title: "Systemkonfiguration",
        settings_subtitle: "Konten, Pelican-Sync, Whitelist und RAM",
        save_settings_btn: "Einstellungen speichern",
        account_section: "Minecraft-Konto & Authentifizierung",
        ram_section: "RAM-Speicherzuweisung",
        java_section: "Java & APIs",
        pelican_section: "Pelican Panel & Whitelist-Sync",
        language_section: "Launcher-Sprache",
        skin_ready: "Bereit für Minecraft 1.21.4"
    },
    pt: {
        // Titlebar & Status
        brand_title: "RXCORP",
        cloud_sync_ok: "RXCORP CLOUD • SINCRONIZADO",
        cloud_sync_local: "MODO JOGADOR LOCAL",
        update_available: "ATZ. DISPONÍVEL",
        config_btn: "Configurar",
        ready_to_play: "Pronto para jogar",
        launching: "Iniciando o jogo...",
        downloading: "A transferir...",

        // Navigation
        nav_home: "Início & Notícias",
        nav_cloud: "Servidores Cloud Pelican",
        nav_instances: "Perfis & Modpacks Locais",
        nav_mods: "Loja de Mods & Shaders",
        nav_settings: "Definições & Whitelist",
        nav_add_instance: "Novo Perfil Local",

        // Home
        hero_tag_cloud: "OFICIAL RXCORP • SERVIDOR CLOUD",
        hero_tag_local: "PERFIL LOCAL • MINECRAFT",
        hero_title_cloud: "RXCORP CLOUD & SOBREVIVÊNCIA",
        hero_desc_cloud: "Infraestrutura Cloud Pelican oficial com sincronização automática da whitelist.",
        hero_title_local: "GESTOR LOCAL",
        hero_desc_local: "Perfis e modpacks locais de Minecraft (Fabric, Forge, NeoForge, Vanilla).",
        play_btn: "JOGAR",
        play_btn_local: "LANÇAR",
        sync_mods_btn: "Sincronizar Mods",
        create_profile_btn: "+ Novo Perfil",

        // News
        news_section_title: "NOTÍCIAS & EVENTOS",
        news_view_all: "Site Web ↗",
        news_1_tag: "ATZ. SERVIDOR",
        news_1_date: "14 Setembro 2026",
        news_1_title: "Abertura da Temporada Sobrevivência 1.21.4",
        news_1_desc: "Explora novas zonas e aproveita a sincronização automática da whitelist.",
        news_2_tag: "OTIMIZAÇÃO",
        news_2_date: "12 Setembro 2026",
        news_2_title: "Pack de Shaders & Sodium",
        news_2_desc: "Mais de 140 FPS garantidos com a nossa seleção de mods de desempenho.",
        news_3_tag: "COMUNIDADE",
        news_3_date: "10 Setembro 2026",
        news_3_title: "Junta-te ao Discord Oficial",
        news_3_desc: "Eventos semanais, torneios e suporte técnico em direto.",

        // First Launch Modal
        welcome_title: "Bem-vindo ao RXCORP Launcher",
        welcome_sub: "Escolhe o teu método de autenticação para começar:",
        login_microsoft_btn: "Entrar com Microsoft",
        login_microsoft_sub: "Abre o teu browser para login seguro com 1 clique",
        login_pelican_web_btn: "Vincular conta do Painel RXCORP",
        login_pelican_web_sub: "Abre o navegador para sincronizar servidores Cloud",
        login_offline_title: "Modo Offline (Nome livre)",
        login_offline_placeholder: "Introduz o teu nome (ex: Salem, Steve...)",
        login_offline_btn: "Jogar em Modo Offline",
        login_terms: "Não afiliado com Mojang, AB. Todos os direitos reservados.",

        // Cloud
        cloud_title: "Servidores Cloud Pelican",
        cloud_subtitle: "Servidores oficiais RXCORP • Whitelist automática e ligação 1-clique",
        cloud_refresh: "Atualizar",
        sync_detected: "Conta Detetada",
        sync_btn: "Sincronizar Whitelist",
        sync_active: "Whitelist Sincronizada",
        srv_online: "Online",
        srv_offline: "Offline",
        srv_connect: "Entrar",

        // Instances
        instances_title: "Os Meus Perfis & Modpacks",
        instances_subtitle: "Gere as tuas instalações de Minecraft (Fabric, Forge, NeoForge, Vanilla)",
        new_instance_btn: "Novo Perfil",
        launch_instance: "Lançar",

        // Mods
        mods_title: "Loja de Mods & Shaders",
        mods_subtitle: "Pesquisa e instala mods do Modrinth e CurseForge",
        mods_search_placeholder: "Pesquisar mods, shaders (Sodium, Iris, Create...)",
        mods_search_btn: "Pesquisar",
        install_btn: "Instalar",

        // Settings
        settings_title: "Configuração do Sistema",
        settings_subtitle: "Contas, sincronização Pelican, whitelist e RAM",
        save_settings_btn: "Guardar Definições",
        account_section: "Conta Minecraft & Autenticação",
        ram_section: "Alocação de Memória RAM",
        java_section: "Java & APIs",
        pelican_section: "Painel Pelican & Sincronização",
        language_section: "Idioma do Launcher",
        skin_ready: "Pronto para Minecraft 1.21.4"
    }
};

class I18nManager {
    constructor() {
        this.currentLang = store.get('launcher_lang') || 'fr';
    }

    getLang() {
        return this.currentLang;
    }

    setLang(lang) {
        if (!translations[lang]) lang = 'fr';
        this.currentLang = lang;
        store.set('launcher_lang', lang);
        this.applyTranslations();
    }

    t(key) {
        const langDict = translations[this.currentLang] || translations.fr;
        return langDict[key] || translations.fr[key] || key;
    }

    applyTranslations() {
        // Elements with data-i18n
        document.querySelectorAll('[data-i18n]').forEach(elem => {
            const key = elem.dataset.i18n;
            const text = this.t(key);
            if (text) {
                elem.innerText = text;
            }
        });

        // Elements with data-i18n-placeholder
        document.querySelectorAll('[data-i18n-placeholder]').forEach(elem => {
            const key = elem.dataset.i18nPlaceholder;
            const text = this.t(key);
            if (text) {
                elem.setAttribute('placeholder', text);
            }
        });

        // Elements with data-i18n-title
        document.querySelectorAll('[data-i18n-title]').forEach(elem => {
            const key = elem.dataset.i18nTitle;
            const text = this.t(key);
            if (text) {
                elem.setAttribute('title', text);
            }
        });

        // Update active language button state
        document.querySelectorAll('.lang-btn-switch').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.lang === this.currentLang);
        });

        const langBadge = document.getElementById('titlebar-lang-text');
        if (langBadge) {
            langBadge.innerText = this.currentLang.toUpperCase();
        }
    }
}

const i18n = new I18nManager();
module.exports = i18n;
