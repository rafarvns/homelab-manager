import { useState, useEffect } from 'react';
import { Shield, Lock, AlertCircle, RefreshCw } from 'lucide-react';
import { useAppStore } from '../store';

const SyncConfigModal = () => {
  const { toggleSyncModal } = useAppStore();
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error' | null; message: string }>({ type: null, message: '' });

  const [formData, setFormData] = useState({
    host: '',
    port: 22,
    username: '',
    auth_type: 'password' as 'password' | 'key',
    password: '',
    private_key_path: '',
    remote_path: '.homelab_manager_sync.enc',
    sync_passphrase: ''
  });

  useEffect(() => {
    // Load existing config
    window.api.settingsGet('sync_sftp_config').then(config => {
      if (config) {
        setFormData(prev => ({ ...prev, ...config, sync_passphrase: '' }));
      }
    });
  }, []);

  const handleSelectFile = async () => {
    const filePath = await window.api.dialogOpenFile();
    if (filePath) {
      setFormData({ ...formData, private_key_path: filePath });
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setStatus({ type: null, message: '' });
    try {
      const result = await window.api.syncTestConnection(formData);
      if (result.success) {
        setStatus({ type: 'success', message: 'Connection established successfully!' });
      } else {
        setStatus({ type: 'error', message: result.message });
      }
    } catch (err: any) {
      setStatus({ type: 'error', message: err.message });
    } finally {
      setTesting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.sync_passphrase && !formData.host) return; // Basic validation
    
    setLoading(true);
    try {
      // Save config (passphrase is NEVER saved to DB settings for security)
      const { sync_passphrase, ...configToSave } = formData;
      await window.api.settingsSet('sync_sftp_config', configToSave);
      
      // If we have a passphrase, we can immediately try a "Push" to verify
      const result = await window.api.syncPush(formData, formData.sync_passphrase);
      if (result.success) {
        await window.api.settingsSet('sync_last_at', new Date().toISOString());
        toggleSyncModal(false);
      } else {
        setStatus({ type: 'error', message: `Config matched but first sync failed: ${result.message}` });
      }
    } catch (err: any) {
      setStatus({ type: 'error', message: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ width: '500px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
          <div style={{ background: 'var(--accent-color)', padding: '8px', borderRadius: '8px', color: 'white' }}>
            <RefreshCw size={24} />
          </div>
          <div>
            <h2 style={{ marginBottom: '0' }}>File Server Sync</h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Configure SFTP storage for your data.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="settings-info-box mb-16">
            <Shield size={16} />
            <p>Credentials are stored securely using <strong>safeStorage</strong>.</p>
          </div>

          <div className="row">
            <div className="form-group" style={{ flex: 3 }}>
              <label>SFTP Host</label>
              <input 
                required 
                value={formData.host} 
                onChange={e => setFormData({...formData, host: e.target.value})} 
                placeholder="sftp.example.com"
              />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label>Port</label>
              <input 
                type="number" 
                required 
                value={formData.port} 
                onChange={e => setFormData({...formData, port: parseInt(e.target.value)})} 
              />
            </div>
          </div>

          <div className="form-group">
            <label>Username</label>
            <input 
              required 
              value={formData.username} 
              onChange={e => setFormData({...formData, username: e.target.value})} 
            />
          </div>

          <div className="row">
            <div className="form-group">
              <label>Auth Type</label>
              <select 
                value={formData.auth_type} 
                onChange={e => setFormData({...formData, auth_type: e.target.value as any})}
              >
                <option value="password">Password</option>
                <option value="key">Private Key</option>
              </select>
            </div>
            <div className="form-group" style={{ flex: 2 }}>
              {formData.auth_type === 'password' ? (
                <>
                  <label>Password</label>
                  <input 
                    type="password" 
                    required 
                    value={formData.password} 
                    onChange={e => setFormData({...formData, password: e.target.value})} 
                  />
                </>
              ) : (
                <>
                  <label>Private Key</label>
                  <button type="button" className="btn btn-secondary w-full" onClick={handleSelectFile}>
                    {formData.private_key_path ? 'Change Key...' : 'Select Key File...'}
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="form-group">
            <label>Remote File Path</label>
            <input 
              required 
              value={formData.remote_path} 
              onChange={e => setFormData({...formData, remote_path: e.target.value})} 
              placeholder="e.g. .homelab_sync.enc"
            />
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid var(--panel-border)', margin: '20px 0' }} />

          <div className="form-group">
            <label style={{ color: 'var(--accent-color)', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Lock size={14} />
              Sync Passphrase (REQUIRED)
            </label>
            <input 
              type="password" 
              required 
              value={formData.sync_passphrase} 
              onChange={e => setFormData({...formData, sync_passphrase: e.target.value})} 
              placeholder="Your cross-machine master key"
            />
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
              This password encrypts your sync data. You'll need it on other devices.
            </p>
          </div>

          {status.type && (
            <div className={`settings-info-box mt-16 ${status.type === 'error' ? 'error-box' : ''}`} 
                 style={{ 
                   background: status.type === 'error' ? 'rgba(248, 81, 73, 0.1)' : 'rgba(46, 160, 67, 0.1)',
                   border: status.type === 'error' ? '1px solid rgba(248, 81, 73, 0.2)' : '1px solid rgba(46, 160, 67, 0.2)',
                   color: status.type === 'error' ? 'var(--danger-color)' : 'var(--success-color)'
                 }}>
              {status.type === 'error' ? <AlertCircle size={16} /> : <RefreshCw size={16} />}
              <p>{status.message}</p>
            </div>
          )}

          <div className="modal-actions" style={{ marginTop: '24px' }}>
            <button type="button" className="btn btn-secondary" onClick={() => toggleSyncModal(false)}>Cancel</button>
            <button type="button" className="btn btn-secondary" onClick={handleTest} disabled={testing || !formData.host}>
              {testing ? 'Testing...' : 'Test Connection'}
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading || !formData.sync_passphrase}>
              {loading ? 'Saving & Syncing...' : 'Save & Push'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SyncConfigModal;
