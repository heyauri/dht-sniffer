import { EventEmitter } from 'events';
import { createHash } from 'crypto';

/**
 * 错误类型枚举
 */
export enum ErrorType {
  // 网络相关错误
  SOCKET_ERROR = 'SOCKET_ERROR',
  CONNECTION_TIMEOUT = 'CONNECTION_TIMEOUT',
  CONNECTION_REFUSED = 'CONNECTION_REFUSED',
  NETWORK_UNREACHABLE = 'NETWORK_UNREACHABLE',
  DNS_RESOLUTION_FAILED = 'DNS_RESOLUTION_FAILED',
  
  // 协议相关错误
  PROTOCOL_ERROR = 'PROTOCOL_ERROR',
  HANDSHAKE_FAILED = 'HANDSHAKE_FAILED',
  METADATA_WARNING = 'METADATA_WARNING',
  EXTENSION_ERROR = 'EXTENSION_ERROR',
  PROTOCOL_VIOLATION = 'PROTOCOL_VIOLATION',
  
  // 数据相关错误
  INVALID_METADATA = 'INVALID_METADATA',
  INVALID_INFO_HASH = 'INVALID_INFO_HASH',
  DECODE_ERROR = 'DECODE_ERROR',
  ENCODE_ERROR = 'ENCODE_ERROR',
  DATA_CORRUPTED = 'DATA_CORRUPTED',
  INVALID_FORMAT = 'INVALID_FORMAT',
  
  // DHT相关错误
  DHT_ERROR = 'DHT_ERROR',
  NODE_UNREACHABLE = 'NODE_UNREACHABLE',
  BOOTSTRAP_FAILED = 'BOOTSTRAP_FAILED',
  KBUCKET_ERROR = 'KBUCKET_ERROR',
  RPC_ERROR = 'RPC_ERROR',
  
  // 系统错误
  SYSTEM_ERROR = 'SYSTEM_ERROR',
  MEMORY_ERROR = 'MEMORY_ERROR',
  FILE_SYSTEM_ERROR = 'FILE_SYSTEM_ERROR',
  CONFIGURATION_ERROR = 'CONFIGURATION_ERROR',
  
  // 业务逻辑错误
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  RESOURCE_EXHAUSTED = 'RESOURCE_EXHAUSTED',
  
  // 未知错误
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

/**
 * 错误严重级别
 */
export enum ErrorSeverity {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARNING = 'WARNING',
  ERROR = 'ERROR',
  CRITICAL = 'CRITICAL',
  FATAL = 'FATAL'
}

/**
 * 错误上下文接口
 */
export interface ErrorContext {
  [key: string]: unknown;
  operation?: string;
  component?: string;
  peer?: {
    host: string;
    port: number;
    family?: string;
  };
  infoHash?: string | Buffer;
  retryCount?: number;
  duration?: number;
  stackTrace?: string;
}

/**
 * 应用错误基类
 */
export class AppError extends Error {
  public readonly type: ErrorType;
  public readonly severity: ErrorSeverity;
  public readonly timestamp: number;
  public readonly context: ErrorContext;
  public readonly errorId: string;
  public readonly originalError?: Error;
  public readonly recoverable: boolean;

  constructor(
    type: ErrorType,
    message: string,
    severity: ErrorSeverity = ErrorSeverity.ERROR,
    context: ErrorContext = {},
    originalError?: Error,
    recoverable: boolean = true
  ) {
    super(message);
    this.name = 'AppError';
    this.type = type;
    this.severity = severity;
    this.timestamp = Date.now();
    this.context = context;
    this.originalError = originalError;
    this.recoverable = recoverable;
    
    // 生成唯一错误ID
    this.errorId = createHash('md5')
      .update(`${type}-${message}-${this.timestamp}-${JSON.stringify(context)}`)
      .digest('hex')
      .substring(0, 8);
    
    // 保持正确的堆栈跟踪
    if (originalError && originalError.stack) {
      this.stack = originalError.stack;
    }
    
    // 添加上下文信息到堆栈跟踪
    if (Object.keys(context).length > 0) {
      this.stack += `\nError Context: ${JSON.stringify(context, null, 2)}`;
    }
  }

  /**
   * 转换为JSON对象
   */
  toJSON() {
    return {
      errorId: this.errorId,
      type: this.type,
      severity: this.severity,
      message: this.message,
      timestamp: this.timestamp,
      context: this.context,
      stack: this.stack,
      originalError: this.originalError?.message
    };
  }

