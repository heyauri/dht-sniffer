import * as metadataHelper from '../metadata/metadata-helper';
import { NetworkError, TimeoutError, MetadataError } from '../types/error';
import { ErrorHandlerImpl } from '../errors/error-handler';
import { MetadataWaitingItem, MetadataManagerConfig, MetadataStats } from '../types/metadata';
import { BaseManager, BaseManagerConfig, ManagerStats } from './base-manager';
import { ErrorType } from '../types/error';

/**
 * 元数据管理器配置接口
 */
export interface MetadataManagerExtendedConfig extends MetadataManagerConfig, BaseManagerConfig {}


/**
 * 元数据管理器 - 负责管理元数据获取逻辑
 */
export class MetadataManager extends BaseManager {
  protected config: MetadataManagerExtendedConfig;
  private cacheManager: any;
  private metadataWaitingQueues: MetadataWaitingItem[];
  private metadataFetchingDict: Record<string, number>;
  private aggressiveLimit: number;

  protected startTime: number;
  private totalFetchCount: number;
  private successFetchCount: number;
  private failedFetchCount: number;
  private retryCount: Record<string, number>;
  
  constructor(config: MetadataManagerExtendedConfig, errorHandler: ErrorHandlerImpl, cacheManager: any) {
    super(config, errorHandler);
    
    // 设置默认配置
    this.config = Object.assign({
      enableRetry: true,
      maxRetries: 3,
      retryDelay: 1000,
      retryBackoffFactor: 2,
      enablePerformanceMonitoring: true,
      performanceMonitoringInterval: 30000,
      maxConcurrentRequests: 50,
      requestTimeout: 30000,
      enableMemoryOptimization: true,
      memoryCleanupThreshold: 1000
    }, config);
    
    this.cacheManager = cacheManager;
    
    this.metadataWaitingQueues = [];
    this.metadataFetchingDict = {};
    this.retryCount = {};
    
    const aggressiveLevel = this.config.aggressiveLevel;
    this.aggressiveLimit = aggressiveLevel && aggressiveLevel > 0 
      ? aggressiveLevel * this.config.maximumParallelFetchingTorrent 
      : 0;
    
    this.startTime = Date.now();
    this.totalFetchCount = 0;
    this.successFetchCount = 0;
    this.failedFetchCount = 0;
    
    // 启动性能监控
    if (this.config.enablePerformanceMonitoring) {
      this.startPerformanceMonitoring();
    }
  }
  
  /**
   * 添加元数据到等待队列
   */
  addQueuingMetadata(infoHash: Buffer, peer: any, reverse = false): void {
    const arr = this.metadataWaitingQueues;
    const infoHashStr = infoHash.toString('hex');
    const obj: MetadataWaitingItem = { infoHash, peer, infoHashStr };
    
    reverse ? arr.unshift(obj) : arr.push(obj);
    
    if (this.config.maximumWaitingQueueSize > 0 && arr.length > this.config.maximumWaitingQueueSize) {
      arr.shift();
    }
    
    this.dispatchMetadata();
    this.boostMetadataFetching();
  }
  
  /**
   * 分发元数据获取任务
   */
  private dispatchMetadata(): void {
    const fetchings = Object.keys(this.metadataFetchingDict);
    
    if (fetchings.length >= this.config.maximumParallelFetchingTorrent) {
      return;
    }
    
    const nextFetching = this.metadataWaitingQueues.pop();
    if (!nextFetching) return;
    
    const { infoHash, infoHashStr, peer } = nextFetching;
    const nextFetchingKey = this.getNextFetchingKey(nextFetching);
    
    // 检查是否正在获取相同的infohash
    if (Reflect.has(this.metadataFetchingDict, infoHashStr)) {
      if (this.aggressiveLimit > 0 && this.aggressiveLimit > fetchings.length) {
        // AGGRESSIVE CHOICE: 继续获取这个元数据
      } else {
        this.metadataWaitingQueues.unshift(nextFetching);
        
        // 防止重复infohash的无限分发
        const metadataFetchingCache = this.cacheManager.getMetadataFetchingCache();
        if (!metadataFetchingCache.get(infoHashStr)) {
          metadataFetchingCache.set(infoHashStr, 1);
          this.dispatchMetadata();
        }
        return;
      }
    }
    
    // 检查是否已经获取过
    const fetchedTuple = this.cacheManager.getFetchedTuple();
    const fetchedInfohash = this.cacheManager.getFetchedInfoHash();
    
    if (this.config.ignoreFetched && fetchedTuple.get(nextFetchingKey)) {
      this.cacheManager.incrementFetchedTupleHit();
      this.dispatchMetadata();
      return;
    }
    
    if (this.config.ignoreFetched && fetchedInfohash.get(infoHashStr)) {
      this.cacheManager.incrementFetchedInfoHashHit();
      this.dispatchMetadata();
      return;
    }
    
    // 记录获取状态
    if (!this.metadataFetchingDict[infoHashStr]) {
      this.metadataFetchingDict[infoHashStr] = 1;
    } else if (this.aggressiveLimit > 0) {
      this.metadataFetchingDict[infoHashStr] += 1;
    }
    
    fetchedTuple.set(nextFetchingKey, 1);
    
    // 执行获取
    this.fetchMetadata(infoHash, peer, infoHashStr);
  }
  
