import { getDb } from '../../db/database';
import { SyncProvider } from '../provider.types';
import { GDriveAuth } from '../gdrive-auth';

const PAYLOAD_FILENAME = 'homelab_sync_payload.dat';

export class GoogleDriveProvider implements SyncProvider {
  async test(): Promise<{ success: boolean; message: string }> {
    try {
      const tokens = await this.getValidTokens();
      if (!tokens) return { success: false, message: 'Not authenticated with Google Drive' };
      
      const response = await fetch('https://www.googleapis.com/drive/v3/about?fields=user', {
        headers: { Authorization: `Bearer ${tokens.access_token}` }
      });

      if (!response.ok) throw new Error('Failed to fetch account info');
      const data = await response.json();
      
      return { success: true, message: `Connected as ${data.user.emailAddress}` };
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  }

  async upload(buffer: Buffer): Promise<void> {
    const tokens = await this.getValidTokens();
    if (!tokens) throw new Error('Not authenticated');

    const fileId = await this.findPayloadFile(tokens.access_token);

    const metadata = {
      name: PAYLOAD_FILENAME,
      parents: ['appDataFolder']
    };

    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', new Blob([new Uint8Array(buffer)]));

    let url = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
    let method = 'POST';

    if (fileId) {
      url = `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`;
      method = 'PATCH';
      
      // For PATCH with uploadType=media, we just send the buffer directly
      const response = await fetch(url, {
        method,
        headers: { Authorization: `Bearer ${tokens.access_token}` },
        body: new Uint8Array(buffer)
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(`Upload failed: ${err.error.message}`);
      }
    } else {
      // Create new file
      const response = await fetch(url, {
        method,
        headers: { Authorization: `Bearer ${tokens.access_token}` },
        body: form
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(`Upload failed: ${err.error.message}`);
      }
    }
  }

  async download(): Promise<Buffer> {
    const tokens = await this.getValidTokens();
    if (!tokens) throw new Error('Not authenticated');

    const fileId = await this.findPayloadFile(tokens.access_token);
    if (!fileId) throw new Error('No such file. Did you push from another device first?');

    const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
      headers: { Authorization: `Bearer ${tokens.access_token}` }
    });

    if (!response.ok) throw new Error('Download failed');
    
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  async getAccountInfo(): Promise<{ email?: string; status: string }> {
    try {
      const tokens = await GDriveAuth.getTokens();
      if (!tokens) return { status: 'Disconnected' };

      const response = await fetch('https://www.googleapis.com/drive/v3/about?fields=user', {
        headers: { Authorization: `Bearer ${tokens.access_token}` }
      });

      if (!response.ok) return { status: 'Error' };
      const data = await response.json();
      return { email: data.user.emailAddress, status: 'Connected' };
    } catch (e) {
      return { status: 'Disconnected' };
    }
  }

  private async getValidTokens() {
    const tokens = await GDriveAuth.getTokens();
    if (!tokens) return null;

    const db = getDb();
    const clientId = db.prepare("SELECT value FROM settings WHERE key = 'sync_gdrive_client_id'").get() as { value: string } | undefined;
    const clientSecret = db.prepare("SELECT value FROM settings WHERE key = 'sync_gdrive_client_secret'").get() as { value: string } | undefined;

    if (!clientId?.value || !clientSecret?.value) return tokens;

    return await GDriveAuth.refreshTokenIfNeeded(tokens, clientId.value, clientSecret.value);
  }

  private async findPayloadFile(accessToken: string): Promise<string | null> {
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=name='${PAYLOAD_FILENAME}'&fields=files(id)`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!response.ok) return null;
    const data = await response.json();
    return data.files.length > 0 ? data.files[0].id : null;
  }
}
