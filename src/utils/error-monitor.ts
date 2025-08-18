import { EventEmitter } from 'events';
import { AppError, ErrorType, ErrorSeverity, ErrorHandler, ErrorRecord } from './error-handler';
import { LRUCache } from 'lru-cache';

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
 * 错误监控配置
 */
export interface ErrorMonitorConfig {
  statsIntervalMs: number;
  maxRecentErrors: number;
  errorRateWindowMs: number;
  enableAlerts: boolean;
  alertThresholds: {
    errorRate: number; // 每分钟错误数阈值
    criticalErrors: number; // 严重错误数阈值
    consecutiveErrors: number; // 连续错误数阈值
  };
}

/**
 * 错误监控器类
 */
export class ErrorMonitor extends EventEmitter {
  private errorHandler: ErrorHandler;
  private config: ErrorMonitorConfig;
  private statsInterval: NodeJS.Timeout | null = null;
  private errorTimestamps: number[] = [];
  private consecutiveErrorCount = 0;
  private lastErrorTime = 0;
  private recoveryStartTime = 0;
  private totalErrors = 0;
  private errorsByType: Record<ErrorType, number> = this.initErrorCount();
  private errorsBySeverity: Record<ErrorSeverity, number> = this.initSeverityCount();
  private recentErrors: AppError[] = [];
  private peakErrorTime: number | null = null;
  private peakErrorCount = 0;

  constructor(
    errorHandler: ErrorHandler,
    config: Partial<ErrorMonitorConfig> = {}
  ) {
    super();
    this.errorHandler = errorHandler;
    this.config = {
      statsIntervalMs: 60000, // 1分钟
      maxRecentErrors: 100,
      errorRateWindowMs: 300000, // 5分钟
      enableAlerts: true,
      alertThresholds: {
        errorRate: 10, // 每分钟10个错误
        criticalErrors: 5, // 5个严重错误
        consecutiveErrors: 20 // 连续20个错误
      },
      ...config
    };

    this.setupErrorListeners();
    this.startStatsCollection();
  }

  /**
   * 初始化错误计数
   */
  private initErrorCount(): Record<ErrorType, number> {
    const counts: Record<ErrorType, number> = {} as Record<ErrorType, number>;
    Object.values(ErrorType).forEach(type => {
      counts[type] = 0;
    });
    return counts;
  }

  /**
   * 初始化严重级别计数
   */
  private initSeverityCount(): Record<ErrorSeverity, number> {
    const counts: Record<ErrorSeverity, number> = {} as Record<ErrorSeverity, number>;
    Object.values(ErrorSeverity).forEach(severity => {
      counts[severity] = 0;
    });
    return counts;
  }

  /**
   * 设置错误监听器
   */
  private setupErrorListeners(): void {
    this.errorHandler.on('error', (error: AppError) => {
      this.recordError(error);
    });

    this.errorHandler.on('critical', (error: AppError) => {
      this.recordError(error);
      this.checkCriticalErrorThreshold();
    });

    this.errorHandler.on('errorThresholdExceeded', (data) => {
      this.emit('alert', {
        type: 'ERROR_THRESHOLD_EXCEEDED',
        message: `Error threshold exceeded for ${data.errorType}: ${data.count} errors in ${data.timeWindow}ms`,
        data
      });
    });
  }

  /**
   * 记录错误
   */
  private recordError(error: AppError): void {
    const now = Date.now();
    
    // 更新总错误数
    this.totalErrors++;
    
    // 更新错误类型计数
    this.errorsByType[error.type] = (this.errorsByType[error.type] || 0) + 1;
    
    // 更新严重级别计数
    this.errorsBySeverity[error.severity] = (this.errorsBySeverity[error.severity] || 0) + 1;
    
    // 记录错误时间戳
    this.errorTimestamps.push(now);
    
    // 清理过期的错误时间戳
    const cutoffTime = now - this.config.errorRateWindowMs;
    this.errorTimestamps = this.errorTimestamps.filter(timestamp => timestamp > cutoffTime);
    
    // 添加到最近错误列表
    this.recentErrors.unshift(error);
    if (this.recentErrors.length > this.config.maxRecentErrors) {
      this.recentErrors = this.recentErrors.slice(0, this.config.maxRecentErrors);
    }
    
    // 更新连续错误计数
    if (now - this.lastErrorTime < 5000) { // 5秒内的错误认为是连续的
      this.consecutiveErrorCount++;
    } else {
      this.consecutiveErrorCount = 1;
    }
    this.lastErrorTime = now;
    
    // 更新峰值错误时间
    if (this.errorTimestamps.length > this.peakErrorCount) {
      this.peakErrorCount = this.errorTimestamps.length;
      this.peakErrorTime = now;
    }
    
    // 检查连续错误阈值
    this.checkConsecutiveErrorThreshold();
    
    // 如果这是第一个错误，记录恢复开始时间
    if (this.consecutiveErrorCount === 1) {
      this.recoveryStartTime = now;
    }
    
    // 发出错误记录事件
    this.emit('errorRecorded', error);
  }

