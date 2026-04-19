import { useEffect } from 'react'
import * as LucideIcons from 'lucide-react'
import { Plus, Terminal, X, ChevronLeft, ChevronRight, Settings } from 'lucide-react'
import { useAppStore } from './store'
import TerminalView from './components/TerminalView'
import ServerSettings from './components/ServerSettings'
import ServerForm from './components/ServerForm'
import AppSettings from './components/AppSettings'
import SyncConfigModal from './components/SyncConfigModal'

// Dnd Kit Imports
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  horizontalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const ServerIcon = ({ name, size = 16 }: { name?: string; size?: number }) => {
  const IconComponent = (LucideIcons as any)[name || 'Server'] || LucideIcons.Server;
  return <IconComponent size={size} />;
};

const SortableServerItem = ({ server, isActive, isSidebarCollapsed, onSelect, onDoubleClick }: any) => {
  const { 
    sessions, 
  } = useAppStore();
  
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: server.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
    opacity: isDragging ? 0.6 : 1,
  };

  const serverSessions = sessions.filter(s => s.serverId === server.id);
  const isConnected = serverSessions.some(s => s.status === 'connected');
  const isReconnecting = serverSessions.some(s => s.status === 'reconnecting');
  
  const getStatusClass = () => {
    if (isConnected) return 'status-connected';
    if (isReconnecting) return 'status-reconnecting';
    return 'status-disconnected';
  };

  return (
    <div 
      ref={setNodeRef}
      style={style}
      className={`server-item ${isActive ? 'active' : ''} ${isDragging ? 'dragging' : ''}`}
      onClick={() => onSelect(server.id)}
      onDoubleClick={() => onDoubleClick(server.id)}
      title={isSidebarCollapsed ? `${server.name}\n${server.username}@${server.host}` : undefined}
      {...attributes}
      {...listeners}
    >
      <div className="server-item-main">
        <div className={`server-icon-wrapper ${getStatusClass()}`}>
          <ServerIcon name={server.icon} />
        </div>
        {!isSidebarCollapsed && (
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="server-name">{server.name}</div>
            <div className="server-host">{server.username}@{server.host}</div>
          </div>
        )}
      </div>
    </div>
  );
};

const SortableTabItem = ({ session, servers, activeSessionId, onSelect, onClose }: any) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: session.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 100 : 1,
    opacity: isDragging ? 0.8 : 1,
  };

  const server = servers.find(s => s.id === session.serverId);

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
    <div 
      ref={setNodeRef}
      style={style}
      className={`tab ${activeSessionId === session.id ? 'active' : ''} ${isDragging ? 'dragging' : ''}`}
      onClick={() => onSelect(session.id)}
      {...attributes}
      {...listeners}
    >
      <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ 
          display: 'inline-block', width: 8, height: 8, borderRadius: '50%', 
          background: getStatusColor(session.status)
        }} className={session.status === 'reconnecting' ? 'reconnecting-pulse' : ''}></span>
        {session.type === 'settings' ? 'Settings' : `${server?.name || 'Session'}`}
      </span>
      <button 
        className="tab-close" 
        onClick={(e) => { e.stopPropagation(); onClose(session.id); }}
        onMouseDown={(e) => e.stopPropagation()} // Prevent drag when clicking close
      >
        <X size={14} />
      </button>
    </div>
  );
};

