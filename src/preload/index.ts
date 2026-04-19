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
