import { create } from 'zustand';
import { arrayMove } from '@dnd-kit/sortable';
export interface Server {
  id: number;
  name: string;
  host: string;
  port: number;
  username: string;
  auth_type: 'password' | 'key';
  password?: string;
  private_key_path?: string;
  passphrase?: string;
  icon?: string;
}

interface Session {
  id: string;
  serverId: number;
  type: 'terminal' | 'settings';
  status: 'connecting' | 'connected' | 'reconnecting' | 'disconnected' | 'error';
  name?: string;
}

interface AppState {
  servers: Server[];
  sessions: Session[];
  activeServerId: number | null;
  activeSessionId: string | null; // This is the globally active sessionId (what the terminal sees)
  activeSessionPerServer: Record<number, string | null>;
  isAddModalOpen: boolean;
  editingServer: Server | null;
  isSidebarCollapsed: boolean;
  isGlobalSettingsOpen: boolean;
  isSyncModalOpen: boolean;
  isAutoSyncEnabled: boolean;
  
  setServers: (servers: Server[]) => void;
  fetchServers: () => Promise<void>;
  fetchSettings: () => Promise<void>;
  fetchAutoSyncStatus: () => Promise<void>;
  
  toggleSidebar: () => void;
  toggleGlobalSettings: (open: boolean) => void;
  toggleSyncModal: (open: boolean) => void;
  setAutoSync: (enabled: boolean) => Promise<void>;
  openAddModal: () => void;
  openEditModal: (server: Server) => void;
  closeAddModal: () => void;
  
  addSession: (serverId: number) => Promise<void>;
  createNewSession: (serverId: number) => Promise<void>;
  openSettings: (serverId: number) => void;
  closeSession: (sessionId: string) => void;
  setActiveSession: (sessionId: string) => void;
  switchServerContext: (serverId: number) => void;
  updateSessionStatus: (sessionId: string, status: Session['status']) => void;
  updateSessionName: (sessionId: string, name: string) => void;
  reorderServers: (activeId: number, overId: number) => Promise<void>;
  reorderSessions: (activeId: string, overId: string) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  servers: [],
  sessions: [],
  activeServerId: null,
  activeSessionId: null,
  activeSessionPerServer: {},
  isAddModalOpen: false,
  editingServer: null,
  isSidebarCollapsed: false,
  isGlobalSettingsOpen: false,
  isSyncModalOpen: false,
  isAutoSyncEnabled: false,
  
  setServers: (servers) => set({ servers }),
  
  toggleSidebar: () => {
    const nextState = !get().isSidebarCollapsed;
    set({ isSidebarCollapsed: nextState });
    window.api.settingsSet('isSidebarCollapsed', nextState);
  },

  toggleGlobalSettings: (open) => set({ isGlobalSettingsOpen: open }),
  toggleSyncModal: (open) => set({ isSyncModalOpen: open }),
  
  setAutoSync: async (enabled) => {
    set({ isAutoSyncEnabled: enabled });
    await window.api.settingsSet('sync_auto_enabled', enabled ? 'true' : 'false');
  },

  fetchSettings: async () => {
    const isCollapsed = await window.api.settingsGet<boolean>('isSidebarCollapsed');
    if (isCollapsed !== null) {
      set({ isSidebarCollapsed: isCollapsed });
    }
  },

  fetchAutoSyncStatus: async () => {
    const autoEnabled = await window.api.settingsGet<string>('sync_auto_enabled');
    set({ isAutoSyncEnabled: autoEnabled === 'true' });
  },
  
  fetchServers: async () => {
    const servers = await window.api.serverList();
    set({ servers });
  },

  openAddModal: () => set({ isAddModalOpen: true, editingServer: null, isGlobalSettingsOpen: false }),
  openEditModal: (server) => set({ isAddModalOpen: true, editingServer: server, isGlobalSettingsOpen: false }),
  closeAddModal: () => set({ isAddModalOpen: false, editingServer: null }),

