const { app, Tray, Menu, nativeImage, shell, Notification } = require('electron');
const path = require('path');

let tray = null;
let mainWindowGetter = null;
let hasShownBalloon = false;

function createTray(getMainWindow) {
    if (tray) return tray;
    mainWindowGetter = getMainWindow;

    const iconPath = path.join(__dirname, '../../images/icon', process.platform === 'win32' ? 'icon.ico' : 'icon.png');
    
    let icon;
    try {
        icon = nativeImage.createFromPath(iconPath);
        if (icon.isEmpty()) {
            icon = nativeImage.createFromPath(path.join(__dirname, '../../images/icon/icon.png'));
        }
    } catch (e) {
        console.error('[Tray] Icon load error:', e);
    }

    tray = new Tray(icon);
    tray.setToolTip('DeltaZone - Terminal Tactique');

    const contextMenu = Menu.buildFromTemplate([
        {
            label: '☣ DeltaZone Terminal',
            enabled: false
        },
        { type: 'separator' },
        {
            label: 'Ouvrir le Launcher',
            click: () => {
                showWindow();
            }
        },
        {
            label: 'Rejoindre le Discord',
            click: () => {
                shell.openExternal('https://discord.gg/deltazone');
            }
        },
        { type: 'separator' },
        {
            label: 'Quitter DeltaZone',
            click: () => {
                app.isQuitting = true;
                if (mainWindowGetter) {
                    const win = mainWindowGetter();
                    if (win) win.destroy();
                }
                app.quit();
            }
        }
    ]);

    tray.setContextMenu(contextMenu);

    tray.on('click', () => {
        toggleWindow();
    });

    tray.on('double-click', () => {
        showWindow();
    });

    return tray;
}

function showWindow() {
    const win = mainWindowGetter ? mainWindowGetter() : null;
    if (win) {
        if (!win.isVisible()) win.show();
        if (win.isMinimized()) win.restore();
        win.focus();
    }
}

function hideWindow(showNotif = true) {
    const win = mainWindowGetter ? mainWindowGetter() : null;
    if (win) {
        win.hide();
        if (showNotif && !hasShownBalloon && Notification && Notification.isSupported()) {
            hasShownBalloon = true;
            try {
                const notif = new Notification({
                    title: '☣ DELTAZONE RÉDUIT',
                    body: 'Le launcher reste actif en arrière-plan dans la barre des tâches (icône DeltaZone).',
                    icon: path.join(__dirname, '../../images/icon/icon.png'),
                    silent: true
                });
                notif.on('click', () => showWindow());
                notif.show();
            } catch (e) {}
        }
    }
}

function toggleWindow() {
    const win = mainWindowGetter ? mainWindowGetter() : null;
    if (win) {
        if (win.isVisible()) {
            win.hide();
        } else {
            win.show();
            win.focus();
        }
    }
}

function getTray() {
    return tray;
}

function destroyTray() {
    if (tray) {
        tray.destroy();
        tray = null;
    }
}

module.exports = {
    createTray,
    getTray,
    showWindow,
    hideWindow,
    toggleWindow,
    destroyTray
};
