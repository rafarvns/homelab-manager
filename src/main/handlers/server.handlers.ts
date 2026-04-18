import { getDb } from '../db/database';

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
}

export function getAllServers() {
  const db = getDb();
  return db.prepare('SELECT * FROM servers ORDER BY name ASC').all();
}

export function createServer(server: ServerInput) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO servers (name, host, port, username, auth_type, password, private_key_path, passphrase, icon, group_name, tags, notes)
    VALUES (@name, @host, @port, @username, @auth_type, @password, @private_key_path, @passphrase, @icon, @group_name, @tags, @notes)
  `);
  
  const payload = {
    name: server.name,
    host: server.host,
    port: server.port,
    username: server.username,
    auth_type: server.auth_type,
    password: server.password || null,
    private_key_path: server.private_key_path || null,
    passphrase: server.passphrase || null,
    icon: server.icon || 'Server',
    group_name: server.group_name || null,
    tags: server.tags || null,
    notes: server.notes || null
  };

  const info = stmt.run(payload);
  return { id: info.lastInsertRowid, ...payload };
}

export function updateServer(id: number, server: ServerInput) {
  const db = getDb();
  const stmt = db.prepare(`
    UPDATE servers SET 
      name = @name, host = @host, port = @port, username = @username, 
      auth_type = @auth_type, password = @password, private_key_path = @private_key_path,
      passphrase = @passphrase, icon = @icon, group_name = @group_name, tags = @tags, notes = @notes,
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
    password: server.password || null,
    private_key_path: server.private_key_path || null,
    passphrase: server.passphrase || null,
    icon: server.icon || 'Server',
    group_name: server.group_name || null,
    tags: server.tags || null,
    notes: server.notes || null
  };

  stmt.run(payload);
  return payload;
}

export function deleteServer(id: number) {
  const db = getDb();
  db.prepare('DELETE FROM servers WHERE id = ?').run(id);
  return { success: true };
}

export function getServer(id: number) {
  const db = getDb();
  return db.prepare('SELECT * FROM servers WHERE id = ?').get(id);
}
