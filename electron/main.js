const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const { createBridgeServer } = require('./server');
const {
  initializeDatabase,
  listContacts,
  getContact,
  createContact,
  updateContact,
  upsertContact,
  getFilterOptions,
  searchContacts
} = require('./store');

let mainWindow;
let bridgeServer;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 900,
    minWidth: 1100,
    minHeight: 720,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (devServerUrl) {
    mainWindow.loadURL(devServerUrl);
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }
}

app.whenReady().then(async () => {
  await initializeDatabase(app.getPath('userData'));
  bridgeServer = createBridgeServer({
    listContacts,
    getContact,
    createContact,
    updateContact,
    upsertContact,
    getFilterOptions,
    searchContacts
  });
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  if (bridgeServer) {
    bridgeServer.close();
  }
});

ipcMain.handle('contacts:list', (_, filters) => listContacts(filters));
ipcMain.handle('contacts:get', (_, id) => getContact(id));
ipcMain.handle('contacts:create', (_, payload) => createContact(payload));
ipcMain.handle('contacts:update', (_, id, payload) => updateContact(id, payload));
ipcMain.handle('contacts:upsert', (_, payload) => upsertContact(payload));
ipcMain.handle('contacts:filters', () => getFilterOptions());
ipcMain.handle('contacts:search', (_, query) => searchContacts(query));
ipcMain.handle('shell:openExternal', (_, url) => shell.openExternal(url));
