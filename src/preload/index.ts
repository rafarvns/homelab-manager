import { contextBridge } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

import { ipcRenderer } from 'electron'

// Custom APIs for renderer
const api = {
  serverList: () => ipcRenderer.invoke('server:list'),
  serverCreate: (serverInput: any) => ipcRenderer.invoke('server:create', serverInput),
  serverUpdate: (id: number, serverInput: any) => ipcRenderer.invoke('server:update', id, serverInput),
  serverDelete: (id: number) => ipcRenderer.invoke('server:delete', id),
  serverUpdateOrder: (ids: number[]) => ipcRenderer.invoke('server:update-order', ids),
  dialogOpenFile: () => ipcRenderer.invoke('dialog:openFile'),
  dialogOpenFiles: () => ipcRenderer.invoke('dialog:openFiles'),
  serverSysInfo: (serverId: number) => ipcRenderer.invoke('server:sysinfo', serverId),
  servicesList: (serverId: number) => ipcRenderer.invoke('services:list', serverId),
  servicesControl: (serverId: number, name: string, action: string) => ipcRenderer.invoke('services:control', serverId, name, action),
  servicesLogs: (serverId: number, name: string, lines?: number) => ipcRenderer.invoke('services:logs', serverId, name, lines),
  dockerList: (serverId: number) => ipcRenderer.invoke('docker:list', serverId),
  dockerControl: (serverId: number, containerId: string, action: string) => ipcRenderer.invoke('docker:control', serverId, containerId, action),
  dockerLogs: (serverId: number, containerId: string, lines?: number) => ipcRenderer.invoke('docker:logs', serverId, containerId, lines),
  sshConnect: (serverId: number, sessionId: string) => ipcRenderer.invoke('ssh:connect', serverId, sessionId),
  sshInput: (sessionId: string, data: string) => ipcRenderer.send('ssh:input', sessionId, data),
  sshResize: (sessionId: string, cols: number, rows: number) => ipcRenderer.send('ssh:resize', sessionId, cols, rows),
  sshDisconnect: (sessionId: string) => ipcRenderer.send('ssh:disconnect', sessionId),
  onSshData: (sessionId: string, callback: (data: string) => void) => {
    ipcRenderer.on(`ssh:data:${sessionId}`, (_, data) => callback(data));
  },
  onSshStatus: (sessionId: string, callback: (status: string) => void) => {
    ipcRenderer.on(`ssh:status:${sessionId}`, (_, status) => callback(status));
  },
  removeSshListeners: (sessionId: string) => {
    ipcRenderer.removeAllListeners(`ssh:data:${sessionId}`);
    ipcRenderer.removeAllListeners(`ssh:status:${sessionId}`);
  },
  sftpList: (serverId: number, path: string) => ipcRenderer.invoke('sftp:list', serverId, path),
  sftpRead: (serverId: number, path: string) => ipcRenderer.invoke('sftp:read', serverId, path),
  sftpWrite: (serverId: number, path: string, content: string) => ipcRenderer.invoke('sftp:write', serverId, path, content),
  sftpDownload: (serverId: number, path: string, fileName: string) => ipcRenderer.invoke('sftp:download', serverId, path, fileName),
  sftpMkdir: (serverId: number, path: string) => ipcRenderer.invoke('sftp:mkdir', serverId, path),
  sftpDelete: (serverId: number, path: string, isDir: boolean) => ipcRenderer.invoke('sftp:delete', serverId, path, isDir),
  sftpUpload: (serverId: number, localPath: string, remotePath: string) => ipcRenderer.invoke('sftp:upload', serverId, localPath, remotePath),
  sftpTouch: (serverId: number, path: string) => ipcRenderer.invoke('sftp:touch', serverId, path),
  // Context Graph
  aiIndexProject: () => ipcRenderer.invoke('ai:index-project'),
  aiRetrieveContext: (request: unknown) => ipcRenderer.invoke('ai:retrieve-context', request),
  aiAddInteraction: (content: string) => ipcRenderer.invoke('ai:add-interaction', content),
  aiGetStats: () => ipcRenderer.invoke('ai:get-stats'),
  // General Settings
  settingsGet: (key: string) => ipcRenderer.invoke('settings:get', key),
  settingsSet: (key: string, value: any) => ipcRenderer.invoke('settings:set', key, value),
  settingsGetAll: () => ipcRenderer.invoke('settings:getAll'),
  // Sync
  syncTestConnection: (config: any) => ipcRenderer.invoke('sync:test-connection', config),
  syncPush: (config: any, passphrase: string) => ipcRenderer.invoke('sync:push', config, passphrase),
  syncPull: (config: any, passphrase: string) => ipcRenderer.invoke('sync:pull', config, passphrase),
  syncConnectGDrive: () => ipcRenderer.invoke('sync:connect-gdrive'),
  syncGetGDriveAccount: () => ipcRenderer.invoke('sync:get-gdrive-account'),
  syncSetSecurePassphrase: (passphrase: string | null) => ipcRenderer.invoke('sync:set-secure-passphrase', passphrase),
  syncGetLocalStats: () => ipcRenderer.invoke('sync:get-local-stats'),
  onSyncDataUpdated: (callback: () => void) => {
    ipcRenderer.on('sync:data-updated', () => callback());
  },
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
