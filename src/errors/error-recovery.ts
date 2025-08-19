/**
 * 错误恢复策略实现
 */
import { EventEmitter } from 'events';
import { 
  AppError, 
  ErrorType, 
  RecoveryStrategy, 
  RecoveryOptions, 
  RecoveryResult,
  isAppError
} from './error-types';

/**
 * 网络错误恢复策略
 */
export class NetworkErrorRecoveryStrategy implements RecoveryStrategy {
  private options: RecoveryOptions;

  constructor(options: RecoveryOptions = {}) {
    this.options = {
      maxRetries: 3,
      baseDelay: 1000,
      maxDelay: 30000,
      backoffFactor: 2,
      jitter: true,
      enableExponentialBackoff: true,
      ...options
    };
  }

  canRecover(error: AppError): boolean {
    return error.type === ErrorType.NETWORK && error.recoverable;
  }

  async recover(error: AppError): Promise<boolean> {
    // 网络错误的恢复逻辑
    const context = error.context;
    
    // 如果有peer信息，尝试重新连接
    if (context.peer) {
      // 这里可以添加重新连接逻辑
      // 实际实现会根据具体的网络操作而定
      return true;
    }
    
    // 如果是DHT相关错误，尝试重新初始化DHT连接
    if (context.component === 'DHT') {
      // 这里可以添加DHT重新初始化逻辑
      return true;
    }
    
    return false;
  }

  getDelay(attempt: number): number {
    let delay = this.options.baseDelay || 1000;
    
    if (this.options.enableExponentialBackoff) {
      delay = delay * Math.pow(this.options.backoffFactor || 2, attempt - 1);
    }
    
    // 添加抖动以避免 thundering herd 问题
    if (this.options.jitter) {
      delay = delay * (0.5 + Math.random() * 0.5);
    }
    
    return Math.min(delay, this.options.maxDelay || 30000);
  }

  getMaxAttempts(): number {
    return this.options.maxRetries || 3;
  }
}

/**
 * 超时错误恢复策略
 */
export class TimeoutErrorRecoveryStrategy implements RecoveryStrategy {
  private options: RecoveryOptions;

  constructor(options: RecoveryOptions = {}) {
    this.options = {
      maxRetries: 2,
      baseDelay: 500,
      maxDelay: 10000,
      backoffFactor: 1.5,
      jitter: false,
      enableExponentialBackoff: true,
      ...options
    };
  }

  canRecover(error: AppError): boolean {
    return error.type === ErrorType.NETWORK && error.recoverable;
  }

  async recover(error: AppError): Promise<boolean> {
    const context = error.context;
    
    // 超时错误的恢复逻辑
    // 可以增加超时时间或调整重试策略
    if (context.operation) {
      // 根据操作类型调整恢复策略
      switch (context.operation) {
        case 'metadata_fetch':
          // 元数据获取超时，可以尝试减少并发或增加超时时间
          return true;
        case 'peer_connection':
          // peer连接超时，可以尝试备用peer
          return true;
        default:
          return false;
      }
    }
    
    return false;
  }

  getDelay(attempt: number): number {
    let delay = this.options.baseDelay || 500;
    
    if (this.options.enableExponentialBackoff) {
      delay = delay * Math.pow(this.options.backoffFactor || 1.5, attempt - 1);
    }
    
    return Math.min(delay, this.options.maxDelay || 10000);
  }

  getMaxAttempts(): number {
    return this.options.maxRetries || 2;
  }
}

/**
 * 错误恢复管理器
 */
export class ErrorRecoveryManager extends EventEmitter {
  private strategies: Map<ErrorType, RecoveryStrategy[]> = new Map();
  private defaultStrategy: RecoveryStrategy;
  private recoveryHistory: Map<string, RecoveryResult[]> = new Map();

  constructor(defaultStrategy?: RecoveryStrategy) {
    super();
    this.defaultStrategy = defaultStrategy || new NetworkErrorRecoveryStrategy();
    this.initializeDefaultStrategies();
  }

