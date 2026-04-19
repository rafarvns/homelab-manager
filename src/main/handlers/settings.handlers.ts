import { ipcMain } from 'electron';
import { getDb } from '../db/database';

export function registerSettingsHandlers() {
  ipcMain.handle('settings:get', (_, key: string) => {
    const db = getDb();
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
    return row ? JSON.parse(row.value) : null;
  });

  ipcMain.handle('settings:set', (_, key: string, value: any) => {
    const db = getDb();
    const jsonValue = JSON.stringify(value);
    db.prepare(`
      INSERT INTO settings (key, value) 
      VALUES (?, ?) 
      ON CONFLICT(key) DO UPDATE SET 
        value = excluded.value,
        updated_at = CURRENT_TIMESTAMP
    `).run(key, jsonValue);
    return { success: true };
  });

  ipcMain.handle('settings:getAll', () => {
    const db = getDb();
    const rows = db.prepare('SELECT key, value FROM settings').all() as { key: string, value: string }[];
    const settings: Record<string, any> = {};
    rows.forEach(row => {
      settings[row.key] = JSON.parse(row.value);
    });
    return settings;
  });
}
