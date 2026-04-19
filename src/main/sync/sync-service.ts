import { Client } from 'ssh2';
import * as fs from 'fs';
import { safeStorage, webContents } from 'electron';
import { getDb } from '../db/database';
import { decrypt as decryptLocal, encrypt as encryptLocal } from '../db/security';
import { encryptSyncPayload, decryptSyncPayload } from '../db/security.sync';

export interface SyncConfig {
  host: string;
  port: number;
  username: string;
  auth_type: 'password' | 'key';
  password?: string;
  private_key_path?: string;
  remote_path: string;
}

export class SyncService {
  private static autoSyncInterval: NodeJS.Timeout | null = null;
  private static isSyncing = false;

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

    const configRow = db.prepare("SELECT value FROM settings WHERE key = 'sync_sftp_config'").get() as { value: string } | undefined;
    if (!configRow) return;

    const passphrase = await this.getSecurePassphrase();
    if (!passphrase) return;

    const config = JSON.parse(configRow.value) as SyncConfig;
    
    // Decrypt credentials for the connection
    if (config.password) config.password = decryptLocal(config.password)!;
    if (config.private_key_path) config.private_key_path = decryptLocal(config.private_key_path)!;

    console.log('[AutoSync] Running background pull...');
    this.isSyncing = true;
    try {
      const result = await this.pull(config, passphrase);
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

    const configRow = db.prepare("SELECT value FROM settings WHERE key = 'sync_sftp_config'").get() as { value: string } | undefined;
    if (!configRow) return;

    const passphrase = await this.getSecurePassphrase();
    if (!passphrase) return;

    const config = JSON.parse(configRow.value) as SyncConfig;
    if (config.password) config.password = decryptLocal(config.password)!;
    if (config.private_key_path) config.private_key_path = decryptLocal(config.private_key_path)!;

    console.log('[AutoSync] Triggering auto-push...');
    try {
      await this.push(config, passphrase);
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
   * Tests the SFTP connection with provided config
   */
  static async testConnection(config: SyncConfig): Promise<{ success: boolean; message: string }> {
    return new Promise((resolve) => {
      const conn = new Client();
      conn.on('ready', () => {
        conn.sftp((err) => {
          if (err) {
            resolve({ success: false, message: `SFTP Error: ${err.message}` });
          } else {
            resolve({ success: true, message: 'Connection successful' });
          }
          conn.end();
        });
      }).on('error', (err) => {
        resolve({ success: false, message: `Connection failed: ${err.message}` });
      }).connect({
        host: config.host,
        port: config.port,
        username: config.username,
        password: config.auth_type === 'password' ? config.password : undefined,
        privateKey: config.auth_type === 'key' && config.private_key_path ? fs.readFileSync(config.private_key_path) : undefined
      });
    });
  }

  /**
   * Pushes local database data to the remote server
   */
  static async push(config: SyncConfig, passphrase: string): Promise<{ success: boolean; message: string }> {
    try {
      // 1. Export Data
      const payload = await this.getPayload(passphrase);

      // 3. Upload via SFTP
      await this.uploadBuffer(config, payload);

      return { success: true, message: 'Sync pushed successfully' };
    } catch (err: any) {
      console.error('[Sync Push Error]:', err);
      let message = err.message;
      
      if (message.includes('Permission denied') || err.code === 3) {
        message = 'Permission denied. Ensure the path starts with a writable subdirectory (like "upload/") and the NAS folder has correct permissions.';
      } else if (message.includes('No such file') || err.code === 2) {
        message = `No such file. Ensure the folder in your path exists or is writable. Path: "${config.remote_path}"`;
      }
      
      return { success: false, message };
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
       // Estimate with dummy passphrase if unknown, to show user something
       const dummy = await this.getPayload("est-size-only");
       return { size: dummy.length };
    }
    const payload = await this.getPayload(passphrase);
    return { size: payload.length };
  }

  /**
   * Pulls data from remote server and merges into local database
   */
  static async pull(config: SyncConfig, passphrase: string): Promise<{ success: boolean; message: string }> {
    try {
      // 1. Download
      const buffer = await this.downloadBuffer(config);

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
      let message = err.message;
      if (message.includes('No such file') || err.code === 2) {
        message = 'No remote sync file found. Did you push from another device first?';
      }
      return { success: false, message };
    }
  }

  private static uploadBuffer(config: SyncConfig, buffer: Buffer): Promise<void> {
    return new Promise((resolve, reject) => {
      const conn = new Client();
      conn.on('ready', () => {
        conn.sftp(async (err, sftp) => {
          if (err) return reject(err);
          
          try {
            // Try to ensure directory structure exists
            const lastSlash = config.remote_path.lastIndexOf('/');
            if (lastSlash !== -1) {
              const dir = config.remote_path.substring(0, lastSlash);
              await this.ensureRemoteDir(sftp, dir);
            }

            const writeStream = sftp.createWriteStream(config.remote_path);
            writeStream.on('close', () => {
              conn.end();
              resolve();
            }).on('error', (err) => {
              conn.end();
              reject(err);
            });
            writeStream.end(buffer);
          } catch (error) {
            conn.end();
            reject(error);
          }
        });
      }).on('error', reject).connect({
        host: config.host,
        port: config.port,
        username: config.username,
        password: config.auth_type === 'password' ? config.password : undefined,
        privateKey: config.auth_type === 'key' && config.private_key_path ? fs.readFileSync(config.private_key_path) : undefined
      });
    });
  }

  /**
   * Recursively ensures that a remote directory exists
   */
  private static async ensureRemoteDir(sftp: any, path: string): Promise<void> {
    const parts = path.split('/').filter(p => !!p);
    let current = path.startsWith('/') ? '/' : '';
    
    for (const part of parts) {
      current += (current === '/' || current === '' ? '' : '/') + part;
      await new Promise<void>((resolve) => {
        sftp.mkdir(current, (err: any) => {
          // Failure (Code 4) usually means it already exists, so we just move on
          resolve();
        });
      });
    }
  }

  private static downloadBuffer(config: SyncConfig): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const conn = new Client();
      conn.on('ready', () => {
        conn.sftp((err, sftp) => {
          if (err) return reject(err);
          const readStream = sftp.createReadStream(config.remote_path);
          const chunks: Buffer[] = [];
          readStream.on('data', (chunk: Buffer) => chunks.push(chunk));
          readStream.on('close', () => {
            conn.end();
            resolve(Buffer.concat(chunks));
          }).on('error', (err) => {
            conn.end();
            reject(err);
          });
        });
      }).on('error', reject).connect({
        host: config.host,
        port: config.port,
        username: config.username,
        password: config.auth_type === 'password' ? config.password : undefined,
        privateKey: config.auth_type === 'key' && config.private_key_path ? fs.readFileSync(config.private_key_path) : undefined
      });
    });
  }
}
