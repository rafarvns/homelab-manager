import { getDb } from '../db/database';
import { encrypt, decrypt } from '../db/security';
import { SyncService } from '../sync/sync-service';

export interface ServerInput {
  name: string;
  host: string;
  port: number;
  username: string;
  auth_type: 'password' | 'key';
  password?: string;
  private_key_path?: string;
  passphrase?: string;
  icon?: string;
  group_name?: string;
  tags?: string; // JSON
  notes?: string;
  auto_refresh_services?: boolean;
}

export function getAllServers() {
  const db = getDb();
  const servers = db.prepare('SELECT * FROM servers ORDER BY sort_order ASC, name ASC').all() as any[];
  
  return servers.map(s => ({
    ...s,
    password: decrypt(s.password),
    passphrase: decrypt(s.passphrase),
    private_key_path: decrypt(s.private_key_path),
    auto_refresh_services: !!s.auto_refresh_services
  }));
}

export function createServer(server: ServerInput) {
  const db = getDb();
  
  // Get max sort_order
  const maxOrder = (db.prepare('SELECT MAX(sort_order) as maxOrder FROM servers').get() as any).maxOrder || 0;
  
  const stmt = db.prepare(`
    INSERT INTO servers (name, host, port, username, auth_type, password, private_key_path, passphrase, icon, sort_order, group_name, tags, notes, auto_refresh_services)
    VALUES (@name, @host, @port, @username, @auth_type, @password, @private_key_path, @passphrase, @icon, @sort_order, @group_name, @tags, @notes, @auto_refresh_services)
  `);
  
  const payload = {
    name: server.name,
    host: server.host,
    port: server.port,
    username: server.username,
    auth_type: server.auth_type,
    password: encrypt(server.password) || null,
    private_key_path: encrypt(server.private_key_path) || null,
    passphrase: encrypt(server.passphrase) || null,
    icon: server.icon || 'Server',
    sort_order: maxOrder + 1,
    group_name: server.group_name || null,
    tags: server.tags || null,
    notes: server.notes || null,
    auto_refresh_services: server.auto_refresh_services ? 1 : 0
  };

  const info = stmt.run(payload);
  
  SyncService.triggerAutoPush();
  
  return { 
    id: info.lastInsertRowid, 
    ...payload,
    password: decrypt(payload.password),
    passphrase: decrypt(payload.passphrase),
    private_key_path: decrypt(payload.private_key_path),
    auto_refresh_services: !!payload.auto_refresh_services
  };
}

export function updateServer(id: number, server: ServerInput) {
  const db = getDb();
  const stmt = db.prepare(`
    UPDATE servers SET 
      name = @name, host = @host, port = @port, username = @username, 
      auth_type = @auth_type, password = @password, private_key_path = @private_key_path,
      passphrase = @passphrase, icon = @icon, group_name = @group_name, tags = @tags, notes = @notes,
      auto_refresh_services = @auto_refresh_services,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = @id
  `);
  
  const payload = {
    id,
    name: server.name,
    host: server.host,
    port: server.port,
    username: server.username,
    auth_type: server.auth_type,
    password: encrypt(server.password) || null,
    private_key_path: encrypt(server.private_key_path) || null,
    passphrase: encrypt(server.passphrase) || null,
    icon: server.icon || 'Server',
    group_name: server.group_name || null,
    tags: server.tags || null,
    notes: server.notes || null,
    auto_refresh_services: server.auto_refresh_services ? 1 : 0
  };

  stmt.run(payload);
  
  SyncService.triggerAutoPush();
  
  return {
    ...payload,
    password: decrypt(payload.password),
    passphrase: decrypt(payload.passphrase),
    private_key_path: decrypt(payload.private_key_path),
    auto_refresh_services: !!payload.auto_refresh_services
  };
}

export function updateServersOrder(ids: number[]) {
  const db = getDb();
  const stmt = db.prepare('UPDATE servers SET sort_order = ? WHERE id = ?');
  
  const transaction = db.transaction((serverIds: number[]) => {
    for (let i = 0; i < serverIds.length; i++) {
      stmt.run(i, serverIds[i]);
    }
  });

  transaction(ids);
  
  SyncService.triggerAutoPush();
  
  return { success: true };
}

export function deleteServer(id: number) {
  const db = getDb();
  db.prepare('DELETE FROM servers WHERE id = ?').run(id);
  
  SyncService.triggerAutoPush();
  
  return { success: true };
}

export function getServer(id: number) {
  const db = getDb();
  const s = db.prepare('SELECT * FROM servers WHERE id = ?').get(id) as any;
  if (!s) return null;
  
  return {
    ...s,
    password: decrypt(s.password),
    passphrase: decrypt(s.passphrase),
    private_key_path: decrypt(s.private_key_path),
    auto_refresh_services: !!s.auto_refresh_services
  };
}
