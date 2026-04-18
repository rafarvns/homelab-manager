# SSH — Subsistema de Conexões

O Homelab Manager gerencia sessões SSH via `ssh2`. Cada sessão tem um ID único e é mantida em memória no Main Process.

---

## Fluxo de Conexão

```
[Renderer] sshConnect(serverId, sessionId)
     ↓
[Main] connectToServer() em ssh-manager.ts
  1. Carrega config do servidor (SQLite)
  2. Cria Client ssh2
  3. Conecta: password OU chave privada
  4. client.on('ready') → abre shell interativo
  5. stream.on('data') → webContents.send('ssh:data:{sessionId}')
     ↓
[Renderer] xterm.write(data) — exibe no terminal
```

---

## Tipos de Autenticação

### Por senha

```typescript
// No SQLite: auth_type = 'password', password = '...'
connectConfig.password = server.password
```

### Por chave privada

```typescript
// No SQLite: auth_type = 'key', private_key_path = '/path/to/key'
connectConfig.privateKey = fs.readFileSync(server.private_key_path)
if (server.passphrase) {
  connectConfig.passphrase = server.passphrase  // para chaves criptografadas
}
```

---

## Sessões Ativas

O `ssh-manager.ts` mantém um `Map<sessionId, ActiveSession>`:

```typescript
interface ActiveSession {
  client: Client    // instância ssh2
  stream: any       // shell PTY stream
  serverId: number
}
```

Cada aba do terminal tem seu próprio `sessionId` (UUID gerado no Renderer).

---

## Canais IPC

| Canal | Direção | Descrição |
|-------|---------|-----------|
| `ssh:connect` | Renderer → Main | Inicia conexão |
| `ssh:input` | Renderer → Main | Envia dados ao terminal |
| `ssh:resize` | Renderer → Main | Notifica redimensionamento |
| `ssh:disconnect` | Renderer → Main | Encerra sessão |
| `ssh:data:{sessionId}` | Main → Renderer | Output do terminal |
| `ssh:status:{sessionId}` | Main → Renderer | Status: `disconnected` / `error` |

---

## Erros Comuns

| Erro | Causa | Solução |
|------|-------|---------|
| `ECONNREFUSED` | Servidor offline ou porta errada | Verificar `host` e `port` no cadastro |
| `All configured authentication methods failed` | Senha ou chave incorreta | Verificar credenciais no SQLite |
| `Cannot parse privateKey` | Chave criptografada sem passphrase | Preencher campo `passphrase` |
| `Failed to read private key` | Caminho do arquivo não existe | Re-selecionar o arquivo via `dialogOpenFile` |

---

## Resize do Terminal

O xterm.js notifica mudanças de tamanho via addon `fit`. O Renderer deve propagar para o servidor SSH:

```typescript
// No componente React do terminal:
fitAddon.fit()
const { cols, rows } = terminal

window.api.sshResize(sessionId, cols, rows)
```

O Main Process chama:
```typescript
stream.setWindow(rows, cols, 0, 0)  // ssh2: rows primeiro, depois cols
```

---

## Cleanup de Listeners

É obrigatório remover os listeners IPC ao desmontar o componente de terminal:

```typescript
useEffect(() => {
  window.api.onSshData(sessionId, handleData)
  window.api.onSshStatus(sessionId, handleStatus)

  return () => {
    window.api.removeSshListeners(sessionId)
    window.api.sshDisconnect(sessionId)
  }
}, [sessionId])
```

---

## Diagnóstico — Debug Protocol

Para investigar falhas de handshake, habilite o log detalhado do `ssh2` no `ssh-manager.ts`:

```typescript
client.connect({
  host: server.host,
  port: server.port,
  username: server.username,
  debug: (msg) => console.log('[SSH2 DEBUG]', msg),  // ← adicionar temporariamente
})
```

Os logs aparecerão no **console do terminal** onde `pnpm dev` está rodando (processo Main), não no DevTools.

---

## Segurança

> ⚠️ **Futuro**: Atualmente, senhas e passphrases são salvas em plaintext no SQLite.
>
> O plano é usar `electron.safeStorage.encryptString()` antes de inserir e `decryptString()` ao ler, sem nunca enviar a senha descriptografada para o Renderer.

Veja `src/main/db/database.ts` linha 41 para o comentário de rastreamento.
