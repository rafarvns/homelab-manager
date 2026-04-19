import { useState } from 'react';
import { 
  Cloud, HardDrive, RefreshCw, 
  Shield, Globe, Palette, Info, ExternalLink, X
} from 'lucide-react';
import { useAppStore } from '../store';

type SettingsTab = 'sync' | 'appearance' | 'general' | 'about';

const AppSettings = () => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('sync');
  const { toggleGlobalSettings } = useAppStore();

  const tabs: { id: SettingsTab; label: string; icon: any }[] = [
    { id: 'sync', label: 'Synchronization', icon: RefreshCw },
    { id: 'appearance', label: 'Appearance', icon: Palette },
    { id: 'general', label: 'General', icon: Globe },
    { id: 'about', label: 'About', icon: Info },
  ];

  return (
    <div className="terminal-container app-settings-view active">
      <div className="settings-layout app-settings-layout">
        <div className="settings-sidebar">
          <div className="settings-sidebar-header">
             <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
               <h3>App Settings</h3>
               <button className="icon-btn-small" onClick={() => toggleGlobalSettings(false)}>
                 <X size={16} />
               </button>
             </div>
             <p>Configure Homelab Manager</p>
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
          {activeTab === 'sync' && (
            <div className="settings-section">
              <div className="settings-header">
                <h2>Data Synchronization</h2>
                <p>Sync your servers and configurations across multiple devices.</p>
              </div>

              <div className="sync-options-grid">
                <div className="card sync-card">
                  <div className="card-icon">
                    <HardDrive size={32} color="var(--accent-color)" />
                  </div>
                  <div className="card-body">
                    <h3>Self-Hosted File Server</h3>
                    <p>Sync using your own WebDAV or SFTP file server.</p>
                    <div className="form-group mt-16">
                      <label>Server URL</label>
                      <input type="text" placeholder="https://dav.yourdomain.com" disabled />
                    </div>
                    <button className="btn btn-secondary mt-8" disabled>Configure (Coming Soon)</button>
                  </div>
                </div>

                <div className="card sync-card">
                  <div className="card-icon">
                    <Cloud size={32} color="#4285F4" />
                  </div>
                  <div className="card-body">
                    <h3>Google Drive</h3>
                    <p>Backup and sync directly to your Google Drive account.</p>
                    <div className="sync-status">
                      <span className="badge badge-outline">Not Connected</span>
                    </div>
                    <button className="btn btn-primary mt-16" disabled>
                      <RefreshCw size={14} className="mr-8" />
                      Connect Account
                    </button>
                  </div>
                </div>
              </div>

              <div className="settings-info-box mt-24">
                <Shield size={18} />
                <p>All sync data is encrypted locally using <strong>safeStorage</strong> before being uploaded to your sync provider.</p>
              </div>
            </div>
          )}

          {activeTab === 'appearance' && (
            <div className="settings-section">
              <h2>Appearance</h2>
              <div className="placeholder-card">
                <Palette size={48} />
                <p>Customize themes, colors, and terminal fonts.</p>
                <span className="badge">Coming Soon</span>
              </div>
            </div>
          )}

          {activeTab === 'general' && (
            <div className="settings-section">
              <h2>General Settings</h2>
              <div className="placeholder-card">
                <Globe size={48} />
                <p>Application behavior, language, and startup options.</p>
                <span className="badge">Coming Soon</span>
              </div>
            </div>
          )}

          {activeTab === 'about' && (
            <div className="settings-section">
              <div className="about-header">
                <div className="app-logo-large">
                  <RefreshCw size={64} className="pulse-slow" />
                </div>
                <h2>Homelab Manager</h2>
                <span className="version-tag">v1.2.0-secure</span>
              </div>
              
              <div className="about-details">
                <p>A premium, agent-native Electron application for managing your distributed homelab infrastructure.</p>
                <div className="link-group">
                  <a href="#" className="about-link"><Globe size={14} /> Website</a>
                  <a href="#" className="about-link"><ExternalLink size={14} /> Documentation</a>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AppSettings;
