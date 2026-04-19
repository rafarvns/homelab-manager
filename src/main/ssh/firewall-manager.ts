import { Client } from 'ssh2';
import { getServer } from '../handlers/server.handlers';
import * as fs from 'fs';

export interface UfwRule {
  id: string;
  to: string;
  action: string;
  from: string;
}

export interface UfwStatus {
  status: 'active' | 'inactive' | 'unknown' | 'error';
  rules: UfwRule[];
  message?: string;
}

async function getClient(serverId: number): Promise<{ client: Client, server: any }> {
  const server = getServer(serverId) as any;
  if (!server) throw new Error("Server not found");

  const client = new Client();

  return new Promise((resolve, reject) => {
    client.on('ready', () => resolve({ client, server }))
          .on('error', (err) => reject(err));

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

function executeSudoCmd(client: Client, server: any, baseCmd: string): Promise<string> {
    return new Promise((resolve, reject) => {
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

            stream.on('data', (data: Buffer) => output += data.toString());
            stream.stderr.on('data', (data: Buffer) => errorOutput += data.toString());

            stream.on('close', (code: number) => {
                client.end();
                if (code !== 0) {
                    return reject(new Error(errorOutput || output || `Command failed with code ${code}`));
                }
                resolve(output);
            });
        });
    });
}

export async function getFirewallStatus(serverId: number): Promise<UfwStatus> {
  const { client, server } = await getClient(serverId);
  
  try {
    // Some versions of UFW require sudo for status
    const output = await executeSudoCmd(client, server, `ufw status numbered`);
    const lines = output.trim().split('\n').map(l => l.trim()).filter(l => l && !l.includes('[sudo] password for'));
    
    if (lines.length === 0) {
        return { status: 'unknown', rules: [], message: 'No output from UFW' };
    }

    const firstLine = lines[0].toLowerCase();
    if (firstLine.includes('status: inactive')) {
        return { status: 'inactive', rules: [] };
    } else if (firstLine.includes('status: active')) {
        const rules: UfwRule[] = [];
        // Lines look like:
        // By default:
        // Status: active
        //
        //      To                         Action      From
        //      --                         ------      ----
        // [ 1] 22/tcp                     ALLOW IN    Anywhere
        
        for (const line of lines) {
            if (line.match(/^\[\s*\d+\]/)) {
               // Regex breaks down [ id ] to action from
               // We use a non-greedy match for "to" and capture actions like ALLOW IN, DENY OUT etc.
               const ruleMatch = line.match(/^\[\s*(\d+)\]\s+(.*?)\s+(ALLOW IN|DENY IN|REJECT IN|ALLOW OUT|DENY OUT|REJECT OUT|ALLOW|DENY|REJECT)\s+(.*)$/);
               if (ruleMatch) {
                   rules.push({
                       id: ruleMatch[1].trim(),
                       to: ruleMatch[2].trim(),
                       action: ruleMatch[3].trim(),
                       from: ruleMatch[4].trim()
                   });
               }
            }
        }
        return { status: 'active', rules };
    } else {
        if (firstLine.includes('command not found') || output.includes('command not found')) {
            return { status: 'error', rules: [], message: 'UFW is not installed on this server.' };
        }
        return { status: 'unknown', rules: [], message: lines.join('\n') };
    }
  } catch (err: any) {
    if ((err.message && err.message.includes('command not found')) || err.message.includes('No such file or directory')) {
        return { status: 'error', rules: [], message: 'UFW is not installed on this server.' };
    }
    throw err;
  }
}

export async function controlFirewall(serverId: number, action: string, params?: any): Promise<{ success: boolean, message: string }> {
    const { client, server } = await getClient(serverId);
    let cmd = '';

    if (action === 'enable') cmd = `ufw --force enable`;
    else if (action === 'disable') cmd = `ufw disable`;
    else if (action === 'delete') {
        const ruleId = params?.id;
        if (!ruleId) throw new Error("Rule ID required for deletion");
        if (params?.to && params.to.includes('22')) {
            // Optional basic Backend protection against raw port 22 deletion, 
            // but we can trust the UI logic to handle this since UFW numbered delete 
            // doesn't specify '22' in the arguments, it specifies the ID.
            // The frontend is responsible for that check.
        }
        cmd = `ufw --force delete ${ruleId}`;
    }
    else if (action === 'allow' || action === 'deny') {
        const rulePort = params?.port;
        const ruleProto = params?.protocol;
        if (!rulePort) throw new Error("Port required for rule");
        
        const protoStr = ruleProto && ruleProto !== 'any' ? `/${ruleProto}` : '';
        cmd = `ufw ${action} ${rulePort}${protoStr}`;
    } else {
        throw new Error("Invalid firewall action");
    }

    try {
        const output = await executeSudoCmd(client, server, cmd);
        return { success: true, message: output.trim() };
    } catch(err: any) {
        throw new Error(`Firewall action failed: ${err.message}`);
    }
}
