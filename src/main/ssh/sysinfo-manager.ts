import { Client } from 'ssh2';
import { getServer } from '../handlers/server.handlers';
import * as fs from 'fs';

export interface SysInfo {
  os: string;
  uptime: string;
  cpu: string;
  memory: string;
  disk: string;
  ip: string;
  load: string;
  users: string;
  temp: string;
}

export async function getSystemInfo(serverId: number): Promise<SysInfo> {
  const server = getServer(serverId) as any;
  if (!server) throw new Error("Server not found");

  const client = new Client();

  return new Promise((resolve, reject) => {
    client.on('ready', () => {
      const script = `
os=$(cat /etc/os-release 2>/dev/null | grep PRETTY_NAME | cut -d= -f2 | tr -d '"')
if [ -z "$os" ]; then os=$(uname -snrvm); fi
uptime=$(uptime -p 2>/dev/null || uptime)
mem=$(free -m 2>/dev/null | awk 'NR==2{if($2>0) printf "%.1f%% (%s / %s MB)", $3*100/$2, $3, $2}')
disk=$(df -h / 2>/dev/null | awk 'NR==2{print $5 " - Free: " $4}')
cpu=$(lscpu 2>/dev/null | awk -F: '/^Model name/ {print $2}' | xargs)
if [ -z "$cpu" ]; then cpu=$(cat /proc/cpuinfo 2>/dev/null | grep 'model name' | head -n 1 | cut -d: -f2 | xargs); fi
ip=$(hostname -I | awk '{print $1}')
load=$(cat /proc/loadavg 2>/dev/null | awk '{print $1 " " $2 " " $3}')
users=$(who | wc -l)
temp=$(cat /sys/class/thermal/thermal_zone*/temp 2>/dev/null | head -n 1 | awk '{printf "%.1f°C", $1/1000}' || echo "N/A")

echo "os=$os"
echo "uptime=$uptime"
echo "mem=$mem"
echo "disk=$disk"
echo "cpu=$cpu"
echo "ip=$ip"
echo "load=$load"
echo "users=$users"
echo "temp=$temp"
`;
      
      client.exec(script, (err, stream) => {
        if (err) {
          client.end();
          return reject(err);
        }

        let output = '';
        stream.on('data', (data: Buffer) => {
          output += data.toString('utf8');
        }).on('close', () => {
          client.end();
          
          const result: SysInfo = {
            os: 'Unknown',
            uptime: 'Unknown',
            cpu: 'Unknown',
            memory: 'Unknown',
            disk: 'Unknown',
            ip: 'Unknown',
            load: 'Unknown',
            users: '0',
            temp: 'N/A'
          };
          
          output.split('\n').forEach(line => {
            if (line.startsWith('os=')) result.os = line.replace('os=', '').trim();
            else if (line.startsWith('uptime=')) result.uptime = line.replace('uptime=', '').trim();
            else if (line.startsWith('mem=')) result.memory = line.replace('mem=', '').trim();
            else if (line.startsWith('disk=')) result.disk = line.replace('disk=', '').trim();
            else if (line.startsWith('cpu=')) result.cpu = line.replace('cpu=', '').trim();
            else if (line.startsWith('ip=')) result.ip = line.replace('ip=', '').trim();
            else if (line.startsWith('load=')) result.load = line.replace('load=', '').trim();
            else if (line.startsWith('users=')) result.users = line.replace('users=', '').trim();
            else if (line.startsWith('temp=')) result.temp = line.replace('temp=', '').trim();
          });
          
          resolve(result);
        }).on('error', (err: any) => {
          client.end();
          reject(err);
        });
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

    try {
      client.connect(connectConfig);
    } catch(err) {
      reject(err);
    }
  });
}
