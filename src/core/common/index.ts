/**
 * 通用功能模块导出
 */

// 重试管理器
export { RetryManager } from './retry-manager';
export type { 
  RetryConfig, 
  RetryStats, 
  RetryEvent 
} from './retry-manager';

// 性能监控器
export { PerformanceMonitor } from './performance-monitor';
export type { 
  PerformanceMonitorConfig, 
  PerformanceStats, 
  PerformanceWarningEvent 
} from './performance-monitor';

// 内存管理器
export { MemoryManager } from './memory-manager';
export type { 
  MemoryManagerConfig, 
  MemoryStats, 
  MemoryCleanupEvent 
} from './memory-manager';

// 配置验证器
export { ConfigValidator, ValidationRules, createConfigValidator } from './config-validator';
export type { 
  ValidationRule, 
  ConfigValidationError 
} from './config-validator';

/**
 * 通用功能模块工厂类
 */
export class CommonModulesFactory {
  /**
   * 创建重试管理器实例
   */
  static createRetryManager(config?: Partial<import('./retry-manager').RetryConfig>): import('./retry-manager').RetryManager {
    return new (require('./retry-manager').RetryManager)(config);
  }

  /**
   * 创建性能监控器实例
   */
  static createPerformanceMonitor(config?: Partial<import('./performance-monitor').PerformanceMonitorConfig>): import('./performance-monitor').PerformanceMonitor {
    return new (require('./performance-monitor').PerformanceMonitor)(config);
  }

  /**
   * 创建内存管理器实例
   */
  static createMemoryManager(config?: Partial<import('./memory-manager').MemoryManagerConfig>): import('./memory-manager').MemoryManager {
    return new (require('./memory-manager').MemoryManager)(config);
  }

  /**
 * 创建配置验证器实例
 */
  static createConfigValidator(): import('./config-validator').ConfigValidator {
    const { createConfigValidator } = require('./config-validator');
    return createConfigValidator();
  }
}

/**
 * 通用功能模块配置接口
 */
export interface CommonModulesConfig {
  retry?: Partial<import('./retry-manager').RetryConfig>;
  performance?: Partial<import('./performance-monitor').PerformanceMonitorConfig>;
  memory?: Partial<import('./memory-manager').MemoryManagerConfig>;
}

/**
 * 通用功能模块集合
 */
export interface CommonModules {
  retryManager: import('./retry-manager').RetryManager;
  performanceMonitor: import('./performance-monitor').PerformanceMonitor;
  memoryManager: import('./memory-manager').MemoryManager;
  configValidator: import('./config-validator').ConfigValidator;
}

/**
 * 创建通用功能模块集合
 */
export function createCommonModules(config?: CommonModulesConfig): CommonModules {
  const { createConfigValidator } = require('./config-validator');
  return {
    retryManager: CommonModulesFactory.createRetryManager(config?.retry),
    performanceMonitor: CommonModulesFactory.createPerformanceMonitor(config?.performance),
    memoryManager: CommonModulesFactory.createMemoryManager(config?.memory),
    configValidator: createConfigValidator()
  };
}