  /**
   * 开始统计收集
   */
  private startStatsCollection(): void {
    this.statsInterval = setInterval(() => {
      const stats = this.getCurrentStats();
      this.emit('stats', stats);
      
      // 检查错误率阈值
      if (this.config.enableAlerts) {
        this.checkErrorRateThreshold(stats.errorRates['1m'] || 0);
      }
      
      // 计算恢复率
      if (this.consecutiveErrorCount === 0 && this.recoveryStartTime > 0) {
        const recoveryTime = Date.now() - this.recoveryStartTime;
        this.emit('recovery', {
          recoveryTime,
          consecutiveErrors: this.consecutiveErrorCount
        });
        this.recoveryStartTime = 0;
      }
    }, this.config.statsIntervalMs);
  }

  /**
   * 检查错误率阈值
   */
  private checkErrorRateThreshold(errorRate: number): void {
    if (errorRate > this.config.alertThresholds.errorRate) {
      this.emit('alert', {
        type: 'HIGH_ERROR_RATE',
        message: `High error rate detected: ${errorRate.toFixed(2)} errors per minute`,
        data: { errorRate, threshold: this.config.alertThresholds.errorRate }
      });
    }
  }

  /**
   * 检查严重错误阈值
   */
  private checkCriticalErrorThreshold(): void {
    const criticalCount = this.errorsBySeverity[ErrorSeverity.CRITICAL] || 0;
    if (criticalCount > this.config.alertThresholds.criticalErrors) {
      this.emit('alert', {
        type: 'HIGH_CRITICAL_ERRORS',
        message: `High number of critical errors detected: ${criticalCount}`,
        data: { criticalCount, threshold: this.config.alertThresholds.criticalErrors }
      });
    }
  }

  /**
   * 检查连续错误阈值
   */
  private checkConsecutiveErrorThreshold(): void {
    if (this.consecutiveErrorCount > this.config.alertThresholds.consecutiveErrors) {
      this.emit('alert', {
        type: 'HIGH_CONSECUTIVE_ERRORS',
        message: `High number of consecutive errors detected: ${this.consecutiveErrorCount}`,
        data: { consecutiveErrors: this.consecutiveErrorCount, threshold: this.config.alertThresholds.consecutiveErrors }
      });
    }
  }

  /**
   * 获取当前统计信息
   */
  public getCurrentStats(): ErrorStats {
    const now = Date.now();
    const windowStart = now - this.config.errorRateWindowMs;
    const recentErrors = this.errorTimestamps.filter(timestamp => timestamp > windowStart);
    const errorRate = (recentErrors.length / this.config.errorRateWindowMs) * 60000; // 每分钟错误数
    
    // 计算top错误类型
    const topErrorTypes = Object.entries(this.errorsByType)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([type, count]) => ({ type: type as string, count }));
    
    // 计算恢复统计
    const recoveryStats = {
      totalAttempts: this.consecutiveErrorCount,
      successfulRecoveries: this.consecutiveErrorCount === 0 ? 1 : 0,
      failedRecoveries: this.consecutiveErrorCount > 0 ? this.consecutiveErrorCount : 0,
      recoveryRate: this.consecutiveErrorCount === 0 ? 1 : 0
    };
    
    // 将AppError转换为ErrorRecord
    const recentErrorRecords: ErrorRecord[] = this.recentErrors.map(error => ({
      id: error.errorId,
      type: error.type,
      message: error.message,
      severity: error.severity,
      timestamp: error.timestamp,
      context: error.context,
      recoverable: error.recoverable,
      retryCount: 0
    }));
    
