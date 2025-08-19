import { EventEmitter } from 'events';
import * as dgram from 'dgram';
import { LRUCache } from 'lru-cache';
import { ErrorHandler } from '../types/error';
import { ErrorHandlerImpl } from '../errors/error-handler';
import { ValidationError, NetworkError, ErrorType } from '../types/error';
import { Peer, PeerManagerConfig } from '../types/dht';
import { Logger } from '../types/config';
import { Config } from '../types/config';
import * as utils from '../utils';
import { BaseManager, BaseManagerConfig, ManagerStats } from './base-manager';

/**
 * 节点管理器配置接口
 */
export interface PeerManagerExtendedConfig extends PeerManagerConfig, BaseManagerConfig {}


/**
 * Peer管理器 - 负责管理DHT节点和peer
 */
export class PeerManager extends BaseManager {
  private nodes: Peer[];
  private nodesDict: Record<string, number>;
  protected config: PeerManagerExtendedConfig;
  private dht: any;
  private rpc: any;
  private cacheManager: any;
  private nodeCreationTimes: Map<string, number>;
  
  constructor(config: PeerManagerExtendedConfig, dht: any, cacheManager: any, errorHandler?: ErrorHandlerImpl) {
    super(config, errorHandler);
    
    // 设置节点特定默认配置
    this.config = {
      enableMemoryMonitoring: true,
      memoryThreshold: 100 * 1024 * 1024, // 100MB
      cleanupInterval: 5 * 60 * 1000, // 5分钟
      maxNodeAge: 24 * 60 * 60 * 1000, // 24小时
      ...config
    };
    
    this.dht = dht;
    this.rpc = dht?._rpc;
    this.cacheManager = cacheManager;
    
    this.nodes = [];
    this.nodesDict = {};
    this.nodeCreationTimes = new Map();
  }
  
  /**
   * 导入peer
   */
  importPeer(peer: Peer): void {
    try {
      if (!peer || !peer.host || !peer.port) {
        throw new ValidationError('Invalid peer data', { peer });
      }
      
      const peerKey = utils.getPeerKey(peer);
      
      if (!this.nodesDict[peerKey]) {
        this.dht.addNode({ host: peer.host, port: peer.port });
      }
    } catch (error) {
      this.handleError('importPeer', error, { peer, errorType: error instanceof ValidationError ? ErrorType.VALIDATION : ErrorType.NETWORK });
    }
  }
  
  /**
   * 导入有用的peers
   */
  importUsefulPeers(): void {
    try {
      if (!this.cacheManager || !this.cacheManager.getUsefulPeers) {
        throw new ValidationError('Cache manager not available', { operation: 'importUsefulPeers' });
      }
      
      const usefulPeers = this.cacheManager.getUsefulPeers();
      const peers = utils.shuffle([...usefulPeers.values()]);
      
      for (const peer of peers) {
        if (Math.random() > Math.min(0.99, (this.rpc.pending.length / 50 + this.nodes.length / 500))) {
          this.importPeer(peer);
        }
      }
    } catch (error) {
      this.handleError('importUsefulPeers', error, { errorType: error instanceof ValidationError ? ErrorType.VALIDATION : ErrorType.SYSTEM });
    }
  }
  
  /**
   * 导出有用的peers
   */
  exportUsefulPeers(): Peer[] {
    const usefulPeers = this.cacheManager.getUsefulPeers();
    return [...usefulPeers.values()];
  }
  
  /**
   * 更新节点列表
   */
  updateNodes(): void {
    try {
      if (!this.dht || !this.dht._rpc || !this.dht._rpc.nodes) {
        throw new ValidationError('DHT RPC not available', { operation: 'updateNodes' });
      }
      
      const nodes = this.dht._rpc.nodes.toArray();
      this.nodes = nodes;
      this.nodesDict = nodes.reduce((prev: Record<string, number>, curr: Peer) => {
        prev[utils.getPeerKey(curr)] = 1;
        return prev;
      }, {});
      
      utils.shuffle(this.nodes);
    } catch (error) {
      this.handleError('updateNodes', error, { errorType: error instanceof ValidationError ? ErrorType.VALIDATION : ErrorType.NETWORK });
    }
  }
  
