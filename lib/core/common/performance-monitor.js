(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define(["require", "exports", "events", "process"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.PerformanceMonitor = void 0;
    const events_1 = require("events");
    const process = require("process");
    class PerformanceMonitor extends events_1.EventEmitter {
        constructor(config = {}) {
            super();
            this.config = Object.assign({ enablePerformanceMonitoring: true, monitoringInterval: 30000, enableMemoryMonitoring: true, memoryThreshold: 100 * 1024 * 1024 }, config);
            this.startTime = Date.now();
            this.monitoringCount = 0;
            this.customMetrics = {};
            this.customThresholds = {};
            if (this.config.enablePerformanceMonitoring) {
                this.startMonitoring();
            }
        }
        startMonitoring() {
            if (this.monitoringInterval) {
                return;
            }
            this.monitoringInterval = setInterval(() => {
                this.performMonitoring();
            }, this.config.monitoringInterval);
        }
        performMonitoring() {
            try {
                this.monitoringCount++;
                const stats = this.getPerformanceStats();
                if (this.config.enableMemoryMonitoring && stats.memoryUsage) {
                    this.checkMemoryUsage(stats.memoryUsage);
                }
                this.checkCustomMetrics();
                this.emit('performanceStats', stats);
            }
            catch (error) {
                this.emit('monitoringError', {
                    error: error instanceof Error ? error : new Error(String(error)),
                    timestamp: Date.now()
                });
            }
        }
        checkMemoryUsage(memoryUsage) {
            if (!memoryUsage)
                return;
            const threshold = this.config.memoryThreshold;
            if (memoryUsage.heapUsed > threshold) {
                const warningEvent = {
                    type: 'memory',
                    metric: 'heapUsed',
                    value: memoryUsage.heapUsed,
                    threshold,
                    timestamp: Date.now()
                };
                this.emit('performanceWarning', warningEvent);
                this.emit('memoryCleanupRequired', {
                    memoryUsage,
                    threshold,
                    timestamp: Date.now()
                });
            }
        }
        checkCustomMetrics() {
            Object.keys(this.customMetrics).forEach(metric => {
                const value = this.customMetrics[metric];
                const threshold = this.customThresholds[metric];
                if (threshold && value > threshold) {
                    const warningEvent = {
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
        getPerformanceStats() {
            return {
                uptime: Date.now() - this.startTime,
                memoryUsage: this.getMemoryUsage(),
                lastMonitoringTime: Date.now(),
                monitoringCount: this.monitoringCount,
                customMetrics: Object.assign({}, this.customMetrics)
            };
        }
        getMemoryUsage() {
            if (!this.config.enableMemoryMonitoring) {
                return undefined;
            }
            return process.memoryUsage();
        }
        setCustomMetric(name, value) {
            this.customMetrics[name] = value;
        }
        incrementCustomMetric(name, increment = 1) {
            this.customMetrics[name] = (this.customMetrics[name] || 0) + increment;
        }
        setCustomThreshold(name, threshold) {
            this.customThresholds[name] = threshold;
        }
        getCustomMetric(name) {
            return this.customMetrics[name];
        }
        updateConfig(newConfig) {
            const wasMonitoring = this.config.enablePerformanceMonitoring;
            this.config = Object.assign(Object.assign({}, this.config), newConfig);
            if (wasMonitoring !== this.config.enablePerformanceMonitoring) {
                if (this.config.enablePerformanceMonitoring) {
                    this.startMonitoring();
                }
                else {
                    this.stopMonitoring();
                }
            }
        }
        stopMonitoring() {
            if (this.monitoringInterval) {
                clearInterval(this.monitoringInterval);
                this.monitoringInterval = undefined;
            }
        }
        resetStats() {
            this.startTime = Date.now();
            this.monitoringCount = 0;
            this.customMetrics = {};
        }
        forceMonitoring() {
            this.performMonitoring();
        }
        destroy() {
            this.stopMonitoring();
            this.removeAllListeners();
            this.customMetrics = {};
            this.customThresholds = {};
        }
    }
    exports.PerformanceMonitor = PerformanceMonitor;
});
