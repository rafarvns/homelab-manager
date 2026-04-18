import { ElectronAPI } from '@electron-toolkit/preload'

export interface ServerInput {
  name: string;
  host: string;
  port: number;
  username: string;
  auth_type: 'password' | 'key';
  password?: string;
  private_key_path?: string;
  passphrase?: string;
  group_name?: string;
  tags?: string;
  notes?: string;
}

export interface Server extends ServerInput {
  id: number;
  created_at: string;
  updated_at: string;
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      serverList: () => Promise<Server[]>;
      serverCreate: (serverInput: ServerInput) => Promise<Server>;
      serverUpdate: (id: number, serverInput: ServerInput) => Promise<Server>;
      serverDelete: (id: number) => Promise<void>;
      dialogOpenFile: () => Promise<string | null>;
      sshConnect: (serverId: number, sessionId: string) => Promise<{success: boolean, sessionId: string}>;
      sshInput: (sessionId: string, data: string) => void;
      sshResize: (sessionId: string, cols: number, rows: number) => void;
      sshDisconnect: (sessionId: string) => void;
      onSshData: (sessionId: string, callback: (data: string) => void) => void;
      onSshStatus: (sessionId: string, callback: (status: string) => void) => void;
      removeSshListeners: (sessionId: string) => void;
    }
  }
}
