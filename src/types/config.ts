/**
 * 配置和日志相关类型定义
 */

/**
 * 日志级别枚举
 */
export enum LogLevel {
  ERROR = 'ERROR',
  WARN = 'WARN',
  INFO = 'INFO',
  DEBUG = 'DEBUG',
  TRACE = 'TRACE'
}

/**
 * 日志配置接口
 */
export interface LoggerConfig {
  level: LogLevel;
  enableConsole: boolean;
  enableFile: boolean;
  filePath?: string;
  maxSize?: number;
  maxFiles?: number;
  enableColors?: boolean;
  enableTimestamp?: boolean;
  timestampFormat?: string;
  enableStructuredLogging?: boolean;
  enablePerformanceMetrics?: boolean;
  enableMemoryMonitoring?: boolean;
  enableErrorTracking?: boolean;
  enableFiltering?: boolean;
  filters?: {
    includeLevels?: LogLevel[];
    excludeLevels?: LogLevel[];
    includeComponents?: string[];
    excludeComponents?: string[];
  };
}

/**
 * 日志条目接口
 */
export interface LogEntry {
  timestamp: number;
  level: LogLevel;
  message: string;
  component: string;
  metadata?: Record<string, unknown>;
  error?: Error;
  traceId?: string;
  spanId?: string;
}

/**
 * 日志事件接口
 */
export interface LoggerEvents {
  log: (entry: LogEntry) => void;
  error: (error: Error, entry?: LogEntry) => void;
  warn: (entry: LogEntry) => void;
  info: (entry: LogEntry) => void;
  debug: (entry: LogEntry) => void;
  trace: (entry: LogEntry) => void;
}

/**
 * 配置接口
 */
export interface Config {
  dht: {
    port: number;
    bootstrap: boolean | string[];
    nodesMaxSize: number;
    refreshPeriod: number;
    announcePeriod: number;
    enableMemoryMonitoring: boolean;
    memoryThreshold: number;
    cleanupInterval: number;
    maxRetries: number;
    retryDelay: number;
  };
  metadata: {
    maximumParallelFetchingTorrent: number;
    maximumWaitingQueueSize: number;
    downloadMaxTime: number;
    ignoreFetched: boolean;
    aggressiveLevel: number;
    enableRetry: boolean;
    maxRetries: number;
    retryDelay: number;
    retryBackoffFactor: number;
    enablePerformanceMonitoring: boolean;
    performanceMonitoringInterval: number;
    maxConcurrentRequests: number;
    requestTimeout: number;
    enableMemoryOptimization: boolean;
    memoryCleanupThreshold: number;
  };
  cache: {
    maxSize: number;
    ttl: number;
    checkPeriod: number;
    enableStats: boolean;
    enableCompression: boolean;
    compressionThreshold: number;
    enablePersistence: boolean;
    persistencePath: string;
    persistenceInterval: number;
    enableMemoryMonitoring: boolean;
    memoryThreshold: number;
    cleanupInterval: number;
  };
  peer: {
    maxNodes: number;
    nodeRefreshTime: number;
    findNodeProbability: number;
    enableMemoryMonitoring: boolean;
    memoryThreshold: number;
    cleanupInterval: number;
    maxNodeAge: number;
  };
  logger: LoggerConfig;
  error: {
    enableErrorHandling: boolean;
    enableErrorReporting: boolean;
    enableErrorTracking: boolean;
    maxErrorHistory: number;
    errorReportingInterval: number;
    enableAutomaticRecovery: boolean;
    recoveryMaxRetries: number;
    recoveryDelay: number;
  };
}

/**
 * 配置管理器接口
 */
export interface ConfigManager {
  get<T extends keyof Config>(key: T): Config[T];
  set<T extends keyof Config>(key: T, value: Config[T]): void;
  has<T extends keyof Config>(key: T): boolean;
  getAll(): Config;
  loadFromFile(filePath: string): Promise<void>;
  saveToFile(filePath: string): Promise<void>;
  validate(): boolean;
  reset(): void;
  on(event: 'change', listener: (key: keyof Config, value: any) => void): this;
  on(event: 'error', listener: (error: Error) => void): this;
}

/**
 * 配置验证规则接口
 */