  /**
   * 转换为字符串
   */
  toString(): string {
    return `[${this.severity}] ${this.type}: ${this.message} (ID: ${this.errorId})`;
  }
}

/**
 * 网络错误
 */
export class NetworkError extends AppError {
  constructor(
    message: string,
    context: ErrorContext = {},
    originalError?: Error,
    recoverable: boolean = true
  ) {
    super(ErrorType.SOCKET_ERROR, message, ErrorSeverity.ERROR, context, originalError, recoverable);
    this.name = 'NetworkError';
  }
}

/**
 * 连接超时错误
 */
export class TimeoutError extends AppError {
  constructor(
    message: string = 'Connection timeout',
    context: ErrorContext = {},
    originalError?: Error,
    recoverable: boolean = true
  ) {
    super(ErrorType.CONNECTION_TIMEOUT, message, ErrorSeverity.WARNING, context, originalError, recoverable);
    this.name = 'TimeoutError';
  }
}

/**
 * 连接被拒绝错误
 */
export class ConnectionRefusedError extends AppError {
  constructor(
    message: string = 'Connection refused',
    context: ErrorContext = {},
    originalError?: Error,
    recoverable: boolean = false
  ) {
    super(ErrorType.CONNECTION_REFUSED, message, ErrorSeverity.ERROR, context, originalError, recoverable);
    this.name = 'ConnectionRefusedError';
  }
}

/**
 * DNS解析失败错误
 */
export class DNSResolutionError extends AppError {
  constructor(
    message: string = 'DNS resolution failed',
    context: ErrorContext = {},
    originalError?: Error,
    recoverable: boolean = false
  ) {
    super(ErrorType.DNS_RESOLUTION_FAILED, message, ErrorSeverity.ERROR, context, originalError, recoverable);
    this.name = 'DNSResolutionError';
  }
}

/**
 * 协议错误
 */
export class ProtocolError extends AppError {
  constructor(
    message: string,
    context: ErrorContext = {},
    originalError?: Error,
    recoverable: boolean = true
  ) {
    super(ErrorType.PROTOCOL_ERROR, message, ErrorSeverity.ERROR, context, originalError, recoverable);
    this.name = 'ProtocolError';
  }
}

/**
 * 握手失败错误
 */
export class HandshakeError extends AppError {
  constructor(
    message: string = 'Handshake failed',
    context: ErrorContext = {},
    originalError?: Error,
    recoverable: boolean = true
  ) {
    super(ErrorType.HANDSHAKE_FAILED, message, ErrorSeverity.ERROR, context, originalError, recoverable);
    this.name = 'HandshakeError';
  }
}

/**
 * 元数据错误
 */
export class MetadataError extends AppError {
  constructor(
    message: string,
    context: ErrorContext = {},
    originalError?: Error,
    recoverable: boolean = true
  ) {
    super(ErrorType.INVALID_METADATA, message, ErrorSeverity.ERROR, context, originalError, recoverable);
    this.name = 'MetadataError';
  }
}

/**
 * 数据损坏错误
 */
export class DataCorruptedError extends AppError {
  constructor(
    message: string = 'Data corrupted',
    context: ErrorContext = {},
    originalError?: Error,
    recoverable: boolean = false
  ) {
    super(ErrorType.DATA_CORRUPTED, message, ErrorSeverity.CRITICAL, context, originalError, recoverable);
    this.name = 'DataCorruptedError';
  }
}

/**
 * DHT错误
 */
export class DHTError extends AppError {
  constructor(
    message: string,
    context: ErrorContext = {},
    originalError?: Error,
    recoverable: boolean = true
  ) {
    super(ErrorType.DHT_ERROR, message, ErrorSeverity.ERROR, context, originalError, recoverable);
    this.name = 'DHTError';
  }
}

/**
 * 节点不可达错误
 */
export class NodeUnreachableError extends AppError {
  constructor(
    message: string = 'Node unreachable',
    context: ErrorContext = {},
    originalError?: Error,
    recoverable: boolean = true
  ) {
    super(ErrorType.NODE_UNREACHABLE, message, ErrorSeverity.WARNING, context, originalError, recoverable);
    this.name = 'NodeUnreachableError';
  }
}

/**
 * 引导失败错误
 */
export class BootstrapError extends AppError {
  constructor(
    message: string = 'Bootstrap failed',
    context: ErrorContext = {},
    originalError?: Error,
    recoverable: boolean = true
  ) {
    super(ErrorType.BOOTSTRAP_FAILED, message, ErrorSeverity.CRITICAL, context, originalError, recoverable);
    this.name = 'BootstrapError';
  }
}

/**
 * 验证错误
 */
export class ValidationError extends AppError {
  constructor(
    message: string,
    context: ErrorContext = {},
    originalError?: Error,
    recoverable: boolean = true
  ) {
    super(ErrorType.VALIDATION_ERROR, message, ErrorSeverity.WARNING, context, originalError, recoverable);
    this.name = 'ValidationError';
  }
}

/**
 * 资源耗尽错误
 */
export class ResourceExhaustedError extends AppError {
  constructor(
    message: string = 'Resource exhausted',
    context: ErrorContext = {},
    originalError?: Error,
    recoverable: boolean = true
  ) {
    super(ErrorType.RESOURCE_EXHAUSTED, message, ErrorSeverity.WARNING, context, originalError, recoverable);
    this.name = 'ResourceExhaustedError';
  }
}

/**
 * 错误处理器配置
 */
export interface ErrorHandlerConfig {
  enableConsoleLog: boolean;
  enableFileLog: boolean;
  logFilePath?: string;
  maxErrorHistory: number;
  errorThreshold: number;
  thresholdTimeWindow: number; // 毫秒
  enableStructuredLogging: boolean;
  logLevel: ErrorSeverity;
  enableErrorTracking: boolean;
  trackingEndpoint?: string;
  customErrorFilters?: ErrorType[];
  recoveryStrategies?: {
    [key in ErrorType]?: {
      maxRetries: number;
      delayMs: number;
      exponentialBackoff: boolean;
    };
  };
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
 * 错误统计信息接口
 */
export interface ErrorStats {
  totalErrors: number;
  errorsByType: Record<string, number>;
  errorsBySeverity: Record<string, number>;
  recentErrors: ErrorRecord[];
  errorRates: Record<string, number>;
  recoveryStats: {
    totalAttempts: number;
    successfulRecoveries: number;
    failedRecoveries: number;
    recoveryRate: number;
  };
  topErrorTypes: Array<{ type: string; count: number }>;
  timeRange: {
    start: number;
    end: number;
  };
}

/**
 * 错误趋势接口
 */
export interface ErrorTrend {
  timestamp: number;
  count: number;
  errorsByType: Record<string, number>;
  errorsBySeverity: Record<string, number>;
}

/**
 * 错误类型统计接口
 */
export interface ErrorTypeStats {
  type: string;
  totalCount: number;
  recentCount: number;
  averageSeverity: number;
  recoverableCount: number;
  lastOccurrence: number;
  firstOccurrence: number;
}

/**
 * 错误处理器类
 */
export class ErrorHandler extends EventEmitter {
  private config: ErrorHandlerConfig;
  private errorHistory: ErrorRecord[] = [];
  private errorCounts: Map<ErrorType, number> = new Map();
  private lastErrorTime: Map<ErrorType, number> = new Map();
  private recoveryAttempts: Map<string, number> = new Map();
  private lastRecoveryTime: Map<string, number> = new Map();

