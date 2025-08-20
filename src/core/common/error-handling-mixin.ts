import { ErrorHandlerImpl } from '../../errors/error-handler';
import { ErrorType, ErrorSeverity } from '../../types/error';

/**
 * 错误处理配置接口
 */
export interface ErrorHandlingConfig {
  enableErrorHandling?: boolean;
  enableErrorLogging?: boolean;
  enableErrorRecovery?: boolean;
  maxErrorHistory?: number;
  errorThreshold?: number;
  errorThresholdWindow?: number;
}

/**
 * 错误处理混入接口
 */
export interface ErrorHandlingMixin {
  handleError(operation: string, error: any, context?: any, errorType?: ErrorType): void;
  handleWarning(operation: string, warning: string, context?: any): void;
  handleCriticalError(operation: string, error: any, context?: any): void;
  getErrorStats(): {
    totalErrors: number;
    errorsByType: Record<ErrorType, number>;
    errorsBySeverity: Record<ErrorSeverity, number>;
    recentErrors: Array<{ error: Error; timestamp: number; operation: string }>;
  };
  clearErrorHistory(): void;
  setErrorThreshold(threshold: number, window: number): void;
}

/**
 * 错误处理混入实现
 */
export function withErrorHandling<T extends new (...args: any[]) => any>(Base: T) {
  return class extends Base implements ErrorHandlingMixin {
    protected errorHandler: ErrorHandlerImpl;
    protected errorConfig: ErrorHandlingConfig;
    private errorHistory: Array<{ error: Error; timestamp: number; operation: string; type: ErrorType; severity: ErrorSeverity }> = [];
    private errorCounts: Map<ErrorType, number> = new Map();
    private severityCounts: Map<ErrorSeverity, number> = new Map();
    private errorTimestamps: number[] = [];
    private errorThreshold: number = 10;
    private errorThresholdWindow: number = 60000; // 1分钟
    private managerName: string;

    constructor(...args: any[]) {
      super(...args);
      
      // 从构造函数参数中提取错误处理器和配置
      this.errorHandler = args.find(arg => arg instanceof ErrorHandlerImpl) || new ErrorHandlerImpl();
      this.errorConfig = args.find(arg => arg && typeof arg === 'object' && arg.enableErrorHandling !== undefined) || {};
      this.managerName = this.constructor.name;
      
      this.initializeErrorHandling();
    }

    /**
     * 初始化错误处理
     */
    private initializeErrorHandling(): void {
      // 初始化错误计数器
      Object.values(ErrorType).forEach(type => {
        this.errorCounts.set(type, 0);
      });
      
      Object.values(ErrorSeverity).forEach(severity => {
        this.severityCounts.set(severity, 0);
      });
      
      // 设置错误阈值
      if (this.errorConfig.errorThreshold) {
        this.errorThreshold = this.errorConfig.errorThreshold;
      }
      
      if (this.errorConfig.errorThresholdWindow) {
        this.errorThresholdWindow = this.errorConfig.errorThresholdWindow;
      }
    }

    /**
     * 统一错误处理
     */
    handleError(operation: string, error: any, context?: any, errorType: ErrorType = ErrorType.SYSTEM): void {
      if (!this.errorConfig.enableErrorHandling) {
        return;
      }

      const processedError = this.normalizeError(error, errorType);
      const errorContext = {
        manager: this.managerName,
        operation,
        ...context
      };

      // 记录错误
      this.recordError(processedError, operation, errorType);

      // 检查错误阈值
      this.checkErrorThreshold();

      // 使用错误处理器处理错误
      this.errorHandler.handleError(processedError, errorContext);

      // 记录日志
      if (this.errorConfig.enableErrorLogging) {
        this.logError(processedError, operation, errorContext);
      }

      // 尝试错误恢复
      if (this.errorConfig.enableErrorRecovery) {
        this.attemptErrorRecovery(processedError, operation, errorContext);
      }
    }

    /**
     * 处理警告
     */
    handleWarning(operation: string, warning: string, context?: any): void {
      const warningError = new Error(warning);
      this.handleError(operation, warningError, context, ErrorType.VALIDATION);
    }

    /**
     * 处理严重错误
     */
    handleCriticalError(operation: string, error: any, context?: any): void {
      this.handleError(operation, error, context, ErrorType.SYSTEM);
      
      // 对于严重错误，可以添加额外的处理逻辑
      console.error(`[${this.managerName}] CRITICAL ERROR in ${operation}:`, error);
      
      // 可以触发紧急事件或通知
      if (typeof (this as any).emit === 'function') {
        (this as any).emit('criticalError', {
          manager: this.managerName,
          operation,
          error,
          context,
          timestamp: Date.now()
        });
      }
    }

    /**
     * 获取错误统计信息
     */
    getErrorStats() {
      const now = Date.now();
      const windowStart = now - this.errorThresholdWindow;
      
      // 转换为正确的Record类型
      const errorsByType: Record<ErrorType, number> = {} as Record<ErrorType, number>;
      this.errorCounts.forEach((value, key) => {
        errorsByType[key] = value;
      });
      
      const errorsBySeverity: Record<ErrorSeverity, number> = {} as Record<ErrorSeverity, number>;
      this.severityCounts.forEach((value, key) => {
        errorsBySeverity[key] = value;
      });
      
      return {
        totalErrors: this.errorHistory.length,
        errorsByType,
        errorsBySeverity,
        recentErrors: this.errorHistory
          .filter(e => e.timestamp > windowStart)
          .map(e => ({
            error: e.error,
            timestamp: e.timestamp,
            operation: e.operation
          }))
      };
    }

    /**
     * 清理错误历史
     */
    clearErrorHistory(): void {
      this.errorHistory = [];
      this.errorTimestamps = [];
      
      // 重置计数器
      Object.values(ErrorType).forEach(type => {
        this.errorCounts.set(type, 0);
      });
      
      Object.values(ErrorSeverity).forEach(severity => {
        this.severityCounts.set(severity, 0);
      });
    }

    /**
     * 设置错误阈值
     */
    setErrorThreshold(threshold: number, window: number): void {
      this.errorThreshold = threshold;
      this.errorThresholdWindow = window;
    }

    /**
     * 标准化错误
     */
    private normalizeError(error: any, errorType: ErrorType): Error {
      if (error instanceof Error) {
        return error;
      }
      
      if (typeof error === 'string') {
        return new Error(error);
      }
      
      if (error && typeof error === 'object') {
        return new Error(JSON.stringify(error));
      }
      
      return new Error(String(error));
    }

    /**
     * 记录错误
     */
    private recordError(error: Error, operation: string, errorType: ErrorType): void {
      const timestamp = Date.now();
      const severity = this.determineSeverity(errorType);
      
      // 添加到历史记录
      this.errorHistory.push({
        error,
        timestamp,
        operation,
        type: errorType,
        severity
      });
      
      // 限制历史记录长度
      const maxHistory = this.errorConfig.maxErrorHistory || 1000;
      if (this.errorHistory.length > maxHistory) {
        this.errorHistory.splice(0, this.errorHistory.length - maxHistory);
      }
      
      // 更新计数器
      this.errorCounts.set(errorType, (this.errorCounts.get(errorType) || 0) + 1);
      this.severityCounts.set(severity, (this.severityCounts.get(severity) || 0) + 1);
      
      // 记录时间戳用于阈值检查
      this.errorTimestamps.push(timestamp);
      
      // 清理旧的时间戳
      const windowStart = timestamp - this.errorThresholdWindow;
      this.errorTimestamps = this.errorTimestamps.filter(t => t > windowStart);
    }

    /**
     * 确定错误严重程度
     */
    private determineSeverity(errorType: ErrorType): ErrorSeverity {
      switch (errorType) {
        case ErrorType.NETWORK:
        case ErrorType.SYSTEM:
          return ErrorSeverity.MEDIUM;
        case ErrorType.VALIDATION:
        default:
          return ErrorSeverity.LOW;
      }
    }

    /**
     * 检查错误阈值
     */
    private checkErrorThreshold(): void {
      if (this.errorTimestamps.length >= this.errorThreshold) {
        const errorRate = this.errorTimestamps.length / (this.errorThresholdWindow / 1000);
        
        console.warn(`[${this.managerName}] Error threshold exceeded: ${this.errorTimestamps.length} errors in ${this.errorThresholdWindow}ms (rate: ${errorRate.toFixed(2)} errors/sec)`);
        
        // 触发阈值 exceeded 事件
        if (typeof (this as any).emit === 'function') {
          (this as any).emit('errorThresholdExceeded', {
            manager: this.managerName,
            threshold: this.errorThreshold,
            window: this.errorThresholdWindow,
            actualCount: this.errorTimestamps.length,
            errorRate,
            timestamp: Date.now()
          });
        }
      }
    }

    /**
     * 记录错误日志
     */
    private logError(error: Error, operation: string, context: any): void {
      const logMessage = `[${this.managerName}] Error in ${operation}: ${error.message}`;
      
      if (context) {
        console.error(logMessage, '\nContext:', context, '\nStack:', error.stack);
      } else {
        console.error(logMessage, '\nStack:', error.stack);
      }
    }

    /**
     * 尝试错误恢复
     */
    private attemptErrorRecovery(error: Error, operation: string, context: any): void {
      // 这里可以实现通用的错误恢复逻辑
      // 例如：重试、回滚、降级等
      
      // 对于某些类型的错误，可以尝试自动恢复
      if (error.message.includes('timeout') || error.message.includes('ECONNREFUSED')) {
        console.log(`[${this.managerName}] Attempting automatic recovery for ${operation}...`);
        
        // 可以在这里添加重试逻辑或其他恢复策略
        // 注意：具体的恢复策略应该由子类实现
      }
    }
  };
}

/**
 * 错误处理装饰器工厂
 */
export class ErrorHandlingDecorator {
  /**
   * 创建错误处理装饰器
   */
  static create(
    errorHandler: ErrorHandlerImpl,
    operation: string,
    errorType: ErrorType = ErrorType.SYSTEM,
    context?: any
  ) {
    return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
      const originalMethod = descriptor.value;
      
      descriptor.value = function (...args: any[]) {
        try {
          return originalMethod.apply(this, args);
        } catch (error) {
          if (errorHandler && typeof errorHandler.handleError === 'function') {
            errorHandler.handleError(error as Error, {
              operation,
              method: propertyKey,
              args,
              ...context
            });
          }
          throw error;
        }
      };
      
      return descriptor;
    };
  }
}