import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'

import { connectToServer, writeToStream, resizeStream, disconnectSession } from './ssh/ssh-manager'
import { getSystemInfo } from './ssh/sysinfo-manager'
import { listDirectory, readFile, writeFile, downloadFile, createDirectory, deleteItem, uploadFile, createFile } from './ssh/sftp-manager'
import { getAllServers, createServer, updateServer, deleteServer, updateServersOrder } from './handlers/server.handlers'
import { initDb, getDb } from './db/database'
import { registerSettingsHandlers } from './handlers/settings.handlers'
import { registerSyncHandlers } from './handlers/sync.handlers'
import { listServices, controlService, getServiceLogs } from './ssh/services-manager'
import { listDockerContainers, controlDockerContainer, getDockerLogs } from './ssh/docker-manager'
import { setDockerAlias } from './handlers/docker.handlers'
import { getFirewallStatus, controlFirewall } from './ssh/firewall-manager'

function getWindowState() {
  try {
    const db = getDb()
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get('window_state') as
      | { value: string }
      | undefined
    return row ? JSON.parse(row.value) : null
  } catch (e) {
    return null
  }
}

function saveWindowState(window: BrowserWindow) {
  try {
    const isMaximized = window.isMaximized()
    const bounds = isMaximized ? window.getNormalBounds() : window.getBounds()
    const state = { ...bounds, isMaximized }
    const db = getDb()
    db.prepare(
      'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP'
    ).run('window_state', JSON.stringify(state))
  } catch (e) {
    console.error('Failed to save window state', e)
  }
}

function createWindow(): void {
  const savedState = getWindowState()

  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: savedState?.width || 1200,
    height: savedState?.height || 800,
    x: savedState?.x,
    y: savedState?.y,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  if (savedState?.isMaximized) {
    mainWindow.maximize()
  }

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  // Persistence listeners
  let saveTimeout: NodeJS.Timeout
  const handleSave = () => {
    clearTimeout(saveTimeout)
    saveTimeout = setTimeout(() => saveWindowState(mainWindow), 500)
  }

  mainWindow.on('resize', handleSave)
  mainWindow.on('move', handleSave)
  mainWindow.on('close', () => saveWindowState(mainWindow))

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}


// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // Initialize Database
  initDb();
  registerSettingsHandlers();
  registerSyncHandlers();

  ipcMain.handle('server:list', () => getAllServers());
  ipcMain.handle('server:create', (_, serverInput) => createServer(serverInput));
  ipcMain.handle('server:update', (_, id, serverInput) => updateServer(id, serverInput));
  ipcMain.handle('server:delete', (_, id) => deleteServer(id));
  ipcMain.handle('server:update-order', (_, ids) => updateServersOrder(ids));
  ipcMain.handle('dialog:openFile', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ['openFile']
    });
    if (canceled) return null;
    return filePaths[0];
  });

  ipcMain.handle('dialog:openFiles', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ['openFile', 'multiSelections']
    });
    if (canceled) {
      return null;
    } else {
      return filePaths;
    }
  });
  
  ipcMain.handle('ssh:connect', async (event, serverId, sessionId) => {
    return await connectToServer(serverId, sessionId, event.sender);
  });
  ipcMain.handle('server:sysinfo', (_, serverId) => getSystemInfo(serverId));
  ipcMain.handle('services:list', (_, serverId) => listServices(serverId));
  ipcMain.handle('services:control', (_, serverId, serviceName, action) => controlService(serverId, serviceName, action));
  ipcMain.handle('services:logs', (_, serverId, serviceName, lines) => getServiceLogs(serverId, serviceName, lines));
  
  ipcMain.handle('docker:list', (_, serverId) => listDockerContainers(serverId));
  ipcMain.handle('docker:control', (_, serverId, containerId, action) => controlDockerContainer(serverId, containerId, action));
  ipcMain.handle('docker:logs', (_, serverId, containerId, lines) => getDockerLogs(serverId, containerId, lines));
  ipcMain.handle('docker:set-alias', (_, serverId, containerId, alias) => setDockerAlias(serverId, containerId, alias));
  
  ipcMain.handle('firewall:status', (_, serverId) => getFirewallStatus(serverId));
  ipcMain.handle('firewall:control', (_, serverId, action, params) => controlFirewall(serverId, action, params));

  ipcMain.on('ssh:input', (_, sessionId, data) => writeToStream(sessionId, data));
  ipcMain.on('ssh:resize', (_, sessionId, cols, rows) => resizeStream(sessionId, cols, rows));
  ipcMain.on('ssh:disconnect', (_, sessionId) => disconnectSession(sessionId));

  // SFTP Handlers
  ipcMain.handle('sftp:list', (_, serverId, path) => listDirectory(serverId, path));
  ipcMain.handle('sftp:read', (_, serverId, path) => readFile(serverId, path));
  ipcMain.handle('sftp:write', (_, serverId, path, content) => writeFile(serverId, path, content));
  ipcMain.handle('sftp:download', (_, serverId, path, fileName) => downloadFile(serverId, path, fileName));
  ipcMain.handle('sftp:mkdir', (_, serverId, path) => createDirectory(serverId, path));
  ipcMain.handle('sftp:delete', (_, serverId, path, isDir) => deleteItem(serverId, path, isDir));
  ipcMain.handle('sftp:upload', (_, serverId, localPath, remotePath) => uploadFile(serverId, localPath, remotePath));
  ipcMain.handle('sftp:touch', (_, serverId, path) => createFile(serverId, path));

  ipcMain.on('shell:openExternal', (_, url) => shell.openExternal(url));

  createWindow()

  // ── Dev-only: Context Graph (AI tooling) ──────────────────────────
  // Dynamic import keeps the entire ai/ module OUT of the production
  // bundle. electron-vite / Rollup will NOT include it in build:win.
  if (is.dev) {
    import('./ai/index').then(ai => {
      ai.initContextGraph()

      // Register IPC handlers
      ipcMain.handle('ai:index-project', () => ai.aiIndexProject())
      ipcMain.handle('ai:retrieve-context', (_, req) => ai.aiRetrieveContext(req))
      ipcMain.handle('ai:add-interaction', (_, content: string) => ai.aiAddInteraction(content))
      ipcMain.handle('ai:get-stats', () => ai.aiGetStats())

      // Auto-index on boot
      ai.aiIndexProject()
        .then(r => console.log(
          `[ContextGraph] Auto-index done: ${r.nodesCreated} nodes, ` +
          `${r.edgesCreated} edges, ${r.filesScanned} files (${r.durationMs}ms)`
        ))
        .catch(err => console.error('[ContextGraph] Auto-index failed:', err))
    }).catch(err => console.error('[ContextGraph] Failed to load AI module:', err))
  }

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
