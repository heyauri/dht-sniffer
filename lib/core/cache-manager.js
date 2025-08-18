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
            this.fetchedTuple = new lru_cache_1.LRUCache({
                max: config.fetchedTupleSize,
                ttl: 3 * 60 * 60 * 1000
            });
            this.fetchedInfoHash = new lru_cache_1.LRUCache({
                max: config.fetchedInfoHashSize,
                ttl: 72 * 60 * 60 * 1000
            });
            this.findNodeCache = new lru_cache_1.LRUCache({
                max: config.findNodeCacheSize,
                ttl: 24 * 60 * 60 * 1000,
                updateAgeOnHas: true
            });
            this.latestCalledPeers = new lru_cache_1.LRUCache({
                max: config.latestCalledPeersSize,
                ttl: 5 * 60 * 1000
            });
            this.usefulPeers = new lru_cache_1.LRUCache({
                max: config.usefulPeersSize
            });
            this.metadataFetchingCache = new lru_cache_1.LRUCache({
                max: config.metadataFetchingCacheSize,
                ttl: 20 * 1000
            });
            this.counter = {
                fetchedTupleHit: 0,
                fetchedInfoHashHit: 0,
                fetchedTupleSize: 0,
                fetchedInfoHashSize: 0,
                metadataFetchingCacheSize: 0
            };
        }
        getFetchedTuple() {
            return this.fetchedTuple;
        }
        getFetchedInfoHash() {
            return this.fetchedInfoHash;
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
        }
    }
    exports.CacheManager = CacheManager;
});
