import * as crypto from 'crypto';
import * as DHT from '../dht/dht';
import { getNeighborId, isNodeId, parseNodes } from '../utils/dht-utils';
import { NetworkError } from '../types/error';
import { ErrorHandlerImpl } from '../errors/error-handler';
import { PeerManager } from './peer-manager';
import { Node, DHTManagerConfig, DHTManagerExtendedConfig } from '../types/dht';
import { BaseManager, ManagerStats } from './base-manager';





// 引导节点
const bootstrapNodes: Node[] = [
  // BitTorrent官方节点
  // { host: 'router.bittorrent.com', port: 6881, id: Buffer.alloc(20) },
  // { host: 'router.utorrent.com', port: 6881, id: Buffer.alloc(20) },
  // { host: 'dht.transmissionbt.com', port: 6881, id: Buffer.alloc(20) },
  // 其他稳定节点
  { host: 'dht.libtorrent.org', port: 25401, id: Buffer.alloc(20) },
  { host: 'dht.aelitis.com', port: 6881, id: Buffer.alloc(20) },
  { host: 'dht.bittorrent.com', port: 6881, id: Buffer.alloc(20) },
  { host: 'dht.addict.ninja', port: 6881, id: Buffer.alloc(20) },
  { host: 'dht.ccc.de', port: 6881, id: Buffer.alloc(20) },
  { host: 'dht.tbtt.org', port: 6881, id: Buffer.alloc(20) },

  // 备用节点
  { host: 'router.bitcomet.com', port: 6881, id: Buffer.alloc(20) },
  { host: 'dht.vuze.com', port: 6881, id: Buffer.alloc(20) },
  { host: 'dht.trackon.org', port: 6881, id: Buffer.alloc(20) },
];

/**
 * DHT管理器 - 负责管理DHT网络逻辑
 */
export class DHTManager extends BaseManager {
  protected config: DHTManagerExtendedConfig;
  private peerManager: PeerManager;
  private dht: any;
  private refreshInterval: NodeJS.Timeout | null;
  private announceInterval: NodeJS.Timeout | null;
  private memoryCleanupInterval: NodeJS.Timeout | null;

  constructor(config: DHTManagerConfig, errorHandler: ErrorHandlerImpl, peerManager: PeerManager) {
    super(config, errorHandler);
    
    this.peerManager = peerManager;
    
    // 设置默认配置
    this.config = Object.assign({
      address: '0.0.0.0',
      port: 6881,
      bootstrapNodes: bootstrapNodes,
      enableMemoryMonitoring: true,
      memoryThreshold: 100 * 1024 * 1024, // 100MB
      cleanupInterval: 5 * 60 * 1000, // 5分钟
      maxRetries: 3,
      retryDelay: 1000
    }, config);

    this.dht = null;
    this.refreshInterval = null;
    this.announceInterval = null;
    this.memoryCleanupInterval = null;
  }

  /**
   * 启动DHT网络
   */
  start(): void {
    if (this.isDHTRunning()) {
      return;
    }

    try {
      // 创建DHT实例 - 只传递DHT类支持的参数
      const dhtConfig = {
        port: this.config.port,
        bootstrap: this.config.bootstrap,
        bootstrapNodes: this.config.bootstrapNodes,
        maxTables: this.config.maxTables,
        maxValues: this.config.maxValues,
        maxPeers: this.config.maxPeers,
        maxAge: this.config.maxAge,
        timeBucketOutdated: this.config.timeBucketOutdated
      };
      
      this.dht = new DHT.DHT(dhtConfig);

      // 设置事件监听
      this.setupEventListeners();

      // 启动定时任务
      this.startPeriodicTasks();

      // 开始监听端口
      this.listen(this.config.port, this.config.address);

      this.emit('started');
    } catch (error) {
      const networkError = new NetworkError(
        `Failed to start DHT: ${error instanceof Error ? error.message : String(error)}`,
        { operation: 'dht_start', config: this.config, cause: error instanceof Error ? error : new Error(String(error)) }
      );
      this.handleError('start', networkError);
      throw networkError;
    }
  }

