import { EventEmitter } from 'events';
import * as process from 'process';

/**
 * 性能监控配置接口
 */
export interface PerformanceMonitorConfig {
  enablePerformanceMonitoring: boolean;
  monitoringInterval: number;
  enableMemoryMonitoring: boolean;
  memoryThreshold: number;
}

/**
 * 性能统计信息
 */
export interface PerformanceStats {
  uptime: number;
  memoryUsage?: {
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
  };
  lastMonitoringTime: number;
  monitoringCount: number;
  customMetrics: Record<string, number>;
}

/**
 * 性能警告事件
 */
export interface PerformanceWarningEvent {
  type: 'memory' | 'cpu' | 'custom';
  metric: string;
  value: number;
  threshold: number;
  timestamp: number;
}

/**
 * 性能监控器 - 统一管理性能监控逻辑
 */
export class PerformanceMonitor extends EventEmitter {
  private config: PerformanceMonitorConfig;
  private monitoringInterval?: NodeJS.Timeout;
  private startTime: number;
  private monitoringCount: number;
  private customMetrics: Record<string, number>;
  private customThresholds: Record<string, number>;

  constructor(config: Partial<PerformanceMonitorConfig> = {}) {
    super();
    
    // 设置默认配置
    this.config = {
      enablePerformanceMonitoring: true,
      monitoringInterval: 30000,
      enableMemoryMonitoring: true,
      memoryThreshold: 100 * 1024 * 1024, // 100MB
      ...config
    };
    
    this.startTime = Date.now();
    this.monitoringCount = 0;
    this.customMetrics = {};
    this.customThresholds = {};
    
    // 启动性能监控
    if (this.config.enablePerformanceMonitoring) {
      this.startMonitoring();
    }
  }

  /**
   * 启动性能监控
   */
  private startMonitoring(): void {
    if (this.monitoringInterval) {
      return;
    }
    
    this.monitoringInterval = setInterval(() => {
      this.performMonitoring();
    }, this.config.monitoringInterval);
  }

  /**
   * 执行性能监控
   */
  private performMonitoring(): void {
    try {
      this.monitoringCount++;
      const stats = this.getPerformanceStats();
      
      // 检查内存使用情况
      if (this.config.enableMemoryMonitoring && stats.memoryUsage) {
        this.checkMemoryUsage(stats.memoryUsage);
      }
      
      // 检查自定义指标
      this.checkCustomMetrics();
      
      // 发送性能统计事件
      this.emit('performanceStats', stats);
    } catch (error) {
      this.emit('monitoringError', {
        error: error instanceof Error ? error : new Error(String(error)),
        timestamp: Date.now()
      });
    }
  }

  /**
   * 检查内存使用情况
   */
  private checkMemoryUsage(memoryUsage: PerformanceStats['memoryUsage']): void {
    if (!memoryUsage) return;
    
    const threshold = this.config.memoryThreshold;
    
    if (memoryUsage.heapUsed > threshold) {
      const warningEvent: PerformanceWarningEvent = {
        type: 'memory',
        metric: 'heapUsed',
        value: memoryUsage.heapUsed,
        threshold,
        timestamp: Date.now()
      };
      
      this.emit('performanceWarning', warningEvent);
      
      // 触发内存清理事件
      this.emit('memoryCleanupRequired', {
        memoryUsage,
        threshold,
        timestamp: Date.now()
      });
    }
  }

  /**
   * 检查自定义指标
   */
  private checkCustomMetrics(): void {
    Object.keys(this.customMetrics).forEach(metric => {
      const value = this.customMetrics[metric];
      const threshold = this.customThresholds[metric];
      
      if (threshold && value > threshold) {
        const warningEvent: PerformanceWarningEvent = {
          type: 'custom',
          metric,
          value,
          threshold,
          timestamp: Date.now()
        };
        
        this.emit('performanceWarning', warningEvent);
      }
    });
  }

  /**
   * 获取性能统计信息
   */
  getPerformanceStats(): PerformanceStats {
    return {
      uptime: Date.now() - this.startTime,
      memoryUsage: this.getMemoryUsage(),
      lastMonitoringTime: Date.now(),
      monitoringCount: this.monitoringCount,
      customMetrics: { ...this.customMetrics }
    };
  }

  /**
   * 获取内存使用情况
   */
  private getMemoryUsage(): PerformanceStats['memoryUsage'] {
    if (!this.config.enableMemoryMonitoring) {
      return undefined;
    }
    
    return process.memoryUsage();
  }

  /**
   * 设置自定义指标
   */
  setCustomMetric(name: string, value: number): void {
    this.customMetrics[name] = value;
  }

  /**
   * 增加自定义指标值
   */
  incrementCustomMetric(name: string, increment: number = 1): void {
    this.customMetrics[name] = (this.customMetrics[name] || 0) + increment;
  }

  /**
   * 设置自定义指标阈值
   */
  setCustomThreshold(name: string, threshold: number): void {
    this.customThresholds[name] = threshold;
  }

  /**
   * 获取自定义指标值
   */
  getCustomMetric(name: string): number | undefined {
    return this.customMetrics[name];
  }

  /**
   * 更新配置
   */
  updateConfig(newConfig: Partial<PerformanceMonitorConfig>): void {
    const wasMonitoring = this.config.enablePerformanceMonitoring;
    this.config = { ...this.config, ...newConfig };
    
    // 如果监控状态发生变化，相应地启动或停止监控
    if (wasMonitoring !== this.config.enablePerformanceMonitoring) {
      if (this.config.enablePerformanceMonitoring) {
        this.startMonitoring();
      } else {
        this.stopMonitoring();
      }
    }
  }

  /**
   * 停止性能监控
   */
  private stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }
  }

  /**
   * 重置统计信息
   */
  resetStats(): void {
    this.startTime = Date.now();
    this.monitoringCount = 0;
    this.customMetrics = {};
  }

  /**
   * 强制执行一次监控
   */
  forceMonitoring(): void {
    this.performMonitoring();
  }

  /**
   * 销毁性能监控器
   */
  destroy(): void {
    this.stopMonitoring();
    this.removeAllListeners();
    this.customMetrics = {};
    this.customThresholds = {};
  }
}