    return {
      totalErrors: this.totalErrors,
      errorsByType: { ...this.errorsByType },
      errorsBySeverity: { ...this.errorsBySeverity },
      recentErrors: recentErrorRecords,
      errorRates: {
        '1m': errorRate,
        '5m': (this.errorTimestamps.filter(timestamp => timestamp > now - 300000).length / 300000) * 60000,
        '15m': (this.errorTimestamps.filter(timestamp => timestamp > now - 900000).length / 900000) * 60000,
        '1h': (this.errorTimestamps.filter(timestamp => timestamp > now - 3600000).length / 3600000) * 60000
      },
      recoveryStats,
      topErrorTypes,
      timeRange: {
        start: this.errorTimestamps.length > 0 ? Math.min(...this.errorTimestamps) : now,
        end: now
      }
    };
  }

  /**
   * 获取统计信息
   */
  public getStats(): ErrorStats {
    return this.getCurrentStats();
  }

  /**
   * 获取错误趋势数据
   */
  public getErrorTrends(hours: number = 24): Array<{ time: number; errorCount: number; errorRate: number }> {
    const now = Date.now();
    const intervalMs = hours * 60 * 60 * 1000 / 24; // 将时间分为24个区间
    const trends: Array<{ time: number; errorCount: number; errorRate: number }> = [];
    
    for (let i = 0; i < 24; i++) {
      const intervalStart = now - (24 - i) * intervalMs;
      const intervalEnd = intervalStart + intervalMs;
      
      const errorsInInterval = this.errorTimestamps.filter(
        timestamp => timestamp >= intervalStart && timestamp < intervalEnd
      );
      
      const errorRate = (errorsInInterval.length / intervalMs) * 60000;
      
      trends.push({
        time: intervalStart,
        errorCount: errorsInInterval.length,
        errorRate
      });
    }
    
    return trends;
  }

  /**
   * 重置统计信息
   */
  public resetStats(): void {
    this.totalErrors = 0;
    this.errorsByType = this.initErrorCount();
    this.errorsBySeverity = this.initSeverityCount();
    this.recentErrors = [];
    this.errorTimestamps = [];
    this.consecutiveErrorCount = 0;
    this.lastErrorTime = 0;
    this.recoveryStartTime = 0;
    this.peakErrorTime = null;
    this.peakErrorCount = 0;
    
    this.emit('statsReset');
  }

  /**
   * 获取错误详情
   */
  public getErrorDetails(errorType: ErrorType): {
    count: number;
    recentErrors: AppError[];
    averageTimeBetweenErrors: number;
  } {
    const errorsOfType = this.recentErrors.filter(error => error.type === errorType);
    const timestamps = errorsOfType.map(error => error.timestamp).sort((a, b) => a - b);
    
    let averageTimeBetweenErrors = 0;
    if (timestamps.length > 1) {
      const timeDiffs = [];
      for (let i = 1; i < timestamps.length; i++) {
        timeDiffs.push(timestamps[i] - timestamps[i - 1]);
      }
      averageTimeBetweenErrors = timeDiffs.reduce((sum, diff) => sum + diff, 0) / timeDiffs.length;
    }
    
    return {
      count: this.errorsByType[errorType] || 0,
      recentErrors: errorsOfType,
      averageTimeBetweenErrors
    };
  }

  /**
   * 停止监控
   */
  public stop(): void {
    if (this.statsInterval) {
      clearInterval(this.statsInterval);
      this.statsInterval = null;
    }
    this.removeAllListeners();
  }
}

/**
 * 错误报告生成器
 */
export class ErrorReportGenerator {
  /**
   * 生成错误报告
   */
  public static generateReport(stats: ErrorStats): string {
    const report = [];
    
    report.push('=== 错误监控报告 ===');
    report.push(`生成时间: ${new Date().toLocaleString()}`);
    report.push('');
    
    // 总体统计
    report.push('## 总体统计');
    report.push(`总错误数: ${stats.totalErrors}`);
    report.push(`当前错误率: ${(stats.errorRates['1m'] || 0).toFixed(2)} 错误/分钟`);
    report.push(`恢复率: ${(stats.recoveryStats.recoveryRate * 100).toFixed(1)}%`);
    // Removed peak error time reporting as it's not part of ErrorStats interface
    report.push('');
    
    // 按类型统计
    report.push('## 按错误类型统计');
    Object.entries(stats.errorsByType).forEach(([type, count]) => {
      if (count > 0) {
        const percentage = ((count / stats.totalErrors) * 100).toFixed(1);
        report.push(`${type}: ${count} (${percentage}%)`);
      }
    });
    report.push('');
    
    // 按严重级别统计
    report.push('## 按严重级别统计');
    Object.entries(stats.errorsBySeverity).forEach(([severity, count]) => {
      if (count > 0) {
        const percentage = ((count / stats.totalErrors) * 100).toFixed(1);
        report.push(`${severity}: ${count} (${percentage}%)`);
      }
    });
    report.push('');
    
    // Top错误类型
    report.push('## Top 5 错误类型');
    stats.topErrorTypes.forEach(({ type, count }, index) => {
      const percentage = ((count / stats.totalErrors) * 100).toFixed(1);
      report.push(`${index + 1}. ${type}: ${count} (${percentage}%)`);
    });
    report.push('');
    
    // 最近错误
    report.push('## 最近错误 (最多显示5个)');
    stats.recentErrors.slice(0, 5).forEach((error, index) => {
      report.push(`${index + 1}. [${error.severity}] ${error.type}: ${error.message}`);
      report.push(`   时间: ${new Date(error.timestamp).toLocaleString()}`);
      report.push(`   ID: ${error.id}`);
      if (Object.keys(error.context).length > 0) {
        report.push(`   上下文: ${JSON.stringify(error.context)}`);
      }
      report.push('');
    });
    
    return report.join('\n');
  }
  
  /**
   * 生成JSON格式的错误报告
   */
  public static generateJSONReport(stats: ErrorStats): string {
    return JSON.stringify({
      timestamp: Date.now(),
      stats
    }, null, 2);
  }
}

/**
 * 全局错误监控器实例
 */
export let globalErrorMonitor: ErrorMonitor;

/**
 * 初始化全局错误监控器
 */
export function initGlobalErrorMonitor(errorHandler: ErrorHandler, config?: Partial<ErrorMonitorConfig>): void {
  globalErrorMonitor = new ErrorMonitor(errorHandler, config);
}