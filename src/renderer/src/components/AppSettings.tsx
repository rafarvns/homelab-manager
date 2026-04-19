import { useState, useEffect } from 'react';
import { 
  Cloud, RefreshCw, 
  Shield, Globe, Palette, Info, ExternalLink, X,
  Server
} from 'lucide-react';
import { useAppStore } from '../store';

type SettingsTab = 'sync' | 'appearance' | 'general' | 'about';

const AppSettings = () => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('sync');
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [syncing, setSyncing] = useState<string | null>(null); // 'push' | 'pull' | null
  const [showTutorial, setShowTutorial] = useState(false);
  const { toggleGlobalSettings, toggleSyncModal } = useAppStore();

  useEffect(() => {
    window.api.settingsGet<string>('sync_last_at').then(setLastSync);
  }, []);

  const handlePush = async () => {
    const config = await window.api.settingsGet('sync_sftp_config');
    if (!config) {
      toggleSyncModal(true);
      return;
    }
    const passphrase = window.prompt("Enter your Sync Passphrase to PUSH data:");
    if (!passphrase) return;

    setSyncing('push');
    try {
      const result = await window.api.syncPush(config, passphrase);
      if (result.success) {
        const now = new Date().toISOString();
        await window.api.settingsSet('sync_last_at', now);
        setLastSync(now);
        alert("Data pushed successfully!");
      } else {
        alert("Push failed: " + result.message);
      }
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setSyncing(null);
    }
  };

  const handlePull = async () => {
    const config = await window.api.settingsGet('sync_sftp_config');
    if (!config) {
      toggleSyncModal(true);
      return;
    }
    const passphrase = window.prompt("Enter your Sync Passphrase to PULL and MERGE data:");
    if (!passphrase) return;

    setSyncing('pull');
    try {
      const result = await window.api.syncPull(config, passphrase);
      if (result.success) {
        alert("Data pulled and merged successfully!");
        window.location.reload();
      } else {
        alert("Pull failed: " + result.message);
      }
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setSyncing(null);
    }
  };

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
               <button className="icon-btn" onClick={() => toggleGlobalSettings(false)}>
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
            <div className="settings-section animate-fade-in">
              <div className="settings-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h2 style={{ fontSize: '1.8rem', fontWeight: '800', letterSpacing: '-0.5px' }}>Synchronization</h2>
                  <p style={{ fontSize: '1rem', marginTop: '4px', opacity: 0.7 }}>Securely sync your servers and configurations.</p>
                </div>
                <button 
                  className="btn btn-secondary btn-sm" 
                  onClick={() => setShowTutorial(!showTutorial)}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.05)', height: '36px' }}
                >
                  <Info size={14} />
                  {showTutorial ? 'Hide Tutorial' : 'How it works?'}
                </button>
              </div>

              {showTutorial && (
                <div className="tutorial-section animate-view-fade" style={{ marginBottom: '32px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                    <div style={{ background: 'var(--accent-color)', padding: '10px', borderRadius: '10px', color: 'white', display: 'flex' }}>
                      <Shield size={20} />
                    </div>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '1.1rem' }}>End-to-End Encrypted Sync</h3>
                      <p style={{ margin: 0, fontSize: '0.85rem', opacity: 0.6 }}>Follow these steps to enable cross-machine data portability.</p>
                    </div>
                  </div>
                  
                  <div className="step-list">
                    <div className="step-item">
                      <div className="step-number">1</div>
                      <div className="step-content">
                        <h4>Secure SFTP Endpoint</h4>
                        <p>Configure a connection to your private SFTP server. This acts as the secure vault for your encrypted database file.</p>
                      </div>
                    </div>
                    <div className="step-item">
                      <div className="step-number">2</div>
                      <div className="step-content">
                        <h4>Master Sync Passphrase</h4>
                        <p>Create a passphrase that is never stored. Your data is encrypted using AES-256-GCM locally before any network transfer.</p>
                      </div>
                    </div>
                    <div className="step-item">
                      <div className="step-number">3</div>
                      <div className="step-content">
                        <h4>Push, Pull & Merge</h4>
                        <p>Push your data to the vault. On any other machine, Pull & Merge to seamlessly synchronize your homelab environment.</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="sync-options-grid">
                <div className="glass-card sync-card active-sync">
                  <div style={{ position: 'absolute', top: '24px', right: '24px' }}>
                    <span className="feature-badge">Privacy First</span>
                  </div>

                  <div className="card-icon" style={{ background: 'rgba(88, 166, 255, 0.1)', color: 'var(--accent-color)', width: '64px', height: '64px', minWidth: '64px' }}>
                    <Server size={32} />
                  </div>
                  
                  <div className="card-body" style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                      <div>
                        <h3 style={{ fontSize: '1.4rem', fontWeight: '700', marginBottom: '4px' }}>Self-Hosted SFTP</h3>
                        <p style={{ fontSize: '0.95rem', opacity: 0.7 }}>Secure file transfer protocol for ultimate data ownership.</p>
                      </div>
                      <button 
                        className="btn btn-primary" 
                        onClick={() => toggleSyncModal(true)}
                        style={{ padding: '8px 20px', borderRadius: '10px', fontWeight: '600' }}
                      >
                        {lastSync ? 'Configure' : 'Get Started'}
                      </button>
                    </div>

                    <div className="sync-status-footer" style={{ marginTop: '32px', paddingTop: '24px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                         <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                           <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: lastSync ? 'var(--success-color)' : 'var(--danger-color)', boxShadow: lastSync ? '0 0 8px var(--success-color)' : 'none' }}></div>
                           <div style={{ fontSize: '0.85rem' }}>
                             {lastSync ? (
                               <span style={{ color: 'var(--text-secondary)' }}>Synced <strong style={{ color: 'var(--text-primary)' }}>{new Date(lastSync).toLocaleString()}</strong></span>
                             ) : (
                               <span style={{ color: 'var(--danger-color)', fontWeight: '600' }}>Offline / Not Configured</span>
                             )}
                           </div>
                         </div>
                         <div style={{ display: 'flex', gap: '12px' }}>
                           <button 
                             className="btn btn-secondary" 
                             onClick={handlePull}
                             disabled={!!syncing}
                             style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.05)' }}
                           >
                              <RefreshCw size={14} className={syncing === 'pull' ? 'animate-spin' : ''} />
                              Pull & Merge
                           </button>
                           <button 
                             className="btn btn-primary" 
                             onClick={handlePush}
                             disabled={!!syncing}
                             style={{ display: 'flex', alignItems: 'center', gap: '8px', borderRadius: '10px' }}
                           >
                              <RefreshCw size={14} className={syncing === 'push' ? 'animate-spin' : ''} />
                              Push Data
                           </button>
                         </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="glass-card sync-card" style={{ opacity: 0.5, borderStyle: 'dashed' }}>
                  <div className="card-icon" style={{ background: 'rgba(255, 255, 255, 0.03)', color: 'var(--text-secondary)', width: '64px', height: '64px', minWidth: '64px' }}>
                    <Cloud size={32} />
                  </div>
                  <div className="card-body">
                    <h3 style={{ color: 'var(--text-secondary)', fontSize: '1.2rem' }}>Google Drive</h3>
                    <p>Integrate directly with your cloud storage provider.</p>
                    <span className="feature-badge" style={{ background: 'var(--panel-border)', color: 'var(--text-secondary)' }}>Coming Soon</span>
                  </div>
                </div>
              </div>

              <div className="settings-footer-privacy animate-fade-in" style={{ 
                marginTop: '40px', 
                paddingTop: '20px', 
                borderTop: '1px solid rgba(255,255,255,0.05)',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                opacity: 0.6,
                fontSize: '0.8rem'
              }}>
                <Shield size={14} color="var(--accent-color)" />
                <span>
                  <strong>End-to-End Encrypted:</strong> We utilize military-grade <strong>AES-256-GCM</strong>. Your passphrase stays on your device.
                </span>
              </div>
            </div>
          )}

          {activeTab === 'appearance' && (
            <div className="settings-section animate-fade-in">
              <div className="settings-header">
                <h2>Appearance</h2>
                <p>Customize your workspace to match your setup.</p>
              </div>
              <div className="placeholder-card" style={{ background: 'rgba(255,255,255,0.02)', border: '1px dashed var(--panel-border)', borderRadius: '16px', padding: '60px', textAlign: 'center' }}>
                <Palette size={48} color="var(--text-secondary)" style={{ marginBottom: '16px' }} />
                <h4 style={{ color: 'var(--text-secondary)' }}>Appearance Customization</h4>
                <p style={{ opacity: 0.5 }}>Themes, custom terminal colors, and font settings are in development.</p>
                <span className="feature-badge" style={{ background: 'var(--panel-border)', color: 'var(--text-secondary)', marginTop: '12px' }}>Next Minor Release</span>
              </div>
            </div>
          )}

          {activeTab === 'general' && (
            <div className="settings-section animate-fade-in">
              <div className="settings-header">
                <h2>General Settings</h2>
                <p>Manage application behavior and system integration.</p>
              </div>
              <div className="placeholder-card" style={{ background: 'rgba(255,255,255,0.02)', border: '1px dashed var(--panel-border)', borderRadius: '16px', padding: '60px', textAlign: 'center' }}>
                <Globe size={48} color="var(--text-secondary)" style={{ marginBottom: '16px' }} />
                <h4 style={{ color: 'var(--text-secondary)' }}>System Preferences</h4>
                <p style={{ opacity: 0.5 }}>Auto-start, language selection, and update channels coming soon.</p>
              </div>
            </div>
          )}

          {activeTab === 'about' && (
            <div className="settings-section animate-fade-in">
              <div className="about-header" style={{ textAlign: 'center', padding: '40px 0' }}>
                <div className="app-logo-large" style={{ margin: '0 auto 24px' }}>
                  <RefreshCw size={64} className="pulse-slow" />
                </div>
                <h2 style={{ fontSize: '2rem', fontWeight: '800' }}>Homelab Manager</h2>
                <span className="version-tag">v1.2.5 Premium</span>
                
                <div className="about-details" style={{ marginTop: '24px', maxWidth: '480px', margin: '24px auto' }}>
                  <p style={{ opacity: 0.7, lineHeight: '1.6' }}>The most advanced, agent-native control plane for self-hosted infrastructure. Built for stability, security, and aesthetics.</p>
                  <div className="link-group" style={{ marginTop: '32px' }}>
                    <a href="https://github.com" className="about-link" target="_blank" rel="noopener noreferrer"><Globe size={16} /> rafarvns GitHub</a>
                    <a href="#" className="about-link"><ExternalLink size={16} /> Documentation</a>
                  </div>
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
