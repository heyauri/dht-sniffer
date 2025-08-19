import { EventEmitter } from 'events';
import { emitter } from 'last-one-wins';
import * as utils from './utils';
import { ErrorHandler } from './utils/error-handler';
import { ErrorMonitor, ErrorMonitorConfig } from './utils/error-monitor';
import { CacheManager, CacheConfig } from './core/cache-manager';
import { PeerManager } from './core/peer-manager';
import { MetadataManager, MetadataManagerConfig } from './core/metadata-manager';
import { DHTManager, DHTManagerConfig } from './core/dht-manager';

/**
 * DHT嗅探器配置
 */
export interface DHTSnifferConfig {
  address?: string;
  port?: number;
  bootstrap?: string[];
  nodesMaxSize?: number;
  refreshPeriod?: number;
  announcePeriod?: number;
  maximumParallelFetchingTorrent?: number;
  maximumWaitingQueueSize?: number;
  downloadMaxTime?: number;
  ignoreFetched?: boolean;
  aggressiveLevel?: number;
  errorHandler?: ErrorHandler;
  errorMonitor?: ErrorMonitor;
  errorMonitorConfig?: ErrorMonitorConfig;
  cacheConfig?: CacheConfig;
  cacheManager?: CacheManager;
}

/**
 * DHT嗅探器 - 使用模块化架构
 */
export class DHTSniffer extends EventEmitter {
  private config: DHTSnifferConfig;
  private errorHandler: ErrorHandler;
  private errorMonitor: ErrorMonitor;
  private cacheManager: CacheManager;
  private peerManager: PeerManager;
  private metadataManager: MetadataManager;
  private dhtManager: DHTManager;
  private isRunning: boolean;

  constructor(config: DHTSnifferConfig = {}) {
    super();

    // 设置默认配置
    this.config = Object.assign({
      port: 6881,
      nodesMaxSize: 10000,
      refreshPeriod: 30000,
      announcePeriod: 30000,
      maximumParallelFetchingTorrent: 40,
      maximumWaitingQueueSize: -1,
      downloadMaxTime: 20000,
      ignoreFetched: true,
      aggressiveLevel: 0
    }, config);
    
    this.isRunning = false;

    // 初始化错误处理器
    this.errorHandler = config.errorHandler || new ErrorHandler();

    // 初始化错误监控器
    this.errorMonitor = config.errorMonitor || new ErrorMonitor(
      this.errorHandler,
      config.errorMonitorConfig || {
        statsIntervalMs: 60000,
        maxRecentErrors: 100,
        errorRateWindowMs: 300000,
        enableAlerts: true,
        alertThresholds: {
          errorRate: 10,
          criticalErrors: 5,
          consecutiveErrors: 20
        }
      }
    );

    // 初始化缓存管理器
    this.cacheManager = config.cacheManager || new CacheManager(
      config.cacheConfig || {
        fetchedTupleSize: 1000,
        fetchedInfoHashSize: 5000,
        findNodeCacheSize: 1000,
        latestCalledPeersSize: 500,
        usefulPeersSize: 50000,
        metadataFetchingCacheSize: 1000
      }
    );

    // 初始化节点管理器
    this.peerManager = new PeerManager(
      {
        maxNodes: this.config.nodesMaxSize!,
        nodeRefreshTime: this.config.refreshPeriod!,
        findNodeProbability: 0.1
      },
      null, // DHT实例将在DHTManager启动后设置
      this.cacheManager
    );

    // 初始化元数据管理器
    this.metadataManager = new MetadataManager(
      {
        maximumParallelFetchingTorrent: this.config.maximumParallelFetchingTorrent!,
        maximumWaitingQueueSize: this.config.maximumWaitingQueueSize!,
        downloadMaxTime: this.config.downloadMaxTime!,
        ignoreFetched: this.config.ignoreFetched!,
        aggressiveLevel: this.config.aggressiveLevel!
      },
      this.errorHandler,
      this.cacheManager
    );

    // 初始化DHT管理器
    const dhtConfig: DHTManagerConfig = {
      port: this.config.port!,
      bootstrap: this.config.bootstrap,
      nodesMaxSize: this.config.nodesMaxSize!,
      refreshPeriod: this.config.refreshPeriod!,
      announcePeriod: this.config.announcePeriod!
    };
    
    // 只有在提供了address时才添加
    if (this.config.address !== undefined) {
      dhtConfig.address = this.config.address;
    }
    
    this.dhtManager = new DHTManager(
      dhtConfig,
      this.errorHandler,
      this.peerManager
    );

    // 设置管理器间的事件监听
    this.setupManagerEventListeners();
  }

