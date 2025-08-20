/**
 * 通用功能模块使用示例
 */

import { 
  createCommonModules, 
  CommonModulesConfig,
  CommonModules
} from './index';

/**
 * 示例：如何在管理器中使用通用功能模块
 */
export class ExampleManager {
  private modules: CommonModules;

  constructor(config?: CommonModulesConfig) {
    // 创建通用功能模块集合
    this.modules = createCommonModules(config);
    
    // 设置事件监听器
    this.setupEventListeners();
  }

  /**
   * 设置事件监听器
   */
  private setupEventListeners(): void {
    // 监听重试事件
    this.modules.retryManager.on('retry', (event) => {
      console.log(`重试事件: ${event.operation} - 尝试 ${event.attempt}/${event.maxAttempts}`);
    });

    // 监听性能警告
    this.modules.performanceMonitor.on('performanceWarning', (warning) => {
      console.warn(`性能警告: ${warning.type} - ${warning.metric} = ${warning.value}`);
    });

    // 监听内存清理事件
    this.modules.memoryManager.on('memoryCleanup', (cleanup) => {
      console.log(`内存清理: ${cleanup.cleanupType} - 释放 ${cleanup.memoryFreed} bytes`);
    });
  }

  /**
   * 示例：使用重试机制执行操作
   */
  async executeWithRetry<T>(operation: () => Promise<T>, operationKey: string): Promise<T> {
    return this.modules.retryManager.executeWithRetry(operation, operationKey);
  }

  /**
   * 示例：记录性能指标
   */
  recordPerformanceMetric(name: string, value: number): void {
    this.modules.performanceMonitor.setCustomMetric(name, value);
  }

  /**
   * 示例：执行内存清理
   */
  performMemoryCleanup(): void {
    this.modules.memoryManager.performMemoryCleanup();
  }

  /**
   * 示例：验证配置
   */
  validateConfig(configType: string, config: any): boolean {
    return this.modules.configValidator.validate(configType, config);
  }

  /**
   * 获取统计信息
   */
  getStats() {
    return {
      retry: this.modules.retryManager.getRetryStats(),
      performance: this.modules.performanceMonitor.getPerformanceStats(),
      memory: this.modules.memoryManager.getMemoryStats()
    };
  }

  /**
   * 清理资源
   */
  destroy(): void {
    this.modules.retryManager.destroy();
    this.modules.performanceMonitor.destroy();
    this.modules.memoryManager.destroy();
  }
}

/**
 * 使用示例
 */
export function usageExample() {
  // 1. 创建配置
  const config: CommonModulesConfig = {
    retry: {
      enableRetry: true,
      maxRetries: 3,
      retryDelay: 1000
    },
    performance: {
      enablePerformanceMonitoring: true,
      monitoringInterval: 30000
    },
    memory: {
      enableMemoryOptimization: true,
      memoryCleanupThreshold: 1000
    }
  };

  // 2. 创建管理器实例
  const manager = new ExampleManager(config);

  // 3. 使用重试机制
  manager.executeWithRetry(
    async () => {
      // 模拟可能失败的操作
      if (Math.random() > 0.7) {
        throw new Error('随机失败');
      }
      return '操作成功';
    },
    'example-operation'
  ).then(result => {
    console.log('操作结果:', result);
  }).catch(error => {
    console.error('操作失败:', error.message);
  });

  // 4. 记录性能指标
  manager.recordPerformanceMetric('operations_per_second', 100);

  // 5. 验证配置
  const testConfig = {
    port: 8080,
    maxNodes: 1000,
    refreshInterval: 5000
  };
  
  const isValid = manager.validateConfig('DHTManager', testConfig);
  console.log('配置验证结果:', isValid);

  // 6. 获取统计信息
  console.log('统计信息:', manager.getStats());

  // 7. 清理资源
  setTimeout(() => {
    manager.destroy();
  }, 5000);
}

// 如果直接运行此文件，执行示例
if (require.main === module) {
  usageExample();
}