  addSession: async (serverId: number) => {
    // If double-clicking, we switch to context and check sessions
    set({ activeServerId: serverId, isGlobalSettingsOpen: false });

    const existingSessions = get().sessions.filter(s => s.serverId === serverId && s.type === 'terminal');
    if (existingSessions.length > 0) {
      // Just focus the last active session for this server
      const lastSessionId = get().activeSessionPerServer[serverId] || existingSessions[0].id;
      set({ activeSessionId: lastSessionId });
      return;
    }

    const sessionId = `session_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    set((state) => ({
      sessions: [...state.sessions, { id: sessionId, serverId, type: 'terminal', status: 'connecting' }],
      activeSessionId: sessionId,
      activeSessionPerServer: { ...state.activeSessionPerServer, [serverId]: sessionId }
    }));

    try {
      const result = await window.api.sshConnect(serverId, sessionId);
      if (result.success) {
        set((state) => ({
          sessions: state.sessions.map(s => s.id === sessionId ? { ...s, status: 'connected' } : s)
        }));
      }
    } catch (error) {
      console.error('Failed to connect', error);
      set((state) => ({
        sessions: state.sessions.map(s => s.id === sessionId ? { ...s, status: 'error' } : s)
      }));
    }
  },

  createNewSession: async (serverId: number) => {
    const sessionId = `session_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    set((state) => ({
      sessions: [...state.sessions, { id: sessionId, serverId, type: 'terminal', status: 'connecting' }],
      activeSessionId: sessionId,
      activeSessionPerServer: { ...state.activeSessionPerServer, [serverId]: sessionId }
    }));

    try {
      const result = await window.api.sshConnect(serverId, sessionId);
      if (result.success) {
        set((state) => ({
          sessions: state.sessions.map(s => s.id === sessionId ? { ...s, status: 'connected' } : s)
        }));
      }
    } catch (error) {
      console.error('Failed to connect', error);
      set((state) => ({
        sessions: state.sessions.map(s => s.id === sessionId ? { ...s, status: 'error' } : s)
      }));
    }
  },

  openSettings: (serverId: number) => {
    const existing = get().sessions.find(s => s.serverId === serverId && s.type === 'settings');
    if (existing) {
      set({ activeSessionId: existing.id, isGlobalSettingsOpen: false });
      set((state) => ({
        activeSessionPerServer: { ...state.activeSessionPerServer, [serverId]: existing.id }
      }));
      return;
    }

    const sessionId = `settings_${serverId}`;
    set((state) => ({
      sessions: [...state.sessions, { id: sessionId, serverId, type: 'settings', status: 'connected' }],
      activeSessionId: sessionId,
      activeServerId: serverId,
      isGlobalSettingsOpen: false,
      activeSessionPerServer: { ...state.activeSessionPerServer, [serverId]: sessionId }
    }));
  },

  switchServerContext: (serverId: number) => {
    const lastSessionId = get().activeSessionPerServer[serverId] || null;
    set({ 
      isGlobalSettingsOpen: false,
      activeServerId: serverId, 
      activeSessionId: lastSessionId 
    });
  },

  closeSession: (sessionId: string) => {
    window.api.sshDisconnect(sessionId);
    const session = get().sessions.find(s => s.id === sessionId);
    if (!session) return;

    set((state) => {
      const newSessions = state.sessions.filter(s => s.id !== sessionId);
      const serverId = session.serverId;
      
      // Update activeSessionPerServer
      const otherSessionsForServer = newSessions.filter(s => s.serverId === serverId);
      const nextSessionForServer = otherSessionsForServer.length > 0 ? otherSessionsForServer[otherSessionsForServer.length - 1].id : null;
      
      const newActiveSessionPerServer = { ...state.activeSessionPerServer, [serverId]: nextSessionForServer };
      
      return {
        sessions: newSessions,
        activeSessionPerServer: newActiveSessionPerServer,
        activeSessionId: state.activeSessionId === sessionId ? nextSessionForServer : state.activeSessionId
      };
    });
  },

  setActiveSession: (sessionId: string) => {
    const session = get().sessions.find(s => s.id === sessionId);
    if (session) {
      set((state) => ({ 
        activeSessionId: sessionId,
        activeSessionPerServer: { ...state.activeSessionPerServer, [session.serverId]: sessionId }
      }));
    }
  },
  
  updateSessionStatus: (sessionId: string, status: Session['status']) => {
    set((state) => ({
      sessions: state.sessions.map(s => s.id === sessionId ? { ...s, status } : s)
    }));
  },
  
  updateSessionName: (sessionId: string, name: string) => {
    set((state) => ({
      sessions: state.sessions.map(s => s.id === sessionId ? { ...s, name } : s)
    }));
  },
  
  reorderServers: async (activeId: number, overId: number) => {
    const { servers } = get();
    const oldIndex = servers.findIndex(s => s.id === activeId);
    const newIndex = servers.findIndex(s => s.id === overId);
    
    if (oldIndex !== newIndex) {
      const newServers = arrayMove(servers, oldIndex, newIndex);
      set({ servers: newServers });
      await window.api.serverUpdateOrder(newServers.map(s => s.id));
    }
  },

  reorderSessions: (activeId: string, overId: string) => {
    const { sessions } = get();
    const oldIndex = sessions.findIndex(s => s.id === activeId);
    const newIndex = sessions.findIndex(s => s.id === overId);

    if (oldIndex !== newIndex) {
      set({ sessions: arrayMove(sessions, oldIndex, newIndex) });
    }
  }
}));

// Setup IPC listeners for realtime updates
window.api.onSyncDataUpdated?.(() => {
  useAppStore.getState().fetchServers();
  useAppStore.getState().fetchSettings();
});
