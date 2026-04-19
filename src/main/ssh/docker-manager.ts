import { Client } from 'ssh2';
import { getServer } from '../handlers/server.handlers';
import * as fs from 'fs';

export interface DockerContainer {
  id: string;
  name: string;
  image: string;
  state: 'running' | 'exited' | 'created' | 'paused' | 'restarting' | 'dead' | 'unknown';
  status: string;
  ports: string;
}

async function getClient(serverId: number): Promise<{ client: Client, server: any }> {
  const server = getServer(serverId) as any;
  if (!server) throw new Error("Server not found");

  const client = new Client();

  return new Promise((resolve, reject) => {
    client.on('ready', () => {
      resolve({ client, server });
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
    }

    try {
      client.connect(connectConfig);
    } catch(err) {
      reject(err);
    }
  });
}

export async function listDockerContainers(serverId: number): Promise<DockerContainer[]> {
  const { client, server } = await getClient(serverId);
  
  return new Promise((resolve, reject) => {
    // Try without sudo first (standard for homelabs), fallback to sudo -S if password is provided
    const baseCmd = `docker ps -a --format '{{.ID}}|{{.Names}}|{{.Image}}|{{.State}}|{{.Status}}|{{.Ports}}'`;
    const cmd = server.password 
        ? `${baseCmd} 2>/dev/null || echo '${server.password.replace(/'/g, "'\\''")}' | sudo -S ${baseCmd}`
        : `sudo ${baseCmd} 2>/dev/null || ${baseCmd}`;

    client.exec(cmd, (err, stream) => {
      if (err) {
        client.end();
        return reject(err);
      }

      let output = '';
      let errorOutput = '';
      
      stream.on('data', (data: Buffer) => {
        output += data.toString();
      });

      stream.stderr.on('data', (data: Buffer) => {
        errorOutput += data.toString();
      });

      stream.on('close', (code: number) => {
        client.end();
        
        if (code !== 0) {
            return reject(new Error(errorOutput || `Command failed with code ${code}`));
        }

        const containers: DockerContainer[] = [];
        
        output.trim().split('\n').forEach(line => {
          line = line.trim();
          if (!line || line.includes('[sudo] password for')) return; // ignore sudo prompt lines
          const parts = line.split('|');
          if (parts.length >= 6) {
            containers.push({
              id: parts[0],
              name: parts[1],
              image: parts[2],
              state: parts[3].toLowerCase() as any,
              status: parts[4],
              ports: parts[5]
            });
          }
        });
        
        resolve(containers);
      });
    });
  });
}

export async function controlDockerContainer(serverId: number, containerId: string, action: string) {
    const { client, server } = await getClient(serverId);
    return new Promise((resolve, reject) => {
        const baseCmd = `docker ${action} ${containerId}`;
        const cmd = server.password 
            ? `${baseCmd} 2>/dev/null || echo '${server.password.replace(/'/g, "'\\''")}' | sudo -S ${baseCmd}`
            : `sudo ${baseCmd} 2>/dev/null || ${baseCmd}`;
            
        client.exec(cmd, (err, stream) => {
            if (err) {
                client.end();
                return reject(err);
            }
            let stderr = '';
            stream.stderr.on('data', (data) => stderr += data.toString());
            stream.on('close', (code) => {
                client.end();
                if (code !== 0) {
                    reject(new Error(stderr || `Command failed with code ${code}`));
                } else {
                    resolve({ success: true, message: `Container ${containerId} ${action} successfully` });
                }
            });
        });
    });
}

export async function getDockerLogs(serverId: number, containerId: string, lines: number = 200) {
    const { client, server } = await getClient(serverId);
    return new Promise((resolve, reject) => {
        const baseCmd = `docker logs --tail ${lines} ${containerId} 2>&1`;
        const cmd = server.password 
            ? `${baseCmd} 2>/dev/null || echo '${server.password.replace(/'/g, "'\\''")}' | sudo -S ${baseCmd}`
            : `sudo ${baseCmd} 2>/dev/null || ${baseCmd}`;
            
        client.exec(cmd, (err, stream) => {
            if (err) {
                client.end();
                return reject(err);
            }
            let output = '';
            let stderr = '';
            stream.on('data', (data) => output += data.toString());
            stream.stderr.on('data', (data) => stderr += data.toString());
            stream.on('close', (code) => {
                client.end();
                if (code !== 0 && !output) {
                    return reject(new Error(stderr || `Command failed with code ${code}`));
                }
                resolve(output);
            });
        });
    });
}
