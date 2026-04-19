import { Client } from 'ssh2';
import * as fs from 'fs';
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
      const db = getDb();
      const servers = db.prepare('SELECT * FROM servers').all() as any[];
      const settings = db.prepare('SELECT key, value FROM settings').all() as any[];

      // Decrypt sensitive fields before packing
      const decryptedServers = servers.map(s => ({
        ...s,
        password: decryptLocal(s.password),
        passphrase: decryptLocal(s.passphrase),
        private_key_path: decryptLocal(s.private_key_path)
      }));

      const payload = JSON.stringify({
        version: '1.0',
        timestamp: Date.now(),
        servers: decryptedServers,
        settings: settings.filter(s => !s.key.startsWith('sync_')) // Don't sync sync-credentials
      });

      // 2. Encrypt with Sync Passphrase
      const encryptedBuffer = encryptSyncPayload(payload, passphrase);

      // 3. Upload via SFTP
      await this.uploadBuffer(config, encryptedBuffer);

      return { success: true, message: 'Sync pushed successfully' };
    } catch (err: any) {
      console.error('[Sync Push Error]:', err);
      return { success: false, message: err.message };
    }
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
      return { success: false, message: err.message };
    }
  }

  private static uploadBuffer(config: SyncConfig, buffer: Buffer): Promise<void> {
    return new Promise((resolve, reject) => {
      const conn = new Client();
      conn.on('ready', () => {
        conn.sftp((err, sftp) => {
          if (err) return reject(err);
          const writeStream = sftp.createWriteStream(config.remote_path);
          writeStream.on('close', () => {
            conn.end();
            resolve();
          }).on('error', (err) => {
            conn.end();
            reject(err);
          });
          writeStream.end(buffer);
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
