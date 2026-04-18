import { useEffect } from 'react'
import { Plus, Terminal, X, Edit, Trash2 } from 'lucide-react'
import { useAppStore } from './store'
import TerminalView from './components/TerminalView'
import ServerForm from './components/ServerForm'

function App() {
  const { 
    servers, sessions, activeSessionId, isAddModalOpen,
    fetchServers, openAddModal, openEditModal, addSession, setActiveSession, closeSession 
  } = useAppStore()

  useEffect(() => {
    fetchServers()
  }, [])

  return (
    <div className="app-container">
      {/* Sidebar */}
      <div className="sidebar">
        <div className="sidebar-header">
          <span>Servers</span>
          <button className="add-server-btn" onClick={openAddModal} title="Add Server">
            <Plus size={16} />
          </button>
        </div>
        <div className="server-list">
          {servers.map(server => (
            <div 
              key={server.id} 
              className="server-item"
              onDoubleClick={() => addSession(server.id)}
            >
              <div style={{ flex: 1 }}>
                <div className="server-name">{server.name}</div>
                <div className="server-host">{server.username}@{server.host}</div>
              </div>
              <div className="server-actions">
                <button 
                  className="icon-btn" 
                  onClick={(e) => { e.stopPropagation(); openEditModal(server); }}
                  title="Edit Server"
                >
                  <Edit size={14} />
                </button>
                <button 
                  className="icon-btn" 
                  onClick={async (e) => { 
                    e.stopPropagation(); 
                    if (confirm('Are you sure you want to delete this server?')) {
                      await window.api.serverDelete(server.id);
                      await fetchServers();
                    }
                  }}
                  title="Delete Server"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
          {servers.length === 0 && (
            <div style={{ color: 'var(--text-secondary)', textAlign: 'center', marginTop: 20, fontSize: '0.9rem' }}>
              No servers configured.<br/>Click + to add one.
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="main-area">
        {sessions.length > 0 ? (
          <>
            {/* Tabs */}
            <div className="tab-bar">
              {sessions.map(session => {
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
                        background: session.status === 'connected' ? 'var(--success-color)' : 
                                  (session.status === 'error' ? 'var(--danger-color)' : 'orange') 
                      }}></span>
                      {server?.name || 'Unknown'}
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
            </div>
            
            {/* Terminals (keep them mapped but hidden to preserve state) */}
            {sessions.map(session => (
              <TerminalView 
                key={session.id} 
                sessionId={session.id} 
                isActive={activeSessionId === session.id} 
              />
            ))}
          </>
        ) : (
          <div className="empty-state">
            <Terminal size={64} style={{ marginBottom: 16, opacity: 0.5 }} />
            <h2>Homelab Manager</h2>
            <p>Double-click a server in the sidebar to connect.</p>
          </div>
        )}
      </div>

      {isAddModalOpen && <ServerForm />}
    </div>
  )
}

export default App
