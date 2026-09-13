/**
 * @author Luuxis
 * Luuxis License v1.0 (voir fichier LICENSE pour les détails en FR/EN)
 */

const { app, ipcMain, nativeTheme, Notification } = require('electron');
const { Microsoft } = require('minecraft-java-core');
const { autoUpdater } = require('electron-updater');

try {
    app.setAppUserModelId("RXCORP.Launcher");
} catch (e) {}

const path = require('path');
const fs = require('fs');
const Store = require('electron-store');

const UpdateWindow = require("./assets/js/windows/updateWindow.js");
const MainWindow = require("./assets/js/windows/mainWindow.js");
const discordRpc = require("./assets/js/utils/discordRpc.js");
const trayManager = require("./assets/js/windows/trayManager.js");

let dev = process.env.NODE_ENV === 'dev' || !app.isPackaged;

if (dev) {
    let appPath = path.resolve('./data/Launcher').replace(/\\/g, '/');
    let appdata = path.resolve('./data').replace(/\\/g, '/');
    if (!fs.existsSync(appPath)) fs.mkdirSync(appPath, { recursive: true });
    if (!fs.existsSync(appdata)) fs.mkdirSync(appdata, { recursive: true });
    app.setPath('userData', appPath);
    app.setPath('appData', appdata)
}

Store.initRenderer();

if (!app.requestSingleInstanceLock()) app.quit();
else {
    app.on('second-instance', () => {
        let win = MainWindow.getWindow() || UpdateWindow.getWindow();
        if (win) {
            if (win.isMinimized()) win.restore();
            win.show();
            win.focus();
        }
    });

    app.whenReady().then(() => {
        try {
            discordRpc.init();
        } catch (e) {
            console.error('[Discord RPC] Init error:', e);
        }
        try {
            trayManager.createTray(() => MainWindow.getWindow());
        } catch (e) {
            console.error('[Tray] Init error:', e);
        }
        MainWindow.createWindow();
        setTimeout(checkLauncherUpdates, 3000);
        setInterval(checkLauncherUpdates, 15 * 60 * 1000);
    });
}

ipcMain.on('main-window-open', () => MainWindow.createWindow())
ipcMain.on('main-window-dev-tools', () => MainWindow.getWindow().webContents.openDevTools({ mode: 'detach' }))
ipcMain.on('main-window-dev-tools-close', () => MainWindow.getWindow().webContents.closeDevTools())
ipcMain.on('main-window-close', () => MainWindow.destroyWindow())
ipcMain.on('main-window-reload', () => MainWindow.getWindow().reload())
ipcMain.on('main-window-progress', (event, options) => MainWindow.getWindow().setProgressBar(options.progress / options.size))
ipcMain.on('main-window-progress-reset', () => MainWindow.getWindow().setProgressBar(-1))
ipcMain.on('main-window-progress-load', () => MainWindow.getWindow().setProgressBar(2))
ipcMain.on('main-window-minimize', () => trayManager.hideWindow(true))

ipcMain.on('update-window-close', () => UpdateWindow.destroyWindow())
ipcMain.on('update-window-dev-tools', () => UpdateWindow.getWindow().webContents.openDevTools({ mode: 'detach' }))
ipcMain.on('update-window-progress', (event, options) => UpdateWindow.getWindow().setProgressBar(options.progress / options.size))
ipcMain.on('update-window-progress-reset', () => UpdateWindow.getWindow().setProgressBar(-1))
ipcMain.on('update-window-progress-load', () => UpdateWindow.getWindow().setProgressBar(2))

ipcMain.handle('path-user-data', () => app.getPath('userData'))
ipcMain.handle('appData', e => app.getPath('appData'))

ipcMain.on('main-window-maximize', () => {
    if (MainWindow.getWindow().isMaximized()) {
        MainWindow.getWindow().unmaximize();
    } else {
        MainWindow.getWindow().maximize();
    }
})

ipcMain.on('main-window-hide', () => trayManager.hideWindow(false))
ipcMain.on('main-window-show', () => trayManager.showWindow())

