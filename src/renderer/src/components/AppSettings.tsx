import { useState, useEffect } from 'react';
import { 
  Cloud, RefreshCw, 
  Shield, Globe, Palette, Info, ExternalLink, X,
  Server, AlertCircle, Lock
} from 'lucide-react';
import { useAppStore } from '../store';

type SettingsTab = 'sync' | 'appearance' | 'general' | 'about';

const AppSettings = () => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('sync');
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [fileSize, setFileSize] = useState<number | null>(null);
  const [passphraseAction, setPassphraseAction] = useState<'push' | 'pull' | 'auto-sync' | null>(null);
  const [showPassphrasePrompt, setShowPassphrasePrompt] = useState(false);
  const [promptPassphrase, setPromptPassphrase] = useState('');

  const { toggleGlobalSettings, toggleSyncModal, isAutoSyncEnabled, setAutoSync, fetchAutoSyncStatus, fetchServers, fetchSettings } = useAppStore();

  useEffect(() => {
    window.api.settingsGet<string>('sync_last_at').then(setLastSync);
    window.api.settingsGet<'sftp' | 'gdrive'>('sync_provider').then(p => setSyncProvider(p || 'sftp'));
    window.api.syncGetGDriveAccount().then(setGdriveAccount);
    window.api.settingsGet<string>('sync_gdrive_client_id').then(id => setGdriveConfig(prev => ({ ...prev, client_id: id || '' })));
    window.api.settingsGet<string>('sync_gdrive_client_secret').then(sec => setGdriveConfig(prev => ({ ...prev, client_secret: sec || '' })));

    fetchAutoSyncStatus();
    fetchSyncStats();
  }, []);

  const fetchSyncStats = async () => {
    try {
      const stats = await window.api.syncGetLocalStats();
      setFileSize(stats.size);
    } catch (e) {
      console.error('Failed to fetch sync stats', e);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const mb = bytes / (1024 * 1024);
    if (mb < 0.1) {
      return (bytes / 1024).toFixed(1) + ' KB';
    }
    return mb.toFixed(2) + ' MB';
  };

  // Clear notification after 5 seconds
  useEffect(() => {
    if (notification.type) {
      const timer = setTimeout(() => setNotification({ type: null, message: '' }), 5000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [notification]);

  const toggleAutoSync = async () => {
    console.log('[AppSettings] Toggling Auto-Sync. Current state:', isAutoSyncEnabled);
    if (!isAutoSyncEnabled) {
      // Enabling
      try {
        const config = await window.api.settingsGet('sync_sftp_config');
        console.log('[AppSettings] SFTP Config retrieved:', config);
        
        if (!config || Object.keys(config).length === 0) {
          console.log('[AppSettings] No SFTP config found, opening configuration modal.');
          toggleSyncModal(true);
          return;
        }

        setPassphraseAction('auto-sync');
        setShowPassphrasePrompt(true);
      } catch (err: any) {
        console.error('[AppSettings] Failed to enable auto-sync:', err);
        setNotification({ type: 'error', message: "Failed to enable: " + err.message });
      }
    } else {
      // Disabling
      console.log('[AppSettings] Disabling Auto-Sync.');
      try {
        await setAutoSync(false);
        await window.api.syncSetSecurePassphrase(null);
        setNotification({ type: 'success', message: 'Auto-Sync disabled.' });
      } catch (err: any) {
        console.error('[AppSettings] Failed to disable auto-sync:', err);
      }
    }
  };

  const handleConfirmPassphrase = async () => {
    if (!promptPassphrase.trim()) return;
    const action = passphraseAction;
    const passphrase = promptPassphrase;
    
    setShowPassphrasePrompt(false);
    setPromptPassphrase('');
    setPassphraseAction(null);

    const config = await window.api.settingsGet('sync_sftp_config');

    if (action === 'auto-sync') {
      setNotification({ type: 'success', message: 'Encrypting and saving secure credentials...' });
      try {
        await window.api.syncSetSecurePassphrase(passphrase);
        await setAutoSync(true);
        setNotification({ type: 'success', message: 'Auto-Sync enabled! Pushing initial state...' });
        
        const res = await window.api.syncPush(config, passphrase);
        if (res.success) {
          const now = new Date().toISOString();
          window.api.settingsSet('sync_last_at', now);
          setLastSync(now);
          setNotification({ type: 'success', message: 'Auto-Sync enabled and initial push successful.' });
        } else {
          setNotification({ type: 'error', message: "Sync error: " + res.message });
        }
      } catch (err: any) {
        setNotification({ type: 'error', message: "Failed: " + err.message });
      }
    } else if (action === 'push') {
      setPassphraseAction('push'); // Keep for UI spinner if needed, but we use 'syncing'
      handleExecutePush(config, passphrase);
    } else if (action === 'pull') {
      handleExecutePull(config, passphrase);
    }
  };

  const handleExecutePush = async (config: any, passphrase: string) => {
    setPassphraseAction(null);
    setNotification({ type: null, message: '' });
    // We reuse the 'syncing' state for UI buttons
    const setSyncingState = (state: any) => {
      // This is a bit hacky because we want to show the spinner on the button
      const pullBtn = document.querySelector('.btn-pull');
      const pushBtn = document.querySelector('.btn-push');
      // Actually, let's just use the 'syncing' state we already have
    };

    setNotification({ type: 'success', message: 'Pushing workspace data...' });
    try {
      const result = await window.api.syncPush(config, passphrase);
      if (result.success) {
        const now = new Date().toISOString();
        await window.api.settingsSet('sync_last_at', now);
        setLastSync(now);
        await fetchSyncStats();
        setNotification({ type: 'success', message: 'Data pushed successfully!' });
      } else {
        setNotification({ type: 'error', message: "Push failed: " + result.message });
      }
    } catch (err: any) {
      setNotification({ type: 'error', message: "Error: " + err.message });
    }
  };

  const handleExecutePull = async (config: any, passphrase: string) => {
    setNotification({ type: 'success', message: 'Pulling and merging data...' });
    try {
      const result = await window.api.syncPull(config, passphrase);
      if (result.success) {
        setNotification({ type: 'success', message: 'Data pulled and merged successfully!' });
        fetchServers();
        fetchSettings();
        await fetchSyncStats();
      } else {
        setNotification({ type: 'error', message: "Pull failed: " + result.message });
      }
    } catch (err: any) {
      setNotification({ type: 'error', message: "Error: " + err.message });
    }
  };

  const handleConnectGDrive = async () => {
    try {
      if (!gdriveConfig.client_id || !gdriveConfig.client_secret) {
        setShowGDriveModal(true);
        return;
      }

      setNotification({ type: 'success', message: 'Opening browser for Google authorization...' });
      const success = await window.api.syncConnectGDrive();
      if (success) {
        const acc = await window.api.syncGetGDriveAccount();
        setGdriveAccount(acc);
        setSyncProvider('gdrive');
        await window.api.settingsSet('sync_provider', 'gdrive');
        setNotification({ type: 'success', message: 'Google Drive connected successfully!' });
      }
    } catch (err: any) {
      setNotification({ type: 'error', message: err.message });
    }
  };

  const handleSaveGDriveConfig = async () => {
    await window.api.settingsSet('sync_gdrive_client_id', gdriveConfig.client_id);
    await window.api.settingsSet('sync_gdrive_client_secret', gdriveConfig.client_secret);
    setShowGDriveModal(false);
    handleConnectGDrive();
  };

  const switchProvider = async (provider: 'sftp' | 'gdrive') => {
    setSyncProvider(provider);
    await window.api.settingsSet('sync_provider', provider);
    setNotification({ type: 'success', message: `Sync provider switched to ${provider.toUpperCase()}` });
  };

  const handlePush = async () => {
    const config = await window.api.settingsGet('sync_sftp_config');
    if (!config) {
      toggleSyncModal(true);
      return;
    }
    setPassphraseAction('push');
    setShowPassphrasePrompt(true);
  };

  const handlePull = async () => {
    const config = await window.api.settingsGet('sync_sftp_config');
    if (!config) {
      toggleSyncModal(true);
      return;
    }
    setPassphraseAction('pull');
    setShowPassphrasePrompt(true);
  };

  const tabs: { id: SettingsTab; label: string; icon: any }[] = [
    { id: 'sync', label: 'Synchronization', icon: RefreshCw },
    { id: 'appearance', label: 'Appearance', icon: Palette },
    { id: 'general', label: 'General', icon: Globe },
    { id: 'about', label: 'About', icon: Info },
  ];

  return (
    <div className="terminal-container app-settings-view active">
      {/* Custom Passphrase Prompt Modal */}
      {showPassphrasePrompt && (
        <div className="modal-overlay" style={{ zIndex: 2000 }}>
          <div className="modal" style={{ width: '400px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
              <div style={{ background: 'var(--accent-color)', padding: '10px', borderRadius: '10px', color: 'white' }}>
                <Lock size={20} />
              </div>
              <h3 style={{ margin: 0 }}>
                {passphraseAction === 'pull' ? 'Pull & Merge Data' : 
                 passphraseAction === 'push' ? 'Push Workspace' : 'Enable Auto-Sync'}
              </h3>
            </div>
            
            <p style={{ fontSize: '0.9rem', opacity: 0.7, marginBottom: '20px' }}>
              {passphraseAction === 'pull' ? 'Enter your passphrase to decrypt and merge remote data.' : 
               passphraseAction === 'push' ? 'Enter your passphrase to encrypt and upload your workspace.' :
               'Enter your Sync Passphrase. It will be stored securely on this machine to allow automated background operations.'}
            </p>

            <div className="form-group">
              <label>Sync Passphrase</label>
              <input 
                type="password" 
                autoFocus
                value={promptPassphrase} 
                onChange={e => setPromptPassphrase(e.target.value)}
                placeholder="Enter passphrase"
                onKeyDown={e => e.key === 'Enter' && handleConfirmPassphrase()}
              />
            </div>

            <div className="modal-actions" style={{ marginTop: '24px' }}>
              <button className="btn btn-secondary" onClick={() => { setShowPassphrasePrompt(false); setPromptPassphrase(''); setPassphraseAction(null); }}>Cancel</button>
              <button className="btn btn-primary" onClick={handleConfirmPassphrase} disabled={!promptPassphrase.trim()}>
                {passphraseAction === 'pull' ? 'Confirm & Pull' : 
                 passphraseAction === 'push' ? 'Confirm & Push' : 'Confirm & Enable'}
              </button>
            </div>
          </div>
        </div>
      )}

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
          {notification.type && (
            <div className={`settings-info-box mb-16 animate-view-fade ${notification.type === 'error' ? 'error-box' : ''}`} 
                 style={{ 
                   background: notification.type === 'error' ? 'rgba(248, 81, 73, 0.1)' : 'rgba(46, 160, 67, 0.1)',
                   border: notification.type === 'error' ? '1px solid rgba(248, 81, 73, 0.2)' : '1px solid rgba(46, 160, 67, 0.2)',
                   color: notification.type === 'error' ? 'var(--danger-color)' : 'var(--success-color)'
                 }}>
              {notification.type === 'error' ? <AlertCircle size={16} /> : <RefreshCw size={16} className="animate-spin" />}
              <p>{notification.message}</p>
            </div>
          )}

          {activeTab === 'sync' && (
            <div className="sync-section-container animate-fade-in">
              <div className="settings-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h2 style={{ fontSize: '1.8rem', fontWeight: '800', letterSpacing: '-0.5px', marginBottom: '4px' }}>Synchronization</h2>
                  <p style={{ fontSize: '1rem', opacity: 0.7 }}>Securely sync your servers and configurations.</p>
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
                <div className="tutorial-section animate-view-fade">
                  <div className="card-header">
                    <div className="card-icon" style={{ background: 'var(--accent-color)', color: 'white' }}>
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
                        <h4>Secure Vault</h4>
                        <p>Configure SFTP or Google Drive to act as your secure storage vault.</p>
                      </div>
                    </div>
                    <div className="step-item">
                      <div className="step-number">2</div>
                      <div className="step-content">
                        <h4>Sync Passphrase</h4>
                        <p>AES-256-GCM encryption ensures your data is encrypted before leaving your machine.</p>
                      </div>
                    </div>
                    <div className="step-item">
                      <div className="step-number">3</div>
                      <div className="step-content">
                        <h4>Push & Merge</h4>
                        <p>Push your workspace and pull/merge it on any other device seamlessly.</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Auto Sync - Feature Row */}
              <div className="glass-card mb-16" style={{ padding: '16px 24px', flexDirection: 'row', alignItems: 'center', gap: '20px' }}>
                <div className={`card-icon ${isAutoSyncEnabled ? 'active-sync' : ''}`} style={{ width: '44px', height: '44px' }}>
                  <RefreshCw size={20} className={isAutoSyncEnabled ? 'animate-spin-slow' : ''} />
                </div>
                
                <div style={{ flex: 1 }}>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: '700', margin: 0 }}>Auto-Sync</h3>
                  <p style={{ fontSize: '0.8rem', opacity: 0.6, margin: 0 }}>
                    {isAutoSyncEnabled 
                      ? 'Background sync is active (Running every 15 minutes)' 
                      : 'Automatically synchronize your environment in the background.'
                    }
                  </p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', paddingLeft: '20px', borderLeft: '1px solid rgba(255,255,255,0.05)' }}>
                  <span style={{ fontSize: '0.7rem', fontWeight: '800', color: isAutoSyncEnabled ? 'var(--success-color)' : 'var(--text-secondary)' }}>
                    {isAutoSyncEnabled ? 'ON' : 'OFF'}
                  </span>
                  <label className="switch">
                    <input 
                      type="checkbox" 
                      checked={isAutoSyncEnabled} 
                      onChange={toggleAutoSync} 
                    />
                    <span className="slider round"></span>
                  </label>
                </div>
              </div>

              <div className="sync-options-grid">
                {/* SFTP Card */}
                <div className={`glass-card sync-card ${syncProvider === 'sftp' ? 'active-sync' : ''}`}>
                  <div>
                    <div className="card-header">
                      <div className="card-icon">
                        <Server size={24} />
                      </div>
                      <div className="card-content">
                        <h3>Self-Hosted SFTP</h3>
                        <p>Private infrastructure storage.</p>
                      </div>
                    </div>
                    
                    <div style={{ paddingLeft: '64px' }}>
                      <button 
                        className="btn btn-secondary btn-small" 
                        onClick={() => toggleSyncModal(true)}
                        style={{ background: 'rgba(255,255,255,0.05)' }}
                      >
                        Configuration
                      </button>
                    </div>
                  </div>

                  <div className="card-footer">
                    <div className={`status-pill ${(lastSync && syncProvider === 'sftp') ? 'online' : ''}`}>
                      <div className="status-line-dot"></div>
                      <span>
                        {syncProvider === 'sftp' && lastSync ? `Synced: ${new Date(lastSync).toLocaleTimeString()}` : 'Ready to Sync'}
                      </span>
                    </div>
                    <button 
                      className={`feature-badge ${syncProvider === 'sftp' ? 'active-sync' : ''}`}
                      onClick={() => switchProvider('sftp')}
                      style={{ border: 'none', background: syncProvider === 'sftp' ? 'rgba(88, 166, 255, 0.2)' : 'rgba(255,255,255,0.05)', color: syncProvider === 'sftp' ? 'var(--accent-color)' : 'var(--text-secondary)', cursor: 'pointer' }}
                    >
                      {syncProvider === 'sftp' ? 'ACTIVE' : 'SELECT'}
                    </button>
                  </div>
                </div>

                {/* Google Drive Card */}
                <div className={`glass-card sync-card provider-gdrive ${syncProvider === 'gdrive' ? 'active-sync' : ''}`}>
                  <div>
                    <div className="card-header">
                      <div className="card-icon">
                        <Cloud size={24} />
                      </div>
                      <div className="card-content">
                        <h3>Google Drive</h3>
                        <p>Cloud sync via AppData Folder.</p>
                      </div>
                    </div>
                    
                    <div style={{ paddingLeft: '64px', display: 'flex', gap: '8px' }}>
                      <button 
                        className="btn btn-gdrive btn-small" 
                        onClick={handleConnectGDrive}
                      >
                       {gdriveAccount.status === 'Connected' ? 'Reconnect' : 'Connect Account'}
                      </button>
                      <button className="icon-btn" onClick={() => setShowGDriveModal(true)} title="Cloud Auth Config">
                        <Lock size={12} />
                      </button>
                    </div>
                  </div>

                  <div className="card-footer">
                    <div className={`status-pill ${gdriveAccount.status === 'Connected' ? 'online' : ''}`}>
                      <div className="status-line-dot"></div>
                      <span>
                        {gdriveAccount.status === 'Connected' ? gdriveAccount.email : 'Not Authorized'}
                      </span>
                    </div>
                    <button 
                      className={`feature-badge ${syncProvider === 'gdrive' ? 'active-sync' : ''}`}
                      onClick={() => gdriveAccount.status === 'Connected' && switchProvider('gdrive')}
                      style={{ border: 'none', background: syncProvider === 'gdrive' ? 'rgba(46, 160, 67, 0.2)' : 'rgba(255,255,255,0.05)', color: syncProvider === 'gdrive' ? 'var(--success-color)' : 'var(--text-secondary)', cursor: 'pointer' }}
                    >
                      {syncProvider === 'gdrive' ? 'ACTIVE' : 'SELECT'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Action Bar */}
              <div className="sync-action-bar">
                <div className="action-stats">
                  <div className="card-icon" style={{ background: 'rgba(255,255,255,0.03)', width: '40px', height: '40px' }}>
                    <Shield size={20} className={syncing ? 'animate-spin' : ''} />
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Payload Health</span>
                    <span className="stat-value">{fileSize !== null ? formatSize(fileSize) : 'Analyzing...'}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Encryption</span>
                    <span className="stat-value" style={{ color: 'var(--accent-color)' }}>AES-256-GCM</span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '12px' }}>
                  <button className="btn btn-secondary" onClick={handlePull} disabled={!!syncing}>
                    <RefreshCw size={14} className={syncing === 'pull' ? 'animate-spin' : ''} style={{ marginRight: '8px' }} />
                    Pull & Merge
                  </button>
                  <button className="btn btn-primary" onClick={handlePush} disabled={!!syncing}>
                    <RefreshCw size={14} className={syncing === 'push' ? 'animate-spin' : ''} style={{ marginRight: '8px' }} />
                    Push Workspace
                  </button>
                </div>
              </div>

              <div className="settings-footer-privacy">
                <Shield size={14} color="var(--accent-color)" />
                <span>
                  <strong>Privacy First:</strong> Your server list and settings are encrypted locally. We never see your raw data.
                </span>
              </div>
              {/* Google Drive Config Modal */}
              {showGDriveModal && (
                <div className="modal-overlay" style={{ zIndex: 2000 }}>
                  <div className="modal" style={{ width: '500px' }}>
                    <div className="card-header">
                      <div className="card-icon" style={{ background: '#34a853', color: 'white' }}>
                        <Lock size={20} />
                      </div>
                      <h3 style={{ margin: 0 }}>Google Cloud Credentials</h3>
                    </div>

                    <div className="info-box mb-16" style={{ background: 'rgba(52, 168, 83, 0.05)', border: '1px solid rgba(52, 168, 83, 0.1)', color: '#34a853' }}>
                      <Info size={16} />
                      <p style={{ fontSize: '0.8rem' }}>
                        Configure Redirect URI: <code>http://localhost:42856</code>
                      </p>
                    </div>

                    <div className="form-group">
                      <label>Client ID</label>
                      <input 
                        type="text" 
                        value={gdriveConfig.client_id} 
                        onChange={e => setGdriveConfig({ ...gdriveConfig, client_id: e.target.value })}
                        placeholder="Paste Client ID"
                      />
                    </div>

                    <div className="form-group">
                      <label>Client Secret</label>
                      <input 
                        type="password" 
                        value={gdriveConfig.client_secret} 
                        onChange={e => setGdriveConfig({ ...gdriveConfig, client_secret: e.target.value })}
                        placeholder="Paste Client Secret"
                      />
                    </div>

                    <div className="modal-actions">
                      <button className="btn btn-secondary" onClick={() => setShowGDriveModal(false)}>Cancel</button>
                      <button className="btn btn-primary" style={{ background: '#34a853', borderColor: '#34a853' }} onClick={handleSaveGDriveConfig} disabled={!gdriveConfig.client_id || !gdriveConfig.client_secret}>
                        Save & Connect
                      </button>
                    </div>
                  </div>
                </div>
              )}
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
