import { EventEmitter } from 'events';
import { ErrorHandlerImpl } from '../errors/error-handler';
import { ErrorType } from '../types/error';

/**
 * 管理器基础配置接口
 */
export interface BaseManagerConfig {
  enableErrorHandling?: boolean;
  enableMemoryMonitoring?: boolean;
  cleanupInterval?: number;
  memoryThreshold?: number;
}

/**
 * 管理器统计信息接口
 */
export interface ManagerStats {
  uptime: number;
  memoryUsage?: {
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
  };
  lastCleanupTime?: number;
  cleanupCount?: number;
}

/**
 * 基础管理器类 - 提供所有管理器的公共功能
 */
export abstract class BaseManager extends EventEmitter {
  protected errorHandler: ErrorHandlerImpl;
  protected config: BaseManagerConfig;
  protected cleanupInterval: NodeJS.Timeout | null;
  protected startTime: number;
  protected cleanupCount: number;
  protected isDestroyed: boolean;

  constructor(config: BaseManagerConfig, errorHandler?: ErrorHandlerImpl) {
    super();
    
    // 设置默认配置
    this.config = {
      enableErrorHandling: true,
      enableMemoryMonitoring: true,
      cleanupInterval: 5 * 60 * 1000, // 5分钟
      memoryThreshold: 100 * 1024 * 1024, // 100MB
      ...config
    };
    
    // 初始化错误处理器
    this.errorHandler = errorHandler || new ErrorHandlerImpl();
    
    this.cleanupInterval = null;
    this.startTime = Date.now();
    this.cleanupCount = 0;
    this.isDestroyed = false;
    
    // 启动定期清理任务
    this.startPeriodicCleanup();
  }

  /**
   * 获取管理器名称（子类必须实现）
   */
  protected abstract getManagerName(): string;

  /**
   * 验证配置（子类可以重写）
   */
  protected validateConfig(config: BaseManagerConfig): void {
    if (!config) {
      throw new Error(`${this.getManagerName()} config is required`);
    }
    
    if (config.cleanupInterval !== undefined && (typeof config.cleanupInterval !== 'number' || config.cleanupInterval <= 0)) {
      throw new Error('cleanupInterval must be a positive number');
    }
    
    if (config.memoryThreshold !== undefined && (typeof config.memoryThreshold !== 'number' || config.memoryThreshold <= 0)) {
      throw new Error('memoryThreshold must be a positive number');
    }
  }

  /**
   * 执行清理操作（子类必须实现）
   */
  protected abstract performCleanup(): void;

  /**
   * 获取统计信息（子类可以扩展）
   */
  getStats(): ManagerStats {
    return {
      uptime: Date.now() - this.startTime,
      memoryUsage: this.getMemoryUsage(),
      lastCleanupTime: this.startTime + (this.cleanupCount * (this.config.cleanupInterval || 0)),
      cleanupCount: this.cleanupCount
    };
  }

  /**
   * 获取内存使用情况
   */
  protected getMemoryUsage() {
    if (!this.config.enableMemoryMonitoring) {
      return undefined;
    }
    
    return process.memoryUsage();
  }

  /**
   * 统一错误处理
   */
  protected handleError(operation: string, error: any, context?: any, errorType: ErrorType = ErrorType.SYSTEM): void {
    if (!this.config.enableErrorHandling) {
      return;
    }
    
    const processedError = error instanceof Error ? error : new Error(String(error));
    
    this.errorHandler.handleError(processedError, {
      manager: this.getManagerName(),
      operation,
      ...context,
      errorType
    });
    
    this.emit('error', {
      manager: this.getManagerName(),
      operation,
      error: processedError,
      context
    });
  }

  /**
   * 启动定期清理任务
   */
  private startPeriodicCleanup(): void {
    if (!this.config.cleanupInterval) {
      return;
    }
    
    try {
      this.cleanupInterval = setInterval(() => {
        this.executeCleanup();
      }, this.config.cleanupInterval);
    } catch (error) {
      this.handleError('startPeriodicCleanup', error);
    }
  }

  /**
   * 执行清理操作
   */
  private executeCleanup(): void {
    try {
      this.performCleanup();
      this.cleanupCount++;
      
      // 检查内存使用情况
      if (this.config.enableMemoryMonitoring) {
        this.checkMemoryUsage();
      }
      
      this.emit('cleanupCompleted', {
        manager: this.getManagerName(),
        cleanupCount: this.cleanupCount,
        timestamp: Date.now()
      });
    } catch (error) {
      this.handleError('executeCleanup', error);
    }
  }

  /**
   * 检查内存使用情况
   */
  private checkMemoryUsage(): void {
    try {
      const memoryUsage = this.getMemoryUsage();
      if (!memoryUsage) return;
      
      const threshold = this.config.memoryThreshold || 100 * 1024 * 1024;
      
      if (memoryUsage.heapUsed > threshold) {
        this.emit('memoryWarning', {
          manager: this.getManagerName(),
          memoryUsage,
          threshold
        });
        
        // 执行深度清理
        this.performDeepCleanup();
      }
    } catch (error) {
      this.handleError('checkMemoryUsage', error);
    }
  }

  /**
   * 执行深度清理（子类可以重写）
   */
  protected performDeepCleanup(): void {
    try {
      // 强制垃圾回收（如果可用）
      if (global.gc) {
        global.gc();
      }
      
      this.emit('deepCleanupCompleted', {
        manager: this.getManagerName(),
        timestamp: Date.now()
      });
    } catch (error) {
      this.handleError('performDeepCleanup', error);
    }
  }

  /**
   * 停止定期清理任务
   */
  protected stopPeriodicCleanup(): void {
    try {
      if (this.cleanupInterval) {
        clearInterval(this.cleanupInterval);
        this.cleanupInterval = null;
      }
    } catch (error) {
      this.handleError('stopPeriodicCleanup', error);
    }
  }

  /**
   * 清理数据（子类必须实现）
   */
  protected abstract clearData(): void;

  /**
   * 清理所有数据
   */
  clear(): void {
    try {
      this.clearData();
      this.emit('dataCleared', {
        manager: this.getManagerName(),
        timestamp: Date.now()
      });
    } catch (error) {
      this.handleError('clear', error);
    }
  }

  /**
   * 销毁管理器
   */
  destroy(): void {
    if (this.isDestroyed) {
      return;
    }
    
    try {
      this.isDestroyed = true;
      
      // 停止定期清理任务
      this.stopPeriodicCleanup();
      
      // 清理所有数据
      this.clear();
      
      // 移除所有事件监听器
      this.removeAllListeners();
      
      this.emit('destroyed', {
        manager: this.getManagerName(),
        timestamp: Date.now()
      });
    } catch (error) {
      this.handleError('destroy', error);
    }
  }
}