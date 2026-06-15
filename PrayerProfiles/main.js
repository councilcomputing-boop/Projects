const { app, BrowserWindow, shell } = require('electron');
const path   = require('path');
const fs     = require('fs');
const crypto = require('crypto');
const http   = require('http');

// Mark as Electron context so server skips web-only restrictions
process.env.ELECTRON_APP = '1';

// Resolve user data path and set DATA_DIR before requiring server
const userData = app.getPath('userData');
process.env.DATA_DIR = userData;

// Generate and persist a unique JWT secret per installation
const secretFile = path.join(userData, '.jwt-secret');
if (!fs.existsSync(secretFile)) {
  fs.mkdirSync(userData, { recursive: true });
  fs.writeFileSync(secretFile, crypto.randomBytes(48).toString('hex'), { encoding: 'utf8', mode: 0o600 });
}
process.env.JWT_SECRET = fs.readFileSync(secretFile, 'utf8').trim();

// Start Express server in-process
require('./server');

// Poll until the server is accepting requests
function waitForServer(port, retries = 30) {
  return new Promise((resolve, reject) => {
    const attempt = (n) => {
      const req = http.get(`http://127.0.0.1:${port}/api/profiles`, () => resolve());
      req.on('error', () => {
        if (n <= 0) return reject(new Error('Server did not start'));
        setTimeout(() => attempt(n - 1), 300);
      });
      req.end();
    };
    setTimeout(() => attempt(retries), 200);
  });
}

let win;

function createWindow() {
  win = new BrowserWindow({
    width: 1360,
    height: 840,
    minWidth: 820,
    minHeight: 600,
    title: 'Prayer Profiles',
    backgroundColor: '#0D0E1F',
    webPreferences: {
      nodeIntegration:  false,
      contextIsolation: true,
      sandbox:          true,
    },
  });

  win.setMenuBarVisibility(false);
  win.loadURL('http://127.0.0.1:3001');

  // Open external links in the user's default browser
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

app.whenReady().then(async () => {
  try {
    await waitForServer(3001);
    createWindow();
  } catch {
    const { dialog } = require('electron');
    dialog.showErrorBox('Startup Error', 'Could not start the internal server. Please try again.');
    app.quit();
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => app.quit());
