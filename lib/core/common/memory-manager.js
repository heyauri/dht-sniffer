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
    exports.MemoryManager = void 0;
    const events_1 = require("events");
    const process = require("process");
    class MemoryManager extends events_1.EventEmitter {
        constructor(config = {}) {
            super();
            this.config = Object.assign({ enableMemoryOptimization: true, memoryCleanupThreshold: 1000, enableGarbageCollection: true, maxMemoryUsage: 500 * 1024 * 1024, cleanupInterval: 5 * 60 * 1000 }, config);
            this.cleanupCount = 0;
            this.memoryWarnings = 0;
            this.operationCount = 0;
            if (this.config.enableMemoryOptimization) {
                this.startPeriodicCleanup();
            }
        }
        startPeriodicCleanup() {
            if (this.cleanupInterval) {
                return;
            }
            this.cleanupInterval = setInterval(() => {
                this.performMemoryCleanup();
            }, this.config.cleanupInterval);
        }
        performMemoryCleanup(cleanupType = 'light') {
            try {
                const beforeStats = this.getMemoryStats();
                this.executeCleanupOperations(cleanupType);
                const afterStats = this.getMemoryStats();
                const memoryFreed = beforeStats.heapUsed - afterStats.heapUsed;
                this.cleanupCount++;
                const cleanupEvent = {
                    memoryFreed: Math.max(0, memoryFreed),
                    cleanupType,
                    timestamp: Date.now()
                };
                this.emit('memoryCleanup', cleanupEvent);
            }
            catch (error) {
                this.emit('memoryError', {
                    error: error instanceof Error ? error : new Error(String(error)),
                    operation: 'performMemoryCleanup',
                    timestamp: Date.now()
                });
            }
        }
        executeCleanupOperations(cleanupType) {
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
        performLightCleanup() {
            if (this.config.enableGarbageCollection && global.gc) {
                global.gc();
            }
            this.emit('lightCleanup', {
                timestamp: Date.now()
            });
        }
        performDeepCleanup() {
            if (global.gc) {
                global.gc();
                global.gc();
            }
            this.emit('deepCleanup', {
                timestamp: Date.now()
            });
        }
        performForcedCleanup() {
            if (global.gc) {
                for (let i = 0; i < 3; i++) {
                    global.gc();
                }
            }
            this.emit('forcedCleanup', {
                timestamp: Date.now()
            });
        }
        checkMemoryUsage() {
            const memoryStats = this.getMemoryStats();
            const isOverThreshold = memoryStats.heapUsed > this.config.maxMemoryUsage;
            if (isOverThreshold) {
                this.memoryWarnings++;
                this.emit('memoryWarning', {
                    memoryStats,
                    threshold: this.config.maxMemoryUsage,
                    timestamp: Date.now()
                });
                this.performMemoryCleanup('deep');
            }
            return isOverThreshold;
        }
        getMemoryStats() {
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
        recordOperation() {
            this.operationCount++;
            if (this.operationCount >= this.config.memoryCleanupThreshold) {
                this.performMemoryCleanup('light');
                this.operationCount = 0;
            }
        }
        updateConfig(newConfig) {
            const wasOptimizationEnabled = this.config.enableMemoryOptimization;
            this.config = Object.assign(Object.assign({}, this.config), newConfig);
            if (wasOptimizationEnabled !== this.config.enableMemoryOptimization) {
                if (this.config.enableMemoryOptimization) {
                    this.startPeriodicCleanup();
                }
                else {
                    this.stopPeriodicCleanup();
                }
            }
        }
        stopPeriodicCleanup() {
            if (this.cleanupInterval) {
                clearInterval(this.cleanupInterval);
                this.cleanupInterval = undefined;
            }
        }
        resetStats() {
            this.cleanupCount = 0;
            this.memoryWarnings = 0;
            this.operationCount = 0;
        }
        getMemoryUsagePercentage() {
            const memoryStats = this.getMemoryStats();
            return memoryStats.heapUsagePercentage;
        }
        shouldCleanup() {
            const memoryStats = this.getMemoryStats();
            return (memoryStats.heapUsagePercentage > 80 ||
                this.operationCount >= this.config.memoryCleanupThreshold);
        }
        destroy() {
            this.stopPeriodicCleanup();
            this.removeAllListeners();
            this.resetStats();
        }
    }
    exports.MemoryManager = MemoryManager;
});
