/**
 * RXCORP Launcher - Developer Terminal Window
 * Independent floating window for live real-time debugging & engine logs
 */

const { BrowserWindow, Menu } = require("electron");
const path = require("path");
const os = require("os");

let terminalWindow = null;
const logHistory = [];
const MAX_LOG_HISTORY = 5000;

function getWindow() {
    return terminalWindow;
}

function broadcastLog(logEntry) {
    if (!logEntry) return;

    if (logHistory.length >= MAX_LOG_HISTORY) {
        logHistory.shift();
    }
    logHistory.push(logEntry);

    if (terminalWindow && !terminalWindow.isDestroyed() && terminalWindow.webContents) {
        try {
            terminalWindow.webContents.send('terminal-log-entry', logEntry);
        } catch (_) {}
    }
}

function openTerminal() {
    if (terminalWindow && !terminalWindow.isDestroyed()) {
        if (terminalWindow.isMinimized()) terminalWindow.restore();
        terminalWindow.show();
        terminalWindow.focus();
        return terminalWindow;
    }

    terminalWindow = new BrowserWindow({
        title: "RXLauncher Dev Console // Live Engine Terminal",
        width: 900,
        height: 600,
        minWidth: 680,
        minHeight: 420,
        backgroundColor: "#06090e",
        resizable: true,
        icon: path.join(__dirname, `../../images/icon/icon.${os.platform() === "win32" ? "ico" : "png"}`),
        frame: false,
        alwaysOnTop: false,
        webPreferences: {
            contextIsolation: false,
            nodeIntegration: true
        }
    });

    Menu.setApplicationMenu(null);
    terminalWindow.setMenuBarVisibility(false);
    terminalWindow.loadFile(path.join(__dirname, '../../../terminal.html'));

    terminalWindow.once('ready-to-show', () => {
        if (terminalWindow && !terminalWindow.isDestroyed()) {
            terminalWindow.show();
            terminalWindow.focus();
        }
    });

    terminalWindow.on('closed', () => {
        terminalWindow = null;
    });

    return terminalWindow;
}

function toggleTerminal() {
    if (terminalWindow && !terminalWindow.isDestroyed()) {
        if (terminalWindow.isVisible()) {
            terminalWindow.hide();
        } else {
            terminalWindow.show();
            terminalWindow.focus();
        }
    } else {
        openTerminal();
    }
}

function closeTerminal() {
    if (terminalWindow && !terminalWindow.isDestroyed()) {
        terminalWindow.close();
        terminalWindow = null;
    }
}

function getLogHistory() {
    return logHistory;
}

function clearLogHistory() {
    logHistory.length = 0;
    if (terminalWindow && !terminalWindow.isDestroyed() && terminalWindow.webContents) {
        try {
            terminalWindow.webContents.send('terminal-clear-entries');
        } catch (_) {}
    }
}

function setAlwaysOnTop(flag) {
    if (terminalWindow && !terminalWindow.isDestroyed()) {
        terminalWindow.setAlwaysOnTop(!!flag);
    }
}

module.exports = {
    getWindow,
    openTerminal,
    toggleTerminal,
    closeTerminal,
    broadcastLog,
    getLogHistory,
    clearLogHistory,
    setAlwaysOnTop
};