  constructor(config: Partial<ErrorHandlerConfig> = {}) {
    super();
    this.config = {
      enableConsoleLog: true,
      enableFileLog: false,
      maxErrorHistory: 1000,
      errorThreshold: 10,
      thresholdTimeWindow: 60000, // 1分钟
      enableStructuredLogging: false,
      logLevel: ErrorSeverity.INFO,
      enableErrorTracking: false,
      ...config
    };
    
    // 初始化错误计数
    Object.values(ErrorType).forEach(errorType => {
      this.errorCounts.set(errorType, 0);
      this.lastErrorTime.set(errorType, 0);
    });
  }

  /**
   * 处理错误
   */
  handleError(error: Error | AppError, context: Record<string, any> = {}): void {
    const appError = this.normalizeError(error, context);
    
    // 检查是否应该过滤此错误
    if (this.shouldFilterError(appError)) {
      return;
    }
    
    // 记录错误历史
    this.addToHistory(appError);
    
    // 更新错误计数
    this.updateErrorCounts(appError);
    
    // 检查错误阈值
    this.checkErrorThreshold(appError);
    
    // 记录日志
    this.logError(appError);
    
    // 发出错误事件
    this.emit('error', appError);
    
    // 根据严重级别发出不同事件
    this.emitBySeverity(appError);
    
    // 尝试恢复（如果错误是可恢复的）
    if (appError.recoverable) {
      this.attemptRecovery(appError);
    }
    
    // 发送错误跟踪（如果启用）
    if (this.config.enableErrorTracking && this.config.trackingEndpoint) {
      this.sendErrorTracking(appError);
    }
  }

