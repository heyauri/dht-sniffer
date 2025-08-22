import * as net from 'net';
import * as util from 'util';

/**
 * 检查端口是否可用
 * @param port 端口号
 * @param host 主机地址，默认为 '0.0.0.0'
 * @returns Promise<boolean> 端口是否可用
 */
export async function isPortAvailable(port: number, host: string = '0.0.0.0'): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    
    server.listen(port, host, () => {
      const { port: listenedPort } = server.address() as any;
      server.close(() => {
        resolve(listenedPort === port);
      });
    });
    
    server.on('error', () => {
      resolve(false);
    });
  });
}

/**
 * 查找可用端口
 * @param startPort 起始端口
 * @param host 主机地址，默认为 '0.0.0.0'
 * @param maxAttempts 最大尝试次数，默认为100
 * @returns Promise<number> 可用端口
 */
export async function findAvailablePort(startPort: number = 6881, host: string = '0.0.0.0', maxAttempts: number = 100): Promise<number> {
  for (let i = 0; i < maxAttempts; i++) {
    const port = startPort + i;
    if (await isPortAvailable(port, host)) {
      return port;
    }
  }
  
  throw new Error(`No available port found starting from ${startPort} after ${maxAttempts} attempts`);
}

/**
 * 获取DHT默认端口范围内的可用端口
 * @param preferredPort 首选端口，默认为6881
 * @returns Promise<number> 可用端口
 */
export async function getDHTAvailablePort(preferredPort: number = 6881): Promise<number> {
  try {
    // 首先尝试首选端口
    if (await isPortAvailable(preferredPort)) {
      return preferredPort;
    }
    
    // 如果首选端口不可用，查找其他可用端口
    // DHT常用端口范围：6881-6889
    const dhtPorts = [6881, 6882, 6883, 6884, 6885, 6886, 6887, 6888, 6889];
    
    for (const port of dhtPorts) {
      if (await isPortAvailable(port)) {
        return port;
      }
    }
    
    // 如果DHT端口都不可用，从6881开始查找
    return await findAvailablePort(6881);
  } catch (error) {
    throw new Error(`Failed to find available DHT port: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * 杀死占用指定端口的进程（仅适用于Unix-like系统）
 * @param port 端口号
 * @returns Promise<boolean> 是否成功杀死进程
 */
export async function killProcessOnPort(port: number): Promise<boolean> {
  if (process.platform !== 'darwin' && process.platform !== 'linux') {
    return false;
  }
  
  const { exec } = require('child_process');
  const execAsync = util.promisify(exec);
  
  try {
    // 查找占用端口的进程
    const { stdout } = await execAsync(`lsof -ti:${port}`);
    const pids = stdout.trim().split('\n').filter((pid: string) => pid);
    
    if (pids.length === 0) {
      return false;
    }
    
    // 杀死进程
    for (const pid of pids) {
      await execAsync(`kill -9 ${pid}`);
    }
    
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * 获取端口占用信息
 * @param port 端口号
 * @returns Promise<string> 端口占用信息
 */
export async function getPortUsage(port: number): Promise<string> {
  if (process.platform !== 'darwin' && process.platform !== 'linux') {
    return 'Port usage information not available on this platform';
  }
  
  const { exec } = require('child_process');
  const execAsync = util.promisify(exec);
  
  try {
    const { stdout } = await execAsync(`lsof -i:${port}`);
    return stdout;
  } catch (error) {
    return `Port ${port} appears to be available`;
  }
}