export interface ConfigValidationRule {
  key: keyof Config;
  required?: boolean;
  type?: 'string' | 'number' | 'boolean' | 'object' | 'array';
  min?: number;
  max?: number;
  pattern?: RegExp;
  enum?: any[];
  custom?: (value: any) => boolean | string;
  message?: string;
}

/**
 * 配置验证结果接口
 */
export interface ConfigValidationResult {
  valid: boolean;
  errors: {
    key: keyof Config;
    message: string;
    value: any;
  }[];
  warnings: {
    key: keyof Config;
    message: string;
    value: any;
  }[];
}

/**
 * 日志器接口
 */
export interface Logger {
  getInstance(): Logger;
  setLevel(level: LogLevel): void;
  getLevel(): LogLevel;
  log(level: LogLevel, message: string, component?: string, metadata?: Record<string, unknown>): void;
  error(message: string, component?: string, metadata?: Record<string, unknown>): void;
  warn(message: string, component?: string, metadata?: Record<string, unknown>): void;
  info(message: string, component?: string, metadata?: Record<string, unknown>): void;
  debug(message: string, component?: string, metadata?: Record<string, unknown>): void;
  trace(message: string, component?: string, metadata?: Record<string, unknown>): void;
}

/**
 * 日志器实现类
 */
export class LoggerImpl implements Logger {
  private static instance: LoggerImpl;
  private level: LogLevel = LogLevel.INFO;

  private constructor() {}

  public static getInstance(): LoggerImpl {
    if (!LoggerImpl.instance) {
      LoggerImpl.instance = new LoggerImpl();
    }
    return LoggerImpl.instance;
  }

  public getInstance(): Logger {
    return LoggerImpl.getInstance();
  }

  public setLevel(level: LogLevel): void {
    this.level = level;
  }

  public getLevel(): LogLevel {
    return this.level;
  }

  public log(level: LogLevel, message: string, component?: string, metadata?: Record<string, unknown>): void {
    if (this.shouldLog(level)) {
      const timestamp = new Date().toISOString();
      const componentStr = component ? `[${component}]` : '';
      const metadataStr = metadata ? ` ${JSON.stringify(metadata)}` : '';
      console.log(`[${timestamp}] [${level}]${componentStr} ${message}${metadataStr}`);
    }
  }

  public error(message: string, component?: string, metadata?: Record<string, unknown>): void {
    this.log(LogLevel.ERROR, message, component, metadata);
  }

  public warn(message: string, component?: string, metadata?: Record<string, unknown>): void {
    this.log(LogLevel.WARN, message, component, metadata);
  }

  public info(message: string, component?: string, metadata?: Record<string, unknown>): void {
    this.log(LogLevel.INFO, message, component, metadata);
  }

  public debug(message: string, component?: string, metadata?: Record<string, unknown>): void {
    this.log(LogLevel.DEBUG, message, component, metadata);
  }

  public trace(message: string, component?: string, metadata?: Record<string, unknown>): void {
    this.log(LogLevel.TRACE, message, component, metadata);
  }

  private shouldLog(level: LogLevel): boolean {
    const levels = [LogLevel.TRACE, LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR];
    return levels.indexOf(level) >= levels.indexOf(this.level);
  }
}

// 为了向后兼容性，导出LoggerImpl作为Logger
export const Logger = LoggerImpl;

/**
 * 环境配置接口
 */
export interface EnvironmentConfig {
  NODE_ENV: 'development' | 'production' | 'test';
  LOG_LEVEL: LogLevel;
  PORT: number;
  HOST: string;
  ENABLE_METRICS: boolean;
  ENABLE_TRACING: boolean;
  ENABLE_DEBUG: boolean;
  MAX_MEMORY_USAGE: number;
  CLEANUP_INTERVAL: number;
}

/**
 * 性能监控配置接口
 */
export interface PerformanceConfig {
  enableMonitoring: boolean;
  interval: number;
  enableMemoryMonitoring: boolean;
  enableCpuMonitoring: boolean;
  enableNetworkMonitoring: boolean;
  enableDiskMonitoring: boolean;
  thresholds: {
    memory: number;
    cpu: number;
    network: number;
    disk: number;
  };
  alerts: {
    enable: boolean;
    channels: string[];
    cooldown: number;
  };
}