  /**
   * 标准化错误对象
   */
  private normalizeError(error: Error | AppError, context: Record<string, any>): AppError {
    if (error instanceof AppError) {
      // 合并上下文
      return new AppError(
        error.type,
        error.message,
        error.severity,
        { ...error.context, ...context },
        error.originalError
      );
    }
    
    // 根据错误类型推断适当的错误类型
    let errorType = ErrorType.SYSTEM_ERROR;
    let severity = ErrorSeverity.ERROR;
    
    if (error.name === 'TimeoutError' || error.message.includes('timeout') || error.message.includes('ETIMEDOUT')) {
      errorType = ErrorType.CONNECTION_TIMEOUT;
      severity = ErrorSeverity.WARNING;
    } else if (error.message.includes('ECONNREFUSED') || error.message.includes('refused')) {
      errorType = ErrorType.CONNECTION_REFUSED;
      severity = ErrorSeverity.ERROR;
    } else if (error.message.includes('DNS') || error.message.includes('ENOTFOUND')) {
      errorType = ErrorType.DNS_RESOLUTION_FAILED;
      severity = ErrorSeverity.ERROR;
    } else if (error.message.includes('protocol') || error.message.includes('handshake')) {
      errorType = ErrorType.PROTOCOL_ERROR;
      severity = ErrorSeverity.ERROR;
    }
    
    return new AppError(
      errorType,
      error.message,
      severity,
      { 
        ...context,
        stack: error.stack,
        name: error.name,
        code: (error as any).code
      },
      error
    );
  }

  /**
   * 添加到错误历史
   */
  private addToHistory(error: AppError): void {
    const errorRecord: ErrorRecord = {
      id: error.errorId,
      type: error.type,
      message: error.message,
      severity: error.severity,
      timestamp: error.timestamp,
      context: error.context,
      recoverable: error.recoverable,
      retryCount: 0
    };
    
    this.errorHistory.push(errorRecord);
    
    // 保持历史记录在限制范围内
    if (this.errorHistory.length > this.config.maxErrorHistory) {
      this.errorHistory = this.errorHistory.slice(-this.config.maxErrorHistory);
    }
  }
  
  /**
   * 检查是否应该过滤此错误
   */
  private shouldFilterError(error: AppError): boolean {
    // 检查日志级别
    if (error.severity < this.config.logLevel) {
      return true;
    }
    
    // 检查自定义错误过滤器
    if (this.config.customErrorFilters && this.config.customErrorFilters.includes(error.type)) {
      return true;
    }
    
    return false;
  }
  
  /**
   * 尝试恢复错误
   */
  private attemptRecovery(error: AppError): void {
    const strategy = this.config.recoveryStrategies?.[error.type];
    if (!strategy) {
      return;
    }
    
    const errorKey = `${error.type}_${error.context.operation || 'unknown'}`;
    const attempts = this.recoveryAttempts.get(errorKey) || 0;
    const lastAttempt = this.lastRecoveryTime.get(errorKey) || 0;
    const now = Date.now();
    
    // 检查是否超过最大重试次数
    if (attempts >= strategy.maxRetries) {
      return;
    }
    
    // 计算延迟时间
    let delay = strategy.delayMs;
    if (strategy.exponentialBackoff) {
      delay = strategy.delayMs * Math.pow(2, attempts);
    }
    
    // 检查是否已经过了延迟时间
    if (now - lastAttempt < delay) {
      return;
    }
    
    // 更新恢复尝试记录
    this.recoveryAttempts.set(errorKey, attempts + 1);
    this.lastRecoveryTime.set(errorKey, now);
    
    // 发出恢复事件
    this.emit('recovery_attempt', {
      error,
      attempt: attempts + 1,
      maxAttempts: strategy.maxRetries,
      delay
    });
  }
  