  /**
   * 执行元数据获取
   */
  private async fetchMetadata(infoHash: Buffer, peer: any, infoHashStr: string): Promise<void> {
    if (this.isDestroyed) return;
    
    this.totalFetchCount++;
    const fetchStartTime = Date.now();
    
    try {
      // 使用通用重试机制执行获取
      const metadata = await this.executeWithRetry(
        () => metadataHelper.fetch({ infoHash, peer }, this.config),
        'fetchMetadata',
        { infoHash: infoHashStr, peer: `${peer.host}:${peer.port}` }
      );
      
      if (metadata === undefined) return;
      
      this.successFetchCount++;
      this.emit('metadata', { infoHash, metadata });
      
      const fetchedInfohash = this.cacheManager.getFetchedInfoHash();
      const usefulPeers = this.cacheManager.getUsefulPeers();
      
      fetchedInfohash.set(infoHashStr, 1);
      usefulPeers.set(`${peer.host}:${peer.port}`, peer);
      
      if (this.config.ignoreFetched) {
        this.removeDuplicatedWaitingObjects(infoHashStr);
      }
      
      // 记录成功获取时间
      const fetchTime = Date.now() - fetchStartTime;
      this.emit('fetchSuccess', {
        infoHash: infoHashStr,
        peer: { host: peer.host, port: peer.port },
        fetchTime
      });
      
    } catch (error) {
      this.failedFetchCount++;
      
      // 使用错误处理器处理metadata获取错误
      let processedError: Error;
      if (error instanceof NetworkError || error instanceof TimeoutError || error instanceof MetadataError) {
        processedError = error;
      } else {
        processedError = new MetadataError(
          `Metadata fetch failed for ${infoHashStr}: ${error.message || error}`,
          { 
            operation: 'metadata_fetch', 
            infoHash: infoHashStr, 
            peer: { host: peer.host, port: peer.port },
            cause: error instanceof Error ? error : new Error(String(error))
          },
          false
        );
      }
      
      this.handleError('fetchMetadata', processedError);
      this.emit('metadataError', { infoHash, error: processedError });
      
      // 记录失败获取时间
      const fetchTime = Date.now() - fetchStartTime;
      this.emit('fetchFailed', {
        infoHash: infoHashStr,
        peer: { host: peer.host, port: peer.port },
        fetchTime,
        error: processedError.message,
        retryCount: this.retryCount[infoHashStr] || 0
      });
    } finally {
      this.dispatchMetadata();
      
      if (this.metadataFetchingDict[infoHashStr] && this.metadataFetchingDict[infoHashStr] > 1) {
        this.metadataFetchingDict[infoHashStr] -= 1;
      } else {
        Reflect.deleteProperty(this.metadataFetchingDict, infoHashStr);
      }
      
      const metadataFetchingCache = this.cacheManager.getMetadataFetchingCache();
      metadataFetchingCache.delete(infoHashStr);
      
      // 检查是否需要内存清理
      if (this.config.enableMemoryOptimization && this.totalFetchCount % this.config.memoryCleanupThreshold! === 0) {
        this.performMemoryCleanup();
      }
    }
    
    // 提高效率
    this.dispatchMetadata();
  }
  
