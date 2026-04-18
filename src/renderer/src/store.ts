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
}

interface Session {
  id: string; // usually sessionId random string
  serverId: number; // reference to the server
  status: 'connecting' | 'connected' | 'disconnected' | 'error';
}

interface AppState {
  servers: Server[];
  sessions: Session[];
  activeSessionId: string | null;
  isAddModalOpen: boolean;
  editingServer: Server | null;
  
  setServers: (servers: Server[]) => void;
  fetchServers: () => Promise<void>;
  
  openAddModal: () => void;
  openEditModal: (server: Server) => void;
  closeAddModal: () => void;
  
  addSession: (serverId: number) => Promise<void>;
  closeSession: (sessionId: string) => void;
  setActiveSession: (sessionId: string) => void;
  updateSessionStatus: (sessionId: string, status: Session['status']) => void;
}

export const useAppStore = create<AppState>((set) => ({
  servers: [],
  sessions: [],
  activeSessionId: null,
  isAddModalOpen: false,
  editingServer: null,
  setServers: (servers) => set({ servers }),
  
  fetchServers: async () => {
    const servers = await window.api.serverList();
    set({ servers });
  },

  openAddModal: () => set({ isAddModalOpen: true, editingServer: null }),
  openEditModal: (server) => set({ isAddModalOpen: true, editingServer: server }),
  closeAddModal: () => set({ isAddModalOpen: false, editingServer: null }),

  addSession: async (serverId: number) => {
    const sessionId = `session_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    set((state) => ({
      sessions: [...state.sessions, { id: sessionId, serverId, status: 'connecting' }],
      activeSessionId: sessionId
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

  closeSession: (sessionId: string) => {
    window.api.sshDisconnect(sessionId);
    set((state) => {
      const newSessions = state.sessions.filter(s => s.id !== sessionId);
      return {
        sessions: newSessions,
        activeSessionId: state.activeSessionId === sessionId 
          ? (newSessions.length > 0 ? newSessions[newSessions.length - 1].id : null) 
          : state.activeSessionId
      };
    });
  },

  setActiveSession: (sessionId: string) => set({ activeSessionId: sessionId }),
  
  updateSessionStatus: (sessionId: string, status: Session['status']) => {
    set((state) => ({
      sessions: state.sessions.map(s => s.id === sessionId ? { ...s, status } : s)
    }));
  }
}));