function App() {
  const { 
    servers, sessions, activeSessionId, activeServerId, isAddModalOpen, isSidebarCollapsed, isGlobalSettingsOpen, isSyncModalOpen,
    fetchServers, fetchSettings, toggleSidebar, toggleGlobalSettings, openAddModal, addSession, createNewSession, openSettings, setActiveSession, closeSession, switchServerContext,
    reorderServers, reorderSessions
  } = useAppStore()

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    fetchServers()
    fetchSettings()
  }, [])

  const handleServerDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      reorderServers(active.id as number, over.id as number);
    }
  };

  const handleTabDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      reorderSessions(active.id as string, over.id as string);
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
          <DndContext 
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleServerDragEnd}
          >
            <SortableContext 
              items={servers.map(s => s.id)}
              strategy={verticalListSortingStrategy}
            >
              {servers.map(server => (
                <SortableServerItem 
                  key={server.id} 
                  server={server}
                  isActive={activeServerId === server.id}
                  isSidebarCollapsed={isSidebarCollapsed}
                  onSelect={switchServerContext}
                  onDoubleClick={addSession}
                />
              ))}
            </SortableContext>
          </DndContext>
          {servers.length === 0 && !isSidebarCollapsed && (
            <div className="no-servers">
              No servers configured.<br/>Click + to add one.
            </div>
          )}
        </div>

        <div className="sidebar-footer">
          <button 
            className={`global-settings-btn ${isGlobalSettingsOpen ? 'active' : ''}`} 
            onClick={() => toggleGlobalSettings(!isGlobalSettingsOpen)}
            title="App Settings"
          >
            <Settings size={18} />
            {!isSidebarCollapsed && <span>App Settings</span>}
          </button>
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
        {/* App Settings View */}
        <div 
          className="main-view-container animate-fade-in" 
          style={{ display: isGlobalSettingsOpen ? 'block' : 'none', height: '100%' }}
        >
          <AppSettings />
        </div>

        {/* Server Content View (Tabs & Terminals) */}
        {!isGlobalSettingsOpen && !activeServerId && (
          <div className="empty-state animate-fade-in">
            <Terminal size={64} style={{ marginBottom: 16, opacity: 0.5 }} />
            <h2>Homelab Manager</h2>
            <p>Select or double-click a server in the sidebar to start.</p>
          </div>
        )}

        <div 
          className="main-view-container" 
          style={{ display: !isGlobalSettingsOpen && activeServerId ? 'flex' : 'none', flexDirection: 'column', height: '100%' }}
        >
          {/* Tabs */}
          <div className="tab-bar">
            <div className="tabs-scroll-area">
              <DndContext 
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleTabDragEnd}
              >
                <SortableContext 
                  items={sessions.filter(s => s.serverId === activeServerId && s.type !== 'settings').map(s => s.id)}
                  strategy={horizontalListSortingStrategy}
                >
                  {sessions.filter(s => s.serverId === activeServerId && s.type !== 'settings').map((session) => (
                    <SortableTabItem 
                      key={session.id} 
                      session={session}
                      servers={servers}
                      activeSessionId={activeSessionId}
                      onSelect={setActiveSession}
                      onClose={closeSession}
                    />
                  ))}
                </SortableContext>
              </DndContext>
              <button 
                className="new-tab-btn" 
                onClick={() => createNewSession(activeServerId!)}
                title="New Tab"
              >
                <Plus size={14} />
              </button>
            </div>
            <button 
              className={`settings-tab-btn ${sessions.find(s => s.id === activeSessionId)?.type === 'settings' ? 'active' : ''}`}
              onClick={() => openSettings(activeServerId!)}
              title="Server Settings"
            >
              <Settings size={18} />
            </button>
          </div>
          
          {/* Terminals & Settings (keep them mapped but only show active server's ones) */}
          <div className="sessions-container" style={{ flex: 1, position: 'relative' }}>
            {[...sessions].sort((a, b) => a.id.localeCompare(b.id)).map(session => {
              const server = servers.find(s => s.id === session.serverId);
              const isSelected = activeSessionId === session.id;
              const isDifferentServer = session.serverId !== activeServerId;
              
              if (session.type === 'settings' && server) {
                return (
                  <ServerSettings 
                    key={session.id} 
                    server={server} 
                    isActive={isSelected && !isDifferentServer}
                    isHidden={!isSelected || isDifferentServer}
                  />
                );
              }

              return (
                <TerminalView 
                  key={session.id} 
                  sessionId={session.id} 
                  isActive={isSelected && !isDifferentServer}
                  isHidden={!isSelected || isDifferentServer}
                />
              );
            })}
          </div>
        </div>
      </div>

      {isAddModalOpen && <ServerForm />}
      {isSyncModalOpen && <SyncConfigModal />}
    </div>
  )
}

export default App
