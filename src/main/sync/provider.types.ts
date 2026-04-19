export interface SyncConfig {
  provider: 'sftp' | 'gdrive';
  // SFTP specific
  host?: string;
  port?: number;
  username?: string;
  auth_type?: 'password' | 'key';
  password?: string;
  private_key_path?: string;
  remote_path?: string;
}

export interface SyncProvider {
  test(): Promise<{ success: boolean; message: string }>;
  upload(buffer: Buffer): Promise<void>;
  download(): Promise<Buffer>;
  getAccountInfo?(): Promise<{ email?: string; status: string }>;
}

export interface GDriveTokens {
  access_token: string;
  refresh_token: string;
  expiry_date: number;
}
