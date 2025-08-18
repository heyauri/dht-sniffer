(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define(["require", "exports", "events", "../metadata/metadata-helper", "../utils/error-handler"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.MetadataManager = void 0;
    const events_1 = require("events");
    const metadataHelper = require("../metadata/metadata-helper");
    const error_handler_1 = require("../utils/error-handler");
    class MetadataManager extends events_1.EventEmitter {
        constructor(config, errorHandler, cacheManager) {
            super();
            this.config = config;
            this.errorHandler = errorHandler;
            this.cacheManager = cacheManager;
            this.metadataWaitingQueues = [];
            this.metadataFetchingDict = {};
            const aggressiveLevel = config.aggressiveLevel;
            this.aggressiveLimit = aggressiveLevel && aggressiveLevel > 0
                ? aggressiveLevel * config.maximumParallelFetchingTorrent
                : 0;
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
            const _this = this;
            metadataHelper
                .fetch({ infoHash, peer }, this.config)
                .then(metadata => {
                if (metadata === undefined)
                    return;
                _this.emit('metadata', { infoHash, metadata });
                const fetchedInfohash = _this.cacheManager.getFetchedInfoHash();
                const usefulPeers = _this.cacheManager.getUsefulPeers();
                fetchedInfohash.set(infoHashStr, 1);
                usefulPeers.set(`${peer.host}:${peer.port}`, peer);
                if (_this.config.ignoreFetched) {
                    _this.removeDuplicatedWaitingObjects(infoHashStr);
                }
            })
                .catch(error => {
                if (error instanceof error_handler_1.NetworkError || error instanceof error_handler_1.TimeoutError || error instanceof error_handler_1.MetadataError) {
                    _this.errorHandler.handleError(error);
                }
                else {
                    const metadataError = new error_handler_1.MetadataError(`Metadata fetch failed for ${infoHashStr}: ${error.message || error}`, {
                        operation: 'metadata_fetch',
                        infoHash: infoHashStr,
                        peer: { host: peer.host, port: peer.port }
                    }, error instanceof Error ? error : new Error(String(error)));
                    _this.errorHandler.handleError(metadataError);
                    error = metadataError;
                }
                _this.emit('metadataError', { infoHash, error });
            })
                .finally(() => {
                _this.dispatchMetadata();
                if (_this.metadataFetchingDict[infoHashStr] && _this.metadataFetchingDict[infoHashStr] > 1) {
                    _this.metadataFetchingDict[infoHashStr] -= 1;
                }
                else {
                    Reflect.deleteProperty(_this.metadataFetchingDict, infoHashStr);
                }
                const metadataFetchingCache = _this.cacheManager.getMetadataFetchingCache();
                metadataFetchingCache.delete(infoHashStr);
            });
            this.dispatchMetadata();
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
        getStats() {
            const fetchings = Object.keys(this.metadataFetchingDict);
            const cacheStats = this.cacheManager.getStats();
            return Object.assign({ fetchingNum: fetchings.length, metadataWaitingQueueSize: this.metadataWaitingQueues.length, uniqueWaitingKeys: this.getUniqueWaitingKeys().length }, cacheStats);
        }
        parseMetaData(rawMetadata) {
            return metadataHelper.parseMetaData(rawMetadata);
        }
        clear() {
            this.metadataWaitingQueues = [];
            this.metadataFetchingDict = {};
        }
    }
    exports.MetadataManager = MetadataManager;
});