  /**
   * 获取节点数量
   */
  getNodeCount(): number {
    return this.nodes.length;
  }
  
  /**
   * 获取节点字典
   */
  getNodesDict(): Record<string, number> {
    return { ...this.nodesDict };
  }
  
  /**
   * 获取所有节点
   */
  getNodes(): Peer[] {
    return [...this.nodes];
  }
  
  /**
   * 检查是否需要扩展节点
   */
  shouldExpandNodes(lastReceiveTime: Date): boolean {
    const timeDiff = Date.now() - lastReceiveTime.getTime();
    return this.nodes.length < 5 || timeDiff > this.config.nodeRefreshTime;
  }
  
  /**
   * 检查是否需要调用findNode
   */
  shouldCallFindNode(node: Peer): boolean {
    const nodeKey = `${node.host}:${node.port}`;
    const findNodeCache = this.cacheManager.getFindNodeCache();
    const latestCalledPeers = this.cacheManager.getLatestCalledPeers();
    
    return !findNodeCache.get(nodeKey) && 
           !latestCalledPeers.get(nodeKey) && 
           Math.random() > this.config.findNodeProbability + this.rpc.pending.length / 10 && 
           this.nodes.length < this.config.maxNodes;
  }
  
  /**
   * 标记节点为已调用
   */
  markNodeAsCalled(node: Peer): void {
    const nodeKey = `${node.host}:${node.port}`;
    const findNodeCache = this.cacheManager.getFindNodeCache();
    const latestCalledPeers = this.cacheManager.getLatestCalledPeers();
    
    findNodeCache.set(nodeKey, 1);
    latestCalledPeers.set(nodeKey, 1);
  }
  
  /**
   * 检查节点数量是否过少
   */
  isNodeCountCritical(): boolean {
    return this.nodes.length <= 3;
  }
  
  /**
   * 设置DHT实例
   */
  setDHT(dht: any): void {
    this.dht = dht;
    this.rpc = dht?._rpc;
  }

  /**
   * 清理过期节点
   */
  cleanup(): void {
    try {
      const now = Date.now();
      const maxAge = this.config.maxNodeAge || 24 * 60 * 60 * 1000; // 24小时
      
      // 清理过期的节点
      this.nodes = this.nodes.filter(node => {
        const nodeKey = utils.getPeerKey(node);
        const creationTime = this.nodeCreationTimes.get(nodeKey);
        
        if (creationTime && (now - creationTime) > maxAge) {
          // 从节点字典中删除
          delete this.nodesDict[nodeKey];
          // 从创建时间映射中删除
          this.nodeCreationTimes.delete(nodeKey);
          return false;
        }
        return true;
      });
      
      // 清理节点创建时间映射中的无效条目
      for (const [nodeKey, creationTime] of this.nodeCreationTimes.entries()) {
        if ((now - creationTime) > maxAge) {
          this.nodeCreationTimes.delete(nodeKey);
          // 确保也从节点字典中删除
          delete this.nodesDict[nodeKey];
        }
      }
      
      this.emit('cleanupCompleted', {
        remainingNodes: this.nodes.length,
        cleanedNodes: this.nodes.length - this.nodes.length
      });
    } catch (error) {
      this.emit('cleanupError', error);
    }
  }
  
  /**
   * 添加节点
   */
  addNode(node: Peer): void {
    try {
      if (!node || !node.host || !node.port) {
        throw new ValidationError('Invalid node data', { node });
      }
      
      const nodeKey = utils.getPeerKey(node);
      
      if (!this.nodesDict[nodeKey]) {
        // 检查是否超过最大节点数限制
        if (this.nodes.length >= this.config.maxNodes) {
          this.cleanupOldNodes();
        }
        
        // 如果仍然超过限制，不添加新节点
        if (this.nodes.length >= this.config.maxNodes) {
          return;
        }
        
        this.nodes.push(node);
        this.nodesDict[nodeKey] = this.nodes.length - 1;
        this.nodeCreationTimes.set(nodeKey, Date.now());
        this.emit('node', node);
      }
    } catch (error) {
      this.handleError('addNode', error, { node, errorType: error instanceof ValidationError ? ErrorType.VALIDATION : ErrorType.SYSTEM });
    }
  }
  
