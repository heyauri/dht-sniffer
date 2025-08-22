import { LRUCache } from 'lru-cache';
import { ErrorHandlerImpl } from '../errors/error-handler';
import { CacheError } from '../types/error';
import { CacheConfig, CacheStats } from '../types/cache';
import { BaseManager, BaseManagerConfig, ManagerStats } from './base-manager';
import { CacheAccessHelper, CacheAccessHelperFactory, CacheAccessConfig } from './common/cache-access-helper';

/**
 * 扩展的内存使用情况接口，包含缓存内存信息
 */
interface ExtendedMemoryUsage extends NodeJS.MemoryUsage {
  cacheMemory: number;
  isMemoryWarning: boolean;
}

/**
 * 缓存管理器配置接口
 */
export interface CacheManagerExtendedConfig extends CacheConfig, BaseManagerConfig {}

/**
 * 缓存管理器 - 负责管理所有LRU缓存实例
 */
export class CacheManager extends BaseManager {
  private fetchedTuple: LRUCache<string, number>;
  private fetchedInfoHash: LRUCache<string, number>;
  private findNodeCache: LRUCache<string, number>;
  private latestCalledPeers: LRUCache<string, number>;
  private usefulPeers: LRUCache<string, { peer: any; infoHash?: Buffer }>;
  private metadataFetchingCache: LRUCache<string, number>;
  
  private counter: CacheStats;
  protected config: CacheManagerExtendedConfig;
  private compressedCache: Map<string, Buffer>;
  
  // 缓存访问助手
  private fetchedTupleHelper: CacheAccessHelper;
  private fetchedInfoHashHelper: CacheAccessHelper;
  
  constructor(config: CacheManagerExtendedConfig, errorHandler?: ErrorHandlerImpl) {
    super(config, errorHandler);
    
    // 设置缓存特定默认配置
    this.config = {
      enableDynamicSizing: true,
      enablePreheating: false,
      minCacheSize: 100,
      maxCacheSize: 100000,
      cacheHitThreshold: 0.8,
      enableCompression: false,
      compressionThreshold: 1024, // 1KB
      maxRetryAttempts: 3,
      circuitBreakerThreshold: 5,
      memoryWarningThreshold: 50 * 1024 * 1024, // 50MB
      ...config
    };
    
    this.compressedCache = new Map();
    
    // 初始化缓存实例
    this.fetchedTuple = new LRUCache({ 
      max: this.config.fetchedTupleSize, 
      ttl: 3 * 60 * 60 * 1000 
    });
    
    this.fetchedInfoHash = new LRUCache({ 
      max: this.config.fetchedInfoHashSize, 
      ttl: 72 * 60 * 60 * 1000 
    });
    
    this.findNodeCache = new LRUCache({ 
      max: this.config.findNodeCacheSize, 
      ttl: 24 * 60 * 60 * 1000, 
      updateAgeOnHas: true 
    });
    
    this.latestCalledPeers = new LRUCache({ 
      max: this.config.latestCalledPeersSize, 
      ttl: 5 * 60 * 1000 
    });
    
    this.usefulPeers = new LRUCache<string, { peer: any; infoHash?: Buffer }>({ 
      max: this.config.usefulPeersSize 
    });
    
    this.metadataFetchingCache = new LRUCache({ 
      max: this.config.metadataFetchingCacheSize, 
      ttl: 20 * 1000 
    });
    
    // 初始化缓存访问助手
    const cacheAccessConfig: CacheAccessConfig = {
      cacheName: 'default',
      enableCompression: this.config.enableCompression,
      compressionThreshold: this.config.compressionThreshold,
      maxRetryAttempts: this.config.maxRetryAttempts,
      circuitBreakerThreshold: this.config.circuitBreakerThreshold,
    };
    
    // 创建缓存访问助手
    const fetchedTupleConfig: CacheAccessConfig = {
      ...cacheAccessConfig,
      cacheName: 'fetchedTuple'
    };
    this.fetchedTupleHelper = CacheAccessHelperFactory.getHelper(this.errorHandler, fetchedTupleConfig);
    
    const fetchedInfoHashConfig: CacheAccessConfig = {
      ...cacheAccessConfig,
      cacheName: 'fetchedInfoHash'
    };
    this.fetchedInfoHashHelper = CacheAccessHelperFactory.getHelper(this.errorHandler, fetchedInfoHashConfig);
    

    
    this.counter = {
      fetchedTupleHit: 0,
      fetchedInfoHashHit: 0,
      fetchedTupleSize: 0,
      fetchedInfoHashSize: 0,
      metadataFetchingCacheSize: 0,
      fetchedTupleMiss: 0,
      fetchedInfoHashMiss: 0,
      totalRequests: 0,
      hitRate: 0,
      lastCleanupTime: Date.now(),
      dynamicSizingEvents: 0,
      preheatingEvents: 0,
      totalSize: 0
    };
  }
  
