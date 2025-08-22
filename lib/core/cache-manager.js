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
        define(["require", "exports", "lru-cache", "../types/error", "./base-manager", "./common/cache-access-helper"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.CacheManager = void 0;
    const lru_cache_1 = require("lru-cache");
    const error_1 = require("../types/error");
    const base_manager_1 = require("./base-manager");
    const cache_access_helper_1 = require("./common/cache-access-helper");
    class CacheManager extends base_manager_1.BaseManager {
        constructor(config, errorHandler) {
            super(config, errorHandler);
            this.config = Object.assign({ enableDynamicSizing: true, enablePreheating: false, minCacheSize: 100, maxCacheSize: 100000, cacheHitThreshold: 0.8, enableCompression: false, compressionThreshold: 1024, maxRetryAttempts: 3, circuitBreakerThreshold: 5, memoryWarningThreshold: 50 * 1024 * 1024 }, config);
            this.compressedCache = new Map();
            this.fetchedTuple = new lru_cache_1.LRUCache({
                max: this.config.fetchedTupleSize,
                ttl: 3 * 60 * 60 * 1000
            });
            this.fetchedInfoHash = new lru_cache_1.LRUCache({
                max: this.config.fetchedInfoHashSize,
                ttl: 72 * 60 * 60 * 1000
            });
            this.findNodeCache = new lru_cache_1.LRUCache({
                max: this.config.findNodeCacheSize,
                ttl: 24 * 60 * 60 * 1000,
                updateAgeOnHas: true
            });
            this.latestCalledPeers = new lru_cache_1.LRUCache({
                max: this.config.latestCalledPeersSize,
                ttl: 5 * 60 * 1000
            });
            this.usefulPeers = new lru_cache_1.LRUCache({
                max: this.config.usefulPeersSize
            });
            this.metadataFetchingCache = new lru_cache_1.LRUCache({
                max: this.config.metadataFetchingCacheSize,
                ttl: 20 * 1000
            });
            const cacheAccessConfig = {
                cacheName: 'default',
                enableCompression: this.config.enableCompression,
                compressionThreshold: this.config.compressionThreshold,
                maxRetryAttempts: this.config.maxRetryAttempts,
                circuitBreakerThreshold: this.config.circuitBreakerThreshold,
            };
            const fetchedTupleConfig = Object.assign(Object.assign({}, cacheAccessConfig), { cacheName: 'fetchedTuple' });
            this.fetchedTupleHelper = cache_access_helper_1.CacheAccessHelperFactory.getHelper(this.errorHandler, fetchedTupleConfig);
            const fetchedInfoHashConfig = Object.assign(Object.assign({}, cacheAccessConfig), { cacheName: 'fetchedInfoHash' });
            this.fetchedInfoHashHelper = cache_access_helper_1.CacheAccessHelperFactory.getHelper(this.errorHandler, fetchedInfoHashConfig);
            this.counter = {
                fetchedTupleHit: 0,
                fetchedInfoHashHit: 0,
                fetchedTupleSize: 0,
                fetchedInfoHashSize: 0,
                metadataFetchingCacheSize: 0,
                fetchedTupleMiss: 0,
                fetchedInfoHashMiss: 0,
                totalRequests: 0,
                hitRate: 0,
                lastCleanupTime: Date.now(),
                dynamicSizingEvents: 0,
                preheatingEvents: 0,
                totalSize: 0
            };
        }
        getFetchedTuple() {
            return this.fetchedTuple;
        }
        getFetchedTupleValue(key) {
            return __awaiter(this, void 0, void 0, function* () {
                return this.fetchedTupleHelper.getWithRetry(this.fetchedTuple, key);
            });
        }
        getFetchedInfoHash() {
            return this.fetchedInfoHash;
        }
        getFetchedInfoHashValue(key) {
            return __awaiter(this, void 0, void 0, function* () {
                return this.fetchedInfoHashHelper.getWithRetry(this.fetchedInfoHash, key);
            });
        }
        getFindNodeCache() {
            return this.findNodeCache;
        }
        getLatestCalledPeers() {
            return this.latestCalledPeers;
        }
        getUsefulPeers() {
            return this.usefulPeers;
        }
        getMetadataFetchingCache() {
            return this.metadataFetchingCache;
        }
        incrementFetchedTupleHit() {
            this.counter.fetchedTupleHit++;
        }
        incrementFetchedInfoHashHit() {
            this.counter.fetchedInfoHashHit++;
        }
        getCacheStats() {
            return Object.assign(Object.assign({}, this.counter), { fetchedTupleSize: this.fetchedTuple.size, fetchedInfoHashSize: this.fetchedInfoHash.size, metadataFetchingCacheSize: this.metadataFetchingCache.size, totalSize: this.fetchedTuple.size + this.fetchedInfoHash.size + this.findNodeCache.size + this.latestCalledPeers.size + this.usefulPeers.size + this.metadataFetchingCache.size });
        }
        getDetailedStats() {
            const now = Date.now();
            const uptime = now - (this.counter.lastCleanupTime - (this.config.cleanupInterval || 0));
            return Object.assign(Object.assign({}, this.getStats()), { cacheSizes: {
                    fetchedTuple: this.fetchedTuple.max,
                    fetchedInfoHash: this.fetchedInfoHash.max,
                    findNodeCache: this.findNodeCache.max,
                    latestCalledPeers: this.latestCalledPeers.max,
                    usefulPeers: this.usefulPeers.max,
                    metadataFetchingCache: this.metadataFetchingCache.max
                }, accessHistorySize: this.cacheAccessHistory.size, uptime });
        }
        clearAllCaches() {
            try {
                this.fetchedTuple.clear();
                this.fetchedInfoHash.clear();
                this.findNodeCache.clear();
                this.latestCalledPeers.clear();
                this.usefulPeers.clear();
                this.metadataFetchingCache.clear();
                this.compressedCache.clear();
                this.emit('cachesCleared');
            }
            catch (error) {
                this.handleError('clearAllCaches', error);
            }
        }
        addPeerToCache(peerKey, peerInfo) {
            try {
                const { peer, infoHash } = peerInfo;
                if (this.config.enableCompression && this.shouldCompress(peer)) {
                    const compressed = this.compressData(peer);
                    this.compressedCache.set(peerKey, compressed);
                }
                this.usefulPeers.set(peerKey, { peer, infoHash });
                this.emit('peerAdded', { peerKey, peerInfo });
            }
            catch (error) {
                this.handleError('addPeerToCache', error, { peerKey });
            }
        }
        getAllPeers() {
            const peers = [];
            for (const [_key, value] of this.usefulPeers) {
                peers.push(value.peer);
            }
            return peers;
        }
        getPeerCount() {
            return this.usefulPeers.size;
        }
        resetStats() {
            this.counter.fetchedTupleHit = 0;
            this.counter.fetchedInfoHashHit = 0;
            this.counter.fetchedTupleMiss = 0;
            this.counter.fetchedInfoHashMiss = 0;
            this.counter.totalRequests = 0;
            this.counter.hitRate = 0;
        }
        updateHitRate() {
            const totalHits = this.counter.fetchedTupleHit + this.counter.fetchedInfoHashHit;
            const totalRequests = this.counter.fetchedTupleHit + this.counter.fetchedTupleMiss +
                this.counter.fetchedInfoHashHit + this.counter.fetchedInfoHashMiss;
            if (totalRequests > 0) {
                this.counter.hitRate = totalHits / totalRequests;
            }
        }
        adjustCacheSizes() {
            if (!this.config.enableDynamicSizing)
                return;
            const hitRate = this.counter.hitRate;
            const threshold = this.config.cacheHitThreshold || 0.8;
            if (hitRate > threshold) {
                this.increaseCacheSizes();
            }
            else if (hitRate < threshold * 0.5) {
                this.decreaseCacheSizes();
            }
            this.counter.dynamicSizingEvents++;
        }
        increaseCacheSizes() {
            const maxSize = this.config.maxCacheSize || 100000;
            if (this.fetchedTuple.max < maxSize) {
                const newMax = Math.min(this.fetchedTuple.max * 1.2, maxSize);
                const entries = Array.from(this.fetchedTuple.entries());
                this.fetchedTuple = new lru_cache_1.LRUCache({
                    max: newMax,
                    ttl: 3 * 60 * 60 * 1000
                });
                entries.forEach(([key, value]) => {
                    this.fetchedTuple.set(key, value);
                });
                this.updateHitRate();
            }
            if (this.fetchedInfoHash.max < maxSize) {
                const newMax = Math.min(this.fetchedInfoHash.max * 1.2, maxSize);
                const entries = Array.from(this.fetchedInfoHash.entries());
                this.fetchedInfoHash = new lru_cache_1.LRUCache({
                    max: newMax,
                    ttl: 72 * 60 * 60 * 1000
                });
                entries.forEach(([key, value]) => {
                    this.fetchedInfoHash.set(key, value);
                });
                this.updateHitRate();
            }
        }
        decreaseCacheSizes() {
            const minSize = this.config.minCacheSize || 100;
            if (this.fetchedTuple.max > minSize) {
                const newMax = Math.max(this.fetchedTuple.max * 0.8, minSize);
                const entries = Array.from(this.fetchedTuple.entries());
                const entriesToKeep = entries.slice(-Math.floor(newMax));
                this.fetchedTuple = new lru_cache_1.LRUCache({
                    max: newMax,
                    ttl: 3 * 60 * 60 * 1000
                });
                entriesToKeep.forEach(([key, value]) => {
                    this.fetchedTuple.set(key, value);
                });
                this.updateHitRate();
            }
            if (this.fetchedInfoHash.max > minSize) {
                const newMax = Math.max(this.fetchedInfoHash.max * 0.8, minSize);
                const entries = Array.from(this.fetchedInfoHash.entries());
                const entriesToKeep = entries.slice(-Math.floor(newMax));
                this.fetchedInfoHash = new lru_cache_1.LRUCache({
                    max: newMax,
                    ttl: 72 * 60 * 60 * 1000
                });
                entriesToKeep.forEach(([key, value]) => {
                    this.fetchedInfoHash.set(key, value);
                });
                this.updateHitRate();
            }
        }
        preheatCache(data) {
            if (!this.config.enablePreheating)
                return;
            data.forEach(({ key, value, cacheName }) => {
                let cache;
                switch (cacheName) {
                    case 'fetchedTuple':
                        cache = this.fetchedTuple;
                        break;
                    case 'fetchedInfoHash':
                        cache = this.fetchedInfoHash;
                        break;
                    case 'findNodeCache':
                        cache = this.findNodeCache;
                        break;
                    default:
                        return;
                }
                if (cache && !cache.has(key)) {
                    cache.set(key, value);
                    this.updateHitRate();
                }
            });
            this.counter.preheatingEvents++;
        }
        resetAllCircuitBreakers() {
            this.circuitBreakerState.clear();
        }
        performDeepCleanup() {
            try {
                this.clearAllCaches();
                this.clearExpiredAccessHistory();
                this.resetAllCircuitBreakers();
                super.performDeepCleanup();
            }
            catch (error) {
                this.handleCacheError('performDeepCleanup', error);
            }
        }
        getManagerName() {
            return 'CacheManager';
        }
        performCleanup() {
            this.clearExpiredAccessHistory();
            this.adjustCacheSizes();
        }
        clearData() {
            this.clearAllCaches();
            this.cacheAccessHistory.clear();
            this.circuitBreakerState.clear();
            this.retryAttempts.clear();
            this.compressedCache.clear();
        }
        getStats() {
            return Object.assign(Object.assign({}, super.getStats()), this.getCacheStats());
        }
        handleCacheError(operation, error, context) {
            const cacheError = new error_1.CacheError(`Cache operation failed: ${operation}`, Object.assign(Object.assign({ operation }, context), { cause: error instanceof Error ? error : new Error(String(error)) }));
            super.handleError(operation, cacheError, context);
        }
        validateConfig(config) {
            const cacheConfig = config;
            if (cacheConfig.fetchedTupleSize !== undefined && (typeof cacheConfig.fetchedTupleSize !== 'number' || cacheConfig.fetchedTupleSize <= 0)) {
                throw new Error('fetchedTupleSize must be a positive number');
            }
            if (cacheConfig.fetchedInfoHashSize !== undefined && (typeof cacheConfig.fetchedInfoHashSize !== 'number' || cacheConfig.fetchedInfoHashSize <= 0)) {
                throw new Error('fetchedInfoHashSize must be a positive number');
            }
            if (cacheConfig.findNodeCacheSize !== undefined && (typeof cacheConfig.findNodeCacheSize !== 'number' || cacheConfig.findNodeCacheSize <= 0)) {
                throw new Error('findNodeCacheSize must be a positive number');
            }
            if (cacheConfig.latestCalledPeersSize !== undefined && (typeof cacheConfig.latestCalledPeersSize !== 'number' || cacheConfig.latestCalledPeersSize <= 0)) {
                throw new Error('latestCalledPeersSize must be a positive number');
            }
            if (cacheConfig.usefulPeersSize !== undefined && (typeof cacheConfig.usefulPeersSize !== 'number' || cacheConfig.usefulPeersSize <= 0)) {
                throw new Error('usefulPeersSize must be a positive number');
            }
            if (cacheConfig.metadataFetchingCacheSize !== undefined && (typeof cacheConfig.metadataFetchingCacheSize !== 'number' || cacheConfig.metadataFetchingCacheSize <= 0)) {
                throw new Error('metadataFetchingCacheSize must be a positive number');
            }
            if (cacheConfig.maxCacheSize !== undefined && (typeof cacheConfig.maxCacheSize !== 'number' || cacheConfig.maxCacheSize <= 0)) {
                throw new Error('maxCacheSize must be a positive number');
            }
            if (cacheConfig.minCacheSize !== undefined && (typeof cacheConfig.minCacheSize !== 'number' || cacheConfig.minCacheSize <= 0)) {
                throw new Error('minCacheSize must be a positive number');
            }
            if (cacheConfig.cacheHitThreshold !== undefined && (typeof cacheConfig.cacheHitThreshold !== 'number' || cacheConfig.cacheHitThreshold < 0 || cacheConfig.cacheHitThreshold > 1)) {
                throw new Error('cacheHitThreshold must be a number between 0 and 1');
            }
        }
        shouldCompress(data) {
            if (!this.config.enableCompression) {
                return false;
            }
            try {
                const dataSize = JSON.stringify(data).length;
                return dataSize > (this.config.compressionThreshold || 1024);
            }
            catch (_a) {
                return false;
            }
        }
        compressData(data) {
            try {
                const jsonString = JSON.stringify(data);
                return Buffer.from(jsonString, 'utf8');
            }
            catch (error) {
                this.handleError('compressData', error);
                return Buffer.from(JSON.stringify({}));
            }
        }
        decompressData(compressed) {
            try {
                const jsonString = compressed.toString('utf8');
                return JSON.parse(jsonString);
            }
            catch (error) {
                this.handleError('decompressData', error);
                return null;
            }
        }
        getCompressedPeer(peerKey) {
            const compressed = this.compressedCache.get(peerKey);
            if (!compressed) {
                return null;
            }
            return this.decompressData(compressed);
        }
        calculateCacheMemory() {
            return (this.fetchedTuple.size * 50 +
                this.fetchedInfoHash.size * 50 +
                this.findNodeCache.size * 50 +
                this.latestCalledPeers.size * 50 +
                this.usefulPeers.size * 200 +
                this.metadataFetchingCache.size * 50 +
                this.compressedCache.size * 100);
        }
        getMemoryUsage() {
            const memoryUsage = process.memoryUsage();
            const threshold = this.config.memoryWarningThreshold || 50 * 1024 * 1024;
            const cacheMemory = this.calculateCacheMemory();
            const isMemoryWarning = memoryUsage.heapUsed > threshold;
            if (isMemoryWarning) {
                this.emit('memoryWarning', {
                    heapUsed: memoryUsage.heapUsed,
                    threshold,
                    cacheMemory
                });
            }
            return Object.assign(Object.assign({}, memoryUsage), { cacheMemory,
                isMemoryWarning });
        }
        clearExpiredAccessHistory() {
            const now = Date.now();
            const maxAge = 24 * 60 * 60 * 1000;
            for (const [key, value] of this.cacheAccessHistory.entries()) {
                if (now - value.lastAccess > maxAge) {
                    this.cacheAccessHistory.delete(key);
                }
            }
        }
        cleanupMemory() {
            return __awaiter(this, void 0, void 0, function* () {
                try {
                    this.fetchedTuple.purgeStale();
                    this.fetchedInfoHash.purgeStale();
                    this.findNodeCache.purgeStale();
                    this.latestCalledPeers.purgeStale();
                    this.metadataFetchingCache.purgeStale();
                    this.compressedCache.clear();
                    this.clearExpiredAccessHistory();
                    this.performMemoryCleanup();
                    this.emit('memoryCleaned');
                }
                catch (error) {
                    this.handleCacheError('cleanupMemory', error);
                }
            });
        }
        getCompressionStats() {
            const compressedItems = this.compressedCache.size;
            let estimatedOriginalSize = 0;
            let compressedSize = 0;
            for (const [_key, compressed] of this.compressedCache) {
                try {
                    const decompressed = this.decompressData(compressed);
                    if (decompressed) {
                        estimatedOriginalSize += JSON.stringify(decompressed).length;
                    }
                    compressedSize += compressed.length;
                }
                catch (_a) {
                }
            }
            const compressionRatio = estimatedOriginalSize > 0
                ? (estimatedOriginalSize - compressedSize) / estimatedOriginalSize
                : 0;
            return {
                compressedItems,
                estimatedOriginalSize,
                compressedSize,
                compressionRatio
            };
        }
    }
    exports.CacheManager = CacheManager;
});
