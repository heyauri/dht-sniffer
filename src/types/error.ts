/**
 * 错误处理相关类型定义
 */

/**
 * 错误类型枚举
 */
export enum ErrorType {
  NETWORK = 'NETWORK',
  DHT = 'DHT',
  METADATA = 'METADATA',
  CACHE = 'CACHE',
  PEER = 'PEER',
  CONFIG = 'CONFIG',
  VALIDATION = 'VALIDATION',
  SYSTEM = 'SYSTEM',
  UNKNOWN = 'UNKNOWN'
}

/**
 * 错误严重程度枚举
 */
export enum ErrorSeverity {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARNING = 'WARNING',
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  ERROR = 'ERROR',
  CRITICAL = 'CRITICAL',
  FATAL = 'FATAL'
}

/**
 * 错误上下文接口
 */
export interface ErrorContext {
  timestamp: number;
  component: string;
  operation?: string;
  metadata?: Record<string, unknown>;
  stack?: string;
  cause?: Error;
  // 扩展属性以支持各种上下文信息
  arguments?: unknown[];
  batchIndex?: number;
  executionType?: string;
  retryAttempts?: number;
  finalDelay?: number;
  timeoutMs?: number;
  [key: string]: unknown; // 允许任意额外的属性
}

/**
 * 恢复策略接口
 */
export interface RecoveryStrategy {
  canRecover(error: AppError): boolean;
  recover(error: AppError): Promise<boolean>;
  getDelay(attempt: number): number;
  getMaxAttempts(): number;
}

/**
 * 错误记录接口
 */
export interface ErrorRecord {
  id: string;
  type: ErrorType;
  message: string;
  severity: ErrorSeverity;
  timestamp: number;
  context: ErrorContext;
  recoverable: boolean;
  retryCount: number;
}

/**
 * 恢复选项接口
 */
export interface RecoveryOptions {
  maxRetries?: number;
  baseDelay?: number;
  maxDelay?: number;
  backoffFactor?: number;
  jitter?: boolean;
  enableExponentialBackoff?: boolean;
}

/**
 * 恢复结果接口
 */
export interface RecoveryResult {
  success: boolean;
  attempts: number;
  totalDelay: number;
  recoveryTime: number;
  finalError?: AppError;
}

/**
 * 应用错误类
 */
export class AppError extends Error {
  public readonly type: ErrorType;
  public readonly severity: ErrorSeverity;
  public readonly context: ErrorContext;
  public readonly recoverable: boolean;
  public readonly recoveryStrategy?: RecoveryStrategy;
  public readonly timestamp: number;
  public readonly errorId: string;

  constructor(
    message: string,
    type: ErrorType = ErrorType.UNKNOWN,
    severity: ErrorSeverity = ErrorSeverity.MEDIUM,
    context: Partial<ErrorContext> = {},
    recoverable: boolean = false,
    recoveryStrategy?: RecoveryStrategy
  ) {
    super(message);
    this.name = 'AppError';
    this.type = type;
    this.severity = severity;
    this.timestamp = Date.now();
    this.errorId = `${type}_${this.timestamp}_${Math.random().toString(36).substr(2, 9)}`;
    this.context = {
      timestamp: this.timestamp,
      component: 'Unknown',
      ...context
    };
    this.recoverable = recoverable;
    this.recoveryStrategy = recoveryStrategy;
    Error.captureStackTrace(this, AppError);
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      type: this.type,
      severity: this.severity,
      context: this.context,
      recoverable: this.recoverable,
      recoveryStrategy: this.recoveryStrategy,
      timestamp: this.timestamp,
      stack: this.stack
    };
  }
}

/**
 * 网络错误类
 */
export class NetworkError extends AppError {
  constructor(
    message: string,
    context: Partial<ErrorContext> = {},
    recoverable: boolean = true
  ) {
    super(
      message,
      ErrorType.NETWORK,
      ErrorSeverity.HIGH,
      { component: 'Network', ...context },
      recoverable
    );
    this.name = 'NetworkError';
  }
}

/**
 * DHT错误类
 */