  /**
   * 停止DHT网络
   */
  stop(): void {
    if (!this.isDHTRunning()) {
      return;
    }

    try {
      // 清除定时任务
      this.clearPeriodicTasks();

      // 停止DHT
      if (this.dht) {
        this.dht.destroy();
        this.dht = null;
      }


      this.emit('stopped');
    } catch (error) {
      const networkError = new NetworkError(
        `Failed to stop DHT: ${error instanceof Error ? error.message : String(error)}`,
        { operation: 'dht_stop', cause: error instanceof Error ? error : new Error(String(error)) }
      );
      this.handleError('stop', networkError);
    }
  }

  /**
   * 设置事件监听器
   */
  public setupEventListeners(): void {
    if (!this.dht) return;

    // 监听节点事件
    this.dht.on('node', (node: any) => {
      this.peerManager.addNode(node);
      this.emit('node', node);
    });

    // 监听peer事件
    this.dht.on('peer', (peer: any, infoHash: Buffer) => {
      this.peerManager.addPeer({ infoHash, peer });
      this.emit('peer', { infoHash, peer });
    });

    // 监听get_peers事件 - 参考原始dht-sniffer实现
    this.dht.on('get_peers', (data: any) => {
      this.peerManager.importPeer(data.peer);
      this.emit('infoHash', { infoHash: data.infoHash, peer: data.peer });
    });

    // 监听错误事件
    this.dht.on('error', (error: Error) => {
      const networkError = new NetworkError(
        `DHT error: ${error.message}`,
        { operation: 'dht_event', cause: error }
      );
      this.handleError('setupEventListeners', networkError);
      this.emit('error', networkError);
    });

    // 监听警告事件
    this.dht.on('warning', (warning: string) => {
      this.emit('warning', warning);
    });
  }

  /**
   * 启动定时任务
   */
  private startPeriodicTasks(): void {
    // 定期刷新节点
    this.refreshInterval = setInterval(() => {
      this.refreshNodes();
    }, this.config.refreshPeriod);

    // 定期announce
    this.announceInterval = setInterval(() => {
      // 使用默认的infoHash和port进行announce
      const defaultInfoHash = this.config.defaultInfoHash || crypto.randomBytes(20).toString('hex');
      const defaultPort = this.config.defaultPort || 6881;
      this.announce(defaultInfoHash, defaultPort);
    }, this.config.announcePeriod);
    
    // 定期内存清理
    if (this.config.enableMemoryMonitoring) {
      this.memoryCleanupInterval = setInterval(() => {
        this.performMemoryCleanup();
      }, this.config.cleanupInterval);
    }
  }

  /**
   * 清除定时任务
   */
  private clearPeriodicTasks(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }

    if (this.announceInterval) {
      clearInterval(this.announceInterval);
      this.announceInterval = null;
    }
    
