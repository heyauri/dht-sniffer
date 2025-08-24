var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define(["require", "exports", "events", "../errors/error-handler", "../types/error", "./common/retry-manager", "./common/performance-monitor", "./common/memory-manager", "./common/config-validator", "./common/config-mixin", "./common/event-listener-mixin", "./common/error-handling-mixin"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.BaseManager = void 0;
    const events_1 = require("events");
    const error_handler_1 = require("../errors/error-handler");
    const error_1 = require("../types/error");
    const retry_manager_1 = require("./common/retry-manager");
    const performance_monitor_1 = require("./common/performance-monitor");
    const memory_manager_1 = require("./common/memory-manager");
    const config_validator_1 = require("./common/config-validator");
    const config_mixin_1 = require("./common/config-mixin");
    const event_listener_mixin_1 = require("./common/event-listener-mixin");
    const error_handling_mixin_1 = require("./common/error-handling-mixin");
    class BaseManager extends (0, config_mixin_1.withConfigValidation)((0, event_listener_mixin_1.withEventListeners)((0, error_handling_mixin_1.withErrorHandling)(events_1.EventEmitter))) {
        constructor(config, errorHandler) {
            super();
            this.config = this.mergeWithDefaults(config);
            this.validateConfig(this.config);
            this.errorHandler = errorHandler || new error_handler_1.ErrorHandlerImpl();
            this.cleanupInterval = null;
            this.startTime = Date.now();
            this.cleanupCount = 0;
            this.isDestroyed = false;
            this.initializeCommonModules();
            this.setupCommonEventListeners();
            this.startPeriodicCleanup();
        }
        initializeCommonModules() {
            try {
                if (this.config.enableRetry) {
                    this.retryManager = new retry_manager_1.RetryManager(this.config.retryConfig || {});
                    this.retryManager.on('retry', (event) => {
                        var _a, _b;
                        const infoHash = ((_a = event.context) === null || _a === void 0 ? void 0 : _a.infoHash) || null;
                        const peer = ((_b = event.context) === null || _b === void 0 ? void 0 : _b.peer) || null;
                        const enhancedEvent = Object.assign(Object.assign(Object.assign({ manager: this.getManagerName() }, event), (infoHash && { infoHash })), (peer && { peer }));
                        this.emit('retry', enhancedEvent);
                    });
                }
                if (this.config.enablePerformanceMonitoring) {
                    this.performanceMonitor = new performance_monitor_1.PerformanceMonitor(this.config.performanceConfig || {});
                    this.performanceMonitor.on('performanceWarning', (event) => {
                        this.emit('performanceWarning', Object.assign({ manager: this.getManagerName() }, event));
                    });
                }
                if (this.config.enableMemoryMonitoring) {
                    this.memoryManager = new memory_manager_1.MemoryManager(this.config.memoryConfig || {});
                    this.memoryManager.on('memoryCleanup', (event) => {
                        this.emit('memoryCleanup', Object.assign({ manager: this.getManagerName() }, event));
                    });
                }
                this.configValidator = new config_validator_1.ConfigValidator();
            }
            catch (error) {
                this.handleError('initializeCommonModules', error);
            }
        }
        setupCommonEventListeners() {
            const managerName = this.getManagerName();
            this.setupBatchEventListeners([
                event_listener_mixin_1.EventListenerFactory.createErrorListener(this.errorHandler, managerName),
                event_listener_mixin_1.EventListenerFactory.createWarningListener(this.errorHandler, managerName),
                event_listener_mixin_1.EventListenerFactory.createPerformanceWarningListener(this.errorHandler, managerName),
                event_listener_mixin_1.EventListenerFactory.createMemoryCleanupListener(this.errorHandler, managerName),
                event_listener_mixin_1.EventListenerFactory.createRetryListener(this.errorHandler, managerName)
            ]);
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
            super.handleError(operation, error, Object.assign({ manager: this.getManagerName() }, context), errorType);
        }
        handleWarning(operation, message, context) {
            super.handleWarning(operation, message, Object.assign({ manager: this.getManagerName() }, context));
        }
        handleCriticalError(operation, error, context) {
            super.handleCriticalError(operation, error, Object.assign({ manager: this.getManagerName() }, context));
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
        executeWithRetry(operation, operationName, context) {
            return __awaiter(this, void 0, void 0, function* () {
                if (!this.retryManager || !this.config.enableRetry) {
                    return operation();
                }
                return this.retryManager.executeWithRetry(operation, operationName, context);
            });
        }
        addPerformanceMetric(name, value) {
            if (this.performanceMonitor && this.config.enablePerformanceMonitoring) {
                this.performanceMonitor.setCustomMetric(name, value);
            }
        }
        performMemoryCleanup() {
            if (this.memoryManager && this.config.enableMemoryMonitoring) {
                this.memoryManager.performMemoryCleanup();
            }
        }
        validateConfiguration(config, rules) {
            if (this.configValidator) {
                this.configValidator.addRules(this.getManagerName(), rules);
                this.configValidator.validate(this.getManagerName(), config);
            }
        }
        destroy() {
            if (this.isDestroyed) {
                return;
            }
            try {
                this.isDestroyed = true;
                this.stopPeriodicCleanup();
                this.destroyCommonModules();
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
        destroyCommonModules() {
            try {
                if (this.performanceMonitor) {
                    this.performanceMonitor.destroy();
                }
                if (this.retryManager) {
                    this.retryManager.removeAllListeners();
                }
                if (this.memoryManager) {
                    this.memoryManager.removeAllListeners();
                }
                if (this.configValidator) {
                }
            }
            catch (error) {
                this.handleError('destroyCommonModules', error);
            }
        }
    }
    exports.BaseManager = BaseManager;
});
