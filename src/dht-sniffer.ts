import { EventEmitter } from 'events';
import { ErrorHandler, ErrorHandlerImpl } from './errors/error-handler';
import { ErrorMonitor, ErrorMonitorConfig } from './errors/error-monitor';
import { CacheManager, CacheConfig } from './core/cache-manager';
import { PeerManager } from './core/peer-manager';
import { MetadataManager } from './core/metadata-manager';
import { DHTManager } from './core/dht-manager';
import { createDefaultContainer, DIContainer } from './core/container';
import { ConfigValidatorManager } from './config/validator';
import { createDefaultEventBus, EventBus, EventTypes } from './core/event-bus';

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
  errorHandler?: ErrorHandlerImpl;
  errorMonitor?: ErrorMonitor;
  errorMonitorConfig?: ErrorMonitorConfig;
  cacheConfig?: CacheConfig;
  cacheManager?: CacheManager;
  enablePerformanceMonitoring?: boolean;
  performanceMonitoringInterval?: number;
  enableHealthCheck?: boolean;
  healthCheckInterval?: number;
  gracefulShutdownTimeout?: number;
  maxMemoryUsage?: number;
  enableAutoRestart?: boolean;
  restartDelay?: number;
}

/**
 * DHT嗅探器 - 使用模块化架构
 */
