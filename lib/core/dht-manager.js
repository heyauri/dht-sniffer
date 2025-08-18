(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define(["require", "exports", "events", "../dht/dht", "../utils", "../utils/error-handler"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.DHTManager = void 0;
    const events_1 = require("events");
    const DHT = require("../dht/dht");
    const utils = require("../utils");
    const error_handler_1 = require("../utils/error-handler");
    class DHTManager extends events_1.EventEmitter {
        constructor(config, errorHandler, peerManager) {
            super();
            this.config = config;
            this.errorHandler = errorHandler;
            this.peerManager = peerManager;
            this.dht = null;
            this.refreshInterval = null;
            this.announceInterval = null;
            this.isRunning = false;
        }
        start() {
            if (this.isRunning) {
                return;
            }
            try {
                this.dht = new DHT.DHT(this.config);
                this.setupEventListeners();
                this.startPeriodicTasks();
                this.isRunning = true;
                this.emit('started');
            }
            catch (error) {
                const networkError = new error_handler_1.NetworkError(`Failed to start DHT: ${error instanceof Error ? error.message : String(error)}`, { operation: 'dht_start', config: this.config }, error instanceof Error ? error : new Error(String(error)));
                this.errorHandler.handleError(networkError);
                throw networkError;
            }
        }
        stop() {
            if (!this.isRunning) {
                return;
            }
            try {
                this.clearPeriodicTasks();
                if (this.dht) {
                    this.dht.destroy();
                    this.dht = null;
                }
                this.isRunning = false;
                this.emit('stopped');
            }
            catch (error) {
                const networkError = new error_handler_1.NetworkError(`Failed to stop DHT: ${error instanceof Error ? error.message : String(error)}`, { operation: 'dht_stop' }, error instanceof Error ? error : new Error(String(error)));
                this.errorHandler.handleError(networkError);
            }
        }
        setupEventListeners() {
            if (!this.dht)
                return;
            this.dht.on('node', (node) => {
                this.peerManager.addNode(node);
                this.emit('node', node);
            });
            this.dht.on('peer', (peer, infoHash) => {
                this.peerManager.addPeer({ infoHash, peer });
                this.emit('peer', { infoHash, peer });
            });
            this.dht.on('get_peers', (data) => {
                this.peerManager.importPeer(data.peer);
                this.emit('infoHash', { infoHash: data.infoHash, peer: data.peer });
            });
            this.dht.on('error', (error) => {
                const networkError = new error_handler_1.NetworkError(`DHT error: ${error.message}`, { operation: 'dht_event' }, error);
                this.errorHandler.handleError(networkError);
                this.emit('error', networkError);
            });
            this.dht.on('warning', (warning) => {
                this.emit('warning', warning);
            });
        }
        startPeriodicTasks() {
            this.refreshInterval = setInterval(() => {
                this.refreshNodes();
            }, this.config.refreshPeriod);
            this.announceInterval = setInterval(() => {
                this.announce();
            }, this.config.announcePeriod);
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
        }
        refreshNodes() {
            if (!this.dht || !this.isRunning)
                return;
            try {
                this.dht.refresh();
                this.emit('refresh');
            }
            catch (error) {
                const networkError = new error_handler_1.NetworkError(`Failed to refresh nodes: ${error instanceof Error ? error.message : String(error)}`, { operation: 'dht_refresh' }, error instanceof Error ? error : new Error(String(error)));
                this.errorHandler.handleError(networkError);
            }
        }
        announce() {
            if (!this.dht || !this.isRunning)
                return;
            try {
                this.dht.announce();
                this.emit('announce');
            }
            catch (error) {
                const networkError = new error_handler_1.NetworkError(`Failed to announce: ${error instanceof Error ? error.message : String(error)}`, { operation: 'dht_announce' }, error instanceof Error ? error : new Error(String(error)));
                this.errorHandler.handleError(networkError);
            }
        }
        findNode(peer, nodeId) {
            if (!this.dht || !this.isRunning)
                return;
            try {
                const nodeKey = utils.getPeerKey(peer);
                const target = nodeId !== undefined
                    ? utils.getNeighborId(nodeId, this.dht.nodeId)
                    : this.dht.nodeId;
                const message = {
                    t: require('crypto').randomBytes(4),
                    y: 'q',
                    q: 'find_node',
                    a: {
                        id: this.dht.nodeId,
                        target: require('crypto').randomBytes(20)
                    }
                };
                this.dht._rpc.query(peer, message, (err, reply) => {
                    try {
                        if (peer && peer.id && this.dht._rpc.nodes.get(peer.id) && utils.isNodeId(peer.id, 20)) {
                            if (err && (err.code === 'EUNEXPECTEDNODE' || err.code === 'ETIMEDOUT')) {
                                this.dht._rpc.remove(peer.id);
                            }
                        }
                    }
                    catch (e) {
                    }
                    if (reply && reply.r && reply.r.nodes) {
                        const nodes = utils.parseNodes(reply.r.nodes, 20);
                        for (const node of nodes) {
                            if (utils.isNodeId(node.id, 20)) {
                                this.peerManager.importPeer(node);
                            }
                        }
                    }
                });
                this.emit('findNode', peer, target);
            }
            catch (error) {
                const networkError = new error_handler_1.NetworkError(`Failed to find node: ${error instanceof Error ? error.message : String(error)}`, { operation: 'dht_find_node', peer }, error instanceof Error ? error : new Error(String(error)));
                this.errorHandler.handleError(networkError);
            }
        }
        lookup(infoHash, callback) {
            if (!this.dht || !this.isRunning)
                return;
            try {
                this.dht.lookup(infoHash, (err, totalNodes) => {
                    if (err) {
                        const networkError = new error_handler_1.NetworkError(`DHT lookup failed for ${infoHash.toString('hex')}: ${err.message}`, { operation: 'dht_lookup', infoHash: infoHash.toString('hex') }, err);
                        this.errorHandler.handleError(networkError);
                        this.emit('error', networkError);
                    }
                    if (callback) {
                        callback(err, totalNodes);
                    }
                });
                this.emit('lookup', infoHash);
            }
            catch (error) {
                const networkError = new error_handler_1.NetworkError(`Failed to lookup: ${error instanceof Error ? error.message : String(error)}`, { operation: 'dht_lookup', infoHash: infoHash.toString('hex') }, error instanceof Error ? error : new Error(String(error)));
                this.errorHandler.handleError(networkError);
            }
        }
        getPeers(infoHash) {
            if (!this.dht || !this.isRunning)
                return;
            try {
                this.dht.getPeers(infoHash);
                this.emit('getPeers', infoHash);
            }
            catch (error) {
                const networkError = new error_handler_1.NetworkError(`Failed to get peers: ${error instanceof Error ? error.message : String(error)}`, { operation: 'dht_get_peers', infoHash: infoHash.toString('hex') }, error instanceof Error ? error : new Error(String(error)));
                this.errorHandler.handleError(networkError);
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
        bootstrap(populate = true) {
            if (!this.dht || !this.isRunning)
                return;
            try {
                this.dht._bootstrap(populate);
                this.emit('bootstrap', populate);
            }
            catch (error) {
                const networkError = new error_handler_1.NetworkError(`Failed to bootstrap: ${error instanceof Error ? error.message : String(error)}`, { operation: 'dht_bootstrap', populate }, error instanceof Error ? error : new Error(String(error)));
                this.errorHandler.handleError(networkError);
            }
        }
        refresh() {
            if (!this.dht || !this.isRunning)
                return;
            try {
                this.dht.refresh();
                this.emit('refresh');
            }
            catch (error) {
                const networkError = new error_handler_1.NetworkError(`Failed to refresh: ${error instanceof Error ? error.message : String(error)}`, { operation: 'dht_refresh' }, error instanceof Error ? error : new Error(String(error)));
                this.errorHandler.handleError(networkError);
            }
        }
        addNode(node) {
            if (!this.dht || !this.isRunning)
                return;
            try {
                this.dht.addNode(node);
                this.emit('addNode', node);
            }
            catch (error) {
                const networkError = new error_handler_1.NetworkError(`Failed to add node: ${error instanceof Error ? error.message : String(error)}`, { operation: 'dht_add_node', peer: node }, error instanceof Error ? error : new Error(String(error)));
                this.errorHandler.handleError(networkError);
            }
        }
        removeNode(nodeId) {
            if (!this.dht || !this.isRunning)
                return;
            try {
                this.dht.removeNode(nodeId);
                this.emit('removeNode', nodeId);
            }
            catch (error) {
                const networkError = new error_handler_1.NetworkError(`Failed to remove node: ${error instanceof Error ? error.message : String(error)}`, { operation: 'dht_remove_node', nodeId: nodeId.toString('hex') }, error instanceof Error ? error : new Error(String(error)));
                this.errorHandler.handleError(networkError);
            }
        }
        getStats() {
            const peerStats = this.peerManager.getStats();
            return Object.assign({ isRunning: this.isRunning, dht: this.dht ? {
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
            return this.isRunning;
        }
        address() {
            if (!this.dht || !this.isRunning)
                return null;
            try {
                return this.dht.address();
            }
            catch (error) {
                const networkError = new error_handler_1.NetworkError(`Failed to get address: ${error instanceof Error ? error.message : String(error)}`, { operation: 'dht_address' }, error instanceof Error ? error : new Error(String(error)));
                this.errorHandler.handleError(networkError);
                return null;
            }
        }
        isReady() {
            return this.dht ? this.dht.ready || false : false;
        }
        listen(port, address, callback) {
            if (!this.dht)
                return;
            try {
                if (port && address && callback) {
                    this.dht.listen(port, address, callback);
                }
                else if (port && callback) {
                    this.dht.listen(port, callback);
                }
                else if (port) {
                    this.dht.listen(port);
                }
                else {
                    this.dht.listen();
                }
                this.emit('listening');
            }
            catch (error) {
                const networkError = new error_handler_1.NetworkError(`Failed to listen: ${error instanceof Error ? error.message : String(error)}`, { operation: 'dht_listen', port, address }, error instanceof Error ? error : new Error(String(error)));
                this.errorHandler.handleError(networkError);
            }
        }
    }
    exports.DHTManager = DHTManager;
});
