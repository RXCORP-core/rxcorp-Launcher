/**
 * RXCORP Launcher - Splash Screen Window
 * Shows an animated splash screen while the main window loads
 */

const { BrowserWindow } = require("electron");
const path = require("path");

let splashWindow = null;

function createSplash() {
    if (splashWindow) {
        try { splashWindow.close(); } catch(e) {}
        splashWindow = null;
    }

    splashWindow = new BrowserWindow({
        width: 380,
        height: 280,
        frame: false,
        transparent: false,
        resizable: false,
        alwaysOnTop: true,
        center: true,
        skipTaskbar: true,
        backgroundColor: '#08090e',
        webPreferences: {
            contextIsolation: true,
            nodeIntegration: false
        }
    });

    splashWindow.loadFile(path.join(__dirname, '../../../splash.html'));
    splashWindow.once('ready-to-show', () => {
        if (splashWindow) splashWindow.show();
    });

    splashWindow.on('closed', () => {
        splashWindow = null;
    });

    return splashWindow;
}

function closeSplash() {
    if (!splashWindow) return;
    try {
        splashWindow.close();
    } catch (e) {}
    splashWindow = null;
}

function getSplash() {
    return splashWindow;
}

module.exports = { createSplash, closeSplash, getSplash };
