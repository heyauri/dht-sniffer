/**
 * 配置管理工具文件
 * 
 * 本文件从统一的types/config.ts导入所有配置相关类型定义
 * 以避免重复定义并保持类型的一致性
 */

// 导入统一的类型定义
import {
  Config,
  LogLevel,
  LoggerConfig
} from '../types/config';
import { ConfigManager } from './config-manager';

/**
 * 默认配置
 */
const defaultConfig: Config = {
  dht: {
    port: 6881,
    bootstrap: true,
    nodesMaxSize: 1000,
    refreshPeriod: 300000,
    announcePeriod: 1800000,
    enableMemoryMonitoring: true,
    memoryThreshold: 100 * 1024 * 1024,
    cleanupInterval: 5 * 60 * 1000,
    maxRetries: 3,
    retryDelay: 1000
  },
  metadata: {
    maximumParallelFetchingTorrent: 5,
    maximumWaitingQueueSize: 1000,
    downloadMaxTime: 300000,
    ignoreFetched: true,
    aggressiveLevel: 1,
    enableRetry: true,
    maxRetries: 3,
    retryDelay: 1000,
    retryBackoffFactor: 2,
    enablePerformanceMonitoring: true,
    performanceMonitoringInterval: 30000,
    maxConcurrentRequests: 50,
    requestTimeout: 30000,
    enableMemoryOptimization: true,
    memoryCleanupThreshold: 1000
  },
  cache: {
    maxSize: 1000,
    ttl: 3600000,
    checkPeriod: 60000,
    enableStats: true,
    enableCompression: false,
    compressionThreshold: 1024,
    enablePersistence: false,
    persistencePath: './cache',
    persistenceInterval: 300000,
    enableMemoryMonitoring: true,
    memoryThreshold: 50 * 1024 * 1024,
    cleanupInterval: 5 * 60 * 1000
  },
  peer: {
    maxNodes: 1000,
    nodeRefreshTime: 300000,
    findNodeProbability: 0.1,
    enableMemoryMonitoring: true,
    memoryThreshold: 100 * 1024 * 1024,
    cleanupInterval: 5 * 60 * 1000,
    maxNodeAge: 24 * 60 * 60 * 1000
  },
  logger: {
    level: LogLevel.INFO,
    enableConsole: true,
    enableFile: false,
    filePath: './logs/app.log'
  },
  error: {
    enableErrorHandling: true,
    enableErrorReporting: true,
    enableErrorTracking: true,
    maxErrorHistory: 1000,
    errorReportingInterval: 300000,
    enableAutomaticRecovery: true,
    recoveryMaxRetries: 3,
    recoveryDelay: 1000
  }
};

/**
 * 导出默认实例
 */
export const config = ConfigManager.getInstance(defaultConfig);

// 重新导出类型以保持向后兼容性
export {
  Config,
  ConfigManager,
  LogLevel,
  LoggerConfig
};