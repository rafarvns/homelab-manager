import { Client } from 'ssh2';
import { getServer } from '../handlers/server.handlers';
import * as fs from 'fs';

export interface SystemService {
  name: string;
  status: 'running' | 'stopped' | 'failed' | 'inactive' | 'unknown';
  enabled: boolean;
  description: string;
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

export async function listServices(serverId: number): Promise<SystemService[]> {
  const { client } = await getClient(serverId);
  
  return new Promise((resolve, reject) => {
    // List units with | separator
    const cmdUnits = "systemctl list-units --type=service --all --no-pager --plain --no-legend | awk '{print $1\"|\"$3\"|\"$4\"|\"$0}'";
    // List unit files for enabled/disabled status
    const cmdEnabled = "systemctl list-unit-files --type=service --no-pager --no-legend | awk '{print $1\"|\"$2}'";

    client.exec(`${cmdUnits} && echo \"---ENABLED_START---\" && ${cmdEnabled}`, (err, stream) => {
      if (err) {
        client.end();
        return reject(err);
      }

      let output = '';
      stream.on('data', (data: Buffer) => {
        output += data.toString();
      }).on('close', () => {
        client.end();
        
        const services: SystemService[] = [];
        const [unitsPart, enabledPart] = output.split('---ENABLED_START---');
        
        const enabledMap = new Map<string, boolean>();
        if (enabledPart) {
          enabledPart.trim().split('\n').forEach(line => {
            const [name, state] = line.split('|');
            if (name && state) {
              enabledMap.set(name, state === 'enabled');
            }
          });
        }

        if (unitsPart) {
          unitsPart.trim().split('\n').forEach(line => {
            const parts = line.split('|');
            if (parts.length < 4) return;
            const name = parts[0];
            const active = parts[1];
            const sub = parts[2];
            const fullLine = parts[3];
            
            // Description starts after 4 columns in original output.
            // Using a heuristic to find description in the full line
            const descMatch = fullLine.match(/\\s+\\S+\\s+\\S+\\s+\\S+\\s+(.*)$/);
            const description = descMatch ? descMatch[1].trim() : '';

            let status: SystemService['status'] = 'unknown';
            if (active === 'active' && sub === 'running') status = 'running';
            else if (active === 'inactive' || sub === 'dead') status = 'stopped';
            else if (sub === 'failed') status = 'failed';
            else if (active === 'inactive') status = 'inactive';

            services.push({
              name,
              status,
              enabled: enabledMap.get(name) || false,
              description: description || ''
            });
          });
        }
        
        resolve(services);
      });
    });
  });
}

export async function controlService(serverId: number, serviceName: string, action: string) {
    const { client } = await getClient(serverId);
    return new Promise((resolve, reject) => {
        const cmd = `sudo systemctl ${action} ${serviceName}`;
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
                    resolve({ success: true, message: `Service ${serviceName} ${action}ed successfully` });
                }
            });
        });
    });
}

export async function getServiceLogs(serverId: number, serviceName: string, lines: number = 200) {
    const { client } = await getClient(serverId);
    return new Promise((resolve, reject) => {
        const cmd = `journalctl -u ${serviceName} -n ${lines} --no-pager`;
        client.exec(cmd, (err, stream) => {
            if (err) {
                client.end();
                return reject(err);
            }
            let output = '';
            stream.on('data', (data) => output += data.toString());
            stream.on('close', () => {
                client.end();
                resolve(output);
            });
        });
    });
}
