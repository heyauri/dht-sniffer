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
        define(["require", "exports", "../metadata/metadata-helper", "../types/error", "./base-manager", "process"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.MetadataManager = void 0;
    const metadataHelper = require("../metadata/metadata-helper");
    const error_1 = require("../types/error");
    const base_manager_1 = require("./base-manager");
    const process = require("process");
    class MetadataManager extends base_manager_1.BaseManager {
        constructor(config, errorHandler, cacheManager) {
            super(config, errorHandler);
            this.validateConfig(config);
            this.config = Object.assign({
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
            }, config);
            this.cacheManager = cacheManager;
            this.metadataWaitingQueues = [];
            this.metadataFetchingDict = {};
            this.retryCount = {};
            const aggressiveLevel = this.config.aggressiveLevel;
            this.aggressiveLimit = aggressiveLevel && aggressiveLevel > 0
                ? aggressiveLevel * this.config.maximumParallelFetchingTorrent
                : 0;
            this.startTime = Date.now();
            this.totalFetchCount = 0;
            this.successFetchCount = 0;
            this.failedFetchCount = 0;
            if (this.config.enablePerformanceMonitoring) {
                this.startPerformanceMonitoring();
            }
        }
        addQueuingMetadata(infoHash, peer, reverse = false) {
            const arr = this.metadataWaitingQueues;
            const infoHashStr = infoHash.toString('hex');
            const obj = { infoHash, peer, infoHashStr };
            reverse ? arr.unshift(obj) : arr.push(obj);
            if (this.config.maximumWaitingQueueSize > 0 && arr.length > this.config.maximumWaitingQueueSize) {
                arr.shift();
            }
            this.dispatchMetadata();
            this.boostMetadataFetching();
        }
        dispatchMetadata() {
            const fetchings = Object.keys(this.metadataFetchingDict);
            if (fetchings.length >= this.config.maximumParallelFetchingTorrent) {
                return;
            }
            const nextFetching = this.metadataWaitingQueues.pop();
            if (!nextFetching)
                return;
            const { infoHash, infoHashStr, peer } = nextFetching;
            const nextFetchingKey = this.getNextFetchingKey(nextFetching);
            if (Reflect.has(this.metadataFetchingDict, infoHashStr)) {
                if (this.aggressiveLimit > 0 && this.aggressiveLimit > fetchings.length) {
                }
                else {
                    this.metadataWaitingQueues.unshift(nextFetching);
                    const metadataFetchingCache = this.cacheManager.getMetadataFetchingCache();
                    if (!metadataFetchingCache.get(infoHashStr)) {
                        metadataFetchingCache.set(infoHashStr, 1);
                        this.dispatchMetadata();
                    }
                    return;
                }
            }
            const fetchedTuple = this.cacheManager.getFetchedTuple();
            const fetchedInfohash = this.cacheManager.getFetchedInfoHash();
            if (this.config.ignoreFetched && fetchedTuple.get(nextFetchingKey)) {
                this.cacheManager.incrementFetchedTupleHit();
                this.dispatchMetadata();
                return;
            }
            if (this.config.ignoreFetched && fetchedInfohash.get(infoHashStr)) {
                this.cacheManager.incrementFetchedInfoHashHit();
                this.dispatchMetadata();
                return;
            }
            if (!this.metadataFetchingDict[infoHashStr]) {
                this.metadataFetchingDict[infoHashStr] = 1;
            }
            else if (this.aggressiveLimit > 0) {
                this.metadataFetchingDict[infoHashStr] += 1;
            }
            fetchedTuple.set(nextFetchingKey, 1);
            this.fetchMetadata(infoHash, peer, infoHashStr);
        }
        fetchMetadata(infoHash, peer, infoHashStr) {
            return __awaiter(this, void 0, void 0, function* () {
                if (this.isDestroyed)
                    return;
                this.totalFetchCount++;
                const fetchStartTime = Date.now();
                try {
                    const metadata = yield this.executeWithRetry(() => metadataHelper.fetch({ infoHash, peer }, this.config), infoHashStr, peer);
                    if (metadata === undefined)
                        return;
                    this.successFetchCount++;
                    this.emit('metadata', { infoHash, metadata });
                    const fetchedInfohash = this.cacheManager.getFetchedInfoHash();
                    const usefulPeers = this.cacheManager.getUsefulPeers();
                    fetchedInfohash.set(infoHashStr, 1);
                    usefulPeers.set(`${peer.host}:${peer.port}`, peer);
                    if (this.config.ignoreFetched) {
                        this.removeDuplicatedWaitingObjects(infoHashStr);
                    }
                    delete this.retryCount[infoHashStr];
                    const fetchTime = Date.now() - fetchStartTime;
                    this.emit('fetchSuccess', {
                        infoHash: infoHashStr,
                        peer: { host: peer.host, port: peer.port },
                        fetchTime,
                        retryCount: this.retryCount[infoHashStr] || 0
                    });
                }
                catch (error) {
                    this.failedFetchCount++;
                    let processedError;
                    if (error instanceof error_1.NetworkError || error instanceof error_1.TimeoutError || error instanceof error_1.MetadataError) {
                        processedError = error;
                    }
                    else {
                        processedError = new error_1.MetadataError(`Metadata fetch failed for ${infoHashStr}: ${error.message || error}`, {
                            operation: 'metadata_fetch',
                            infoHash: infoHashStr,
                            peer: { host: peer.host, port: peer.port },
                            cause: error instanceof Error ? error : new Error(String(error))
                        }, false);
                    }
                    this.handleError('fetchMetadata', processedError);
                    this.emit('metadataError', { infoHash, error: processedError });
                    const fetchTime = Date.now() - fetchStartTime;
                    this.emit('fetchFailed', {
                        infoHash: infoHashStr,
                        peer: { host: peer.host, port: peer.port },
                        fetchTime,
                        error: processedError.message,
                        retryCount: this.retryCount[infoHashStr] || 0
                    });
                }
                finally {
                    this.dispatchMetadata();
                    if (this.metadataFetchingDict[infoHashStr] && this.metadataFetchingDict[infoHashStr] > 1) {
                        this.metadataFetchingDict[infoHashStr] -= 1;
                    }
                    else {
                        Reflect.deleteProperty(this.metadataFetchingDict, infoHashStr);
                    }
                    const metadataFetchingCache = this.cacheManager.getMetadataFetchingCache();
                    metadataFetchingCache.delete(infoHashStr);
                    if (this.config.enableMemoryOptimization && this.totalFetchCount % this.config.memoryCleanupThreshold === 0) {
                        this.performMemoryCleanup();
                    }
                }
                this.dispatchMetadata();
            });
        }
        boostMetadataFetching() {
            let counter;
            while (true) {
                if (this.metadataWaitingQueues.length === 0)
                    break;
                const fetchingLength = Object.keys(this.metadataFetchingDict).length;
                if (fetchingLength >= this.config.maximumParallelFetchingTorrent)
                    break;
                const waitingKeysNumber = this.getUniqueWaitingKeys().length;
                if (waitingKeysNumber > fetchingLength) {
                    if (counter === undefined)
                        counter = this.metadataWaitingQueues.length;
                    this.dispatchMetadata();
                    counter--;
                    if (counter <= 0)
                        break;
                }
                else {
                    break;
                }
            }
        }
        removeDuplicatedWaitingObjects(infoHashStr) {
            this.metadataWaitingQueues = this.metadataWaitingQueues.filter(waitingObject => infoHashStr !== waitingObject.infoHashStr);
        }
        getNextFetchingKey(nextFetching) {
            const { infoHash, peer } = nextFetching;
            return `${peer.host}:${peer.port}-${infoHash.toString('hex')}`;
        }
        getUniqueWaitingKeys() {
            const keysDict = this.metadataWaitingQueues.reduce((prev, curr) => {
                prev[curr.infoHashStr] = 1;
                return prev;
            }, {});
            return Object.keys(keysDict);
        }
        exportWaitingQueue() {
            return [...this.metadataWaitingQueues];
        }
        importWaitingQueue(arr) {
            if (!arr || Object.prototype.toString.call(arr) !== '[object Array]') {
                console.error('Not an array');
                return;
            }
            for (const tuple of arr) {
                if (!tuple.peer || !tuple.peer.host || !tuple.peer.port) {
                    continue;
                }
                if (!tuple.infoHashStr) {
                    continue;
                }
                tuple.infoHash = Buffer.from(tuple.infoHashStr, 'hex');
                this.metadataWaitingQueues.push(tuple);
            }
        }
        getMetadataStats() {
            const fetchings = Object.keys(this.metadataFetchingDict);
            const cacheStats = this.cacheManager.getStats();
            const uptime = Date.now() - this.startTime;
            return Object.assign({ fetchingNum: fetchings.length, metadataWaitingQueueSize: this.metadataWaitingQueues.length, uniqueWaitingKeys: this.getUniqueWaitingKeys().length, activeFetchingCount: Object.keys(this.metadataFetchingDict).reduce((sum, key) => sum + this.metadataFetchingDict[key], 0), totalFetchCount: this.totalFetchCount, successFetchCount: this.successFetchCount, failedFetchCount: this.failedFetchCount, successRate: this.totalFetchCount > 0 ? (this.successFetchCount / this.totalFetchCount) * 100 : 0, uptime, aggressiveLimit: this.aggressiveLimit }, cacheStats);
        }
        parseMetaData(rawMetadata) {
            return metadataHelper.parseMetaData(rawMetadata);
        }
        clearMetadataData() {
            this.metadataWaitingQueues = [];
            this.metadataFetchingDict = {};
            this.retryCount = {};
        }
        getManagerName() {
            return 'MetadataManager';
        }
        performCleanup() {
            this.clearMetadataData();
        }
        clearData() {
            this.clearMetadataData();
        }
        getStats() {
            return Object.assign(Object.assign({}, super.getStats()), this.getMetadataStats());
        }
        handleMetadataError(operation, error, context) {
            const metadataError = new error_1.MetadataError(`Metadata operation failed: ${operation}`, Object.assign(Object.assign({ operation }, context), { cause: error instanceof Error ? error : new Error(String(error)) }));
            super.handleError(operation, metadataError, context);
        }
        validateConfig(config) {
            const metadataConfig = config;
            if (metadataConfig.maximumParallelFetchingTorrent < 1) {
                throw new Error('maximumParallelFetchingTorrent must be greater than 0');
            }
            if (metadataConfig.maximumWaitingQueueSize < -1) {
                throw new Error('maximumWaitingQueueSize must be -1 (unlimited) or greater');
            }
            if (metadataConfig.downloadMaxTime < 1000) {
                throw new Error('downloadMaxTime must be at least 1000ms');
            }
            if (metadataConfig.aggressiveLevel < 0 || metadataConfig.aggressiveLevel > 2) {
                throw new Error('aggressiveLevel must be between 0 and 2');
            }
            if (metadataConfig.maxRetries && metadataConfig.maxRetries < 0) {
                throw new Error('maxRetries must be greater than or equal to 0');
            }
            if (metadataConfig.retryDelay && metadataConfig.retryDelay < 0) {
                throw new Error('retryDelay must be greater than or equal to 0');
            }
        }
        executeWithRetry(operation, infoHashStr, peer) {
            return __awaiter(this, void 0, void 0, function* () {
                if (!this.config.enableRetry) {
                    return operation();
                }
                let lastError;
                let attempt = 0;
                const maxAttempts = this.config.maxRetries + 1;
                if (!this.retryCount[infoHashStr]) {
                    this.retryCount[infoHashStr] = 0;
                }
                while (attempt < maxAttempts) {
                    try {
                        const result = yield Promise.race([
                            operation(),
                            new Promise((_, reject) => setTimeout(() => reject(new error_1.TimeoutError('Metadata fetch timeout')), this.config.requestTimeout))
                        ]);
                        return result;
                    }
                    catch (error) {
                        lastError = error;
                        attempt++;
                        this.retryCount[infoHashStr]++;
                        if (attempt >= maxAttempts) {
                            break;
                        }
                        const delay = this.config.retryDelay * Math.pow(this.config.retryBackoffFactor, attempt - 1);
                        this.emit('retry', {
                            infoHash: infoHashStr,
                            peer: { host: peer.host, port: peer.port },
                            attempt,
                            maxAttempts,
                            delay,
                            error: lastError.message
                        });
                        yield new Promise(resolve => setTimeout(resolve, delay));
                    }
                }
                throw lastError;
            });
        }
        startPerformanceMonitoring() {
            if (this.performanceMonitoringInterval) {
                return;
            }
            this.performanceMonitoringInterval = setInterval(() => {
                const stats = this.getStats();
                this.emit('performanceStats', {
                    uptime: stats.uptime,
                    totalFetchCount: stats.totalFetchCount,
                    successRate: stats.successRate,
                    queueSize: stats.metadataWaitingQueueSize,
                    activeFetching: stats.activeFetchingCount,
                    memoryUsage: process.memoryUsage()
                });
            }, this.config.performanceMonitoringInterval);
        }
        stopPerformanceMonitoring() {
            if (this.performanceMonitoringInterval) {
                clearInterval(this.performanceMonitoringInterval);
                this.performanceMonitoringInterval = undefined;
            }
        }
        cleanupExpiredTasks() {
            const now = Date.now();
            const maxAge = 3600000;
            Object.keys(this.retryCount).forEach(key => {
                if (now - this.startTime > maxAge) {
                    delete this.retryCount[key];
                }
            });
            const originalLength = this.metadataWaitingQueues.length;
            this.metadataWaitingQueues = this.metadataWaitingQueues.filter(item => {
                return now - this.startTime < maxAge;
            });
            const cleanedCount = originalLength - this.metadataWaitingQueues.length;
            if (cleanedCount > 0) {
                this.emit('memoryCleanup', {
                    cleanedItems: cleanedCount,
                    remainingItems: this.metadataWaitingQueues.length
                });
            }
        }
        performMemoryCleanup() {
            try {
                this.cleanupExpiredTasks();
                if (global.gc) {
                    global.gc();
                }
            }
            catch (error) {
                this.handleMetadataError('performMemoryCleanup', error);
            }
        }
        performDeepCleanup() {
            try {
                this.stopPerformanceMonitoring();
                this.clearMetadataData();
                super.performDeepCleanup();
            }
            catch (error) {
                this.handleMetadataError('performDeepCleanup', error);
            }
        }
        destroy() {
            return __awaiter(this, void 0, void 0, function* () {
                if (this.isDestroyed) {
                    return;
                }
                this.isDestroyed = true;
                try {
                    this.stopPerformanceMonitoring();
                    this.clearMetadataData();
                    this.removeAllListeners();
                    this.emit('destroyed');
                }
                catch (error) {
                    this.handleMetadataError('destroy', error);
                    throw error;
                }
            });
        }
    }
    exports.MetadataManager = MetadataManager;
});
