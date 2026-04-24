import { ipcMain, BrowserWindow } from 'electron'
import { autoUpdater } from 'electron-updater'
import { is } from '@electron-toolkit/utils'

export function registerUpdaterHandlers(mainWindow: BrowserWindow): void {
  if (is.dev) return

  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('update-available', (info) => {
    mainWindow.webContents.send('update:available', { version: info.version })
  })

  autoUpdater.on('download-progress', (progress) => {
    mainWindow.webContents.send('update:progress', {
      percent: Math.round(progress.percent),
      transferred: progress.transferred,
      total: progress.total,
    })
  })

  autoUpdater.on('update-downloaded', (info) => {
    mainWindow.webContents.send('update:downloaded', { version: info.version })
  })

  autoUpdater.on('error', (err) => {
    mainWindow.webContents.send('update:error', err.message)
  })

  ipcMain.handle('update:check', () => autoUpdater.checkForUpdates())
  ipcMain.on('update:download', () => autoUpdater.downloadUpdate())
  ipcMain.on('update:install', () => autoUpdater.quitAndInstall(false, true))
}

export function startUpdateCheck(): void {
  if (is.dev) return
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch((err) => {
      console.error('[Updater] Check failed:', err.message)
    })
  }, 5000)
}
