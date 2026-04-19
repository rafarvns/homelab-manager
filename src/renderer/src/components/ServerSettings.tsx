import { useState } from 'react';
import * as LucideIcons from 'lucide-react';
import { 
  Settings, LayoutDashboard, Server, Shield, HardDrive, 
  AlertCircle 
} from 'lucide-react';
import { useAppStore, Server as ServerType } from '../store';
import { ServerInput } from './ServerForm';

const AVAILABLE_ICONS = [
  'Server', 'Terminal', 'Database', 'Globe', 'Cpu', 
  'HardDrive', 'Cloud', 'Shield', 'Zap', 'Activity',
  'Box', 'Monitor', 'Settings', 'Wifi', 'Lock'
];

interface ServerSettingsProps {
  server: ServerType;
  isActive: boolean;
  isHidden: boolean;
}

type SettingsTab = 'dashboard' | 'services' | 'docker' | 'firewall' | 'manage';

const ServerSettings = ({ server, isActive, isHidden }: ServerSettingsProps) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('dashboard');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmValue, setDeleteConfirmValue] = useState('');
  const [saveMessage, setSaveMessage] = useState('');
  const [formData, setFormData] = useState<ServerInput>({
    name: server.name,
    host: server.host,
    port: server.port,
    username: server.username,
    auth_type: server.auth_type,
    password: server.password || '',
    private_key_path: server.private_key_path || '',
    passphrase: server.passphrase || '',
    icon: server.icon || 'Server'
  });

  const { fetchServers, switchServerContext } = useAppStore();



  const handleDelete = async () => {
    try {
      await window.api.serverDelete(server.id);
      await fetchServers();
      setShowDeleteModal(false);
      setDeleteConfirmValue('');
      switchServerContext(0); 
    } catch (err) {
      console.error('Failed to delete server', err);
    }
  };

  const tabs: { id: SettingsTab; label: string; icon: any }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'services', label: 'Services', icon: Server },
    { id: 'docker', label: 'Docker', icon: HardDrive },
    { id: 'firewall', label: 'Firewall', icon: Shield },
    { id: 'manage', label: 'Manage', icon: Settings },
  ];

  return (
    <div className={`terminal-container settings-view ${isActive && !isHidden ? 'active' : ''}`}>
      <div className="settings-layout">
        <div className="settings-sidebar">
          <div className="settings-sidebar-header">
             <h3>Server Configuration</h3>
             <p>{server.username}@{server.host}</p>
          </div>
          <div className="settings-nav">
            {tabs.map(tab => (
              <button 
                key={tab.id}
                className={`settings-nav-item ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <tab.icon size={16} />
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="settings-content">
          {activeTab === 'dashboard' && (
            <div className="settings-section">
              <h2>Dashboard</h2>
              <div className="placeholder-card">
                <LayoutDashboard size={48} />
                <p>System metrics and health overview for <strong>{server.name}</strong> will appear here.</p>
                <span className="badge">Coming Soon</span>
              </div>
            </div>
          )}

          {activeTab === 'services' && (
            <div className="settings-section">
              <h2>Services</h2>
              <div className="placeholder-card">
                <Server size={48} />
                <p>Monitor and manage systemd services on <strong>{server.name}</strong>.</p>
                <span className="badge">Coming Soon</span>
              </div>
            </div>
          )}

          {activeTab === 'docker' && (
            <div className="settings-section">
              <h2>Docker</h2>
              <div className="placeholder-card">
                <HardDrive size={48} />
                <p>View containers, images, and volumes running on this host.</p>
                <span className="badge">Coming Soon</span>
              </div>
            </div>
          )}

          {activeTab === 'firewall' && (
            <div className="settings-section">
              <h2>Firewall</h2>
              <div className="placeholder-card">
                <Shield size={48} />
                <p>Configure UFW or Iptables rules for <strong>{server.name}</strong>.</p>
                <span className="badge">Coming Soon</span>
              </div>
            </div>
          )}

          {activeTab === 'manage' && (
            <div className="settings-section">
              <div className="settings-header">
                <h2>Manage Server</h2>
                <p>Update connection details or permanently remove this server.</p>
              </div>

              <div className="manage-grid">
                <div className="card edit-card">
                  <h3>Connection Settings</h3>
                  <form onSubmit={async (e) => {
                    e.preventDefault();
                    try {
                      await window.api.serverUpdate(server.id, formData);
                      await fetchServers();
                      setSaveMessage('Settings saved successfully!');
                      setTimeout(() => setSaveMessage(''), 3000);
                    } catch (err) {
                      console.error(err);
                      setSaveMessage('Failed to save settings.');
                    }
                  }}>
                    <div className="form-grid">
                      <div className="form-group">
                        <label>Display Name</label>
                        <input 
                          value={formData.name} 
                          onChange={e => setFormData({...formData, name: e.target.value})} 
                          placeholder="e.g. Home Server"
                        />
                      </div>
                      <div className="form-group">
                        <label>Icon</label>
                        <div className="icon-selector-inline">
                          {AVAILABLE_ICONS.slice(0, 10).map(icon => {
                            const IconComp = (LucideIcons as any)[icon] || LucideIcons.Server;
                            return (
                              <button
                                key={icon}
                                type="button"
                                className={`icon-btn-small ${formData.icon === icon ? 'active' : ''}`}
                                onClick={() => setFormData({...formData, icon})}
                                title={icon}
                              >
                                <IconComp size={16} />
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    <div className="form-row">
                      <div className="form-group flex-2">
                        <label>Host / IP</label>
                        <input 
                          value={formData.host} 
                          onChange={e => setFormData({...formData, host: e.target.value})} 
                        />
                      </div>
                      <div className="form-group flex-1">
                        <label>Port</label>
                        <input 
                          type="number"
                          value={formData.port} 
                          onChange={e => setFormData({...formData, port: parseInt(e.target.value)})} 
                        />
                      </div>
                    </div>

                    <div className="form-group">
                      <label>Username</label>
                      <input 
                        value={formData.username} 
                        onChange={e => setFormData({...formData, username: e.target.value})} 
                      />
                    </div>

                    <div className="form-group">
                      <label>Authentication Method</label>
                      <select 
                        value={formData.auth_type} 
                        onChange={e => setFormData({...formData, auth_type: e.target.value as any})}
                      >
                        <option value="password">Password</option>
                        <option value="key">SSH Key</option>
                      </select>
                    </div>

                    {formData.auth_type === 'password' ? (
                      <div className="form-group">
                        <label>Password</label>
                        <input 
                          type="password" 
                          value={formData.password} 
                          onChange={e => setFormData({...formData, password: e.target.value})} 
                        />
                      </div>
                    ) : (
                      <div className="form-group">
                        <label>Private Key</label>
                        <div className="key-path-display">
                          <code title={formData.private_key_path}>{formData.private_key_path || 'No key selected'}</code>
                          <button type="button" className="btn-small" onClick={async () => {
                            const path = await window.api.dialogOpenFile();
                            if (path) setFormData({...formData, private_key_path: path});
                          }}>Browse</button>
                        </div>
                      </div>
                    )}

                    <div className="form-actions">
                      {saveMessage && <span className={`save-status ${saveMessage.includes('Failed') ? 'error' : 'success'}`}>{saveMessage}</span>}
                      <button type="submit" className="btn btn-primary">Save Changes</button>
                    </div>
                  </form>
                </div>

                <div className="card danger-zone">
                  <div className="danger-header">
                    <AlertCircle size={20} />
                    <h3>Danger Zone</h3>
                  </div>
                  <p>Permanently remove this server and all its session history from Homelab Manager.</p>
                  <button className="btn btn-danger-outline" onClick={() => setShowDeleteModal(true)}>
                    Delete Server
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {showDeleteModal && (
        <div className="modal-overlay">
          <div className="modal delete-modal">
            <div className="modal-header">
              <AlertCircle color="var(--danger-color)" size={32} />
              <h2>Delete {server.name}?</h2>
            </div>
            <p>This will permanently remove the configuration for <strong>{server.name}</strong>.</p>
            <p className="confirm-text">Please type <strong>{server.name}</strong> to confirm:</p>
            <input 
              type="text" 
              className="confirm-input"
              value={deleteConfirmValue}
              onChange={e => setDeleteConfirmValue(e.target.value)}
              placeholder={server.name}
              autoFocus
            />
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => { setShowDeleteModal(false); setDeleteConfirmValue(''); }}>Cancel</button>
              <button 
                className="btn btn-danger" 
                disabled={deleteConfirmValue !== server.name}
                onClick={handleDelete}
              >
                Permanently Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ServerSettings;