  /**
   * 添加peer
   */
  addPeer(peerInfo: { peer: Peer; infoHash: Buffer }): void {
    try {
      if (!peerInfo || !peerInfo.peer || !peerInfo.infoHash) {
        throw new ValidationError('Invalid peer info', { peerInfo });
      }
      
      const { peer, infoHash } = peerInfo;
      const peerKey = utils.getPeerKey(peer);
      
      // 添加到缓存
      this.cacheManager.addPeerToCache(peerKey, { peer, infoHash });
      this.emit('peer', { infoHash, peer });
    } catch (error) {
      this.handleError(
        'addPeer',
        error instanceof Error ? error : new Error(String(error)),
        { peerInfo, errorType: error instanceof ValidationError ? ErrorType.VALIDATION : ErrorType.CACHE }
      );
    }
  }
  
  /**
   * 导出节点
   */
  exportNodes(): Peer[] {
    return [...this.nodes];
  }
  
  /**
   * 导入节点
   */
  importNodes(nodes: Peer[]): void {
    try {
      if (!Array.isArray(nodes)) {
        throw new ValidationError('Nodes must be an array', { nodes });
      }
      
      for (const node of nodes) {
        this.addNode(node);
      }
    } catch (error) {
      this.handleError(
        'importNodes',
        error instanceof Error ? error : new Error(String(error)),
        { nodes, errorType: error instanceof ValidationError ? ErrorType.VALIDATION : ErrorType.SYSTEM }
      );
    }
  }
  
  /**
   * 导出peers
   */
  exportPeers(): Peer[] {
    return this.cacheManager.getAllPeers();
  }
  
  /**
   * 导入peers
   */
  importPeers(peers: Peer[]): void {
    try {
      if (!Array.isArray(peers)) {
        throw new ValidationError('Peers must be an array', { peers });
      }
      
      for (const peer of peers) {
        this.cacheManager.addPeerToCache(utils.getPeerKey(peer), peer);
      }
    } catch (error) {
      this.handleError(
        'importPeers',
        error instanceof Error ? error : new Error(String(error)),
        { peers, errorType: error instanceof ValidationError ? ErrorType.VALIDATION : ErrorType.CACHE }
      );
    }
  }
  
  /**
   * 获取节点统计信息
   */
  getPeerStats() {
    return {
      nodeCount: this.nodes.length,
      peerCount: this.cacheManager.getPeerCount(),
      cacheStats: this.cacheManager.getStats()
    };
  }
  
  /**
   * 清理节点数据
   */
  clearPeerData(): void {
    this.nodes = [];
    this.nodesDict = {};
    this.nodeCreationTimes.clear();
    this.emit('peerDataCleared');
  }
  
  /**
   * 清理过期节点
   */
  public cleanupOldNodes(): void {
    const now = Date.now();
    const maxAge = this.config.maxNodeAge || 24 * 60 * 60 * 1000;
    
    // 移除过期节点
    this.nodes = this.nodes.filter((node, index) => {
      const nodeKey = utils.getPeerKey(node);
      const creationTime = this.nodeCreationTimes.get(nodeKey);
      
      if (creationTime && (now - creationTime) > maxAge) {
        delete this.nodesDict[nodeKey];
        this.nodeCreationTimes.delete(nodeKey);
        return false;
      }
      return true;
    });
    
    // 重建节点字典
    this.nodesDict = {};
    this.nodes.forEach((node, index) => {
      this.nodesDict[utils.getPeerKey(node)] = index;
    });
  }
  
