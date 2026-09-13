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
        title: "RXCORP Launcher",
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

module.exports = {
    getWindow,
    createWindow,
    destroyWindow,
};