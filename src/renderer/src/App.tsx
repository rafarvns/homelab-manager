import { useEffect } from 'react'
import * as LucideIcons from 'lucide-react'
import { Plus, Terminal, X, Edit, Trash2, ChevronLeft, ChevronRight } from 'lucide-react'
import { useAppStore } from './store'
import TerminalView from './components/TerminalView'
import ServerForm from './components/ServerForm'

const ServerIcon = ({ name, size = 16 }: { name?: string; size?: number }) => {
  const IconComponent = (LucideIcons as any)[name || 'Server'] || LucideIcons.Server;
  return <IconComponent size={size} />;
};

function App() {
  const { 
    servers, sessions, activeSessionId, activeServerId, isAddModalOpen, isSidebarCollapsed,
    fetchServers, toggleSidebar, openAddModal, openEditModal, addSession, createNewSession, setActiveSession, closeSession, switchServerContext 
  } = useAppStore()

  useEffect(() => {
    fetchServers()
  }, [])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected': return 'var(--success-color)';
      case 'reconnecting': return 'orange';
      case 'error': return 'var(--danger-color)';
      case 'connecting': return 'var(--accent-color)';
      default: return 'var(--text-secondary)';
    }
  };

  return (
    <div className="app-container">
      {/* Sidebar */}
      <div className={`sidebar ${isSidebarCollapsed ? 'collapsed' : ''}`}>
        <div className="sidebar-header">
          {!isSidebarCollapsed && <span>Servers</span>}
          <div className="sidebar-header-actions">
            <button className="add-server-btn" onClick={openAddModal} title="Add Server">
              <Plus size={16} />
            </button>
          </div>
        </div>

        <div className="server-list">
          {servers.map(server => {
            const serverSessions = sessions.filter(s => s.serverId === server.id);
            const hasActiveSession = serverSessions.some(s => s.status === 'connected');
            const isReconnecting = serverSessions.some(s => s.status === 'reconnecting');
            const isActive = activeServerId === server.id;

            return (
              <div 
                key={server.id} 
                className={`server-item ${isActive ? 'active' : ''}`}
                onClick={() => switchServerContext(server.id)}
                onDoubleClick={() => addSession(server.id)}
                title={isSidebarCollapsed ? `${server.name}\n${server.username}@${server.host}` : undefined}
              >
                <div className="server-item-main">
                  <div className="server-icon-wrapper">
                    <ServerIcon name={server.icon} />
                    {(hasActiveSession || isReconnecting) && (
                      <span className={`status-dot ${isReconnecting ? 'reconnecting' : 'connected'}`} />
                    )}
                  </div>
                  {!isSidebarCollapsed && (
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="server-name">{server.name}</div>
                      <div className="server-host">{server.username}@{server.host}</div>
                    </div>
                  )}
                </div>
                {!isSidebarCollapsed && (
                  <div className="server-actions">
                    <button 
                      className="icon-btn edit-btn" 
                      onClick={(e) => { e.stopPropagation(); openEditModal(server); }}
                      title="Edit Server"
                    >
                      <Edit size={12} />
                    </button>
                    <button 
                      className="icon-btn delete-btn" 
                      onClick={async (e) => { 
                        e.stopPropagation(); 
                        if (confirm('Are you sure you want to delete this server?')) {
                          await window.api.serverDelete(server.id);
                          await fetchServers();
                        }
                      }}
                      title="Delete Server"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
          {servers.length === 0 && !isSidebarCollapsed && (
            <div className="no-servers">
              No servers configured.<br/>Click + to add one.
            </div>
          )}
        </div>

        <div className="sidebar-footer">
          <button className="collapse-toggle" onClick={toggleSidebar} title={isSidebarCollapsed ? "Expand" : "Collapse"}>
            {isSidebarCollapsed ? <ChevronRight size={18} /> : (
              <>
                <ChevronLeft size={18} />
                <span>Collapse Sidebar</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="main-area">
        {activeServerId ? (
          <>
            {/* Tabs */}
            <div className="tab-bar">
              {sessions.filter(s => s.serverId === activeServerId).map((session, index) => {
                const server = servers.find(s => s.id === session.serverId)
                return (
                  <div 
                    key={session.id} 
                    className={`tab ${activeSessionId === session.id ? 'active' : ''}`}
                    onClick={() => setActiveSession(session.id)}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ 
                        display: 'inline-block', width: 8, height: 8, borderRadius: '50%', 
                        background: getStatusColor(session.status)
                      }} className={session.status === 'reconnecting' ? 'reconnecting-pulse' : ''}></span>
                      {server?.name} #{index + 1}
                    </span>
                    <button 
                      className="tab-close" 
                      onClick={(e) => { e.stopPropagation(); closeSession(session.id); }}
                    >
                      <X size={14} />
                    </button>
                  </div>
                )
              })}
              <button 
                className="new-tab-btn" 
                onClick={() => createNewSession(activeServerId)}
                title="New Tab"
              >
                <Plus size={14} />
              </button>
            </div>
            
            {/* Terminals (keep them mapped but only show active server's ones) */}
            {sessions.map(session => (
              <TerminalView 
                key={session.id} 
                sessionId={session.id} 
                isActive={activeSessionId === session.id} 
                isHidden={session.serverId !== activeServerId}
              />
            ))}
          </>
        ) : (
          <div className="empty-state">
            <Terminal size={64} style={{ marginBottom: 16, opacity: 0.5 }} />
            <h2>Homelab Manager</h2>
            <p>Select or double-click a server in the sidebar to start.</p>
          </div>
        )}
      </div>

      {isAddModalOpen && <ServerForm />}
    </div>
  )
}

export default App
