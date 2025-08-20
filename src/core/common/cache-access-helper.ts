import { LRUCache } from 'lru-cache';
import { ErrorHandlerImpl } from '../../errors/error-handler';
import { CacheError } from '../../types/error';
import { ErrorType } from '../../types/error';

/**
 * 缓存访问配置接口
 */
export interface CacheAccessConfig {
  cacheName: string;
  enableAccessLogging?: boolean;
  enableRetry?: boolean;
  maxRetries?: number;
  retryDelay?: number;
  enableCompression?: boolean;
  compressionThreshold?: number;
  maxRetryAttempts?: number;
  circuitBreakerThreshold?: number;
}

/**
 * 缓存访问统计接口
 */
export interface CacheAccessStats {
  hits: number;
  misses: number;
  totalRequests: number;
  hitRate: number;
  lastAccessTime: number;
  compressionSavings: number;
}

/**
 * 缓存访问助手类
 */
export class CacheAccessHelper {
  private stats: Map<string, CacheAccessStats> = new Map();
  private accessHistory: Map<string, Array<{ key: string; hit: boolean; timestamp: number }>> = new Map();
  private compressedData: Map<string, Buffer> = new Map();

  constructor(
    private errorHandler: ErrorHandlerImpl,
    private config: CacheAccessConfig
  ) {
    this.initializeStats();
  }

  /**
   * 初始化统计信息
   */
  private initializeStats(): void {
    this.stats.set(this.config.cacheName, {
      hits: 0,
      misses: 0,
      totalRequests: 0,
      hitRate: 0,
      lastAccessTime: 0,
      compressionSavings: 0
    });
  }

  /**
   * 安全获取缓存值
   */
  async getWithRetry<T>(
    cache: LRUCache<string, T>,
    key: string,
    operation: string = 'cache_access'
  ): Promise<T | undefined> {
    return this.executeWithRetry(
      async () => {
        const value = cache.get(key);
        this.recordAccess(key, value !== undefined);
        return value;
      },
      operation,
      { key, cacheName: this.config.cacheName }
    );
  }

  /**
   * 安全设置缓存值
   */
  async setWithRetry<T>(
    cache: LRUCache<string, T>,
    key: string,
    value: T,
    ttl?: number,
    operation: string = 'cache_set'
  ): Promise<void> {
    return this.executeWithRetry(
      async () => {
        if (ttl) {
          cache.set(key, value, { ttl });
        } else {
          cache.set(key, value);
        }
        this.recordAccess(key, true);
      },
      operation,
      { key, cacheName: this.config.cacheName }
    );
  }

  /**
   * 批量获取缓存值
   */
  async batchGet<T>(
    cache: LRUCache<string, T>,
    keys: string[],
    operation: string = 'batch_cache_get'
  ): Promise<Map<string, T>> {
    const results = new Map<string, T>();
    
    for (const key of keys) {
      try {
        const value = await this.getWithRetry(cache, key, operation);
        if (value !== undefined) {
          results.set(key, value);
        }
      } catch (error) {
        this.errorHandler.handleError(error as Error, {
          operation,
          key,
          cacheName: this.config.cacheName,
          errorType: ErrorType.CACHE
        });
      }
    }
    
    return results;
  }

  /**
   * 批量设置缓存值
   */
  async batchSet<T>(
    cache: LRUCache<string, T>,
    entries: Array<{ key: string; value: T; ttl?: number }>,
    operation: string = 'batch_cache_set'
  ): Promise<void> {
    const promises = entries.map(async ({ key, value, ttl }) => {
      try {
        await this.setWithRetry(cache, key, value, ttl, operation);
      } catch (error) {
        this.errorHandler.handleError(error as Error, {
          operation,
          key,
          cacheName: this.config.cacheName,
          errorType: ErrorType.CACHE
        });
      }
    });
    
    await Promise.all(promises);
  }

