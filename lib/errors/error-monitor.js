(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define(["require", "exports", "events", "../types/error"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.initGlobalErrorMonitor = exports.globalErrorMonitor = exports.ErrorReportGenerator = exports.ErrorMonitor = void 0;
    const events_1 = require("events");
    const error_1 = require("../types/error");
    class ErrorMonitor extends events_1.EventEmitter {
        constructor(errorHandler, config = {}) {
            super();
            this.statsInterval = null;
            this.errorTimestamps = [];
            this.consecutiveErrorCount = 0;
            this.lastErrorTime = 0;
            this.recoveryStartTime = 0;
            this.totalErrors = 0;
            this.errorsByType = this.initErrorCount();
            this.errorsBySeverity = this.initSeverityCount();
            this.recentErrors = [];
            this.peakErrorCount = 0;
            this.errorHandler = errorHandler;
            this.config = Object.assign({ statsIntervalMs: 60000, maxRecentErrors: 100, errorRateWindowMs: 300000, enableAlerts: true, alertThresholds: {
                    errorRate: 10,
                    criticalErrors: 5,
                    consecutiveErrors: 20
                } }, config);
            this.setupErrorListeners();
            this.startStatsCollection();
        }
        initErrorCount() {
            const counts = {};
            Object.values(error_1.ErrorType).forEach(type => {
                counts[type] = 0;
            });
            return counts;
        }
        initSeverityCount() {
            const counts = {};
            Object.values(error_1.ErrorSeverity).forEach(severity => {
                counts[severity] = 0;
            });
            return counts;
        }
        setupErrorListeners() {
            this.errorHandler.on('error', (error) => {
                this.recordError(error);
            });
            this.errorHandler.on('critical', (error) => {
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
        recordError(error) {
            const now = Date.now();
            this.totalErrors++;
            this.errorsByType[error.type] = (this.errorsByType[error.type] || 0) + 1;
            this.errorsBySeverity[error.severity] = (this.errorsBySeverity[error.severity] || 0) + 1;
            this.errorTimestamps.push(now);
            const cutoffTime = now - this.config.errorRateWindowMs;
            this.errorTimestamps = this.errorTimestamps.filter(timestamp => timestamp > cutoffTime);
            this.recentErrors.unshift(error);
            if (this.recentErrors.length > this.config.maxRecentErrors) {
                this.recentErrors = this.recentErrors.slice(0, this.config.maxRecentErrors);
            }
            if (now - this.lastErrorTime < 5000) {
                this.consecutiveErrorCount++;
            }
            else {
                this.consecutiveErrorCount = 1;
            }
            this.lastErrorTime = now;
            if (this.errorTimestamps.length > this.peakErrorCount) {
                this.peakErrorCount = this.errorTimestamps.length;
            }
            this.checkConsecutiveErrorThreshold();
            if (this.consecutiveErrorCount === 1) {
                this.recoveryStartTime = now;
            }
            this.emit('errorRecorded', error);
        }
        startStatsCollection() {
            this.statsInterval = setInterval(() => {
                const stats = this.getCurrentStats();
                this.emit('stats', stats);
                if (this.config.enableAlerts) {
                    this.checkErrorRateThreshold(stats.errorRates['1m'] || 0);
                }
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
        checkErrorRateThreshold(errorRate) {
            if (errorRate > this.config.alertThresholds.errorRate) {
                this.emit('alert', {
                    type: 'HIGH_ERROR_RATE',
                    message: `High error rate detected: ${errorRate.toFixed(2)} errors per minute`,
                    data: { errorRate, threshold: this.config.alertThresholds.errorRate }
                });
            }
        }
        checkCriticalErrorThreshold() {
            const criticalCount = this.errorsBySeverity[error_1.ErrorSeverity.CRITICAL] || 0;
            if (criticalCount > this.config.alertThresholds.criticalErrors) {
                this.emit('alert', {
                    type: 'HIGH_CRITICAL_ERRORS',
                    message: `High number of critical errors detected: ${criticalCount}`,
                    data: { criticalCount, threshold: this.config.alertThresholds.criticalErrors }
                });
            }
        }
        checkConsecutiveErrorThreshold() {
            if (this.consecutiveErrorCount > this.config.alertThresholds.consecutiveErrors) {
                this.emit('alert', {
                    type: 'HIGH_CONSECUTIVE_ERRORS',
                    message: `High number of consecutive errors detected: ${this.consecutiveErrorCount}`,
                    data: { consecutiveErrors: this.consecutiveErrorCount, threshold: this.config.alertThresholds.consecutiveErrors }
                });
            }
        }
        getCurrentStats() {
            const now = Date.now();
            const windowStart = now - this.config.errorRateWindowMs;
            const recentErrors = this.errorTimestamps.filter(timestamp => timestamp > windowStart);
            const errorRate = (recentErrors.length / this.config.errorRateWindowMs) * 60000;
            const topErrorTypes = Object.entries(this.errorsByType)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 5)
                .map(([type, count]) => ({ type: type, count }));
            const recoveryStats = {
                totalAttempts: this.consecutiveErrorCount,
                successfulRecoveries: this.consecutiveErrorCount === 0 ? 1 : 0,
                failedRecoveries: this.consecutiveErrorCount > 0 ? this.consecutiveErrorCount : 0,
                recoveryRate: this.consecutiveErrorCount === 0 ? 1 : 0
            };
            const recentErrorRecords = this.recentErrors.map(error => ({
                id: error.errorId || '',
                type: error.type,
                message: error.message,
                severity: error.severity,
                timestamp: error.timestamp || Date.now(),
                context: error.context,
                recoverable: error.recoverable,
                retryCount: 0
            }));
            return {
                totalErrors: this.totalErrors,
                errorsByType: Object.assign({}, this.errorsByType),
                errorsBySeverity: Object.assign({}, this.errorsBySeverity),
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
                },
                lastError: this.recentErrors.length > 0 ? this.recentErrors[this.recentErrors.length - 1] : null,
                firstError: this.recentErrors.length > 0 ? this.recentErrors[0] : null
            };
        }
        getStats() {
            return this.getCurrentStats();
        }
        getErrorTrends(hours = 24) {
            const now = Date.now();
            const intervalMs = hours * 60 * 60 * 1000 / 24;
            const trends = [];
            for (let i = 0; i < 24; i++) {
                const intervalStart = now - (24 - i) * intervalMs;
                const intervalEnd = intervalStart + intervalMs;
                const errorsInInterval = this.errorTimestamps.filter(timestamp => timestamp >= intervalStart && timestamp < intervalEnd);
                const errorRate = (errorsInInterval.length / intervalMs) * 60000;
                trends.push({
                    time: intervalStart,
                    errorCount: errorsInInterval.length,
                    errorRate
                });
            }
            return trends;
        }
        resetStats() {
            this.totalErrors = 0;
            this.errorsByType = this.initErrorCount();
            this.errorsBySeverity = this.initSeverityCount();
            this.recentErrors = [];
            this.errorTimestamps = [];
            this.consecutiveErrorCount = 0;
            this.lastErrorTime = 0;
            this.recoveryStartTime = 0;
            this.peakErrorCount = 0;
            this.emit('statsReset');
        }
        getErrorDetails(errorType) {
            const errorsOfType = this.recentErrors.filter(error => error.type === errorType);
            const timestamps = errorsOfType.map(error => error.timestamp || Date.now()).sort((a, b) => a - b);
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
        stop() {
            if (this.statsInterval) {
                clearInterval(this.statsInterval);
                this.statsInterval = null;
            }
            this.removeAllListeners();
        }
    }
    exports.ErrorMonitor = ErrorMonitor;
    class ErrorReportGenerator {
        static generateReport(stats) {
            const report = [];
            report.push('=== 错误监控报告 ===');
            report.push(`生成时间: ${new Date().toLocaleString()}`);
            report.push('');
            report.push('## 总体统计');
            report.push(`总错误数: ${stats.totalErrors}`);
            report.push(`当前错误率: ${(stats.errorRates['1m'] || 0).toFixed(2)} 错误/分钟`);
            report.push(`恢复率: ${(stats.recoveryStats.recoveryRate * 100).toFixed(1)}%`);
            report.push('');
            report.push('## 按错误类型统计');
            Object.entries(stats.errorsByType).forEach(([type, count]) => {
                if (count > 0) {
                    const percentage = ((count / stats.totalErrors) * 100).toFixed(1);
                    report.push(`${type}: ${count} (${percentage}%)`);
                }
            });
            report.push('');
            report.push('## 按严重级别统计');
            Object.entries(stats.errorsBySeverity).forEach(([severity, count]) => {
                if (count > 0) {
                    const percentage = ((count / stats.totalErrors) * 100).toFixed(1);
                    report.push(`${severity}: ${count} (${percentage}%)`);
                }
            });
            report.push('');
            report.push('## Top 5 错误类型');
            stats.topErrorTypes.forEach(({ type, count }, index) => {
                const percentage = ((count / stats.totalErrors) * 100).toFixed(1);
                report.push(`${index + 1}. ${type}: ${count} (${percentage}%)`);
            });
            report.push('');
            report.push('## 最近错误 (最多显示5个)');
            stats.recentErrors.slice(0, 5).forEach((error, index) => {
                report.push(`${index + 1}. [${error.severity}] ${error.type}: ${error.message}`);
                report.push(`   时间: ${new Date(error.timestamp).toLocaleString()}`);
                report.push(`   ID: ${error.errorId}`);
                if (Object.keys(error.context).length > 0) {
                    report.push(`   上下文: ${JSON.stringify(error.context)}`);
                }
                report.push('');
            });
            return report.join('\n');
        }
        static generateJSONReport(stats) {
            return JSON.stringify({
                timestamp: Date.now(),
                stats
            }, null, 2);
        }
    }
    exports.ErrorReportGenerator = ErrorReportGenerator;
    function initGlobalErrorMonitor(errorHandler, config) {
        exports.globalErrorMonitor = new ErrorMonitor(errorHandler, config);
    }
    exports.initGlobalErrorMonitor = initGlobalErrorMonitor;
});
