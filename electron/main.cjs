// Electron main process — runs the local EliteAchievements server in-process
// and shows it in a native window. Reuses the exact same server + web UI.
const { app, BrowserWindow, shell, Menu } = require('electron');
const path = require('node:path');
const http = require('node:http');
const { pathToFileURL } = require('node:url');

const PORT = 8787;
process.env.ED_COMPANION_PORT = String(PORT);

app.disableHardwareAcceleration(); // safer across varied GPUs / remote sessions

let win;

function createWindow() {
  win = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: '#07080a',
    title: 'EliteAchievements',
    icon: path.join(__dirname, 'icon.png'),
    autoHideMenuBar: true,
    show: false,
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  });
  Menu.setApplicationMenu(null);
  win.once('ready-to-show', () => win.show());
  win.loadFile(path.join(__dirname, 'loading.html'));

  // Open external links (e.g. inara, wiki) in the system browser, not the app.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http')) shell.openExternal(url);
    return { action: 'deny' };
  });
}

function waitForServer(port, timeoutMs = 40000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tryOnce = () => {
      const req = http.get({ host: '127.0.0.1', port, path: '/api/state' }, (res) => {
        res.resume();
        resolve();
      });
      req.on('error', () => {
        if (Date.now() - start > timeoutMs) reject(new Error('server did not start in time'));
        else setTimeout(tryOnce, 300);
      });
    };
    tryOnce();
  });
}

// Single-instance: focus the existing window instead of launching a second server.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (win) { if (win.isMinimized()) win.restore(); win.focus(); }
  });

  app.whenReady().then(async () => {
    process.env.ED_COMPANION_USER_DIR = app.getPath('userData'); // writable saves location
    createWindow();

    // Make sure the splash is painted before the (blocking) journal index runs.
    await new Promise((r) => win.webContents.once('did-finish-load', () => r()));

    try {
      await import(pathToFileURL(path.join(__dirname, '..', 'src', 'server', 'server.js')).href);
      await waitForServer(PORT);
      if (win) win.loadURL(`http://localhost:${PORT}`);
    } catch (err) {
      console.error('[ed] failed to start embedded server:', err);
      if (win) {
        win.loadURL('data:text/html,' + encodeURIComponent(
          `<body style="background:#07080a;color:#ff5a3c;font-family:sans-serif;padding:40px">`
          + `<h2>Couldn't start EliteAchievements</h2><pre>${String(err && err.message || err)}</pre></body>`));
      }
    }

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('window-all-closed', () => app.quit());
}