  /**
   * 发送错误跟踪
   */
  private async sendErrorTracking(error: AppError): Promise<void> {
    if (!this.config.trackingEndpoint) {
      return;
    }
    
    try {
      const trackingData = {
        errorId: error.errorId,
        type: error.type,
        message: error.message,
        severity: error.severity,
        timestamp: error.timestamp,
        context: error.context,
        recoverable: error.recoverable,
        stack: error.stack
      };
      
      // 这里应该发送到跟踪端点
      // 实际实现取决于具体的跟踪服务
      console.log('Sending error tracking data:', trackingData);
    } catch (trackingError) {
      // 避免跟踪错误导致无限循环
      console.warn('Failed to send error tracking:', trackingError);
    }
  }

  /**
   * 更新错误计数
   */
  private updateErrorCounts(error: AppError): void {
    const count = this.errorCounts.get(error.type) || 0;
    this.errorCounts.set(error.type, count + 1);
    this.lastErrorTime.set(error.type, Date.now());
  }

  /**
   * 检查错误阈值
   */
  private checkErrorThreshold(error: AppError): void {
    const count = this.errorCounts.get(error.type) || 0;
    const lastTime = this.lastErrorTime.get(error.type) || 0;
    const timeSinceLastError = Date.now() - lastTime;
    
    if (count >= this.config.errorThreshold && timeSinceLastError <= this.config.thresholdTimeWindow) {
      this.emit('errorThresholdExceeded', {
        errorType: error.type,
        count,
        timeWindow: this.config.thresholdTimeWindow
      });
      
      // 重置计数
      this.errorCounts.set(error.type, 0);
    }
  }

  /**
   * 记录错误日志
   */
  private logError(error: AppError): void {
    if (this.config.enableStructuredLogging) {
      this.logStructuredError(error);
    } else {
      this.logSimpleError(error);
    }
  }
  
  /**
   * 记录结构化错误
   */
  private logStructuredError(error: AppError): void {
    const logEntry = {
      timestamp: new Date(error.timestamp).toISOString(),
      level: this.getLogLevelString(error.severity),
      errorType: error.type,
      errorMessage: error.message,
      errorId: error.errorId,
      severity: error.severity,
      recoverable: error.recoverable,
      retryCount: error.context.retryCount,
      context: error.context,
      stack: error.stack
    };
    
    const logMessage = JSON.stringify(logEntry);
    
    if (this.config.enableConsoleLog) {
      switch (error.severity) {
        case ErrorSeverity.DEBUG:
          console.debug(logMessage);
          break;
        case ErrorSeverity.INFO:
          console.info(logMessage);
          break;
        case ErrorSeverity.WARNING:
          console.warn(logMessage);
          break;
        case ErrorSeverity.ERROR:
        case ErrorSeverity.CRITICAL:
          console.error(logMessage);
          break;
      }
    }
    
    if (this.config.enableFileLog && this.config.logFilePath) {
      // TODO: 实现文件日志记录
      console.log(`Would log to file: ${this.config.logFilePath}`);
      console.log(logMessage);
    }
  }
  
  /**
   * 记录简单错误
   */
  private logSimpleError(error: AppError): void {
    const timestamp = new Date(error.timestamp).toISOString();
    const logMessage = `[${timestamp}] [${this.getLogLevelString(error.severity)}] ${error.type}: ${error.message}`;
    
    if (this.config.enableConsoleLog) {
      switch (error.severity) {
        case ErrorSeverity.DEBUG:
          console.debug(logMessage, error.context);
          break;
        case ErrorSeverity.INFO:
          console.info(logMessage, error.context);
          break;
        case ErrorSeverity.WARNING:
          console.warn(logMessage, error.context);
          break;
        case ErrorSeverity.ERROR:
        case ErrorSeverity.CRITICAL:
          console.error(logMessage, error.context);
          if (error.stack) {
            console.error(error.stack);
          }
          break;
      }
    }
    
    if (this.config.enableFileLog && this.config.logFilePath) {
      // TODO: 实现文件日志记录
      console.log(`Would log to file: ${this.config.logFilePath}`);
      console.log(logMessage);
    }
  }
  
  /**
   * 获取日志级别字符串
   */
  private getLogLevelString(severity: ErrorSeverity): string {
    switch (severity) {
      case ErrorSeverity.DEBUG:
        return 'DEBUG';
      case ErrorSeverity.INFO:
        return 'INFO';
      case ErrorSeverity.WARNING:
        return 'WARNING';
      case ErrorSeverity.ERROR:
        return 'ERROR';
      case ErrorSeverity.CRITICAL:
        return 'CRITICAL';
      case ErrorSeverity.FATAL:
        return 'FATAL';
      default:
        return 'UNKNOWN';
    }
  }

