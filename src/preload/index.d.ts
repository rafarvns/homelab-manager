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
  icon?: string;
  group_name?: string;
  tags?: string;
  notes?: string;
}

export interface Server extends ServerInput {
  id: number;
  created_at: string;
  updated_at: string;
}

// ---------- Context Graph Types ----------

export interface ContextRequest {
  query: string;
  topK?: number;
  expandDepth?: number;
  maxTokens?: number;
}

export interface SearchResult {
  node: {
    id: string;
    type: string;
    content: string;
    filePath?: string;
  };
  score: number;
}

export interface ContextResponse {
  seedResults: SearchResult[];
  expandedNodes: Array<{ id: string; type: string; content: string; filePath?: string }>;
  prompt: string;
  tokenCount: number;
}

export interface IndexResult {
  nodesCreated: number;
  edgesCreated: number;
  filesScanned: number;
  durationMs: number;
}

export interface GraphStats {
  nodeCount: number;
  edgeCount: number;
  cacheHitCount: number;
  cacheMissCount: number;
  lastIndexedAt: string | null;
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      serverList: () => Promise<Server[]>;
      serverCreate: (serverInput: ServerInput) => Promise<Server>;
      serverUpdate: (id: number, serverInput: ServerInput) => Promise<Server>;
      serverDelete: (id: number) => Promise<void>;
      serverUpdateOrder: (ids: number[]) => Promise<{ success: boolean }>;
      dialogOpenFile: () => Promise<string | null>;
      sshConnect: (serverId: number, sessionId: string) => Promise<{success: boolean, sessionId: string}>;
      sshInput: (sessionId: string, data: string) => void;
      sshResize: (sessionId: string, cols: number, rows: number) => void;
      sshDisconnect: (sessionId: string) => void;
      onSshData: (sessionId: string, callback: (data: string) => void) => void;
      onSshStatus: (sessionId: string, callback: (status: string) => void) => void;
      removeSshListeners: (sessionId: string) => void;
      // Context Graph
      aiIndexProject: () => Promise<IndexResult>;
      aiRetrieveContext: (request: ContextRequest) => Promise<ContextResponse>;
      aiAddInteraction: (content: string) => Promise<void>;
      aiGetStats: () => Promise<GraphStats>;

      // General Settings
      settingsGet: <T = any>(key: string) => Promise<T | null>;
      settingsSet: (key: string, value: any) => Promise<{ success: boolean }>;
      settingsGetAll: () => Promise<Record<string, any>>;

      // Sync
      syncTestConnection: (config: any) => Promise<{ success: boolean; message: string }>;
      syncPush: (config: any, passphrase: string) => Promise<{ success: boolean; message: string }>;
      syncPull: (config: any, passphrase: string) => Promise<{ success: boolean; message: string }>;
    }
  }
}