ipcMain.on('send-notification', (event, data) => {
    if (Notification && Notification.isSupported()) {
        try {
            const notif = new Notification({
                title: data.title || 'RXCORP Launcher',
                body: data.body || '',
                icon: path.join(__dirname, 'assets/images/icon/icon.png'),
                silent: data.silent === true
            });
            notif.on('click', () => {
                let win = MainWindow.getWindow() || UpdateWindow.getWindow();
                if (win) {
                    if (win.isMinimized()) win.restore();
                    win.show();
                    win.focus();
                }
            });
            notif.show();
        } catch (err) {
            console.error('[Notification Error]:', err);
        }
    }
});

ipcMain.on('discord-rpc-activity', (event, data) => discordRpc.setActivity(data));
ipcMain.on('discord-rpc-idle', () => discordRpc.setIdle());
ipcMain.on('discord-rpc-launching', () => discordRpc.setLaunching());
ipcMain.on('discord-rpc-playing', (event, instanceName) => discordRpc.setPlaying(instanceName));

ipcMain.handle('Microsoft-window', async (_, client_id) => {
    return await new Microsoft(client_id).getAuth();
})

ipcMain.handle('is-dark-theme', (_, theme) => {
    if (theme === 'dark') return true
    if (theme === 'light') return false
    return nativeTheme.shouldUseDarkColors;
})

app.on('window-all-closed', () => {
    try {
        discordRpc.destroy();
    } catch (e) {}
    try {
        trayManager.destroyTray();
    } catch (e) {}
    app.quit();
});

autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;
autoUpdater.setFeedURL({
    provider: 'generic',
    url: 'https://rxcorp.fr/launcher/update/'
});

function checkLauncherUpdates() {
    if (app.isPackaged) {
        autoUpdater.checkForUpdates().catch(err => {
            console.log('[AutoUpdater] Check skipped/error:', err ? err.message : '');
        });
    }
}

ipcMain.on('check-for-update', () => checkLauncherUpdates());
ipcMain.on('install-update-now', () => autoUpdater.quitAndInstall());

autoUpdater.on('checking-for-update', () => {
    const win = MainWindow.getWindow();
    if (win) win.webContents.send('updater-event', { status: 'checking' });
});

autoUpdater.on('update-available', (info) => {
    const win = MainWindow.getWindow();
    if (win) win.webContents.send('updater-event', { status: 'available', version: info ? info.version : '' });
    if (Notification && Notification.isSupported()) {
        new Notification({
            title: '⚡ RXCORP // MISE À JOUR DISPONIBLE',
            body: `La version ${info ? info.version : ''} est en cours de téléchargement silencieux...`,
            icon: path.join(__dirname, 'assets/images/icon/icon.png')
        }).show();
    }
});

autoUpdater.on('update-not-available', (info) => {
    const win = MainWindow.getWindow();
    if (win) win.webContents.send('updater-event', { status: 'not-available', version: info ? info.version : null });
});

autoUpdater.on('download-progress', (progress) => {
    const win = MainWindow.getWindow();
    if (win) win.webContents.send('updater-event', {
        status: 'downloading',
        percent: Math.round(progress.percent || 0),
        bytesPerSecond: progress.bytesPerSecond || 0
    });
});

autoUpdater.on('update-downloaded', (info) => {
    const win = MainWindow.getWindow();
    if (win) win.webContents.send('updater-event', { status: 'ready', version: info ? info.version : '' });
    if (Notification && Notification.isSupported()) {
        new Notification({
            title: '🚀 RXCORP // MISE À JOUR PRÊTE !',
            body: `La version ${info ? info.version : ''} a été installée. Cliquez pour relancer.`,
            icon: path.join(__dirname, 'assets/images/icon/icon.png')
        }).show();
    }
});

autoUpdater.on('error', (err) => {
    console.error('[AutoUpdater] Error:', err ? err.message : err);
    const win = MainWindow.getWindow();
    if (win) win.webContents.send('updater-event', { status: 'error', error: err ? err.message : 'Unknown' });
});