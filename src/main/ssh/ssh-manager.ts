import { Client } from 'ssh2';
import { getServer } from '../handlers/server.handlers';
import * as fs from 'fs';
import { WebContents } from 'electron';

interface ActiveSession {
  client: Client;
  stream: any;
  serverId: number;
  isManualDisconnect: boolean;
  reconnectAttempts: number;
}

const activeSessions = new Map<string, ActiveSession>();

export async function connectToServer(serverId: number, sessionId: string, webContents: WebContents) {
  const server = getServer(serverId) as any;
  if (!server) throw new Error("Server not found");

  // If session already exists and is reconnecting, don't create a new one
  let session = activeSessions.get(sessionId);
  if (!session) {
    session = { 
      client: new Client(), 
      stream: null, 
      serverId, 
      isManualDisconnect: false,
      reconnectAttempts: 0 
    };
    activeSessions.set(sessionId, session);
  }

  return performConnection(session, sessionId, server, webContents);
}

async function performConnection(session: ActiveSession, sessionId: string, server: any, webContents: WebContents) {
  const client = session.client;

  return new Promise((resolve, reject) => {
    // Clear previous listeners to avoid memory leaks during reconnect
    client.removeAllListeners('ready');
    client.removeAllListeners('error');
    client.removeAllListeners('close');

    client.on('ready', () => {
      client.shell((err, stream) => {
        if (err) {
          client.end();
          return reject(err);
        }

        session.stream = stream;
        session.reconnectAttempts = 0;
        webContents.send(`ssh:status:${sessionId}`, 'connected');

        stream.on('data', (data: Buffer) => {
          webContents.send(`ssh:data:${sessionId}`, data.toString('binary'));
        }).on('close', () => {
          session.stream = null;
          if (!session.isManualDisconnect) {
            handleReconnect(sessionId, webContents);
          } else {
            activeSessions.delete(sessionId);
            webContents.send(`ssh:status:${sessionId}`, 'disconnected');
          }
        });

        resolve({ success: true, sessionId });
      });
    }).on('error', (err) => {
      console.error(`SSH Error [${sessionId}]:`, err.message);
      if (session.reconnectAttempts === 0) {
        reject(err);
      } else {
        handleReconnect(sessionId, webContents);
      }
    });

    const connectConfig: import('ssh2').ConnectConfig = {
      host: server.host,
      port: server.port,
      username: server.username,
      readyTimeout: 10000,
    };

    if (server.auth_type === 'password') {
      connectConfig.password = server.password;
    } else if (server.auth_type === 'key' && server.private_key_path) {
      try {
        connectConfig.privateKey = fs.readFileSync(server.private_key_path);
        if (server.passphrase) {
          connectConfig.passphrase = server.passphrase;
        }
      } catch (err) {
        return reject(new Error(`Failed to read private key from ${server.private_key_path}`));
      }
    }

    try {
      client.connect(connectConfig);
    } catch (err) {
      reject(err);
    }
  });
}

function handleReconnect(sessionId: string, webContents: WebContents) {
  const session = activeSessions.get(sessionId);
  if (!session || session.isManualDisconnect) return;

  session.reconnectAttempts++;
  webContents.send(`ssh:status:${sessionId}`, 'reconnecting');

  const server = getServer(session.serverId) as any;
  const delay = Math.min(1000 * Math.pow(2, session.reconnectAttempts), 30000); // Exponential backoff up to 30s

  console.log(`Attempting reconnect for ${sessionId} in ${delay}ms (Attempt ${session.reconnectAttempts})`);
  
  setTimeout(async () => {
    try {
      // Re-create client instance for clean state
      session.client.removeAllListeners();
      session.client.end();
      session.client = new Client();
      await performConnection(session, sessionId, server, webContents);
    } catch (err) {
      console.error(`Reconnect attempt ${session.reconnectAttempts} failed for ${sessionId}`);
      // performConnection will trigger another handleReconnect on error
    }
  }, delay);
}

export function writeToStream(sessionId: string, data: string) {
  const session = activeSessions.get(sessionId);
  if (session && session.stream) {
    session.stream.write(data);
  }
}

export function resizeStream(sessionId: string, cols: number, rows: number) {
  const session = activeSessions.get(sessionId);
  if (session && session.stream) {
    session.stream.setWindow(rows, cols, 0, 0);
  }
}

export function disconnectSession(sessionId: string) {
  const session = activeSessions.get(sessionId);
  if (session) {
    session.isManualDisconnect = true;
    session.client.end();
    activeSessions.delete(sessionId);
  }
}