  /**
   * 获取fetchedTuple缓存
   */
  getFetchedTuple(): LRUCache<string, number> {
    return this.fetchedTuple;
  }
  
  /**
   * 从fetchedTuple缓存获取值（带访问记录）
   * @param key 缓存键
   * @returns 缓存值或undefined
   */
  async getFetchedTupleValue(key: string): Promise<number | undefined> {
    return this.fetchedTupleHelper.getWithRetry(this.fetchedTuple, key);
  }
  
  /**
   * 获取fetchedInfoHash缓存
   */
  getFetchedInfoHash(): LRUCache<string, number> {
    return this.fetchedInfoHash;
  }
  
  /**
   * 从fetchedInfoHash缓存获取值（带访问记录）
   * @param key 缓存键
   * @returns 缓存值或undefined
   */
  async getFetchedInfoHashValue(key: string): Promise<number | undefined> {
    return this.fetchedInfoHashHelper.getWithRetry(this.fetchedInfoHash, key);
  }
  
  /**
   * 获取findNodeCache缓存
   */
  getFindNodeCache(): LRUCache<string, number> {
    return this.findNodeCache;
  }
  
  /**
   * 获取latestCalledPeers缓存
   */
  getLatestCalledPeers(): LRUCache<string, number> {
    return this.latestCalledPeers;
  }
  
  /**
   * 获取usefulPeers缓存
   */
  getUsefulPeers(): LRUCache<string, any> {
    return this.usefulPeers;
  }
  
  /**
   * 获取metadataFetchingCache缓存
   */
  getMetadataFetchingCache(): LRUCache<string, number> {
    return this.metadataFetchingCache;
  }
  
  /**
   * 记录fetchedTuple命中
   */
  incrementFetchedTupleHit(): void {
    this.counter.fetchedTupleHit++;
  }
  
  /**
   * 记录fetchedInfoHash命中
   */
  incrementFetchedInfoHashHit(): void {
    this.counter.fetchedInfoHashHit++;
  }
  
  /**
   * 获取缓存统计信息
   */
  getCacheStats(): CacheStats {
    return {
      ...this.counter,
      fetchedTupleSize: this.fetchedTuple.size,
      fetchedInfoHashSize: this.fetchedInfoHash.size,
      metadataFetchingCacheSize: this.metadataFetchingCache.size,
      totalSize: this.fetchedTuple.size + this.fetchedInfoHash.size + this.findNodeCache.size + this.latestCalledPeers.size + this.usefulPeers.size + this.metadataFetchingCache.size
    };
  }
  
  /**
   * 获取详细的缓存统计信息
   */
  getDetailedStats(): CacheStats & {
    cacheSizes: {
      fetchedTuple: number;
      fetchedInfoHash: number;
      findNodeCache: number;
      latestCalledPeers: number;
      usefulPeers: number;
      metadataFetchingCache: number;
    };
    accessHistorySize: number;
    uptime: number;
  } {
    const now = Date.now();
    const uptime = now - (this.counter.lastCleanupTime - (this.config.cleanupInterval || 0));
    
    return {
      ...this.getStats(),
      cacheSizes: {
        fetchedTuple: this.fetchedTuple.max,
        fetchedInfoHash: this.fetchedInfoHash.max,
        findNodeCache: this.findNodeCache.max,
        latestCalledPeers: this.latestCalledPeers.max,
        usefulPeers: this.usefulPeers.max,
        metadataFetchingCache: this.metadataFetchingCache.max
      },
      accessHistorySize: this.cacheAccessHistory.size,
      uptime
    };
  }
  