  /**
   * 根据严重级别发出事件
   */
  private emitBySeverity(error: AppError): void {
    switch (error.severity) {
      case ErrorSeverity.DEBUG:
        this.emit('debug', error);
        break;
      case ErrorSeverity.INFO:
        this.emit('info', error);
        break;
      case ErrorSeverity.WARNING:
        this.emit('warning', error);
        break;
      case ErrorSeverity.ERROR:
        this.emit('error', error);
        break;
      case ErrorSeverity.CRITICAL:
        this.emit('critical', error);
        break;
    }
  }

  /**
   * 获取错误统计信息
   */
  getErrorStats(): ErrorStats {
    const stats: ErrorStats = {
      totalErrors: 0,
      errorsByType: {},
      errorsBySeverity: {},
      recentErrors: [],
      errorRates: {},
      recoveryStats: {
        totalAttempts: 0,
        successfulRecoveries: 0,
        failedRecoveries: 0,
        recoveryRate: 0
      },
      topErrorTypes: [],
      timeRange: {
        start: 0,
        end: Date.now()
      }
    };
    
    // 计算总错误数
    this.errorCounts.forEach(count => {
      stats.totalErrors += count;
    });
    
    // 按类型统计
    this.errorCounts.forEach((count, type) => {
      stats.errorsByType[type] = count;
    });
    
    // 按严重程度统计
    this.errorHistory.forEach(record => {
      const severity = record.severity;
      stats.errorsBySeverity[severity] = (stats.errorsBySeverity[severity] || 0) + 1;
    });
    
    // 计算错误率
    const now = Date.now();
    const timeWindows = [60000, 300000, 900000, 3600000]; // 1分钟, 5分钟, 15分钟, 1小时
    timeWindows.forEach(window => {
      const windowStart = now - window;
      const errorsInWindow = this.errorHistory.filter(record => record.timestamp >= windowStart).length;
      stats.errorRates[`${window / 1000}s`] = errorsInWindow / (window / 1000);
    });
    
    // 计算恢复统计
    this.recoveryAttempts.forEach(attempts => {
      stats.recoveryStats.totalAttempts += attempts;
    });
    stats.recoveryStats.recoveryRate = stats.recoveryStats.totalAttempts > 0 
      ? stats.recoveryStats.successfulRecoveries / stats.recoveryStats.totalAttempts 
      : 0;
    
    // 获取最频繁的错误类型
    const sortedErrorTypes = Object.entries(stats.errorsByType)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5);
    stats.topErrorTypes = sortedErrorTypes.map(([type, count]) => ({ type, count }));
    
    // 获取最近的错误
    const recentCount = Math.min(10, this.errorHistory.length);
    stats.recentErrors = this.errorHistory.slice(-recentCount);
    
    // 设置时间范围
    if (this.errorHistory.length > 0) {
      stats.timeRange.start = this.errorHistory[0].timestamp;
    }
    
    return stats;
  }

  /**
   * 获取错误历史记录
   */
  getErrorHistory(limit?: number): ErrorRecord[] {
    if (limit) {
      return this.errorHistory.slice(-limit);
    }
    return [...this.errorHistory];
  }
  
  /**
   * 获取错误趋势
   */
  getErrorTrends(timeWindow: number = 3600000): ErrorTrend[] {
    const now = Date.now();
    const start = now - timeWindow;
    const interval = timeWindow / 12; // 分成12个区间
    
    const trends: ErrorTrend[] = [];
    
    for (let i = 0; i < 12; i++) {
      const intervalStart = start + (i * interval);
      const intervalEnd = intervalStart + interval;
      
      const errorsInInterval = this.errorHistory.filter(record => 
        record.timestamp >= intervalStart && record.timestamp < intervalEnd
      );
      
      const errorsByType: { [key: string]: number } = {};
      const errorsBySeverity: { [key: string]: number } = {};
      
      errorsInInterval.forEach(record => {
        errorsByType[record.type] = (errorsByType[record.type] || 0) + 1;
        errorsBySeverity[record.severity] = (errorsBySeverity[record.severity] || 0) + 1;
      });
      
      trends.push({
        timestamp: intervalStart,
        count: errorsInInterval.length,
        errorsByType,
        errorsBySeverity
      });
    }
    
    return trends;
  }
  
