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
        define(["require", "exports", "./index"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.usageExample = exports.ExampleManager = void 0;
    const index_1 = require("./index");
    class ExampleManager {
        constructor(config) {
            this.modules = (0, index_1.createCommonModules)(config);
            this.setupEventListeners();
        }
        setupEventListeners() {
            this.modules.retryManager.on('retry', (event) => {
                console.log(`重试事件: ${event.operation} - 尝试 ${event.attempt}/${event.maxAttempts}`);
            });
            this.modules.performanceMonitor.on('performanceWarning', (warning) => {
                console.warn(`性能警告: ${warning.type} - ${warning.metric} = ${warning.value}`);
            });
            this.modules.memoryManager.on('memoryCleanup', (cleanup) => {
                console.log(`内存清理: ${cleanup.cleanupType} - 释放 ${cleanup.memoryFreed} bytes`);
            });
        }
        executeWithRetry(operation, operationKey) {
            return __awaiter(this, void 0, void 0, function* () {
                return this.modules.retryManager.executeWithRetry(operation, operationKey);
            });
        }
        recordPerformanceMetric(name, value) {
            this.modules.performanceMonitor.setCustomMetric(name, value);
        }
        performMemoryCleanup() {
            this.modules.memoryManager.performMemoryCleanup();
        }
        validateConfig(configType, config) {
            return this.modules.configValidator.validate(configType, config);
        }
        getStats() {
            return {
                retry: this.modules.retryManager.getRetryStats(),
                performance: this.modules.performanceMonitor.getPerformanceStats(),
                memory: this.modules.memoryManager.getMemoryStats()
            };
        }
        destroy() {
            this.modules.retryManager.destroy();
            this.modules.performanceMonitor.destroy();
            this.modules.memoryManager.destroy();
        }
    }
    exports.ExampleManager = ExampleManager;
    function usageExample() {
        const config = {
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
        const manager = new ExampleManager(config);
        manager.executeWithRetry(() => __awaiter(this, void 0, void 0, function* () {
            if (Math.random() > 0.7) {
                throw new Error('随机失败');
            }
            return '操作成功';
        }), 'example-operation').then(result => {
            console.log('操作结果:', result);
        }).catch(error => {
            console.error('操作失败:', error.message);
        });
        manager.recordPerformanceMetric('operations_per_second', 100);
        const testConfig = {
            port: 8080,
            maxNodes: 1000,
            refreshInterval: 5000
        };
        const isValid = manager.validateConfig('DHTManager', testConfig);
        console.log('配置验证结果:', isValid);
        console.log('统计信息:', manager.getStats());
        setTimeout(() => {
            manager.destroy();
        }, 5000);
    }
    exports.usageExample = usageExample;
    if (require.main === module) {
        usageExample();
    }
});
