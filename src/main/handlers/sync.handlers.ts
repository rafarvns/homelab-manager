import { ipcMain } from 'electron';
import { SyncService } from '../sync/sync-service';
import { SyncConfig } from '../sync/provider.types';
import { decrypt } from '../db/security';

export function registerSyncHandlers() {
  // Start the background loop automatically on boot
  SyncService.startAutoSyncLoop();

  ipcMain.handle('sync:test-connection', async (_, config: SyncConfig) => {
    // Decrypt credentials if they were stored in local DB
    const processedConfig = { ...config };
    if (processedConfig.password) processedConfig.password = decrypt(processedConfig.password)!;
    if (processedConfig.private_key_path) processedConfig.private_key_path = decrypt(processedConfig.private_key_path)!;
    
    return await SyncService.testConnection(processedConfig);
  });

  ipcMain.handle('sync:push', async (_, config: SyncConfig, passphrase: string) => {
    const processedConfig = { ...config };
    if (processedConfig.password) processedConfig.password = decrypt(processedConfig.password)!;
    if (processedConfig.private_key_path) processedConfig.private_key_path = decrypt(processedConfig.private_key_path)!;

    return await SyncService.push(processedConfig, passphrase);
  });

  ipcMain.handle('sync:pull', async (_, config: SyncConfig, passphrase: string) => {
    const processedConfig = { ...config };
    if (processedConfig.password) processedConfig.password = decrypt(processedConfig.password)!;
    if (processedConfig.private_key_path) processedConfig.private_key_path = decrypt(processedConfig.private_key_path)!;

    return await SyncService.pull(processedConfig, passphrase);
  });

  ipcMain.handle('sync:connect-gdrive', async () => {
    return await SyncService.connectGDrive();
  });

  ipcMain.handle('sync:get-gdrive-account', async () => {
    return await SyncService.getGDriveAccount();
  });

  ipcMain.handle('sync:set-secure-passphrase', async (_, passphrase: string | null) => {
    return await SyncService.setSecurePassphrase(passphrase);
  });

  ipcMain.handle('sync:get-local-stats', async () => {
    return await SyncService.getSyncLocalStats();
  });
}