  /**
   * 初始化默认恢复策略
   */
  private initializeDefaultStrategies(): void {
    // 网络错误策略
    this.registerStrategy(ErrorType.NETWORK, new NetworkErrorRecoveryStrategy());
    this.registerStrategy(ErrorType.NETWORK, new TimeoutErrorRecoveryStrategy());
    
    // DHT错误策略
    this.registerStrategy(ErrorType.DHT, new NetworkErrorRecoveryStrategy());
    
    // 协议错误策略
    this.registerStrategy(ErrorType.NETWORK, new NetworkErrorRecoveryStrategy());
  }

  /**
   * 注册恢复策略
   */
  registerStrategy(errorType: ErrorType, strategy: RecoveryStrategy): void {
    if (!this.strategies.has(errorType)) {
      this.strategies.set(errorType, []);
    }
    this.strategies.get(errorType)!.push(strategy);
  }

  /**
   * 尝试恢复错误
   */
  async attemptRecovery(error: AppError): Promise<RecoveryResult> {
    const startTime = Date.now();
    const errorKey = `${error.type}-${error.errorId}`;
    
    // 获取适用于此错误的策略
    const strategies = this.strategies.get(error.type) || [this.defaultStrategy];
    
    for (const strategy of strategies) {
      if (strategy.canRecover(error)) {
        const maxAttempts = strategy.getMaxAttempts();
        let totalDelay = 0;
        
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
          try {
            // 计算延迟
            const delay = attempt > 1 ? strategy.getDelay(attempt - 1) : 0;
            totalDelay += delay;
            
            if (delay > 0) {
              await new Promise(resolve => setTimeout(resolve, delay));
            }
            
            // 尝试恢复
            const recovered = await strategy.recover(error);
            
            if (recovered) {
              const result: RecoveryResult = {
                success: true,
                attempts: attempt,
                totalDelay,
                recoveryTime: Date.now() - startTime
              };
              
              // 记录恢复历史
              this.recordRecoveryHistory(errorKey, result);
              this.emit('recovery_success', { error, result });
              return result;
            }
          } catch (recoveryError) {
            // 恢复过程中的错误，继续尝试下一次
            console.warn(`Recovery attempt ${attempt} failed:`, recoveryError);
          }
        }
      }
    }
    
    // 所有策略都失败
    const result: RecoveryResult = {
      success: false,
      attempts: 0,
      totalDelay: 0,
      finalError: error,
      recoveryTime: Date.now() - startTime
    };
    
    this.recordRecoveryHistory(errorKey, result);
    this.emit('recovery_failed', { error, result });
    return result;
  }

  /**
   * 记录恢复历史
   */
  private recordRecoveryHistory(errorKey: string, result: RecoveryResult): void {
    if (!this.recoveryHistory.has(errorKey)) {
      this.recoveryHistory.set(errorKey, []);
    }
    
    const history = this.recoveryHistory.get(errorKey)!;
    history.push(result);
    
    // 只保留最近10次恢复记录
    if (history.length > 10) {
      history.shift();
    }
  }

  /**
   * 获取恢复统计信息
   */
  getRecoveryStats(): {
    totalAttempts: number;
    successfulRecoveries: number;
    failedRecoveries: number;
    averageRecoveryTime: number;
    successRate: number;
  } {
    let totalAttempts = 0;
    let successfulRecoveries = 0;
    let failedRecoveries = 0;
    let totalRecoveryTime = 0;
    
    for (const history of this.recoveryHistory.values()) {
      for (const result of history) {
        totalAttempts++;
        totalRecoveryTime += result.recoveryTime;
        
        if (result.success) {
          successfulRecoveries++;
        } else {
          failedRecoveries++;
        }
      }
    }
    
    const successRate = totalAttempts > 0 ? successfulRecoveries / totalAttempts : 0;
    const averageRecoveryTime = totalAttempts > 0 ? totalRecoveryTime / totalAttempts : 0;
    
    return {
      totalAttempts,
      successfulRecoveries,
      failedRecoveries,
      averageRecoveryTime,
      successRate
    };
  }

  /**
   * 清理恢复历史
   */
  clearRecoveryHistory(): void {
    this.recoveryHistory.clear();
  }
}

/**
 * 重试工具函数
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 1000,
  context: Record<string, any> = {}
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      console.warn(`Attempt ${attempt} failed:`, error);
      
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, delayMs * attempt));
      }
    }
  }
  
  throw lastError!;
}