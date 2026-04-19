import { Client } from 'ssh2';
import * as fs from 'fs';
import { SyncProvider, SyncConfig } from '../provider.types';

export class SFTPProvider implements SyncProvider {
  constructor(private config: SyncConfig) {}

  async test(): Promise<{ success: boolean; message: string }> {
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
        host: this.config.host,
        port: this.config.port,
        username: this.config.username,
        password: this.config.auth_type === 'password' ? this.config.password : undefined,
        privateKey: this.config.auth_type === 'key' && this.config.private_key_path ? fs.readFileSync(this.config.private_key_path) : undefined
      });
    });
  }

  async upload(buffer: Buffer): Promise<void> {
    return new Promise((resolve, reject) => {
      const conn = new Client();
      conn.on('ready', () => {
        conn.sftp(async (err, sftp) => {
          if (err) return reject(err);
          
          try {
            const remotePath = this.config.remote_path!;
            // Try to ensure directory structure exists
            const lastSlash = remotePath.lastIndexOf('/');
            if (lastSlash !== -1) {
              const dir = remotePath.substring(0, lastSlash);
              await this.ensureRemoteDir(sftp, dir);
            }

            const writeStream = sftp.createWriteStream(remotePath);
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
        host: this.config.host,
        port: this.config.port,
        username: this.config.username,
        password: this.config.auth_type === 'password' ? this.config.password : undefined,
        privateKey: this.config.auth_type === 'key' && this.config.private_key_path ? fs.readFileSync(this.config.private_key_path) : undefined
      });
    });
  }

  async download(): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const conn = new Client();
      conn.on('ready', () => {
        conn.sftp((err, sftp) => {
          if (err) return reject(err);
          const readStream = sftp.createReadStream(this.config.remote_path!);
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
        host: this.config.host,
        port: this.config.port,
        username: this.config.username,
        password: this.config.auth_type === 'password' ? this.config.password : undefined,
        privateKey: this.config.auth_type === 'key' && this.config.private_key_path ? fs.readFileSync(this.config.private_key_path) : undefined
      });
    });
  }

  private async ensureRemoteDir(sftp: any, path: string): Promise<void> {
    const parts = path.split('/').filter(p => !!p);
    let current = path.startsWith('/') ? '/' : '';
    
    for (const part of parts) {
      current += (current === '/' || current === '' ? '' : '/') + part;
      await new Promise<void>((resolve) => {
        sftp.mkdir(current, () => {
          resolve();
        });
      });
    }
  }
}
