const { app, BrowserWindow, Menu, Tray, nativeImage } = require('electron');

let mainWindow = null;
let tray = null;

const SYNCCORD_APP_URL = process.env.SYNCCORD_URL || process.env.DISCORD_URL || 'http://localhost:3000';

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    minWidth: 940,
    minHeight: 500,
    backgroundColor: '#1e1f22',
    title: 'SyncCord',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
    show: false,
  });

  // Load the running SyncCord Web App
  mainWindow.loadURL(SYNCCORD_APP_URL).catch(() => {
    // If backend isn't up yet, show a clean connection retry screen
    mainWindow.loadURL(`data:text/html,
      <html>
        <body style="background:#1e1f22;color:#dbdee1;font-family:sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;margin:0;">
          <h2 style="color:#5865f2;">Conectando ao SyncCord...</h2>
          <p>Certifique-se de que o backend está rodando em <code>${SYNCCORD_APP_URL}</code></p>
          <button onclick="window.location.href='${SYNCCORD_APP_URL}'" style="background:#5865f2;color:white;border:none;padding:10px 20px;border-radius:4px;cursor:pointer;font-size:14px;font-weight:bold;">
            Tentar Novamente
          </button>
        </body>
      </html>
    `);
  });

  // When ready, show window smoothly
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Prevent app from quitting when window is closed (minimize to tray like real SyncCord)
  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  createTray();
}

function createTray() {
  if (tray) return;

  // Use a fallback colored square icon if no ico is present
  const icon = nativeImage.createFromBuffer(
    Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAP0lEQVQ4T2NkoBAwUqifYdQADg4O/2GKPXv2DA6jEQ0YGBj+/fv3HwQ/fvwYxYpRAWyEwWg0oCEkGA2kYDAA9LgTETl1/c0AAAAASUVORK5CYII=',
      'base64'
    )
  );

  tray = new Tray(icon);
  tray.setToolTip('SyncCord');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Abrir SyncCord',
      click: () => {
        mainWindow.show();
      },
    },
    { type: 'separator' },
    {
      label: 'Desativar Microfone',
      type: 'checkbox',
      checked: false,
    },
    {
      label: 'Desativar Áudio',
      type: 'checkbox',
      checked: false,
    },
    { type: 'separator' },
    {
      label: 'Sair do SyncCord',
      click: () => {
        app.isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);
  tray.on('double-click', () => {
    mainWindow.show();
  });
}

// Single instance lock (like real Discord)
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });

  app.whenReady().then(createWindow);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
}
