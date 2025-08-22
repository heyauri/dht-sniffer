(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define(["require", "exports", "../types/error", "../utils/dht-utils", "../utils/array-utils", "./base-manager"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.PeerManager = void 0;
    const error_1 = require("../types/error");
    const dht_utils_1 = require("../utils/dht-utils");
    const array_utils_1 = require("../utils/array-utils");
    const base_manager_1 = require("./base-manager");
    class PeerManager extends base_manager_1.BaseManager {
        constructor(config, dht, cacheManager, errorHandler) {
            super(config, errorHandler);
            this.dht = dht;
            this.rpc = dht === null || dht === void 0 ? void 0 : dht._rpc;
            this.cacheManager = cacheManager;
            this.nodes = [];
            this.nodesDict = {};
            this.nodeCreationTimes = new Map();
        }
        importPeer(peer) {
            if (!peer || !peer.host || !peer.port) {
                this.handleError('importPeer', new error_1.ValidationError('Invalid peer data', { peer }), { peer, errorType: error_1.ErrorType.VALIDATION });
                return;
            }
            const peerKey = (0, dht_utils_1.getPeerKey)(peer);
            if (!this.nodesDict[peerKey]) {
                try {
                    this.dht.addNode({ host: peer.host, port: peer.port });
                }
                catch (error) {
                    this.handleError('importPeer', error, { peer, errorType: error_1.ErrorType.NETWORK });
                }
            }
        }
        importUsefulPeers() {
            if (!this.cacheManager || !this.cacheManager.getUsefulPeers) {
                this.handleError('importUsefulPeers', new error_1.ValidationError('Cache manager not available', { operation: 'importUsefulPeers' }), { errorType: error_1.ErrorType.VALIDATION });
                return;
            }
            try {
                const usefulPeers = this.cacheManager.getUsefulPeers();
                const peers = (0, array_utils_1.shuffle)([...usefulPeers.values()]);
                for (const peer of peers) {
                    if (Math.random() > Math.min(0.99, (this.rpc.pending.length / 50 + this.nodes.length / 500))) {
                        this.importPeer(peer);
                    }
                }
            }
            catch (error) {
                this.handleError('importUsefulPeers', error, { errorType: error_1.ErrorType.SYSTEM });
            }
        }
        exportUsefulPeers() {
            const usefulPeers = this.cacheManager.getUsefulPeers();
            const peers = [];
            for (const [_key, value] of usefulPeers) {
                peers.push(Object.assign(Object.assign({}, value.peer), { infoHash: value.infoHash }));
            }
            return peers;
        }
        updateNodes() {
            if (!this.dht || !this.dht._rpc || !this.dht._rpc.nodes) {
                this.handleError('updateNodes', new error_1.ValidationError('DHT RPC not available', { operation: 'updateNodes' }), { errorType: error_1.ErrorType.VALIDATION });
                return;
            }
            try {
                const nodes = this.dht._rpc.nodes.toArray();
                this.nodes = nodes;
                this.nodesDict = nodes.reduce((prev, curr) => {
                    prev[(0, dht_utils_1.getPeerKey)(curr)] = 1;
                    return prev;
                }, {});
                (0, array_utils_1.shuffle)(this.nodes);
            }
            catch (error) {
                this.handleError('updateNodes', error, { errorType: error_1.ErrorType.NETWORK });
            }
        }
        getNodeCount() {
            return this.nodes.length;
        }
        getNodesDict() {
            return Object.assign({}, this.nodesDict);
        }
        getNodes() {
            return [...this.nodes];
        }
        shouldExpandNodes(lastReceiveTime) {
            const timeDiff = Date.now() - lastReceiveTime.getTime();
            return this.nodes.length < 5 || timeDiff > this.config.nodeRefreshTime;
        }
        shouldCallFindNode(node) {
            const nodeKey = `${node.host}:${node.port}`;
            const findNodeCache = this.cacheManager.getFindNodeCache();
            const latestCalledPeers = this.cacheManager.getLatestCalledPeers();
            return !findNodeCache.get(nodeKey) &&
                !latestCalledPeers.get(nodeKey) &&
                Math.random() > this.config.findNodeProbability + this.rpc.pending.length / 10 &&
                this.nodes.length < this.config.maxNodes;
        }
        markNodeAsCalled(node) {
            const nodeKey = `${node.host}:${node.port}`;
            const findNodeCache = this.cacheManager.getFindNodeCache();
            const latestCalledPeers = this.cacheManager.getLatestCalledPeers();
            findNodeCache.set(nodeKey, 1);
            latestCalledPeers.set(nodeKey, 1);
        }
        isNodeCountCritical() {
            return this.nodes.length <= 3;
        }
        setDHT(dht) {
            this.dht = dht;
            this.rpc = dht === null || dht === void 0 ? void 0 : dht._rpc;
        }
        cleanup() {
            try {
                const now = Date.now();
                const maxAge = this.config.maxNodeAge || 24 * 60 * 60 * 1000;
                this.nodes = this.nodes.filter(node => {
                    const nodeKey = (0, dht_utils_1.getPeerKey)(node);
                    const creationTime = this.nodeCreationTimes.get(nodeKey);
                    if (creationTime && (now - creationTime) > maxAge) {
                        delete this.nodesDict[nodeKey];
                        this.nodeCreationTimes.delete(nodeKey);
                        return false;
                    }
                    return true;
                });
                for (const [nodeKey, creationTime] of this.nodeCreationTimes.entries()) {
                    if ((now - creationTime) > maxAge) {
                        this.nodeCreationTimes.delete(nodeKey);
                        delete this.nodesDict[nodeKey];
                    }
                }
                this.emit('cleanupCompleted', {
                    remainingNodes: this.nodes.length,
                    cleanedNodes: this.nodes.length - this.nodes.length
                });
            }
            catch (error) {
                this.handleError('cleanup', error, { errorType: error_1.ErrorType.SYSTEM });
            }
        }
        addNode(node) {
            if (!node || !node.host || !node.port) {
                this.handleError('addNode', new error_1.ValidationError('Invalid node data', { node }), { node, errorType: error_1.ErrorType.VALIDATION });
                return;
            }
            try {
                const nodeKey = (0, dht_utils_1.getPeerKey)(node);
                if (!this.nodesDict[nodeKey]) {
                    if (this.nodes.length >= this.config.maxNodes) {
                        this.cleanupOldNodes();
                    }
                    if (this.nodes.length >= this.config.maxNodes) {
                        return;
                    }
                    this.nodes.push(node);
                    this.nodesDict[nodeKey] = this.nodes.length - 1;
                    this.nodeCreationTimes.set(nodeKey, Date.now());
                    this.emit('node', node);
                }
            }
            catch (error) {
                this.handleError('addNode', error, { node, errorType: error_1.ErrorType.SYSTEM });
            }
        }
        addPeer(peerInfo) {
            if (!peerInfo || !peerInfo.peer || !peerInfo.infoHash) {
                this.handleError('addPeer', new error_1.ValidationError('Invalid peer info', { peerInfo }), { peerInfo, errorType: error_1.ErrorType.VALIDATION });
                return;
            }
            try {
                const { peer, infoHash } = peerInfo;
                const peerKey = (0, dht_utils_1.getPeerKey)(peer);
                this.cacheManager.addPeerToCache(peerKey, { peer, infoHash });
                this.emit('peer', { infoHash, peer });
            }
            catch (error) {
                this.handleError('addPeer', error instanceof Error ? error : new Error(String(error)), { peerInfo, errorType: error_1.ErrorType.CACHE });
            }
        }
        exportNodes() {
            return [...this.nodes];
        }
        importNodes(nodes) {
            if (!Array.isArray(nodes)) {
                this.handleError('importNodes', new error_1.ValidationError('Nodes must be an array', { nodes }), { nodes, errorType: error_1.ErrorType.VALIDATION });
                return;
            }
            try {
                for (const node of nodes) {
                    this.addNode(node);
                }
            }
            catch (error) {
                this.handleError('importNodes', error instanceof Error ? error : new Error(String(error)), { nodes, errorType: error_1.ErrorType.SYSTEM });
            }
        }
        exportPeers() {
            return this.cacheManager.getAllPeers();
        }
        importPeers(peers) {
            if (!Array.isArray(peers)) {
                this.handleError('importPeers', new error_1.ValidationError('Peers must be an array', { peers }), { peers, errorType: error_1.ErrorType.VALIDATION });
                return;
            }
            try {
                for (const peer of peers) {
                    this.cacheManager.addPeerToCache((0, dht_utils_1.getPeerKey)(peer), peer);
                }
            }
            catch (error) {
                this.handleError('importPeers', error instanceof Error ? error : new Error(String(error)), { peers, errorType: error_1.ErrorType.CACHE });
            }
        }
        getPeerStats() {
            return {
                nodeCount: this.nodes.length,
                peerCount: this.cacheManager.getPeerCount(),
                cacheStats: this.cacheManager.getStats()
            };
        }
        clearPeerData() {
            this.nodes = [];
            this.nodesDict = {};
            this.nodeCreationTimes.clear();
            this.emit('peerDataCleared');
        }
        cleanupOldNodes() {
            const now = Date.now();
            const maxAge = this.config.maxNodeAge || 24 * 60 * 60 * 1000;
            this.nodes = this.nodes.filter((node, _index) => {
                const nodeKey = (0, dht_utils_1.getPeerKey)(node);
                const creationTime = this.nodeCreationTimes.get(nodeKey);
                if (creationTime && (now - creationTime) > maxAge) {
                    delete this.nodesDict[nodeKey];
                    this.nodeCreationTimes.delete(nodeKey);
                    return false;
                }
                return true;
            });
            this.nodesDict = {};
            this.nodes.forEach((node, index) => {
                this.nodesDict[(0, dht_utils_1.getPeerKey)(node)] = index;
            });
        }
        getManagerName() {
            return 'PeerManager';
        }
        performCleanup() {
            try {
                this.cleanupOldNodes();
                if (this.config.enableMemoryMonitoring) {
                }
            }
            catch (error) {
                this.handleError('performCleanup', error instanceof Error ? error : new Error(String(error)), { errorType: error_1.ErrorType.SYSTEM });
            }
        }
        clearData() {
            this.clearPeerData();
        }
        getStats() {
            return Object.assign(Object.assign({}, super.getStats()), this.getPeerStats());
        }
        handlePeerError(operation, error, context) {
            const peerError = new error_1.ValidationError(`Peer operation failed: ${operation}`, Object.assign(Object.assign({ operation }, context), { cause: error instanceof Error ? error : new Error(String(error)) }));
            super.handleError(operation, peerError, context);
        }
        performDeepCleanup() {
            try {
                this.clearPeerData();
                super.performDeepCleanup();
            }
            catch (error) {
                this.handlePeerError('performDeepCleanup', error);
            }
        }
    }
    exports.PeerManager = PeerManager;
});