  /**
   * 清理所有缓存
   */
  clearAllCaches(): void {
    try {
      this.fetchedTuple.clear();
      this.fetchedInfoHash.clear();
      this.findNodeCache.clear();
      this.latestCalledPeers.clear();
      this.usefulPeers.clear();
      this.metadataFetchingCache.clear();
      this.compressedCache.clear();
      this.emit('cachesCleared');
    } catch (error) {
      this.handleError('clearAllCaches', error);
    }
  }
  
  /**
   * 添加peer到缓存
   */
  addPeerToCache(peerKey: string, peerInfo: { peer: any; infoHash?: Buffer }): void {
    try {
      const { peer, infoHash } = peerInfo;
      
      // 检查是否需要压缩
      if (this.config.enableCompression && this.shouldCompress(peer)) {
        const compressed = this.compressData(peer);
        this.compressedCache.set(peerKey, compressed);
      }
      
      this.usefulPeers.set(peerKey, { peer, infoHash });
      this.emit('peerAdded', { peerKey, peerInfo });
    } catch (error) {
      this.handleError('addPeerToCache', error, { peerKey });
    }
  }
  
  /**
   * 获取所有peers
   */
  getAllPeers(): any[] {
    const peers: any[] = [];
    for (const [_key, value] of this.usefulPeers) {
      // 返回包含完整信息的peer对象
      peers.push({
        ...value.peer,
        infoHash: value.infoHash
      });
    }
    return peers;
  }
  
  /**
   * 获取peer数量
   */
  getPeerCount(): number {
    return this.usefulPeers.size;
  }
  
  /**
   * 重置统计计数器
   */
  resetStats(): void {
    this.counter.fetchedTupleHit = 0;
    this.counter.fetchedInfoHashHit = 0;
    this.counter.fetchedTupleMiss = 0;
    this.counter.fetchedInfoHashMiss = 0;
    this.counter.totalRequests = 0;
    this.counter.hitRate = 0;
  }
  

  
  /**
   * 更新缓存命中率
   */
  private updateHitRate(): void {
    const totalHits = this.counter.fetchedTupleHit + this.counter.fetchedInfoHashHit;
    const totalRequests = this.counter.fetchedTupleHit + this.counter.fetchedTupleMiss + 
                         this.counter.fetchedInfoHashHit + this.counter.fetchedInfoHashMiss;
    
    if (totalRequests > 0) {
      this.counter.hitRate = totalHits / totalRequests;
    }
  }
  
  /**
   * 动态调整缓存大小
   */
  private adjustCacheSizes(): void {
    if (!this.config.enableDynamicSizing) return;
    
    const hitRate = this.counter.hitRate;
    const threshold = this.config.cacheHitThreshold || 0.8;
    
    if (hitRate > threshold) {
      // 命中率高，可以增加缓存大小
      this.increaseCacheSizes();
    } else if (hitRate < threshold * 0.5) {
      // 命中率低，减少缓存大小
      this.decreaseCacheSizes();
    }
    
    this.counter.dynamicSizingEvents++;
  }
  
