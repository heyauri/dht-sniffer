import { EventEmitter } from 'events';
import {
  ErrorHandler,
  ErrorType,
  ErrorSeverity,
  ErrorContext,
  AppError,
  isAppError
} from '../types/error';

/**
 * 错误处理器实现类
 */
export class ErrorHandlerImpl extends EventEmitter implements ErrorHandler {
  private errorHistory: AppError[] = [];
  private errorCounts: Map<ErrorType, number> = new Map();
  private lastErrorTime: Map<ErrorType, number> = new Map();
  private handlers: Map<ErrorType, (error: AppError) => void> = new Map();
  
  constructor() {
    super();
    // 初始化错误计数器
    Object.values(ErrorType).forEach(errorType => {
      this.errorCounts.set(errorType, 0);
      this.lastErrorTime.set(errorType, 0);
    });
  }

  /**
   * 处理错误
   */
  handleError(error: Error | AppError, context: Partial<ErrorContext> = {}): void {
    const appError = this.normalizeError(error, context);
    
    // 添加到历史记录
    this.addToHistory(appError);
    
    // 更新错误计数
    this.updateErrorCounts(appError);
    
    // 记录错误时间
    this.lastErrorTime.set(appError.type, Date.now());
    
    // 调用注册的处理器
    const handler = this.handlers.get(appError.type);
    if (handler) {
      handler(appError);
    }
    
    // 触发事件
    this.emit('error', appError);
    this.emitBySeverity(appError);
    
    // 控制台日志
    this.logError(appError);
  }

  /**
   * 注册错误处理器
   */
  registerHandler(type: ErrorType, handler: (error: AppError) => void): void {
    this.handlers.set(type, handler);
  }

  /**
   * 注销错误处理器
   */
  unregisterHandler(type: ErrorType): void {
    this.handlers.delete(type);
  }

  /**
   * 获取错误统计
   */
  getErrorStats(): {
    totalErrors: number;
    errorsByType: Record<ErrorType, number>;
    errorsBySeverity: Record<ErrorSeverity, number>;
  } {
    const errorsByType: Record<ErrorType, number> = {} as Record<ErrorType, number>;
    const errorsBySeverity: Record<ErrorSeverity, number> = {} as Record<ErrorSeverity, number>;
    
    // 初始化统计对象
    Object.values(ErrorType).forEach(type => {
      errorsByType[type] = this.errorCounts.get(type) || 0;
    });
    
    Object.values(ErrorSeverity).forEach(severity => {
      errorsBySeverity[severity] = 0;
    });
    
    // 计算按严重程度统计
    this.errorHistory.forEach(error => {
      errorsBySeverity[error.severity]++;
    });
    
    return {
      totalErrors: this.errorHistory.length,
      errorsByType,
      errorsBySeverity
    };
  }

  /**
   * 标准化错误
   */
  private normalizeError(error: Error | AppError, context: Partial<ErrorContext>): AppError {
    if (isAppError(error)) {
      // 如果是AppError，合并上下文
      return new AppError(
        error.message,
        error.type,
        error.severity,
        { ...error.context, ...context },
        error.recoverable,
        error.recoveryStrategy
      );
    } else {
      // 如果是普通Error，转换为AppError
      return new AppError(
        error.message,
        ErrorType.UNKNOWN,
        ErrorSeverity.MEDIUM,
        { component: 'Unknown', ...context },
        false
      );
    }
  }

  /**
   * 添加到历史记录
   */
  private addToHistory(error: AppError): void {
    this.errorHistory.push(error);
    // 限制历史记录大小
    if (this.errorHistory.length > 1000) {
      this.errorHistory = this.errorHistory.slice(-1000);
    }
  }

  /**
   * 更新错误计数
   */
  private updateErrorCounts(error: AppError): void {
    const currentCount = this.errorCounts.get(error.type) || 0;
    this.errorCounts.set(error.type, currentCount + 1);
  }

  /**
   * 按严重程度触发事件
   */
  private emitBySeverity(error: AppError): void {
    this.emit(error.severity.toLowerCase(), error);
  }

  /**
   * 记录错误到控制台
   */
  private logError(error: AppError): void {
    const timestamp = new Date(error.timestamp).toISOString();
    const logMessage = `[${timestamp}] [${error.type}] [${error.severity}] ${error.message} (ID: ${error.errorId})`;
    
    switch (error.severity) {
      case ErrorSeverity.DEBUG:
        console.debug(logMessage);
        break;
      case ErrorSeverity.INFO:
        console.info(logMessage);
        break;
      case ErrorSeverity.WARNING:
      case ErrorSeverity.LOW:
      case ErrorSeverity.MEDIUM:
        console.warn(logMessage);
        break;
      case ErrorSeverity.HIGH:
      case ErrorSeverity.ERROR:
      case ErrorSeverity.CRITICAL:
      case ErrorSeverity.FATAL:
        console.error(logMessage);
        break;
    }
    
    if (error.stack) {
      console.error(error.stack);
    }
  }
}

// 导出默认实例
export const globalErrorHandler = new ErrorHandlerImpl();