  /**
   * 设置管理器间的事件监听
   */
  private setupManagerEventListeners(): void {
    // DHT管理器事件
    this.dhtManager.on('peer', (peerInfo: { peer: any; infoHash: Buffer }) => {
      const { peer, infoHash } = peerInfo;
      this.metadataManager.addQueuingMetadata(infoHash, peer);
      this.emit('peer', peerInfo);
    });

    this.dhtManager.on('node', (node: any) => {
      this.emit('node', node);
    });

    this.dhtManager.on('error', (error: Error) => {
      this.emit('error', error);
    });

    this.dhtManager.on('warning', (warning: string) => {
      this.emit('warning', warning);
    });

    this.dhtManager.on('infoHash', (peerInfo: { infoHash: Buffer; peer: any }) => {
      this.emit('infoHash', peerInfo);
    });

    // 元数据管理器事件
    this.metadataManager.on('metadata', (metadataInfo: { infoHash: Buffer; metadata: any }) => {
      this.emit('metadata', metadataInfo);
    });

    this.metadataManager.on('metadataError', (errorInfo: any) => {
      this.emit('metadataError', errorInfo);
    });
  }

  /**
   * 启动嗅探器
   */
  start(): void {
    if (this.isRunning) {
      return;
    }

    try {
      // 启动DHT管理器
      this.dhtManager.start();

      // 在DHT管理器启动后，设置PeerManager的DHT实例
      const dhtInstance = this.dhtManager.getDHT();
      this.peerManager.setDHT(dhtInstance);

      this.isRunning = true;
      this.emit('started');
    } catch (error) {
      this.isRunning = false;
      throw error;
    }
  }

  /**
   * 停止嗅探器
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    try {
      // 停止DHT管理器
      this.dhtManager.stop();

      // 清理元数据管理器
      this.metadataManager.clear();

      this.isRunning = false;
      this.emit('stopped');
    } catch (error) {
      throw error;
    }
  }

  /**
   * 查找节点
   */
  findNode(target: Buffer): void {
    this.dhtManager.findNode(target);
  }

  /**
   * 获取peers
   */
  getPeers(infoHash: Buffer): void {
    this.dhtManager.getPeers(infoHash);
  }

  /**
   * 获取元数据
   */
  fetchMetaData(peerInfo: { infoHash: Buffer; peer: any }): void {
    const { infoHash, peer } = peerInfo;
    this.metadataManager.addQueuingMetadata(infoHash, peer);
  }

  /**
   * 解析元数据
   */
  parseMetaData(rawMetadata: Buffer) {
    return this.metadataManager.parseMetaData(rawMetadata);
  }

  /**
   * 导出节点
   */
  exportNodes(): any[] {
    return this.dhtManager.exportNodes();
  }

  /**
   * 导入节点
   */
  importNodes(nodes: any[]): void {
    this.dhtManager.importNodes(nodes);
  }

  /**
   * 导出peers
   */
  exportPeers(): any[] {
    return this.dhtManager.exportPeers();
  }

  /**
   * 导入peers
   */
  importPeers(peers: any[]): void {
    this.dhtManager.importPeers(peers);
  }

  /**
   * 导出等待队列
   */
  exportWaitingQueue(): any[] {
    return this.metadataManager.exportWaitingQueue();
  }

  /**
   * 导入等待队列
   */
  importWaitingQueue(arr: any[]): void {
    this.metadataManager.importWaitingQueue(arr);
  }

  /**
   * 获取统计信息
   */
  getStats() {
    const dhtStats = this.dhtManager.getStats();
    const metadataStats = this.metadataManager.getStats();
    const errorStats = this.errorMonitor.getStats();

    return {
      ...dhtStats,
      ...metadataStats,
      errors: errorStats
    };
  }

  /**
   * 检查是否正在运行
   */
  isRunningStatus(): boolean {
    return this.isRunning;
  }

  /**
   * 获取错误处理器
   */
  getErrorHandler(): ErrorHandler {
    return this.errorHandler;
  }

  /**
   * 获取错误监控器
   */
  getErrorMonitor(): ErrorMonitor {
    return this.errorMonitor;
  }

  /**
   * 获取缓存管理器
   */
  getCacheManager(): CacheManager {
    return this.cacheManager;
  }

  /**
   * 获取节点管理器
   */
  getPeerManager(): PeerManager {
    return this.peerManager;
  }

  /**
   * 获取元数据管理器
   */
  getMetadataManager(): MetadataManager {
    return this.metadataManager;
  }

  /**
   * 获取DHT管理器
   */
  getDHTManager(): DHTManager {
    return this.dhtManager;
  }
}