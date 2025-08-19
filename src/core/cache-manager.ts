import { LRUCache } from 'lru-cache';

/**
 * 缓存配置接口
 */
export interface CacheConfig {
  fetchedTupleSize: number;
  fetchedInfoHashSize: number;
  findNodeCacheSize: number;
  latestCalledPeersSize: number;
  usefulPeersSize: number;
  metadataFetchingCacheSize: number;
  // 新增缓存策略配置
  enableDynamicSizing?: boolean;
  enablePreheating?: boolean;
  minCacheSize?: number;
  maxCacheSize?: number;
  cacheHitThreshold?: number;
  cleanupInterval?: number;
}

/**
 * 缓存统计信息
 */
export interface CacheStats {
  fetchedTupleHit: number;
  fetchedInfoHashHit: number;
  fetchedTupleSize: number;
  fetchedInfoHashSize: number;
  metadataFetchingCacheSize: number;
  // 新增统计信息
  fetchedTupleMiss: number;
  fetchedInfoHashMiss: number;
  totalRequests: number;
  hitRate: number;
  lastCleanupTime: number;
  dynamicSizingEvents: number;
  preheatingEvents: number;
}

/**
 * 缓存管理器 - 负责管理所有LRU缓存实例
 */
export class CacheManager {
  private fetchedTuple: LRUCache<string, number>;
  private fetchedInfoHash: LRUCache<string, number>;
  private findNodeCache: LRUCache<string, number>;
  private latestCalledPeers: LRUCache<string, number>;
  private usefulPeers: LRUCache<string, any>;
  private metadataFetchingCache: LRUCache<string, number>;
  
  private counter: CacheStats;
  private config: CacheConfig;
  private cleanupInterval: NodeJS.Timeout | null;
  private cacheAccessHistory: Map<string, { count: number; lastAccess: number }>;
  
  constructor(config: CacheConfig) {
    // 设置默认配置
    this.config = {
      enableDynamicSizing: true,
      enablePreheating: false,
      minCacheSize: 100,
      maxCacheSize: 100000,
      cacheHitThreshold: 0.8,
      cleanupInterval: 5 * 60 * 1000, // 5分钟
      ...config
    };
    
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
    
    this.usefulPeers = new LRUCache({ 
      max: this.config.usefulPeersSize 
    });
    
    this.metadataFetchingCache = new LRUCache({ 
      max: this.config.metadataFetchingCacheSize, 
      ttl: 20 * 1000 
    });
    
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
      preheatingEvents: 0
    };
    
    this.cleanupInterval = null;
    this.cacheAccessHistory = new Map();
    
    // 启动定期清理任务
    this.startPeriodicCleanup();
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
  getFetchedTupleValue(key: string): number | undefined {
    const value = this.fetchedTuple.get(key);
    this.recordCacheAccess('fetchedTuple', key, value !== undefined);
    return value;
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
  getFetchedInfoHashValue(key: string): number | undefined {
    const value = this.fetchedInfoHash.get(key);
    this.recordCacheAccess('fetchedInfoHash', key, value !== undefined);
    return value;
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
  getStats(): CacheStats {
    return {
      ...this.counter,
      fetchedTupleSize: this.fetchedTuple.size,
      fetchedInfoHashSize: this.fetchedInfoHash.size,
      metadataFetchingCacheSize: this.metadataFetchingCache.size
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
  clearAll(): void {
    this.fetchedTuple.clear();
    this.fetchedInfoHash.clear();
    this.findNodeCache.clear();
    this.latestCalledPeers.clear();
    this.usefulPeers.clear();
    this.metadataFetchingCache.clear();
  }
  
  /**
   * 添加peer到缓存
   */
  addPeerToCache(peerKey: string, peerInfo: { peer: any; infoHash?: Buffer }): void {
    const { peer, infoHash } = peerInfo;
    this.usefulPeers.set(peerKey, { peer, infoHash });
  }
  
  /**
   * 获取所有peers
   */
  getAllPeers(): any[] {
    const peers: any[] = [];
    for (const [key, value] of this.usefulPeers) {
      peers.push(value.peer);
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
   * 记录缓存访问
   * @param cacheName 缓存名称
   * @param key 缓存键
   * @param hit 是否命中
   */
  private recordCacheAccess(cacheName: string, key: string, hit: boolean): void {
    this.counter.totalRequests++;
    
    // 更新访问历史
    const accessKey = `${cacheName}:${key}`;
    const current = this.cacheAccessHistory.get(accessKey) || { count: 0, lastAccess: 0 };
    this.cacheAccessHistory.set(accessKey, {
      count: current.count + 1,
      lastAccess: Date.now()
    });
    
    // 更新统计
    if (cacheName === 'fetchedTuple') {
      if (hit) {
        this.counter.fetchedTupleHit++;
      } else {
        this.counter.fetchedTupleMiss++;
      }
    } else if (cacheName === 'fetchedInfoHash') {
      if (hit) {
        this.counter.fetchedInfoHashHit++;
      } else {
        this.counter.fetchedInfoHashMiss++;
      }
    }
    
    // 计算命中率
    this.updateHitRate();
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
    }
  }
  
  /**
   * 启动定期清理任务
   */
  private startPeriodicCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    
    this.cleanupInterval = setInterval(() => {
      this.performCleanup();
    }, this.config.cleanupInterval);
  }
  
  /**
   * 执行缓存清理
   */
  private performCleanup(): void {
    const now = Date.now();
    this.counter.lastCleanupTime = now;
    
    // 清理过期的访问历史记录
    const expiredKeys: string[] = [];
    for (const [key, data] of this.cacheAccessHistory) {
      if (now - data.lastAccess > 24 * 60 * 60 * 1000) { // 24小时
        expiredKeys.push(key);
      }
    }
    
    expiredKeys.forEach(key => this.cacheAccessHistory.delete(key));
    
    // 动态调整缓存大小
    this.adjustCacheSizes();
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
      }
    });
    
    this.counter.preheatingEvents++;
  }
  
  /**
   * 停止定期清理任务
   */
  stopPeriodicCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
  
  /**
   * 销毁缓存管理器
   */
  destroy(): void {
    this.stopPeriodicCleanup();
    this.clearAll();
    this.cacheAccessHistory.clear();
  }
}