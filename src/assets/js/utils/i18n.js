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
        config_btn: "⚙️ Configuration",
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
        sync_mods_btn: "⚡ Synchroniser les Mods",
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
        config_btn: "⚙️ Settings",
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
        sync_mods_btn: "⚡ Sync Server Mods",
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
