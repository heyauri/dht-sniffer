/**
 * 错误处理工具类
 */
import {
  AppError,
  ErrorContext,
  ErrorType,
  ErrorSeverity,
  TimeoutError,
  ErrorHandler,
  isAppError
} from '../types/error';

/**
 * 错误处理工具类
 */
export class ErrorHandlerUtils {
  /**
   * 安全执行函数
   */
  static safeExecute<T>(
    fn: () => T,
    errorHandler: ErrorHandler,
    context: Partial<ErrorContext> = {},
    defaultValue?: T,
    operation?: string
  ): T | undefined {
    try {
      return fn();
    } catch (error) {
      const errorContext: Partial<ErrorContext> = {
        ...context,
        operation: operation || 'safeExecute',
        executionType: 'sync'
      };
      errorHandler.handleError(error, errorContext);
      return defaultValue;
    }
  }

  /**
   * 安全执行异步函数
   */
  static async safeExecuteAsync<T>(
    fn: () => Promise<T>,
    errorHandler: ErrorHandler,
    context: Partial<ErrorContext> = {},
    defaultValue?: T,
    operation?: string
  ): Promise<T | undefined> {
    try {
      return await fn();
    } catch (error) {
      const errorContext: Partial<ErrorContext> = {
        ...context,
        operation: operation || 'safeExecuteAsync',
        executionType: 'async'
      };
      errorHandler.handleError(error, errorContext);
      return defaultValue;
    }
  }

  /**
   * 带重试的安全执行
   */
  static async safeExecuteWithRetry<T>(
    fn: () => Promise<T>,
    errorHandler: ErrorHandler,
    maxRetries: number = 3,
    delayMs: number = 1000,
    context: Partial<ErrorContext> = {},
    operation?: string,
    exponentialBackoff: boolean = true
  ): Promise<T> {
    let lastError: Error;
    
    for (let i = 0; i <= maxRetries; i++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;
        
        if (i < maxRetries) {
          const delay = exponentialBackoff ? delayMs * Math.pow(2, i) : delayMs;
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    const errorContext: Partial<ErrorContext> = {
      ...context,
      operation: operation || 'safeExecuteWithRetry',
      executionType: 'async',
      retryAttempts: maxRetries + 1,
      finalDelay: delayMs
    };
    
    errorHandler.handleError(lastError!, errorContext);
    throw lastError!;
  }
  
  /**
   * 带超时的安全执行
   */
  static async safeExecuteWithTimeout<T>(
    fn: () => Promise<T>,
    timeoutMs: number,
    errorHandler: ErrorHandler,
    context: Partial<ErrorContext> = {},
    operation?: string
  ): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new TimeoutError(
          `Operation timed out after ${timeoutMs}ms`,
          { ...context, operation: operation || 'safeExecuteWithTimeout', timeoutMs }
        ));
      }, timeoutMs);
    });
    
    try {
      return await Promise.race([fn(), timeoutPromise]);
    } catch (error) {
      const errorContext: ErrorContext = {
        ...context,
        operation: operation || 'safeExecuteWithTimeout',
        timeoutMs,
        executionType: 'async',
        timestamp: Date.now(),
        component: context.component || 'ErrorUtils'
      };
      errorHandler.handleError(error, errorContext);
      throw error;
    }
  }
  
  /**
   * 创建错误边界包装器
   */
  static createErrorBoundary<T>(
    fn: (...args: any[]) => T,
    errorHandler: ErrorHandler,
    context: Partial<ErrorContext> = {},
    operation?: string
  ) {
    return (...args: any[]): T => {
      try {
        return fn(...args);
      } catch (error) {
        const errorContext: Partial<ErrorContext> = {
          ...context,
          operation: operation || 'errorBoundary',
          arguments: args,
          executionType: 'sync'
        };
        errorHandler.handleError(error, errorContext);
        throw error;
      }
    };
  }
  
  /**
   * 创建异步错误边界包装器
   */
  static createAsyncErrorBoundary<T>(
    fn: (...args: any[]) => Promise<T>,
    errorHandler: ErrorHandler,
    context: Partial<ErrorContext> = {},
    operation?: string
  ) {
    return async (...args: any[]): Promise<T> => {
      try {
        return await fn(...args);
      } catch (error) {
        const errorContext: Partial<ErrorContext> = {
          ...context,
          operation: operation || 'asyncErrorBoundary',
          arguments: args,
          executionType: 'async'
        };
        errorHandler.handleError(error, errorContext);
        throw error;
      }
    };
  }
  
  /**
   * 批量安全执行
   */
  static async safeExecuteBatch<T>(
    operations: Array<() => Promise<T>>,
    errorHandler: ErrorHandler,
    context: Partial<ErrorContext> = {},
    operation?: string,
    concurrency: number = 3
  ): Promise<{ results: T[]; errors: Error[] }> {
    const results: T[] = [];
    const errors: Error[] = [];
    
    const executeOperation = async (op: () => Promise<T>, index: number): Promise<void> => {
      try {
        const result = await op();
        results[index] = result;
      } catch (error) {
        errors[index] = error as Error;
        const errorContext: Partial<ErrorContext> = {
          ...context,
          operation: operation || 'safeExecuteBatch',
          batchIndex: index,
          executionType: 'async'
        };
        errorHandler.handleError(error, errorContext);
      }
    };
    
    // 使用并发控制执行批量操作
    const batches = [];
    for (let i = 0; i < operations.length; i += concurrency) {
      const batch = operations.slice(i, i + concurrency);
      batches.push(Promise.all(batch.map((op, j) => executeOperation(op, i + j))));
    }
    
    await Promise.all(batches);
    
    return {
      results: results.filter(r => r !== undefined),
      errors: errors.filter(e => e !== undefined)
    };
  }
}

