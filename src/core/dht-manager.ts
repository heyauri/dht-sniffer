import { EventEmitter } from 'events';
import * as DHT from '../dht/dht';
import * as utils from '../utils';
import { NetworkError, ErrorHandler } from '../utils/error-handler';
import { PeerManager } from './peer-manager';

/**
 * DHT管理器配置
 */
export interface DHTManagerConfig {
  address: string;
  port: number;
  bootstrap?: string[];
  nodesMaxSize: number;
  refreshPeriod: number;
  announcePeriod: number;
}

/**
 * DHT管理器 - 负责管理DHT网络逻辑
 */
export class DHTManager extends EventEmitter {
  private config: DHTManagerConfig;
  private errorHandler: ErrorHandler;
  private peerManager: PeerManager;
  private dht: any;
  private refreshInterval: NodeJS.Timeout | null;
  private announceInterval: NodeJS.Timeout | null;
  private isRunning: boolean;
  
  constructor(config: DHTManagerConfig, errorHandler: ErrorHandler, peerManager: PeerManager) {
    super();
    this.config = config;
    this.errorHandler = errorHandler;
    this.peerManager = peerManager;
    
    this.dht = null;
    this.refreshInterval = null;
    this.announceInterval = null;
    this.isRunning = false;
  }
  
  /**
   * 启动DHT网络
   */
  start(): void {
    if (this.isRunning) {
      return;
    }
    
    try {
      // 创建DHT实例
      this.dht = new DHT.DHT(this.config);
      
      // 设置事件监听
      this.setupEventListeners();
      
      // 启动定时任务
      this.startPeriodicTasks();
      
      this.isRunning = true;
      this.emit('started');
    } catch (error) {
      const networkError = new NetworkError(
        `Failed to start DHT: ${error instanceof Error ? error.message : String(error)}`,
        { operation: 'dht_start', config: this.config },
        error instanceof Error ? error : new Error(String(error))
      );
      this.errorHandler.handleError(networkError);
      throw networkError;
    }
  }
  
  /**
   * 停止DHT网络
   */
  stop(): void {
    if (!this.isRunning) {
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
      
      this.isRunning = false;
      this.emit('stopped');
    } catch (error) {
      const networkError = new NetworkError(
        `Failed to stop DHT: ${error instanceof Error ? error.message : String(error)}`,
        { operation: 'dht_stop' },
        error instanceof Error ? error : new Error(String(error))
      );
      this.errorHandler.handleError(networkError);
    }
  }
  
