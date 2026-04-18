import { Client } from 'ssh2';
import { getServer } from '../handlers/server.handlers';
import * as fs from 'fs';
import { WebContents } from 'electron';

interface ActiveSession {
  client: Client;
  stream: any;
  serverId: number;
}

const activeSessions = new Map<string, ActiveSession>();

export async function connectToServer(serverId: number, sessionId: string, webContents: WebContents) {
  const server = getServer(serverId) as any;
  if (!server) throw new Error("Server not found");

  const client = new Client();

  return new Promise((resolve, reject) => {
    client.on('ready', () => {
      client.shell((err, stream) => {
        if (err) {
          client.end();
          return reject(err);
        }

        activeSessions.set(sessionId, { client, stream, serverId });

        // Forward data from SSH to Renderer
        stream.on('data', (data: Buffer) => {
          webContents.send(`ssh:data:${sessionId}`, data.toString('binary'));
        }).on('close', () => {
          client.end();
          webContents.send(`ssh:status:${sessionId}`, 'disconnected');
          activeSessions.delete(sessionId);
        });

        resolve({ success: true, sessionId });
      });
    }).on('error', (err) => {
      reject(err);
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
    } else {
      return reject(new Error("Invalid authentication configuration"));
    }

    try {
      client.connect(connectConfig);
    } catch (err) {
      reject(err);
    }
  });
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
    session.stream.setWindow(rows, cols, 0, 0); // Note: ssh2 setWindow is rows, cols, height, width
  }
}

export function disconnectSession(sessionId: string) {
  const session = activeSessions.get(sessionId);
  if (session) {
    session.client.end();
    activeSessions.delete(sessionId);
  }
}