  /**
   * 增加缓存大小
   */
  private increaseCacheSizes(): void {
    const maxSize = this.config.maxCacheSize || 100000;
    
    // 增加fetchedTuple缓存大小
    if (this.fetchedTuple.max < maxSize) {
      const newMax = Math.min(this.fetchedTuple.max * 1.2, maxSize);
      const entries = Array.from(this.fetchedTuple.entries());
      this.fetchedTuple = new LRUCache({ 
        max: newMax, 
        ttl: 3 * 60 * 60 * 1000 
      });
      // 重新填充缓存数据
      entries.forEach(([key, value]) => {
        this.fetchedTuple.set(key, value);
      });
      this.updateHitRate();
    }
    
    // 增加fetchedInfoHash缓存大小
    if (this.fetchedInfoHash.max < maxSize) {
      const newMax = Math.min(this.fetchedInfoHash.max * 1.2, maxSize);
      const entries = Array.from(this.fetchedInfoHash.entries());
      this.fetchedInfoHash = new LRUCache({ 
        max: newMax, 
        ttl: 72 * 60 * 60 * 1000 
      });
      // 重新填充缓存数据
      entries.forEach(([key, value]) => {
        this.fetchedInfoHash.set(key, value);
      });
      this.updateHitRate();
    }
  }
  
  /**
   * 减少缓存大小
   */
  private decreaseCacheSizes(): void {
    const minSize = this.config.minCacheSize || 100;
    
    // 减少fetchedTuple缓存大小
    if (this.fetchedTuple.max > minSize) {
      const newMax = Math.max(this.fetchedTuple.max * 0.8, minSize);
      const entries = Array.from(this.fetchedTuple.entries());
      // 只保留最新的条目（LRU策略）
      const entriesToKeep = entries.slice(-Math.floor(newMax));
      this.fetchedTuple = new LRUCache({ 
        max: newMax, 
        ttl: 3 * 60 * 60 * 1000 
      });
      // 重新填充缓存数据
      entriesToKeep.forEach(([key, value]) => {
        this.fetchedTuple.set(key, value);
      });
      this.updateHitRate();
    }
    
    // 减少fetchedInfoHash缓存大小
    if (this.fetchedInfoHash.max > minSize) {
      const newMax = Math.max(this.fetchedInfoHash.max * 0.8, minSize);
      const entries = Array.from(this.fetchedInfoHash.entries());
      // 只保留最新的条目（LRU策略）
      const entriesToKeep = entries.slice(-Math.floor(newMax));
      this.fetchedInfoHash = new LRUCache({ 
        max: newMax, 
        ttl: 72 * 60 * 60 * 1000 
      });
      // 重新填充缓存数据
      entriesToKeep.forEach(([key, value]) => {
        this.fetchedInfoHash.set(key, value);
      });
      this.updateHitRate();
    }
  }
  


  
  /**
   * 缓存预热
   * @param data 预热数据
   */
  preheatCache(data: Array<{ key: string; value: number; cacheName: string }>): void {
    if (!this.config.enablePreheating) return;
    
    data.forEach(({ key, value, cacheName }) => {
      let cache: LRUCache<string, number>;
      
      switch (cacheName) {
        case 'fetchedTuple':
          cache = this.fetchedTuple;
          break;
        case 'fetchedInfoHash':
          cache = this.fetchedInfoHash;
          break;
        case 'findNodeCache':
          cache = this.findNodeCache;
          break;
        default:
          return;
      }
      
      if (cache && !cache.has(key)) {
        cache.set(key, value);
        this.updateHitRate();
      }
    });
    
    this.counter.preheatingEvents++;
  }
  
  /**
   * 重置所有熔断器状态
   */
  private resetAllCircuitBreakers(): void {
    this.circuitBreakerState.clear();
  }

  /**
   * 执行深度清理
   */
  protected performDeepCleanup(): void {
    try {
      // 清理所有缓存
      this.clearAllCaches();
      
      // 清理访问历史记录
      this.clearExpiredAccessHistory();
      
      // 清理熔断器状态
      this.resetAllCircuitBreakers();
      
      // 调用父类的深度清理
      super.performDeepCleanup();
    } catch (error) {
      this.handleCacheError('performDeepCleanup', error);
    }
  }
  

  

  
  /**
   * 获取管理器名称
   */
  protected getManagerName(): string {
    return 'CacheManager';
  }