  /**
   * 设置事件监听器
   */
  private setupEventListeners(): void {
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
        { operation: 'dht_event' },
        error
      );
      this.errorHandler.handleError(networkError);
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
      this.announce();
    }, this.config.announcePeriod);
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
  }
  
  /**
   * 刷新节点
   */
  private refreshNodes(): void {
    if (!this.dht || !this.isRunning) return;
    
    try {
      this.dht.refresh();
      this.emit('refresh');
    } catch (error) {
      const networkError = new NetworkError(
        `Failed to refresh nodes: ${error instanceof Error ? error.message : String(error)}`,
        { operation: 'dht_refresh' },
        error instanceof Error ? error : new Error(String(error))
      );
      this.errorHandler.handleError(networkError);
    }
  }
  
  /**
   * Announce
   */
  private announce(): void {
    if (!this.dht || !this.isRunning) return;
    
    try {
      this.dht.announce();
      this.emit('announce');
    } catch (error) {
      const networkError = new NetworkError(
        `Failed to announce: ${error instanceof Error ? error.message : String(error)}`,
        { operation: 'dht_announce' },
        error instanceof Error ? error : new Error(String(error))
      );
      this.errorHandler.handleError(networkError);
    }
  }
  
  /**
   * 查找节点 - 参考原始dht-sniffer实现
   */
  findNode(peer: any, nodeId?: Buffer): void {
    if (!this.dht || !this.isRunning) return;
    
    try {
      const nodeKey = utils.getPeerKey(peer);
      
      // 获取或生成目标ID
      const target = nodeId !== undefined 
        ? utils.getNeighborId(nodeId, this.dht.nodeId) 
        : this.dht.nodeId;
      
      // 创建find_node消息
      const message = {
        t: require('crypto').randomBytes(4),
        y: 'q',
        q: 'find_node',
        a: {
          id: this.dht.nodeId,
          target: require('crypto').randomBytes(20)
        }
      };
      
      // 发送查询
      this.dht._rpc.query(peer, message, (err: any, reply: any) => {
        try {
          if (peer && peer.id && this.dht._rpc.nodes.get(peer.id) && utils.isNodeId(peer.id, 20)) {
            if (err && (err.code === 'EUNEXPECTEDNODE' || err.code === 'ETIMEDOUT')) {
              this.dht._rpc.remove(peer.id);
            }
          }
        } catch (e) {
          // do nothing
        }
        
        if (reply && reply.r && reply.r.nodes) {
          const nodes = utils.parseNodes(reply.r.nodes, 20);
          for (const node of nodes) {
            if (utils.isNodeId(node.id, 20)) {
              this.peerManager.importPeer(node);
            }
          }
        }
      });
      
      this.emit('findNode', peer, target);
    } catch (error) {
      const networkError = new NetworkError(
        `Failed to find node: ${error instanceof Error ? error.message : String(error)}`,
        { operation: 'dht_find_node', peer },
        error instanceof Error ? error : new Error(String(error))
      );
      this.errorHandler.handleError(networkError);
    }
  }
  
  /**
   * 查找peers - 对应原始dht的lookup方法
   */
  lookup(infoHash: Buffer, callback?: (err: Error | null, totalNodes?: number) => void): void {
    if (!this.dht || !this.isRunning) return;
    
    try {
      this.dht.lookup(infoHash, (err: Error | null, totalNodes?: number) => {
        if (err) {
          const networkError = new NetworkError(
            `DHT lookup failed for ${infoHash.toString('hex')}: ${err.message}`,
            { operation: 'dht_lookup', infoHash: infoHash.toString('hex') },
            err
          );
          this.errorHandler.handleError(networkError);
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
        { operation: 'dht_lookup', infoHash: infoHash.toString('hex') },
        error instanceof Error ? error : new Error(String(error))
      );
      this.errorHandler.handleError(networkError);
    }
  }
  
  /**
   * 获取peer
   */
  getPeers(infoHash: Buffer): void {
    if (!this.dht || !this.isRunning) return;
    
    try {
      this.dht.getPeers(infoHash);
      this.emit('getPeers', infoHash);
    } catch (error) {
      const networkError = new NetworkError(
        `Failed to get peers: ${error instanceof Error ? error.message : String(error)}`,
        { operation: 'dht_get_peers', infoHash: infoHash.toString('hex') },
        error instanceof Error ? error : new Error(String(error))
      );
      this.errorHandler.handleError(networkError);
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
    if (!this.dht || !this.isRunning) return;
    
    try {
      this.dht._bootstrap(populate);
      this.emit('bootstrap', populate);
    } catch (error) {
      const networkError = new NetworkError(
        `Failed to bootstrap: ${error instanceof Error ? error.message : String(error)}`,
        { operation: 'dht_bootstrap', populate },
        error instanceof Error ? error : new Error(String(error))
      );
      this.errorHandler.handleError(networkError);
    }
  }
  
  /**
   * 刷新DHT网络
   */
  refresh(): void {
    if (!this.dht || !this.isRunning) return;
    
    try {
      this.dht.refresh();
      this.emit('refresh');
    } catch (error) {
      const networkError = new NetworkError(
        `Failed to refresh: ${error instanceof Error ? error.message : String(error)}`,
        { operation: 'dht_refresh' },
        error instanceof Error ? error : new Error(String(error))
      );
      this.errorHandler.handleError(networkError);
    }
  }
  
  /**
   * 添加节点
   */
  addNode(node: any): void {
    if (!this.dht || !this.isRunning) return;
    
    try {
      this.dht.addNode(node);
      this.emit('addNode', node);
    } catch (error) {
      const networkError = new NetworkError(
        `Failed to add node: ${error instanceof Error ? error.message : String(error)}`,
        { operation: 'dht_add_node', peer: node },
        error instanceof Error ? error : new Error(String(error))
      );
      this.errorHandler.handleError(networkError);
    }
  }
  
  /**
   * 移除节点
   */
  removeNode(nodeId: Buffer): void {
    if (!this.dht || !this.isRunning) return;
    
    try {
      this.dht.removeNode(nodeId);
      this.emit('removeNode', nodeId);
    } catch (error) {
      const networkError = new NetworkError(
        `Failed to remove node: ${error instanceof Error ? error.message : String(error)}`,
        { operation: 'dht_remove_node', nodeId: nodeId.toString('hex') },
        error instanceof Error ? error : new Error(String(error))
      );
      this.errorHandler.handleError(networkError);
    }
  }
  
  /**
   * 获取统计信息
   */
  getStats() {
    const peerStats = this.peerManager.getStats();
    
    return {
      isRunning: this.isRunning,
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
    return this.isRunning;
  }
  
  /**
   * 获取DHT地址信息
   */
  address(): any {
    if (!this.dht || !this.isRunning) return null;
    
    try {
      return this.dht.address();
    } catch (error) {
      const networkError = new NetworkError(
        `Failed to get address: ${error instanceof Error ? error.message : String(error)}`,
        { operation: 'dht_address' },
        error instanceof Error ? error : new Error(String(error))
      );
      this.errorHandler.handleError(networkError);
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
    
    try {
      if (port && address && callback) {
        this.dht.listen(port, address, callback);
      } else if (port && callback) {
        this.dht.listen(port, callback);
      } else if (port) {
        this.dht.listen(port);
      } else {
        this.dht.listen();
      }
      this.emit('listening');
    } catch (error) {
      const networkError = new NetworkError(
        `Failed to listen: ${error instanceof Error ? error.message : String(error)}`,
        { operation: 'dht_listen', port, address },
        error instanceof Error ? error : new Error(String(error))
      );
      this.errorHandler.handleError(networkError);
    }
  }
}