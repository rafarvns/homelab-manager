import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'

import { connectToServer, writeToStream, resizeStream, disconnectSession } from './ssh/ssh-manager'
import { getAllServers, createServer, updateServer, deleteServer } from './handlers/server.handlers'
import { initDb } from './db/database'
import {
  initContextGraph,
  aiIndexProject,
  aiRetrieveContext,
  aiAddInteraction,
  aiGetStats,
} from './ai/index'

function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

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

  // Initialize Context Graph (must run after DB)
  initContextGraph();

  ipcMain.handle('server:list', () => getAllServers());
  ipcMain.handle('server:create', (_, serverInput) => createServer(serverInput));
  ipcMain.handle('server:update', (_, id, serverInput) => updateServer(id, serverInput));
  ipcMain.handle('server:delete', (_, id) => deleteServer(id));
  
  ipcMain.handle('dialog:openFile', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ['openFile']
    });
    if (canceled) {
      return null;
    } else {
      return filePaths[0];
    }
  });
  
  ipcMain.handle('ssh:connect', async (event, serverId, sessionId) => {
    return await connectToServer(serverId, sessionId, event.sender);
  });
  ipcMain.on('ssh:input', (_, sessionId, data) => writeToStream(sessionId, data));
  ipcMain.on('ssh:resize', (_, sessionId, cols, rows) => resizeStream(sessionId, cols, rows));
  ipcMain.on('ssh:disconnect', (_, sessionId) => disconnectSession(sessionId));

  // Context Graph IPC
  ipcMain.handle('ai:index-project', async () => aiIndexProject());
  ipcMain.handle('ai:retrieve-context', async (_, request) => aiRetrieveContext(request));
  ipcMain.handle('ai:add-interaction', async (_, content: string) => aiAddInteraction(content));
  ipcMain.handle('ai:get-stats', () => aiGetStats());


  createWindow()

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
