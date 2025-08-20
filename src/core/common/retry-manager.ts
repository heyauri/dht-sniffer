import { EventEmitter } from 'events';
import { TimeoutError } from '../../types/error';

/**
 * 重试配置接口
 */
export interface RetryConfig {
  enableRetry: boolean;
  maxRetries: number;
  retryDelay: number;
  retryBackoffFactor: number;
  requestTimeout: number;
}

/**
 * 重试统计信息
 */
export interface RetryStats {
  totalAttempts: number;
  successfulAttempts: number;
  failedAttempts: number;
  currentRetryCount: Record<string, number>;
}

/**
 * 重试事件
 */
export interface RetryEvent {
  operation: string;
  attempt: number;
  maxAttempts: number;
  delay: number;
  error: string;
  context?: any;
}

/**
 * 重试管理器 - 统一管理重试逻辑
 */
export class RetryManager extends EventEmitter {
  private config: RetryConfig;
  private retryCount: Record<string, number>;
  private stats: RetryStats;

  constructor(config: Partial<RetryConfig> = {}) {
    super();
    
    // 设置默认配置
    this.config = {
      enableRetry: true,
      maxRetries: 3,
      retryDelay: 1000,
      retryBackoffFactor: 2,
      requestTimeout: 30000,
      ...config
    };
    
    this.retryCount = {};
    this.stats = {
      totalAttempts: 0,
      successfulAttempts: 0,
      failedAttempts: 0,
      currentRetryCount: {}
    };
  }

  /**
   * 带重试机制的执行器
   */
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    operationKey: string,
    context?: any
  ): Promise<T> {
    if (!this.config.enableRetry) {
      return operation();
    }
    
    let lastError: Error;
    let attempt = 0;
    const maxAttempts = this.config.maxRetries + 1;
    
    // 初始化重试计数
    if (!this.retryCount[operationKey]) {
      this.retryCount[operationKey] = 0;
    }
    
    while (attempt < maxAttempts) {
      try {
        this.stats.totalAttempts++;
        
        const result = await Promise.race([
          operation(),
          new Promise<never>((_, reject) => 
            setTimeout(() => reject(new TimeoutError('Operation timeout')), this.config.requestTimeout)
          )
        ]);
        
        this.stats.successfulAttempts++;
        return result;
      } catch (error) {
        lastError = error as Error;
        attempt++;
        this.retryCount[operationKey]++;
        this.stats.failedAttempts++;
        
        // 如果是最后一次尝试，抛出错误
        if (attempt >= maxAttempts) {
          break;
        }
        
        // 计算退避延迟
        const delay = this.config.retryDelay * Math.pow(this.config.retryBackoffFactor, attempt - 1);
        
        // 发送重试事件
        const retryEvent: RetryEvent = {
          operation: operationKey,
          attempt,
          maxAttempts,
          delay,
          error: lastError.message,
          context
        };
        
        this.emit('retry', retryEvent);
        
        // 等待延迟时间
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw lastError!;
  }

  /**
   * 重置指定操作的重试计数
   */
  resetRetryCount(operationKey: string): void {
    delete this.retryCount[operationKey];
  }

  /**
   * 清理过期的重试计数
   */
  cleanupExpiredRetries(maxAge: number = 3600000): void {
    const now = Date.now();
    
    Object.keys(this.retryCount).forEach(key => {
      if (now - this.getOperationStartTime(key) > maxAge) {
        delete this.retryCount[key];
      }
    });
  }

  /**
   * 获取重试统计信息
   */
  getRetryStats(): RetryStats {
    return {
      ...this.stats,
      currentRetryCount: { ...this.retryCount }
    };
  }

  /**
   * 获取操作开始时间（简化实现）
   */
  private getOperationStartTime(operationKey: string): number {
    // 这里简化实现，实际应用中可以记录更精确的开始时间
    return Date.now() - (this.retryCount[operationKey] * this.config.retryDelay);
  }

  /**
   * 更新配置
   */
  updateConfig(newConfig: Partial<RetryConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * 清理所有重试计数
   */
  clearAllRetryCounts(): void {
    this.retryCount = {};
  }

  /**
   * 销毁重试管理器
   */
  destroy(): void {
    this.clearAllRetryCounts();
    this.removeAllListeners();
  }
}