  /**
   * 获取特定错误类型的统计
   */
  getErrorTypeStats(errorType: ErrorType): ErrorTypeStats {
    const typeHistory = this.errorHistory.filter(record => record.type === errorType);
    const now = Date.now();
    
    return {
      type: errorType,
      totalCount: typeHistory.length,
      recentCount: typeHistory.filter(record => now - record.timestamp < 3600000).length,
      averageSeverity: typeHistory.length > 0 
        ? typeHistory.reduce((sum, record) => sum + this.getSeverityValue(record.severity), 0) / typeHistory.length 
        : 0,
      recoverableCount: typeHistory.filter(record => record.recoverable).length,
      lastOccurrence: typeHistory.length > 0 ? typeHistory[typeHistory.length - 1].timestamp : 0,
      firstOccurrence: typeHistory.length > 0 ? typeHistory[0].timestamp : 0
    };
  }
  
  /**
   * 重置错误统计
   */
  resetStats(): void {
    this.errorHistory = [];
    this.errorCounts.clear();
    this.lastErrorTime.clear();
    this.recoveryAttempts.clear();
    this.lastRecoveryTime.clear();
    
    // 重新初始化错误计数
    Object.values(ErrorType).forEach(errorType => {
      this.errorCounts.set(errorType, 0);
      this.lastErrorTime.set(errorType, 0);
    });
    
    this.emit('stats_reset');
  }
  
  /**
   * 获取错误严重级别的数值
   */
  private getSeverityValue(severity: ErrorSeverity): number {
    switch (severity) {
      case ErrorSeverity.DEBUG: return 1;
      case ErrorSeverity.INFO: return 2;
      case ErrorSeverity.WARNING: return 3;
      case ErrorSeverity.ERROR: return 4;
      case ErrorSeverity.CRITICAL: return 5;
      case ErrorSeverity.FATAL: return 6;
      default: return 0;
    }
  }

  /**
   * 清除错误历史
   */
  clearHistory(): void {
    this.errorHistory = [];
    this.errorCounts.clear();
    this.lastErrorTime.clear();
  }
}

/**
 * 全局错误处理器实例
 */
export const globalErrorHandler = new ErrorHandler();

/**
 * 错误处理工具类
 */
export class ErrorHandlerUtils {
  /**
   * 安全执行函数
   */
  static safeExecute<T>(
    fn: () => T,
    errorHandler: ErrorHandler = globalErrorHandler,
    context: ErrorContext = {},
    defaultValue?: T,
    operation?: string
  ): T | undefined {
    try {
      return fn();
    } catch (error) {
      const errorContext: ErrorContext = {
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
    errorHandler: ErrorHandler = globalErrorHandler,
    context: ErrorContext = {},
    defaultValue?: T,
    operation?: string
  ): Promise<T | undefined> {
    try {
      return await fn();
    } catch (error) {
      const errorContext: ErrorContext = {
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
    errorHandler: ErrorHandler = globalErrorHandler,
    maxRetries: number = 3,
    delayMs: number = 1000,
    context: ErrorContext = {},
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
    
    const errorContext: ErrorContext = {
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
    errorHandler: ErrorHandler = globalErrorHandler,
    context: ErrorContext = {},
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
        executionType: 'async'
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
    errorHandler: ErrorHandler = globalErrorHandler,
    context: ErrorContext = {},
    operation?: string
  ) {
    return (...args: any[]): T => {
      try {
        return fn(...args);
      } catch (error) {
        const errorContext: ErrorContext = {
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
    errorHandler: ErrorHandler = globalErrorHandler,
    context: ErrorContext = {},
    operation?: string
  ) {
    return async (...args: any[]): Promise<T> => {
      try {
        return await fn(...args);
      } catch (error) {
        const errorContext: ErrorContext = {
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
    errorHandler: ErrorHandler = globalErrorHandler,
    context: ErrorContext = {},
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
        const errorContext: ErrorContext = {
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
 * 错误类型守卫函数
 */
export function isAppError(error: any): error is AppError {
  return error instanceof AppError;
}

/**
 * 错误类型检查函数
 */
export function isErrorType(error: any, type: ErrorType): boolean {
  return isAppError(error) && error.type === type;
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
      globalErrorHandler.handleError(error as Error, { ...context, attempt, maxRetries });
      
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, delayMs * attempt));
      }
    }
  }
  
  throw lastError!;
}