  /**
   * 执行清理操作
   */
  protected performCleanup(): void {
    this.clearExpiredAccessHistory();
    this.adjustCacheSizes();
  }

  /**
   * 清理数据
   */
  protected clearData(): void {
    this.clearAllCaches();
    this.cacheAccessHistory.clear();
    this.circuitBreakerState.clear();
    this.retryAttempts.clear();
    this.compressedCache.clear();
  }

  /**
   * 获取统计信息
   */
  getStats(): ManagerStats & CacheStats {
    return {
      ...super.getStats(),
      ...this.getCacheStats()
    };
  }

  /**
   * 缓存特定的错误处理
   */
  protected handleCacheError(operation: string, error: any, context?: any): void {
    const cacheError = new CacheError(
      `Cache operation failed: ${operation}`,
      { operation, ...context, cause: error instanceof Error ? error : new Error(String(error)) }
    );
    
    super.handleError(operation, cacheError, context);
  }
  
  /**
   * 验证配置
   */
  public validateConfig(config: CacheManagerExtendedConfig): void {
    const cacheConfig = config as CacheManagerExtendedConfig;
    
    if (cacheConfig.fetchedTupleSize !== undefined && (typeof cacheConfig.fetchedTupleSize !== 'number' || cacheConfig.fetchedTupleSize <= 0)) {
      throw new Error('fetchedTupleSize must be a positive number');
    }
    
    if (cacheConfig.fetchedInfoHashSize !== undefined && (typeof cacheConfig.fetchedInfoHashSize !== 'number' || cacheConfig.fetchedInfoHashSize <= 0)) {
      throw new Error('fetchedInfoHashSize must be a positive number');
    }
    
    if (cacheConfig.findNodeCacheSize !== undefined && (typeof cacheConfig.findNodeCacheSize !== 'number' || cacheConfig.findNodeCacheSize <= 0)) {
      throw new Error('findNodeCacheSize must be a positive number');
    }
    
    if (cacheConfig.latestCalledPeersSize !== undefined && (typeof cacheConfig.latestCalledPeersSize !== 'number' || cacheConfig.latestCalledPeersSize <= 0)) {
      throw new Error('latestCalledPeersSize must be a positive number');
    }
    
    if (cacheConfig.usefulPeersSize !== undefined && (typeof cacheConfig.usefulPeersSize !== 'number' || cacheConfig.usefulPeersSize <= 0)) {
      throw new Error('usefulPeersSize must be a positive number');
    }
    
    if (cacheConfig.metadataFetchingCacheSize !== undefined && (typeof cacheConfig.metadataFetchingCacheSize !== 'number' || cacheConfig.metadataFetchingCacheSize <= 0)) {
      throw new Error('metadataFetchingCacheSize must be a positive number');
    }
    
    if (cacheConfig.maxCacheSize !== undefined && (typeof cacheConfig.maxCacheSize !== 'number' || cacheConfig.maxCacheSize <= 0)) {
      throw new Error('maxCacheSize must be a positive number');
    }
    
    if (cacheConfig.minCacheSize !== undefined && (typeof cacheConfig.minCacheSize !== 'number' || cacheConfig.minCacheSize <= 0)) {
      throw new Error('minCacheSize must be a positive number');
    }
    
    if (cacheConfig.cacheHitThreshold !== undefined && (typeof cacheConfig.cacheHitThreshold !== 'number' || cacheConfig.cacheHitThreshold < 0 || cacheConfig.cacheHitThreshold > 1)) {
      throw new Error('cacheHitThreshold must be a number between 0 and 1');
    }
  }
  
  /**
   * 检查是否需要压缩数据
   */
  private shouldCompress(data: any): boolean {
    if (!this.config.enableCompression) {
      return false;
    }
    
    try {
      const dataSize = JSON.stringify(data).length;
      return dataSize > (this.config.compressionThreshold || 1024);
    } catch {
      return false;
    }
  }
  