  /**
   * 带压缩的缓存设置
   */
  async setWithCompression<T>(
    cache: LRUCache<string, T>,
    key: string,
    value: T,
    ttl?: number
  ): Promise<void> {
    if (!this.config.enableCompression) {
      return this.setWithRetry(cache, key, value, ttl, 'cache_set_compression');
    }

    try {
      const serialized = JSON.stringify(value);
      const originalSize = Buffer.byteLength(serialized, 'utf8');
      
      if (originalSize > (this.config.compressionThreshold || 1024)) {
        // 这里可以添加实际的压缩逻辑
        // 为了简化，暂时直接存储
        await this.setWithRetry(cache, key, value, ttl, 'cache_set_compression');
      } else {
        await this.setWithRetry(cache, key, value, ttl, 'cache_set_compression');
      }
    } catch (error) {
      this.errorHandler.handleError(error as Error, {
        operation: 'cache_set_compression',
        key,
        cacheName: this.config.cacheName,
        errorType: ErrorType.CACHE
      });
    }
  }

  /**
   * 获取缓存统计信息
   */
  getStats(): CacheAccessStats {
    return this.stats.get(this.config.cacheName) || {
      hits: 0,
      misses: 0,
      totalRequests: 0,
      hitRate: 0,
      lastAccessTime: 0,
      compressionSavings: 0
    };
  }

  /**
   * 获取访问历史
   */
  getAccessHistory(limit: number = 100): Array<{ key: string; hit: boolean; timestamp: number }> {
    const history = this.accessHistory.get(this.config.cacheName) || [];
    return history.slice(-limit);
  }

  /**
   * 重置统计信息
   */
  resetStats(): void {
    this.initializeStats();
    this.accessHistory.delete(this.config.cacheName);
  }

  /**
   * 记录访问
   */
  private recordAccess(key: string, hit: boolean): void {
    const stats = this.stats.get(this.config.cacheName)!;
    stats.totalRequests++;
    stats.lastAccessTime = Date.now();
    
    if (hit) {
      stats.hits++;
    } else {
      stats.misses++;
    }
    
    stats.hitRate = stats.hits / stats.totalRequests;
    
    // 记录访问历史
    if (!this.accessHistory.has(this.config.cacheName)) {
      this.accessHistory.set(this.config.cacheName, []);
    }
    
    const history = this.accessHistory.get(this.config.cacheName)!;
    history.push({ key, hit, timestamp: Date.now() });
    
    // 限制历史记录长度
    if (history.length > 1000) {
      history.splice(0, history.length - 1000);
    }
    
    // 记录日志
    if (this.config.enableAccessLogging) {
      console.log(`[${this.config.cacheName}] Cache ${hit ? 'hit' : 'miss'}: ${key}`);
    }
  }

  /**
   * 带重试的执行
   */
  private async executeWithRetry<T>(
    fn: () => Promise<T>,
    operation: string,
    context: any
  ): Promise<T> {
    if (!this.config.enableRetry) {
      return fn();
    }

    const maxRetries = this.config.maxRetries || 3;
    const retryDelay = this.config.retryDelay || 1000;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        if (attempt === maxRetries) {
          const cacheError = new CacheError(
            `Cache operation failed after ${maxRetries} attempts: ${operation}`,
            { operation, ...context }
          );
          this.errorHandler.handleError(cacheError, {
            operation,
            attempt,
            ...context,
            errorType: ErrorType.CACHE
          });
          throw cacheError;
        }
        
        // 指数退避
        await new Promise(resolve => setTimeout(resolve, retryDelay * Math.pow(2, attempt - 1)));
      }
    }
    
    throw new Error('Unreachable code');
  }
}

/**
 * 缓存访问助手工厂类
 */
export class CacheAccessHelperFactory {
  private static helpers: Map<string, CacheAccessHelper> = new Map();

  /**
   * 获取或创建缓存访问助手
   */
  static getHelper(
    errorHandler: ErrorHandlerImpl,
    config: CacheAccessConfig
  ): CacheAccessHelper {
    const key = `${config.cacheName}_${JSON.stringify(config)}`;
    
    if (!this.helpers.has(key)) {
      this.helpers.set(key, new CacheAccessHelper(errorHandler, config));
    }
    
    return this.helpers.get(key)!;
  }

  /**
   * 清理所有助手
   */
  static cleanup(): void {
    this.helpers.clear();
  }
}