    if (this.memoryCleanupInterval) {
      clearInterval(this.memoryCleanupInterval);
      this.memoryCleanupInterval = null;
    }
  }

  /**
   * 刷新节点
   */
  private refreshNodes(): void {
    if (!this.dht || !this.isDHTRunning()) return;

    const operationKey = 'refreshNodes';
    this.executeWithRetry(async () => {
      // dht类没有refresh方法，使用bootstrap来刷新网络连接
      this.dht._bootstrap(true);
      this.emit('refresh');
    }, operationKey);
  }

  /**
   * 向DHT网络声明资源
   */
  public announce(infoHash: string, port: number, callback?: (err: Error | null) => void): void {
    if (!this.isDHTRunning()) {
      const error = new NetworkError('DHT is not running', { operation: 'announce', infoHash });
      this.handleError('announce', error);
      if (callback) callback(error);
      return;
    }
    
    this.executeWithRetry(
      async () => {
        this.dht!.announce(infoHash, port, (err: Error | null) => {
          if (err) {
            this.handleError('announce', err, { infoHash, port });
            if (callback) callback(err);
          } else {
            this.emit('announce', { infoHash, port });
            if (callback) callback(null);
          }
        });
      },
      'announce',
      { infoHash, port }
    );
  }

  /**
   * 查找节点 - 参考原始dht-sniffer实现
   */
  findNode(peer: any, nodeId?: Buffer): void {
    if (!this.dht || !this.isDHTRunning()) return;

    try {
      // 获取或生成目标ID
      const target = nodeId !== undefined
        ? getNeighborId(nodeId, this.dht.nodeId)
        : this.dht.nodeId;

      // 创建find_node消息
      const message = {
        t: crypto.randomBytes(4),
        y: 'q',
        q: 'find_node',
        a: {
          id: this.dht.nodeId,
          target: crypto.randomBytes(20)
        }
      };

      // 发送查询
      this.dht._rpc.query(peer, message, (err: any, reply: any) => {
        try {
          if (peer && peer.id && this.dht._rpc.nodes.get(peer.id) && isNodeId(peer.id, 20)) {
            if (err && (err.code === 'EUNEXPECTEDNODE' || err.code === 'ETIMEDOUT')) {
              this.dht._rpc.remove(peer.id);
            }
          }
        } catch (e) {
          // do nothing
        }

        if (reply && reply.r && reply.r.nodes) {
          const nodes = parseNodes(reply.r.nodes, 20);
          for (const node of nodes) {
            if (isNodeId(node.id, 20)) {
              this.peerManager.importPeer(node);
            }
          }
        }
      });

      this.emit('findNode', peer, target);
    } catch (error) {
      const networkError = new NetworkError(
        `Failed to find node: ${error instanceof Error ? error.message : String(error)}`,
        { operation: 'dht_find_node', peer, cause: error instanceof Error ? error : new Error(String(error)) },
        true
      );
      this.handleError('findNode', networkError);
    }
  }

  /**
   * 查找peers - 对应原始dht的lookup方法
   */
  lookup(infoHash: Buffer, callback?: (err: Error | null, totalNodes?: number) => void): void {
    if (!this.dht || !this.isDHTRunning()) return;

    try {
      this.dht.lookup(infoHash, (err: Error | null, totalNodes?: number) => {
        if (err) {
          const networkError = new NetworkError(
            `DHT lookup failed for ${infoHash.toString('hex')}: ${err.message}`,
            { operation: 'dht_lookup', infoHash: infoHash.toString('hex'), cause: err }
          );
          this.handleError('lookup', networkError);
          this.emit('error', networkError);
        }

        if (callback) {
          callback(err, totalNodes);
        }
      });

      this.emit('lookup', infoHash);
    } catch (error) {
      const networkError = new NetworkError(
        `Failed to lookup: ${error instanceof Error ? error.message : String(error)}`,
        { operation: 'dht_lookup', infoHash: infoHash.toString('hex'), cause: error instanceof Error ? error : new Error(String(error)) }
      );
      this.handleError('lookup', networkError);
    }
  }

  /**
   * 获取peer
   */
  getPeers(infoHash: Buffer): void {
    if (!this.dht || !this.isDHTRunning()) return;

    try {
      this.dht.getPeers(infoHash);
      this.emit('getPeers', infoHash);
    } catch (error) {
      const networkError = new NetworkError(
        `Failed to get peers: ${error instanceof Error ? error.message : String(error)}`,
        { operation: 'dht_get_peers', infoHash: infoHash.toString('hex'), cause: error instanceof Error ? error : new Error(String(error)) }
      );
      this.handleError('getPeers', networkError);
    }
  }

  /**
   * 导出节点
   */
  exportNodes(): any[] {
    return this.peerManager.exportNodes();
  }

  /**
   * 导入节点
   */
  importNodes(nodes: any[]): void {
    this.peerManager.importNodes(nodes);
  }

  /**
   * 导出peers
   */
  exportPeers(): any[] {
    return this.peerManager.exportPeers();
  }

  /**
   * 导入peers
   */
  importPeers(peers: any[]): void {
    this.peerManager.importPeers(peers);
  }

  /**
   * Bootstrap DHT网络
   */
  bootstrap(populate: boolean = true): void {
    if (!this.dht || !this.isDHTRunning()) return;

    try {
      this.dht._bootstrap(populate);
      if (this.config.enhanceBootstrap) {
        this.config.bootstrapNodes?.forEach(node => {
          this.findNode(node);
        });
      }

      this.emit('bootstrap', populate);
    } catch (error) {
      const networkError = new NetworkError(
        `Failed to bootstrap: ${error instanceof Error ? error.message : String(error)}`,
        { operation: 'dht_bootstrap', populate, cause: error instanceof Error ? error : new Error(String(error)) }
      );
      this.handleError('bootstrap', networkError);
    }
  }

  /**
   * 刷新DHT网络
   */
  refresh(): void {
    if (!this.dht || !this.isDHTRunning()) return;

    try {
      // DHT类没有refresh方法，使用bootstrap来刷新网络连接
      this.dht._bootstrap(true);
      this.emit('refresh');
    } catch (error) {
      const networkError = new NetworkError(
        `Failed to refresh: ${error instanceof Error ? error.message : String(error)}`,
        { operation: 'dht_refresh', cause: error instanceof Error ? error : new Error(String(error)) }
      );
      this.handleError('refresh', networkError);
    }
  }

  /**
   * 添加节点
   */
  addNode(node: any): void {
    if (!this.dht || !this.isDHTRunning()) return;

    try {
      this.dht.addNode(node);
      this.emit('addNode', node);
    } catch (error) {
      const networkError = new NetworkError(
        `Failed to add node: ${error instanceof Error ? error.message : String(error)}`,
        { operation: 'dht_add_node', peer: node, cause: error instanceof Error ? error : new Error(String(error)) }
      );
      this.handleError('addNode', networkError);
    }
  }

  /**
   * 移除节点
   */
  removeNode(nodeId: Buffer): void {
    if (!this.dht || !this.isDHTRunning()) return;

    try {
      this.dht.removeNode(nodeId);
      this.emit('removeNode', nodeId);
    } catch (error) {
      const networkError = new NetworkError(
        `Failed to remove node: ${error instanceof Error ? error.message : String(error)}`,
        { operation: 'dht_remove_node', nodeId: nodeId.toString('hex'), cause: error instanceof Error ? error : new Error(String(error)) }
      );
      this.handleError('removeNode', networkError);
    }
  }

  /**
   * 获取DHT统计信息
   */
  getDHTStats(): any {
    const peerStats = this.peerManager.getStats();

    return {
      isRunning: this.isDHTRunning(),
      dht: this.dht ? {
        nodes: this.dht.nodes ? this.dht.nodes.length : 0,
        pendingCalls: this.dht._rpc ? this.dht._rpc.pending.length : 0,
        listening: this.dht.listening || false,
        destroyed: this.dht.destroyed || false
      } : null,
      ...peerStats
    };
  }

  /**
   * 获取DHT实例
   */
  getDHT(): any {
    return this.dht;
  }

  /**
   * 检查是否正在运行
   */
  isDHTRunning(): boolean {
    return this.dht !== null;
  }

  /**
   * 公共方法：检查是否正在运行
   */
  getIsRunning(): boolean {
    return this.isDHTRunning();
  }

  /**
   * 获取DHT地址信息
   */
  address(): any {
    if (!this.dht || !this.isDHTRunning()) return null;

    try {
      return this.dht.address();
    } catch (error) {
      const networkError = new NetworkError(
        `Failed to get address: ${error instanceof Error ? error.message : String(error)}`,
        { operation: 'dht_address', cause: error instanceof Error ? error : new Error(String(error)) }
      );
      this.handleError('address', networkError);
      return null;
    }
  }

  /**
   * 检查DHT是否准备好
   */
  isReady(): boolean {
    return this.dht ? this.dht.ready || false : false;
  }

  /**
   * 监听端口
   */
  listen(port?: number, address?: string, callback?: () => void): void {
    if (!this.dht) return;

    this.executeWithRetry(async () => {
      // 验证和转换参数类型
      const validatedPort = typeof port === 'number' && port > 0 && port <= 65535 ? port : undefined;
      const validatedAddress = typeof address === 'string' && address.trim() !== '' ? address.trim() : undefined;
      
      if (validatedPort && validatedAddress && callback) {
        this.dht.listen(validatedPort, validatedAddress, callback);
      } else if (validatedPort && callback) {
        this.dht.listen(validatedPort, callback);
      } else if (validatedPort) {
        this.dht.listen(validatedPort);
      } else {
        this.dht.listen();
      }
      this.emit('listening');
    }, 'listen', { port, address });
  }
  

  
  /**
   * 执行内存清理
   */
  public performMemoryCleanup(): void {
    if (!this.config.enableMemoryMonitoring) return;
    
    const memoryUsage = process.memoryUsage();
    const threshold = this.config.memoryThreshold || 100 * 1024 * 1024;
    
    // 检查内存使用情况
    if (memoryUsage.heapUsed > threshold) {
      this.emit('memoryWarning', {
        heapUsed: memoryUsage.heapUsed,
        heapTotal: memoryUsage.heapTotal,
        external: memoryUsage.external,
        rss: memoryUsage.rss,
        threshold
      });
      
      // 执行清理操作
      this.cleanupMemory();
      // 使用BaseManager的通用内存清理功能
      super.performMemoryCleanup();
    }
  }
  
  /**
   * 清理内存
   */
  private cleanupMemory(): void {
    // 清理PeerManager中的过期节点
    if (this.peerManager && typeof this.peerManager.cleanupOldNodes === 'function') {
      this.peerManager.cleanupOldNodes();
    }
    
    // 清理DHT中的过期节点
    if (this.dht && this.dht._rpc && this.dht._rpc.nodes) {
      const nodes = this.dht._rpc.nodes;
      const now = Date.now();
      const maxAge = 30 * 60 * 1000; // 30分钟
      
      // 清理长时间未响应的节点
      for (const [nodeId, node] of nodes.entries()) {
        if (node.lastSeen && (now - node.lastSeen) > maxAge) {
          this.dht._rpc.remove(nodeId);
        }
      }
    }
    
    // 清理pending calls
    if (this.dht && this.dht._rpc && this.dht._rpc.pending) {
      const pending = this.dht._rpc.pending;
      const now = Date.now();
      const maxPendingTime = 60 * 1000; // 1分钟
      
      for (let i = pending.length - 1; i >= 0; i--) {
        const call = pending[i];
        if (call.timestamp && (now - call.timestamp) > maxPendingTime) {
          pending.splice(i, 1);
        }
      }
    }
    
    // 强制垃圾回收（如果可用）
    if (global.gc) {
      global.gc();
    }
    
    this.emit('memoryCleaned');
  }
  
  /**
   * 获取内存使用统计
   */
  getMemoryStats(): any {
    const memoryUsage = process.memoryUsage();
    const threshold = this.config.memoryThreshold || 100 * 1024 * 1024;
    
    return {
      heapUsed: memoryUsage.heapUsed,
      heapTotal: memoryUsage.heapTotal,
      external: memoryUsage.external,
      rss: memoryUsage.rss,
      threshold,
      usagePercentage: Math.round((memoryUsage.heapUsed / threshold) * 100),
      isMemoryWarning: memoryUsage.heapUsed > threshold
    };
  }
  
  /**
   * 获取管理器名称
   */
  protected getManagerName(): string {
    return 'DHTManager';
  }

  /**
   * 执行清理操作
   */
  protected performCleanup(): void {
    // DHT特定的清理逻辑（如果需要）
  }

  /**
   * 清理数据
   */
  protected clearData(): void {
    // DHT特定的数据清理（如果需要）
  }

  /**
   * 获取统计信息
   */
  getStats(): ManagerStats & any {
    return {
      ...super.getStats(),
      ...this.getDHTStats()
    };
  }

  /**
   * DHT特定的错误处理
   */
  protected handleDHTError(operation: string, error: any, context?: any): void {
    const networkError = new NetworkError(
      `DHT operation failed: ${operation}`,
      { operation, ...context, cause: error instanceof Error ? error : new Error(String(error)) }
    );
    
    super.handleError(operation, networkError, context);
  }

  /**
   * 执行深度清理
   */
  protected performDeepCleanup(): void {
    try {
      this.stop();
      this.removeAllListeners();
      super.performDeepCleanup();
    } catch (error) {
      this.handleDHTError('performDeepCleanup', error);
    }
  }

  /**
   * 销毁管理器
   */
  destroy(): void {
    this.stop();
    this.removeAllListeners();
  }
}

// 导出DHTManagerConfig类型
export type { DHTManagerConfig } from '../types/dht';