  /**
   * 压缩数据
   */
  private compressData(data: any): Buffer {
    try {
      const jsonString = JSON.stringify(data);
      return Buffer.from(jsonString, 'utf8');
    } catch (error) {
      this.handleError('compressData', error);
      return Buffer.from(JSON.stringify({}));
    }
  }
  
  /**
   * 解压数据
   */
  private decompressData(compressed: Buffer): any {
    try {
      const jsonString = compressed.toString('utf8');
      return JSON.parse(jsonString);
    } catch (error) {
      this.handleError('decompressData', error);
      return null;
    }
  }
  
  /**
   * 获取压缩的peer数据
   */
  getCompressedPeer(peerKey: string): any | null {
    const compressed = this.compressedCache.get(peerKey);
    if (!compressed) {
      return null;
    }
    
    return this.decompressData(compressed);
  }
  
  /**
   * 计算缓存内存使用量
   */
  private calculateCacheMemory(): number {
    return (
      this.fetchedTuple.size * 50 + // 估算每个条目50字节
      this.fetchedInfoHash.size * 50 +
      this.findNodeCache.size * 50 +
      this.latestCalledPeers.size * 50 +
      this.usefulPeers.size * 200 + // peer数据较大
      this.metadataFetchingCache.size * 50 +
      this.compressedCache.size * 100 // 压缩数据
    );
  }
  
  /**
   * 获取内存使用情况
   */
  getMemoryUsage(): ExtendedMemoryUsage {
    const memoryUsage = process.memoryUsage();
    const threshold = this.config.memoryWarningThreshold || 50 * 1024 * 1024;
    const cacheMemory = this.calculateCacheMemory();
    const isMemoryWarning = memoryUsage.heapUsed > threshold;
    
    if (isMemoryWarning) {
      this.emit('memoryWarning', {
        heapUsed: memoryUsage.heapUsed,
        threshold,
        cacheMemory
      });
    }
    
    return {
      ...memoryUsage,
      cacheMemory,
      isMemoryWarning
    };
  }
  


  /**
   * 清理过期访问历史记录
   */
  private clearExpiredAccessHistory(): void {
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24小时
    
    for (const [key, value] of this.cacheAccessHistory.entries()) {
      if (now - value.lastAccess > maxAge) {
        this.cacheAccessHistory.delete(key);
      }
    }
  }

  /**
   * 清理内存
   */
  async cleanupMemory(): Promise<void> {
    try {
      // 清理过期缓存
      this.fetchedTuple.purgeStale();
      this.fetchedInfoHash.purgeStale();
      this.findNodeCache.purgeStale();
      this.latestCalledPeers.purgeStale();
      this.metadataFetchingCache.purgeStale();
      
      // 清理压缩缓存
      this.compressedCache.clear();
      
      // 清理访问历史记录
      this.clearExpiredAccessHistory();
      
      // 使用通用内存清理功能
      this.performMemoryCleanup();
      
      this.emit('memoryCleaned');
    } catch (error) {
      this.handleCacheError('cleanupMemory', error);
    }
  }




  
  
  
  /**
   * 获取压缩缓存统计
   */
  getCompressionStats(): {
    compressedItems: number;
    estimatedOriginalSize: number;
    compressedSize: number;
    compressionRatio: number;
  } {
    const compressedItems = this.compressedCache.size;
    let estimatedOriginalSize = 0;
    let compressedSize = 0;
    
    for (const [_key, compressed] of this.compressedCache) {
      try {
        const decompressed = this.decompressData(compressed);
        if (decompressed) {
          estimatedOriginalSize += JSON.stringify(decompressed).length;
        }
        compressedSize += compressed.length;
      } catch {
        // 忽略解压错误
      }
    }
    
    const compressionRatio = estimatedOriginalSize > 0 
      ? (estimatedOriginalSize - compressedSize) / estimatedOriginalSize 
      : 0;
    
    return {
      compressedItems,
      estimatedOriginalSize,
      compressedSize,
      compressionRatio
    };
  }
}

// 导出CacheConfig类型
export type { CacheConfig } from '../types/cache';