export class DHTError extends AppError {
  constructor(
    message: string,
    context: Partial<ErrorContext> = {},
    recoverable: boolean = true
  ) {
    super(
      message,
      ErrorType.DHT,
      ErrorSeverity.HIGH,
      { component: 'DHT', ...context },
      recoverable
    );
    this.name = 'DHTError';
  }
}

/**
 * 元数据错误类
 */
export class MetadataError extends AppError {
  constructor(
    message: string,
    context: Partial<ErrorContext> = {},
    recoverable: boolean = true
  ) {
    super(
      message,
      ErrorType.METADATA,
      ErrorSeverity.MEDIUM,
      { component: 'Metadata', ...context },
      recoverable
    );
    this.name = 'MetadataError';
  }
}

/**
 * 缓存错误类
 */
export class CacheError extends AppError {
  constructor(
    message: string,
    context: Partial<ErrorContext> = {},
    recoverable: boolean = true
  ) {
    super(
      message,
      ErrorType.CACHE,
      ErrorSeverity.LOW,
      { component: 'Cache', ...context },
      recoverable
    );
    this.name = 'CacheError';
  }
}

/**
 * 配置错误类
 */
export class ConfigError extends AppError {
  constructor(
    message: string,
    context: Partial<ErrorContext> = {},
    recoverable: boolean = false
  ) {
    super(
      message,
      ErrorType.CONFIG,
      ErrorSeverity.CRITICAL,
      { component: 'Config', ...context },
      recoverable
    );
    this.name = 'ConfigError';
  }
}

/**
 * 验证错误类
 */
export class ValidationError extends AppError {
  constructor(
    message: string,
    context: Partial<ErrorContext> = {},
    recoverable: boolean = false
  ) {
    super(
      message,
      ErrorType.VALIDATION,
      ErrorSeverity.MEDIUM,
      { component: 'Validation', ...context },
      recoverable
    );
    this.name = 'ValidationError';
  }
}

/**
 * 系统错误类
 */
export class SystemError extends AppError {
  constructor(
    message: string,
    context: Partial<ErrorContext> = {},
    recoverable: boolean = false
  ) {
    super(
      message,
      ErrorType.SYSTEM,
      ErrorSeverity.CRITICAL,
      { component: 'System', ...context },
      recoverable
    );
    this.name = 'SystemError';
  }
}

/**
 * 超时错误类
 */
export class TimeoutError extends AppError {
  constructor(
    message: string,
    context: Partial<ErrorContext> = {},
    recoverable: boolean = true
  ) {
    super(
      message,
      ErrorType.SYSTEM,
      ErrorSeverity.HIGH,
      { component: 'Timeout', ...context },
      recoverable
    );
    this.name = 'TimeoutError';
  }
}

/**
 * 类型守卫函数
 */
export function isAppError(error: Error | AppError): error is AppError {
  return (error as AppError).type !== undefined && 
         (error as AppError).severity !== undefined &&
         (error as AppError).context !== undefined;
}

/**
 * 错误处理器接口
 */
export interface ErrorHandler {
  handleError(error: Error | AppError, context?: Partial<ErrorContext>): void;
  registerHandler(type: ErrorType, handler: (error: AppError) => void): void;
  unregisterHandler(type: ErrorType): void;
  getErrorStats(): {
    totalErrors: number;
    errorsByType: Record<ErrorType, number>;
    errorsBySeverity: Record<ErrorSeverity, number>;
  };
}

/**
 * 错误统计接口
 */
export interface ErrorStats {
  totalErrors: number;
  errorsByType: Record<ErrorType, number>;
  errorsBySeverity: Record<ErrorSeverity, number>;
  recentErrors: AppError[];
  lastErrorTime?: number;
}

/**
 * 错误报告接口
 */
export interface ErrorReport {
  timestamp: number;
  error: AppError;
  context: {
    system: {
      uptime: number;
      memoryUsage: NodeJS.MemoryUsage;
      cpuUsage: NodeJS.CpuUsage;
    };
    application: {
      version: string;
      environment: string;
    };
  };
}