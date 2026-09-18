/**
 * @author Luuxis
 * Luuxis License v1.0 (voir fichier LICENSE pour les détails en FR/EN)
 */

const { app, BrowserWindow, Menu } = require("electron");
const path = require("path");
const os = require("os");
let dev = process.env.DEV_TOOL === 'open';
let mainWindow = undefined;

function getWindow() {
    return mainWindow;
}

function destroyWindow() {
    if (!mainWindow) return;
    app.quit();
    mainWindow = undefined;
}

function createWindow() {
    destroyWindow();
    mainWindow = new BrowserWindow({
        title: "RXLauncher",
        width: 1200,
        height: 740,
        minWidth: 960,
        minHeight: 600,
        backgroundColor: "#080b11",
        resizable: true,
        icon: path.join(__dirname, `../../images/icon/icon.${os.platform() === "win32" ? "ico" : "png"}`),
        frame: false,
        show: true,
        webPreferences: {
            contextIsolation: false,
            nodeIntegration: true
        },
    });
    Menu.setApplicationMenu(null);
    mainWindow.setMenuBarVisibility(false);
    mainWindow.loadFile(path.join(__dirname, '../../../launcher.html'));
    mainWindow.once('ready-to-show', () => {
        if (mainWindow) {
            if (dev) mainWindow.webContents.openDevTools({ mode: 'detach' })
            mainWindow.show()
            mainWindow.focus()
        }
    });
}

/**
 * Creates the main window hidden initially.
 * Once ready-to-show, shows the window and calls onReady (to close splash).
 */
function createWindowHidden(onReady) {
    destroyWindow();
    mainWindow = new BrowserWindow({
        title: "RXLauncher",
        width: 1200,
        height: 740,
        minWidth: 960,
        minHeight: 600,
        backgroundColor: "#080b11",
        resizable: true,
        icon: path.join(__dirname, `../../images/icon/icon.${os.platform() === "win32" ? "ico" : "png"}`),
        frame: false,
        show: false, // Hidden until ready
        webPreferences: {
            contextIsolation: false,
            nodeIntegration: true
        },
    });
    Menu.setApplicationMenu(null);
    mainWindow.setMenuBarVisibility(false);
    mainWindow.loadFile(path.join(__dirname, '../../../launcher.html'));
    mainWindow.once('ready-to-show', () => {
        if (mainWindow) {
            if (dev) mainWindow.webContents.openDevTools({ mode: 'detach' });
            // Close splash then show main window with smooth transition
            if (typeof onReady === 'function') onReady();
            setTimeout(() => {
                if (mainWindow) {
                    mainWindow.show();
                    mainWindow.focus();
                }
            }, 150);
        }
    });
}

module.exports = {
    getWindow,
    createWindow,
    createWindowHidden,
    destroyWindow,
};