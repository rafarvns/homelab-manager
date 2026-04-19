import { safeStorage, webContents } from 'electron';
import { getDb } from '../db/database';
import { decrypt as decryptLocal, encrypt as encryptLocal } from '../db/security';
import { encryptSyncPayload, decryptSyncPayload } from '../db/security.sync';
import { SFTPProvider } from './providers/sftp.provider';
import { GoogleDriveProvider } from './providers/gdrive.provider';
import { SyncProvider, SyncConfig } from './provider.types';
import { GDriveAuth } from './gdrive-auth';

export class SyncService {
  private static autoSyncInterval: NodeJS.Timeout | null = null;
  private static isSyncing = false;

  static async getProvider(config?: SyncConfig): Promise<SyncProvider> {
    const db = getDb();
    const activeProvider = config?.provider || 
      (db.prepare("SELECT value FROM settings WHERE key = 'sync_provider'").get() as { value: string } | undefined)?.value || 
      'sftp';

    if (activeProvider === 'gdrive') {
      return new GoogleDriveProvider();
    }

    // Default to SFTP if config not provided, load from settings
    let sftpConfig = config;
    if (!sftpConfig) {
      const row = db.prepare("SELECT value FROM settings WHERE key = 'sync_sftp_config'").get() as { value: string } | undefined;
      if (row) sftpConfig = JSON.parse(row.value);
    }

    if (!sftpConfig) throw new Error('SFTP configuration not found');
    
    // Decrypt credentials for the connection
    const processedConfig = { ...sftpConfig };
    if (processedConfig.password) processedConfig.password = decryptLocal(processedConfig.password)!;
    if (processedConfig.private_key_path) processedConfig.private_key_path = decryptLocal(processedConfig.private_key_path)!;

    return new SFTPProvider(processedConfig);
  }

  /**
   * Starts the background auto-sync loop (Pull every 15 minutes)
   */
  static startAutoSyncLoop() {
    if (this.autoSyncInterval) clearInterval(this.autoSyncInterval);

    // Initial check after 30 seconds to allow app boot
    setTimeout(() => this.runAutoPull(), 30000);

    // Every 15 minutes
    this.autoSyncInterval = setInterval(() => {
      this.runAutoPull();
    }, 15 * 60 * 1000);

    console.log('[AutoSync] Loop started (15min interval)');
  }