/**
 * 错误格式化工具
 */
export class ErrorFormatter {
  /**
   * 格式化错误为字符串
   */
  static formatError(error: Error | AppError): string {
    if (isAppError(error)) {
      return `[${error.type}] ${error.message} (Severity: ${error.severity}, ID: ${error.errorId})`;
    }
    return `${error.name}: ${error.message}`;
  }

  /**
   * 格式化错误为JSON
   */
  static formatErrorToJson(error: Error | AppError): any {
    if (isAppError(error)) {
      return error.toJSON();
    }
    return {
      name: error.name,
      message: error.message,
      stack: error.stack
    };
  }

  /**
   * 格式化错误为日志条目
   */
  static formatLogEntry(error: Error | AppError, includeStack: boolean = true): any {
    const timestamp = new Date().toISOString();
    
    if (isAppError(error)) {
      const entry = {
        timestamp,
        level: ErrorFormatter.getSeverityString(error.severity),
        errorType: error.type,
        errorMessage: error.message,
        errorId: error.errorId,
        severity: error.severity,
        recoverable: error.recoverable,
        context: error.context
      };
      
      if (includeStack && error.stack) {
        (entry as any).stack = error.stack;
      }
      
      return entry;
    }
    
    const entry = {
      timestamp,
      level: 'ERROR',
      errorMessage: error.message,
      errorName: error.name
    };
    
    if (includeStack && error.stack) {
      (entry as any).stack = error.stack;
    }
    
    return entry;
  }

  /**
   * 获取严重级别字符串
   */
  private static getSeverityString(severity: ErrorSeverity): string {
    switch (severity) {
      case ErrorSeverity.DEBUG: return 'DEBUG';
      case ErrorSeverity.INFO: return 'INFO';
      case ErrorSeverity.WARNING: return 'WARNING';
      case ErrorSeverity.ERROR: return 'ERROR';
      case ErrorSeverity.CRITICAL: return 'CRITICAL';
      case ErrorSeverity.FATAL: return 'FATAL';
      default: return 'UNKNOWN';
    }
  }
}

/**
 * 错误聚合工具
 */
export class ErrorAggregator {
  private errors: Map<string, AppError[]> = new Map();
  private maxErrorsPerType: number;

  constructor(maxErrorsPerType: number = 100) {
    this.maxErrorsPerType = maxErrorsPerType;
  }

  /**
   * 添加错误
   */
  addError(error: AppError): void {
    const errorType = error.type;
    
    if (!this.errors.has(errorType)) {
      this.errors.set(errorType, []);
    }
    
    const errorList = this.errors.get(errorType)!;
    errorList.push(error);
    
    // 保持错误数量在限制范围内
    if (errorList.length > this.maxErrorsPerType) {
      errorList.shift();
    }
  }

  /**
   * 获取错误统计
   */
  getStats(): {
    totalErrors: number;
    errorsByType: Record<string, number>;
    recentErrors: AppError[];
  } {
    const stats = {
      totalErrors: 0,
      errorsByType: {} as Record<string, number>,
      recentErrors: [] as AppError[]
    };

    for (const [type, errors] of this.errors) {
      stats.totalErrors += errors.length;
      stats.errorsByType[type] = errors.length;
      
      // 获取最近的错误（每种类型最多5个）
      const recentOfType = errors.slice(-5);
      stats.recentErrors.push(...recentOfType);
    }

    // 按时间排序最近的错误
    stats.recentErrors.sort((a, b) => b.timestamp - a.timestamp);
    stats.recentErrors = stats.recentErrors.slice(0, 20);

    return stats;
  }

  /**
   * 清除错误
   */
  clearErrors(errorType?: ErrorType): void {
    if (errorType) {
      this.errors.delete(errorType);
    } else {
      this.errors.clear();
    }
  }

  /**
   * 获取特定类型的错误
   */
  getErrorsByType(errorType: ErrorType): AppError[] {
    return this.errors.get(errorType) || [];
  }
}