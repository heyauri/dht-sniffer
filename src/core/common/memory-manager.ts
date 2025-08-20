import { EventEmitter } from 'events';
import * as process from 'process';

/**
 * 内存管理配置接口
 */
export interface MemoryManagerConfig {
  enableMemoryOptimization: boolean;
  memoryCleanupThreshold: number;
  enableGarbageCollection: boolean;
  maxMemoryUsage: number;
  cleanupInterval: number;
}

/**
 * 内存统计信息
 */
export interface MemoryStats {
  heapUsed: number;
  heapTotal: number;
  external: number;
  rss: number;
  heapUsagePercentage: number;
  cleanupCount: number;
  lastCleanupTime: number;
  memoryWarnings: number;
}

/**
 * 内存清理事件
 */
export interface MemoryCleanupEvent {
  cleanedItems?: number;
  remainingItems?: number;
  memoryFreed?: number;
  cleanupType: 'light' | 'deep' | 'forced';
  timestamp: number;
}

/**
 * 内存管理器 - 统一管理内存优化和清理逻辑
 */
export class MemoryManager extends EventEmitter {
  private config: MemoryManagerConfig;
  private cleanupInterval?: NodeJS.Timeout;
  private cleanupCount: number;
  private memoryWarnings: number;
  private operationCount: number;

  constructor(config: Partial<MemoryManagerConfig> = {}) {
    super();
    
    // 设置默认配置
    this.config = {
      enableMemoryOptimization: true,
      memoryCleanupThreshold: 1000,
      enableGarbageCollection: true,
      maxMemoryUsage: 500 * 1024 * 1024, // 500MB
      cleanupInterval: 5 * 60 * 1000, // 5分钟
      ...config
    };
    
    this.cleanupCount = 0;
    this.memoryWarnings = 0;
    this.operationCount = 0;
    
    // 启动定期清理任务
    if (this.config.enableMemoryOptimization) {
      this.startPeriodicCleanup();
    }
  }

  /**
   * 启动定期清理任务
   */
  private startPeriodicCleanup(): void {
    if (this.cleanupInterval) {
      return;
    }
    
    this.cleanupInterval = setInterval(() => {
      this.performMemoryCleanup();
    }, this.config.cleanupInterval);
  }

  /**
   * 执行内存清理
   */
  performMemoryCleanup(cleanupType: 'light' | 'deep' | 'forced' = 'light'): void {
    try {
      const beforeStats = this.getMemoryStats();
      
      // 执行清理操作
      this.executeCleanupOperations(cleanupType);
      
      const afterStats = this.getMemoryStats();
      const memoryFreed = beforeStats.heapUsed - afterStats.heapUsed;
      
      this.cleanupCount++;
      
      // 发送清理完成事件
      const cleanupEvent: MemoryCleanupEvent = {
        memoryFreed: Math.max(0, memoryFreed),
        cleanupType,
        timestamp: Date.now()
      };
      
      this.emit('memoryCleanup', cleanupEvent);
    } catch (error) {
      this.emit('memoryError', {
        error: error instanceof Error ? error : new Error(String(error)),
        operation: 'performMemoryCleanup',
        timestamp: Date.now()
      });
    }
  }

  /**
   * 执行清理操作
   */
  private executeCleanupOperations(cleanupType: 'light' | 'deep' | 'forced'): void {
    switch (cleanupType) {
      case 'light':
        this.performLightCleanup();
        break;
      case 'deep':
        this.performDeepCleanup();
        break;
      case 'forced':
        this.performForcedCleanup();
        break;
    }
  }

  /**
   * 执行轻量级清理
   */
  private performLightCleanup(): void {
    // 触发垃圾回收（如果可用）
    if (this.config.enableGarbageCollection && global.gc) {
      global.gc();
    }
    
    // 发送轻量级清理事件
    this.emit('lightCleanup', {
      timestamp: Date.now()
    });
  }

  /**
   * 执行深度清理
   */
  private performDeepCleanup(): void {
    // 强制垃圾回收
    if (global.gc) {
      global.gc();
      global.gc(); // 多次调用以确保彻底清理
    }
    
    // 发送深度清理事件
    this.emit('deepCleanup', {
      timestamp: Date.now()
    });
  }

  /**
   * 执行强制清理
   */
  private performForcedCleanup(): void {
    // 强制垃圾回收
    if (global.gc) {
      for (let i = 0; i < 3; i++) {
        global.gc();
      }
    }
    
    // 发送强制清理事件
    this.emit('forcedCleanup', {
      timestamp: Date.now()
    });
  }

  /**
   * 检查内存使用情况
   */
  checkMemoryUsage(): boolean {
    const memoryStats = this.getMemoryStats();
    const isOverThreshold = memoryStats.heapUsed > this.config.maxMemoryUsage;
    
    if (isOverThreshold) {
      this.memoryWarnings++;
      
      // 发送内存警告事件
      this.emit('memoryWarning', {
        memoryStats,
        threshold: this.config.maxMemoryUsage,
        timestamp: Date.now()
      });
      
      // 自动执行深度清理
      this.performMemoryCleanup('deep');
    }
    
    return isOverThreshold;
  }

  /**
   * 获取内存统计信息
   */
  getMemoryStats(): MemoryStats {
    const memoryUsage = process.memoryUsage();
    const heapUsagePercentage = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;
    
    return {
      heapUsed: memoryUsage.heapUsed,
      heapTotal: memoryUsage.heapTotal,
      external: memoryUsage.external,
      rss: memoryUsage.rss,
      heapUsagePercentage,
      cleanupCount: this.cleanupCount,
      lastCleanupTime: Date.now(),
      memoryWarnings: this.memoryWarnings
    };
  }

  /**
   * 记录操作计数（用于触发清理）
   */
  recordOperation(): void {
    this.operationCount++;
    
    // 检查是否需要清理
    if (this.operationCount >= this.config.memoryCleanupThreshold) {
      this.performMemoryCleanup('light');
      this.operationCount = 0;
    }
  }

  /**
   * 更新配置
   */
  updateConfig(newConfig: Partial<MemoryManagerConfig>): void {
    const wasOptimizationEnabled = this.config.enableMemoryOptimization;
    this.config = { ...this.config, ...newConfig };
    
    // 如果优化状态发生变化，相应地启动或停止清理
    if (wasOptimizationEnabled !== this.config.enableMemoryOptimization) {
      if (this.config.enableMemoryOptimization) {
        this.startPeriodicCleanup();
      } else {
        this.stopPeriodicCleanup();
      }
    }
  }

  /**
   * 停止定期清理任务
   */
  private stopPeriodicCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }
  }

  /**
   * 重置统计信息
   */
  resetStats(): void {
    this.cleanupCount = 0;
    this.memoryWarnings = 0;
    this.operationCount = 0;
  }

  /**
   * 获取内存使用百分比
   */
  getMemoryUsagePercentage(): number {
    const memoryStats = this.getMemoryStats();
    return memoryStats.heapUsagePercentage;
  }

  /**
   * 检查是否需要清理
   */
  shouldCleanup(): boolean {
    const memoryStats = this.getMemoryStats();
    return (
      memoryStats.heapUsagePercentage > 80 ||
      this.operationCount >= this.config.memoryCleanupThreshold
    );
  }

  /**
   * 销毁内存管理器
   */
  destroy(): void {
    this.stopPeriodicCleanup();
    this.removeAllListeners();
    this.resetStats();
  }
}