  static async runAutoPull() {
    if (this.isSyncing) return;
    
    const db = getDb();
    const autoEnabled = db.prepare("SELECT value FROM settings WHERE key = 'sync_auto_enabled'").get() as { value: string } | undefined;
    if (autoEnabled?.value !== 'true') return;

    const passphrase = await this.getSecurePassphrase();
    if (!passphrase) return;

    console.log('[AutoSync] Running background pull...');
    this.isSyncing = true;
    try {
      const provider = await this.getProvider();
      const result = await this.pull(provider, passphrase);
      if (result.success) {
        console.log('[AutoSync] Pull successful. Notifying renderer.');
        this.notifyDataChanged();
      }
    } catch (err) {
      console.error('[AutoSync] Background pull failed:', err);
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Triggers an immediate push if auto-sync is enabled
   */
  static async triggerAutoPush() {
    const db = getDb();
    const autoEnabled = db.prepare("SELECT value FROM settings WHERE key = 'sync_auto_enabled'").get() as { value: string } | undefined;
    if (autoEnabled?.value !== 'true') return;

    const passphrase = await this.getSecurePassphrase();
    if (!passphrase) return;

    console.log('[AutoSync] Triggering auto-push...');
    try {
      const provider = await this.getProvider();
      await this.push(provider, passphrase);
    } catch (err) {
      console.error('[AutoSync] Auto-push failed:', err);
    }
  }

  private static notifyDataChanged() {
    webContents.getAllWebContents().forEach(wc => {
      wc.send('sync:data-updated');
    });
  }

  /**
   * Secure Passphrase Management
   */
  static async setSecurePassphrase(passphrase: string | null) {
    const db = getDb();
    if (!passphrase) {
      db.prepare("DELETE FROM settings WHERE key = 'sync_passphrase_secure'").run();
      return;
    }

    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error('Encryption is not available on this system.');
    }

    const encrypted = safeStorage.encryptString(passphrase);
    db.prepare(`
      INSERT INTO settings (key, value) VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
    `).run('sync_passphrase_secure', encrypted.toString('base64'));
  }

  private static async getSecurePassphrase(): Promise<string | null> {
    const db = getDb();
    const row = db.prepare("SELECT value FROM settings WHERE key = 'sync_passphrase_secure'").get() as { value: string } | undefined;
    if (!row) return null;

    if (!safeStorage.isEncryptionAvailable()) return null;

    try {
      const buffer = Buffer.from(row.value, 'base64');
      return safeStorage.decryptString(buffer);
    } catch (e) {
      return null;
    }
  }

  /**
   * Tests the connection with provided config
   */
  static async testConnection(config: SyncConfig): Promise<{ success: boolean; message: string }> {
    try {
      const provider = await this.getProvider(config);
      return await provider.test();
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  }

  /**
   * OAuth logic
   */
  static async connectGDrive() {
    return await GDriveAuth.authorize();
  }

  static async getGDriveAccount() {
    const provider = new GoogleDriveProvider();
    return await provider.getAccountInfo();
  }

  /**
   * Pushes local database data to the remote server
   */
  static async push(provider_or_config: SyncProvider | SyncConfig, passphrase: string): Promise<{ success: boolean; message: string }> {
    try {
      let provider: SyncProvider;
      if ('upload' in provider_or_config) {
        provider = provider_or_config;
      } else {
        provider = await this.getProvider(provider_or_config);
      }

      // 1. Export Data
      const payload = await this.getPayload(passphrase);

      // 3. Upload
      await provider.upload(payload);

      return { success: true, message: 'Sync pushed successfully' };
    } catch (err: any) {
      console.error('[Sync Push Error]:', err);
      return { success: false, message: err.message };
    }
  }

  /**
   * Pulls data from remote server and merges into local database
   */
  static async pull(provider_or_config: SyncProvider | SyncConfig, passphrase: string): Promise<{ success: boolean; message: string }> {
    try {
      let provider: SyncProvider;
      if ('download' in provider_or_config) {
        provider = provider_or_config;
      } else {
        provider = await this.getProvider(provider_or_config);
      }

      // 1. Download
      const buffer = await provider.download();

      // 2. Decrypt
      const jsonString = decryptSyncPayload(buffer, passphrase);
      const data = JSON.parse(jsonString);

      // 3. Merge into local DB
      const db = getDb();
      
      const mergeTransaction = db.transaction(() => {
        // Servers Merge Strategy: Based on name + host
        for (const s of data.servers) {
          const existing = db.prepare('SELECT id FROM servers WHERE name = ? AND host = ?').get(s.name, s.host) as { id: number } | undefined;
          
          const payload = {
            name: s.name,
            host: s.host,
            port: s.port,
            username: s.username,
            auth_type: s.auth_type,
            password: encryptLocal(s.password),
            private_key_path: encryptLocal(s.private_key_path),
            passphrase: encryptLocal(s.passphrase),
            icon: s.icon,
            sort_order: s.sort_order,
            group_name: s.group_name,
            tags: s.tags,
            notes: s.notes
          };

          if (existing) {
            db.prepare(`
              UPDATE servers SET 
                port = @port, username = @username, auth_type = @auth_type, 
                password = @password, private_key_path = @private_key_path,
                passphrase = @passphrase, icon = @icon, sort_order = @sort_order,
                group_name = @group_name, tags = @tags, notes = @notes,
                updated_at = CURRENT_TIMESTAMP
              WHERE id = @id
            `).run({ ...payload, id: existing.id });
          } else {
            db.prepare(`
              INSERT INTO servers (name, host, port, username, auth_type, password, private_key_path, passphrase, icon, sort_order, group_name, tags, notes)
              VALUES (@name, @host, @port, @username, @auth_type, @password, @private_key_path, @passphrase, @icon, @sort_order, @group_name, @tags, @notes)
            `).run(payload);
          }
        }

        // Settings Merge
        for (const set of data.settings) {
          db.prepare(`
            INSERT INTO settings (key, value) VALUES (?, ?)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
          `).run(set.key, set.value);
        }
      });

      mergeTransaction();

      return { success: true, message: 'Sync pulled and merged successfully' };
    } catch (err: any) {
      console.error('[Sync Pull Error]:', err);
      return { success: false, message: err.message };
    }
  }

  /**
   * Generates the encrypted sync payload
   */
  private static async getPayload(passphrase: string): Promise<Buffer> {
    const db = getDb();
    const servers = db.prepare('SELECT * FROM servers ORDER BY sort_order ASC').all() as any[];
    const settings = db.prepare('SELECT key, value FROM settings').all() as any[];

    // Decrypt sensitive fields before packing
    const decryptedServers = servers.map(s => ({
      ...s,
      password: decryptLocal(s.password),
      passphrase: decryptLocal(s.passphrase),
      private_key_path: decryptLocal(s.private_key_path)
    }));

    const data = JSON.stringify({
      version: '1.0',
      timestamp: Date.now(),
      servers: decryptedServers,
      settings: settings.filter(s => !s.key.startsWith('sync_') && s.key !== 'window_state')
    });

    return encryptSyncPayload(data, passphrase);
  }

  /**
   * Gets statistics about the local sync payload
   */
  static async getSyncLocalStats(): Promise<{ size: number }> {
    const passphrase = await this.getSecurePassphrase();
    if (!passphrase) {
       const dummy = await this.getPayload("est-size-only");
       return { size: dummy.length };
    }
    const payload = await this.getPayload(passphrase);
    return { size: payload.length };
  }
}
