/**
 * 配置管理器实现类
 */

import { Config } from '../types/config';
import type { ConfigManager as ConfigManagerType } from '../types/config';
import { EventEmitter } from 'events';
import { ConfigError } from '../types/error';
import * as fs from 'fs';
import * as path from 'path';

/**
 * 配置管理器实现
 */
export class ConfigManagerImpl extends EventEmitter implements ConfigManagerType {
  private config: Config;
  private static instance: ConfigManagerImpl;

  private constructor(config: Config) {
    super();
    this.config = config;
  }

  public static getInstance(config?: Config): ConfigManagerImpl {
    if (!ConfigManagerImpl.instance) {
      if (!config) {
        throw new ConfigError('Initial config is required for first instantiation');
      }
      ConfigManagerImpl.instance = new ConfigManagerImpl(config);
    }
    return ConfigManagerImpl.instance;
  }

  public get<T extends keyof Config>(key: T): Config[T] {
    return this.config[key];
  }

  public set<T extends keyof Config>(key: T, value: Config[T]): void {
    this.config[key] = value;
    this.emit('change', key, value);
  }

  public has<T extends keyof Config>(key: T): boolean {
    return this.config[key] !== undefined;
  }

  public getAll(): Config {
    return { ...this.config };
  }

  public async loadFromFile(filePath: string): Promise<void> {
    try {
      const content = await fs.promises.readFile(filePath, 'utf-8');
      const loadedConfig = JSON.parse(content);
      this.config = { ...this.config, ...loadedConfig };
    } catch (error) {
      throw new ConfigError(`Failed to load config from ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  public async saveToFile(filePath: string): Promise<void> {
    try {
      const dir = path.dirname(filePath);
      await fs.promises.mkdir(dir, { recursive: true });
      await fs.promises.writeFile(filePath, JSON.stringify(this.config, null, 2));
    } catch (error) {
      throw new ConfigError(`Failed to save config to ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  public validate(): boolean {
    // 基本验证逻辑
    if (!this.config.dht || typeof this.config.dht.port !== 'number') {
      return false;
    }
    if (!this.config.cache || typeof this.config.cache.maxSize !== 'number') {
      return false;
    }
    if (!this.config.metadata || typeof this.config.metadata.maximumParallelFetchingTorrent !== 'number') {
      return false;
    }
    return true;
  }

  public reset(): void {
    // 重置为默认配置（这里简化处理）
    this.config = this.getDefaultConfig();
  }

  private getDefaultConfig(): Config {
    return {
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
        level: 'INFO' as any,
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
  }
}

// 为了向后兼容性，导出ConfigManagerImpl作为ConfigManager
export { ConfigManagerImpl as ConfigManager };