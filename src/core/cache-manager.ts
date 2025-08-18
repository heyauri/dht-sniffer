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
  
  constructor(config: CacheConfig) {
    this.fetchedTuple = new LRUCache({ 
      max: config.fetchedTupleSize, 
      ttl: 3 * 60 * 60 * 1000 
    });
    
    this.fetchedInfoHash = new LRUCache({ 
      max: config.fetchedInfoHashSize, 
      ttl: 72 * 60 * 60 * 1000 
    });
    
    this.findNodeCache = new LRUCache({ 
      max: config.findNodeCacheSize, 
      ttl: 24 * 60 * 60 * 1000, 
      updateAgeOnHas: true 
    });
    
    this.latestCalledPeers = new LRUCache({ 
      max: config.latestCalledPeersSize, 
      ttl: 5 * 60 * 1000 
    });
    
    this.usefulPeers = new LRUCache({ 
      max: config.usefulPeersSize 
    });
    
    this.metadataFetchingCache = new LRUCache({ 
      max: config.metadataFetchingCacheSize, 
      ttl: 20 * 1000 
    });
    
    this.counter = {
      fetchedTupleHit: 0,
      fetchedInfoHashHit: 0,
      fetchedTupleSize: 0,
      fetchedInfoHashSize: 0,
      metadataFetchingCacheSize: 0
    };
  }
  
  /**
   * 获取fetchedTuple缓存
   */
  getFetchedTuple(): LRUCache<string, number> {
    return this.fetchedTuple;
  }
  
  /**
   * 获取fetchedInfoHash缓存
   */
  getFetchedInfoHash(): LRUCache<string, number> {
    return this.fetchedInfoHash;
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
  }
}