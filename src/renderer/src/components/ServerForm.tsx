import { useState, useEffect } from 'react'
export interface ServerInput {
  name: string;
  host: string;
  port: number;
  username: string;
  auth_type: 'password' | 'key';
  password?: string;
  private_key_path?: string;
  passphrase?: string;
}
import { useAppStore } from '../store'

export default function ServerForm() {
  const { closeAddModal, fetchServers, editingServer } = useAppStore()
  
  const [formData, setFormData] = useState<ServerInput>({
    name: editingServer?.name || '',
    host: editingServer?.host || '',
    port: editingServer?.port || 22,
    username: editingServer?.username || '',
    auth_type: editingServer?.auth_type || 'password',
    password: editingServer?.password || '',
    private_key_path: editingServer?.private_key_path || '',
    passphrase: editingServer?.passphrase || ''
  })

  useEffect(() => {
    if (editingServer) {
      setFormData({
        name: editingServer.name,
        host: editingServer.host,
        port: editingServer.port,
        username: editingServer.username,
        auth_type: editingServer.auth_type,
        password: editingServer.password || '',
        private_key_path: editingServer.private_key_path || '',
        passphrase: editingServer.passphrase || ''
      })
    }
  }, [editingServer])

  // To support updating file input nicely
  const handleSelectFile = async () => {
    const filePath = await window.api.dialogOpenFile()
    if (filePath) {
      setFormData({ ...formData, private_key_path: filePath })
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (formData.auth_type === 'key' && !formData.private_key_path) {
      alert("Please select a Private Key file for SSH Key Authentication!");
      return;
    }

    try {
      if (editingServer) {
        await window.api.serverUpdate(editingServer.id, formData)
      } else {
        await window.api.serverCreate(formData)
      }
      await fetchServers()
      closeAddModal()
    } catch (err) {
      console.error(err)
      alert("Failed to save server")
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal">
        <h2>{editingServer ? 'Edit Server' : 'Add Server'}</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Name</label>
            <input 
              required 
              value={formData.name} 
              onChange={e => setFormData({...formData, name: e.target.value})} 
              placeholder="e.g. Prod DB, NAS Home..."
            />
          </div>
          
          <div className="row">
            <div className="form-group" style={{ flex: 2 }}>
              <label>Host/IP</label>
              <input 
                required 
                value={formData.host} 
                onChange={e => setFormData({...formData, host: e.target.value})} 
                placeholder="192.168.1.100"
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
              placeholder="root, admin, etc."
            />
          </div>

          <div className="form-group">
            <label>Authentication Type</label>
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
                required 
                value={formData.password} 
                onChange={e => setFormData({...formData, password: e.target.value})} 
              />
            </div>
          ) : (
            <>
              <div className="form-group">
                <label>Private Key Path</label>
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={handleSelectFile}
                  style={{ width: '100%', display: 'flex', justifyContent: 'center' }}
                >
                  Browse for Key File...
                </button>
                {formData.private_key_path ? (
                  <div style={{ fontSize: '0.85rem', marginTop: 8, padding: 8, background: 'rgba(255,255,255,0.05)', borderRadius: 4, color: 'var(--text-secondary)' }}>
                    ✅ Selected:<br/>
                    <strong style={{ color: 'var(--text-primary)' }}>{formData.private_key_path}</strong>
                  </div>
                ) : (
                  <div style={{ fontSize: '0.85rem', marginTop: 8, color: 'var(--danger-color)' }}>
                    ❌ You must select a key file.
                  </div>
                )}
              </div>
              <div className="form-group">
                <label>Passphrase (Optional)</label>
                <input 
                  type="password" 
                  value={formData.passphrase} 
                  onChange={e => setFormData({...formData, passphrase: e.target.value})} 
                />
              </div>
            </>
          )}

          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={closeAddModal}>Cancel</button>
            <button type="submit" className="btn btn-primary">Save Server</button>
          </div>
        </form>
      </div>
    </div>
  )
}
