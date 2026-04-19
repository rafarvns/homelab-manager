import { shell, safeStorage } from 'electron';
import * as http from 'http';
import { getDb } from '../db/database';
import { GDriveTokens } from './provider.types';

const PORT = 42856;
const REDIRECT_URI = `http://localhost:${PORT}`;

export class GDriveAuth {
  private static server: http.Server | null = null;

  static async authorize(): Promise<boolean> {
    const db = getDb();
    const clientId = db.prepare("SELECT value FROM settings WHERE key = 'sync_gdrive_client_id'").get() as { value: string } | undefined;
    const clientSecret = db.prepare("SELECT value FROM settings WHERE key = 'sync_gdrive_client_secret'").get() as { value: string } | undefined;

    if (!clientId?.value || !clientSecret?.value) {
      throw new Error('Google Drive Client ID or Client Secret not configured.');
    }

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` + 
      `client_id=${clientId.value}&` +
      `redirect_uri=${encodeURIComponent(REDIRECT_URI)}&` +
      `response_type=code&` +
      `scope=${encodeURIComponent('https://www.googleapis.com/auth/drive.appdata')}&` +
      `access_type=offline&` +
      `prompt=consent`;

    return new Promise((resolve, reject) => {
      if (this.server) this.server.close();

      this.server = http.createServer(async (req, res) => {
        const url = new URL(req.url!, `http://localhost:${PORT}`);
        const code = url.searchParams.get('code');

        if (code) {
          try {
            const tokens = await this.exchangeCodeForTokens(code, clientId.value, clientSecret.value);
            await this.saveTokens(tokens);
            
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end('<h1>Authentication Successful!</h1><p>You can close this window now.</p>');
            
            resolve(true);
          } catch (err: any) {
            res.writeHead(500, { 'Content-Type': 'text/html' });
            res.end(`<h1>Authentication Failed</h1><p>${err.message}</p>`);
            reject(err);
          } finally {
            this.server?.close();
            this.server = null;
          }
        }
      });

      this.server.listen(PORT, () => {
        shell.openExternal(authUrl);
      });

      // Timeout after 2 minutes
      setTimeout(() => {
        if (this.server) {
          this.server.close();
          this.server = null;
          reject(new Error('Authentication timed out.'));
        }
      }, 120000);
    });
  }

  private static async exchangeCodeForTokens(code: string, clientId: string, clientSecret: string): Promise<GDriveTokens> {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: REDIRECT_URI,
        grant_type: 'authorization_code'
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Token exchange failed: ${error.error_description || error.error}`);
    }

    const data = await response.json();
    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expiry_date: Date.now() + data.expires_in * 1000
    };
  }

  static async saveTokens(tokens: GDriveTokens) {
    const db = getDb();
    if (!safeStorage.isEncryptionAvailable()) throw new Error('Encryption not available.');

    const encrypted = safeStorage.encryptString(JSON.stringify(tokens));
    db.prepare(`
      INSERT INTO settings (key, value) VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
    `).run('sync_gdrive_tokens', encrypted.toString('base64'));
  }

  static async getTokens(): Promise<GDriveTokens | null> {
    const db = getDb();
    const row = db.prepare("SELECT value FROM settings WHERE key = 'sync_gdrive_tokens'").get() as { value: string } | undefined;
    if (!row) return null;

    try {
      const buffer = Buffer.from(row.value, 'base64');
      const decrypted = safeStorage.decryptString(buffer);
      return JSON.parse(decrypted);
    } catch (e) {
      return null;
    }
  }

  static async refreshTokenIfNeeded(tokens: GDriveTokens, clientId: string, clientSecret: string): Promise<GDriveTokens> {
    // Refresh if expiring in less than 5 minutes
    if (Date.now() < tokens.expiry_date - 300000) return tokens;

    console.log('[GDrive] Token expired or near expiry. Refreshing...');
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: tokens.refresh_token,
        grant_type: 'refresh_token'
      })
    });

    if (!response.ok) {
      throw new Error('Failed to refresh tokens');
    }

    const data = await response.json();
    const newTokens: GDriveTokens = {
      ...tokens,
      access_token: data.access_token,
      expiry_date: Date.now() + data.expires_in * 1000
    };

    await this.saveTokens(newTokens);
    return newTokens;
  }
}
