import { Client, SFTPWrapper } from 'ssh2';
import { getServer } from '../handlers/server.handlers';
import * as fs from 'fs';

async function getSftpClient(serverId: number): Promise<{ client: Client, sftp: SFTPWrapper }> {
  const server = getServer(serverId) as any;
  if (!server) throw new Error("Server not found");

  const client = new Client();

  return new Promise((resolve, reject) => {
    client.on('ready', () => {
      client.sftp((err, sftp) => {
        if (err) {
          client.end();
          return reject(err);
        }
        resolve({ client, sftp });
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
    }

    client.connect(connectConfig);
  });
}

export async function listDirectory(serverId: number, path: string) {
  const { client, sftp } = await getSftpClient(serverId);
  return new Promise((resolve, reject) => {
    sftp.readdir(path, (err, list) => {
      client.end();
      if (err) return reject(err);
      
      resolve(list.map(item => ({
        name: item.filename,
        isDir: item.attrs.isDirectory(),
        size: item.attrs.size,
        mtime: item.attrs.mtime
      })));
    });
  });
}

export async function readFile(serverId: number, path: string): Promise<string> {
  const { client, sftp } = await getSftpClient(serverId);
  return new Promise((resolve, reject) => {
    const stream = sftp.createReadStream(path);
    let data = '';
    
    stream.on('data', (chunk) => {
      data += chunk.toString('utf8');
    });
    
    stream.on('error', (err) => {
      client.end();
      reject(err);
    });
    
    stream.on('end', () => {
      client.end();
      resolve(data);
    });
  });
}

export async function writeFile(serverId: number, path: string, content: string): Promise<{ success: boolean }> {
  const { client, sftp } = await getSftpClient(serverId);
  return new Promise((resolve, reject) => {
    const stream = sftp.createWriteStream(path);
    
    stream.on('error', (err) => {
      client.end();
      reject(err);
    });
    
    stream.on('finish', () => {
      client.end();
      resolve({ success: true });
    });
    
    stream.end(content);
  });
}