  /**
   * 提升元数据获取效率
   */
  private boostMetadataFetching(): void {
    let counter;
    
    while (true) {
      if (this.metadataWaitingQueues.length === 0) break;
      
      const fetchingLength = Object.keys(this.metadataFetchingDict).length;
      if (fetchingLength >= this.config.maximumParallelFetchingTorrent) break;
      
      const waitingKeysNumber = this.getUniqueWaitingKeys().length;
      if (waitingKeysNumber > fetchingLength) {
        if (counter === undefined) counter = this.metadataWaitingQueues.length;
        this.dispatchMetadata();
        counter--;
        if (counter <= 0) break;
      } else {
        break;
      }
    }
  }
  
  /**
   * 移除重复的等待对象
   */
  private removeDuplicatedWaitingObjects(infoHashStr: string): void {
    this.metadataWaitingQueues = this.metadataWaitingQueues.filter(
      waitingObject => infoHashStr !== waitingObject.infoHashStr
    );
  }
  
  /**
   * 获取下一个获取键
   */
  private getNextFetchingKey(nextFetching: MetadataWaitingItem): string {
    const { infoHash, peer } = nextFetching;
    return `${peer.host}:${peer.port}-${infoHash.toString('hex')}`;
  }
  
  /**
   * 获取唯一的等待键
   */
  private getUniqueWaitingKeys(): string[] {
    const keysDict = this.metadataWaitingQueues.reduce((prev: Record<string, number>, curr) => {
      prev[curr.infoHashStr] = 1;
      return prev;
    }, {});
    
    return Object.keys(keysDict);
  }
  
  /**
   * 导出等待队列
   */
  exportWaitingQueue(): MetadataWaitingItem[] {
    return [...this.metadataWaitingQueues];
  }
  
  /**
   * 导入等待队列
   */
  importWaitingQueue(arr: any[]): void {
    if (!arr || Object.prototype.toString.call(arr) !== '[object Array]') {
      this.handleError('importWaitingQueue', new Error('Invalid input: not an array'), { errorType: ErrorType.VALIDATION });
      return;
    }
    
    for (const tuple of arr) {
      if (!tuple.peer || !tuple.peer.host || !tuple.peer.port) {
        continue;
      }
      if (!tuple.infoHashStr) {
        continue;
      }
      
      tuple.infoHash = Buffer.from(tuple.infoHashStr, 'hex');
      this.metadataWaitingQueues.push(tuple);
    }
  }
  
  /**
   * 获取元数据统计信息
   */
  getMetadataStats() {
    const fetchings = Object.keys(this.metadataFetchingDict);
    const cacheStats = this.cacheManager.getStats();
    const uptime = Date.now() - this.startTime;
    
    return {
      fetchingNum: fetchings.length,
      metadataWaitingQueueSize: this.metadataWaitingQueues.length,
      uniqueWaitingKeys: this.getUniqueWaitingKeys().length,
      activeFetchingCount: Object.keys(this.metadataFetchingDict).reduce((sum, key) => sum + this.metadataFetchingDict[key], 0),
      totalFetchCount: this.totalFetchCount,
      successFetchCount: this.successFetchCount,
      failedFetchCount: this.failedFetchCount,
      successRate: this.totalFetchCount > 0 ? (this.successFetchCount / this.totalFetchCount) * 100 : 0,
      uptime,
      aggressiveLimit: this.aggressiveLimit,
      ...cacheStats
    };
  }
  
  /**
   * 解析元数据
   */
  parseMetaData(rawMetadata: Buffer) {
    return metadataHelper.parseMetaData(rawMetadata);
  }
  
  /**
   * 清理数据
   */
  clearMetadataData(): void {
    this.metadataWaitingQueues = [];
    this.metadataFetchingDict = {};
    this.retryCount = {};
  }

  /**
   * 获取管理器名称
   */
  protected getManagerName(): string {
    return 'MetadataManager';
  }

  /**
   * 执行清理操作
   */
  protected performCleanup(): void {
    this.clearMetadataData();
  }

  /**
   * 清理数据
   */
  protected clearData(): void {
    this.clearMetadataData();
  }

