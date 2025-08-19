(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define(["require", "exports", "events", "../errors/error-handler", "../types/error"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.BaseManager = void 0;
    const events_1 = require("events");
    const error_handler_1 = require("../errors/error-handler");
    const error_1 = require("../types/error");
    class BaseManager extends events_1.EventEmitter {
        constructor(config, errorHandler) {
            super();
            this.config = Object.assign({ enableErrorHandling: true, enableMemoryMonitoring: true, cleanupInterval: 5 * 60 * 1000, memoryThreshold: 100 * 1024 * 1024 }, config);
            this.errorHandler = errorHandler || new error_handler_1.ErrorHandlerImpl();
            this.cleanupInterval = null;
            this.startTime = Date.now();
            this.cleanupCount = 0;
            this.isDestroyed = false;
            this.startPeriodicCleanup();
        }
        validateConfig(config) {
            if (!config) {
                throw new Error(`${this.getManagerName()} config is required`);
            }
            if (config.cleanupInterval !== undefined && (typeof config.cleanupInterval !== 'number' || config.cleanupInterval <= 0)) {
                throw new Error('cleanupInterval must be a positive number');
            }
            if (config.memoryThreshold !== undefined && (typeof config.memoryThreshold !== 'number' || config.memoryThreshold <= 0)) {
                throw new Error('memoryThreshold must be a positive number');
            }
        }
        getStats() {
            return {
                uptime: Date.now() - this.startTime,
                memoryUsage: this.getMemoryUsage(),
                lastCleanupTime: this.startTime + (this.cleanupCount * (this.config.cleanupInterval || 0)),
                cleanupCount: this.cleanupCount
            };
        }
        getMemoryUsage() {
            if (!this.config.enableMemoryMonitoring) {
                return undefined;
            }
            return process.memoryUsage();
        }
        handleError(operation, error, context, errorType = error_1.ErrorType.SYSTEM) {
            if (!this.config.enableErrorHandling) {
                return;
            }
            const processedError = error instanceof Error ? error : new Error(String(error));
            this.errorHandler.handleError(processedError, Object.assign(Object.assign({ manager: this.getManagerName(), operation }, context), { errorType }));
            this.emit('error', {
                manager: this.getManagerName(),
                operation,
                error: processedError,
                context
            });
        }
        startPeriodicCleanup() {
            if (!this.config.cleanupInterval) {
                return;
            }
            try {
                this.cleanupInterval = setInterval(() => {
                    this.executeCleanup();
                }, this.config.cleanupInterval);
            }
            catch (error) {
                this.handleError('startPeriodicCleanup', error);
            }
        }
        executeCleanup() {
            try {
                this.performCleanup();
                this.cleanupCount++;
                if (this.config.enableMemoryMonitoring) {
                    this.checkMemoryUsage();
                }
                this.emit('cleanupCompleted', {
                    manager: this.getManagerName(),
                    cleanupCount: this.cleanupCount,
                    timestamp: Date.now()
                });
            }
            catch (error) {
                this.handleError('executeCleanup', error);
            }
        }
        checkMemoryUsage() {
            try {
                const memoryUsage = this.getMemoryUsage();
                if (!memoryUsage)
                    return;
                const threshold = this.config.memoryThreshold || 100 * 1024 * 1024;
                if (memoryUsage.heapUsed > threshold) {
                    this.emit('memoryWarning', {
                        manager: this.getManagerName(),
                        memoryUsage,
                        threshold
                    });
                    this.performDeepCleanup();
                }
            }
            catch (error) {
                this.handleError('checkMemoryUsage', error);
            }
        }
        performDeepCleanup() {
            try {
                if (global.gc) {
                    global.gc();
                }
                this.emit('deepCleanupCompleted', {
                    manager: this.getManagerName(),
                    timestamp: Date.now()
                });
            }
            catch (error) {
                this.handleError('performDeepCleanup', error);
            }
        }
        stopPeriodicCleanup() {
            try {
                if (this.cleanupInterval) {
                    clearInterval(this.cleanupInterval);
                    this.cleanupInterval = null;
                }
            }
            catch (error) {
                this.handleError('stopPeriodicCleanup', error);
            }
        }
        clear() {
            try {
                this.clearData();
                this.emit('dataCleared', {
                    manager: this.getManagerName(),
                    timestamp: Date.now()
                });
            }
            catch (error) {
                this.handleError('clear', error);
            }
        }
        destroy() {
            if (this.isDestroyed) {
                return;
            }
            try {
                this.isDestroyed = true;
                this.stopPeriodicCleanup();
                this.clear();
                this.removeAllListeners();
                this.emit('destroyed', {
                    manager: this.getManagerName(),
                    timestamp: Date.now()
                });
            }
            catch (error) {
                this.handleError('destroy', error);
            }
        }
    }
    exports.BaseManager = BaseManager;
});