  /**
   * 验证配置
   */
  protected validateConfig(config: BaseManagerConfig): void {
    const peerConfig = config as PeerManagerConfig;
    if (!peerConfig) {
      throw new ValidationError('PeerManager config is required', { config: peerConfig });
    }
    
    if (peerConfig.maxNodes !== undefined && (typeof peerConfig.maxNodes !== 'number' || peerConfig.maxNodes <= 0)) {
      throw new ValidationError('maxNodes must be a positive number', { maxNodes: peerConfig.maxNodes });
    }
    
    if (peerConfig.cleanupInterval !== undefined && (typeof peerConfig.cleanupInterval !== 'number' || peerConfig.cleanupInterval <= 0)) {
      throw new ValidationError('cleanupInterval must be a positive number', { cleanupInterval: peerConfig.cleanupInterval });
    }
    
    if (peerConfig.maxNodeAge !== undefined && (typeof peerConfig.maxNodeAge !== 'number' || peerConfig.maxNodeAge <= 0)) {
      throw new ValidationError('maxNodeAge must be a positive number', { maxNodeAge: peerConfig.maxNodeAge });
    }
  }
  

  

  

  
  /**
   * 深度清理
   */
  private deepCleanup(): void {
    try {
      // 清理一半最老的节点
      const nodeAges = Array.from(this.nodeCreationTimes.entries())
        .sort((a, b) => a[1] - b[1]);
      
      const nodesToRemove = Math.floor(nodeAges.length / 2);
      for (let i = 0; i < nodesToRemove; i++) {
        const [nodeKey] = nodeAges[i];
        const index = this.nodesDict[nodeKey];
        
        if (index !== undefined) {
          this.nodes.splice(index, 1);
          delete this.nodesDict[nodeKey];
          this.nodeCreationTimes.delete(nodeKey);
        }
      }
      
      // 重建节点字典
      this.nodesDict = {};
      this.nodes.forEach((node, index) => {
        this.nodesDict[utils.getPeerKey(node)] = index;
      });
      
      // 清理缓存
      if (this.cacheManager && this.cacheManager.clearAll) {
        this.cacheManager.clearAll();
      }
      
      // 强制垃圾回收（如果可用）
      if (global.gc) {
        global.gc();
      }
    } catch (error) {
      this.handleError('deepCleanup', error instanceof Error ? error : new Error(String(error)), { errorType: ErrorType.SYSTEM });
    }
  }
  
  /**
   * 停止定期清理任务
   */
  protected stopPeriodicCleanup(): void {
    try {
      if (this.cleanupInterval) {
        clearInterval(this.cleanupInterval);
        this.cleanupInterval = null;
      }
    } catch (error) {
      this.handleError('stopPeriodicCleanup', error instanceof Error ? error : new Error(String(error)), { errorType: ErrorType.SYSTEM });
    }
  }
  
  /**
   * 获取管理器名称
   */
  protected getManagerName(): string {
    return 'PeerManager';
  }

  /**
   * 执行清理操作
   */
  protected performCleanup(): void {
    try {
      // 清理过期节点
      this.cleanupOldNodes();
      
      // 检查内存使用情况
      if (this.config.enableMemoryMonitoring) {
        // 内存使用检查由基类处理
      }
    } catch (error) {
      this.handleError('performCleanup', error instanceof Error ? error : new Error(String(error)), { errorType: ErrorType.SYSTEM });
    }
  }

  /**
   * 清理数据
   */
  protected clearData(): void {
    this.clearPeerData();
  }

  /**
   * 获取统计信息
   */
  getStats(): ManagerStats & any {
    return {
      ...super.getStats(),
      ...this.getPeerStats()
    };
  }

  /**
   * 节点特定的错误处理
   */
  protected handlePeerError(operation: string, error: any, context?: any): void {
    const peerError = new ValidationError(
      `Peer operation failed: ${operation}`,
      { operation, ...context, cause: error instanceof Error ? error : new Error(String(error)) }
    );
    
    super.handleError(operation, peerError, context);
  }

  /**
   * 执行深度清理
   */
  protected performDeepCleanup(): void {
    try {
      // 清理所有节点和peer
      this.clearPeerData();
      
      // 调用父类的深度清理
      super.performDeepCleanup();
    } catch (error) {
      this.handlePeerError('performDeepCleanup', error);
    }
  }
}