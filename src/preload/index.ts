import { contextBridge } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

import { ipcRenderer } from 'electron'

// Custom APIs for renderer
const api = {
  serverList: () => ipcRenderer.invoke('server:list'),
  serverCreate: (serverInput: any) => ipcRenderer.invoke('server:create', serverInput),
  serverUpdate: (id: number, serverInput: any) => ipcRenderer.invoke('server:update', id, serverInput),
  serverDelete: (id: number) => ipcRenderer.invoke('server:delete', id),
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
