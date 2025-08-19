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
        define(["require", "exports", "events", "../types/error", "fs", "path"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.ConfigManager = exports.ConfigManagerImpl = void 0;
    const events_1 = require("events");
    const error_1 = require("../types/error");
    const fs = require("fs");
    const path = require("path");
    class ConfigManagerImpl extends events_1.EventEmitter {
        constructor(config) {
            super();
            this.config = config;
        }
        static getInstance(config) {
            if (!ConfigManagerImpl.instance) {
                if (!config) {
                    throw new error_1.ConfigError('Initial config is required for first instantiation');
                }
                ConfigManagerImpl.instance = new ConfigManagerImpl(config);
            }
            return ConfigManagerImpl.instance;
        }
        get(key) {
            return this.config[key];
        }
        set(key, value) {
            const oldValue = this.config[key];
            this.config[key] = value;
            this.emit('change', key, value);
        }
        has(key) {
            return this.config[key] !== undefined;
        }
        getAll() {
            return Object.assign({}, this.config);
        }
        loadFromFile(filePath) {
            return __awaiter(this, void 0, void 0, function* () {
                try {
                    const content = yield fs.promises.readFile(filePath, 'utf-8');
                    const loadedConfig = JSON.parse(content);
                    this.config = Object.assign(Object.assign({}, this.config), loadedConfig);
                }
                catch (error) {
                    throw new error_1.ConfigError(`Failed to load config from ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
                }
            });
        }
        saveToFile(filePath) {
            return __awaiter(this, void 0, void 0, function* () {
                try {
                    const dir = path.dirname(filePath);
                    yield fs.promises.mkdir(dir, { recursive: true });
                    yield fs.promises.writeFile(filePath, JSON.stringify(this.config, null, 2));
                }
                catch (error) {
                    throw new error_1.ConfigError(`Failed to save config to ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
                }
            });
        }
        validate() {
            if (!this.config.dht || typeof this.config.dht.port !== 'number') {
                return false;
            }
            if (!this.config.cache || typeof this.config.cache.maxSize !== 'number') {
                return false;
            }
            if (!this.config.metadata || typeof this.config.metadata.maximumParallelFetchingTorrent !== 'number') {
                return false;
            }
            return true;
        }
        reset() {
            this.config = this.getDefaultConfig();
        }
        getDefaultConfig() {
            return {
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
                    level: 'INFO',
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
        }
    }
    exports.ConfigManagerImpl = ConfigManagerImpl;
    exports.ConfigManager = ConfigManagerImpl;
});