  /**
   * 获取统计信息
   */
  getStats(): ManagerStats & MetadataStats {
    return {
      ...super.getStats(),
      ...this.getMetadataStats()
    };
  }

  /**
   * 元数据特定的错误处理
   */
  protected handleMetadataError(operation: string, error: any, context?: any): void {
    const metadataError = new MetadataError(
      `Metadata operation failed: ${operation}`,
      { operation, ...context, cause: error instanceof Error ? error : new Error(String(error)) }
    );
    
    super.handleError(operation, metadataError, context);
  }
  
  /**
   * 验证配置
   */
  public validateConfig(config: MetadataManagerConfig): void {
    const metadataConfig = config as MetadataManagerConfig;
    if (metadataConfig.maximumParallelFetchingTorrent < 1) {
      throw new Error('maximumParallelFetchingTorrent must be greater than 0');
    }
    
    if (metadataConfig.maximumWaitingQueueSize < -1) {
      throw new Error('maximumWaitingQueueSize must be -1 (unlimited) or greater');
    }
    
    if (metadataConfig.downloadMaxTime < 1000) {
      throw new Error('downloadMaxTime must be at least 1000ms');
    }
    
    if (metadataConfig.aggressiveLevel < 0 || metadataConfig.aggressiveLevel > 2) {
      throw new Error('aggressiveLevel must be between 0 and 2');
    }
    
    if (metadataConfig.maxRetries && metadataConfig.maxRetries < 0) {
      throw new Error('maxRetries must be greater than or equal to 0');
    }
    
    if (metadataConfig.retryDelay && metadataConfig.retryDelay < 0) {
      throw new Error('retryDelay must be greater than or equal to 0');
    }
  }
  

  
  /**
   * 启动性能监控
   */
  private startPerformanceMonitoring(): void {
    // 使用通用性能监控功能
    this.addPerformanceMetric('metadata_manager_start', Date.now());
  }
  
  /**
   * 停止性能监控
   */
  private stopPerformanceMonitoring(): void {
    // 使用通用性能监控功能
    this.addPerformanceMetric('metadata_manager_stop', Date.now());
  }
  
  /**
   * 清理过期任务
   */
  private cleanupExpiredTasks(): void {
    const now = Date.now();
    const maxAge = 3600000; // 1小时
    
    // 清理等待队列中的过期项
    const originalLength = this.metadataWaitingQueues.length;
    this.metadataWaitingQueues = this.metadataWaitingQueues.filter(_item => {
      return now - this.startTime < maxAge;
    });
    
    const cleanedCount = originalLength - this.metadataWaitingQueues.length;
    if (cleanedCount > 0) {
      this.emit('memoryCleanup', {
        cleanedItems: cleanedCount,
        remainingItems: this.metadataWaitingQueues.length
      });
    }
  }

  /**
   * 执行内存清理
   */
  protected performMemoryCleanup(): void {
    try {
      // 清理过期的等待队列
      this.cleanupExpiredTasks();
      
      // 调用父类的内存清理功能
      super.performMemoryCleanup();
      
      // 触发垃圾回收（如果可用）
      if (global.gc) {
        global.gc();
      }
    } catch (error) {
      this.handleMetadataError('performMemoryCleanup', error);
    }
  }
  
  /**
   * 执行深度清理
   */
  protected performDeepCleanup(): void {
    try {
      // 停止性能监控
      this.stopPerformanceMonitoring();
      
      // 清理所有数据
      this.clearMetadataData();
      
      // 调用父类的深度清理
      super.performDeepCleanup();
    } catch (error) {
      this.handleMetadataError('performDeepCleanup', error);
    }
  }

  /**
   * 销毁管理器
   */
  async destroy(): Promise<void> {
    if (this.isDestroyed) {
      return;
    }
    
    this.isDestroyed = true;
    
    try {
      // 停止性能监控
      this.stopPerformanceMonitoring();
      
      // 清理所有数据
      this.clearMetadataData();
      
      // 移除所有事件监听器
      this.removeAllListeners();
      
      this.emit('destroyed');
    } catch (error) {
      this.handleMetadataError('destroy', error);
      throw error;
    }
  }
}

// 导出MetadataManagerConfig类型
export type { MetadataManagerConfig } from '../types/metadata';