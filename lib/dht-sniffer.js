(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define(["require", "exports", "events", "./utils/error-handler", "./utils/error-monitor", "./core/cache-manager", "./core/peer-manager", "./core/metadata-manager", "./core/dht-manager"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.DHTSniffer = void 0;
    const events_1 = require("events");
    const error_handler_1 = require("./utils/error-handler");
    const error_monitor_1 = require("./utils/error-monitor");
    const cache_manager_1 = require("./core/cache-manager");
    const peer_manager_1 = require("./core/peer-manager");
    const metadata_manager_1 = require("./core/metadata-manager");
    const dht_manager_1 = require("./core/dht-manager");
    class DHTSniffer extends events_1.EventEmitter {
        constructor(config = {}) {
            super();
            this.config = Object.assign({
                port: 6881,
                nodesMaxSize: 10000,
                refreshPeriod: 30000,
                announcePeriod: 30000,
                maximumParallelFetchingTorrent: 40,
                maximumWaitingQueueSize: -1,
                downloadMaxTime: 20000,
                ignoreFetched: true,
                aggressiveLevel: 0
            }, config);
            this.isRunning = false;
            this.errorHandler = config.errorHandler || new error_handler_1.ErrorHandler();
            this.errorMonitor = config.errorMonitor || new error_monitor_1.ErrorMonitor(this.errorHandler, config.errorMonitorConfig || {
                statsIntervalMs: 60000,
                maxRecentErrors: 100,
                errorRateWindowMs: 300000,
                enableAlerts: true,
                alertThresholds: {
                    errorRate: 10,
                    criticalErrors: 5,
                    consecutiveErrors: 20
                }
            });
            this.cacheManager = config.cacheManager || new cache_manager_1.CacheManager(config.cacheConfig || {
                fetchedTupleSize: 1000,
                fetchedInfoHashSize: 5000,
                findNodeCacheSize: 1000,
                latestCalledPeersSize: 500,
                usefulPeersSize: 50000,
                metadataFetchingCacheSize: 1000
            });
            this.peerManager = new peer_manager_1.PeerManager({
                maxNodes: this.config.nodesMaxSize,
                nodeRefreshTime: this.config.refreshPeriod,
                findNodeProbability: 0.1
            }, null, this.cacheManager);
            this.metadataManager = new metadata_manager_1.MetadataManager({
                maximumParallelFetchingTorrent: this.config.maximumParallelFetchingTorrent,
                maximumWaitingQueueSize: this.config.maximumWaitingQueueSize,
                downloadMaxTime: this.config.downloadMaxTime,
                ignoreFetched: this.config.ignoreFetched,
                aggressiveLevel: this.config.aggressiveLevel
            }, this.errorHandler, this.cacheManager);
            const dhtConfig = {
                port: this.config.port,
                bootstrap: this.config.bootstrap,
                nodesMaxSize: this.config.nodesMaxSize,
                refreshPeriod: this.config.refreshPeriod,
                announcePeriod: this.config.announcePeriod
            };
            if (this.config.address !== undefined) {
                dhtConfig.address = this.config.address;
            }
            this.dhtManager = new dht_manager_1.DHTManager(dhtConfig, this.errorHandler, this.peerManager);
            this.setupManagerEventListeners();
        }
        setupManagerEventListeners() {
            this.dhtManager.on('peer', (peerInfo) => {
                const { peer, infoHash } = peerInfo;
                this.metadataManager.addQueuingMetadata(infoHash, peer);
                this.emit('peer', peerInfo);
            });
            this.dhtManager.on('node', (node) => {
                this.emit('node', node);
            });
            this.dhtManager.on('error', (error) => {
                this.emit('error', error);
            });
            this.dhtManager.on('warning', (warning) => {
                this.emit('warning', warning);
            });
            this.dhtManager.on('infoHash', (peerInfo) => {
                this.emit('infoHash', peerInfo);
            });
            this.metadataManager.on('metadata', (metadataInfo) => {
                this.emit('metadata', metadataInfo);
            });
            this.metadataManager.on('metadataError', (errorInfo) => {
                this.emit('metadataError', errorInfo);
            });
        }
        start() {
            if (this.isRunning) {
                return;
            }
            try {
                this.dhtManager.start();
                const dhtInstance = this.dhtManager.getDHT();
                this.peerManager.setDHT(dhtInstance);
                this.isRunning = true;
                this.emit('started');
            }
            catch (error) {
                this.isRunning = false;
                throw error;
            }
        }
        stop() {
            if (!this.isRunning) {
                return;
            }
            try {
                this.dhtManager.stop();
                this.metadataManager.clear();
                this.isRunning = false;
                this.emit('stopped');
            }
            catch (error) {
                throw error;
            }
        }
        findNode(target) {
            this.dhtManager.findNode(target);
        }
        getPeers(infoHash) {
            this.dhtManager.getPeers(infoHash);
        }
        fetchMetaData(peerInfo) {
            const { infoHash, peer } = peerInfo;
            this.metadataManager.addQueuingMetadata(infoHash, peer);
        }
        parseMetaData(rawMetadata) {
            return this.metadataManager.parseMetaData(rawMetadata);
        }
        exportNodes() {
            return this.dhtManager.exportNodes();
        }
        importNodes(nodes) {
            this.dhtManager.importNodes(nodes);
        }
        exportPeers() {
            return this.dhtManager.exportPeers();
        }
        importPeers(peers) {
            this.dhtManager.importPeers(peers);
        }
        exportWaitingQueue() {
            return this.metadataManager.exportWaitingQueue();
        }
        importWaitingQueue(arr) {
            this.metadataManager.importWaitingQueue(arr);
        }
        getStats() {
            const dhtStats = this.dhtManager.getStats();
            const metadataStats = this.metadataManager.getStats();
            const errorStats = this.errorMonitor.getStats();
            return Object.assign(Object.assign(Object.assign({}, dhtStats), metadataStats), { errors: errorStats });
        }
        isRunningStatus() {
            return this.isRunning;
        }
        getErrorHandler() {
            return this.errorHandler;
        }
        getErrorMonitor() {
            return this.errorMonitor;
        }
        getCacheManager() {
            return this.cacheManager;
        }
        getPeerManager() {
            return this.peerManager;
        }
        getMetadataManager() {
            return this.metadataManager;
        }
        getDHTManager() {
            return this.dhtManager;
        }
    }
    exports.DHTSniffer = DHTSniffer;
});
