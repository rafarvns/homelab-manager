import { getDb } from '../db/database';

export interface DockerAlias {
  container_id: string;
  alias: string;
}

export function setDockerAlias(serverId: number, containerId: string, alias: string) {
  const db = getDb();
  
  if (!alias || alias.trim() === '') {
    db.prepare('DELETE FROM docker_aliases WHERE server_id = ? AND container_id = ?')
      .run(serverId, containerId);
    return { success: true, message: 'Alias removed' };
  }

  db.prepare(`
    INSERT INTO docker_aliases (server_id, container_id, alias)
    VALUES (?, ?, ?)
    ON CONFLICT(server_id, container_id) DO UPDATE SET
      alias = excluded.alias
  `).run(serverId, containerId, alias.trim());

  return { success: true, message: 'Alias updated' };
}

export function getDockerAliases(serverId: number): Record<string, string> {
  const db = getDb();
  const rows = db.prepare('SELECT container_id, alias FROM docker_aliases WHERE server_id = ?')
    .all(serverId) as DockerAlias[];
    
  const aliasMap: Record<string, string> = {};
  rows.forEach(row => {
    aliasMap[row.container_id] = row.alias;
  });
  
  return aliasMap;
}
