# Database — Schema e Boas Práticas

O Homelab Manager usa `better-sqlite3` para persistência local. O banco de dados fica no diretório `userData` do Electron.

---

## Localização do Arquivo

| Ambiente | Caminho |
|----------|---------|
| Development | `%APPDATA%/homelab-manager/homelab-manager-dev.sqlite` |
| Production | `%APPDATA%/homelab-manager/homelab-manager.sqlite` |

> **Tip**: Para resetar o banco em dev, delete o arquivo `.sqlite` — ele será recriado no próximo boot.

---

## Inicialização

```typescript
// src/main/db/database.ts
import { initDb, getDb } from './db/database'

// Na inicialização do app (app.whenReady):
initDb()  // Cria o banco, ativa WAL, executa migrações

// Em qualquer handler:
const db = getDb()  // Retorna a instância singleton
```

**WAL Mode** ativado para melhor performance de leitura concorrente:
```typescript
db.pragma('journal_mode = WAL')
```

---

## Schema Completo

### Tabela `servers`

Armazena as configurações de cada servidor gerenciado.

```sql
CREATE TABLE IF NOT EXISTS servers (
  id               INTEGER  PRIMARY KEY AUTOINCREMENT,
  name             TEXT     NOT NULL,
  host             TEXT     NOT NULL,
  port             INTEGER  NOT NULL DEFAULT 22,
  username         TEXT     NOT NULL,
  auth_type        TEXT     NOT NULL CHECK(auth_type IN ('password', 'key')),
  password         TEXT,              -- plaintext (futuro: safeStorage)
  private_key_path TEXT,              -- caminho para arquivo .pem / id_rsa
  passphrase       TEXT,              -- passphrase da chave privada
  group_name       TEXT,              -- agrupamento lógico (ex: "homelab", "cloud")
  tags             TEXT,              -- JSON array ex: ["nas", "linux"]
  notes            TEXT,
  created_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Tabela `connection_log`

Registra o histórico de conexões SSH.

```sql
CREATE TABLE IF NOT EXISTS connection_log (
  id              INTEGER  PRIMARY KEY AUTOINCREMENT,
  server_id       INTEGER  NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
  connected_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  disconnected_at DATETIME,
  status          TEXT     CHECK(status IN ('success','error')) DEFAULT 'success',
  error_message   TEXT
);
```

### Tabela `graph_nodes` (Context Graph)

```sql
CREATE TABLE IF NOT EXISTS graph_nodes (
  id         TEXT     PRIMARY KEY,
  type       TEXT     NOT NULL CHECK(type IN ('file','function','concept','interaction')),
  content    TEXT     NOT NULL,
  embedding  BLOB,               -- Float64Array serializado como Buffer
  file_path  TEXT,
  metadata   TEXT,               -- JSON
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Tabela `graph_edges` (Context Graph)

```sql
CREATE TABLE IF NOT EXISTS graph_edges (
  id        TEXT  PRIMARY KEY,
  from_node TEXT  NOT NULL REFERENCES graph_nodes(id) ON DELETE CASCADE,
  to_node   TEXT  NOT NULL REFERENCES graph_nodes(id) ON DELETE CASCADE,
  relation  TEXT  NOT NULL CHECK(relation IN ('depends_on','calls','related_to','imports','exports')),
  weight    REAL  DEFAULT 1.0
);
```

### Tabela `embedding_cache` (Context Graph)

```sql
CREATE TABLE IF NOT EXISTS embedding_cache (
  content_hash TEXT     PRIMARY KEY,   -- SHA-256(provider + content)
  embedding    BLOB     NOT NULL,
  dimensions   INTEGER  NOT NULL,
  provider     TEXT     NOT NULL,
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

## Indexes

```sql
-- Context Graph traversal
CREATE INDEX IF NOT EXISTS idx_graph_edges_from ON graph_edges(from_node);
CREATE INDEX IF NOT EXISTS idx_graph_edges_to   ON graph_edges(to_node);
CREATE INDEX IF NOT EXISTS idx_graph_nodes_type ON graph_nodes(type);
CREATE INDEX IF NOT EXISTS idx_graph_nodes_file ON graph_nodes(file_path);
```

---

## Sistema de Migrações

Migrações ficam na função `migrate()` em `database.ts`. Padrão para adicionar colunas:

```typescript
// Verificar se coluna já existe antes de adicionar
const columnExists = db
  .prepare("PRAGMA table_info(servers)")
  .all()
  .some(c => (c as any).name === 'nova_coluna')

if (!columnExists) {
  db.prepare("ALTER TABLE servers ADD COLUMN nova_coluna TEXT").run()
}
```

---

## Boas Práticas

### 1. Use Prepared Statements

```typescript
// ✅ Correto — seguro contra SQL injection
const stmt = db.prepare('SELECT * FROM servers WHERE id = ?')
const server = stmt.get(id)

// ❌ Errado — nunca concatenar
const server = db.prepare(`SELECT * FROM servers WHERE id = ${id}`)
```

### 2. Normalize Empty Strings → null

```typescript
const payload = {
  password: server.password?.trim() || null,  // '' → null
  group_name: server.group_name || null,
  tags: server.tags || null,
}
```

### 3. Type-safe Reads

```typescript
import type { Server } from '../../preload/index.d'

// .get() retorna unknown — sempre faça cast
const server = db
  .prepare('SELECT * FROM servers WHERE id = ?')
  .get(id) as Server | undefined

// .all() retorna unknown[]
const servers = db
  .prepare('SELECT * FROM servers')
  .all() as Server[]
```

### 4. Transações para Operações Múltiplas

```typescript
const insertMany = db.transaction((records) => {
  for (const record of records) {
    stmt.run(record)
  }
})

insertMany(records)  // Atômico: ou tudo ou nada
```

---

## Queries Úteis (Debug)

```sql
-- Listar todos os servidores
SELECT id, name, host, port, auth_type FROM servers;

-- Ver log de conexões de um servidor
SELECT * FROM connection_log WHERE server_id = 1 ORDER BY connected_at DESC;

-- Contar nodes do grafo por tipo
SELECT type, COUNT(*) as count FROM graph_nodes GROUP BY type;

-- Ver arestas de um arquivo
SELECT * FROM graph_edges WHERE from_node LIKE '%ssh-manager%';

-- Verificar stats do embedding cache
SELECT provider, COUNT(*), AVG(dimensions) FROM embedding_cache GROUP BY provider;
```