export class DHTSniffer extends EventEmitter {
  private config: DHTSnifferConfig;
  private container: DIContainer;
  private configValidator: ConfigValidatorManager;
  private eventBus: EventBus;
  private errorHandler: ErrorHandlerImpl;
  private errorMonitor: ErrorMonitor;
  private cacheManager: CacheManager;
  private peerManager: PeerManager;
  private metadataManager: MetadataManager;
  private dhtManager: DHTManager;
  private isRunning: boolean;
  private performanceMonitoringInterval?: NodeJS.Timeout;
  private healthCheckInterval?: NodeJS.Timeout;
  private startTime: number;
  private restartCount: number;
  private lastRestartTime: number;
  private isShuttingDown: boolean;

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
      aggressiveLevel: 0,
      enablePerformanceMonitoring: true,
      performanceMonitoringInterval: 30000,
      enableHealthCheck: true,
      healthCheckInterval: 60000,
      gracefulShutdownTimeout: 10000,
      maxMemoryUsage: 512 * 1024 * 1024, // 512MB
      enableAutoRestart: false,
      restartDelay: 5000
    }, config);
    
    this.isRunning = false;
    this.startTime = Date.now();
    this.restartCount = 0;
    this.lastRestartTime = 0;
    this.isShuttingDown = false;

    // 将扁平配置转换为分组配置结构
    const groupedConfig = this.transformConfigForValidation(this.config);
    
    // 初始化架构组件
    this.initializeArchitectureComponents();

    // 使用分组配置初始化业务组件
    this.initializeBusinessComponentsWithConfig(groupedConfig);

    // 设置事件监听
    this.setupEventListeners();
  }

  /**
   * 初始化架构组件
   */
  private initializeArchitectureComponents(): void {
    // 初始化配置验证器
    this.configValidator = new ConfigValidatorManager();
    
    // 将扁平配置转换为分组配置结构进行验证
    const groupedConfig = this.transformConfigForValidation(this.config);
    
    // 验证配置
    const validationResult = this.configValidator.validateAll(groupedConfig);
    const hasErrors = Object.values(validationResult).some(result => !result.isValid);
    if (hasErrors) {
      const errorMessages = Object.entries(validationResult)
        .filter(([, result]) => !result.isValid)
        .map(([type, result]) => `${type}: ${result.errors.join(', ')}`)
        .join('; ');
      throw new Error(`Configuration validation failed: ${errorMessages}`);
    }

    // 初始化事件总线
    this.eventBus = createDefaultEventBus();

    // 初始化依赖注入容器
    this.container = createDefaultContainer(this.config);
  }



  /**
   * 使用分组配置初始化业务组件
   * @param groupedConfig 分组配置对象
   */
  private initializeBusinessComponentsWithConfig(groupedConfig: any): void {
    // 使用分组配置创建容器
    this.container = createDefaultContainer(groupedConfig);
    
    // 从容器获取组件实例
    this.errorHandler = this.container.get<ErrorHandlerImpl>('errorHandler');
    this.errorMonitor = this.container.get<ErrorMonitor>('errorMonitor');
    this.cacheManager = this.container.get<CacheManager>('cacheManager');
    this.peerManager = this.container.get<PeerManager>('peerManager');
    this.metadataManager = this.container.get<MetadataManager>('metadataManager');
    this.dhtManager = this.container.get<DHTManager>('dhtManager');
  }

  /**
   * 设置事件监听
   */
  private setupEventListeners(): void {
    // 设置事件总线监听器
    this.setupEventBusListeners();
    
    // 设置管理器事件转发
    this.setupManagerEventForwarding();
  }

  /**
   * 设置事件总线监听器
   */
  private setupEventBusListeners(): void {
    // 监听DHT管理器事件
    this.eventBus.subscribe(EventTypes.DHT.peerFound, (peerInfo: { peer: any; infoHash: Buffer }) => {
      const { peer, infoHash } = peerInfo;
      // 通过事件总线通知元数据管理器
      this.eventBus.publish(EventTypes.METADATA.queueRequest, { infoHash, peer });
      // 转发到外部事件
      this.emit('peer', peerInfo);
    });

    this.eventBus.subscribe(EventTypes.DHT.nodeFound, (node: any) => {
      this.emit('node', node);
    });

    this.eventBus.subscribe(EventTypes.DHT.error, (error: Error) => {
      this.emit('error', error);
    });

    this.eventBus.subscribe(EventTypes.DHT.warning, (warning: any) => {
      this.emit('warning', warning);
    });

    this.eventBus.subscribe(EventTypes.DHT.infoHashFound, (peerInfo: { infoHash: Buffer; peer: any }) => {
      this.emit('infoHash', peerInfo);
    });

    // 监听元数据管理器事件
    this.eventBus.subscribe(EventTypes.METADATA.fetched, (metadataInfo: { infoHash: Buffer; metadata: any }) => {
      this.emit('metadata', metadataInfo);
    });

    this.eventBus.subscribe(EventTypes.METADATA.error, (errorInfo: any) => {
      this.emit('metadataError', errorInfo);
    });

    // 监听系统事件
    this.eventBus.subscribe(EventTypes.SYSTEM.memoryWarning, (warning: any) => {
      this.emit('memoryWarning', warning);
    });

    this.eventBus.subscribe(EventTypes.SYSTEM.performanceStats, (stats: any) => {
      this.emit('performanceStats', stats);
    });

    this.eventBus.subscribe(EventTypes.SYSTEM.healthCheck, (health: any) => {
      this.emit('healthCheck', health);
    });
  }

  /**
   * 设置管理器事件转发
   */
  private setupManagerEventForwarding(): void {
    // DHT管理器事件转发到事件总线
    this.dhtManager.on('peer', (peerInfo: { peer: any; infoHash: Buffer }) => {
      this.eventBus.publish(EventTypes.DHT.peerFound, peerInfo);
    });

    this.dhtManager.on('node', (node: any) => {
      this.eventBus.publish(EventTypes.DHT.nodeFound, node);
    });

    this.dhtManager.on('error', (error: Error) => {
      this.eventBus.publish(EventTypes.DHT.error, error);
    });

    this.dhtManager.on('warning', (warning: string) => {
      this.eventBus.publish(EventTypes.DHT.warning, { message: warning });
    });

    this.dhtManager.on('infoHash', (peerInfo: { infoHash: Buffer; peer: any }) => {
      this.eventBus.publish(EventTypes.DHT.infoHashFound, peerInfo);
    });

    // 元数据管理器事件转发到事件总线
    this.metadataManager.on('metadata', (metadataInfo: { infoHash: Buffer; metadata: any }) => {
      this.eventBus.publish(EventTypes.METADATA.fetched, metadataInfo);
    });

    this.metadataManager.on('metadataError', (errorInfo: any) => {
      this.eventBus.publish(EventTypes.METADATA.error, errorInfo);
    });
  }

  /**
   * 启动嗅探器
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      return;
    }

    try {
      // 启动DHT管理器
      await this.dhtManager.start();

      // 在DHT管理器启动后，设置PeerManager的DHT实例
      const dhtInstance = this.dhtManager.getDHT();
      this.peerManager.setDHT(dhtInstance);
      
      // 更新容器中的DHT实例引用
      this.container.register('dhtInstance', dhtInstance);

      this.isRunning = true;
      this.startTime = Date.now();
      
      // 启动性能监控
      if (this.config.enablePerformanceMonitoring) {
        this.startPerformanceMonitoring();
      }
      
      // 启动健康检查
      if (this.config.enableHealthCheck) {
        this.startHealthCheck();
      }
      
      // 通过事件总线发布启动完成事件
      this.eventBus.publish(EventTypes.SYSTEM.started, {
        startTime: this.startTime,
        config: this.config
      });
      
      this.emit('started');
    } catch (error) {
      this.isRunning = false;
      this.errorHandler.handleError(error as Error, { operation: 'DHTSniffer.start' });
      throw error;
    }
  }

  /**
   * 停止嗅探器
   */
  async stop(): Promise<void> {
    if (!this.isRunning || this.isShuttingDown) {
      return;
    }

    this.isShuttingDown = true;

    try {
      // 停止监控和健康检查
      this.stopPerformanceMonitoring();
      this.stopHealthCheck();
      
      // 停止DHT管理器
      await this.dhtManager.stop();

      // 清理元数据管理器
      this.metadataManager.clear();
      
      // 清理缓存管理器
      await this.cacheManager.destroy();
      
      // 清理节点管理器
      this.peerManager.clear();

      // 清理架构组件
      await this.cleanupArchitectureComponents();

      this.isRunning = false;
      this.isShuttingDown = false;
      this.emit('stopped');
    } catch (error) {
      this.isShuttingDown = false;
      this.errorHandler.handleError(error as Error, { operation: 'DHTSniffer.stop' });
      throw error;
    }
  }

  /**
   * 清理架构组件
   */
  private async cleanupArchitectureComponents(): Promise<void> {
    try {
      // 清理事件总线
      this.eventBus.clearAllSubscriptions();
      
      // 清理依赖注入容器
      this.container.clear();
      
      // 清理配置验证器
      // ConfigValidatorManager没有clear方法，跳过清理
    } catch (error) {
      this.errorHandler.handleError(error as Error, { operation: 'DHTSniffer.cleanupArchitectureComponents' });
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
    const cacheStats = this.cacheManager.getStats();
    const peerStats = this.peerManager.getStats();
    
    const memoryUsage = process.memoryUsage();
    const uptime = Date.now() - this.startTime;

    return {
      ...dhtStats,
      ...metadataStats,
      ...cacheStats,
      ...peerStats,
      errors: errorStats,
      system: {
        uptime,
        restartCount: this.restartCount,
        lastRestartTime: this.lastRestartTime,
        memory: {
          rss: memoryUsage.rss,
          heapTotal: memoryUsage.heapTotal,
          heapUsed: memoryUsage.heapUsed,
          external: memoryUsage.external,
          maxMemoryUsage: this.config.maxMemoryUsage
        },
        cpu: process.cpuUsage()
      }
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

  /**
   * 获取依赖注入容器
   */
  getContainer(): DIContainer {
    return this.container;
  }

  /**
   * 获取配置验证器
   */
  getConfigValidator(): ConfigValidatorManager {
    return this.configValidator;
  }

  /**
   * 将扁平配置转换为分组配置结构用于验证
   * @param config 扁平配置对象
   * @returns 分组配置对象
   */
  private transformConfigForValidation(config: any): any {
    const groupedConfig: any = {
      dht: {},
      metadata: {},
      cache: {},
      peer: {},
      error: {}
    };

    // DHT相关配置
    if (config.port !== undefined) groupedConfig.dht.port = config.port;
    if (config.nodesMaxSize !== undefined) groupedConfig.dht.nodesMaxSize = config.nodesMaxSize;
    if (config.refreshPeriod !== undefined) groupedConfig.dht.refreshPeriod = config.refreshPeriod;
    if (config.announcePeriod !== undefined) groupedConfig.dht.announcePeriod = config.announcePeriod;
    if (config.bootstrapNodes !== undefined) groupedConfig.dht.bootstrap = config.bootstrapNodes;
    
    // 元数据相关配置
    if (config.maximumParallelFetchingTorrent !== undefined) groupedConfig.metadata.maximumParallelFetchingTorrent = config.maximumParallelFetchingTorrent;
    if (config.maximumWaitingQueueSize !== undefined) groupedConfig.metadata.maximumWaitingQueueSize = config.maximumWaitingQueueSize;
    if (config.downloadMaxTime !== undefined) groupedConfig.metadata.downloadMaxTime = config.downloadMaxTime;
    if (config.ignoreFetched !== undefined) groupedConfig.metadata.ignoreFetched = config.ignoreFetched;
    if (config.aggressiveLevel !== undefined) groupedConfig.metadata.aggressiveLevel = config.aggressiveLevel;
    
    // 缓存相关配置
    if (config.maxSize !== undefined) groupedConfig.cache.maxSize = config.maxSize;
    if (config.ttl !== undefined) groupedConfig.cache.ttl = config.ttl;
    
    // 确保缓存配置包含必需的参数
    groupedConfig.cache.fetchedTupleSize = config.fetchedTupleSize || 1000;
    groupedConfig.cache.fetchedInfoHashSize = config.fetchedInfoHashSize || 5000;
    groupedConfig.cache.findNodeCacheSize = config.findNodeCacheSize || 2000;
    groupedConfig.cache.latestCalledPeersSize = config.latestCalledPeersSize || 1000;
    groupedConfig.cache.usefulPeersSize = config.usefulPeersSize || 5000;
    groupedConfig.cache.metadataFetchingCacheSize = config.metadataFetchingCacheSize || 1000;
    
    // 对等节点相关配置
    if (config.maxNodes !== undefined) groupedConfig.peer.maxNodes = config.maxNodes;
    
    // 错误处理相关配置
    if (config.enableErrorHandling !== undefined) groupedConfig.error.enableErrorHandling = config.enableErrorHandling;
    if (config.maxErrorHistory !== undefined) groupedConfig.error.maxErrorHistory = config.maxErrorHistory;
    
    // 系统相关配置
    if (config.enablePerformanceMonitoring !== undefined) {
      groupedConfig.dht.enablePerformanceMonitoring = config.enablePerformanceMonitoring;
      groupedConfig.metadata.enablePerformanceMonitoring = config.enablePerformanceMonitoring;
    }
    if (config.performanceMonitoringInterval !== undefined) {
      groupedConfig.dht.performanceMonitoringInterval = config.performanceMonitoringInterval;
      groupedConfig.metadata.performanceMonitoringInterval = config.performanceMonitoringInterval;
    }
    if (config.enableHealthCheck !== undefined) {
      groupedConfig.dht.enableHealthCheck = config.enableHealthCheck;
      groupedConfig.metadata.enableHealthCheck = config.enableHealthCheck;
    }
    if (config.healthCheckInterval !== undefined) {
      groupedConfig.dht.healthCheckInterval = config.healthCheckInterval;
      groupedConfig.metadata.healthCheckInterval = config.healthCheckInterval;
    }
    if (config.gracefulShutdownTimeout !== undefined) {
      groupedConfig.dht.gracefulShutdownTimeout = config.gracefulShutdownTimeout;
      groupedConfig.metadata.gracefulShutdownTimeout = config.gracefulShutdownTimeout;
    }
    if (config.maxMemoryUsage !== undefined) {
      groupedConfig.dht.memoryThreshold = config.maxMemoryUsage;
      groupedConfig.metadata.memoryThreshold = config.maxMemoryUsage;
      groupedConfig.cache.memoryThreshold = config.maxMemoryUsage;
      groupedConfig.peer.memoryThreshold = config.maxMemoryUsage;
    }
    if (config.enableAutoRestart !== undefined) {
      groupedConfig.dht.enableAutoRestart = config.enableAutoRestart;
      groupedConfig.metadata.enableAutoRestart = config.enableAutoRestart;
    }
    if (config.restartDelay !== undefined) {
      groupedConfig.dht.restartDelay = config.restartDelay;
      groupedConfig.metadata.restartDelay = config.restartDelay;
    }

    return groupedConfig;
  }

  /**
   * 获取事件总线
   */
  getEventBus(): EventBus {
    return this.eventBus;
  }

  /**
   * 启动性能监控
   */
  private startPerformanceMonitoring(): void {
    if (this.performanceMonitoringInterval) {
      return;
    }
    
    this.performanceMonitoringInterval = setInterval(() => {
      const stats = this.getStats();
      const memoryUsage = stats.system.memory;
      
      // 检查内存使用
      if (memoryUsage.heapUsed > this.config.maxMemoryUsage!) {
        const memoryWarning = {
          current: memoryUsage.heapUsed,
          max: this.config.maxMemoryUsage,
          message: 'Memory usage exceeds threshold'
        };
        
        // 通过事件总线发布内存警告
        this.eventBus.publish(EventTypes.SYSTEM.memoryWarning, memoryWarning);
        
        // 触发内存清理
        this.performMemoryCleanup();
      }
      
      // 发送性能统计
      const performanceStats = {
        memory: memoryUsage,
        uptime: stats.system.uptime,
        cpu: stats.system.cpu,
        cache: {
          hitRate: stats.cacheHitRate || 0,
          size: stats.cacheSize || 0
        }
      };
      
      // 通过事件总线发布性能统计
      this.eventBus.publish(EventTypes.SYSTEM.performanceStats, performanceStats);
    }, this.config.performanceMonitoringInterval);
  }

  /**
   * 停止性能监控
   */
  private stopPerformanceMonitoring(): void {
    if (this.performanceMonitoringInterval) {
      clearInterval(this.performanceMonitoringInterval);
      this.performanceMonitoringInterval = undefined;
    }
  }

  /**
   * 启动健康检查
   */
  private startHealthCheck(): void {
    if (this.healthCheckInterval) {
      return;
    }
    
    this.healthCheckInterval = setInterval(async () => {
      try {
        const health = await this.performHealthCheck();
        
        // 通过事件总线发布健康检查结果
        this.eventBus.publish(EventTypes.SYSTEM.healthCheck, health);
        
        // 如果健康检查失败且启用了自动重启
        if (!health.healthy && this.config.enableAutoRestart && !this.isShuttingDown) {
          await this.performRestart();
        }
      } catch (error) {
        this.errorHandler.handleError(error as Error, { operation: 'DHTSniffer.healthCheck' });
      }
    }, this.config.healthCheckInterval);
  }

  /**
   * 停止健康检查
   */
  private stopHealthCheck(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = undefined;
    }
  }

  /**
   * 执行健康检查
   */
  private async performHealthCheck(): Promise<{
    healthy: boolean;
    checks: {
      dhtManager: boolean;
      peerManager: boolean;
      metadataManager: boolean;
      cacheManager: boolean;
      memory: boolean;
    };
    issues: string[];
  }> {
    const checks = {
      dhtManager: this.dhtManager.getIsRunning(),
      peerManager: this.peerManager.getStats().nodeCount > 0,
      metadataManager: this.metadataManager.getStats().activeFetchingCount >= 0,
      cacheManager: this.cacheManager.getStats().totalSize >= 0,
      memory: process.memoryUsage().heapUsed < this.config.maxMemoryUsage!
    };
    
    const issues: string[] = [];
    
    if (!checks.dhtManager) issues.push('DHT Manager is not running');
    if (!checks.peerManager) issues.push('Peer Manager has no nodes');
    if (!checks.metadataManager) issues.push('Metadata Manager has issues');
    if (!checks.cacheManager) issues.push('Cache Manager has issues');
    if (!checks.memory) issues.push('Memory usage too high');
    
    return {
      healthy: Object.values(checks).every(check => check),
      checks,
      issues
    };
  }

  /**
   * 执行内存清理
   */
  private async performMemoryCleanup(): Promise<void> {
    try {
      // 清理缓存
      await this.cacheManager.cleanupMemory();
      
      // 清理过期节点
      this.peerManager.cleanup();
      
      // 清理DHT管理器内存
      this.dhtManager.performMemoryCleanup();
      
      // 触发垃圾回收（如果可用）
      if (global.gc) {
        global.gc();
      }
      
      // 通过事件总线发布内存清理完成事件
      this.eventBus.publish(EventTypes.SYSTEM.memoryCleanupCompleted, {
        timestamp: Date.now()
      });
      
      this.emit('memoryCleanupCompleted');
    } catch (error) {
      this.errorHandler.handleError(error as Error, { operation: 'DHTSniffer.performMemoryCleanup' });
    }
  }

  /**
   * 执行重启
   */
  private async performRestart(): Promise<void> {
    if (this.isShuttingDown) {
      return;
    }
    
    const restartInfo = {
      restartCount: this.restartCount,
      timestamp: Date.now()
    };
    
    // 通过事件总线发布重启开始事件
    this.eventBus.publish(EventTypes.SYSTEM.restarting, restartInfo);
    
    this.emit('restarting');
    
    try {
      await this.stop();
      
      // 等待重启延迟
      await new Promise(resolve => setTimeout(resolve, this.config.restartDelay));
      
      await this.start();
      
      this.restartCount++;
      this.lastRestartTime = Date.now();
      
      const completedRestartInfo = {
        restartCount: this.restartCount,
        restartTime: this.lastRestartTime
      };
      
      // 通过事件总线发布重启完成事件
      this.eventBus.publish(EventTypes.SYSTEM.restarted, completedRestartInfo);
      
      this.emit('restarted', completedRestartInfo);
    } catch (error) {
      this.errorHandler.handleError(error as Error, { operation: 'DHTSniffer.performRestart' });
      
      // 通过事件总线发布重启失败事件
      this.eventBus.publish(EventTypes.SYSTEM.restartFailed, {
        error,
        timestamp: Date.now()
      });
      
      this.emit('restartFailed', error);
    }
  }

  /**
   * 优雅关闭
   */
  async gracefulShutdown(): Promise<void> {
    if (this.isShuttingDown) {
      return;
    }
    
    const shutdownInfo = {
      timestamp: Date.now(),
      timeout: this.config.gracefulShutdownTimeout
    };
    
    // 通过事件总线发布关闭开始事件
    this.eventBus.publish(EventTypes.SYSTEM.shuttingDown, shutdownInfo);
    
    this.emit('shuttingDown');
    
    try {
      // 设置超时
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Graceful shutdown timeout')), this.config.gracefulShutdownTimeout);
      });
      
      await Promise.race([
        this.stop(),
        timeoutPromise
      ]);
      
      const completedShutdownInfo = {
        timestamp: Date.now(),
        duration: Date.now() - shutdownInfo.timestamp
      };
      
      // 通过事件总线发布关闭完成事件
      this.eventBus.publish(EventTypes.SYSTEM.shutdownCompleted, completedShutdownInfo);
      
      this.emit('shutdownCompleted');
    } catch (error) {
      this.errorHandler.handleError(error as Error, { operation: 'DHTSniffer.gracefulShutdown' });
      
      // 通过事件总线发布关闭失败事件
      this.eventBus.publish(EventTypes.SYSTEM.shutdownFailed, {
        error,
        timestamp: Date.now()
      });
      
      this.emit('shutdownFailed', error);
      throw error;
    }
  }
}