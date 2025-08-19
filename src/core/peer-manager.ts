import { EventEmitter } from 'events';
import { LRUCache } from 'lru-cache';
import * as utils from '../utils';
import { Peer } from '../types';

/**
 * Peer管理器配置
 */
export interface PeerManagerConfig {
  maxNodes: number;
  nodeRefreshTime: number;
  findNodeProbability: number;
}

/**
 * Peer管理器 - 负责管理DHT节点和peer
 */
export class PeerManager extends EventEmitter {
  private nodes: Peer[];
  private nodesDict: Record<string, number>;
  private config: PeerManagerConfig;
  private dht: any;
  private rpc: any;
  private cacheManager: any;
  
  constructor(config: PeerManagerConfig, dht: any, cacheManager: any) {
    super();
    this.config = config;
    this.dht = dht;
    this.rpc = dht?._rpc;
    this.cacheManager = cacheManager;
    
    this.nodes = [];
    this.nodesDict = {};
  }
  
  /**
   * 导入peer
   */
  importPeer(peer: Peer): void {
    const peerKey = utils.getPeerKey(peer);
    
    if (!this.nodesDict[peerKey]) {
      this.dht.addNode({ host: peer.host, port: peer.port });
    }
  }
  
  /**
   * 导入有用的peers
   */
  importUsefulPeers(): void {
    const usefulPeers = this.cacheManager.getUsefulPeers();
    const peers = utils.shuffle([...usefulPeers.values()]);
    
    for (const peer of peers) {
      if (Math.random() > Math.min(0.99, (this.rpc.pending.length / 50 + this.nodes.length / 500))) {
        this.importPeer(peer);
      }
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
    const nodes = this.dht._rpc.nodes.toArray();
    this.nodes = nodes;
    this.nodesDict = nodes.reduce((prev: Record<string, number>, curr: Peer) => {
      prev[utils.getPeerKey(curr)] = 1;
      return prev;
    }, {});
    
    utils.shuffle(this.nodes);
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
   * 添加节点
   */
  addNode(node: Peer): void {
    const nodeKey = utils.getPeerKey(node);
    
    if (!this.nodesDict[nodeKey]) {
      this.nodes.push(node);
      this.nodesDict[nodeKey] = this.nodes.length - 1;
      this.emit('node', node);
    }
  }
  
  /**
   * 添加peer
   */
  addPeer(peerInfo: { peer: Peer; infoHash: Buffer }): void {
    const { peer, infoHash } = peerInfo;
    const peerKey = utils.getPeerKey(peer);
    
    // 添加到缓存
    this.cacheManager.addPeerToCache(peerKey, { peer, infoHash });
    this.emit('peer', { infoHash, peer });
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
    for (const node of nodes) {
      this.addNode(node);
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
    for (const peer of peers) {
      this.cacheManager.addPeerToCache(utils.getPeerKey(peer), peer);
    }
  }
  
  /**
   * 获取统计信息
   */
  getStats() {
    return {
      nodeCount: this.nodes.length,
      peerCount: this.cacheManager.getPeerCount(),
      cacheStats: this.cacheManager.getStats()
    };
  }
  
  /**
   * 清理节点数据
   */
  clear(): void {
    this.nodes = [];
    this.nodesDict = {};
  }
}