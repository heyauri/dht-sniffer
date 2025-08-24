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
        define(["require", "exports", "crypto", "../dht/dht", "../utils", "../types/error", "./base-manager"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.DHTManager = void 0;
    const crypto = require("crypto");
    const DHT = require("../dht/dht");
    const utils_1 = require("../utils");
    const error_1 = require("../types/error");
    const base_manager_1 = require("./base-manager");
    const bootstrapNodes = [
        { host: 'dht.libtorrent.org', port: 25401, id: Buffer.alloc(20) },
        { host: 'dht.aelitis.com', port: 6881, id: Buffer.alloc(20) },
        { host: 'dht.bittorrent.com', port: 6881, id: Buffer.alloc(20) },
        { host: 'dht.addict.ninja', port: 6881, id: Buffer.alloc(20) },
        { host: 'dht.ccc.de', port: 6881, id: Buffer.alloc(20) },
        { host: 'dht.tbtt.org', port: 6881, id: Buffer.alloc(20) },
        { host: 'router.bitcomet.com', port: 6881, id: Buffer.alloc(20) },
        { host: 'dht.vuze.com', port: 6881, id: Buffer.alloc(20) },
        { host: 'dht.trackon.org', port: 6881, id: Buffer.alloc(20) },
    ];
    class DHTManager extends base_manager_1.BaseManager {
        constructor(config, errorHandler, peerManager) {
            super(config, errorHandler);
            this.lastRefreshTime = 0;
            this.latestCalledPeers = new Map();
            this.metadataWaitingQueues = [];
            this.peerManager = peerManager;
            this.config = Object.assign({
                port: 6881,
                bootstrapNodes: bootstrapNodes,
                enableMemoryMonitoring: true,
                memoryThreshold: 100 * 1024 * 1024,
                cleanupInterval: 5 * 60 * 1000,
                maxRetries: 3,
                retryDelay: 1000
            }, config);
            this.dht = null;
            this.refreshInterval = null;
            this.announceInterval = null;
            this.memoryCleanupInterval = null;
        }
        start() {
            if (this.isDHTRunning()) {
                return;
            }
            try {
                const dhtConfig = {
                    port: this.config.port,
                    bootstrap: this.config.bootstrap,
                    bootstrapNodes: this.config.bootstrapNodes,
                    maxTables: this.config.maxTables,
                    maxValues: this.config.maxValues,
                    maxPeers: this.config.maxPeers,
                    maxAge: this.config.maxAge,
                    timeBucketOutdated: this.config.timeBucketOutdated
                };
                this.dht = new DHT.DHT(dhtConfig);
                this.setupEventListeners();
                this.startPeriodicTasks();
                this.listen(this.config.port, this.config.address);
                this.emit('started');
            }
            catch (error) {
                const networkError = new error_1.NetworkError(`Failed to start DHT: ${error instanceof Error ? error.message : String(error)}`, { operation: 'dht_start', config: this.config, cause: error instanceof Error ? error : new Error(String(error)) });
                this.handleError('start', networkError);
                throw networkError;
            }
        }
        stop() {
            if (!this.isDHTRunning()) {
                return;
            }
            try {
                this.clearPeriodicTasks();
                if (this.dht) {
                    this.dht.destroy();
                    this.dht = null;
                }
                this.emit('stopped');
            }
            catch (error) {
                const networkError = new error_1.NetworkError(`Failed to stop DHT: ${error instanceof Error ? error.message : String(error)}`, { operation: 'dht_stop', cause: error instanceof Error ? error : new Error(String(error)) });
                this.handleError('stop', networkError);
            }
        }
        setupEventListeners() {
            if (!this.dht)
                return;
            this.dht.on('node', (node) => {
                var _a, _b, _c;
                if (node && node.host && node.port) {
                    this.latestReceive = new Date();
                    this.emit('node', node);
                    let nodeKey = `${node.host}:${node.port}`;
                    if (!((_a = this.latestCalledPeers) === null || _a === void 0 ? void 0 : _a.get(nodeKey)) &&
                        Math.random() > (((_c = (_b = this.dht._rpc) === null || _b === void 0 ? void 0 : _b.pending) === null || _c === void 0 ? void 0 : _c.length) || 0) / 10 &&
                        this.peerManager.getNodeCount() < 400) {
                        this.findNode(node, node.id);
                    }
                }
            });
            this.dht.on('peer', (peer, infoHash) => {
                if (peer && peer.host && peer.port) {
                    this.peerManager.addPeer({ infoHash, peer });
                    this.emit('peer', { infoHash, peer });
                }
            });
            this.dht.on('get_peers', (data) => {
                if (data && data.peer && data.peer.host && data.peer.port) {
                    this.peerManager.importPeer(data.peer);
                    this.emit('infoHash', { infoHash: data.infoHash, peer: data.peer });
                }
            });
            this.dht.on('error', (error) => {
                const networkError = new error_1.NetworkError(`DHT error: ${error.message}`, { operation: 'dht_event', cause: error });
                this.handleError('setupEventListeners', networkError);
                this.emit('error', networkError);
            });
            this.dht.on('warning', (warning) => {
                const warningMessage = warning instanceof Error ? warning.message : warning;
                if (warningMessage.includes('Unknown type: undefined')) {
                    this.emit('debug', {
                        type: 'malformed_message',
                        message: warningMessage,
                        timestamp: Date.now()
                    });
                    return;
                }
                if (warningMessage.includes('Unexpected transaction id:')) {
                    this.emit('debug', {
                        type: 'transaction_id_mismatch',
                        message: warningMessage,
                        timestamp: Date.now()
                    });
                    return;
                }
                if (warningMessage.includes('Out of order response')) {
                    this.emit('debug', {
                        type: 'out_of_order_response',
                        message: warningMessage,
                        timestamp: Date.now()
                    });
                    return;
                }
                this.emit('warning', warning);
            });
        }
        startPeriodicTasks() {
            this.refreshInterval = setInterval(() => {
                this.refreshNodes();
            }, this.config.refreshPeriod);
            this.announceInterval = setInterval(() => {
                const defaultInfoHash = this.config.defaultInfoHash || crypto.randomBytes(20).toString('hex');
                const defaultPort = this.config.defaultPort || 6881;
                this.announce(defaultInfoHash, defaultPort);
            }, this.config.announcePeriod);
            if (this.config.enableMemoryMonitoring) {
                this.memoryCleanupInterval = setInterval(() => {
                    this.performMemoryCleanup();
                }, this.config.cleanupInterval);
            }
        }
        clearPeriodicTasks() {
            if (this.refreshInterval) {
                clearInterval(this.refreshInterval);
                this.refreshInterval = null;
            }
            if (this.announceInterval) {
                clearInterval(this.announceInterval);
                this.announceInterval = null;
            }
            if (this.memoryCleanupInterval) {
                clearInterval(this.memoryCleanupInterval);
                this.memoryCleanupInterval = null;
            }
        }
        refreshNodes() {
            if (!this.dht || !this.isDHTRunning())
                return;
            const operationKey = 'refreshNodes';
            this.executeWithRetry(() => __awaiter(this, void 0, void 0, function* () {
                var _a, _b, _c;
                let nodes = this.dht._rpc.nodes.toArray();
                this.peerManager.updateNodes();
                const shuffledNodes = [...nodes];
                (0, utils_1.shuffle)(shuffledNodes);
                const refreshTime = this.config.refreshTime || 30000;
                const now = Date.now();
                if (now - (this.lastRefreshTime || 0) > refreshTime) {
                    shuffledNodes.forEach(node => {
                        var _a, _b, _c;
                        const nodeKey = `${node.host}:${node.port}`;
                        const shouldCallFindNode = nodes.length < 5 ||
                            (!((_a = this.latestCalledPeers) === null || _a === void 0 ? void 0 : _a.get(nodeKey)) &&
                                nodes.length < 400 &&
                                Math.random() > (((_c = (_b = this.dht._rpc) === null || _b === void 0 ? void 0 : _b.pending) === null || _c === void 0 ? void 0 : _c.length) || 0) / 12);
                        if (shouldCallFindNode) {
                            this.findNode(node, this.dht._rpc.id);
                            if (!this.latestCalledPeers) {
                                this.latestCalledPeers = new Map();
                            }
                            this.latestCalledPeers.set(nodeKey, now);
                        }
                    });
                }
                if (nodes.length <= 3) {
                    this.dht._bootstrap(true);
                }
                if (((_b = (_a = this.dht._rpc) === null || _a === void 0 ? void 0 : _a.pending) === null || _b === void 0 ? void 0 : _b.length) > 1000) {
                    this.reduceRPCPending();
                }
                if (((_c = this.metadataWaitingQueues) === null || _c === void 0 ? void 0 : _c.length) > 100) {
                    (0, utils_1.shuffle)(this.metadataWaitingQueues);
                }
                this.boostMetadataFetching();
                this.importUsefulPeers();
                this.lastRefreshTime = now;
                this.emit('refresh');
            }), operationKey);
        }
        reduceRPCPending() {
            var _a, _b;
            if (!((_b = (_a = this.dht) === null || _a === void 0 ? void 0 : _a._rpc) === null || _b === void 0 ? void 0 : _b.pending))
                return;
            const pending = this.dht._rpc.pending;
            const now = Date.now();
            const timeoutThreshold = 30000;
            for (let i = pending.length - 1; i >= 0; i--) {
                const request = pending[i];
                if (request.timestamp && (now - request.timestamp) > timeoutThreshold) {
                    pending.splice(i, 1);
                }
            }
        }
        boostMetadataFetching() {
            if (!this.metadataManager)
                return;
            try {
                this.metadataManager.boostMetadataFetching();
            }
            catch (error) {
                this.handleError('boostMetadataFetching', error instanceof Error ? error : new Error(String(error)));
            }
        }
        importUsefulPeers() {
            if (!this.peerManager)
                return;
            try {
                this.peerManager.importUsefulPeers();
            }
            catch (error) {
                this.handleError('importUsefulPeers', error instanceof Error ? error : new Error(String(error)));
            }
        }
        announce(infoHash, port, callback) {
            if (!this.isDHTRunning()) {
                const error = new error_1.NetworkError('DHT is not running', { operation: 'announce', infoHash });
                this.handleError('announce', error);
                if (callback)
                    callback(error);
                return;
            }
            this.executeWithRetry(() => __awaiter(this, void 0, void 0, function* () {
                this.dht.announce(infoHash, port, (err) => {
                    if (err) {
                        this.handleError('announce', err, { infoHash, port });
                        if (callback)
                            callback(err);
                    }
                    else {
                        this.emit('announce', { infoHash, port });
                        if (callback)
                            callback(null);
                    }
                });
            }), 'announce', { infoHash, port });
        }
        findNode(peer, nodeId) {
            if (!this.dht || !this.isDHTRunning())
                return;
            try {
                const target = nodeId !== undefined
                    ? (0, utils_1.getNeighborId)(nodeId, this.dht.nodeId)
                    : this.dht.nodeId;
                const message = {
                    t: crypto.randomBytes(4),
                    y: 'q',
                    q: 'find_node',
                    a: {
                        id: this.dht.nodeId,
                        target: crypto.randomBytes(20)
                    }
                };
                this.dht._rpc.query(peer, message, (err, reply) => {
                    try {
                        if (peer && peer.id && this.dht._rpc.nodes.get(peer.id) && (0, utils_1.isNodeId)(peer.id, 20)) {
                            if (err && (err.code === 'EUNEXPECTEDNODE' || err.code === 'ETIMEDOUT')) {
                                this.dht._rpc.remove(peer.id);
                            }
                        }
                    }
                    catch (e) {
                    }
                    if (reply && reply.r && reply.r.nodes) {
                        const nodes = (0, utils_1.parseNodes)(reply.r.nodes, 20);
                        for (const node of nodes) {
                            if ((0, utils_1.isNodeId)(node.id, 20)) {
                                this.peerManager.importPeer(node);
                            }
                        }
                    }
                });
                this.emit('findNode', peer, target);
            }
            catch (error) {
                const networkError = new error_1.NetworkError(`Failed to find node: ${error instanceof Error ? error.message : String(error)}`, { operation: 'dht_find_node', peer, cause: error instanceof Error ? error : new Error(String(error)) }, true);
                this.handleError('findNode', networkError);
            }
        }
        lookup(infoHash, callback) {
            if (!this.dht || !this.isDHTRunning())
                return;
            try {
                this.dht.lookup(infoHash, (err, totalNodes) => {
                    if (err) {
                        const networkError = new error_1.NetworkError(`DHT lookup failed for ${infoHash.toString('hex')}: ${err.message}`, { operation: 'dht_lookup', infoHash: infoHash.toString('hex'), cause: err });
                        this.handleError('lookup', networkError);
                        this.emit('error', networkError);
                    }
                    if (callback) {
                        callback(err, totalNodes);
                    }
                });
                this.emit('lookup', infoHash);
            }
            catch (error) {
                const networkError = new error_1.NetworkError(`Failed to lookup: ${error instanceof Error ? error.message : String(error)}`, { operation: 'dht_lookup', infoHash: infoHash.toString('hex'), cause: error instanceof Error ? error : new Error(String(error)) });
                this.handleError('lookup', networkError);
            }
        }
        getPeers(infoHash) {
            if (!this.dht || !this.isDHTRunning())
                return;
            try {
                this.dht.getPeers(infoHash);
                this.emit('getPeers', infoHash);
            }
            catch (error) {
                const networkError = new error_1.NetworkError(`Failed to get peers: ${error instanceof Error ? error.message : String(error)}`, { operation: 'dht_get_peers', infoHash: infoHash.toString('hex'), cause: error instanceof Error ? error : new Error(String(error)) });
                this.handleError('getPeers', networkError);
            }
        }
        exportNodes() {
            return this.peerManager.exportNodes();
        }
        importNodes(nodes) {
            this.peerManager.importNodes(nodes);
        }
        exportPeers() {
            return this.peerManager.exportPeers();
        }
        importPeers(peers) {
            this.peerManager.importPeers(peers);
        }
        importPeer(peer) {
            this.peerManager.importPeer(peer);
        }
        bootstrap(populate = true) {
            var _a;
            if (!this.dht || !this.isDHTRunning())
                return;
            try {
                this.dht._bootstrap(populate);
                if (this.config.enhanceBootstrap) {
                    (_a = this.config.bootstrapNodes) === null || _a === void 0 ? void 0 : _a.forEach(node => {
                        this.findNode(node);
                    });
                }
                this.emit('bootstrap', populate);
            }
            catch (error) {
                const networkError = new error_1.NetworkError(`Failed to bootstrap: ${error instanceof Error ? error.message : String(error)}`, { operation: 'dht_bootstrap', populate, cause: error instanceof Error ? error : new Error(String(error)) });
                this.handleError('bootstrap', networkError);
            }
        }
        refresh() {
            if (!this.dht || !this.isDHTRunning())
                return;
            try {
                this.dht._bootstrap(true);
                this.emit('refresh');
            }
            catch (error) {
                const networkError = new error_1.NetworkError(`Failed to refresh: ${error instanceof Error ? error.message : String(error)}`, { operation: 'dht_refresh', cause: error instanceof Error ? error : new Error(String(error)) });
                this.handleError('refresh', networkError);
            }
        }
        addNode(node) {
            if (!this.dht || !this.isDHTRunning())
                return;
            try {
                this.dht.addNode(node);
                this.emit('addNode', node);
            }
            catch (error) {
                const networkError = new error_1.NetworkError(`Failed to add node: ${error instanceof Error ? error.message : String(error)}`, { operation: 'dht_add_node', peer: node, cause: error instanceof Error ? error : new Error(String(error)) });
                this.handleError('addNode', networkError);
            }
        }
        removeNode(nodeId) {
            if (!this.dht || !this.isDHTRunning())
                return;
            try {
                this.dht.removeNode(nodeId);
                this.emit('removeNode', nodeId);
            }
            catch (error) {
                const networkError = new error_1.NetworkError(`Failed to remove node: ${error instanceof Error ? error.message : String(error)}`, { operation: 'dht_remove_node', nodeId: nodeId.toString('hex'), cause: error instanceof Error ? error : new Error(String(error)) });
                this.handleError('removeNode', networkError);
            }
        }
        getDHTStats() {
            const peerStats = this.peerManager.getStats();
            return Object.assign({ isRunning: this.isDHTRunning(), dht: this.dht ? {
                    nodes: this.dht.nodes ? this.dht.nodes.length : 0,
                    pendingCalls: this.dht._rpc ? this.dht._rpc.pending.length : 0,
                    listening: this.dht.listening || false,
                    destroyed: this.dht.destroyed || false
                } : null }, peerStats);
        }
        getDHT() {
            return this.dht;
        }
        isDHTRunning() {
            return this.dht !== null;
        }
        getIsRunning() {
            return this.isDHTRunning();
        }
        address() {
            if (!this.dht || !this.isDHTRunning())
                return null;
            try {
                return this.dht.address();
            }
            catch (error) {
                const networkError = new error_1.NetworkError(`Failed to get address: ${error instanceof Error ? error.message : String(error)}`, { operation: 'dht_address', cause: error instanceof Error ? error : new Error(String(error)) });
                this.handleError('address', networkError);
                return null;
            }
        }
        isReady() {
            return this.dht ? this.dht.ready || false : false;
        }
        listen(port, address, callback) {
            if (!this.dht)
                return;
            this.executeWithRetry(() => __awaiter(this, void 0, void 0, function* () {
                const validatedPort = typeof port === 'number' && port > 0 && port <= 65535 ? port : undefined;
                const validatedAddress = typeof address === 'string' && address.trim() !== '' ? address.trim() : undefined;
                if (validatedPort && validatedAddress && callback) {
                    this.dht.listen(validatedPort, validatedAddress, callback);
                }
                else if (validatedPort && callback) {
                    this.dht.listen(validatedPort, callback);
                }
                else if (validatedPort) {
                    this.dht.listen(validatedPort);
                }
                else {
                    this.dht.listen();
                }
                this.emit('listening');
            }), 'listen', { port, address });
        }
        performMemoryCleanup() {
            if (!this.config.enableMemoryMonitoring)
                return;
            const memoryUsage = process.memoryUsage();
            const threshold = this.config.memoryThreshold || 100 * 1024 * 1024;
            if (memoryUsage.heapUsed > threshold) {
                this.emit('memoryWarning', {
                    heapUsed: memoryUsage.heapUsed,
                    heapTotal: memoryUsage.heapTotal,
                    external: memoryUsage.external,
                    rss: memoryUsage.rss,
                    threshold
                });
                this.cleanupMemory();
                super.performMemoryCleanup();
            }
        }
        cleanupMemory() {
            if (this.peerManager && typeof this.peerManager.cleanupOldNodes === 'function') {
                this.peerManager.cleanupOldNodes();
            }
            if (this.dht && this.dht._rpc && this.dht._rpc.nodes) {
                const nodes = this.dht._rpc.nodes;
                const now = Date.now();
                const maxAge = 30 * 60 * 1000;
                for (const [nodeId, node] of nodes.entries()) {
                    if (node.lastSeen && (now - node.lastSeen) > maxAge) {
                        this.dht._rpc.remove(nodeId);
                    }
                }
            }
            if (this.dht && this.dht._rpc && this.dht._rpc.pending) {
                const pending = this.dht._rpc.pending;
                const now = Date.now();
                const maxPendingTime = 60 * 1000;
                for (let i = pending.length - 1; i >= 0; i--) {
                    const call = pending[i];
                    if (call.timestamp && (now - call.timestamp) > maxPendingTime) {
                        pending.splice(i, 1);
                    }
                }
            }
            if (global.gc) {
                global.gc();
            }
            this.emit('memoryCleaned');
        }
        getMemoryStats() {
            const memoryUsage = process.memoryUsage();
            const threshold = this.config.memoryThreshold || 100 * 1024 * 1024;
            return {
                heapUsed: memoryUsage.heapUsed,
                heapTotal: memoryUsage.heapTotal,
                external: memoryUsage.external,
                rss: memoryUsage.rss,
                threshold,
                usagePercentage: Math.round((memoryUsage.heapUsed / threshold) * 100),
                isMemoryWarning: memoryUsage.heapUsed > threshold
            };
        }
        getManagerName() {
            return 'DHTManager';
        }
        performCleanup() {
        }
        clearData() {
        }
        getStats() {
            return Object.assign(Object.assign({}, super.getStats()), this.getDHTStats());
        }
        handleDHTError(operation, error, context) {
            const networkError = new error_1.NetworkError(`DHT operation failed: ${operation}`, Object.assign(Object.assign({ operation }, context), { cause: error instanceof Error ? error : new Error(String(error)) }));
            super.handleError(operation, networkError, context);
        }
        performDeepCleanup() {
            try {
                this.stop();
                this.removeAllListeners();
                super.performDeepCleanup();
            }
            catch (error) {
                this.handleDHTError('performDeepCleanup', error);
            }
        }
        destroy() {
            this.stop();
            this.removeAllListeners();
        }
    }
    exports.DHTManager = DHTManager;
});
