(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define(["require", "exports", "lru-cache"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.CacheManager = void 0;
    const lru_cache_1 = require("lru-cache");
    class CacheManager {
        constructor(config) {
            this.config = Object.assign({ enableDynamicSizing: true, enablePreheating: false, minCacheSize: 100, maxCacheSize: 100000, cacheHitThreshold: 0.8, cleanupInterval: 5 * 60 * 1000 }, config);
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
                preheatingEvents: 0
            };
            this.cleanupInterval = null;
            this.cacheAccessHistory = new Map();
            this.startPeriodicCleanup();
        }
        getFetchedTuple() {
            return this.fetchedTuple;
        }
        getFetchedTupleValue(key) {
            const value = this.fetchedTuple.get(key);
            this.recordCacheAccess('fetchedTuple', key, value !== undefined);
            return value;
        }
        getFetchedInfoHash() {
            return this.fetchedInfoHash;
        }
        getFetchedInfoHashValue(key) {
            const value = this.fetchedInfoHash.get(key);
            this.recordCacheAccess('fetchedInfoHash', key, value !== undefined);
            return value;
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
        getStats() {
            return Object.assign(Object.assign({}, this.counter), { fetchedTupleSize: this.fetchedTuple.size, fetchedInfoHashSize: this.fetchedInfoHash.size, metadataFetchingCacheSize: this.metadataFetchingCache.size });
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
        clearAll() {
            this.fetchedTuple.clear();
            this.fetchedInfoHash.clear();
            this.findNodeCache.clear();
            this.latestCalledPeers.clear();
            this.usefulPeers.clear();
            this.metadataFetchingCache.clear();
        }
        addPeerToCache(peerKey, peerInfo) {
            const { peer, infoHash } = peerInfo;
            this.usefulPeers.set(peerKey, { peer, infoHash });
        }
        getAllPeers() {
            const peers = [];
            for (const [key, value] of this.usefulPeers) {
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
        recordCacheAccess(cacheName, key, hit) {
            this.counter.totalRequests++;
            const accessKey = `${cacheName}:${key}`;
            const current = this.cacheAccessHistory.get(accessKey) || { count: 0, lastAccess: 0 };
            this.cacheAccessHistory.set(accessKey, {
                count: current.count + 1,
                lastAccess: Date.now()
            });
            if (cacheName === 'fetchedTuple') {
                if (hit) {
                    this.counter.fetchedTupleHit++;
                }
                else {
                    this.counter.fetchedTupleMiss++;
                }
            }
            else if (cacheName === 'fetchedInfoHash') {
                if (hit) {
                    this.counter.fetchedInfoHashHit++;
                }
                else {
                    this.counter.fetchedInfoHashMiss++;
                }
            }
            this.updateHitRate();
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
            }
        }
        startPeriodicCleanup() {
            if (this.cleanupInterval) {
                clearInterval(this.cleanupInterval);
            }
            this.cleanupInterval = setInterval(() => {
                this.performCleanup();
            }, this.config.cleanupInterval);
        }
        performCleanup() {
            const now = Date.now();
            this.counter.lastCleanupTime = now;
            const expiredKeys = [];
            for (const [key, data] of this.cacheAccessHistory) {
                if (now - data.lastAccess > 24 * 60 * 60 * 1000) {
                    expiredKeys.push(key);
                }
            }
            expiredKeys.forEach(key => this.cacheAccessHistory.delete(key));
            this.adjustCacheSizes();
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
                }
            });
            this.counter.preheatingEvents++;
        }
        stopPeriodicCleanup() {
            if (this.cleanupInterval) {
                clearInterval(this.cleanupInterval);
                this.cleanupInterval = null;
            }
        }
        destroy() {
            this.stopPeriodicCleanup();
            this.clearAll();
            this.cacheAccessHistory.clear();
        }
    }
    exports.CacheManager = CacheManager;
});
