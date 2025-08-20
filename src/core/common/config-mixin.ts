import { BaseManagerConfig } from '../base-manager';
import { ValidationRule } from './config-validator';

/**
 * 配置验证混入接口
 */
export interface ConfigValidationMixin {
  validateConfig(config: BaseManagerConfig): void;
  getConfigDefaults(): BaseManagerConfig;
  mergeWithDefaults(config: BaseManagerConfig): BaseManagerConfig;
}

/**
 * 配置验证混入实现
 */
export function withConfigValidation<T extends new (...args: any[]) => any>(Base: T) {
  return class extends Base implements ConfigValidationMixin {
    /**
     * 获取配置默认值（子类可重写）
     */
    getConfigDefaults(): BaseManagerConfig {
      return {
        enableErrorHandling: true,
        enableMemoryMonitoring: true,
        cleanupInterval: 5 * 60 * 1000, // 5分钟
        memoryThreshold: 100 * 1024 * 1024, // 100MB
        enableRetry: true,
        enablePerformanceMonitoring: true
      };
    }

    /**
     * 合并配置与默认值
     */
    mergeWithDefaults(config: BaseManagerConfig): BaseManagerConfig {
      const defaults = this.getConfigDefaults();
      return { ...defaults, ...config };
    }

    /**
     * 验证配置
     */
    validateConfig(config: BaseManagerConfig): void {
      if (!config) {
        throw new Error('Config is required');
      }

      if (config.cleanupInterval !== undefined && (typeof config.cleanupInterval !== 'number' || config.cleanupInterval <= 0)) {
        throw new Error('cleanupInterval must be a positive number');
      }

      if (config.memoryThreshold !== undefined && (typeof config.memoryThreshold !== 'number' || config.memoryThreshold <= 0)) {
        throw new Error('memoryThreshold must be a positive number');
      }
    }
  };
}

/**
 * 缓存配置验证规则
 */
export const cacheConfigValidationRules: ValidationRule[] = [
  {
    field: 'fetchedTupleSize',
    type: 'number',
    required: false,
    min: 1,
    max: 100000
  },
  {
    field: 'fetchedInfoHashSize',
    type: 'number',
    required: false,
    min: 1,
    max: 100000
  },
  {
    field: 'findNodeCacheSize',
    type: 'number',
    required: false,
    min: 1,
    max: 100000
  },
  {
    field: 'latestCalledPeersSize',
    type: 'number',
    required: false,
    min: 1,
    max: 10000
  },
  {
    field: 'usefulPeersSize',
    type: 'number',
    required: false,
    min: 1,
    max: 10000
  },
  {
    field: 'metadataFetchingCacheSize',
    type: 'number',
    required: false,
    min: 1,
    max: 10000
  }
];

/**
 * DHT配置验证规则
 */
export const dhtConfigValidationRules: ValidationRule[] = [
  {
    field: 'maxTables',
    type: 'number',
    required: false,
    min: 1,
    max: 10000
  },
  {
    field: 'maxValues',
    type: 'number',
    required: false,
    min: 1,
    max: 100000
  },
  {
    field: 'maxPeers',
    type: 'number',
    required: false,
    min: 1,
    max: 100000
  }
];

/**
 * Peer配置验证规则
 */
export const peerConfigValidationRules: ValidationRule[] = [
  {
    field: 'maxNodes',
    type: 'number',
    required: false,
    min: 1,
    max: 10000
  },
  {
    field: 'nodeRefreshTime',
    type: 'number',
    required: false,
    min: 1000,
    max: 3600000
  },
  {
    field: 'findNodeProbability',
    type: 'number',
    required: false,
    min: 0,
    max: 1
  }
];