import { create } from 'zustand';
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
  status: 'connecting' | 'connected' | 'reconnecting' | 'disconnected' | 'error';
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
  
  setServers: (servers: Server[]) => void;
  fetchServers: () => Promise<void>;
  
  toggleSidebar: () => void;
  openAddModal: () => void;
  openEditModal: (server: Server) => void;
  closeAddModal: () => void;
  
  addSession: (serverId: number) => Promise<void>;
  createNewSession: (serverId: number) => Promise<void>;
  closeSession: (sessionId: string) => void;
  setActiveSession: (sessionId: string) => void;
  switchServerContext: (serverId: number) => void;
  updateSessionStatus: (sessionId: string, status: Session['status']) => void;
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
  
  setServers: (servers) => set({ servers }),
  
  toggleSidebar: () => set((state) => ({ isSidebarCollapsed: !state.isSidebarCollapsed })),
  
  fetchServers: async () => {
    const servers = await window.api.serverList();
    set({ servers });
  },

  openAddModal: () => set({ isAddModalOpen: true, editingServer: null }),
  openEditModal: (server) => set({ isAddModalOpen: true, editingServer: server }),
  closeAddModal: () => set({ isAddModalOpen: false, editingServer: null }),

  addSession: async (serverId: number) => {
    // If double-clicking, we switch to context and check sessions
    set({ activeServerId: serverId });

    const existingSessions = get().sessions.filter(s => s.serverId === serverId);
    if (existingSessions.length > 0) {
      // Just focus the last active session for this server
      const lastSessionId = get().activeSessionPerServer[serverId] || existingSessions[0].id;
      set({ activeSessionId: lastSessionId });
      return;
    }

    const sessionId = `session_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    set((state) => ({
      sessions: [...state.sessions, { id: sessionId, serverId, status: 'connecting' }],
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
      sessions: [...state.sessions, { id: sessionId, serverId, status: 'connecting' }],
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

  switchServerContext: (serverId: number) => {
    const lastSessionId = get().activeSessionPerServer[serverId] || null;
    set({ 
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
  }
}));
