(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define(["require", "exports", "../types/config", "./config-manager"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.LogLevel = exports.ConfigManager = exports.config = void 0;
    const config_1 = require("../types/config");
    Object.defineProperty(exports, "LogLevel", { enumerable: true, get: function () { return config_1.LogLevel; } });
    const config_manager_1 = require("./config-manager");
    Object.defineProperty(exports, "ConfigManager", { enumerable: true, get: function () { return config_manager_1.ConfigManager; } });
    const defaultConfig = {
        dht: {
            port: 6881,
            bootstrap: true,
            nodesMaxSize: 1000,
            refreshPeriod: 300000,
            announcePeriod: 1800000,
            enableMemoryMonitoring: true,
            memoryThreshold: 100 * 1024 * 1024,
            cleanupInterval: 5 * 60 * 1000,
            maxRetries: 3,
            retryDelay: 1000
        },
        metadata: {
            maximumParallelFetchingTorrent: 5,
            maximumWaitingQueueSize: 1000,
            downloadMaxTime: 300000,
            ignoreFetched: true,
            aggressiveLevel: 1,
            enableRetry: true,
            maxRetries: 3,
            retryDelay: 1000,
            retryBackoffFactor: 2,
            enablePerformanceMonitoring: true,
            performanceMonitoringInterval: 30000,
            maxConcurrentRequests: 50,
            requestTimeout: 30000,
            enableMemoryOptimization: true,
            memoryCleanupThreshold: 1000
        },
        cache: {
            maxSize: 1000,
            ttl: 3600000,
            checkPeriod: 60000,
            enableStats: true,
            enableCompression: false,
            compressionThreshold: 1024,
            enablePersistence: false,
            persistencePath: './cache',
            persistenceInterval: 300000,
            enableMemoryMonitoring: true,
            memoryThreshold: 50 * 1024 * 1024,
            cleanupInterval: 5 * 60 * 1000
        },
        peer: {
            maxNodes: 1000,
            nodeRefreshTime: 300000,
            findNodeProbability: 0.1,
            enableMemoryMonitoring: true,
            memoryThreshold: 100 * 1024 * 1024,
            cleanupInterval: 5 * 60 * 1000,
            maxNodeAge: 24 * 60 * 60 * 1000
        },
        logger: {
            level: config_1.LogLevel.INFO,
            enableConsole: true,
            enableFile: false,
            filePath: './logs/app.log'
        },
        error: {
            enableErrorHandling: true,
            enableErrorReporting: true,
            enableErrorTracking: true,
            maxErrorHistory: 1000,
            errorReportingInterval: 300000,
            enableAutomaticRecovery: true,
            recoveryMaxRetries: 3,
            recoveryDelay: 1000
        }
    };
    exports.config = config_manager_1.ConfigManager.getInstance(defaultConfig);
});
