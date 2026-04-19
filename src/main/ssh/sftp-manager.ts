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
    // Resolve path first (useful for '.' to get home)
    sftp.realpath(path || '.', (rerr, absPath) => {
      if (rerr) {
        client.end();
        return reject(rerr);
      }

      sftp.readdir(absPath, (err, list) => {
        client.end();
        if (err) return reject(err);
        
        resolve({
          path: absPath,
          files: list.map(item => ({
            name: item.filename,
            isDir: item.attrs.isDirectory(),
            size: item.attrs.size,
            mtime: item.attrs.mtime
          }))
        });
      });
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

export async function downloadFile(serverId: number, remotePath: string, defaultName: string) {
  const { client, sftp } = await getSftpClient(serverId);
  const { dialog } = require('electron');
  
  const { canceled, filePath: localPath } = await dialog.showSaveDialog({
    defaultPath: defaultName,
    title: 'Download File'
  });

  if (canceled || !localPath) {
    client.end();
    return { success: false, message: 'Canceled' };
  }

  return new Promise((resolve, reject) => {
    sftp.fastGet(remotePath, localPath, (err) => {
      client.end();
      if (err) return reject(err);
      resolve({ success: true });
    });
  });
}

export async function createDirectory(serverId: number, path: string) {
  const { client, sftp } = await getSftpClient(serverId);
  return new Promise((resolve, reject) => {
    sftp.mkdir(path, (err) => {
      client.end();
      if (err) return reject(err);
      resolve({ success: true });
    });
  });
}

export async function deleteItem(serverId: number, path: string, isDir: boolean) {
  const { client, sftp } = await getSftpClient(serverId);
  return new Promise((resolve, reject) => {
    const callback = (err: Error | null | undefined) => {
      client.end();
      if (err) return reject(err);
      resolve({ success: true });
    };

    if (isDir) {
      sftp.rmdir(path, callback);
    } else {
      sftp.unlink(path, callback);
    }
  });
}

export async function uploadFile(serverId: number, localPath: string, remotePath: string) {
  const { client, sftp } = await getSftpClient(serverId);
  return new Promise((resolve, reject) => {
    sftp.fastPut(localPath, remotePath, (err) => {
      client.end();
      if (err) return reject(err);
      resolve({ success: true });
    });
  });
}

export async function createFile(serverId: number, path: string) {
  const { client, sftp } = await getSftpClient(serverId);
  return new Promise((resolve, reject) => {
    sftp.writeFile(path, '', (err) => {
      client.end();
      if (err) return reject(err);
      resolve({ success: true });
    });
  });
}
