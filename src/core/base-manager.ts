import { EventEmitter } from 'events';
import { ErrorHandlerImpl } from '../errors/error-handler';
import { ErrorType } from '../types/error';
import { RetryManager, RetryConfig } from './common/retry-manager';
import { PerformanceMonitor, PerformanceMonitorConfig } from './common/performance-monitor';
import { MemoryManager, MemoryManagerConfig } from './common/memory-manager';
import { ConfigValidator, ValidationRule } from './common/config-validator';
import { withConfigValidation, ConfigValidationMixin } from './common/config-mixin';
import { withEventListeners, EventListenerMixin, EventListenerFactory } from './common/event-listener-mixin';
import { withErrorHandling, ErrorHandlingMixin } from './common/error-handling-mixin';

/**
 * 管理器基础配置接口
 */
export interface BaseManagerConfig {
  enableErrorHandling?: boolean;
  enableMemoryMonitoring?: boolean;
  cleanupInterval?: number;
  memoryThreshold?: number;
  // 通用功能模块配置
  retryConfig?: RetryConfig;
  performanceConfig?: PerformanceMonitorConfig;
  memoryConfig?: MemoryManagerConfig;
  enableRetry?: boolean;
  enablePerformanceMonitoring?: boolean;
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
export abstract class BaseManager extends withConfigValidation(
  withEventListeners(
    withErrorHandling(EventEmitter)
  )
) implements ConfigValidationMixin, EventListenerMixin, ErrorHandlingMixin {
  protected errorHandler: ErrorHandlerImpl;
  protected config: BaseManagerConfig;
  protected cleanupInterval: NodeJS.Timeout | null;
  protected startTime: number;
  protected cleanupCount: number;
  protected isDestroyed: boolean;
  // 通用功能模块
  protected retryManager?: RetryManager;
  protected performanceMonitor?: PerformanceMonitor;
  protected memoryManager?: MemoryManager;
  protected configValidator?: ConfigValidator;

  constructor(config: BaseManagerConfig, errorHandler?: ErrorHandlerImpl) {
    super();
    
    // 使用混入的配置验证和合并功能
    this.config = this.mergeWithDefaults(config);
    this.validateConfig(this.config);
    
    // 初始化错误处理器
    this.errorHandler = errorHandler || new ErrorHandlerImpl();
    
    this.cleanupInterval = null;
    this.startTime = Date.now();
    this.cleanupCount = 0;
    this.isDestroyed = false;
    
    // 初始化通用功能模块
    this.initializeCommonModules();
    
    // 设置通用事件监听器
    this.setupCommonEventListeners();
    
    // 启动定期清理任务
    this.startPeriodicCleanup();
  }

  /**
   * 获取管理器名称（子类必须实现）
   */
  protected abstract getManagerName(): string;

  /**
   * 初始化通用功能模块
   */
  private initializeCommonModules(): void {
    try {
      // 初始化重试管理器
      if (this.config.enableRetry) {
        this.retryManager = new RetryManager(this.config.retryConfig || {});
        this.retryManager.on('retry', (event) => {
          // 从context中提取infoHash信息
          const infoHash = event.context?.infoHash || null;
          const peer = event.context?.peer || null;
          
          // 构建增强的重试事件
          const enhancedEvent = {
            manager: this.getManagerName(),
            ...event,
            // 添加infoHash信息（如果存在）
            ...(infoHash && { infoHash }),
            // 添加peer信息（如果存在）
            ...(peer && { peer })
          };
          
          this.emit('retry', enhancedEvent);
        });
      }
      
      // 初始化性能监控器
      if (this.config.enablePerformanceMonitoring) {
        this.performanceMonitor = new PerformanceMonitor(this.config.performanceConfig || {});
        this.performanceMonitor.on('performanceWarning', (event) => {
          this.emit('performanceWarning', {
            manager: this.getManagerName(),
            ...event
          });
        });
      }
      
      // 初始化内存管理器
      if (this.config.enableMemoryMonitoring) {
        this.memoryManager = new MemoryManager(this.config.memoryConfig || {});
        this.memoryManager.on('memoryCleanup', (event) => {
          this.emit('memoryCleanup', {
            manager: this.getManagerName(),
            ...event
          });
        });
      }
      
      // 初始化配置验证器
      this.configValidator = new ConfigValidator();
    } catch (error) {
      this.handleError('initializeCommonModules', error);
    }
  }

  /**
   * 设置通用事件监听器
   */
  private setupCommonEventListeners(): void {
    const managerName = this.getManagerName();
    
    // 使用事件监听器工厂创建通用监听器
    this.setupBatchEventListeners([
      EventListenerFactory.createErrorListener(this.errorHandler, managerName),
      EventListenerFactory.createWarningListener(this.errorHandler, managerName),
      EventListenerFactory.createPerformanceWarningListener(this.errorHandler, managerName),
      EventListenerFactory.createMemoryCleanupListener(this.errorHandler, managerName),
      EventListenerFactory.createRetryListener(this.errorHandler, managerName)
    ]);
  }

  /**
   * 验证配置（子类可以重写）
   */
  public validateConfig(config: BaseManagerConfig): void {
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
   * 统一错误处理 - 使用混入的错误处理功能
   */
  public handleError(operation: string, error: any, context?: any, errorType: ErrorType = ErrorType.SYSTEM): void {
    // 使用混入的错误处理方法
    super.handleError(operation, error, {
      manager: this.getManagerName(),
      ...context
    }, errorType);
  }

  /**
   * 处理警告
   */
  public handleWarning(operation: string, message: string, context?: any): void {
    super.handleWarning(operation, message, {
      manager: this.getManagerName(),
      ...context
    });
  }

  /**
   * 处理严重错误
   */
  public handleCriticalError(operation: string, error: any, context?: any): void {
    super.handleCriticalError(operation, error, {
      manager: this.getManagerName(),
      ...context
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
   * 使用重试机制执行操作
   */
  protected async executeWithRetry<T>(
    operation: () => Promise<T>,
    operationName: string,
    context?: any
  ): Promise<T> {
    if (!this.retryManager || !this.config.enableRetry) {
      return operation();
    }
    
    return this.retryManager.executeWithRetry(
      operation,
      operationName,
      context
    );
  }
  
  /**
   * 添加性能指标
   */
  protected addPerformanceMetric(name: string, value: number): void {
    if (this.performanceMonitor && this.config.enablePerformanceMonitoring) {
      this.performanceMonitor.setCustomMetric(name, value);
    }
  }
  
  /**
   * 执行内存清理
   */
  protected performMemoryCleanup(): void {
    if (this.memoryManager && this.config.enableMemoryMonitoring) {
      this.memoryManager.performMemoryCleanup();
    }
  }
  
  /**
   * 验证配置
   */
  protected validateConfiguration(config: any, rules: ValidationRule[]): void {
    if (this.configValidator) {
      this.configValidator.addRules(this.getManagerName(), rules);
      this.configValidator.validate(this.getManagerName(), config);
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
      
      // 销毁通用功能模块
      this.destroyCommonModules();
      
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
  
  /**
   * 销毁通用功能模块
   */
  private destroyCommonModules(): void {
    try {
      // 停止性能监控
      if (this.performanceMonitor) {
        this.performanceMonitor.destroy();
      }
      
      // 清理重试管理器
      if (this.retryManager) {
        this.retryManager.removeAllListeners();
      }
      
      // 清理内存管理器
      if (this.memoryManager) {
        this.memoryManager.removeAllListeners();
      }
      
      // 清理配置验证器
      if (this.configValidator) {
        // ConfigValidator不需要特殊的清理逻辑
      }
    } catch (error) {
      this.handleError('destroyCommonModules', error);
    }
  }
}