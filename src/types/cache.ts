/**
 * 缓存相关类型定义
 */

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
  enableDynamicSizing?: boolean;
  enablePreheating?: boolean;
  minCacheSize?: number;
  maxCacheSize?: number;
  cacheHitThreshold?: number;
  cleanupInterval?: number;
  enableErrorHandling?: boolean;
  enableCompression?: boolean;
  compressionThreshold?: number;
  maxRetryAttempts?: number;
  circuitBreakerThreshold?: number;
  memoryWarningThreshold?: number;
}

/**
 * 缓存统计信息接口
 */
export interface CacheStats {
  fetchedTupleHit: number;
  fetchedInfoHashHit: number;
  fetchedTupleSize: number;
  fetchedInfoHashSize: number;
  metadataFetchingCacheSize: number;
  fetchedTupleMiss: number;
  fetchedInfoHashMiss: number;
  totalRequests: number;
  hitRate: number;
  lastCleanupTime: number;
  dynamicSizingEvents: number;
  preheatingEvents: number;
  totalSize: number;
}

/**
 * 缓存项接口
 */
export interface CacheItem<T = any> {
  value: T;
  timestamp: number;
  accessCount: number;
  size: number;
  compressed?: boolean;
}

/**
 * 缓存事件接口
 */
export interface CacheEvents {
  set: (key: string, value: any) => void;
  get: (key: string, value: any | undefined) => void;
  delete: (key: string) => void;
  clear: () => void;
  resize: (newSize: number) => void;
  stats: (stats: CacheStats) => void;
  cleanup: (removedCount: number) => void;
  memoryWarning: (usage: number, threshold: number) => void;
  persistenceError: (error: Error) => void;
}

/**
 * 缓存选项接口
 */
export interface CacheOptions {
  max?: number;
  ttl?: number;
  updateAgeOnGet?: boolean;
  updateAgeOnHas?: boolean;
  allowStale?: boolean;
  noDeleteOnFetchRejection?: boolean;
  noDeleteOnStaleGet?: boolean;
  maxSize?: number;
  sizeCalculation?: (value: any, key: string) => number;
  fetchMethod?: (key: string, staleValue: any, context: { options: any, signal: AbortSignal }) => Promise<any> | any;
  fetchContext?: any;
  dispose?: (value: any, key: string) => void;
  disposeAfter?: (value: any, key: string) => void;
}

/**
 * 增强的LRUCache接口
 */
export interface EnhancedLRUCache<K = any, V = any> extends LRUCache<K, V> {
  getStats(): CacheStats;
  enableStats(enable: boolean): void;
  clearStats(): void;
  getMemoryUsage(): number;
  cleanup(): number;
  compress(): number;
  decompress(key: string): boolean;
  saveToDisk(path?: string): Promise<void>;
  loadFromDisk(path?: string): Promise<void>;
  enableMemoryMonitoring(enable: boolean, threshold?: number, interval?: number): void;
}